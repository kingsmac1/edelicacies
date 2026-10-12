// EDELICACIES — Edge Function: send-order-email
//
// Sends the "new order" emails (to the customer and the owner) and the
// "order status changed" email (to the customer). Called directly by the
// website right after an order is created or its status is changed.
//
// The subject line and message wording for each of these come from the
// `email_templates` table (editable by the owner under Dashboard → Email
// Templates) — this function fills in the {{placeholders}} and adds the
// order details/links automatically. If a template row is somehow missing,
// it falls back to sensible default wording built into this file.
//
// Paste this whole file into the Supabase dashboard's Edge Function editor
// for a function named "send-order-email".

import { createClient } from 'jsr:@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Edelicacies <onboarding@resend.dev>'
const SITE_URL = Deno.env.get('SITE_URL') ?? ''

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
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

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  preparing: 'Preparing your order',
  out_for_delivery: 'Out for delivery',
  ready_for_pickup: 'Ready for pickup',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

function formatNaira(n: number): string {
  return '₦' + Math.round(n).toLocaleString('en-NG')
}

// "Tuesday, 13 October" from a YYYY-MM-DD menu date (read at midday UTC so
// the Lagos timezone can never shift it to the neighbouring day).
function longDate(menuDate: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Lagos',
  }).format(new Date(`${menuDate}T12:00:00Z`))
}

// Today's date in Nigeria as YYYY-MM-DD.
function lagosToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date())
}

function render(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

// deno-lint-ignore no-explicit-any
async function getTemplate(supabase: any, key: string, fallbackSubject: string, fallbackBody: string) {
  const { data } = await supabase.from('email_templates').select('subject, body').eq('key', key).maybeSingle()
  return { subject: data?.subject ?? fallbackSubject, body: data?.body ?? fallbackBody }
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

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
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

function paragraphs(text: string): string {
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => `<p>${line}</p>`)
    .join('')
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY || !to) return
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text())
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const { orderId, event } = await req.json()
    if (!orderId || !event) {
      return new Response(JSON.stringify({ error: 'orderId and event are required' }), {
        status: 400,
        headers: CORS_HEADERS,
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
    if (orderError || !order) throw orderError ?? new Error('Order not found')

    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId)
    const images = await loadItemImages(supabase, items ?? [])

    const trackingLine = SITE_URL
      ? `<p><a href="${SITE_URL}/track?order=${order.order_number}&phone=${encodeURIComponent(order.customer_phone)}" style="color:#ff002c;">Track your order</a></p>`
      : `<p>Track your order any time using order number <strong>${order.order_number}</strong> and your phone number.</p>`

    if (event === 'new_order') {
      // An order for a date after today is a pre-order: different wording,
      // because the meal is cooked on that day, not straight away.
      const isPreorder = order.menu_date > lagosToday()
      const customerKey = isPreorder ? 'new_order_customer_preorder' : 'new_order_customer'
      const ownerKey = isPreorder ? 'new_order_owner_preorder' : 'new_order_owner'

      const customerVars = {
        customer_name: order.customer_name,
        order_number: order.order_number,
        menu_date: longDate(order.menu_date),
        total: formatNaira(order.total),
      }
      const customerTmpl = await getTemplate(
        supabase,
        customerKey,
        isPreorder
          ? 'Pre-order {{order_number}} received for {{menu_date}} — Edelicacies'
          : 'Order {{order_number}} received — Edelicacies',
        isPreorder
          ? "Thanks, {{customer_name}}! We've received your pre-order {{order_number}} for {{menu_date}}. Your meal will be prepared fresh on that day, and delivery starts once it is ready. We'll email you when your rider is on the way. Payment is confirmed on WhatsApp — we'll message you shortly to sort that out."
          : "Thanks, {{customer_name}}! We've received your order {{order_number}} for {{menu_date}}. Payment is confirmed on WhatsApp — we'll message you shortly to sort that out.",
      )
      await sendEmail(
        order.customer_email,
        render(customerTmpl.subject, customerVars),
        emailShell(`
          ${paragraphs(render(customerTmpl.body, customerVars))}
          ${itemsTable(items ?? [], images)}
          <p style="font-weight:600;">Total: ${formatNaira(order.total)}</p>
          ${trackingLine}
        `),
      )

      const { data: ownerEmailSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'owner_email')
        .maybeSingle()
      const ownerEmail = ownerEmailSetting?.value?.email
      if (ownerEmail) {
        const ownerVars = {
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          order_number: order.order_number,
          menu_date: longDate(order.menu_date),
          total: formatNaira(order.total),
          delivery_type: order.delivery_type === 'dispatch' ? 'Dispatch delivery' : 'Shop pickup',
        }
        const ownerTmpl = await getTemplate(
          supabase,
          ownerKey,
          isPreorder
            ? 'New PRE-ORDER {{order_number}} for {{menu_date}} — {{total}}'
            : 'New order {{order_number}} — {{total}}',
          isPreorder
            ? 'New pre-order for {{menu_date}} from {{customer_name}} ({{customer_phone}}).'
            : 'New order from {{customer_name}} ({{customer_phone}}).',
        )
        await sendEmail(
          ownerEmail,
          render(ownerTmpl.subject, ownerVars),
          emailShell(`
            ${paragraphs(render(ownerTmpl.body, ownerVars))}
            ${itemsTable(items ?? [], images)}
            <p style="font-weight:600;">Total: ${formatNaira(order.total)}</p>
            <p>${ownerVars.delivery_type}</p>
          `),
        )
      }
    } else if (event === 'stage_change') {
      const label = STATUS_LABELS[order.status] ?? order.status
      const vars = {
        customer_name: order.customer_name,
        order_number: order.order_number,
        status_label: label,
      }

      // "Out for delivery" and "Delivered" get their own dedicated,
      // owner-editable templates (with sensible fallback wording below) —
      // every other status change still uses the generic one.
      let templateKey = 'stage_change'
      let fallbackSubject = 'Order {{order_number}}: {{status_label}} — Edelicacies'
      let fallbackBody = 'Hi {{customer_name}}, your order {{order_number}} is now: {{status_label}}.'

      if (order.status === 'out_for_delivery') {
        templateKey = 'out_for_delivery'
        fallbackSubject = 'Order {{order_number}} is out for delivery — Edelicacies'
        fallbackBody =
          "Hi {{customer_name}}, your order {{order_number}} is on its way! Please stay close to your phone — our dispatch rider will call you when they're nearby."
      } else if (order.status === 'delivered') {
        templateKey = 'delivered'
        fallbackSubject = 'Order {{order_number}} delivered — thank you! — Edelicacies'
        fallbackBody =
          'Hi {{customer_name}}, your order {{order_number}} has been delivered. Thank you so much for choosing Edelicacies — we hope you enjoyed every bite!'
      }

      const tmpl = await getTemplate(supabase, templateKey, fallbackSubject, fallbackBody)
      await sendEmail(
        order.customer_email,
        render(tmpl.subject, vars),
        emailShell(`
          ${paragraphs(render(tmpl.body, vars))}
          ${itemsTable(items ?? [], images, false)}
          ${trackingLine}
        `),
      )
    }

    return new Response(JSON.stringify({ ok: true }), { headers: CORS_HEADERS })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: errorMessage(err) }), { status: 500, headers: CORS_HEADERS })
  }
})
