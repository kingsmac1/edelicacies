// EDELICACIES — Edge Function: whatsapp
//
// The WhatsApp "door". It does NOT think. It only carries messages:
//
//   Meta  ──(webhook)──▶  this function  ──▶  "chat" function (the brain)
//   Meta  ◀──(Cloud API)── this function  ◀──  the brain's reply
//
// It also:
//   - records messages the owner types in the WhatsApp Business app (Meta
//     calls these "echoes"), switching that chat to Owner mode so the
//     assistant stays quiet;
//   - sends the owner's replies typed in the dashboard inbox;
//   - sends "order approved / on its way / delivered" updates;
//   - pings the owner's phone when a chat is handed off.
//
// Until the secrets below exist, every call here quietly does nothing, so the
// rest of the site works exactly as before.
//
// Paste this whole file into the Supabase dashboard's Edge Function editor for
// a function named "whatsapp". IMPORTANT: switch "Verify JWT" OFF for this one
// function (Meta cannot send a Supabase login token). The function protects
// itself: Meta calls must carry a valid signature, and every other call must
// be the service key or a logged-in owner.
//
// Secrets (Project Settings → Edge Functions → Secrets):
//   WHATSAPP_ACCESS_TOKEN     permanent token from the Meta developer app
//   WHATSAPP_VERIFY_TOKEN     any long random text you invent; paste the same
//                             text into Meta's webhook setup
//   WHATSAPP_APP_SECRET       the app secret (Meta app → Settings → Basic)
// Entered in Dashboard → WhatsApp (table whatsapp_config, owner only):
//   the number's ID, your personal alert number, the two template names and
//   the template language. (The same names can still be set as Secrets:
//   WHATSAPP_PHONE_NUMBER_ID, OWNER_ALERT_WHATSAPP, WA_TEMPLATE_ORDER_CONFIRMED,
//   WA_TEMPLATE_OWNER_ALERT, WA_TEMPLATE_LANG; the dashboard value wins.)
// Optional secrets: WA_GRAPH_VERSION (default v25.0), SITE_URL.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Settings come from two places:
//   - Supabase Secrets: the sensitive keys (access token, app secret, verify token)
//   - the `whatsapp_config` table, edited by the owner in Dashboard → WhatsApp:
//     the number's ID, the owner's alert number and the template names.
// A value typed in the dashboard wins; an old Secret of the same name is the
// fallback. Read on each call so a change is picked up straight away.
async function cfg() {
  const { data } = await admin
    .from('whatsapp_config')
    .select(
      'phone_number_id, owner_alert_number, template_order_confirmed, template_owner_alert, template_language, assistant_enabled',
    )
    .eq('id', true)
    .maybeSingle()
  const pick = (fromDb: unknown, envName: string, fallback = '') =>
    (typeof fromDb === 'string' && fromDb.trim() ? fromDb.trim() : (Deno.env.get(envName) ?? '').trim()) || fallback
  return {
    token: Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '',
    verifyToken: Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '',
    appSecret: Deno.env.get('WHATSAPP_APP_SECRET') ?? '',
    phoneId: pick(data?.phone_number_id, 'WHATSAPP_PHONE_NUMBER_ID').replace(/\D/g, ''),
    ownerAlert: pick(data?.owner_alert_number, 'OWNER_ALERT_WHATSAPP').replace(/\D/g, ''),
    tplOrder: pick(data?.template_order_confirmed, 'WA_TEMPLATE_ORDER_CONFIRMED', 'order_confirmed'),
    tplAlert: pick(data?.template_owner_alert, 'WA_TEMPLATE_OWNER_ALERT', 'owner_chat_alert'),
    lang: pick(data?.template_language, 'WA_TEMPLATE_LANG', 'en'),
    // Switch on Dashboard → WhatsApp. Off = messages reach the owner, not the assistant.
    assistantEnabled: data?.assistant_enabled !== false,
    version: Deno.env.get('WA_GRAPH_VERSION') ?? 'v25.0',
    siteUrl: (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, ''),
  }
}

