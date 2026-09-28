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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    let itemNames: string[] = []
    if (dailyMenu) {
      const { data: slots } = await supabase
        .from('daily_menu_slots')
        .select('menu_items(name)')
        .eq('daily_menu_id', dailyMenu.id)
      itemNames = [
        ...new Set(
          (slots ?? [])
            .map((s: { menu_items: { name: string } | { name: string }[] | null }) => {
              const rel = Array.isArray(s.menu_items) ? s.menu_items[0] : s.menu_items
              return rel?.name
            })
            .filter((n): n is string => Boolean(n)),
        ),
      ]
    }

    const { data: subscribers, error: subError } = await supabase
      .from('subscribers')
      .select('id, email')
      .eq('unsubscribed', false)
    if (subError) throw subError

    const orderLink = SITE_URL || 'our website'
    const tmpl = await getTemplate(
      supabase,
      'menu_live_subscribers',
      "Today's menu is live — Edelicacies",
      "Today's menu is ready!",
    )
    // No placeholders in this template — the item list is always generated
    // and appended below the owner's text, the same way order details are
    // appended in the other emails.
    const subject = render(tmpl.subject, {})
    const bodyText = paragraphs(render(tmpl.body, {}))
    const itemListHtml = itemNames.length
      ? `<ul style="margin:12px 0;padding-left:20px;">${itemNames.map((n) => `<li style="padding:3px 0;">${n}</li>`).join('')}</ul>`
      : ''

    let sent = 0
    if (RESEND_API_KEY) {
      for (const sub of subscribers ?? []) {
        const html = emailShell(
          `
          ${bodyText}
          ${itemListHtml}
          <p><a href="${SITE_URL}" style="color:#ff002c;">Order now at ${orderLink}</a></p>
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
