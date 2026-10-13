// EDELICACIES — Edge Function: notify-subscribers
//
// Called from the owner dashboard's "Notify subscribers" button. Emails
// everyone who signed up for menu alerts that today's (or a chosen day's)
// menu is live, with a link to order. Only works when called with the
// owner's own logged-in session — anyone else gets rejected.
//
// Paste this whole file into the Supabase dashboard's Edge Function editor
// for a function named "notify-subscribers". Leave "Verify JWT" ON for this
// one (default) since only the logged-in owner should be able to trigger it.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Edelicacies <onboarding@resend.dev>'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SITE_URL = Deno.env.get('SITE_URL') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Content-Type matters: without it the browser library hands the reply back
// as plain text instead of an object (the dashboard then showed
// "Sent to undefined of undefined subscribers").
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  if (err && typeof err === 'object') return JSON.stringify(err)
  return String(err)
}

function render(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

// "Today's", "Tomorrow's", or "Monday, 30 September's" — computed from the
// actual menu date so the email never just says "today" when the owner is
// notifying about a different day (e.g. scheduling tomorrow's menu ahead).
function dateLabel(menuDate: string): string {
  const lagosDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(d)
  const today = lagosDate(new Date())
  const tomorrow = lagosDate(new Date(Date.now() + 24 * 60 * 60 * 1000))
  if (menuDate === today) return "Today's"
  if (menuDate === tomorrow) return "Tomorrow's"
  const [y, m, d] = menuDate.split('-').map(Number)
  const formatted = new Intl.DateTimeFormat('en-NG', {
    timeZone: 'Africa/Lagos',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(y, m - 1, d, 12)))
  return `${formatted}'s`
}

// "Tuesday, 13 October" — printed in the email so the date is never ambiguous.
function longDate(menuDate: string): string {
  const [y, m, d] = menuDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(y, m - 1, d, 12)))
}

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function paragraphs(text: string): string {
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => `<p>${line}</p>`)
    .join('')
}

// deno-lint-ignore no-explicit-any
async function getTemplate(supabase: any, key: string, fallbackSubject: string, fallbackBody: string) {
  const { data } = await supabase.from('email_templates').select('subject, body').eq('key', key).maybeSingle()
  return { subject: data?.subject ?? fallbackSubject, body: data?.body ?? fallbackBody }
}