const WINDOW_HOURS = 24 // free-form messages only work this long after the customer's last message
const MAX_BODY_CHARS = 4000

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '')

// "08012345678" -> "2348012345678"
function toWaId(phone: string): string {
  const d = digits(phone)
  if (d.startsWith('234')) return d
  if (d.startsWith('0')) return '234' + d.slice(1)
  return d
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const naira = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG')

// ---------------------------------------------------------------------------
// Talking to Meta
// ---------------------------------------------------------------------------

type SendResult = { ok: true; wamid: string | null } | { ok: false; error: string; code?: number }

async function graphSend(payload: Record<string, unknown>): Promise<SendResult> {
  const c = await cfg()
  if (!c.token || !c.phoneId) return { ok: false, error: 'not_configured' }
  try {
    const res = await fetch(`https://graph.facebook.com/${c.version}/${c.phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...payload }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const msg = data?.error?.message ?? `HTTP ${res.status}`
      console.error('WhatsApp send failed', res.status, JSON.stringify(data?.error ?? data))
      return { ok: false, error: String(msg), code: data?.error?.code }
    }
    return { ok: true, wamid: data?.messages?.[0]?.id ?? null }
  } catch (err) {
    console.error('WhatsApp send crashed', err)
    return { ok: false, error: 'network_error' }
  }
}

const sendText = (to: string, body: string) =>
  graphSend({ to, type: 'text', text: { body: body.slice(0, MAX_BODY_CHARS), preview_url: true } })

// Template parameters may not contain newlines or tabs.
const tplParam = (t: string) => t.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, 900) || '-'

async function sendTemplate(to: string, name: string, params: string[]): Promise<SendResult> {
  const { lang } = await cfg()
  return graphSend({
    to,
    type: 'template',
    template: {
      name,
      language: { code: lang },
      components: [{ type: 'body', parameters: params.map((t) => ({ type: 'text', text: tplParam(t) })) }],
    },
  })
}

// Shows the customer two blue ticks. Nice to have, never important.
async function markRead(wamid: string): Promise<void> {
  await graphSend({ status: 'read', message_id: wamid }).catch(() => undefined)
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

type Conv = { id: string; mode: 'ai' | 'owner'; channel: string; wa_phone: string | null }

async function lastCustomerMessageAt(conversationId: string): Promise<Date | null> {
  const { data } = await admin
    .from('chat_messages')
    .select('created_at')
    .eq('conversation_id', conversationId)
    .eq('role', 'user')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.created_at ? new Date(data.created_at) : null
}

async function insideWindow(conversationId: string): Promise<boolean> {
  const last = await lastCustomerMessageAt(conversationId)
  return !!last && Date.now() - last.getTime() < WINDOW_HOURS * 60 * 60 * 1000
}

// Saves something the owner said (from the phone app or the dashboard) and
// puts the chat in Owner mode, exactly like the dashboard's own reply button.
async function recordOwnerMessage(conv: Conv, content: string, wamid: string | null): Promise<void> {
  if (conv.mode !== 'owner') {
    await admin
      .from('chat_messages')
      .insert({ conversation_id: conv.id, role: 'system', content: 'A member of our team has joined the chat.' })
  }
  const { error } = await admin.from('chat_messages').insert({
    conversation_id: conv.id,
    role: 'owner',
    content,
    ...(wamid ? { wa_message_id: wamid } : {}),
  })
  if (error) {
    // Same message id twice = we already have it.
    if ((error as { code?: string }).code === '23505') return
    throw error
  }
  const now = new Date().toISOString()
  await admin
    .from('conversations')
    .update({
      mode: 'owner',
      handoff_at: now,
      last_message_at: now,
      updated_at: now,
      last_preview: content.slice(0, 140),
      last_role: 'owner',
      last_owner_message_at: now,
      owner_unread: false,
    })
    .eq('id', conv.id)
}

// ---------------------------------------------------------------------------
// Messages coming IN from Meta
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
type WaMessage = any

// Turns one incoming WhatsApp message into text for the assistant.
// `kind` is "text" for anything the assistant can read; photos, voice notes
// and documents are marked so the chat function hands them to a person.
function describeMessage(m: WaMessage): { text: string; kind: string } | null {
  switch (m.type) {
    case 'text':
      return { text: String(m.text?.body ?? ''), kind: 'text' }
    case 'button':
      return { text: String(m.button?.text ?? m.button?.payload ?? ''), kind: 'text' }
    case 'interactive': {
      const r = m.interactive?.button_reply ?? m.interactive?.list_reply
      return { text: String(r?.title ?? ''), kind: 'text' }
    }
    case 'location': {
      const { latitude, longitude, name, address } = m.location ?? {}
      if (latitude == null || longitude == null) return null
      const label = [name, address].filter(Boolean).join(', ')
      return { text: `My location${label ? ` (${label})` : ''}: https://maps.google.com/?q=${latitude},${longitude}`, kind: 'text' }
    }
    case 'image':
      return { text: `[Photo]${m.image?.caption ? ' ' + m.image.caption : ''}`, kind: 'photo' }
    case 'audio':
      return { text: '[Voice note]', kind: 'audio' }
    case 'video':
      return { text: `[Video]${m.video?.caption ? ' ' + m.video.caption : ''}`, kind: 'video' }
    case 'document':
      return { text: `[Document]${m.document?.caption ? ' ' + m.document.caption : ''}`, kind: 'document' }
    default:
      // reactions, stickers, system notices: nothing to answer
      return null
  }
}

async function handleIncomingMessage(m: WaMessage, contacts: WaMessage[]): Promise<void> {
  const phone = digits(m.from)
  if (!phone) return
  const described = describeMessage(m)
  if (!described || !described.text.trim()) return
  const name = contacts.find((c) => digits(c.wa_id) === phone)?.profile?.name ?? null

  const settings = await cfg()
  // Paused: still tell the customer it was read, but leave the answer to people.
  await markRead(String(m.id))

  const res = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'channel_message',
      channel: 'whatsapp',
      phone,
      name,
      text: described.text,
      wamid: String(m.id),
      kind: described.kind,
      paused: !settings.assistantEnabled,
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) {
    console.error('chat function refused a WhatsApp message', res.status, JSON.stringify(data))
    return
  }
  if (data.duplicate) return // Meta delivered this one twice
  if (typeof data.reply !== 'string' || !data.reply.trim()) return // owner mode: stay silent

  const sent = await sendText(phone, data.reply)
  if (!sent.ok) {
    console.error('could not deliver the assistant reply', sent.error)
    return
  }
  // Remember Meta's id for our own reply so an echo of it can never be
  // mistaken for the owner typing.
  if (sent.wamid && data.replyMessageId) {
    await admin.from('chat_messages').update({ wa_message_id: sent.wamid }).eq('id', data.replyMessageId)
  }
}

