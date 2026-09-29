# Edelicacies — Setup Guide

This is your plain-language guide to getting the site running and connecting
it to Supabase (the database) and Resend (email). The whole site — every
build phase — is now built. This guide walks you through everything you
still need to click through yourself, in order.

**If you only do one thing after reading this:** follow "Phase 3–7" below —
that's where checkout, payments-on-WhatsApp, email and the rest of the
dashboard get connected.

You don't need to be technical to follow this. Just copy/paste the commands
into VS Code's terminal, and follow the steps in order.

---

## Phase 1 — Project setup, branding, menu & cart

**What was built:** the full public-facing website shell — homepage with
today's menu (sample data for now), item detail sheet with sizes/prices,
add-to-cart, and a cart page. No backend yet — that starts in Phase 2.

### Running it on your computer

1. Open this folder (`Edelicacies Website`) in VS Code.
2. Open a terminal in VS Code (Terminal → New Terminal).
3. Install dependencies (only needed once, or after we add new packages):
   ```
   npm install
   ```
4. Start the site:
   ```
   npm run dev
   ```
5. Open the link it prints (usually `http://localhost:5173`) in your browser.

That's it — nothing to paste into Supabase yet, and no secrets to add yet.
Those steps will appear here once we reach Phase 2.

### What you're looking at

- The menu items and photos on the homepage are **sample data** pulled from
  your WhatsApp price list, just so the site looks real while we build. From
  Phase 2 onward, you'll manage the real menu yourself from the owner
  dashboard.
- Checkout, delivery pricing and WhatsApp confirmation are all live now —
  see "Phase 3–7" further down.

---

## Phase 2 — Database, owner login & dashboard

**What was built:** a real database (via Supabase), an owner login, and a
mobile-friendly dashboard with three working sections: **Menu Items**,
**Daily Menu & Slots**, and **Settings**. The homepage now shows your real
menu once you've set it up below — before that, it keeps showing the sample
menu so the site never looks broken.

The rest of the dashboard sections (Orders, Customers, Records, Expenses,
Reports, Discount Codes, Reviews, Subscribers) are now built too — see
"Phase 3–7" below for the extra setup steps they need.

### Step 1 — Create your Supabase project

