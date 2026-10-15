// EDELICACIES — Edge Function: send-broadcast
//
// Powers Dashboard -> Messaging. Only a logged-in owner can use it.
//
//   action "counts"  -> how many people are in each audience (+ today's usage)
//   action "test"    -> sends the email to the owner's own address only
//   action "send"    -> sends it to the chosen audience, one email per person
//
// Every email goes out individually (nobody sees anyone else's address) and
// carries a personal unsubscribe link when the person is a subscriber or a
// customer. People who unsubscribed are never emailed, except when the owner
// types an address in by hand.
//
// Paste this whole file into the Supabase dashboard's Edge Function editor
// for a function named "send-broadcast". Leave "Verify JWT" ON.
//
// Uses the same secrets as the other email functions:
// RESEND_API_KEY, FROM_EMAIL, SITE_URL.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Edelicacies <onboarding@resend.dev>'
const SITE_URL = Deno.env.get('SITE_URL') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

// Keeps room for order emails (confirmations, status updates) in the daily
// allowance, so a broadcast can never use up every last email of the day.
const ORDER_EMAIL_RESERVE = 20
const CHUNK = 2 // emails sent at once
const GAP_MS = 600 // pause between chunks (well under Resend's 10 requests/second)
const RUN_BUDGET_MS = 110_000 // stop before the function times out
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Audience =
  | 'individual'
  | 'everyone'
  | 'subscribers'
  | 'customers'
  | 'ordered_today'
  | 'ordered_on_date'
  | 'never_ordered'
  | 'inactive_30'

const AUDIENCES: Audience[] = [
  'individual',
  'everyone',
  'subscribers',
  'customers',
  'ordered_today',
  'ordered_on_date',
  'never_ordered',
  'inactive_30',
]

type Recipient = { email: string; name: string | null; unsubscribeUrl: string | null }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS })
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  if (err && typeof err === 'object') return JSON.stringify(err)
  return String(err)
}

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function lagosToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date())
}

function firstName(name: string | null): string {
  const first = (name ?? '').trim().split(/\s+/)[0]
  return first || 'there'
}