// The owner typed in the WhatsApp Business app: record it and pause the AI.
async function handleOwnerEcho(echo: WaMessage): Promise<void> {
  const customer = digits(echo.to)
  const wamid = echo.id ? String(echo.id) : null
  if (!customer) return
  const described = describeMessage(echo)
  const content = described?.text?.trim() || `[${echo.type ?? 'message'}]`

  if (wamid) {
    const { data: seen } = await admin.from('chat_messages').select('id').eq('wa_message_id', wamid).maybeSingle()
    if (seen) return // we sent this one ourselves, or already recorded it
  }

  let { data: conv } = await admin
    .from('conversations')
    .select('id, mode, channel, wa_phone')
    .eq('channel', 'whatsapp')
    .eq('wa_phone', customer)
    .maybeSingle()
  if (!conv) {
    const { data: created, error } = await admin
      .from('conversations')
      .insert({
        channel: 'whatsapp',
        wa_phone: customer,
        customer_contact: `+${customer}`,
        mode: 'owner',
        handoff_at: new Date().toISOString(),
      })
      .select('id, mode, channel, wa_phone')
      .single()
    if (error) throw error
    conv = created
  }
  await recordOwnerMessage(conv as Conv, content, wamid)
}

async function processWebhook(payload: WaMessage): Promise<void> {
  if (payload?.object !== 'whatsapp_business_account') return
  await admin
    .from('settings')
    .upsert({ key: 'whatsapp_last_webhook', value: { at: new Date().toISOString() } }, { onConflict: 'key' })
    .then(() => undefined, () => undefined)

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {}
      try {
        if (change.field === 'messages') {
          for (const m of value.messages ?? []) {
            await handleIncomingMessage(m, value.contacts ?? []).catch((err) =>
              console.error('incoming WhatsApp message failed', err),
            )
          }
        } else if (change.field === 'smb_message_echoes') {
          for (const echo of value.message_echoes ?? []) {
            await handleOwnerEcho(echo).catch((err) => console.error('owner echo failed', err))
          }
        }
        // statuses, history, smb_app_state_sync: nothing to do yet.
      } catch (err) {
        console.error('webhook change failed', err)
      }
    }
  }
}

