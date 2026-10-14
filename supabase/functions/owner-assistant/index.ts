// EDELICACIES — Edge Function: owner-assistant
//
// The OWNER's assistant (Phase 7). Different from the customer assistant:
// it can read the business numbers, and (in later steps) change things.
//
// Who may talk to it is decided HERE, in code, before any AI is called:
//   - the logged-in owner in the dashboard (their login token), or
//   - our own "whatsapp" function (service key) after IT has checked that
//     the sender's number is an ACTIVE number in Owner numbers.
// The AI is never asked "is this the owner?".
//
// The AI never calculates. It asks the database (owner_report / owner_orders)
// and reads the answer back. After it replies, this code CHECKS that every
// money figure it wrote really appears in what the database returned. If not,
// the AI's wording is thrown away and the exact figures are shown instead.
//
// The AI never CHANGES anything either. It can only PROPOSE an action (mark
// sold out, approve or reject an order). The proposal is stored in the
// database, shown to the owner in words written by code, and only the owner's
// next message "YES", recognised by this code and never by the AI, runs it.
// Every action is written to the admin log with before and after values.
//
// Paste this whole file into the Supabase dashboard's Edge Function editor for
// a function named "owner-assistant". Leave "Verify JWT" ON.
// Needs the secret OPENROUTER_API_KEY (already saved for the chat function).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const MODELS = [
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'google/gemma-4-26b-a4b-it:free',
]
const TEMPERATURE = 0.1
const MAX_HISTORY = 12
const MAX_CHARS = 1000

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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ---------------------------------------------------------------------------
// Who is asking? (code decides, never the AI)
// ---------------------------------------------------------------------------

// Returns a label for the log ("dashboard: you@mail.com") when the caller is
// the logged-in owner, otherwise null.
async function ownerActor(authHeader: string): Promise<string | null> {
  if (!authHeader) return null
  const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } })
  const { data: userData } = await caller.auth.getUser()
  if (!userData?.user) return null
  const { data } = await caller.rpc('is_owner')
  if (data !== true) return null
  return `dashboard: ${userData.user.email ?? 'owner'}`
}

// ---------------------------------------------------------------------------
// The assistant's rules and tools
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `
WHO YOU ARE
You are the private business assistant for the owner of Edelicacies, an online food store in Uyo, Nigeria. You are talking to the owner, not a customer.

HOW YOU SPEAK
- Short, clear and friendly. Lead with the answer.
- Money in naira with thousands separators, like ₦13,000.
- A short list is fine for several orders or items. Plain text only, no markdown tables.
- Write order statuses in plain words: "waiting for approval", "awaiting payment", "out for delivery", never the raw codes with underscores.

THE ONE RULE ABOUT NUMBERS
- You NEVER add up, estimate or guess any number. Every count, total or name you state must come from a tool result in this conversation.
- If a question needs numbers, call the tool first. If no tool can answer it, say so plainly.
- Say which period the numbers cover (for example "today" or "the last 7 days").

WHAT THE NUMBERS MEAN (the same rules as the Finances page)
- "Sold" or "sales" = orders that are paid or further along, plus manual/offline sales. Orders waiting for approval or for payment are NOT sales yet: mention them separately when useful.
- A day means the day the meal is for (the menu date).
- Cancelled orders are never counted as sales.

OPINIONS AND ADVICE
- If asked for your view (for example "are we doing well?"), first call get_report, then give a short, careful opinion that rests ONLY on those figures. Say it is a quick read of the numbers, not a forecast.
- You do not know industry benchmarks, targets or future sales. Never invent them, and never predict future numbers.

WHAT YOU CAN DO RIGHT NOW
- Answer questions about orders, sales and best sellers (today, yesterday, the last 7 days, this month).
- Show what is on the menu for today or tomorrow, with sizes, prices and portions left, and which of your menu items are not on it (get_menu).
- Show customer chats (get_chats): the ones that need the owner (handed off or unread), or the most recent ones.
- Take over a customer's chat so the assistant stops replying to them, or hand it back (propose_take_over_chat, propose_hand_back_chat). The owner says the customer's name or phone number, or "the latest chat".
- List orders, optionally only those with a given status.
- PROPOSE these changes with the propose_ tools: mark an item sold out, make an item available again, set exactly how many portions of an item are left (propose_set_portions), approve an order waiting for approval, reject an order waiting for approval. Items can be for today or tomorrow.
- Put one of the owner's existing menu items onto today's or tomorrow's menu with a number of portions (propose_add_to_menu). Take an item off the menu (propose_remove_from_menu, always needs the PIN).
- You cannot create a brand-new dish. If it is not among the menu items, say it must be added under Menu Items in the dashboard first.
- Change one price (propose_change_price) or adjust many prices by a percentage (propose_adjust_prices, optionally only food or drink, or only names containing a word).
- Add a phone order for a customer (propose_add_phone_order): you need their name, phone number, the items with quantities (and the size when an item has several), whether it is delivery (with address, and the delivery fee if the owner gives one) or pickup, and whether it is already paid (and how). Ask for everything that is missing in ONE short message.
- Undo the last price or portions change (propose_undo_last_change).
- To cancel a phone order the owner added by mistake, use propose_reject_order with its order number.

PHONE ORDERS
- Use the exact item names from the menu. Do not invent prices or fees: the system uses the menu prices.
- "Paid" is only true if the owner says it is paid. If they do not say, treat it as not yet paid.
- After the order is confirmed, the order number is shown by the system. Never make up an order number.

PINS
- Some changes (many prices at once, or a price that jumps by more than 25%) need the owner's PIN. The system asks for it by itself.
- Never ask for, repeat or guess a PIN. Never mention what the PIN is.

HOW CHANGES WORK (important)
- You never make a change yourself. A propose_ tool only PREPARES it. The system then asks the owner to reply YES, and only that YES runs it.
- Never say a change is done, saved or approved. Never ask the owner to repeat the details.
- When the owner names SEVERAL items (for example "add afang soup and all the rice dishes, 10 portions each"), put ALL of them in the items list of ONE propose_ call, so they confirm once. Never make several separate propose_ calls for one request.
- For chats, pass the customer exactly as the owner said it (a name, a phone number, or "latest"). If several customers match, ask which one by listing them. Taking over a chat only stops the assistant replying; the owner then writes to the customer from the Inbox or the WhatsApp Business app.
- If the owner asks what is on the menu, or you are not sure of an exact dish name, call get_menu first, then use the exact names.
- If a propose_ tool says several items matched, ask which one the owner means (list the options). If it says nothing was found or nothing needs changing, tell the owner that plainly.
- Use the order number exactly as the owner or the order list gives it.
- When the owner says "it" or "that one", use the dish from the conversation. Pass only the dish NAME as item (for example "Chicken Curry Sauce with Steamed Rice"), and put the size in variation.
- If the owner does not say which day, it means TODAY. Do not ask which day; just prepare the change for today.
- Act on the request in one step: call the propose_ tool straight away. Do not ask for details you can already find in the request.
`.trim()

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_report',
      description:
        'Exact numbers for a period: order counts (pending approval, approved, delivered, cancelled), sales totals in naira (including money still waiting for payment or approval), and the best-selling items.',
      parameters: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['today', 'yesterday', 'week', 'month'], description: 'week = last 7 days, month = this calendar month so far' },
        },
        required: ['range'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_orders',
      description: 'List the orders for a period (newest first, at most 25), optionally only one status.',
      parameters: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['today', 'yesterday', 'week', 'month'] },
          status: {
            type: 'string',
            enum: ['pending_approval', 'awaiting_payment', 'paid', 'preparing', 'out_for_delivery', 'ready_for_pickup', 'delivered', 'cancelled'],
            description: 'Only orders with this status. Leave out for all.',
          },
        },
        required: ['range'],
      },
    },
  },
]

