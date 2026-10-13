# PROGRESS — Edelicacies Menu Assistant

## Current position
- **Phase:** 3 complete (done-when passed 2026-10-12), waiting for "yes, move on" to Phase 4
- **Current item:** Phase 4 not formally started. Done inside Phase 4 scope: tools `send_enquiry` and `place_order`, owner approval flow, owner alert emails. Still to do: AI/Owner takeover + live inbox, automatic handoff by rule, conversation log with mode, MCP bonus, Phase 4 quiz + done-when test

## Checklist

### Phase 0: Setup check
- [x] Confirm the Edelicacies project runs locally and is connected to Supabase (2026-10-11: site loads at localhost:5173, shows "No menu today" empty state = live Supabase query, no menu published yet)
- [x] Confirm `.env` exists and is in `.gitignore` (2026-10-11: verified, not tracked by git)
- [x] Create `PROGRESS.md`
- [x] Explain the whole 8-phase plan in 5 sentences

### Phase 1: How AI models work
- [x] Get an OpenRouter API key and save it in Supabase Secrets (2026-10-11, free models only for now)
- [x] Create a Supabase Edge Function that sends a message to the AI and returns its reply (2026-10-11, function `chat`, deployed and tested, model `openrouter/free`)
- [x] Add a simple chat box to the site that calls that function (2026-10-11, `src/lib/chat.ts`, `src/components/layout/ChatWidget.tsx`, mounted in PublicLayout; tested: 49 prompt + 592 completion tokens, 498 of them reasoning)
- [x] Write a system prompt (2026-10-11, in `supabase/functions/chat/index.ts`; Macauley's 3 rules: no invented prices, only menu items, no screenshot-as-payment-proof; tested 5 questions, all safe)
- [x] Learn: tokens (done, 49/592/641 example)
- [x] Learn: context window (AI has no memory, history resent)
- [x] Learn: system prompt vs user message (waiter/manager card)
- [x] Learn: temperature (2026-10-11, set TEMPERATURE=0.2; saw variation anyway because openrouter/free switches models; plan to pin one model before launch)
- [x] Learn: hallucination (bot offered 'place an order' with no data)

### Phase 2: Data and APIs
- [x] Sketch tables with me first (2026-10-12: existing menu_items, menu_item_variations, daily_menus, daily_menu_slots, orders already cover the menu; only FAQs table is new)
- [x] Create them in the SQL Editor (2026-10-12: `faqs` table added to schema.sql and created in Supabase; empty for now, filled in Phase 3)
- [x] Edge Function loads today's menu into the bot's instructions (2026-10-12: `loadMenuText()` reads today + tomorrow via public key, fresh on every message; tested with no menu: bot said none published)
- [x] Owner dashboard changes the daily menu (2026-10-12: existing Daily Menu & Slots page; tested: add item -> bot lists it with stock; remove (0 slots) -> bot says no longer available, no redeploy)
- [x] Learn: table links (one dish on many days via daily_menu_slots)
- [x] Learn: planning tables before building
- [x] Learn: API endpoint, GET vs POST (chat = POST, menu read = GET; both right first try)

### Phase 3: RAG
- [x] Write business info (2026-10-12: 18 notes in `supabase/seed_faqs.sql`, loaded into `faqs`)
- [x] Switch on pgvector (2026-10-12)
- [x] Embeddings stored in a table (2026-10-12: all 18 faqs rows have 384-number embedding via `embed-faqs`)
- [x] Bot searches before answering (2026-10-12: `match_faqs` SQL function + chat function embeds the question with gte-small, top 4 notes, MIN_SIMILARITY 0.8; tested 8+ questions)
- [x] Learn: embeddings (fingerprint = meaning as numbers)
- [x] Learn: similarity search (closeness score, threshold 0.8, 0.5 too loose, 0.95 too strict)
- [x] Learn: chunking + why RAG reduces made-up answers (2026-10-12: explained with Ewet 0.945 vs CEO 0.767; follow-up limit shown with 'how long does that take?' after refunds)

### Phase 4: Agents and MCP
- [ ] Tools: check menu, draft order
- [ ] Drafted orders wait for owner approval
- [ ] Customer confirmation only after approval
- [ ] Owner takeover mode (AI / Owner)
- [ ] Dashboard inbox with Take over / Hand back
- [ ] Automatic handoff
- [ ] Owner alert (email)
- [ ] Bonus: MCP
- [ ] Learn: tools · agents · MCP · human approval · handoff

### Phase 5: Safe for real customers
- [ ] RLS for customer orders
- [ ] Daily spending cap
- [ ] Rate limiting
- [ ] Conversation log
- [ ] 20 test questions
- [ ] Learn: RLS · prompt injection · observability

### Phase 6: WhatsApp and owner takeover from the phone
- [ ] Pre-checks (Business app version, Coexistence for +234, current pricing)
- [ ] Meta Business account, verification, developer app
- [ ] Connect number via Coexistence
- [ ] Secrets saved
- [ ] Webhook Edge Function
- [ ] Owner takeover from phone
- [ ] WhatsApp chats in dashboard inbox
- [ ] Owner alert on WhatsApp
- [ ] 24-hour rule + "order confirmed" template
- [ ] Learn: webhooks · Coexistence · 24h window · why AI pauses

### Phase 7: Owner assistant on WhatsApp
- [ ] Owner numbers settings page
- [ ] Verification code for new owner numbers
- [ ] Sender check on every message
- [ ] Owner action tools
- [ ] Owner question tools
- [ ] Confirm-before-saving
- [ ] PIN for risky actions
- [ ] Admin action log
- [ ] Optional: voice notes
- [ ] Learn: permissions · exact queries · confirmation + logs · phone-number check in code

### Phase 8: Ship and show it
- [ ] Launch live
- [ ] Re-run tests on WhatsApp + 10 owner tests
- [ ] Demo video plan
- [ ] Case study page
- [ ] Reusable Embooka template
- [ ] Final 5-minute explanation test

## Quiz log
| Date | Topic | How you did |
|---|---|---|
| 2026-10-11 | Why API keys live in Supabase Secrets, not website code | Correct (keys protected from bad hands) |
| 2026-10-11 | Item 2 quiz: why website calls Edge Function (key hiding), system role filtered, limits | Q1 needed a re-explain (answered 'instructions stored there' first, then got 'key visible in inspect'), Q2/Q3 ok |
| 2026-10-11 | Item 3 quiz: AI has no memory (code resends history), greeting skipped, hallucination | Q1 wrong at first, got it on re-ask; Q2 partial; Q3 correct |
| 2026-10-11 | Item 4 quiz: system prompt sections, why rules go in system prompt, 'I don't know' vs invented price | Q3 took 3 tries (thought honest 'not sure' was worse than invented price); got it with the money scenario |
| 2026-10-11 | Temperature experiment (2 rounds, same question x3) | Predicted 'identical'; actual: still varied (low != zero, model router varies). Understood after explanation |
| 2026-10-11 | Phase 1 done-when test: why bot makes things up, cost = input+output tokens, temperature | Q1 ok, Q3 ok (missing 'why'), Q2 needed a taxi-meter re-explain, then passed |
| 2026-10-12 | Phase 2 table sketch: which tables answer 'how many large jollof left?' | Correct (4 tables, right order) |
| 2026-10-12 | Item 2 quiz (faqs table): active flag, RLS, why plan tables first | Q3 ok; Q1 and Q2 needed re-explain (delete vs active=false, RLS = locked room), then correct |
| 2026-10-12 | Phase 2 live test: menu change reflected in bot | Passed; predicted 'no afang' correctly after diagnosing stale history |
| 2026-10-12 | Phase 2 final quiz: POST vs GET, link table (daily_menu_slots) | GET/POST correct; link-table answer was the right idea but without naming the link table role (refined) |
| 2026-10-12 | Phase 3 item 1 quiz: why short notes, where delivery fee comes from, unknown area | Q1/Q3 correct; Q2 needed one re-ask (bands = list, exact fee = checkout), then correct |
| 2026-10-12 | Phase 3 items 2-4 quiz: embedding, service role key, similarity threshold, why 3-4 notes, model glitch | Q1 (embedding) good; service role needed 'bypasses RLS' detail; threshold direction confused (0.5 = less unsure), fixed with CEO example |
| 2026-10-12 | Phase 3 explain-back: chunking, RAG vs made-up answers, follow-up limit | Q1/Q2 ok; Q3 predicted bot would 'understand' follow-up; real test showed search misfires on vague follow-ups, safe answer saved by history + rules |
| 2026-10-11 | Phase 0 quiz: empty menu state, .env + .gitignore, website vs Edge Function | 3/3 correct |
| 2026-10-11 | Item 1 quiz: OpenRouter, secret name, free-tier limits | 3/3 correct |

## Topics to revisit
- Similarity threshold direction: LOWER bar = bot is LESS often unsure (more unrelated notes get in); HIGHER bar = more 'not sure'
- Service role key = master key that bypasses RLS, server only
- daily_menu_slots is the LINK table (day + dish/size); describe its role in own words
- RLS: locks the table by default; policies hand out keys. With RLS on and no policy, nobody (anon/authenticated) can read. Service role bypasses it
- Cost = input tokens x input price + output tokens x output price; output is pricier (needed re-explain). Revisit in Phase 5 observability
- Honest 'I'm not sure' is SAFER than a confident wrong answer (price/delivery fee). Re-ask in Phase 3 / 5
- The AI has NO memory: our code resends the whole conversation every time (context window)
- Why the website calls the Edge Function: main reason is hiding the key (first answer focused on instructions)
- System prompt vs user message: needed a restaurant-waiter example before it clicked

## Notes
- Secret created in Supabase Secrets: `OPENROUTER_API_KEY` (OpenRouter key named `edelicacies-menu-assistant`, small credit cap). Decision: use `:free` models first, move to a cheap paid model at launch if 50/day limit is too low.
- Existing site: React + Vite + TS + Tailwind, Supabase backend, Resend for email, Cloudflare Pages.
- Existing Edge Functions: `send-order-email`, `process-orders`, `notify-subscribers`.
- New table (2026-10-12): `faqs` (id, question, answer, active, sort_order, created_at, updated_at), RLS: anon reads active, owner all.
- Existing tables: `menu_items`, `menu_item_variations`, `daily_menus`, `daily_menu_slots`, `settings`, `orders`, `order_items`, `customers`, `reviews`, `subscribers`, `manual_sales`, `expenses`, `email_templates`, `discount_codes`, `delivery_bands`, `pickup_windows`, `app_config`.
- Existing: orders use statuses `awaiting_payment/paid/preparing/...` — Phase 4's "draft order waiting approval" must fit with these.
- Front-end `.env` names: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WHATSAPP_NUMBER`, `VITE_SHOP_LAT`, `VITE_SHOP_LNG`.
- Dashboard route is `/dashboard`.
- Prompt overcorrection seen: rule 'don't name dishes without the menu' made bot refuse to describe jollof. Relax wording in Phase 2.
- Bug found + fixed 2026-10-12: old chat messages outvoted the fresh menu (bot said Afang still available). Fixed by a prompt rule: live menu overrides earlier conversation. Dashboard note: saving an item with 0 slots REMOVES it from that day's menu; 'SOLD OUT' only appears when orders use the last slot.
- Business facts (owner-confirmed 2026-10-12): delivers within 20 km of shop, beyond arranged on WhatsApp; bands 0-2 N1500, 2-5 N2000, 5-8 N2500, 8-11 N3000, 11-14 N3500, 14-17 N4000, 17-20 N4500 (already set in dashboard); delivery starts when meal ready, email when rider on the way; pre-order for tomorrow; no fixed hours (depends on meals, some Sundays); payment: after order, WhatsApp prefilled message, human approves, then account details; refunds for mistaken approval/late payment, replacement/refund for wrong or spoilt food; bulk/catering via WhatsApp; pickup offered, address sent at order confirmation.
- Optional website to-dos: catering/bulk enquiry form that opens WhatsApp.
- EXTRA REQUESTS from Macauley (2026-10-12), to do alongside Phase 4:
  1. DONE (needs paste): pre-order emails differ from same-day (`send-order-email` + 2 new templates in schema.sql `new_order_customer_preorder`, `new_order_owner_preorder`).
  2. DONE (needs paste): menu-live email shows the real date + links to #tomorrow for a future menu (`notify-subscribers`, `Home.tsx` id="tomorrow"). Macauley had probably not re-pasted notify-subscribers.
  2b. DONE (needs paste): dish photos in emails: new order (customer+owner, incl. pre-order), status updates/out for delivery/delivered, auto-cancel, review request, menu-live (send-order-email, process-orders, notify-subscribers). Also: dashboard Daily Menu got Food/Drinks tabs + selected strip + separate notify popup (2026-10-12).
  3. BUILT (needs SQL paste; 2026-10-12): public review form (`ReviewForm.tsx` on Home, `submit_public_review` SQL fn, hidden until approved, honeypot + 10/hour flood guard); dashboard Reviews page has Add review, filters, source badges, delete.
  4. BUILT (needs SQL paste + deploy `send-broadcast`; 2026-10-12): dashboard Messaging page (`Messaging.tsx`, `EmailBuilder.tsx`, `RichTextEditor.tsx`, `lib/emailBlocks.ts`, `lib/api/messaging.ts`). Audiences: everyone, subscribers, customers, ordered today, ordered on a date, yet to order, not ordered in 30 days, individual. Unsubscribe link (customers: `?c=`, subscribers: `?id=`), `{{name}}` personalisation, campaigns log, test send, Resend daily cap guard (setting `email_daily_limit`, 20 kept for order emails). Resend FREE plan = 100/day, 3000/month, 10 req/s (checked 2026-10-12). Logic tested against a fake DB (counts, opt-out, dedupe, cap guard).
  5. BUILT (needs SQL + redeploy `chat`; 2026-10-12): bot hands unanswerable questions to the owner. First real TOOL (`send_enquiry`, tool-calling loop, max 3 rounds, code validates name + phone/email, 10/hour cap, saves to `enquiries`, emails owner via Resend). WhatsApp prefilled-link button built in code when bot says it's unsure or customer asks for a person (secret `WHATSAPP_NUMBER` optional, default 2349021465560). Dashboard: new Enquiries inbox (New/Contacted/Resolved, reply on WhatsApp/email). Reviews in dashboard now editable. Search now embeds last TWO user messages (fixes vague follow-ups). Tested against stubs: valid save, bad contact, rate limit, unknown tool, bad JSON.
  6. BUILT (needs SQL + deploy `chat` and `send-order-email`; 2026-10-12): the bot PLACES ORDERS (Phase 4 core). Tool `place_order` (items by 6-char menu code, name, phone, pickup/delivery+address). Code validates everything, DB `place_chat_order` reuses `place_order` then sets status `pending_approval`, source `chat`. Owner approves/rejects in Dashboard > Orders (`approve_order` fn; reject = cancel, slots restored). Emails: received (customer), needs approval (owner), approved (customer). Delivery fee confirmed by owner (not computed by bot). 18 abuse cases tested on stubs. Follow-ups: no auto-cancel for stale pending orders; customer stats count pending orders.
  7. DONE (needs redeploy `chat`; 2026-10-12): bot always asks for an (optional) email and explains why (contact + tracking link); response carries `trackUrl` and the chat shows a "Track my order" button. Optional secret SITE_URL used by chat fn for the tracking link.
  8. PHASE 6 DESIGN NOTE (WhatsApp order updates, requested 2026-10-12): send the same order events (received, approved, out for delivery, delivered) over WhatsApp. Meta rules checked 2026-10-12: per-message pricing since 1 Jul 2025; free-form messages only free inside the 24h customer-service window; utility templates free inside window, charged outside; no general monthly free tier found in docs (CLAUDE.md plan mentions 1,000 free service messages: RE-VERIFY in Phase 6). Needs approved templates + customer opt-in. Plan: refactor send-order-email into a `notify` function with email + WhatsApp channels.
  9. DONE (frontend only; 2026-10-12): "Remember my details on this device" at checkout (`src/lib/savedDetails.ts`, localStorage, welcome-back banner, "Not you? Clear"). Tested in browser.
  10. PLAN, NOT BUILT (customer accounts, requested 2026-10-12): passwordless email-code login via Supabase Auth, optional prompt after first order, account page (details, saved addresses, order history, track, reorder). HARD PREREQUISITE: today every "to authenticated" policy (44 of them), `set_order_status`, `approve_order`, and Edge fns `notify-subscribers` + `send-broadcast` treat ANY logged-in user as the owner. Before customers can log in, add `is_owner()` (owners table or app_metadata role) and rewrite all of those. Also: configure custom SMTP (Resend) in Supabase Auth, link `orders.customer_id`, chat bot can use the logged-in profile.
  11. BUILT + TESTED (2026-10-12): SECURITY HARDENING then CUSTOMER ACCOUNTS. (a) `owners` table + `is_owner()`; 42 owner policies rewritten from `to authenticated using (true)` to `is_owner()`; public `to anon` policies now also cover `authenticated`; `set_order_status`/`approve_order` check owner-or-service-role (FOUND: set_order_status was callable by anonymous users, now closed); `notify-subscribers`/`send-broadcast` require owner; dashboard guard uses `isOwner`. (b) Accounts: passwordless email code (Supabase Auth OTP), `orders.user_id` (set by place_order via auth.uid()), policies for own orders by user_id or verified email, `customer_profiles`, `customer_addresses`, `delete_my_account_data()`, `claim_order()`. Site: /account (orders, track, order again, details, saved addresses), header icon, signup prompt on order-confirmation, checkout prefill + saved address chips. Tested in real Postgres (PGlite) with Supabase default grants imitated: old schema 11/26 checks, hardened 26/26, accounts 24/24. TO DO BY OWNER: run SQL, check `owners` row = your email, configure Supabase Auth (email OTP template with {{ .Token }}, custom SMTP via Resend). Not done yet: chat bot recognising logged-in customer; WhatsApp login code (Phase 6); marketing opt-out toggle on account page.
- New Supabase objects 2026-10-12: tables `email_campaigns`; column `customers.unsubscribed`; fns `unsubscribe_customer`, `submit_public_review`; bucket `email-images`; setting `email_daily_limit`; Edge fn `send-broadcast`.
- Embedding model chosen: Supabase built-in `gte-small` (384 dims, English only, free, no OpenRouter quota). `faqs.embedding vector(384)`; trigger clears it when question/answer edited; `embed-faqs` function rebuilds NULL ones. Reason: free OpenRouter models share a 50 req/day limit.
- Models pinned 2026-10-12: `models` list = google/gemma-4-31b-it:free, nvidia/nemotron-3-super-120b-a12b:free, google/gemma-4-26b-a4b-it:free (replaced openrouter/free after a safety-model glitch). Revisit paid model before launch.
- Known limits / to do before launch: chat response still returns `sources` (debug) -> remove; retrieval uses only the last user message (tested: 'how long does that take?' after a refunds answer matched the delivery-time note) -> fix: embed last two user messages together, do it in the next chat redeploy (Phase 4); free models can be clumsy; business_hours setting still says Mon-Sat (owner to change in Settings).
- Functions deployed: `chat`, `embed-faqs`. SQL: `match_faqs`, trigger `faqs_clear_embedding_trigger`.