async function validSignature(raw: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return timingSafeEqual(`sha256=${hex}`, header.trim().toLowerCase())
}

// ---------------------------------------------------------------------------
// Things OUR OWN code asks this function to send
// ---------------------------------------------------------------------------

const STAGE_TEXT: Record<string, (name: string, n: string) => string> = {
  paid: (name, n) => `Hi ${name}, we have received your payment for order ${n}. Thank you!`,
  preparing: (name, n) => `Hi ${name}, your order ${n} is now being prepared.`,
  out_for_delivery: (name, n) =>
    `Hi ${name}, your order ${n} is on its way! Our dispatch rider will call you when they are nearby.`,
  ready_for_pickup: (name, n) => `Hi ${name}, your order ${n} is ready for pickup.`,
  delivered: (name, n) =>
    `Hi ${name}, your order ${n} has been delivered. Thank you for choosing Edelicacies, we hope you enjoy it!`,
  cancelled: (name, n) =>
    `Hi ${name}, we are sorry, we could not go ahead with order ${n}. If you have any questions, just reply here and our team will help.`,
}

// Order approved / status changed. Only for orders that began in a WhatsApp chat.
async function orderUpdate(orderId: string, event: string): Promise<Record<string, unknown>> {
  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, customer_name, customer_phone, total, status, conversation_id')
    .eq('id', orderId)
    .maybeSingle()
  if (!order?.conversation_id) return { skipped: 'not_a_whatsapp_order' }

  const { data: conv } = await admin
    .from('conversations')
    .select('id, mode, channel, wa_phone')
    .eq('id', order.conversation_id)
    .maybeSingle()
  if (!conv || conv.channel !== 'whatsapp' || !conv.wa_phone) return { skipped: 'not_a_whatsapp_order' }

  const name = String(order.customer_name ?? '').split(' ')[0] || 'there'
  const number = String(order.order_number)
  const c = await cfg()
  const trackLine = c.siteUrl
    ? `\n\nTrack your order: ${c.siteUrl}/track?order=${encodeURIComponent(number)}&phone=${encodeURIComponent(String(order.customer_phone))}`
    : ''

  let text: string | null = null
  let templateName: string | null = null
  let templateParams: string[] = []

  if (event === 'order_approved') {
    text =
      `Good news, ${name}! Your order ${number} has been approved. Total: ${naira(Number(order.total))}. ` +
      `Our team will send your payment details here shortly. Your items are held for you until payment is confirmed.` +
      trackLine
    templateName = c.tplOrder
    templateParams = [name, number, naira(Number(order.total))]
  } else if (event === 'stage_change') {
    const make = STAGE_TEXT[String(order.status)]
    if (!make) return { skipped: 'no_message_for_status' }
    text = make(name, number) + trackLine
  } else {
    return { skipped: 'event_not_sent_on_whatsapp' }
  }

  // Each update is sent once. (send-order-email can be triggered from the
  // website, so this also stops anyone replaying it to spam a customer.)
  const stage = event === 'order_approved' ? 'approved' : String(order.status)
  const { data: already } = await admin
    .from('chat_messages')
    .select('id')
    .eq('conversation_id', conv.id)
    .contains('meta', { orderNumber: number, orderStage: stage })
    .limit(1)
  if (already && already.length > 0) return { skipped: 'already_sent' }

  const to = conv.wa_phone
  let sent: SendResult
  if (await insideWindow(conv.id)) {
    sent = await sendText(to, text)
  } else if (templateName) {
    // The 24-hour window is closed: only an approved template can get through.
    sent = await sendTemplate(to, templateName, templateParams)
    text =
      `Hi ${name}, good news! Your Edelicacies order ${number} has been approved. Total: ${naira(Number(order.total))}. ` +
      `Our team will send your payment details here shortly.`
  } else {
    return { skipped: 'outside_24h_window' }
  }
  if (!sent.ok) return { sent: false, error: sent.error }

  // Keep the dashboard thread complete.
  const now = new Date().toISOString()
  await admin.from('chat_messages').insert({
    conversation_id: conv.id,
    role: 'assistant',
    content: text,
    meta: { orderNumber: number, orderStage: stage },
    ...(sent.wamid ? { wa_message_id: sent.wamid } : {}),
  })
  await admin
    .from('conversations')
    .update({ last_message_at: now, updated_at: now, last_preview: text.slice(0, 140), last_role: 'assistant' })
    .eq('id', conv.id)
  return { sent: true }
}