function emailShell(bodyHtml: string, unsubscribeUrl: string | null): string {
  const footer = unsubscribeUrl
    ? `You are receiving this because you ordered from, or signed up for updates from, Edelicacies.
        <a href="${unsubscribeUrl}" style="color:#9a9aa2;">Unsubscribe</a>`
    : 'Sent by Edelicacies, Uyo.'
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f5f5;font-family:-apple-system,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <img src="${(SITE_URL || 'https://edelicacies.com').replace(/\/+$/, '')}/email-logo.png" alt="" width="180" style="display:block;margin:0 auto;width:180px;max-width:70%;height:auto;border:0;" />
        <div style="font-size:20px;font-weight:700;color:#ff002c;margin-top:6px;letter-spacing:0.2px;">Edelicacies</div>
      </div>
      <div style="background:#fff;border-radius:16px;padding:24px;color:#121216;line-height:1.55;font-size:15px;">
        ${bodyHtml}
      </div>
      <p style="text-align:center;color:#9a9aa2;font-size:11px;margin-top:16px;">
        ${footer}<br />
        <a href="https://wa.me/2349021465560" style="color:#9a9aa2;">WhatsApp us</a>
      </p>
    </div>
  </body>
</html>`
}

async function sendOne(
  to: string,
  subject: string,
  html: string,
  attachments: { filename: string; content: string }[],
): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

// deno-lint-ignore no-explicit-any
type Db = any

// Builds every audience from the database. Returns one list per audience,
// already de-duplicated and with opted-out people removed.
async function buildAudiences(db: Db, onDate: string): Promise<Record<Exclude<Audience, 'individual'>, Recipient[]>> {
  const [subsRes, custsRes, ordersRes] = await Promise.all([
    db.from('subscribers').select('id, email, name, unsubscribed'),
    db.from('customers').select('id, email, name, unsubscribed, last_order_at'),
    db.from('orders').select('customer_email, customer_name, menu_date, status'),
  ])
  for (const r of [subsRes, custsRes, ordersRes]) if (r.error) throw r.error

  const subs = (subsRes.data ?? []) as { id: string; email: string; name: string | null; unsubscribed: boolean }[]
  const custs = (custsRes.data ?? []) as {
    id: string
    email: string | null
    name: string | null
    unsubscribed: boolean
    last_order_at: string
  }[]
  const orders = (ordersRes.data ?? []) as {
    customer_email: string | null
    customer_name: string | null
    menu_date: string
    status: string
  }[]

  const norm = (e: string | null | undefined) => (e ?? '').trim().toLowerCase()

  // Anyone who opted out anywhere is opted out everywhere.
  const optedOut = new Set<string>()
  for (const s of subs) if (s.unsubscribed) optedOut.add(norm(s.email))
  for (const c of custs) if (c.unsubscribed) optedOut.add(norm(c.email))

  // Best unsubscribe link we can give each address.
  const unsubUrl = new Map<string, string>()
  if (SITE_URL) {
    for (const c of custs) if (c.email) unsubUrl.set(norm(c.email), `${SITE_URL}/unsubscribe?c=${c.id}`)
    for (const s of subs) unsubUrl.set(norm(s.email), `${SITE_URL}/unsubscribe?id=${s.id}`)
  }

  const nameOf = new Map<string, string>()
  for (const o of orders) if (o.customer_email && o.customer_name) nameOf.set(norm(o.customer_email), o.customer_name)
  for (const c of custs) if (c.email && c.name) nameOf.set(norm(c.email), c.name)
  for (const s of subs) if (s.name) nameOf.set(norm(s.email), s.name)

  function toList(emails: Iterable<string>): Recipient[] {
    const seen = new Set<string>()
    const out: Recipient[] = []
    for (const raw of emails) {
      const email = norm(raw)
      if (!EMAIL_RE.test(email) || seen.has(email) || optedOut.has(email)) continue
      seen.add(email)
      out.push({ email, name: nameOf.get(email) ?? null, unsubscribeUrl: unsubUrl.get(email) ?? null })
    }
    return out
  }

  const today = lagosToday()
  const liveOrders = orders.filter((o) => o.status !== 'cancelled' && o.customer_email)
  const orderEmails = new Set(orders.map((o) => norm(o.customer_email)).filter(Boolean))
  const customerEmails = new Set(custs.map((c) => norm(c.email)).filter(Boolean))
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

  const subscribers = subs.filter((s) => !s.unsubscribed).map((s) => s.email)
  const customers = custs.filter((c) => c.email).map((c) => c.email as string)

  return {
    subscribers: toList(subscribers),
    customers: toList(customers),
    everyone: toList([...subscribers, ...customers]),
    ordered_today: toList(liveOrders.filter((o) => o.menu_date === today).map((o) => o.customer_email as string)),
    ordered_on_date: toList(liveOrders.filter((o) => o.menu_date === onDate).map((o) => o.customer_email as string)),
    never_ordered: toList(
      subscribers.filter((e) => !orderEmails.has(norm(e)) && !customerEmails.has(norm(e))),
    ),
    inactive_30: toList(
      custs
        .filter((c) => c.email && new Date(c.last_order_at).getTime() < thirtyDaysAgo)
        .map((c) => c.email as string),
    ),
  }
}

async function usageToday(db: Db): Promise<{ sentToday: number; dailyLimit: number }> {
  const midnightUtc = new Date()
  midnightUtc.setUTCHours(0, 0, 0, 0)
  const { data } = await db
    .from('email_campaigns')
    .select('sent_count')
    .gte('created_at', midnightUtc.toISOString())
  const sentToday = (data ?? []).reduce((n: number, r: { sent_count: number }) => n + (r.sent_count ?? 0), 0)

  const { data: setting } = await db.from('settings').select('value').eq('key', 'email_daily_limit').maybeSingle()
  const dailyLimit = Number(setting?.value?.limit) > 0 ? Number(setting.value.limit) : 100
  return { sentToday, dailyLimit }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  try {
    // Only a logged-in owner may use this.
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: userData } = await callerClient.auth.getUser()
    if (!userData?.user) return json({ error: 'Owner login required.' }, 401)
    // Customers can log in too, so "logged in" is not enough: must be the owner.
    const { data: isOwner } = await callerClient.rpc('is_owner')
    if (isOwner !== true) return json({ error: 'Only the owner can send messages.' }, 403)
    const ownerEmail = userData.user.email ?? ''

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const body = await req.json().catch(() => ({}))
    const action = String(body.action ?? 'send')
    const onDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date ?? '')) ? String(body.date) : lagosToday()

    if (action === 'counts') {
      const lists = await buildAudiences(db, onDate)
      const counts: Record<string, number> = {}
      for (const [key, list] of Object.entries(lists)) counts[key] = list.length
      return json({ counts, ...(await usageToday(db)), reserve: ORDER_EMAIL_RESERVE })
    }

    const subject = String(body.subject ?? '').trim()
    const html = String(body.body ?? '')
    if (!subject) return json({ error: 'Subject is required.' }, 400)
    if (!html.trim()) return json({ error: 'The message is empty.' }, 400)
    if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY is not set in Supabase Secrets.' }, 500)

    const attachments: { filename: string; content: string }[] = Array.isArray(body.attachments)
      ? body.attachments.map((a: { filename: string; content: string }) => ({
          filename: String(a.filename),
          content: String(a.content),
        }))
      : []
    const attachmentBytes = attachments.reduce((n, a) => n + Math.floor((a.content.length * 3) / 4), 0)
    if (attachmentBytes > MAX_ATTACHMENT_BYTES) {
      return json({ error: 'Attachments are too large. Keep them under 5 MB in total.' }, 400)
    }

    // Replaces {{name}} with the person's first name ("there" if unknown).
    const personalise = (text: string, name: string | null) => text.replace(/\{\{\s*name\s*\}\}/gi, esc(firstName(name)))

    if (action === 'test') {
      if (!ownerEmail) return json({ error: 'Your account has no email address.' }, 400)
      await sendOne(
        ownerEmail,
        `[Test] ${personalise(subject, null)}`,
        emailShell(personalise(html, null), null),
        attachments,
      )
      return json({ sent: 1, failed: [], total: 1, to: ownerEmail })
    }

    // ---- action "send" ----
    const audience = String(body.audience ?? '') as Audience
    if (!AUDIENCES.includes(audience)) return json({ error: 'Pick who to send to.' }, 400)

    let recipients: Recipient[]
    let label: string
    if (audience === 'individual') {
      const typed = String(body.customEmails ?? '')
        .split(/[\n,;]+/)
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean)
      const invalid = typed.filter((e: string) => !EMAIL_RE.test(e))
      if (invalid.length > 0) return json({ error: `These are not valid email addresses: ${invalid.join(', ')}` }, 400)
      recipients = [...new Set(typed)].map((email) => ({ email: email as string, name: null, unsubscribeUrl: null }))
      label = `Individual (${recipients.length})`
    } else {
      const lists = await buildAudiences(db, onDate)
      recipients = lists[audience]
      label = String(body.audienceLabel ?? audience)
    }
    if (recipients.length === 0) return json({ error: 'There is nobody in this audience yet.' }, 400)

    // Protect the daily allowance (order emails share it).
    const { sentToday, dailyLimit } = await usageToday(db)
    const room = dailyLimit - ORDER_EMAIL_RESERVE - sentToday
    if (recipients.length > room) {
      return json(
        {
          error:
            `This would send ${recipients.length} emails, but your plan allows ${dailyLimit} a day and ` +
            `${sentToday} already went out today (plus ${ORDER_EMAIL_RESERVE} are kept free for order emails). ` +
            `You can send up to ${Math.max(room, 0)} more today. Choose a smaller audience, send the rest tomorrow, ` +
            `or upgrade your email plan and raise "email_daily_limit" in Settings.`,
        },
        400,
      )
    }

    const started = Date.now()
    let sent = 0
    const failed: string[] = []
    for (let i = 0; i < recipients.length; i += CHUNK) {
      if (Date.now() - started > RUN_BUDGET_MS) {
        failed.push(...recipients.slice(i).map((r) => `${r.email} (not sent: time limit reached)`))
        break
      }
      const chunk = recipients.slice(i, i + CHUNK)
      const results = await Promise.allSettled(
        chunk.map((r) =>
          sendOne(
            r.email,
            personalise(subject, r.name),
            emailShell(personalise(html, r.name), r.unsubscribeUrl),
            attachments,
          ),
        ),
      )
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled') sent++
        else failed.push(`${chunk[idx].email} (${errorMessage(res.reason)})`)
      })
      if (i + CHUNK < recipients.length) await new Promise((r) => setTimeout(r, GAP_MS))
    }

    await db.from('email_campaigns').insert({
      sent_by: ownerEmail || null,
      subject,
      body: html,
      audience,
      audience_label: label,
      recipient_count: recipients.length,
      sent_count: sent,
      failed_count: failed.length,
      failed_list: failed.length > 0 ? failed.slice(0, 50).join('\n') : null,
    })

    return json({ sent, failed, total: recipients.length })
  } catch (err) {
    console.error('send-broadcast failed', err)
    return json({ error: errorMessage(err) }, 500)
  }
})