TOOLS.push({
  type: 'function',
  function: {
    name: 'get_chats',
    description:
      'The customer chats that need the owner (handed off to the owner, or with unread messages), or the most recent chats. Shows each customer, the channel (website or whatsapp), who is replying (owner or assistant) and the last message.',
    parameters: {
      type: 'object',
      properties: { filter: { type: 'string', enum: ['needs_you', 'all'] } },
    },
  },
})

TOOLS.push({
  type: 'function',
  function: {
    name: 'get_menu',
    description:
      "The menu for today or tomorrow: each item and size with its price and portions left, plus the owner's active menu items that are NOT on that day's menu.",
    parameters: {
      type: 'object',
      properties: { day: { type: 'string', enum: ['today', 'tomorrow'] } },
      required: ['day'],
    },
  },
})

const PROPOSE_TOOLS: unknown[] = [
  {
    type: 'function',
    function: {
      name: 'propose_mark_sold_out',
      description: 'Prepare marking one OR SEVERAL menu items sold out for a day (sets remaining portions to 0). Needs the owner to reply YES.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'SEVERAL items in one request. Use this whenever the owner names more than one item, so they confirm once.',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string', description: 'The dish or drink NAME only' },
                variation: { type: 'string', description: 'Size, only if given' },
                portions: { type: 'integer', description: 'Portions for this item (if different from the default)' },
              },
              required: ['item'],
            },
          },
          item: { type: 'string', description: 'The dish or drink NAME only, without the size or brackets' },
          variation: { type: 'string', description: 'Size or option, only if the owner named one' },
          day: { type: 'string', enum: ['today', 'tomorrow'] },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_mark_available',
      description: 'Prepare making one OR SEVERAL sold-out menu items available again for a day. Needs the owner to reply YES.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'SEVERAL items in one request. Use this whenever the owner names more than one item, so they confirm once.',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string', description: 'The dish or drink NAME only' },
                variation: { type: 'string', description: 'Size, only if given' },
                portions: { type: 'integer', description: 'Portions for this item (if different from the default)' },
              },
              required: ['item'],
            },
          },
          item: { type: 'string' },
          variation: { type: 'string' },
          day: { type: 'string', enum: ['today', 'tomorrow'] },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_approve_order',
      description: 'Prepare approving an order that is waiting for approval. Needs the owner to reply YES.',
      parameters: {
        type: 'object',
        properties: { order_number: { type: 'string', description: 'For example ED-0014' } },
        required: ['order_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_reject_order',
      description: 'Prepare rejecting (cancelling) an order that is waiting for approval. Needs the owner to reply YES.',
      parameters: {
        type: 'object',
        properties: { order_number: { type: 'string' } },
        required: ['order_number'],
      },
    },
  },
]
PROPOSE_TOOLS.push({
  type: 'function',
  function: {
    name: 'propose_set_portions',
    description:
      'Prepare setting how many portions of one OR SEVERAL menu items are left for a day, for example "set the jollof rice to 5 portions". Needs the owner to reply YES.',
    parameters: {
      type: 'object',
      properties: {
          items: {
            type: 'array',
            description: 'SEVERAL items in one request. Use this whenever the owner names more than one item, so they confirm once.',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string', description: 'The dish or drink NAME only' },
                variation: { type: 'string', description: 'Size, only if given' },
                portions: { type: 'integer', description: 'Portions for this item (if different from the default)' },
              },
              required: ['item'],
            },
          },
        item: { type: 'string', description: 'The dish or drink NAME only, without the size or brackets' },
        variation: { type: 'string', description: 'Size or option, only if the owner named one' },
        portions: { type: 'integer', description: 'How many portions should be left (0 to 500)' },
        day: { type: 'string', enum: ['today', 'tomorrow'] },
      },
      required: ['portions'],
    },
  },
} as never)
PROPOSE_TOOLS.push(
  {
    type: 'function',
    function: {
      name: 'propose_change_price',
      description:
        'Prepare changing the price of ONE menu item (one size). Needs the owner to reply YES, or enter the PIN if the change is large.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'The dish or drink NAME only, without the size or brackets' },
          variation: { type: 'string', description: 'Size or option. Needed when the item has several sizes' },
          new_price: { type: 'integer', description: 'The new price in whole naira' },
        },
        required: ['item', 'new_price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_adjust_prices',
      description:
        'Prepare raising or lowering MANY prices by a percentage (for example 10 for +10%, -5 for -5%). Always needs the owner\'s PIN.',
      parameters: {
        type: 'object',
        properties: {
          percent: { type: 'number', description: 'Percentage change, between -50 and 100' },
          category: { type: 'string', enum: ['food', 'drink'], description: 'Only this category. Leave out for everything.' },
          name_contains: { type: 'string', description: 'Only items whose name contains this word, for example "rice"' },
        },
        required: ['percent'],
      },
    },
  },
)
PROPOSE_TOOLS.push(
  {
    type: 'function',
    function: {
      name: 'propose_add_phone_order',
      description:
        'Prepare adding an order the owner took by phone or in person. It is saved as added by the owner and takes portions off the menu. Needs the owner to reply YES.',
      parameters: {
        type: 'object',
        properties: {
          customer_name: { type: 'string' },
          phone: { type: 'string', description: "The customer's phone number" },
          delivery_type: { type: 'string', enum: ['delivery', 'pickup'] },
          address: { type: 'string', description: 'Delivery address (needed for delivery)' },
          delivery_fee: { type: 'integer', description: 'Delivery fee in naira, only if the owner gave one' },
          paid: { type: 'boolean', description: 'true only if the owner said it is already paid' },
          payment_method: { type: 'string', description: 'For example transfer, cash, POS' },
          day: { type: 'string', enum: ['today', 'tomorrow'] },
          note: { type: 'string' },
          items: {
            type: 'array',
            description: 'The items ordered',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string', description: 'The dish or drink NAME only' },
                variation: { type: 'string', description: 'Size or option, if given' },
                quantity: { type: 'integer' },
              },
              required: ['item', 'quantity'],
            },
          },
        },
        required: ['customer_name', 'phone', 'delivery_type', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_undo_last_change',
      description:
        'Prepare undoing the most recent price change or portions change, putting the old values back. Needs the owner to reply YES (or the PIN for big or many price changes).',
      parameters: { type: 'object', properties: {} },
    },
  },
)
PROPOSE_TOOLS.push(
  {
    type: 'function',
    function: {
      name: 'propose_add_to_menu',
      description:
        "Prepare putting one OR SEVERAL of the owner's existing menu items onto a day's menu with a number of portions. Needs the owner to reply YES. Put ALL the items in the items list so the owner confirms once.",
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'SEVERAL items in one request. Use this whenever the owner names more than one item, so they confirm once.',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string', description: 'The dish or drink NAME only' },
                variation: { type: 'string', description: 'Size, only if given' },
                portions: { type: 'integer', description: 'Portions for this item (if different from the default)' },
              },
              required: ['item'],
            },
          },
          item: { type: 'string', description: 'The dish or drink NAME only (for one item)' },
          variation: { type: 'string', description: 'Size, only if the item has several' },
          portions: { type: 'integer', description: 'Default portions for every item (1 to 500)' },
          day: { type: 'string', enum: ['today', 'tomorrow'] },
        },
        required: ['portions'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_remove_from_menu',
      description: "Prepare taking an item off a day's menu. Always needs the owner's PIN.",
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'The dish or drink NAME only' },
          variation: { type: 'string' },
          day: { type: 'string', enum: ['today', 'tomorrow'] },
        },
        required: ['item'],
      },
    },
  },
)
PROPOSE_TOOLS.push(
  {
    type: 'function',
    function: {
      name: 'propose_take_over_chat',
      description:
        "Prepare taking over a customer's chat so the assistant stops replying to that customer. Needs the owner to reply YES.",
      parameters: {
        type: 'object',
        properties: { customer: { type: 'string', description: 'The customer name or phone number, or "latest"' } },
        required: ['customer'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_hand_back_chat',
      description: "Prepare handing a customer's chat back to the assistant so it answers again. Needs the owner to reply YES.",
      parameters: {
        type: 'object',
        properties: { customer: { type: 'string', description: 'The customer name or phone number, or "latest"' } },
        required: ['customer'],
      },
    },
  },
)
const ALL_TOOLS = [...TOOLS, ...PROPOSE_TOOLS]
const PROPOSE_KIND: Record<string, string> = {
  propose_mark_sold_out: 'set_sold_out',
  propose_mark_available: 'set_available',
  propose_set_portions: 'set_portions',
  propose_approve_order: 'approve_order',
  propose_reject_order: 'reject_order',
  propose_change_price: 'set_price',
  propose_adjust_prices: 'set_prices',
  propose_add_phone_order: 'add_order',
  propose_undo_last_change: 'undo_last',
  propose_add_to_menu: 'add_to_menu',
  propose_remove_from_menu: 'remove_from_menu',
  propose_take_over_chat: 'take_over_chat',
  propose_hand_back_chat: 'hand_back_chat',
}

const RANGES = new Set(['today', 'yesterday', 'week', 'month'])
const STATUSES = new Set([
  'pending_approval', 'awaiting_payment', 'paid', 'preparing', 'out_for_delivery',
  'ready_for_pickup', 'delivered', 'cancelled',
])

// Runs one tool by asking the DATABASE. Returns the raw result as an object.
// deno-lint-ignore no-explicit-any
async function runTool(name: string, rawArgs: string, actor: string): Promise<{ ok: boolean; data: any }> {
  // deno-lint-ignore no-explicit-any
  let a: any = {}
  try {
    a = JSON.parse(rawArgs || '{}')
  } catch {
    return { ok: false, data: { error: 'The tool arguments were not valid JSON.' } }
  }

  if (PROPOSE_KIND[name]) {
    // deno-lint-ignore no-explicit-any
    const params: Record<string, any> = {}
    if (name === 'propose_add_phone_order') {
      params.customer_name = String(a.customer_name ?? '').slice(0, 80)
      params.phone = String(a.phone ?? '').slice(0, 30)
      params.delivery_type = String(a.delivery_type ?? '')
      params.address = String(a.address ?? '').slice(0, 200)
      if (a.delivery_fee != null) params.delivery_fee = String(Math.round(Number(a.delivery_fee)))
      params.paid = a.paid === true || String(a.paid).toLowerCase() === 'true' ? 'true' : 'false'
      if (a.payment_method != null) params.payment_method = String(a.payment_method).slice(0, 30)
      if (a.day != null) params.day = String(a.day)
      if (a.note != null) params.note = String(a.note).slice(0, 200)
      let itemsArr: unknown = a.items
      if (typeof itemsArr === 'string') {
        try {
          itemsArr = JSON.parse(itemsArr)
        } catch {
          itemsArr = []
        }
      }
      params.items = (Array.isArray(itemsArr) ? itemsArr : []).slice(0, 10).map(
        // deno-lint-ignore no-explicit-any
        (it: any) => ({
          item: String(it?.item ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
          variation: it?.variation ? String(it.variation).slice(0, 40) : undefined,
          quantity: Math.round(Number(it?.quantity)),
        }),
      )
      const { data, error } = await admin.rpc('owner_propose_action', {
        p_actor: actor,
        p_kind: PROPOSE_KIND[name],
        p_params: params,
      })
      if (error) return { ok: false, data: { error: 'Could not prepare that order.' } }
      return { ok: true, data }
    }
    if (Array.isArray(a.items) && ['set_sold_out', 'set_available', 'set_portions', 'add_to_menu'].includes(PROPOSE_KIND[name])) {
      params.items = a.items.slice(0, 20).map(
        // deno-lint-ignore no-explicit-any
        (it: any) => ({
          item: String(it?.item ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
          variation: it?.variation ? String(it.variation).slice(0, 40) : undefined,
          portions: it?.portions != null ? String(Math.round(Number(it.portions))) : undefined,
        }),
      )
    }
    if (a.item != null && !params.items) params.item = String(a.item).replace(/\s+/g, ' ').trim().slice(0, 80)
    if (a.variation != null && String(a.variation).trim()) params.variation = String(a.variation).slice(0, 40)
    if (a.day != null) params.day = String(a.day)
    if (a.portions != null) params.portions = String(Math.round(Number(a.portions)))
    if (a.order_number != null) params.order_number = String(a.order_number).slice(0, 20)
    if (a.customer != null) params.customer = String(a.customer).replace(/\s+/g, ' ').trim().slice(0, 80)
    if (a.new_price != null) params.price = String(Math.round(Number(a.new_price)))
    if (a.percent != null) params.percent = String(Number(a.percent))
    if (a.category != null && String(a.category).trim()) params.category = String(a.category).toLowerCase().slice(0, 10)
    if (a.name_contains != null && String(a.name_contains).trim()) params.name_contains = String(a.name_contains).slice(0, 40)
    const { data, error } = await admin.rpc('owner_propose_action', {
      p_actor: actor,
      p_kind: PROPOSE_KIND[name],
      p_params: params,
    })
    if (error) return { ok: false, data: { error: 'Could not prepare that change.' } }
    return { ok: true, data }
  }

  if (name === 'get_chats') {
    const filter = String(a.filter ?? 'needs_you') === 'all' ? 'all' : 'needs_you'
    const { data, error } = await admin.rpc('owner_chats', { p_filter: filter })
    if (error) return { ok: false, data: { error: 'Could not read the chats.' } }
    return { ok: true, data }
  }

  if (name === 'get_menu') {
    const day = String(a.day ?? 'today') === 'tomorrow' ? 'tomorrow' : 'today'
    const { data, error } = await admin.rpc('owner_menu', { p_day: day })
    if (error) return { ok: false, data: { error: 'Could not read the menu.' } }
    return { ok: true, data }
  }

  const range = String(a.range ?? '')
  if (!RANGES.has(range)) return { ok: false, data: { error: 'range must be today, yesterday, week or month.' } }

  if (name === 'get_report') {
    const { data, error } = await admin.rpc('owner_report', { p_range: range })
    if (error) return { ok: false, data: { error: 'Could not read the report.' } }
    return { ok: true, data }
  }
  if (name === 'list_orders') {
    const status = a.status == null ? null : String(a.status)
    if (status !== null && !STATUSES.has(status)) return { ok: false, data: { error: 'Unknown status.' } }
    const { data, error } = await admin.rpc('owner_orders', { p_range: range, p_status: status })
    if (error) return { ok: false, data: { error: 'Could not read the orders.' } }
    return { ok: true, data }
  }
  return { ok: false, data: { error: 'Unknown tool.' } }
}

// ---------------------------------------------------------------------------
// The numbers check: the AI may not state a figure the database did not give
// ---------------------------------------------------------------------------

// Every whole number that appears anywhere in the tool results (plus how many
// rows each list has, so "you have 4 orders" can be checked).
function collectNumbers(value: unknown, into: Set<number>): void {
  if (typeof value === 'number' && Number.isFinite(value)) into.add(Math.round(value))
  else if (typeof value === 'string') {
    for (const m of value.matchAll(/\d+/g)) into.add(Number(m[0]))
  } else if (Array.isArray(value)) {
    into.add(value.length)
    value.forEach((v) => collectNumbers(v, into))
  } else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectNumbers(v, into))
}

const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec'

// Returns the figures in `reply` that are not in the database results.
// Ignored on purpose: years, dates ("13 October"), "last 7 days", "top 3",
// and list numbering ("1.").
function unverifiedFigures(reply: string, allowed: Set<number>): number[] {
  const bad: number[] = []
  for (const m of reply.matchAll(/₦?\s?(\d[\d,]*)(?:\.\d+)?/g)) {
    const n = Number(m[1].replace(/,/g, ''))
    if (!Number.isFinite(n)) continue
    const start = m.index ?? 0
    const end = start + m[0].length
    const before = reply.slice(Math.max(0, start - 12), start).toLowerCase()
    const after = reply.slice(end, end + 12).toLowerCase()
    const hasNaira = m[0].includes('₦')
    if (!hasNaira) {
      if (n >= 2000 && n <= 2100) continue // a year
      if (/^\s*(days?|hours?|minutes?|mins?)\b/.test(after)) continue // "last 7 days"
      if (/\btop\s*$/.test(before)) continue // "top 3"
      if (new RegExp(`^\\s*(st|nd|rd|th)?\\s*(of\\s+)?(${MONTHS})\\b`).test(after)) continue // "13 October"
      if (new RegExp(`(${MONTHS})\\.?\\s*$`).test(before)) continue // "October 13"
      if (/(^|\n)\s*$/.test(reply.slice(0, start)) && /^[.)]/.test(reply.slice(end))) continue // list numbering
    }
    if (!allowed.has(n)) bad.push(n)
  }
  return bad
}

const naira = (n: number) => '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG')

// Plain, exact wording built by code (used when the AI's own wording is rejected).
// deno-lint-ignore no-explicit-any
function renderFallback(results: { name: string; data: any }[]): string {
  const parts: string[] = []
  for (const r of results) {
    const d = r.data
    if (r.name === 'get_report' && d?.sales) {
      parts.push(
        `Here are the exact figures for ${d.label}, so you can judge for yourself:\n` +
          `- Sales: ${naira(d.sales.total)} (orders ${naira(d.sales.from_orders)}, manual sales ${naira(d.sales.from_manual_sales)})\n` +
          `- Orders: ${d.orders.not_cancelled} not cancelled (${d.orders.pending_approval} waiting for approval, ${d.orders.approved} approved, ${d.orders.delivered} delivered), ${d.orders.cancelled} cancelled\n` +
          `- Still waiting for payment: ${naira(d.sales.awaiting_payment)}; waiting for your approval: ${naira(d.sales.waiting_for_approval)}` +
          (Array.isArray(d.best_sellers) && d.best_sellers.length
            ? `\n- Best sellers: ${d.best_sellers.map((b: { name: string; quantity: number }) => `${b.name} x${b.quantity}`).join(', ')}`
            : ''),
      )
    } else if (r.name === 'get_chats' && Array.isArray(d?.chats)) {
      parts.push(
        d.chats.length === 0
          ? 'No chats need you right now.'
          : (d.filter === 'all' ? 'Recent chats:\n' : 'Chats that need you:\n') +
              d.chats
                .map(
                  (c: { name: string; channel: string; mode: string; last: string; unread: boolean }) =>
                    `- ${c.name} (${c.channel}) · ${c.mode === 'owner' ? 'with you' : 'with the assistant'}${c.unread ? ' · unread' : ''} · "${c.last}"`,
                )
                .join('\n'),
      )
    } else if (r.name === 'get_menu' && Array.isArray(d?.on_menu)) {
      const lines = d.on_menu.map(
        (i: { item: string; label: string; price: number; slots_left: number }) =>
          `- ${i.item} (${i.label}) ${naira(i.price)}: ${i.slots_left <= 0 ? 'sold out' : i.slots_left + ' left'}`,
      )
      parts.push(
        (lines.length ? `On ${d.day}'s menu:\n${lines.join('\n')}` : `Nothing is on ${d.day}'s menu yet.`) +
          (Array.isArray(d.not_on_menu) && d.not_on_menu.length
            ? `\n\nNot on the menu: ${[...new Set(d.not_on_menu.map((i: { item: string }) => i.item))].join(', ')}`
            : ''),
      )
    } else if (r.name === 'list_orders' && Array.isArray(d?.orders)) {
      parts.push(
        d.orders.length === 0
          ? 'No orders found for that period.'
          : 'Orders:\n' +
              d.orders
                .map((o: { order_number: string; customer_name: string; total: number; status: string }) =>
                  `- ${o.order_number} · ${o.customer_name} · ${naira(o.total)} · ${String(o.status).replace(/_/g, ' ')}`)
                .join('\n'),
      )
    }
  }
  return parts.join('\n\n') || 'I could not read the numbers just now. Please try again.'
}

// ---------------------------------------------------------------------------
// The conversation loop
// ---------------------------------------------------------------------------

type Msg = { role: 'user' | 'assistant'; content: string }

// Some free models write a tool request as plain TEXT instead of using the
// tool channel, for example:
//   <tool_call><function=get_report><parameter=range>today</parameter></function></tool_call>
// We read that markup back into a real tool call, so the owner never sees it.
// deno-lint-ignore no-explicit-any
function toolCallsFromText(text: string): any[] {
  // deno-lint-ignore no-explicit-any
  const calls: any[] = []
  for (const m of text.matchAll(/<function=([a-z_]+)>([\s\S]*?)<\/function>/gi)) {
    const args: Record<string, string> = {}
    for (const p of m[2].matchAll(/<parameter=([a-z_]+)>\s*([\s\S]*?)\s*<\/parameter>/gi)) args[p[1]] = p[2].trim()
    calls.push({ id: `text-call-${calls.length}`, type: 'function', function: { name: m[1], arguments: JSON.stringify(args) } })
  }
  return calls
}

const LEAKED_MARKUP_RE = /<\/?(tool_call|function|parameter)\b|<function=|<parameter=/i

async function answer(history: Msg[], actor: string): Promise<
  { reply: string; model: string | null; usage: unknown; checked: boolean; proposed?: boolean; needsPin?: boolean } | { error: string; detail?: string }
> {
  // deno-lint-ignore no-explicit-any
  const convo: any[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...history]
  const results: { name: string; data: unknown }[] = []
  let model: string | null = null
  let usage: unknown = null
  let reply = ''
  let proposal: string | null = null
  let proposalNeedsPin = false
  let proposeCalls = 0
  // Numbers the owner typed themselves (like "set it to 5") are not inventions.
  const ownerNumbers = new Set<number>()
  for (const m of history) {
    if (m.role === 'user') for (const x of m.content.matchAll(/\d[\d,]*/g)) ownerNumbers.add(Number(x[0].replace(/,/g, '')))
  }

  for (let round = 0; round < 3; round++) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        models: MODELS,
        temperature: TEMPERATURE,
        messages: convo,
        ...(round < 2 ? { tools: ALL_TOOLS, tool_choice: 'auto', provider: { require_parameters: true } } : {}),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('OpenRouter error', res.status, JSON.stringify(data))
      const why = String(data?.error?.message ?? '').slice(0, 160)
      return {
        // 429 / "rate limit" on a free model usually means today's free allowance is used up.
        error:
          res.status === 429 || /rate|quota|limit/i.test(why)
            ? "The AI service's free allowance looks used up for now. Try again in a little while, or add a little credit on OpenRouter."
            : 'The assistant is busy right now. Please try again.',
        detail: `OpenRouter ${res.status}${why ? ': ' + why : ''}`,
      }
    }
    model = data.model ?? model
    usage = data.usage ?? usage
    const message = data?.choices?.[0]?.message
    let calls = message?.tool_calls
    if ((!Array.isArray(calls) || calls.length === 0) && typeof message?.content === 'string' && LEAKED_MARKUP_RE.test(message.content)) {
      const parsed = toolCallsFromText(message.content)
      if (parsed.length > 0) {
        calls = parsed
        message.content = ''
      }
    }

    if (Array.isArray(calls) && calls.length > 0 && round < 2) {
      convo.push({ role: 'assistant', content: message.content ?? '', tool_calls: calls })
      for (const call of calls.slice(0, 3)) {
        const toolName = String(call?.function?.name ?? '')
        const out = await runTool(toolName, String(call?.function?.arguments ?? '{}'), actor)
        if (PROPOSE_KIND[toolName]) proposeCalls += 1
        if (out.ok && PROPOSE_KIND[toolName]) {
          // Only one change can wait for a YES at a time: the last one wins.
          proposal = out.data?.status === 'pending' ? String(out.data.summary ?? '') : null
          proposalNeedsPin = proposal !== null && out.data?.needs_pin === true
        } else if (out.ok) {
          results.push({ name: toolName, data: out.data })
        }
        convo.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(out.data) })
      }
      continue
    }
    reply = String(message?.content ?? '').trim()
    break
  }

  // Never show tool markup to the owner, whatever the model did.
  if (LEAKED_MARKUP_RE.test(reply)) reply = ''

  if (proposal) {
    // The wording of a change is written by CODE from the database's own
    // summary, never by the AI, so the owner confirms exactly what will happen.
    // Only the LAST prepared change survives. If the AI prepared several, say so
    // out loud so the owner never thinks everything was lined up.
    const warning =
      proposeCalls > 1
        ? `Note: that was ${proposeCalls} separate changes and I can hold only one at a time, so only the one below is ready. After you confirm it, ask me for the others (or name all the items in one request).\n\n`
        : ''
    return {
      reply: proposalNeedsPin
        ? `${warning}${proposal}\n\nEnter your PIN to confirm, or reply NO to cancel. (It expires in 5 minutes.)`
        : `${warning}${proposal}\n\nReply YES to confirm, or NO to cancel. (It expires in 5 minutes.)`,
      model,
      usage,
      checked: false,
      proposed: true,
      needsPin: proposalNeedsPin,
    }
  }

  if (results.length === 0) {
    // No data was fetched. Any figure in the reply would be an invention.
    const allowed = new Set<number>(ownerNumbers)
    if (reply && unverifiedFigures(reply, allowed).length > 0) {
      return {
        reply:
          'I can only quote figures I have read from your records, so I could not answer that. I can: tell you orders, sales and best sellers (today, yesterday, the last 7 days, this month), list orders, mark items sold out or available, set how many portions are left, and approve or reject orders waiting for approval.',
        model,
        usage,
        checked: true,
      }
    }
    if (!reply) {
      return {
        reply: 'Sorry, I did not manage to process that. Please say it again in one sentence, for example "Mark Jollof Rice as sold out".',
        model,
        usage,
        checked: true,
      }
    }
    return { reply, model, usage, checked: false }
  }

  const allowed = new Set<number>(ownerNumbers)
  collectNumbers(results.map((r) => r.data), allowed)
  if (!reply || unverifiedFigures(reply, allowed).length > 0) {
    // deno-lint-ignore no-explicit-any
    return { reply: renderFallback(results as any), model, usage, checked: true }
  }
  return { reply, model, usage, checked: false }
}