// Ping the owner's personal WhatsApp. The owner has not messaged the business
// number, so a template is the only thing that can start the conversation.
async function notifyOwner(reason: string, customerSaid: string): Promise<Record<string, unknown>> {
  const c = await cfg()
  if (!c.ownerAlert) return { skipped: 'no_owner_number' }
  const sent = await sendTemplate(c.ownerAlert, c.tplAlert, [reason, customerSaid])
  if (sent.ok) return { sent: true }
  // Template not approved yet? A plain message works if the owner messaged us in the last 24h.
  const fallback = await sendText(
    c.ownerAlert,
    `Edelicacies alert: ${reason}. Customer said: "${customerSaid}". Open your dashboard inbox to reply.`,
  )
  return fallback.ok ? { sent: true, via: 'text' } : { sent: false, error: sent.error }
}

// The owner typed a reply in the dashboard inbox, for a WhatsApp chat.
async function ownerReply(conversationId: string, content: string): Promise<Response> {
  const text = content.trim()
  if (!text) return json({ error: 'EMPTY_MESSAGE' }, 400)
  if (text.length > 2000) return json({ error: 'MESSAGE_TOO_LONG' }, 400)

  const { data: conv } = await admin
    .from('conversations')
    .select('id, mode, channel, wa_phone')
    .eq('id', conversationId)
    .maybeSingle()
  if (!conv) return json({ error: 'CONVERSATION_NOT_FOUND' }, 404)
  if (conv.channel !== 'whatsapp' || !conv.wa_phone) return json({ error: 'NOT_A_WHATSAPP_CHAT' }, 400)

  if (!(await insideWindow(conv.id))) {
    return json(
      {
        error: 'OUTSIDE_WINDOW',
        message:
          'More than 24 hours have passed since this customer last wrote, so WhatsApp will not deliver a free-form reply from here. Wait for them to write again, or message them from your WhatsApp Business app.',
      },
      409,
    )
  }
  const sent = await sendText(conv.wa_phone, text)
  if (!sent.ok) {
    return json(
      {
        error: sent.error === 'not_configured' ? 'NOT_CONFIGURED' : 'SEND_FAILED',
        message:
          sent.error === 'not_configured' ? 'WhatsApp is not connected yet.' : `WhatsApp refused the message: ${sent.error}`,
      },
      502,
    )
  }
  await recordOwnerMessage(conv as Conv, text, sent.wamid)
  return json({ ok: true })
}