1. Go to [supabase.com](https://supabase.com), sign up or log in, and click
   **New project**.
2. Pick any name (e.g. "edelicacies") and a strong database password — save
   that password somewhere safe, you likely won't need it again but it's
   good to keep.
3. Choose a region close to Nigeria if offered (e.g. Europe).
4. Wait a minute or two for the project to finish setting up.

### Step 2 — Run the database setup

1. In your Supabase project, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `supabase/schema.sql` in this project (in VS Code), select all the
   text, copy it, and paste it into the Supabase SQL Editor.
4. Click **Run**. You should see "Success. No rows returned."
   - This file is safe to paste again in future phases — it won't duplicate
     anything or erase data you've already added.

### Step 2b — Load your real menu items (optional, recommended)

To save you typing in all 28 dishes by hand, `supabase/seed_menu_items.sql`
has your real menu — names, descriptions, sizes and prices — pulled from
your WhatsApp price list.

1. In the SQL Editor, click **New query** again.
2. Open `supabase/seed_menu_items.sql`, copy all of it, paste it in, and
   click **Run**.
3. That's it — 28 dishes with their sizes and prices now exist, all marked
   active. You'll see them under **Menu Items** once you're logged in.

**Photos aren't included** — uploading files needs you to be logged in
first, which is Step 4 below. Once you're in, open each item under **Menu
Items** and add its photo; the originals are sitting in `src/assets/menu/`
if you want to reuse them. Everything else (names, descriptions, sizes,
prices) is there for you to review and edit as needed — treat it as a
starting draft, not a final menu.

### Step 3 — Connect the site to your project

1. In Supabase, click **Project Settings → Data API**. Copy the **Project
   URL**.
2. Still in Project Settings, click **API Keys** and copy the **anon
   public** key (not the `service_role` one — that one must never be used
   in this project).
3. Open the `.env` file in this project folder and fill in:
   ```
   VITE_SUPABASE_URL=<paste the Project URL>
   VITE_SUPABASE_ANON_KEY=<paste the anon public key>
   ```
4. Stop the site if it's running (Ctrl+C in the terminal) and start it again
   with `npm run dev` so it picks up the new values.

### Step 4 — Create your owner login

This site has no public sign-up page on purpose — only you should be able to
log in.

1. In Supabase, click **Authentication → Users**.
2. Click **Add user → Create new user**.
3. Enter your email and choose a password. Tick **Auto Confirm User** so you
   don't need to click an email link.
4. Click **Create user**.
5. On the site, go to `/dashboard/login` (e.g.
   `http://localhost:5173/dashboard/login`) and sign in with that email and
   password.

### Step 5 — Try it out

1. Go to **Menu Items** in the dashboard and add a dish — name, category,
   description, a photo, and at least one size with a price.
2. Go to **Daily Menu & Slots**, pick today's date, tick the item you just
   added, set how many slots (portions) are available, and click **Save**.
3. Open the homepage in a new tab — your real dish should now appear
   instead of the sample menu.
4. Go to **Settings** to try changing the announcement banner text — it
   updates on the homepage right away.

If anything doesn't behave as described here, let me know what you saw and
I'll fix it.

---

## Phase 3–7 — Checkout, delivery, email, records, reports and everything else

**What was built, all together:** delivery pricing by distance with a map
pin, shop pickup with time windows, full checkout with WhatsApp handoff,
order stages, the slot-hold timer, order tracking, sales records (automatic
+ manual), expenses and profit, customers, "notify me" subscribers, discount
codes, review requests, best-sellers and CSV export. This is most of the
remaining setup — take it one step at a time, in order.

### Step 6 — Re-run the database setup (it grew)

`supabase/schema.sql` now has a lot more in it — delivery bands, orders,
customers, discount codes, reviews, subscribers and more. Paste the **whole
file** into the SQL Editor again (same as Step 2) and click **Run**. It's
safe — it won't touch your existing menu items or daily menus, and it won't
duplicate anything if you've already run parts of it.

If the very last part (the scheduled job) shows an error mentioning
`pg_cron` or `pg_net`: open **Database → Extensions** in the Supabase
dashboard, search for and enable both `pg_cron` and `pg_net`, then go back
to the SQL Editor and run just that last block again (the part starting
`create extension if not exists pg_cron;`).

### Step 7 — Add the three Edge Functions

Each one is a single file you paste in whole. In Supabase, click **Edge
Functions** in the left sidebar.

1. **`send-order-email`**
   - Click **Create a new function**, name it exactly `send-order-email`.
   - Delete whatever starter code is there, then open
     `supabase/functions/send-order-email/index.ts` in this project, copy
     all of it, and paste it in.
   - Leave **Verify JWT** switched **on** (the default).
   - Click **Deploy**.
2. **`process-orders`**
   - Same as above, but name it `process-orders` and paste in
     `supabase/functions/process-orders/index.ts`.
   - This one is triggered automatically every 10 minutes, not by a person,
     so switch **Verify JWT off** for this function (look for that toggle
     in its settings).
   - Click **Deploy**.
3. **`notify-subscribers`**
   - Name it `notify-subscribers`, paste in
     `supabase/functions/notify-subscribers/index.ts`.
   - Leave **Verify JWT on** (only you, logged in, should be able to
     trigger this one).
   - Click **Deploy**.

### Step 8 — Get a Resend account and API key (for real email)

1. Go to [resend.com](https://resend.com) and sign up (their free plan is
   enough to start).
2. Verify a sending domain if you have one, or use their test address for
   now — either way, grab your **API key** from the Resend dashboard.
3. In Supabase, go to **Project Settings → Edge Functions → Secrets** and
   add:

   | Secret name | Value |
   |---|---|
   | `RESEND_API_KEY` | The API key you just copied from Resend |
   | `FROM_EMAIL` | e.g. `Edelicacies <orders@yourdomain.com>` (or Resend's test address while you don't have a domain yet) |
   | `SITE_URL` | Your site's address — `http://localhost:5173` while testing, and your real domain once it's live (Step 12) |

   Without `RESEND_API_KEY`, the site still works completely normally —
   emails are just silently skipped instead of sent.

### Step 9 — Set your notification email

1. On the site, go to **Dashboard → Settings**.
2. Fill in **Owner email** with the address you want new-order alerts sent
   to, and click **Save settings**.

### Step 10 — Try out the new dashboard sections

- **Settings** now also has delivery bands, pickup windows, slot-hold time,
  review delay and expense categories — the defaults match the numbers you
  originally gave me, but everything is editable.
- **Orders** — once a customer checks out, it appears here; tap through the
  stages with one button each.
- **Records**, **Expenses**, **Reports**, **Discount Codes**, **Reviews**,
  **Subscribers**, **Customers** are all live now.

### Step 10b — Add dummy data to try everything out (optional)

`supabase/seed_dummy_data.sql` adds a handful of fake orders, customers,
sales records, expenses, discount codes, reviews and subscribers, so every
dashboard section has something to look at immediately. Paste it into the
SQL Editor and run it **once** (run it twice and you'll just get two sets of
dummy orders — harmless, but untidy).

Every phone number it uses starts with `0800000`, which makes it easy to
find and delete later — the top of that file has the exact delete
statements to paste in when you're ready to remove it.

### Step 11 — Place a real test order

1. On the live site, add something to your cart and go through checkout —
   use your own phone number and a real email you can check.
2. Confirm: the order is saved (you see an order number), a WhatsApp chat
   opens with the order pre-filled, and — if you set up Resend in Step 8 —
   an email arrives.
3. In the dashboard, open **Orders**, find your test order, and tap through
   its stages. Check that a status-change email arrives each time.
4. Go to `/track` on the site, enter your order number and phone number,
   and confirm the status shows correctly.
5. In the dashboard, mark the order **Delivered**. A few hours later (or
   however long you set the review delay to), you should get a
   review-request email; the link goes to `/review`.

### Step 12 — Deploying the site (Cloudflare Pages)

1. Push this project to a GitHub repository (ask me to do this with you
   when you're ready — I won't push anything without you telling me to).
2. In Cloudflare Pages, create a new project connected to that repository.
3. Build command: `npm run build`. Build output folder: `dist`.
4. Add the same values from your `.env` file as environment variables in
   Cloudflare Pages' project settings (Settings → Environment variables).
5. Cloudflare will redeploy automatically every time you push to GitHub.
6. Once it's live, go back to Supabase's Edge Function secrets (Step 8) and
   update `SITE_URL` to your real domain, so links in emails point to the
   live site instead of `localhost`.

The `public/_redirects` file is already in place so refreshing any page on
the live site works correctly.

### Step 13 — Editable email templates (new)

You can now edit the wording of every automated email yourself, from
**Dashboard → Email Templates** — no need to ask me for changes to things
like the new-order message or the review request. The order details table,
totals and links are always added automatically below your text, so editing
a template can't break the layout.

Two things to paste in for this to work, since it's new:

1. **Re-run `supabase/schema.sql`** in the SQL Editor again (same as Step 6)
   — it now includes the `email_templates` table with starting wording
   already filled in.
2. **Re-paste the 3 Edge Functions** (`send-order-email`, `process-orders`,
   `notify-subscribers`) — same files, same names, same Verify JWT settings
   as Step 7. They were updated both to read your edited templates and to
   fix a bug where error messages weren't showing properly, which is what
   we were debugging earlier.

### Step 14 — Notify subscribers: now right after saving, and with the menu listed

Two small updates, both just need `notify-subscribers` re-pasted (Step 13.2)
to take effect:

- After saving a **Daily Menu & Slots** page for any date, a popup now
  offers a **"Notify subscribers about this menu"** button right there — no
  need to go find the Subscribers page separately. This also means you can
  notify people a day ahead: schedule tomorrow's menu today, save, and hit
  notify from that same popup. On the day itself, just open that date again
  and save (even without changing anything) to get the same prompt.
- The "menu is live" email itself now lists the actual dishes and drinks —
  grouped as **Food** and **Drinks**, matching how the site itself shows
  them — instead of a generic "today's menu is ready" line.

### Reference: all Edge Function secrets

Set these under **Project Settings → Edge Functions → Secrets** in Supabase:

| Secret name | What it's for |
|---|---|
| `RESEND_API_KEY` | Lets the Edge Functions send emails via Resend |
| `FROM_EMAIL` | The "from" address customers and you see on emails |
| `SITE_URL` | Used to build links inside emails (tracking, review, unsubscribe, ordering) |

(There's no `OWNER_EMAIL` secret — that one lives in the dashboard under
**Settings → Owner email** instead, so you can change it yourself without
touching Supabase.)
