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

function itemsTable(items: { item_name: string; variation_label: string; unit_price: number; quantity: number }[]): string {
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:6px 0;">${i.item_name} (${i.variation_label}) × ${i.quantity}</td>
        <td style="padding:6px 0;text-align:right;">${formatNaira(i.unit_price * i.quantity)}</td>
      </tr>`,
    )
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

    const trackingLine = SITE_URL
      ? `<p><a href="${SITE_URL}/track?order=${order.order_number}&phone=${encodeURIComponent(order.customer_phone)}" style="color:#ff002c;">Track your order</a></p>`
      : `<p>Track your order any time using order number <strong>${order.order_number}</strong> and your phone number.</p>`

    if (event === 'new_order') {
      const customerVars = {
        customer_name: order.customer_name,
        order_number: order.order_number,
        menu_date: order.menu_date,
        total: formatNaira(order.total),
      }
      const customerTmpl = await getTemplate(
        supabase,
        'new_order_customer',
        'Order {{order_number}} received — Edelicacies',
        "Thanks, {{customer_name}}! We've received your order {{order_number}} for {{menu_date}}. Payment is confirmed on WhatsApp — we'll message you shortly to sort that out.",
      )
      await sendEmail(
        order.customer_email,
        render(customerTmpl.subject, customerVars),
        emailShell(`
          ${paragraphs(render(customerTmpl.body, customerVars))}
          ${itemsTable(items ?? [])}
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
          total: formatNaira(order.total),
          delivery_type: order.delivery_type === 'dispatch' ? 'Dispatch delivery' : 'Shop pickup',
        }
        const ownerTmpl = await getTemplate(
          supabase,
          'new_order_owner',
          'New order {{order_number}} — {{total}}',
          'New order from {{customer_name}} ({{customer_phone}}).',
        )
        await sendEmail(
          ownerEmail,
          render(ownerTmpl.subject, ownerVars),
          emailShell(`
            ${paragraphs(render(ownerTmpl.body, ownerVars))}
            ${itemsTable(items ?? [])}
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