// ---------------------------------------------------------------------------
// The front door
// ---------------------------------------------------------------------------

async function isOwnerCaller(authHeader: string): Promise<boolean> {
  if (!authHeader) return false
  const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } })
  const { data: userData } = await caller.auth.getUser()
  if (!userData?.user) return false
  const { data } = await caller.rpc('is_owner')
  return data === true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  const c = await cfg()

  // Meta checks the webhook address once, when you save it in the Meta app.
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const ok =
      c.verifyToken !== '' &&
      url.searchParams.get('hub.mode') === 'subscribe' &&
      timingSafeEqual(url.searchParams.get('hub.verify_token') ?? '', c.verifyToken)
    return ok ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('Forbidden', { status: 403 })
  }
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const raw = await req.text()

  // ---- Meta calling us (signed) ----
  const signature = req.headers.get('x-hub-signature-256')
  if (signature) {
    if (!(await validSignature(raw, signature, c.appSecret))) return new Response('Bad signature', { status: 403 })
    let payload: unknown
    try {
      payload = JSON.parse(raw)
    } catch {
      return new Response('Bad JSON', { status: 400 })
    }
    // Answer Meta straight away and keep working in the background; if Meta
    // waits too long it retries and the customer would be answered twice.
    const work = processWebhook(payload).catch((err) => console.error('webhook processing failed', err))
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime
    if (runtime?.waitUntil) runtime.waitUntil(work)
    else await work
    return new Response('ok', { status: 200 })
  }

  // ---- Our own code or the logged-in owner ----
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw || '{}')
  } catch {
    return json({ error: 'Invalid request.' }, 400)
  }
  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.replace(/^Bearer\s+/i, '')
  const isService = bearer !== '' && timingSafeEqual(bearer, SERVICE_ROLE_KEY)

  try {
    if (isService && body.action === 'notify_owner') {
      return json(await notifyOwner(String(body.reason ?? 'A chat needs you').slice(0, 200), String(body.customerSaid ?? '').slice(0, 200)))
    }
    if (isService && body.action === 'order_update') {
      return json(await orderUpdate(String(body.orderId ?? ''), String(body.event ?? '')))
    }

    if (body.action === 'owner_reply' || body.action === 'status') {
      if (!(await isOwnerCaller(authHeader))) return json({ error: 'Owner login required' }, 401)
      if (body.action === 'owner_reply') {
        return await ownerReply(String(body.conversationId ?? ''), String(body.content ?? ''))
      }
      const { data: last } = await admin.from('settings').select('value').eq('key', 'whatsapp_last_webhook').maybeSingle()
      return json({
        secrets: {
          WHATSAPP_ACCESS_TOKEN: !!c.token,
          WHATSAPP_VERIFY_TOKEN: !!c.verifyToken,
          WHATSAPP_APP_SECRET: !!c.appSecret,
        },
        configured: { phoneNumberId: !!c.phoneId, ownerAlert: !!c.ownerAlert },
        assistantEnabled: c.assistantEnabled,
        webhookUrl: `${SUPABASE_URL}/functions/v1/whatsapp`,
        lastWebhookAt: last?.value?.at ?? null,
      })
    }
    return json({ error: 'Unknown request.' }, 400)
  } catch (err) {
    console.error('whatsapp function failed', err)
    return json({ error: 'Something went wrong.' }, 500)
  }
})
