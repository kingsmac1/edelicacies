// EDELICACIES — Edge Function: process-orders
//
// Runs on a schedule (every 10 minutes, via the pg_cron job set up in
// schema.sql). Two jobs:
//  1. Auto-cancels orders that missed their payment window, restores their
//     slots, and emails the customer.
//  2. Sends the "please leave a review" email a few hours after an order is
//     marked Delivered (once each).
//
// Paste this whole file into the Supabase dashboard's Edge Function editor
// for a function named "process-orders". When creating it, turn OFF "Verify
// JWT" for this function (it's triggered by pg_cron with the public anon
// key, not a logged-in user) — SETUP.md walks through this.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Edelicacies <onboarding@resend.dev>'
const SITE_URL = Deno.env.get('SITE_URL') ?? ''

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function formatNaira(n: number): string {
  return '₦' + Math.round(n).toLocaleString('en-NG')
}

type EmailItem = {
  menu_item_id?: string | null
  item_name: string
  variation_label: string
  unit_price: number
  quantity: number
}

// Photos of the dishes in an order, keyed by menu item id. Items whose photo
// is missing (or whose menu item was deleted) simply show without a picture.
// deno-lint-ignore no-explicit-any
async function loadItemImages(supabase: any, items: EmailItem[]): Promise<Record<string, string>> {
  const ids = [...new Set(items.map((i) => i.menu_item_id).filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return {}
  const { data } = await supabase.from('menu_items').select('id, image_url').in('id', ids)
  const byId: Record<string, string> = {}
  for (const row of data ?? []) if (row.image_url) byId[row.id] = row.image_url
  return byId
}

// One row per item: photo, name, size x quantity, and (optionally) the price.
function itemsTable(items: EmailItem[], images: Record<string, string> = {}, showPrices = true): string {
  const rows = items
    .map((i) => {
      const src = i.menu_item_id ? images[i.menu_item_id] : undefined
      const photo = src
        ? `<img src="${src}" alt="${esc(i.item_name)}" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:10px;border:0;" />`
        : ''
      return `<tr>
        <td width="68" style="padding:8px 12px 8px 0;vertical-align:middle;">${photo}</td>
        <td style="padding:8px 0;vertical-align:middle;">
          <span style="font-weight:600;">${esc(i.item_name)}</span><br />
          <span style="color:#6b6b75;font-size:13px;">${esc(i.variation_label)} × ${i.quantity}</span>
        </td>
        ${showPrices ? `<td style="padding:8px 0;text-align:right;vertical-align:middle;">${formatNaira(i.unit_price * i.quantity)}</td>` : ''}
      </tr>`
    })
    .join('')
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;">${rows}</table>`
}

function emailShell(bodyHtml: string): string {
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
      <p style="text-align:center;color:#9a9aa2;font-size:12px;margin-top:16px;">
        Edelicacies · Uyo ·
        <a href="https://wa.me/2349021465560" style="color:#9a9aa2;">WhatsApp us</a>
      </p>
    </div>
  </body>
</html>`
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY || !to) return
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
  if (!res.ok) console.error('Resend error', res.status, await res.text())
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const results = { autoCancelled: 0, reviewRequestsSent: 0, errors: [] as string[] }

  try {
    // ---- 1. Auto-cancel expired, unpaid orders ----
    const { data: expired } = await supabase
      .from('orders')
      .select('id, order_number, customer_email, customer_name')
      .eq('status', 'awaiting_payment')
      .lt('auto_cancel_at', new Date().toISOString())

    for (const order of expired ?? []) {
      const { error } = await supabase.rpc('set_order_status', {
        p_order_id: order.id,
        p_new_status: 'cancelled',
        p_final_dispatch_fee: null,
      })
      if (error) {
        results.errors.push(`cancel ${order.order_number}: ${error.message}`)
        continue
      }
      results.autoCancelled++
      const vars = { customer_name: order.customer_name, order_number: order.order_number }
      const { data: cancelledItems } = await supabase.from('order_items').select('*').eq('order_id', order.id)
      const cancelledImages = await loadItemImages(supabase, cancelledItems ?? [])
      const tmpl = await getTemplate(
        supabase,
        'auto_cancel',
        'Order {{order_number}} was cancelled — Edelicacies',
        "Hi {{customer_name}}, order {{order_number}} wasn't confirmed as paid in time, so it's been automatically cancelled and any held items released. Still want it? Feel free to place a new order.",
      )
      await sendEmail(
        order.customer_email,
        render(tmpl.subject, vars),
        emailShell(`
          ${paragraphs(render(tmpl.body, vars))}
          ${itemsTable(cancelledItems ?? [], cancelledImages, false)}
          ${SITE_URL ? `<p><a href="${SITE_URL}" style="color:#ff002c;">Order again</a></p>` : ''}
        `),
      )
    }

    // ---- 2. Review-request emails, N hours after delivery ----
    const { data: delaySetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'review_delay_hours')
      .maybeSingle()
    const delayHours = delaySetting?.value?.hours ?? 3
    const cutoff = new Date(Date.now() - delayHours * 60 * 60 * 1000).toISOString()

    const { data: dueForReview } = await supabase
      .from('orders')
      .select('id, order_number, customer_email, customer_name, customer_phone')
      .eq('status', 'delivered')
      .is('review_requested_at', null)
      .lt('delivered_at', cutoff)

    for (const order of dueForReview ?? []) {
      const reviewLink = SITE_URL
        ? `${SITE_URL}/review?order=${order.order_number}&phone=${encodeURIComponent(order.customer_phone)}`
        : null
      const vars = { customer_name: order.customer_name, order_number: order.order_number }
      const { data: reviewItems } = await supabase.from('order_items').select('*').eq('order_id', order.id)
      const reviewImages = await loadItemImages(supabase, reviewItems ?? [])
      const tmpl = await getTemplate(
        supabase,
        'review_request',
        'How was your order? — Edelicacies',
        "Hi {{customer_name}}, we'd love to hear what you thought of order {{order_number}}.",
      )
      await sendEmail(
        order.customer_email,
        render(tmpl.subject, vars),
        emailShell(`
          ${paragraphs(render(tmpl.body, vars))}
          ${itemsTable(reviewItems ?? [], reviewImages, false)}
          ${
            reviewLink
              ? `<p><a href="${reviewLink}" style="color:#ff002c;">Leave a quick review</a></p>`
              : `<p>Reply with your order number (${order.order_number}) and a rating from 1–5 stars.</p>`
          }
        `),
      )
      await supabase.from('orders').update({ review_requested_at: new Date().toISOString() }).eq('id', order.id)
      results.reviewRequestsSent++
    }

    return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: errorMessage(err), ...results }), { status: 500 })
  }
})