function emailShell(bodyHtml: string, unsubscribeId: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f5f5;font-family:-apple-system,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:24px 16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:24px;font-weight:700;color:#ff002c;">Edelicacies</span>
      </div>
      <div style="background:#fff;border-radius:16px;padding:24px;color:#121216;line-height:1.5;">
        ${bodyHtml}
      </div>
      <p style="text-align:center;color:#9a9aa2;font-size:11px;margin-top:16px;">
        You're receiving this because you asked to be notified when the Edelicacies menu is live.
        <a href="${SITE_URL}/unsubscribe?id=${unsubscribeId}" style="color:#9a9aa2;">Unsubscribe</a>
      </p>
    </div>
  </body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData } = await callerClient.auth.getUser()
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'Owner login required' }), {
        status: 401,
        headers: CORS_HEADERS,
      })
    }
    // Customers can log in too, so "logged in" is not enough: must be the owner.
    const { data: isOwner } = await callerClient.rpc('is_owner')
    if (isOwner !== true) {
      return new Response(JSON.stringify({ error: 'Only the owner can do this' }), {
        status: 403,
        headers: CORS_HEADERS,
      })
    }

    const { menuDate } = await req.json()
    if (!menuDate) {
      return new Response(JSON.stringify({ error: 'menuDate is required' }), {
        status: 400,
        headers: CORS_HEADERS,
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: dailyMenu } = await supabase
      .from('daily_menus')
      .select('id')
      .eq('menu_date', menuDate)
      .maybeSingle()

    type MenuItemRef = { name: string; category: 'food' | 'drink'; image_url: string | null }
    let foodItems: MenuItemRef[] = []
    let drinkItems: MenuItemRef[] = []
    if (dailyMenu) {
      const { data: slots } = await supabase
        .from('daily_menu_slots')
        .select('menu_items(name, category, image_url)')
        .eq('daily_menu_id', dailyMenu.id)

      const items: MenuItemRef[] = (slots ?? [])
        .map((s: { menu_items: MenuItemRef | MenuItemRef[] | null }) =>
          Array.isArray(s.menu_items) ? s.menu_items[0] : s.menu_items,
        )
        .filter((i: MenuItemRef | null | undefined): i is MenuItemRef => Boolean(i?.name))

      // One entry per dish (a dish with several sizes appears once).
      const unique = (list: MenuItemRef[]) => [...new Map(list.map((i) => [i.name, i])).values()]
      foodItems = unique(items.filter((i: MenuItemRef) => i.category === 'food'))
      drinkItems = unique(items.filter((i: MenuItemRef) => i.category === 'drink'))
    }

    const { data: subscribers, error: subError } = await supabase
      .from('subscribers')
      .select('id, email')
      .eq('unsubscribed', false)
    if (subError) throw subError

    const orderLink = SITE_URL || 'our website'
    // For a future day, the button jumps straight to the Tomorrow's Menu
    // section instead of the top of the homepage (which shows today first).
    const lagosToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date())
    const isFutureMenu = menuDate > lagosToday
    const orderUrl = isFutureMenu && SITE_URL ? `${SITE_URL}/#tomorrow` : SITE_URL
    const tmpl = await getTemplate(
      supabase,
      'menu_live_subscribers',
      "{{date_label}} menu is live — Edelicacies",
      '{{date_label}} menu is ready!',
    )
    // The only placeholder here is {{date_label}} ("Today's" / "Tomorrow's" /
    // a full date) — the item list is always generated and appended below
    // the owner's text, the same way order details are in the other emails.
    const label = dateLabel(menuDate)
    const vars = { date_label: label }

    // Safety net: an older template may still say "Today's" in plain text.
    // If this menu is for another day, swap it for the right label so the
    // subject and message can never claim the wrong day.
    const fixDay = (text: string) =>
      label === "Today's" ? text : text.replace(/\btoday['\u2019]s\b/gi, label)

    const subject = fixDay(render(tmpl.subject, vars))
    const bodyText = paragraphs(fixDay(render(tmpl.body, vars)))

    function categorySection(label: string, list: MenuItemRef[]): string {
      if (list.length === 0) return ''
      const rows = list
        .map((i) => {
          const photo = i.image_url
            ? `<img src="${i.image_url}" alt="${esc(i.name)}" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:10px;border:0;" />`
            : ''
          return `<tr>
            <td width="68" style="padding:6px 12px 6px 0;vertical-align:middle;">${photo}</td>
            <td style="padding:6px 0;vertical-align:middle;font-weight:600;">${esc(i.name)}</td>
          </tr>`
        })
        .join('')
      return `
        <p style="margin:16px 0 4px;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;color:#6b6b75;">${label}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
      `
    }
    const itemListHtml = categorySection('Food', foodItems) + categorySection('Drinks', drinkItems)

    let sent = 0
    if (RESEND_API_KEY) {
      for (const sub of subscribers ?? []) {
        const html = emailShell(
          `
          ${bodyText}
          <p style="margin:12px 0 0;font-weight:600;">Menu for ${longDate(menuDate)}${isFutureMenu ? ' (pre-order)' : ''}</p>
          ${itemListHtml}
          <p><a href="${orderUrl}" style="color:#ff002c;">${isFutureMenu ? 'Pre-order now' : 'Order now'} at ${orderLink}</a></p>
        `,
          sub.id,
        )
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM_EMAIL, to: sub.email, subject, html }),
        })
        if (res.ok) sent++
        else console.error('Resend error', res.status, await res.text())
      }
    }

    return new Response(JSON.stringify({ ok: true, subscriberCount: subscribers?.length ?? 0, sent }), {
      headers: CORS_HEADERS,
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: errorMessage(err) }), { status: 500, headers: CORS_HEADERS })
  }
})