// The owner said YES (or typed a PIN): run the one stored proposal for THIS
// person. `handled: false` means "this was not a confirmation after all".
type Confirmation = { handled: boolean; reply: string; numbersChecked: boolean; needsPin?: boolean }

async function confirmPending(actor: string, pin: string | null): Promise<Confirmation> {
  const say = (reply: string, extra: Partial<Confirmation> = {}): Confirmation => ({
    handled: true,
    reply,
    numbersChecked: false,
    ...extra,
  })
  const { data, error } = await admin.rpc('owner_confirm_action', { p_actor: actor, p_pin: pin })
  if (error || !data) {
    console.error('confirm failed', error)
    return say('Something went wrong, so nothing was changed. Please try again.')
  }
  switch (data.status) {
    case 'none':
      // A stray number with nothing waiting is just a message.
      return pin !== null ? { handled: false, reply: '', numbersChecked: false } : say('There is nothing waiting for your confirmation.')
    case 'not_a_pin_request':
      return { handled: false, reply: '', numbersChecked: false }
    case 'expired':
      return say('That request expired (5 minutes), so nothing was changed. Ask me again if you still want it.')
    case 'pin_required':
      return say('This change needs your PIN, so a plain YES is not enough. Enter your PIN to confirm, or reply NO to cancel.', {
        needsPin: true,
      })
    case 'wrong':
      return say(
        `That PIN is not right. ${Number(data.attempts_left) || 0} ${Number(data.attempts_left) === 1 ? 'try' : 'tries'} left, then it locks for 15 minutes. Nothing was changed.`,
        { needsPin: true },
      )
    case 'locked': {
      const until = data.until
        ? new Date(String(data.until)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
        : 'a little later'
      return say(`Too many wrong PINs, so PIN confirmation is locked until ${until}. Nothing was changed.`)
    }
    case 'not_set':
      return say('You have not set a PIN yet. Set one in the dashboard under Owner Numbers, then ask me again. Nothing was changed.')
    case 'failed':
      return say(String(data.message ?? 'That could not be done, so nothing was changed.'))
    case 'done': {
      // Tell the customer, exactly as the dashboard's own buttons do.
      if (data.order_id && (data.kind === 'approve_order' || data.kind === 'reject_order')) {
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/send-order-email`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: data.order_id, event: data.kind === 'approve_order' ? 'order_approved' : 'stage_change' }),
          })
        } catch (err) {
          console.error('order notification failed', err)
        }
      }
      return say(`Done. This was applied: ${String(data.summary ?? '').replace(' This needs your PIN.', '')}`)
    }
    default:
      return say('Nothing was changed.')
  }
}

async function logUsage(model: string | null, usage: unknown, latencyMs: number, ok: boolean, error: string | null) {
  // deno-lint-ignore no-explicit-any
  const u = (usage ?? {}) as any
  const { error: e } = await admin.from('ai_usage').insert({
    conversation_id: null,
    kind: 'chat',
    model,
    prompt_tokens: Number(u.prompt_tokens) || 0,
    completion_tokens: Number(u.completion_tokens) || 0,
    total_tokens: Number(u.total_tokens) || 0,
    cost: Number(u.cost) || 0,
    latency_ms: latencyMs,
    ok,
    error,
  })
  if (e) console.error('could not log usage', e)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)
  if (!OPENROUTER_API_KEY) return json({ error: 'The assistant is not set up yet (missing key).' }, 500)

  // 1. Who is this? Decided by code.
  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.replace(/^Bearer\s+/i, '')
  const isService = bearer !== '' && timingSafeEqual(bearer, SERVICE_ROLE_KEY)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request.' }, 400)
  }

  let actor: string | null = null
  if (isService) {
    // Our own whatsapp function, which has already matched the sender to an
    // ACTIVE owner number, tells us who it is for the log.
    const given = typeof body.actor === 'string' ? body.actor.trim().slice(0, 100) : ''
    actor = given || 'service'
  } else {
    actor = await ownerActor(authHeader)
  }
  if (!actor) return json({ error: 'Owner login required.' }, 401)
  const raw = Array.isArray(body.messages) ? body.messages : []
  const history: Msg[] = raw
    .filter(
      (m): m is Msg =>
        m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim() !== '',
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return json({ error: 'The last message must be from you.' }, 400)
  }

  try {
    // 2. A plain YES / NO is handled by CODE, not by the AI.
    const lastText = history[history.length - 1].content.trim().toLowerCase().replace(/[.!\s]+$/, '')
    // The dashboard sends a PIN in its own hidden field. Over WhatsApp the owner
    // types it as a message of 4-6 digits. It only ever counts when the waiting
    // action really asks for a PIN.
    const pinField = typeof body.pin === 'string' && /^\d{4,6}$/.test(body.pin) ? body.pin : null
    const typedPin = /^\d{4,6}$/.test(lastText) ? lastText : null
    const pin = pinField ?? typedPin
    if (pin !== null) {
      const c = await confirmPending(actor, pin)
      if (c.handled) return json({ reply: c.reply, numbersChecked: false, needsPin: c.needsPin === true })
      if (pinField !== null) return json({ reply: 'There is nothing waiting for a PIN.', numbersChecked: false })
      // not a PIN request: carry on as an ordinary message
    }
    if (lastText === 'yes') {
      const c = await confirmPending(actor, null)
      return json({ reply: c.reply, numbersChecked: false, needsPin: c.needsPin === true })
    }
    if (['no', 'cancel', 'stop', 'nope'].includes(lastText)) {
      const { data: cancelled } = await admin.rpc('owner_cancel_action', { p_actor: actor })
      if (cancelled === true) return json({ reply: 'Okay, cancelled. Nothing was changed.', numbersChecked: false })
      // nothing was waiting: let the AI treat it as ordinary conversation
    }

    const started = Date.now()
    const out = await answer(history, actor)
    const latency = Date.now() - started
    if ('error' in out) {
      // The log keeps the real reason (shown in AI Monitor → Problems).
      await logUsage(null, null, latency, false, out.detail ?? out.error)
      return json({ error: out.error }, 502)
    }
    await logUsage(out.model, out.usage, latency, true, null)
    return json({ reply: out.reply, model: out.model, numbersChecked: out.checked, needsPin: out.needsPin === true })
  } catch (err) {
    console.error('owner-assistant failed', err)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
