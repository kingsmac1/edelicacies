-- ============================================================================
-- EDELICACIES — DATABASE SCHEMA
-- ============================================================================
-- This is the ONE file for all database setup. Paste this whole file into
-- the Supabase dashboard's SQL Editor and run it. It is safe to paste again
-- after it grows in a later build phase — every statement below either
-- creates something only if it doesn't already exist, or replaces it
-- cleanly, so re-running it never duplicates data or errors out.
--
-- Build phases: 2–6 (everything through customers, discounts, reviews,
-- subscribers, records, expenses and reports)
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Helper: keeps an `updated_at` column current on every row update.
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- WHO IS THE OWNER
-- ----------------------------------------------------------------------------
-- Customers can create accounts, and a logged-in customer is "authenticated"
-- just like the owner. So "authenticated" must NOT mean "owner". The owner is
-- whoever is listed in this table; every owner-only rule below asks
-- is_owner(). To add another owner later, insert their auth user id here.

create table if not exists owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table owners enable row level security;
-- No policies at all: only is_owner() (below) and the service key can read it.

create or replace function is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from owners where user_id = auth.uid());
$$;

revoke all on function is_owner() from public;
grant execute on function is_owner() to anon, authenticated, service_role;

-- First run only: the existing account is the owner (before this change only
-- the owner could log in, so the oldest account is theirs). Guarded so that
-- re-running this file later can NEVER turn a customer into an owner.
insert into owners (user_id)
select id from auth.users
where not exists (select 1 from owners)
order by created_at
limit 1;

-- ============================================================================
-- MENU ITEMS
-- ============================================================================

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('food', 'drink')),
  description text not null default '',
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists menu_items_set_updated_at on menu_items;
create trigger menu_items_set_updated_at
  before update on menu_items
  for each row execute function set_updated_at();

create table if not exists menu_item_variations (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  label text not null,
  price integer not null check (price >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists menu_item_variations_menu_item_id_idx
  on menu_item_variations(menu_item_id);

-- ============================================================================
-- DAILY MENUS & SLOTS
-- ============================================================================

create table if not exists daily_menus (
  id uuid primary key default gen_random_uuid(),
  menu_date date not null unique,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists daily_menu_slots (
  id uuid primary key default gen_random_uuid(),
  daily_menu_id uuid not null references daily_menus(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  variation_id uuid not null references menu_item_variations(id) on delete cascade,
  slots_total integer not null default 0 check (slots_total >= 0),
  slots_left integer not null default 0 check (slots_left >= 0),
  show_slots boolean not null default true,
  unique (daily_menu_id, variation_id)
);

create index if not exists daily_menu_slots_daily_menu_id_idx
  on daily_menu_slots(daily_menu_id);

-- ============================================================================
-- SETTINGS (simple key/value store, one row per setting)
-- ============================================================================

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists settings_set_updated_at on settings;
create trigger settings_set_updated_at
  before update on settings
  for each row execute function set_updated_at();

-- Seed default settings the first time this runs — never overwrites a value
-- the owner has already changed from the dashboard.
insert into settings (key, value) values
  ('announcement_banner', '{"enabled": true, "text": "Currently delivering in Uyo only · Fresh menu, daily"}'),
  ('business_hours', '{"text": "Mon – Sat, 9am – 7pm"}'),
  ('shop_location', '{"lat": 5.034433, "lng": 7.937081}'),
  ('slot_hold_minutes', '{"minutes": 120}'),
  ('review_delay_hours', '{"hours": 3}'),
  ('max_delivery_km', '{"km": 20}'),
  ('delivery_step', '{"step_km": 3, "step_price": 500}'),
  ('pickup_instructions', '{"text": "Pick up your order at our shop in Uyo. We will confirm the exact address on WhatsApp."}'),
  ('owner_email', '{"email": ""}'),
  ('expense_categories', '["Ingredients", "Gas", "Packaging", "Transport", "Staff", "Other"]')
on conflict (key) do nothing;

-- ============================================================================
-- STORAGE (menu item photos)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

drop policy if exists "menu-images public read" on storage.objects;
create policy "menu-images public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'menu-images');

drop policy if exists "menu-images owner write" on storage.objects;
create policy "menu-images owner write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'menu-images' and is_owner());

drop policy if exists "menu-images owner update" on storage.objects;
create policy "menu-images owner update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'menu-images' and is_owner());

drop policy if exists "menu-images owner delete" on storage.objects;
create policy "menu-images owner delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'menu-images' and is_owner());

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Pattern used everywhere: the public (anon) can only read active/published
-- rows; the logged-in owner (authenticated — there is only ever one account)
-- can read and write everything. There is no public sign-up in this app, so
-- "authenticated" always means the owner.

alter table menu_items enable row level security;
alter table menu_item_variations enable row level security;
alter table daily_menus enable row level security;
alter table daily_menu_slots enable row level security;
alter table settings enable row level security;

-- menu_items
drop policy if exists "menu_items public read active" on menu_items;
create policy "menu_items public read active"
  on menu_items for select
  to anon, authenticated
  using (active = true);

drop policy if exists "menu_items owner read all" on menu_items;
create policy "menu_items owner read all"
  on menu_items for select
  to authenticated
  using (is_owner());

drop policy if exists "menu_items owner write" on menu_items;
create policy "menu_items owner write"
  on menu_items for insert
  to authenticated
  with check (is_owner());

drop policy if exists "menu_items owner update" on menu_items;
create policy "menu_items owner update"
  on menu_items for update
  to authenticated
  using (is_owner())
  with check (is_owner());

drop policy if exists "menu_items owner delete" on menu_items;
create policy "menu_items owner delete"
  on menu_items for delete
  to authenticated
  using (is_owner());

-- menu_item_variations (visible publicly only via an active parent item)
drop policy if exists "menu_item_variations public read active" on menu_item_variations;
create policy "menu_item_variations public read active"
  on menu_item_variations for select
  to anon, authenticated
  using (
    exists (
      select 1 from menu_items
      where menu_items.id = menu_item_variations.menu_item_id
        and menu_items.active = true
    )
  );

drop policy if exists "menu_item_variations owner read all" on menu_item_variations;
create policy "menu_item_variations owner read all"
  on menu_item_variations for select
  to authenticated
  using (is_owner());

drop policy if exists "menu_item_variations owner write" on menu_item_variations;
create policy "menu_item_variations owner write"
  on menu_item_variations for insert
  to authenticated
  with check (is_owner());

drop policy if exists "menu_item_variations owner update" on menu_item_variations;
create policy "menu_item_variations owner update"
  on menu_item_variations for update
  to authenticated
  using (is_owner())
  with check (is_owner());

drop policy if exists "menu_item_variations owner delete" on menu_item_variations;
create policy "menu_item_variations owner delete"
  on menu_item_variations for delete
  to authenticated
  using (is_owner());

-- daily_menus
drop policy if exists "daily_menus public read published" on daily_menus;
create policy "daily_menus public read published"
  on daily_menus for select
  to anon, authenticated
  using (published = true);

drop policy if exists "daily_menus owner read all" on daily_menus;
create policy "daily_menus owner read all"
  on daily_menus for select
  to authenticated
  using (is_owner());

drop policy if exists "daily_menus owner write" on daily_menus;
create policy "daily_menus owner write"
  on daily_menus for insert
  to authenticated
  with check (is_owner());

drop policy if exists "daily_menus owner update" on daily_menus;
create policy "daily_menus owner update"
  on daily_menus for update
  to authenticated
  using (is_owner())
  with check (is_owner());

drop policy if exists "daily_menus owner delete" on daily_menus;
create policy "daily_menus owner delete"
  on daily_menus for delete
  to authenticated
  using (is_owner());

-- daily_menu_slots (visible publicly only via a published parent menu)
drop policy if exists "daily_menu_slots public read published" on daily_menu_slots;
create policy "daily_menu_slots public read published"
  on daily_menu_slots for select
  to anon, authenticated
  using (
    exists (
      select 1 from daily_menus
      where daily_menus.id = daily_menu_slots.daily_menu_id
        and daily_menus.published = true
    )
  );

drop policy if exists "daily_menu_slots owner read all" on daily_menu_slots;
create policy "daily_menu_slots owner read all"
  on daily_menu_slots for select
  to authenticated
  using (is_owner());

drop policy if exists "daily_menu_slots owner write" on daily_menu_slots;
create policy "daily_menu_slots owner write"
  on daily_menu_slots for insert
  to authenticated
  with check (is_owner());

drop policy if exists "daily_menu_slots owner update" on daily_menu_slots;
create policy "daily_menu_slots owner update"
  on daily_menu_slots for update
  to authenticated
  using (is_owner())
  with check (is_owner());

drop policy if exists "daily_menu_slots owner delete" on daily_menu_slots;
create policy "daily_menu_slots owner delete"
  on daily_menu_slots for delete
  to authenticated
  using (is_owner());

-- settings: the public website may read ONLY the display settings it needs
-- (banner, hours, shop location, delivery rules, pickup text). Anything else
-- here (owner_email, AI limits, email limits, expense categories, WhatsApp
-- status) is readable by the owner only. Add a key to this list only if the
-- public site really needs it.
drop policy if exists "settings public read" on settings;
drop policy if exists "settings public read safe keys" on settings;
create policy "settings public read safe keys"
  on settings for select
  to anon, authenticated
  using (
    key in (
      'announcement_banner', 'business_hours', 'shop_location',
      'max_delivery_km', 'delivery_step', 'pickup_instructions',
      'slot_hold_minutes'
    )
  );

drop policy if exists "settings owner read all" on settings;
create policy "settings owner read all"
  on settings for select
  to authenticated
  using (is_owner());

drop policy if exists "settings owner write" on settings;
create policy "settings owner write"
  on settings for insert
  to authenticated
  with check (is_owner());

drop policy if exists "settings owner update" on settings;
create policy "settings owner update"
  on settings for update
  to authenticated
  using (is_owner())
  with check (is_owner());

-- ============================================================================
-- APP CONFIG (small internal table — lets scheduled jobs call Edge Functions)
-- ============================================================================
-- These are NOT secrets — the anon key is the same public key used in this
-- site's .env file, safe to store here. Only used so pg_cron can reach your
-- Edge Functions on a schedule.

create table if not exists app_config (
  key text primary key,
  value text not null
);

insert into app_config (key, value) values
  ('project_url', 'https://ufzslgubqtjjmjaltdrc.supabase.co'),
  ('anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmenNsZ3VicXRqam1qYWx0ZHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDU5MjIsImV4cCI6MjEwNjE4MTkyMn0.qhcOVXfbNLqJywdivmQkHiKLBYVf0oTuvwgHl_cfkh4')
on conflict (key) do nothing;

alter table app_config enable row level security;
-- No policies at all: app_config is readable only by security-definer
-- functions and the postgres role that runs cron — never by anon or
-- authenticated directly.

-- ============================================================================
-- DELIVERY BANDS & PICKUP WINDOWS
-- ============================================================================

create table if not exists delivery_bands (
  id uuid primary key default gen_random_uuid(),
  min_km numeric not null,
  max_km numeric not null,
  price integer not null,
  sort_order integer not null default 0
);

insert into delivery_bands (min_km, max_km, price, sort_order)
select * from (values
  (0::numeric, 2::numeric, 1500, 0),
  (2::numeric, 5::numeric, 2000, 1),
  (5::numeric, 8::numeric, 2500, 2),
  (8::numeric, 11::numeric, 3000, 3)
) as v(min_km, max_km, price, sort_order)
where not exists (select 1 from delivery_bands);

create table if not exists pickup_windows (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

insert into pickup_windows (label, sort_order)
select * from (values
  ('12pm – 1pm', 0),
  ('1pm – 2pm', 1),
  ('2pm – 3pm', 2)
) as v(label, sort_order)
where not exists (select 1 from pickup_windows);

alter table delivery_bands enable row level security;
alter table pickup_windows enable row level security;

drop policy if exists "delivery_bands public read" on delivery_bands;
create policy "delivery_bands public read"
  on delivery_bands for select to anon, authenticated using (true);
drop policy if exists "delivery_bands owner write" on delivery_bands;
create policy "delivery_bands owner write"
  on delivery_bands for insert to authenticated with check (is_owner());
drop policy if exists "delivery_bands owner update" on delivery_bands;
create policy "delivery_bands owner update"
  on delivery_bands for update to authenticated using (is_owner()) with check (is_owner());
drop policy if exists "delivery_bands owner delete" on delivery_bands;
create policy "delivery_bands owner delete"
  on delivery_bands for delete to authenticated using (is_owner());

drop policy if exists "pickup_windows public read" on pickup_windows;
create policy "pickup_windows public read"
  on pickup_windows for select to anon, authenticated using (active = true);
drop policy if exists "pickup_windows owner read all" on pickup_windows;
create policy "pickup_windows owner read all"
  on pickup_windows for select to authenticated using (is_owner());
drop policy if exists "pickup_windows owner write" on pickup_windows;
create policy "pickup_windows owner write"
  on pickup_windows for insert to authenticated with check (is_owner());
drop policy if exists "pickup_windows owner update" on pickup_windows;
create policy "pickup_windows owner update"
  on pickup_windows for update to authenticated using (is_owner()) with check (is_owner());
drop policy if exists "pickup_windows owner delete" on pickup_windows;
create policy "pickup_windows owner delete"
  on pickup_windows for delete to authenticated using (is_owner());

-- ============================================================================
-- DISCOUNT CODES
-- ============================================================================

create table if not exists discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  percent_off integer,
  fixed_off integer,
  start_date date,
  end_date date,
  max_uses integer,
  used_count integer not null default 0,
  min_order_amount integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((percent_off is not null) <> (fixed_off is not null))
);

alter table discount_codes enable row level security;

drop policy if exists "discount_codes owner all" on discount_codes;
create policy "discount_codes owner all"
  on discount_codes for all to authenticated using (is_owner()) with check (is_owner());
-- No anon policy at all — codes are validated only through the
-- preview_discount() / place_order() functions below, never read directly.

-- ============================================================================
-- CUSTOMERS (built up automatically from orders)
-- ============================================================================

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  email text,
  first_order_at timestamptz not null default now(),
  last_order_at timestamptz not null default now(),
  orders_count integer not null default 0,
  total_spent integer not null default 0,
  updated_at timestamptz not null default now()
);

drop trigger if exists customers_set_updated_at on customers;
create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

alter table customers enable row level security;

drop policy if exists "customers owner all" on customers;
create policy "customers owner all"
  on customers for all to authenticated using (is_owner()) with check (is_owner());

-- ============================================================================
-- ORDERS
-- ============================================================================

create sequence if not exists order_number_seq start 1;

create or replace function next_order_number()
returns text
language sql
as $$
  select 'ED-' || lpad(nextval('order_number_seq')::text, 4, '0');
$$;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default next_order_number(),
  menu_date date not null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  delivery_type text not null check (delivery_type in ('dispatch', 'pickup')),
  address_text text,
  address_lat numeric,
  address_lng numeric,
  pickup_window_id uuid references pickup_windows(id),
  dispatch_fee_estimate integer,
  dispatch_fee_final integer,
  subtotal integer not null,
  discount_code text,
  discount_amount integer not null default 0,
  total integer not null,
  status text not null default 'awaiting_payment' check (
    status in ('awaiting_payment', 'paid', 'preparing', 'out_for_delivery', 'ready_for_pickup', 'delivered', 'cancelled')
  ),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  auto_cancel_at timestamptz,
  delivered_at timestamptz,
  review_requested_at timestamptz
);

create index if not exists orders_status_idx on orders(status);
create index if not exists orders_menu_date_idx on orders(menu_date);
create index if not exists orders_phone_idx on orders(customer_phone);

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid,
  variation_id uuid,
  item_name text not null,
  variation_label text not null,
  unit_price integer not null,
  quantity integer not null,
  menu_date date not null
);

create index if not exists order_items_order_id_idx on order_items(order_id);

alter table orders enable row level security;
alter table order_items enable row level security;

-- No anon policies on orders/order_items at all — customers create orders
-- only through place_order() and read them only through track_order(),
-- both security-definer functions below. Only the owner can browse orders
-- directly.
drop policy if exists "orders owner all" on orders;
create policy "orders owner all"
  on orders for all to authenticated using (is_owner()) with check (is_owner());
drop policy if exists "order_items owner all" on order_items;
create policy "order_items owner all"
  on order_items for all to authenticated using (is_owner()) with check (is_owner());

-- ============================================================================
-- REVIEWS
-- ============================================================================

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  customer_name text,
  rating integer not null check (rating between 1 and 5),
  comment text,
  show_on_site boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists reviews_order_id_key on reviews(order_id);

alter table reviews enable row level security;

drop policy if exists "reviews public read approved" on reviews;
create policy "reviews public read approved"
  on reviews for select to anon, authenticated using (show_on_site = true);
drop policy if exists "reviews owner all" on reviews;
create policy "reviews owner all"
  on reviews for all to authenticated using (is_owner()) with check (is_owner());
-- Public submission goes only through submit_review() below — no direct
-- insert policy for anon.

-- ============================================================================
-- SUBSCRIBERS ("notify me when the menu is live")
-- ============================================================================

create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  whatsapp text,
  unsubscribed boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists subscribers_email_key on subscribers(lower(email));

alter table subscribers enable row level security;

drop policy if exists "subscribers public insert" on subscribers;
create policy "subscribers public insert"
  on subscribers for insert to anon, authenticated with check (true);
drop policy if exists "subscribers public unsubscribe" on subscribers;
create policy "subscribers public unsubscribe"
  on subscribers for update to anon, authenticated
  using (true)
  with check (unsubscribed = true);
drop policy if exists "subscribers owner all" on subscribers;
create policy "subscribers owner all"
  on subscribers for all to authenticated using (is_owner()) with check (is_owner());

-- ============================================================================
-- RECORDS (manual/offline sales) & EXPENSES
-- ============================================================================

create table if not exists manual_sales (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null,
  customer_name text,
  customer_phone text,
  items_text text,
  amount integer not null,
  delivery_fee integer not null default 0,
  payment_method text,
  note text,
  paid boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists manual_sales_date_idx on manual_sales(sale_date);

alter table manual_sales enable row level security;
drop policy if exists "manual_sales owner all" on manual_sales;
create policy "manual_sales owner all"
  on manual_sales for all to authenticated using (is_owner()) with check (is_owner());

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category text not null,
  amount integer not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on expenses(expense_date);

alter table expenses enable row level security;
drop policy if exists "expenses owner all" on expenses;
create policy "expenses owner all"
  on expenses for all to authenticated using (is_owner()) with check (is_owner());

-- ============================================================================
-- FUNCTIONS: checkout, tracking, discounts, reviews
-- ============================================================================

-- Places an order: locks and decrements slots row by row (so two customers
-- ordering the same moment can never oversell), validates a discount code
-- server-side, looks up prices from the database (never trusts the browser),
-- and keeps the customers table in sync. Runs as SECURITY DEFINER so it can
-- do all of this safely even though the caller is just "anon".
create or replace function place_order(
  p_menu_date date,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_delivery_type text,
  p_address_text text,
  p_address_lat numeric,
  p_address_lng numeric,
  p_pickup_window_id uuid,
  p_dispatch_fee_estimate integer,
  p_discount_code text,
  p_note text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_menu_id uuid;
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_subtotal integer := 0;
  v_discount_amount integer := 0;
  v_total integer;
  v_hold_minutes integer;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_pct integer; v_fixed integer; v_min integer; v_max_uses integer;
  v_used integer; v_active boolean; v_start date; v_end date;
  v_code_valid boolean := false;
  item jsonb;
  v_variation record;
  v_slot record;
  v_qty integer;
  v_items_out jsonb := '[]'::jsonb;
begin
  if p_customer_name is null or trim(p_customer_name) = '' then
    raise exception 'MISSING_NAME';
  end if;
  if p_customer_phone is null or trim(p_customer_phone) = '' then
    raise exception 'MISSING_PHONE';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  select id into v_daily_menu_id from daily_menus where menu_date = p_menu_date and published = true;
  if v_daily_menu_id is null then
    raise exception 'MENU_NOT_AVAILABLE';
  end if;

  for item in select value from jsonb_array_elements(p_items) order by (value->>'variation_id')
  loop
    v_qty := (item->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'INVALID_QUANTITY';
    end if;

    select miv.id, miv.price, miv.label, miv.menu_item_id, mi.name as item_name
      into v_variation
      from menu_item_variations miv
      join menu_items mi on mi.id = miv.menu_item_id
      where miv.id = (item->>'variation_id')::uuid;

    if v_variation is null then
      raise exception 'ITEM_NOT_FOUND';
    end if;

    select * into v_slot
      from daily_menu_slots
      where daily_menu_id = v_daily_menu_id and variation_id = v_variation.id
      for update;

    if v_slot is null or v_slot.slots_left < v_qty then
      raise exception 'SLOTS_UNAVAILABLE: %', v_variation.item_name;
    end if;

    update daily_menu_slots set slots_left = slots_left - v_qty where id = v_slot.id;

    v_subtotal := v_subtotal + (v_variation.price * v_qty);

    v_items_out := v_items_out || jsonb_build_object(
      'menu_item_id', v_variation.menu_item_id,
      'variation_id', v_variation.id,
      'item_name', v_variation.item_name,
      'variation_label', v_variation.label,
      'unit_price', v_variation.price,
      'quantity', v_qty
    );
  end loop;

  if p_discount_code is not null and trim(p_discount_code) <> '' then
    select percent_off, fixed_off, min_order_amount, max_uses, used_count, active, start_date, end_date
      into v_pct, v_fixed, v_min, v_max_uses, v_used, v_active, v_start, v_end
      from discount_codes where upper(code) = upper(p_discount_code)
      for update;

    if found and v_active
       and (v_start is null or v_today >= v_start)
       and (v_end is null or v_today <= v_end)
       and (v_min is null or v_subtotal >= v_min)
       and (v_max_uses is null or v_used < v_max_uses) then
      if v_pct is not null then
        v_discount_amount := (v_subtotal * v_pct) / 100;
      elsif v_fixed is not null then
        v_discount_amount := least(v_fixed, v_subtotal);
      end if;
      update discount_codes set used_count = used_count + 1 where upper(code) = upper(p_discount_code);
      v_code_valid := true;
    end if;
  end if;

  v_total := v_subtotal - v_discount_amount
    + case when p_delivery_type = 'dispatch' then coalesce(p_dispatch_fee_estimate, 0) else 0 end;

  select coalesce((value->>'minutes')::integer, 120) into v_hold_minutes
    from settings where key = 'slot_hold_minutes';

  v_order_number := next_order_number();

  insert into orders (
    id, order_number, menu_date, customer_name, customer_phone, customer_email,
    delivery_type, address_text, address_lat, address_lng, pickup_window_id,
    dispatch_fee_estimate, subtotal, discount_code, discount_amount, total, note,
    auto_cancel_at, user_id
  ) values (
    v_order_id, v_order_number, p_menu_date, trim(p_customer_name), trim(p_customer_phone), p_customer_email,
    p_delivery_type, p_address_text, p_address_lat, p_address_lng, p_pickup_window_id,
    p_dispatch_fee_estimate, v_subtotal,
    case when v_code_valid then upper(p_discount_code) else null end,
    v_discount_amount, v_total, p_note,
    now() + make_interval(mins => coalesce(v_hold_minutes, 120)),
    auth.uid()
  );

  insert into order_items (order_id, menu_item_id, variation_id, item_name, variation_label, unit_price, quantity, menu_date)
  select v_order_id, (x->>'menu_item_id')::uuid, (x->>'variation_id')::uuid, x->>'item_name', x->>'variation_label', (x->>'unit_price')::integer, (x->>'quantity')::integer, p_menu_date
  from jsonb_array_elements(v_items_out) x;

  insert into customers (phone, name, email, first_order_at, last_order_at, orders_count, total_spent)
  values (trim(p_customer_phone), trim(p_customer_name), p_customer_email, now(), now(), 1, v_total)
  on conflict (phone) do update set
    name = excluded.name,
    email = coalesce(excluded.email, customers.email),
    last_order_at = now(),
    orders_count = customers.orders_count + 1,
    total_spent = customers.total_spent + v_total,
    updated_at = now();

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'discount_amount', v_discount_amount,
    'total', v_total
  );
end;
$$;

revoke all on function place_order(date, text, text, text, text, text, numeric, numeric, uuid, integer, text, text, jsonb) from public;
grant execute on function place_order(date, text, text, text, text, text, numeric, numeric, uuid, integer, text, text, jsonb) to anon, authenticated;

-- Owner-only: moves an order through its stages, restoring slots and the
-- discount code's use-count automatically if the new status is "cancelled".
create or replace function set_order_status(
  p_order_id uuid,
  p_new_status text,
  p_final_dispatch_fee integer default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  -- Only the owner (or our own server functions using the service key) may
  -- change an order's stage. Without this, anyone who knew an order id could.
  if not (is_owner() or auth.role() = 'service_role') then
    raise exception 'NOT_ALLOWED';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if v_order is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if p_new_status = 'cancelled' and v_order.status <> 'cancelled' then
    update daily_menu_slots dms
      set slots_left = dms.slots_left + oi.quantity
      from order_items oi
      join daily_menus dm on dm.menu_date = oi.menu_date
      where dms.daily_menu_id = dm.id
        and dms.variation_id = oi.variation_id
        and oi.order_id = p_order_id;

    if v_order.discount_code is not null then
      update discount_codes set used_count = greatest(used_count - 1, 0)
        where upper(code) = upper(v_order.discount_code);
    end if;
  end if;

  update orders set
    status = p_new_status,
    dispatch_fee_final = coalesce(p_final_dispatch_fee, dispatch_fee_final),
    total = case
      when p_final_dispatch_fee is not null and v_order.delivery_type = 'dispatch'
        then v_order.subtotal - v_order.discount_amount + p_final_dispatch_fee
      else v_order.total
    end,
    delivered_at = case when p_new_status = 'delivered' then now() else v_order.delivered_at end
  where id = p_order_id;
end;
$$;

revoke all on function set_order_status(uuid, text, integer) from public, anon;
grant execute on function set_order_status(uuid, text, integer) to authenticated, service_role;

-- Public order tracking: only returns an order when both the order number
-- AND the phone number match, so customers can't browse each other's orders.
create or replace function track_order(p_order_number text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_items jsonb;
begin
  select * into v_order from orders
    where order_number = p_order_number and customer_phone = p_phone;

  if v_order is null then
    return null;
  end if;

  select jsonb_agg(jsonb_build_object(
    'item_name', item_name, 'variation_label', variation_label,
    'unit_price', unit_price, 'quantity', quantity
  )) into v_items from order_items where order_id = v_order.id;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'status', v_order.status,
    'menu_date', v_order.menu_date,
    'delivery_type', v_order.delivery_type,
    'subtotal', v_order.subtotal,
    'discount_amount', v_order.discount_amount,
    'dispatch_fee_estimate', v_order.dispatch_fee_estimate,
    'dispatch_fee_final', v_order.dispatch_fee_final,
    'total', v_order.total,
    'created_at', v_order.created_at,
    'items', coalesce(v_items, '[]'::jsonb)
  );
end;
$$;

revoke all on function track_order(text, text) from public;
grant execute on function track_order(text, text) to anon, authenticated;

-- Lets the cart/checkout preview a discount code's effect before the order
-- is placed, without ever exposing the discount_codes table directly.
create or replace function preview_discount(p_code text, p_subtotal integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pct integer; v_fixed integer; v_min integer; v_max_uses integer;
  v_used integer; v_active boolean; v_start date; v_end date;
  v_amount integer := 0;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
  select percent_off, fixed_off, min_order_amount, max_uses, used_count, active, start_date, end_date
    into v_pct, v_fixed, v_min, v_max_uses, v_used, v_active, v_start, v_end
    from discount_codes where upper(code) = upper(p_code);

  if not found or not v_active then
    return jsonb_build_object('valid', false, 'reason', 'That code was not found.');
  end if;
  if v_start is not null and v_today < v_start then
    return jsonb_build_object('valid', false, 'reason', 'That code is not active yet.');
  end if;
  if v_end is not null and v_today > v_end then
    return jsonb_build_object('valid', false, 'reason', 'That code has expired.');
  end if;
  if v_min is not null and p_subtotal < v_min then
    return jsonb_build_object('valid', false, 'reason', 'Order is below the minimum for this code.');
  end if;
  if v_max_uses is not null and v_used >= v_max_uses then
    return jsonb_build_object('valid', false, 'reason', 'That code has reached its usage limit.');
  end if;

  if v_pct is not null then
    v_amount := (p_subtotal * v_pct) / 100;
  elsif v_fixed is not null then
    v_amount := least(v_fixed, p_subtotal);
  end if;

  return jsonb_build_object('valid', true, 'discount_amount', v_amount);
end;
$$;

revoke all on function preview_discount(text, integer) from public;
grant execute on function preview_discount(text, integer) to anon, authenticated;

-- Public review submission: only works for a delivered order matching the
-- phone number on file, and only once per order.
create or replace function submit_review(p_order_number text, p_phone text, p_rating integer, p_comment text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  select * into v_order from orders where order_number = p_order_number and customer_phone = p_phone;
  if v_order is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'delivered' then
    raise exception 'ORDER_NOT_DELIVERED';
  end if;
  if exists (select 1 from reviews where order_id = v_order.id) then
    raise exception 'ALREADY_REVIEWED';
  end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'INVALID_RATING';
  end if;

  insert into reviews (order_id, customer_name, rating, comment)
  values (v_order.id, v_order.customer_name, p_rating, nullif(trim(coalesce(p_comment, '')), ''));
end;
$$;

revoke all on function submit_review(text, text, integer, text) from public;
grant execute on function submit_review(text, text, integer, text) to anon, authenticated;

-- ============================================================================
-- SCHEDULED JOB: auto-cancel unpaid orders & send review requests
-- ============================================================================
-- Runs every 10 minutes and calls the "process-orders" Edge Function, which
-- auto-cancels orders that missed their payment window, restores their
-- slots, emails the customer, and sends delayed review-request emails.
-- If this block errors, enable the "pg_cron" and "pg_net" extensions from
-- Database → Extensions in the Supabase dashboard, then run just this block
-- again.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'edelicacies-process-orders') then
    perform cron.unschedule('edelicacies-process-orders');
  end if;
end $$;

select cron.schedule(
  'edelicacies-process-orders',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := (select value from app_config where key = 'project_url') || '/functions/v1/process-orders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from app_config where key = 'anon_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================================
-- EMAIL TEMPLATES (owner-editable wording for every automated email)
-- ============================================================================
-- The structural parts of each email (the order items table, totals, footer,
-- tracking links) are always generated by the Edge Functions — only the
-- subject line and the human-written intro text below are editable here, so
-- an owner can't accidentally break the layout by editing a template.
--
-- Placeholders (written as {{name}}) are swapped for real values when the
-- email is sent. Each template's available placeholders are listed in its
-- row via the `placeholders` column, purely for display in the dashboard.

create table if not exists email_templates (
  key text primary key,
  label text not null,
  subject text not null,
  body text not null,
  placeholders text not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists email_templates_set_updated_at on email_templates;
create trigger email_templates_set_updated_at
  before update on email_templates
  for each row execute function set_updated_at();

insert into email_templates (key, label, subject, body, placeholders) values
  (
    'new_order_customer',
    'New order — to customer',
    'Order {{order_number}} received — Edelicacies',
    'Thanks, {{customer_name}}! We''ve received your order {{order_number}} for {{menu_date}}. Payment is confirmed on WhatsApp — we''ll message you shortly to sort that out.',
    '{{customer_name}}, {{order_number}}, {{menu_date}}, {{total}}'
  ),
  (
    'new_order_owner',
    'New order — to you',
    'New order {{order_number}} — {{total}}',
    'New order from {{customer_name}} ({{customer_phone}}).',
    '{{customer_name}}, {{customer_phone}}, {{order_number}}, {{total}}, {{delivery_type}}'
  ),
  (
    'stage_change',
    'Order status changed (paid, preparing, ready for pickup, cancelled)',
    'Order {{order_number}}: {{status_label}} — Edelicacies',
    'Hi {{customer_name}}, your order {{order_number}} is now: {{status_label}}.',
    '{{customer_name}}, {{order_number}}, {{status_label}}'
  ),
  (
    'out_for_delivery',
    'Order out for delivery',
    'Order {{order_number}} is out for delivery — Edelicacies',
    'Hi {{customer_name}}, your order {{order_number}} is on its way! Please stay close to your phone — our dispatch rider will call you when they''re nearby.',
    '{{customer_name}}, {{order_number}}'
  ),
  (
    'delivered',
    'Order delivered',
    'Order {{order_number}} delivered — thank you! — Edelicacies',
    'Hi {{customer_name}}, your order {{order_number}} has been delivered. Thank you so much for choosing Edelicacies — we hope you enjoyed every bite!',
    '{{customer_name}}, {{order_number}}'
  ),
  (
    'auto_cancel',
    'Order auto-cancelled',
    'Order {{order_number}} was cancelled — Edelicacies',
    'Hi {{customer_name}}, order {{order_number}} wasn''t confirmed as paid in time, so it''s been automatically cancelled and any held items released. Still want it? Feel free to place a new order.',
    '{{customer_name}}, {{order_number}}'
  ),
  (
    'review_request',
    'Review request',
    'How was your order? — Edelicacies',
    'Hi {{customer_name}}, we''d love to hear what you thought of order {{order_number}}.',
    '{{customer_name}}, {{order_number}}'
  ),
  (
    'menu_live_subscribers',
    'Notify subscribers: menu is live',
    '{{date_label}} menu is live — Edelicacies',
    '{{date_label}} menu is ready!',
    '{{date_label}} (reads "Today''s", "Tomorrow''s", or a full date depending on which day you''re notifying about) — the menu items are also listed automatically, grouped as Food/Drinks, below your text'
  )
on conflict (key) do nothing;

-- The subject/body above used to hardcode "Today's" even when notifying
-- about a future date — this corrects that in-place for anyone who already
-- had the old version seeded, but only if it's still the exact original
-- wording (so it never overwrites anything you've since customized here
-- yourself, e.g. from Dashboard → Email Templates).
update email_templates set
  subject = '{{date_label}} menu is live — Edelicacies',
  body = '{{date_label}} menu is ready!',
  placeholders = '{{date_label}} (reads "Today''s", "Tomorrow''s", or a full date depending on which day you''re notifying about) — the menu items are also listed automatically, grouped as Food/Drinks, below your text'
where key = 'menu_live_subscribers'
  and subject = 'Today''s menu is live — Edelicacies'
  and body = 'Today''s menu is ready!';

alter table email_templates enable row level security;

drop policy if exists "email_templates owner all" on email_templates;
create policy "email_templates owner all"
  on email_templates for all to authenticated using (is_owner()) with check (is_owner());
-- No anon policy — only the owner (in the dashboard) reads or edits these.
-- Edge Functions read them using the service role key, which bypasses RLS.

-- ============================================================================
-- FAQS (approved answers to common questions — the assistant's knowledge)
-- ============================================================================
-- Phase 2 of the AI assistant build. Phase 3 will add an "embedding" column
-- here so the assistant can search these by meaning.

create table if not exists faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists faqs_set_updated_at on faqs;
create trigger faqs_set_updated_at
  before update on faqs
  for each row execute function set_updated_at();

alter table faqs enable row level security;

-- The public can read active FAQs; only the logged-in owner can change them.
drop policy if exists "faqs public read active" on faqs;
create policy "faqs public read active"
  on faqs for select to anon, authenticated using (active = true);
drop policy if exists "faqs owner all" on faqs;
create policy "faqs owner all"
  on faqs for all to authenticated using (is_owner()) with check (is_owner());

-- ============================================================================
-- FAQS: EMBEDDINGS (Phase 3 — search by meaning)
-- ============================================================================
-- Each FAQ note gets a 384-number "meaning fingerprint" made by Supabase's
-- built-in gte-small model (see the embed-faqs Edge Function). Questions from
-- customers get the same kind of fingerprint, and the closest notes win.

create extension if not exists vector with schema extensions;

alter table faqs add column if not exists embedding extensions.vector(384);

-- If a note's wording changes, its old fingerprint no longer matches it, so
-- clear it. The embed-faqs function then rebuilds any note that has none.
create or replace function faqs_clear_embedding()
returns trigger
language plpgsql
as $$
begin
  if new.question is distinct from old.question
     or new.answer is distinct from old.answer then
    new.embedding = null;
  end if;
  return new;
end;
$$;

drop trigger if exists faqs_clear_embedding_trigger on faqs;
create trigger faqs_clear_embedding_trigger
  before update on faqs
  for each row execute function faqs_clear_embedding();

-- ============================================================================
-- FAQS: SEARCH BY MEANING (Phase 3)
-- ============================================================================
-- Given a customer's question as a fingerprint, returns the closest active
-- notes. "<=>" is pgvector's cosine distance (0 = identical meaning), so
-- "1 - distance" reads as a similarity score: closer to 1 means closer.
-- Runs as the caller (security invoker), so the same row-level-security
-- rules apply: visitors only ever get active notes.

create or replace function match_faqs(
  query_embedding extensions.vector(384),
  match_count integer default 3
)
returns table (id uuid, question text, answer text, similarity double precision)
language sql
stable
set search_path = public, extensions
as $$
  select f.id, f.question, f.answer, 1 - (f.embedding <=> query_embedding) as similarity
  from faqs f
  where f.active = true and f.embedding is not null
  order by f.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function match_faqs(extensions.vector, integer) to anon, authenticated;

-- ============================================================================
-- EMAIL TEMPLATES: pre-order wording
-- ============================================================================
-- Orders placed for a later date (pre-orders) now get their own emails.
-- Insert-only: if you have already edited these in the dashboard, nothing is
-- overwritten.

insert into email_templates (key, label, subject, body, placeholders) values
  (
    'new_order_customer_preorder',
    'New PRE-ORDER — to customer',
    'Pre-order {{order_number}} received for {{menu_date}} — Edelicacies',
    'Thanks, {{customer_name}}! We''ve received your pre-order {{order_number}} for {{menu_date}}. Your meal will be prepared fresh on that day, and delivery starts once it is ready. We''ll email you when your rider is on the way. Payment is confirmed on WhatsApp — we''ll message you shortly to sort that out.',
    '{{customer_name}}, {{order_number}}, {{menu_date}} (written like "Tuesday, 13 October"), {{total}}'
  ),
  (
    'new_order_owner_preorder',
    'New PRE-ORDER — to you',
    'New PRE-ORDER {{order_number}} for {{menu_date}} — {{total}}',
    'New pre-order for {{menu_date}} from {{customer_name}} ({{customer_phone}}).',
    '{{customer_name}}, {{customer_phone}}, {{order_number}}, {{menu_date}}, {{total}}, {{delivery_type}}'
  )
on conflict (key) do nothing;

-- ============================================================================
-- REVIEWS: open website reviews + reviews added by the owner
-- ============================================================================
-- Reviews used to require an order. Now a review can also come from the
-- website form (anyone) or be typed in by the owner. Website reviews always
-- start hidden (show_on_site = false) until the owner switches them on.

alter table reviews alter column order_id drop not null;

alter table reviews
  add column if not exists source text not null default 'order';

alter table reviews drop constraint if exists reviews_source_check;
alter table reviews
  add constraint reviews_source_check check (source in ('order', 'website', 'admin'));

-- Public review submission from the website form. The only thing it can do is
-- add one hidden review; it never reads or changes anything else.
create or replace function submit_public_review(
  p_name text,
  p_rating integer,
  p_comment text,
  p_website text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  -- "p_website" is a hidden form field only bots fill in.
  if coalesce(trim(p_website), '') <> '' then
    raise exception 'REJECTED';
  end if;
  if v_name is null then
    raise exception 'MISSING_NAME';
  end if;
  if char_length(v_name) > 80 then
    raise exception 'NAME_TOO_LONG';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'INVALID_RATING';
  end if;
  if v_comment is not null and char_length(v_comment) > 600 then
    raise exception 'COMMENT_TOO_LONG';
  end if;
  -- Simple flood guard: no more than 10 website reviews an hour in total.
  if (select count(*) from reviews
        where source = 'website' and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'TOO_MANY';
  end if;

  insert into reviews (order_id, customer_name, rating, comment, show_on_site, source)
  values (null, v_name, p_rating, v_comment, false, 'website');
end;
$$;

revoke all on function submit_public_review(text, integer, text, text) from public;
grant execute on function submit_public_review(text, integer, text, text) to anon, authenticated;

-- ============================================================================
-- MESSAGING (dashboard emails to customers / subscribers)
-- ============================================================================

-- Customers can now opt out of marketing email too (subscribers already could).
alter table customers add column if not exists unsubscribed boolean not null default false;

-- Public unsubscribe link for customers: only flips that one flag.
create or replace function unsubscribe_customer(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update customers set unsubscribed = true where id = p_id;
$$;

revoke all on function unsubscribe_customer(uuid) from public;
grant execute on function unsubscribe_customer(uuid) to anon, authenticated;

-- One row per message sent from Dashboard -> Messaging.
create table if not exists email_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sent_by text,
  subject text not null,
  body text not null,
  audience text not null,
  audience_label text,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  failed_list text
);

create index if not exists email_campaigns_created_idx on email_campaigns(created_at desc);

alter table email_campaigns enable row level security;
drop policy if exists "email_campaigns owner all" on email_campaigns;
create policy "email_campaigns owner all"
  on email_campaigns for all to authenticated using (is_owner()) with check (is_owner());

-- How many emails per day your email plan allows (Resend free plan = 100).
-- The Messaging page stops a broadcast that would use up the allowance and
-- starve order emails. Raise it here if you upgrade the plan.
insert into settings (key, value) values ('email_daily_limit', '{"limit": 100}')
on conflict (key) do nothing;

-- Photos you upload inside the email builder.
insert into storage.buckets (id, name, public)
values ('email-images', 'email-images', true)
on conflict (id) do nothing;

drop policy if exists "email-images public read" on storage.objects;
create policy "email-images public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'email-images');

drop policy if exists "email-images owner write" on storage.objects;
create policy "email-images owner write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'email-images' and is_owner());

drop policy if exists "email-images owner delete" on storage.objects;
create policy "email-images owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'email-images' and is_owner());

-- ============================================================================
-- ENQUIRIES (questions the assistant could not answer, sent to the owner)
-- ============================================================================
-- When the chat assistant doesn't know something, the customer can leave
-- their name and a phone number or email. The chat Edge Function saves it
-- here (using the service key) and emails the owner. Only the owner can read
-- or change these; the public cannot touch this table at all.

create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  contact text not null,
  message text not null,
  conversation text,
  status text not null default 'new' check (status in ('new', 'contacted', 'resolved')),
  note text
);

create index if not exists enquiries_created_idx on enquiries(created_at desc);
create index if not exists enquiries_status_idx on enquiries(status);

alter table enquiries enable row level security;
drop policy if exists "enquiries owner all" on enquiries;
create policy "enquiries owner all"
  on enquiries for all to authenticated using (is_owner()) with check (is_owner());

-- ============================================================================
-- CHAT ORDERS: the assistant can place an order that waits for owner approval
-- ============================================================================
-- Flow: customer chats -> assistant calls place_chat_order -> order is saved
-- as "pending_approval" (slots held) -> owner approves or rejects in the
-- dashboard -> approved orders move to "awaiting_payment" like any other.

-- Where an order came from.
alter table orders add column if not exists source text not null default 'website';
alter table orders drop constraint if exists orders_source_check;
alter table orders add constraint orders_source_check check (source in ('website', 'chat', 'owner'));

-- Allow the new "pending_approval" status. The old check constraint may have
-- any auto-generated name, so find it by what it checks and replace it.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%awaiting_payment%'
  loop
    execute format('alter table orders drop constraint %I', c.conname);
  end loop;
end $$;

alter table orders add constraint orders_status_check check (
  status in (
    'pending_approval', 'awaiting_payment', 'paid', 'preparing',
    'out_for_delivery', 'ready_for_pickup', 'delivered', 'cancelled'
  )
);

-- Called ONLY by the chat Edge Function (with the service key). It reuses
-- place_order() so prices still come from the database and slots are still
-- locked and decremented safely, then marks the order as a chat order that
-- needs approval.
create or replace function place_chat_order(
  p_menu_date date,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_delivery_type text,
  p_address_text text,
  p_note text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  v_result := place_order(
    p_menu_date, p_customer_name, p_customer_phone, p_customer_email,
    p_delivery_type, p_address_text, null, null, null, null, null, p_note, p_items
  );

  update orders
    set status = 'pending_approval', source = 'chat', auto_cancel_at = null
    where id = (v_result->>'order_id')::uuid;

  return v_result;
end;
$$;

revoke all on function place_chat_order(date, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function place_chat_order(date, text, text, text, text, text, text, jsonb) to service_role;

-- Owner approves a chat order: it becomes "awaiting_payment" and the usual
-- payment-hold timer starts. (Rejecting uses set_order_status -> cancelled,
-- which already gives the held slots back.)
create or replace function approve_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_hold integer;
begin
  -- Only the owner (or our own server functions using the service key) may
  -- change an order's stage. Without this, anyone who knew an order id could.
  if not (is_owner() or auth.role() = 'service_role') then
    raise exception 'NOT_ALLOWED';
  end if;

  select status into v_status from orders where id = p_order_id for update;
  if v_status is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_status <> 'pending_approval' then
    raise exception 'NOT_PENDING';
  end if;

  select coalesce((value->>'minutes')::integer, 120) into v_hold
    from settings where key = 'slot_hold_minutes';

  update orders
    set status = 'awaiting_payment',
        auto_cancel_at = now() + make_interval(mins => coalesce(v_hold, 120))
    where id = p_order_id;
end;
$$;

revoke all on function approve_order(uuid) from public, anon;
grant execute on function approve_order(uuid) to authenticated, service_role;

-- Email wording for chat orders (insert-only; never overwrites your edits).
insert into email_templates (key, label, subject, body, placeholders) values
  (
    'new_order_customer_pending',
    'Chat order received — to customer',
    'We received your order {{order_number}} — Edelicacies',
    'Thanks, {{customer_name}}! We''ve received your order {{order_number}} for {{menu_date}}. Our team is reviewing it and will message you on WhatsApp shortly with the payment details. Your items are being held for you.',
    '{{customer_name}}, {{order_number}}, {{menu_date}}, {{total}}'
  ),
  (
    'new_order_owner_pending',
    'Chat order waiting for approval — to you',
    'Order {{order_number}} is waiting for your approval — {{total}}',
    'A customer placed order {{order_number}} through the chat assistant: {{customer_name}} ({{customer_phone}}). Open Dashboard → Orders to approve or reject it.',
    '{{customer_name}}, {{customer_phone}}, {{order_number}}, {{menu_date}}, {{total}}, {{delivery_type}}'
  ),
  (
    'order_approved',
    'Order approved — to customer',
    'Your order {{order_number}} is approved — Edelicacies',
    'Hi {{customer_name}}, good news! Your order {{order_number}} has been approved. Our team will send you the payment details on WhatsApp now. Your items are held for you until payment is confirmed.',
    '{{customer_name}}, {{order_number}}, {{total}}'
  )
on conflict (key) do nothing;

-- ============================================================================
-- CUSTOMER ACCOUNTS (optional, passwordless: the customer logs in with a code
-- emailed to them). A logged-in customer is NOT the owner (see is_owner()).
-- ============================================================================

-- Which account placed the order (null for guests). Set by place_order().
alter table orders add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists orders_user_id_idx on orders(user_id);

-- A customer sees their OWN orders: ones placed while logged in, plus ones
-- placed as a guest with the same email address they just verified.
drop policy if exists "orders customer read own" on orders;
create policy "orders customer read own"
  on orders for select to authenticated
  using (
    user_id = auth.uid()
    or lower(customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "order_items customer read own" on order_items;
create policy "order_items customer read own"
  on order_items for select to authenticated
  using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (
          o.user_id = auth.uid()
          or lower(o.customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

-- Saved name and phone, one row per account.
create table if not exists customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists customer_profiles_set_updated_at on customer_profiles;
create trigger customer_profiles_set_updated_at
  before update on customer_profiles
  for each row execute function set_updated_at();

alter table customer_profiles enable row level security;
drop policy if exists "customer_profiles own" on customer_profiles;
create policy "customer_profiles own"
  on customer_profiles for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists "customer_profiles owner read" on customer_profiles;
create policy "customer_profiles owner read"
  on customer_profiles for select to authenticated using (is_owner());

-- Saved delivery addresses (home, office...).
create table if not exists customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Home',
  address_text text not null,
  lat numeric,
  lng numeric,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists customer_addresses_user_idx on customer_addresses(user_id);

alter table customer_addresses enable row level security;
drop policy if exists "customer_addresses own" on customer_addresses;
create policy "customer_addresses own"
  on customer_addresses for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists "customer_addresses owner read" on customer_addresses;
create policy "customer_addresses owner read"
  on customer_addresses for select to authenticated using (is_owner());

-- "Delete my saved details": removes the profile and addresses and detaches
-- the account from past orders (the orders themselves stay for your records).
create or replace function delete_my_account_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_ALLOWED';
  end if;
  delete from customer_addresses where user_id = auth.uid();
  delete from customer_profiles where user_id = auth.uid();
  update orders set user_id = null where user_id = auth.uid();
end;
$$;

revoke all on function delete_my_account_data() from public, anon;
grant execute on function delete_my_account_data() to authenticated;

-- A guest who just placed an order and then signs in can attach THAT order to
-- their new account. It needs the order number AND the phone number used on
-- it (the same two secrets the public tracking page asks for).
create or replace function claim_order(p_order_number text, p_phone text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'NOT_ALLOWED';
  end if;
  update orders
    set user_id = auth.uid()
    where order_number = p_order_number
      and customer_phone = p_phone
      and user_id is null;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function claim_order(text, text) from public, anon;
grant execute on function claim_order(text, text) to authenticated;

-- ============================================================================
-- CHAT CONVERSATIONS + OWNER TAKEOVER (Phase 4)
-- ============================================================================
-- Every website chat is saved here. Each conversation has a MODE:
--   'ai'    the assistant answers
--   'owner' you answer, and the assistant is never even called
-- The chat Edge Function (service key) writes customer/assistant messages.
-- Only the owner can read or change anything here from the dashboard; the
-- public has no access to these tables at all.

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  -- Secret the visitor's browser keeps, so only they can read/continue it.
  access_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  mode text not null default 'ai' check (mode in ('ai', 'owner')),
  handoff_reason text,
  handoff_at timestamptz,
  owner_unread boolean not null default false,
  last_owner_message_at timestamptz,
  owner_alerted_at timestamptz,
  last_preview text,
  last_role text,
  customer_name text,
  customer_contact text
);

create index if not exists conversations_last_idx on conversations(last_message_at desc);
create index if not exists conversations_unread_idx on conversations(owner_unread) where owner_unread;

create table if not exists chat_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'owner', 'system')),
  content text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conv_idx on chat_messages(conversation_id, id);

alter table conversations enable row level security;
alter table chat_messages enable row level security;

drop policy if exists "conversations owner all" on conversations;
create policy "conversations owner all"
  on conversations for all to authenticated using (is_owner()) with check (is_owner());
drop policy if exists "chat_messages owner all" on chat_messages;
create policy "chat_messages owner all"
  on chat_messages for all to authenticated using (is_owner()) with check (is_owner());

-- The owner types a reply. Sending a reply also takes the chat over, so the
-- assistant can never answer on top of you.
create or replace function owner_send_message(p_conversation_id uuid, p_content text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text text := btrim(coalesce(p_content, ''));
  v_id bigint;
  v_mode text;
begin
  if not is_owner() then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_text = '' then
    raise exception 'EMPTY_MESSAGE';
  end if;
  if char_length(v_text) > 2000 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;

  select mode into v_mode from conversations where id = p_conversation_id for update;
  if v_mode is null then
    raise exception 'CONVERSATION_NOT_FOUND';
  end if;

  if v_mode <> 'owner' then
    insert into chat_messages (conversation_id, role, content)
    values (p_conversation_id, 'system', 'A member of our team has joined the chat.');
  end if;

  insert into chat_messages (conversation_id, role, content)
  values (p_conversation_id, 'owner', v_text)
  returning id into v_id;

  update conversations
    set mode = 'owner',
        handoff_at = coalesce(handoff_at, now()),
        last_message_at = now(),
        updated_at = now(),
        last_preview = left(v_text, 140),
        last_role = 'owner',
        last_owner_message_at = now(),
        owner_unread = false
    where id = p_conversation_id;

  return v_id;
end;
$$;

revoke all on function owner_send_message(uuid, text) from public, anon;
grant execute on function owner_send_message(uuid, text) to authenticated;

-- "Take over" / "Hand back to AI".
create or replace function set_conversation_mode(p_conversation_id uuid, p_mode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
begin
  if not is_owner() then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_mode not in ('ai', 'owner') then
    raise exception 'INVALID_MODE';
  end if;

  select mode into v_current from conversations where id = p_conversation_id for update;
  if v_current is null then
    raise exception 'CONVERSATION_NOT_FOUND';
  end if;
  if v_current = p_mode then
    return;
  end if;

  if p_mode = 'owner' then
    insert into chat_messages (conversation_id, role, content)
    values (p_conversation_id, 'system', 'A member of our team has joined the chat.');
    update conversations
      set mode = 'owner', handoff_at = coalesce(handoff_at, now()), owner_unread = false,
          updated_at = now(), last_message_at = now(),
          last_preview = 'A member of our team has joined the chat.', last_role = 'system'
      where id = p_conversation_id;
  else
    insert into chat_messages (conversation_id, role, content)
    values (p_conversation_id, 'system', 'You are back with the Edelicacies assistant. Ask me anything.');
    update conversations
      set mode = 'ai', handoff_reason = null, handoff_at = null, owner_unread = false,
          updated_at = now(), last_message_at = now(),
          last_preview = 'You are back with the Edelicacies assistant.', last_role = 'system'
      where id = p_conversation_id;
  end if;
end;
$$;

revoke all on function set_conversation_mode(uuid, text) from public, anon;
grant execute on function set_conversation_mode(uuid, text) to authenticated;

-- ============================================================================
-- PHASE 5: USAGE LOG, SPENDING CAP, PER-VISITOR LIMITS
-- ============================================================================

-- One row for every time the assistant was asked to think: what it cost, how
-- long it took, and whether it failed. The monitoring page reads this.
create table if not exists ai_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  conversation_id uuid references conversations(id) on delete set null,
  kind text not null default 'chat' check (kind in ('chat', 'budget_stop')),
  model text,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  cost numeric not null default 0,
  latency_ms integer,
  ok boolean not null default true,
  error text
);

create index if not exists ai_usage_created_idx on ai_usage(created_at desc);

alter table ai_usage enable row level security;
drop policy if exists "ai_usage owner read" on ai_usage;
create policy "ai_usage owner read"
  on ai_usage for select to authenticated using (is_owner());
-- Writes come only from the chat Edge Function (service key).

-- Visitors are tracked by a one-way hash of their network address (never the
-- address itself), only so one person cannot flood the assistant.
alter table conversations add column if not exists ip_hash text;
alter table conversations add column if not exists ever_handed_off boolean not null default false;
alter table chat_messages add column if not exists ip_hash text;
create index if not exists conversations_ip_idx on conversations(ip_hash, created_at);
create index if not exists chat_messages_ip_idx on chat_messages(ip_hash, created_at);

-- Daily AI limits. When either is reached the assistant politely pauses for
-- the rest of the day and points people to WhatsApp. Change these any time.
-- usd: money the assistant may spend per day (OpenRouter reports the cost).
-- max_calls: how many AI answers per day (also protects the free-model limit).
insert into settings (key, value) values
  ('ai_daily_budget', '{"usd": 1, "max_calls": 400}')
on conflict (key) do nothing;

-- Per-visitor chat limits (change these any time; the defaults are shown).
-- chats_per_visitor_per_hour: new chats one visitor may start in an hour.
-- messages_per_visitor_per_10_min: messages one visitor may send in 10 minutes.
insert into settings (key, value) values
  ('chat_limits', '{"chats_per_visitor_per_hour": 8, "messages_per_visitor_per_10_min": 30}')
on conflict (key) do nothing;

-- ============================================================================
-- KNOWLEDGE GAPS: questions the assistant could not answer (kept for days)
-- ============================================================================
-- The chat function adds a row each time the assistant admits it does not
-- know. They stay for 14 days, you can mark one "done" (you added a note) or
-- delete it, and anything left expires on its own (cleaned up every night).

create table if not exists knowledge_gaps (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  conversation_id uuid references conversations(id) on delete set null,
  question text not null,
  bot_reply text,
  status text not null default 'open' check (status in ('open', 'done'))
);

create index if not exists knowledge_gaps_expires_idx on knowledge_gaps(expires_at);
create index if not exists knowledge_gaps_status_idx on knowledge_gaps(status, created_at desc);

alter table knowledge_gaps enable row level security;
drop policy if exists "knowledge_gaps owner all" on knowledge_gaps;
create policy "knowledge_gaps owner all"
  on knowledge_gaps for all to authenticated using (is_owner()) with check (is_owner());
-- Rows are written by the chat Edge Function (service key) only.

-- One-time catch-up: turn "I'm not sure" replies already in your saved chats
-- into gaps. Only runs while the table is empty, so deleting a gap on purpose
-- is never undone by re-running this file.
insert into knowledge_gaps (conversation_id, question, bot_reply, created_at)
select m.conversation_id, prev.content, m.content, m.created_at
from chat_messages m
join lateral (
  select p.content from chat_messages p
  where p.conversation_id = m.conversation_id and p.role = 'user' and p.id < m.id
  order by p.id desc limit 1
) prev on true
where m.role = 'assistant'
  and m.created_at > now() - interval '14 days'
  and m.content ~* '(not sure|don''t have|do not have|can''t confirm|cannot confirm|unable to)'
  and not exists (select 1 from knowledge_gaps);

-- Nightly clean-up of expired gaps (2am).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'edelicacies-clean-gaps') then
    perform cron.unschedule('edelicacies-clean-gaps');
  end if;
end $$;

select cron.schedule(
  'edelicacies-clean-gaps',
  '0 2 * * *',
  $$ delete from knowledge_gaps where expires_at < now(); $$
);

-- ============================================================================
-- PHASE 6: WHATSAPP (the second door into the same assistant)
-- ============================================================================
-- Safe to run before WhatsApp is connected: it only adds columns and indexes.
-- A conversation now has a channel: 'web' (the website chat box) or
-- 'whatsapp' (a customer chatting on the Edelicacies WhatsApp number).

alter table conversations add column if not exists channel text not null default 'web';
alter table conversations drop constraint if exists conversations_channel_check;
alter table conversations add constraint conversations_channel_check check (channel in ('web', 'whatsapp'));

-- The customer's WhatsApp number, digits only with country code (2348012345678).
alter table conversations add column if not exists wa_phone text;

-- One WhatsApp conversation per customer number: when the same person writes
-- again next week, the chat simply continues.
create unique index if not exists conversations_wa_phone_idx
  on conversations(wa_phone) where channel = 'whatsapp';

-- Meta's id for a message. Meta sometimes delivers the same message twice;
-- this unique index makes the second copy harmless, so nobody is answered twice.
alter table chat_messages add column if not exists wa_message_id text;
create unique index if not exists chat_messages_wamid_idx
  on chat_messages(wa_message_id) where wa_message_id is not null;

-- Which chat an order came from, so "order approved" can go back to that chat.
alter table orders add column if not exists conversation_id uuid references conversations(id) on delete set null;
create index if not exists orders_conversation_idx on orders(conversation_id) where conversation_id is not null;

-- WhatsApp settings the owner edits in Dashboard -> WhatsApp. NOT secret keys
-- (the access token, app secret and verify token stay in Supabase Secrets),
-- but the owner's personal number should not be public either, so this table
-- is owner-only. The whatsapp function reads it with the service key.
create table if not exists whatsapp_config (
  id boolean primary key default true check (id), -- exactly one row
  phone_number_id text,
  owner_alert_number text,
  template_order_confirmed text not null default 'order_confirmed',
  template_owner_alert text not null default 'owner_chat_alert',
  template_language text not null default 'en',
  updated_at timestamptz not null default now()
);
insert into whatsapp_config (id) values (true) on conflict (id) do nothing;

alter table whatsapp_config enable row level security;
drop policy if exists "whatsapp_config owner all" on whatsapp_config;
create policy "whatsapp_config owner all"
  on whatsapp_config for all to authenticated using (is_owner()) with check (is_owner());

-- WhatsApp assistant on/off. Off: customer messages still arrive in the
-- Inbox for the owner, but the assistant does not answer them. Everything
-- else (website chat, order updates, owner replies) is unchanged.
alter table whatsapp_config add column if not exists assistant_enabled boolean not null default true;

-- ============================================================================
-- PHASE 7: OWNER NUMBERS + ADMIN LOG
-- ============================================================================
-- Phone numbers allowed to use the owner (admin) tools on WhatsApp. The check
-- "is this sender an owner?" is done by CODE against this table, before the
-- assistant ever sees the message. A new number is 'pending' until the code
-- sent to it is confirmed, so a typo can never hand a stranger admin power.

create table if not exists owner_numbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,            -- digits only, with country code
  status text not null default 'pending' check (status in ('pending', 'active')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists owner_numbers_set_updated_at on owner_numbers;
create trigger owner_numbers_set_updated_at
  before update on owner_numbers
  for each row execute function set_updated_at();

alter table owner_numbers enable row level security;
-- The owner may READ the list. There is deliberately NO insert/update/delete
-- policy: every change goes through the functions below, which log it.
drop policy if exists "owner_numbers owner read" on owner_numbers;
create policy "owner_numbers owner read"
  on owner_numbers for select to authenticated using (is_owner());

-- Verification codes live apart, with no policy at all: the owner's browser
-- can never read a code (or its hash). Only the functions below can.
create table if not exists owner_number_codes (
  owner_number_id uuid primary key references owner_numbers(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  sent_at timestamptz not null default now()
);
alter table owner_number_codes enable row level security;

-- Every owner action (from the dashboard or WhatsApp) is written here.
create table if not exists admin_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor text not null,            -- e.g. 'dashboard: you@mail.com' or 'whatsapp: 2348012345678'
  action text not null,           -- e.g. 'owner_number.add'
  summary text not null,          -- one readable line
  before_value jsonb,
  after_value jsonb
);
create index if not exists admin_log_created_idx on admin_log(created_at desc);

alter table admin_log enable row level security;
drop policy if exists "admin_log owner read" on admin_log;
create policy "admin_log owner read"
  on admin_log for select to authenticated using (is_owner());
-- No write policy: rows are added only by security-definer functions and by
-- our Edge Functions (service key).

-- Who is acting right now, for the log.
create or replace function admin_actor()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select 'dashboard: ' || coalesce((select email from auth.users where id = auth.uid()), 'owner');
$$;
revoke all on function admin_actor() from public, anon;
grant execute on function admin_actor() to authenticated, service_role;

-- "08012345678" / "+234 801 234 5678" -> "2348012345678" (null if not a phone).
create or replace function normalize_phone(p text)
returns text
language plpgsql
immutable
as $$
declare
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if d like '0%' then d := '234' || substr(d, 2); end if;
  if length(d) < 10 or length(d) > 15 then return null; end if;
  return d;
end;
$$;

create or replace function add_owner_number(p_name text, p_phone text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := normalize_phone(p_phone);
  v_id uuid;
begin
  if not is_owner() then raise exception 'NOT_ALLOWED'; end if;
  if v_name = '' or char_length(v_name) > 60 then raise exception 'INVALID_NAME'; end if;
  if v_phone is null then raise exception 'INVALID_PHONE'; end if;
  if exists (select 1 from owner_numbers where phone = v_phone) then raise exception 'ALREADY_EXISTS'; end if;
  if (select count(*) from owner_numbers) >= 5 then raise exception 'TOO_MANY'; end if;

  insert into owner_numbers (name, phone) values (v_name, v_phone) returning id into v_id;
  insert into admin_log (actor, action, summary, after_value)
  values (admin_actor(), 'owner_number.add', 'Added owner number ' || v_name || ' (' || v_phone || ')',
          jsonb_build_object('name', v_name, 'phone', v_phone, 'status', 'pending'));
  return v_id;
end;
$$;

create or replace function rename_owner_number(p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_old text;
begin
  if not is_owner() then raise exception 'NOT_ALLOWED'; end if;
  if v_name = '' or char_length(v_name) > 60 then raise exception 'INVALID_NAME'; end if;
  select name into v_old from owner_numbers where id = p_id;
  if v_old is null then raise exception 'NOT_FOUND'; end if;
  update owner_numbers set name = v_name where id = p_id;
  insert into admin_log (actor, action, summary, before_value, after_value)
  values (admin_actor(), 'owner_number.rename', 'Renamed owner number ' || v_old || ' to ' || v_name,
          jsonb_build_object('name', v_old), jsonb_build_object('name', v_name));
end;
$$;

create or replace function remove_owner_number(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row owner_numbers;
begin
  if not is_owner() then raise exception 'NOT_ALLOWED'; end if;
  select * into v_row from owner_numbers where id = p_id;
  if v_row.id is null then raise exception 'NOT_FOUND'; end if;
  delete from owner_numbers where id = p_id;
  insert into admin_log (actor, action, summary, before_value)
  values (admin_actor(), 'owner_number.remove', 'Removed owner number ' || v_row.name || ' (' || v_row.phone || ')',
          jsonb_build_object('name', v_row.name, 'phone', v_row.phone, 'status', v_row.status));
end;
$$;

-- The code is made and sent by the whatsapp Edge Function (service key), which
-- stores only a hash here. The owner confirms it from the dashboard.
create or replace function confirm_owner_number(p_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row owner_number_codes;
  v_num owner_numbers;
  v_given text := encode(sha256(convert_to(p_id::text || btrim(coalesce(p_code, '')), 'UTF8')), 'hex');
begin
  if not is_owner() then raise exception 'NOT_ALLOWED'; end if;
  select * into v_num from owner_numbers where id = p_id;
  if v_num.id is null then raise exception 'NOT_FOUND'; end if;
  if v_num.status = 'active' then return true; end if;

  select * into v_row from owner_number_codes where owner_number_id = p_id for update;
  if v_row.owner_number_id is null then raise exception 'NO_CODE'; end if;
  if v_row.expires_at < now() then raise exception 'CODE_EXPIRED'; end if;
  if v_row.attempts >= 5 then raise exception 'TOO_MANY_ATTEMPTS'; end if;

  if v_row.code_hash <> v_given then
    update owner_number_codes set attempts = attempts + 1 where owner_number_id = p_id;
    return false;
  end if;

  update owner_numbers set status = 'active', verified_at = now() where id = p_id;
  delete from owner_number_codes where owner_number_id = p_id;
  insert into admin_log (actor, action, summary, after_value)
  values (admin_actor(), 'owner_number.verify', 'Verified owner number ' || v_num.name || ' (' || v_num.phone || ')',
          jsonb_build_object('status', 'active'));
  return true;
end;
$$;

-- Used by our Edge Functions only: is this phone number an ACTIVE owner?
create or replace function owner_name_for_phone(p_phone text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select name from owner_numbers where phone = normalize_phone(p_phone) and status = 'active' limit 1;
$$;

revoke all on function normalize_phone(text) from public;
grant execute on function normalize_phone(text) to authenticated, service_role;
revoke all on function add_owner_number(text, text) from public, anon;
grant execute on function add_owner_number(text, text) to authenticated;
revoke all on function rename_owner_number(uuid, text) from public, anon;
grant execute on function rename_owner_number(uuid, text) to authenticated;
revoke all on function remove_owner_number(uuid) from public, anon;
grant execute on function remove_owner_number(uuid) to authenticated;
revoke all on function confirm_owner_number(uuid, text) from public, anon;
grant execute on function confirm_owner_number(uuid, text) to authenticated;
revoke all on function owner_name_for_phone(text) from public, anon, authenticated;
grant execute on function owner_name_for_phone(text) to service_role;

-- Name of the approved WhatsApp template that carries the verification code.
alter table whatsapp_config add column if not exists template_owner_code text not null default 'owner_verification';

-- ============================================================================
-- PHASE 7 (step 2): EXACT NUMBERS FOR THE OWNER ASSISTANT
-- ============================================================================
-- The assistant never adds up or guesses. It asks these functions and reads
-- the answer out. They use the SAME rules as Dashboard -> Finances:
--   * a day means the order's menu_date (the day the meal is for)
--   * "sold" counts orders that are paid or further along (paid, preparing,
--     out for delivery, ready for pickup, delivered) plus manual/offline
--     sales (amount + delivery fee)
--   * cancelled orders are never counted
-- Callable by the owner (dashboard) and by our server functions (service key).

create or replace function owner_report(p_range text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_start date;
  v_end date;
  v_label text;
  v_committed text[] := array['paid', 'preparing', 'out_for_delivery', 'ready_for_pickup', 'delivered'];
  v_orders jsonb;
  v_sales jsonb;
  v_best jsonb;
  v_orders_total bigint;
  v_manual_total bigint;
begin
  if not (is_owner() or auth.role() = 'service_role') then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_range = 'today' then
    v_start := v_today; v_end := v_today; v_label := 'today';
  elsif p_range = 'yesterday' then
    v_start := v_today - 1; v_end := v_today - 1; v_label := 'yesterday';
  elsif p_range = 'week' then
    v_start := v_today - 6; v_end := v_today; v_label := 'the last 7 days';
  elsif p_range = 'month' then
    v_start := date_trunc('month', v_today)::date; v_end := v_today; v_label := 'this month';
  else
    raise exception 'INVALID_RANGE';
  end if;

  select jsonb_build_object(
    'not_cancelled', count(*) filter (where status <> 'cancelled'),
    'pending_approval', count(*) filter (where status = 'pending_approval'),
    'approved', count(*) filter (where status in ('awaiting_payment', 'paid', 'preparing', 'out_for_delivery', 'ready_for_pickup')),
    'delivered', count(*) filter (where status = 'delivered'),
    'cancelled', count(*) filter (where status = 'cancelled')
  ),
  coalesce(sum(total) filter (where status = any (v_committed)), 0)
  into v_orders, v_orders_total
  from orders
  where menu_date between v_start and v_end;

  select coalesce(sum(amount + delivery_fee), 0) into v_manual_total
  from manual_sales
  where sale_date between v_start and v_end;

  select jsonb_build_object(
    'total', v_orders_total + v_manual_total,
    'from_orders', v_orders_total,
    'from_manual_sales', v_manual_total,
    'awaiting_payment', coalesce(sum(total) filter (where status = 'awaiting_payment'), 0),
    'waiting_for_approval', coalesce(sum(total) filter (where status = 'pending_approval'), 0)
  ) into v_sales
  from orders
  where menu_date between v_start and v_end;

  select coalesce(jsonb_agg(row_to_json(b) order by b.quantity desc, b.name), '[]'::jsonb) into v_best
  from (
    select oi.item_name || ' (' || oi.variation_label || ')' as name,
           sum(oi.quantity)::int as quantity,
           sum(oi.quantity * oi.unit_price)::bigint as amount
    from order_items oi
    join orders o on o.id = oi.order_id
    where oi.menu_date between v_start and v_end
      and o.status = any (v_committed)
    group by 1
    order by 2 desc, 1
    limit 5
  ) b;

  return jsonb_build_object(
    'range', p_range, 'label', v_label, 'start', v_start, 'end', v_end,
    'orders', v_orders, 'sales', v_sales, 'best_sellers', v_best
  );
end;
$$;

create or replace function owner_orders(p_range text, p_status text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_start date;
  v_end date;
  v_rows jsonb;
begin
  if not (is_owner() or auth.role() = 'service_role') then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_range = 'today' then v_start := v_today; v_end := v_today;
  elsif p_range = 'yesterday' then v_start := v_today - 1; v_end := v_today - 1;
  elsif p_range = 'week' then v_start := v_today - 6; v_end := v_today;
  elsif p_range = 'month' then v_start := date_trunc('month', v_today)::date; v_end := v_today;
  else raise exception 'INVALID_RANGE';
  end if;

  select coalesce(jsonb_agg(row_to_json(r) order by r.created_at desc), '[]'::jsonb) into v_rows
  from (
    select order_number, customer_name, total, status, delivery_type, source, created_at
    from orders
    where menu_date between v_start and v_end
      and (p_status is null or status = p_status)
    order by created_at desc
    limit 25
  ) r;

  return jsonb_build_object('start', v_start, 'end', v_end, 'status_filter', p_status, 'orders', v_rows);
end;
$$;

revoke all on function owner_report(text) from public, anon;
grant execute on function owner_report(text) to authenticated, service_role;
revoke all on function owner_orders(text, text) from public, anon;
grant execute on function owner_orders(text, text) to authenticated, service_role;

-- ============================================================================
-- PHASE 7 (step 3): OWNER ACTIONS WITH CONFIRMATION
-- ============================================================================
-- The assistant never changes anything directly. It PROPOSES; this table holds
-- the proposal; the owner's next message "YES" (recognised by code) CONFIRMS
-- it. Because the proposal lives here, not in the AI's memory, "YES" always
-- means exactly the one stored action. A proposal expires after 5 minutes.
-- Only our Edge Functions (service key) can call these functions.

create table if not exists owner_pending_actions (
  id uuid primary key default gen_random_uuid(),
  actor text not null,                     -- 'dashboard: you@mail.com' or 'whatsapp: 2348...'
  kind text not null check (kind in ('set_sold_out', 'set_available', 'set_portions', 'approve_order', 'reject_order', 'set_price', 'set_prices', 'add_order', 'add_to_menu', 'remove_from_menu', 'take_over_chat', 'hand_back_chat')),
  params jsonb not null,                   -- already resolved to exact ids
  summary text not null,                   -- what the owner was told
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled', 'expired', 'failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  resolved_at timestamptz
);
create index if not exists owner_pending_actor_idx on owner_pending_actions(actor, status);
alter table owner_pending_actions enable row level security;
-- No policies: nobody but the service key can read or write this table.
-- (Older copies of this table only allowed four kinds: widen the list.)
alter table owner_pending_actions drop constraint if exists owner_pending_actions_kind_check;
alter table owner_pending_actions add constraint owner_pending_actions_kind_check
  check (kind in ('set_sold_out', 'set_available', 'set_portions', 'approve_order', 'reject_order', 'set_price', 'set_prices', 'add_order', 'add_to_menu', 'remove_from_menu', 'take_over_chat', 'hand_back_chat'));
-- Risky actions (many prices at once, a big price jump) need the owner's PIN
-- instead of a plain YES.
alter table owner_pending_actions add column if not exists needs_pin boolean not null default false;

-- ---------------------------------------------------------------------------
-- The owner PIN. Stored as a salted hash, never in plain text. Five wrong
-- tries lock it for 15 minutes. Only the functions below can touch this table.
-- ---------------------------------------------------------------------------
create table if not exists owner_security (
  id boolean primary key default true check (id),
  pin_salt text,
  pin_hash text,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
insert into owner_security (id) values (true) on conflict (id) do nothing;
alter table owner_security enable row level security;
-- No policies: not even the logged-in owner's browser can read it.

-- Internal check (no caller test: only other security-definer functions below
-- call it). Returns ok / wrong / locked / not_set.
create or replace function owner_pin_check(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v owner_security;
  v_failed integer;
  v_until timestamptz;
begin
  select * into v from owner_security where id for update;
  if v.pin_hash is null then return jsonb_build_object('status', 'not_set'); end if;
  if v.locked_until is not null and v.locked_until > now() then
    return jsonb_build_object('status', 'locked', 'until', v.locked_until);
  end if;
  if encode(sha256(convert_to(v.pin_salt || ':' || btrim(coalesce(p_pin, '')), 'UTF8')), 'hex') = v.pin_hash then
    update owner_security set failed_attempts = 0, locked_until = null where id;
    return jsonb_build_object('status', 'ok');
  end if;
  v_failed := v.failed_attempts + 1;
  if v_failed >= 5 then
    v_until := now() + interval '15 minutes';
    update owner_security set failed_attempts = 0, locked_until = v_until where id;
    return jsonb_build_object('status', 'locked', 'until', v_until);
  end if;
  update owner_security set failed_attempts = v_failed where id;
  return jsonb_build_object('status', 'wrong', 'attempts_left', 5 - v_failed);
end;
$$;
revoke all on function owner_pin_check(text) from public, anon, authenticated, service_role;

-- Set or change the PIN (the logged-in owner only). Changing an existing PIN
-- needs the current one.
create or replace function set_owner_pin(p_new text, p_current text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v owner_security;
  v_check jsonb;
  v_salt text := gen_random_uuid()::text;
begin
  if not is_owner() then raise exception 'NOT_ALLOWED'; end if;
  if p_new is null or p_new !~ '^[0-9]{4,6}$' then raise exception 'INVALID_PIN'; end if;
  select * into v from owner_security where id for update;
  if v.pin_hash is not null then
    v_check := owner_pin_check(p_current);
    if v_check->>'status' <> 'ok' then return v_check; end if;
  end if;
  update owner_security
     set pin_salt = v_salt,
         pin_hash = encode(sha256(convert_to(v_salt || ':' || p_new, 'UTF8')), 'hex'),
         failed_attempts = 0, locked_until = null, updated_at = now()
   where id;
  insert into admin_log (actor, action, summary)
  values (admin_actor(), 'owner_security.set_pin',
          case when v.pin_hash is null then 'Set the owner PIN' else 'Changed the owner PIN' end);
  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function owner_has_pin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_owner() and exists (select 1 from owner_security where id and pin_hash is not null);
$$;

revoke all on function set_owner_pin(text, text) from public, anon;
grant execute on function set_owner_pin(text, text) to authenticated;
revoke all on function owner_has_pin() from public, anon;
grant execute on function owner_has_pin() to authenticated;

-- Forgiving name match: "white rice and stew" finds "White Rice & Stew" and
-- "Rice and Stew (White)". Words like and / with / the are ignored; every other
-- word of the query must appear in the name (or one name contains the other).
create or replace function owner_name_match(p_name text, p_query text)
returns boolean
language plpgsql
immutable
as $$
declare
  n text := btrim(regexp_replace(lower(replace(coalesce(p_name, ''), '&', ' and ')), '[^a-z0-9]+', ' ', 'g'));
  q text := btrim(regexp_replace(lower(replace(coalesce(p_query, ''), '&', ' and ')), '[^a-z0-9]+', ' ', 'g'));
  stop text[] := array['and', 'with', 'the', 'a', 'of', 'in', 'on', 'to', 'for', 'please', 'add'];
  tok text;
  checked integer := 0;
begin
  if q = '' or n = '' then return false; end if;
  if n like '%' || q || '%' or q like '%' || n || '%' then return true; end if;
  for tok in select unnest(string_to_array(q, ' ')) loop
    if tok = '' or tok = any (stop) then continue; end if;
    checked := checked + 1;
    if position(tok in n) = 0 then return false; end if;
  end loop;
  return checked > 0;
end;
$$;
revoke all on function owner_name_match(text, text) from public, anon, authenticated, service_role;

-- What is on a day's menu (and what could be added), with exact figures.
create or replace function owner_menu(p_day text default 'today')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_date date;
  v_dm daily_menus;
  v_items jsonb;
  v_rest jsonb;
begin
  if not (is_owner() or auth.role() = 'service_role') then raise exception 'NOT_ALLOWED'; end if;
  v_date := case p_day when 'today' then v_today when 'tomorrow' then v_today + 1 else null end;
  if v_date is null then raise exception 'INVALID_DAY'; end if;
  select * into v_dm from daily_menus where menu_date = v_date;

  select coalesce(jsonb_agg(jsonb_build_object(
           'item', mi.name, 'category', mi.category, 'label', v.label, 'price', v.price,
           'slots_left', s.slots_left, 'slots_total', s.slots_total) order by mi.category, mi.name, v.sort_order, v.label), '[]'::jsonb)
    into v_items
    from daily_menu_slots s
    join daily_menus d on d.id = s.daily_menu_id
    join menu_items mi on mi.id = s.menu_item_id
    join menu_item_variations v on v.id = s.variation_id
   where d.menu_date = v_date;

  select coalesce(jsonb_agg(jsonb_build_object(
           'item', mi.name, 'category', mi.category, 'label', v.label, 'price', v.price)
           order by mi.category, mi.name, v.sort_order, v.label), '[]'::jsonb)
    into v_rest
    from menu_items mi
    join menu_item_variations v on v.menu_item_id = mi.id
   where mi.active
     and not exists (
       select 1 from daily_menu_slots s join daily_menus d on d.id = s.daily_menu_id
        where d.menu_date = v_date and s.variation_id = v.id);

  return jsonb_build_object('day', p_day, 'date', v_date, 'menu_exists', v_dm.id is not null,
                            'published', coalesce(v_dm.published, false),
                            'on_menu', v_items, 'not_on_menu', v_rest);
end;
$$;
revoke all on function owner_menu(text) from public, anon;
grant execute on function owner_menu(text) to authenticated, service_role;

-- Finds ONE customer chat from what the owner typed: a name, a phone number,
-- or "latest". Says exactly why if it cannot.
create or replace function owner_find_chat(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := btrim(coalesce(p_query, ''));
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  v_phone text := normalize_phone(p_query);
  v_ids uuid[];
  v_n integer;
  v_row record;
begin
  if v_q = '' then return jsonb_build_object('status', 'invalid', 'message', 'Whose chat? Give a name or a phone number.'); end if;

  if lower(v_q) in ('latest', 'last', 'newest', 'the latest', 'the last', 'latest chat', 'the latest chat', 'last chat', 'the last chat') then
    select array_agg(id) into v_ids from (select id from conversations order by last_message_at desc limit 1) x;
  elsif length(v_digits) >= 7 then
    select array_agg(id) into v_ids from (
      select id from conversations
       where wa_phone = v_phone
          or regexp_replace(coalesce(customer_contact, ''), '\D', '', 'g') like '%' || right(v_digits, 9)
       order by last_message_at desc limit 5) x;
  else
    select array_agg(id) into v_ids from (
      select id from conversations
       where customer_name is not null and owner_name_match(customer_name, v_q)
       order by last_message_at desc limit 5) x;
  end if;

  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n = 0 then
    return jsonb_build_object('status', 'not_found', 'message', 'I could not find a chat for "' || v_q || '". Try the phone number, or ask me which chats need you.');
  end if;
  if v_n > 1 then
    return jsonb_build_object('status', 'ambiguous', 'options',
      (select jsonb_agg(jsonb_build_object(
                'name', coalesce(c.customer_name, c.customer_contact, 'Website visitor'),
                'contact', c.customer_contact, 'channel', c.channel,
                'last_message_at', c.last_message_at, 'last', left(coalesce(c.last_preview, ''), 60))
              order by c.last_message_at desc)
         from conversations c where c.id = any (v_ids)));
  end if;

  select id, mode, channel, customer_contact, coalesce(customer_name, customer_contact, 'Website visitor') as name,
         left(coalesce(last_preview, ''), 80) as preview
    into v_row from conversations where id = v_ids[1];
  return jsonb_build_object('status', 'ok', 'conversation_id', v_row.id, 'name', v_row.name, 'mode', v_row.mode,
                            'channel', v_row.channel, 'contact', v_row.customer_contact, 'preview', v_row.preview);
end;
$$;
revoke all on function owner_find_chat(text) from public, anon, authenticated, service_role;

-- The chats the owner may care about, for the assistant to read out.
create or replace function owner_chats(p_filter text default 'needs_you')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not (is_owner() or auth.role() = 'service_role') then raise exception 'NOT_ALLOWED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', coalesce(c.customer_name, c.customer_contact, 'Website visitor'),
           'contact', c.customer_contact, 'channel', c.channel, 'mode', c.mode,
           'unread', c.owner_unread, 'reason', c.handoff_reason,
           'last', left(coalesce(c.last_preview, ''), 80), 'last_message_at', c.last_message_at)
           order by c.last_message_at desc), '[]'::jsonb)
    into v_rows
    from (select * from conversations
           where (p_filter = 'all' or mode = 'owner' or owner_unread)
           order by last_message_at desc limit 15) c;
  return jsonb_build_object('filter', p_filter, 'chats', v_rows);
end;
$$;
revoke all on function owner_chats(text) from public, anon;
grant execute on function owner_chats(text) to authenticated, service_role;

-- Finds ONE menu slot (an item + size on a published day) from words, or says
-- exactly why it cannot. Used by the phone-order flow.
create or replace function owner_resolve_menu_slot(p_item text, p_variation text, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_item text := btrim(coalesce(p_item, ''));
  v_var text := nullif(btrim(coalesce(p_variation, '')), '');
  v_names text[];
  v_name text;
  v_n integer;
  v_row record;
begin
  if v_item ~ '\(.+\)\s*$' then
    if v_var is null then v_var := nullif(btrim(substring(v_item from '\(([^()]*)\)\s*$')), ''); end if;
    v_item := btrim(regexp_replace(v_item, '\s*\([^()]*\)\s*$', ''));
  end if;
  if char_length(v_item) < 2 then
    return jsonb_build_object('status', 'invalid', 'message', 'Which item?');
  end if;

  select array_agg(distinct mi.name order by mi.name) into v_names
    from daily_menu_slots s
    join daily_menus d on d.id = s.daily_menu_id and d.published
    join menu_items mi on mi.id = s.menu_item_id
   where d.menu_date = p_date
     and owner_name_match(mi.name, v_item);
  if v_names is null then
    return jsonb_build_object('status', 'not_found', 'message', 'No item matching "' || v_item || '" is on that day''s menu.');
  end if;
  if array_length(v_names, 1) > 1 then
    select n into v_name from unnest(v_names) n where lower(n) = lower(v_item) limit 1;
    if v_name is null then return jsonb_build_object('status', 'ambiguous', 'options', to_jsonb(v_names)); end if;
  else
    v_name := v_names[1];
  end if;

  select count(*) into v_n
    from daily_menu_slots s
    join daily_menus d on d.id = s.daily_menu_id and d.published
    join menu_items mi on mi.id = s.menu_item_id
    join menu_item_variations v on v.id = s.variation_id
   where d.menu_date = p_date and mi.name = v_name and (v_var is null or v.label ilike '%' || v_var || '%');
  if v_n = 0 then
    return jsonb_build_object('status', 'not_found', 'message', 'No size matching "' || v_var || '" for ' || v_name || '.');
  end if;
  if v_n > 1 then
    return jsonb_build_object('status', 'ambiguous_size', 'item', v_name, 'options',
      (select jsonb_agg(v.label || ' (₦' || to_char(v.price, 'FM999,999,999') || ')' order by v.sort_order, v.label)
         from daily_menu_slots s
         join daily_menus d on d.id = s.daily_menu_id and d.published
         join menu_items mi on mi.id = s.menu_item_id
         join menu_item_variations v on v.id = s.variation_id
        where d.menu_date = p_date and mi.name = v_name and (v_var is null or v.label ilike '%' || v_var || '%')));
  end if;

  select s.id as slot_id, v.id as variation_id, mi.name as item, v.label, v.price, s.slots_left
    into v_row
    from daily_menu_slots s
    join daily_menus d on d.id = s.daily_menu_id and d.published
    join menu_items mi on mi.id = s.menu_item_id
    join menu_item_variations v on v.id = s.variation_id
   where d.menu_date = p_date and mi.name = v_name and (v_var is null or v.label ilike '%' || v_var || '%');
  return jsonb_build_object('status', 'ok', 'slot_id', v_row.slot_id, 'variation_id', v_row.variation_id,
                            'item', v_row.item, 'label', v_row.label, 'price', v_row.price, 'slots_left', v_row.slots_left);
end;
$$;
revoke all on function owner_resolve_menu_slot(text, text, date) from public, anon, authenticated, service_role;

create or replace function owner_propose_action(p_actor text, p_kind text, p_params jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_day text := coalesce(p_params->>'day', 'today');
  v_date date;
  v_item text := btrim(coalesce(p_params->>'item', ''));
  v_var text := nullif(btrim(coalesce(p_params->>'variation', '')), '');
  v_names text[];
  v_name text;
  v_slots jsonb;
  v_summary text;
  v_order orders;
  v_number text := upper(btrim(coalesce(p_params->>'order_number', '')));
  v_label text;
  v_id uuid;
  v_portions integer;
  v_changes jsonb;
  v_newp integer;
  v_pct numeric;
  v_cat text;
  v_contains text;
  v_total_sizes integer;
  v_pin boolean;
  v_count integer;
  v_log admin_log;
  v_line jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_res jsonb;
  v_qty integer;
  v_sub integer;
  v_fee integer;
  v_paid boolean;
  v_pm text;
  v_cname text;
  v_phone text;
  v_dtype text;
  v_addr text;
  v_note text;
  v_ch jsonb;
  v_ok boolean;
  v_row record;
  v_dry boolean;
  v_batch jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'NOT_ALLOWED'; end if;
  if btrim(coalesce(p_actor, '')) = '' then raise exception 'NO_ACTOR'; end if;

  -- "dry" = resolve only: used by the batch code below, never stored.
  v_dry := coalesce(p_params->>'dry', '') = 'true';

  -- ---- Several items in ONE request: one proposal, one YES ---------------
  if not v_dry and jsonb_typeof(p_params->'items') = 'array'
     and p_kind in ('set_sold_out', 'set_available', 'set_portions', 'add_to_menu') then
    if jsonb_array_length(p_params->'items') not between 1 and 20 then
      return jsonb_build_object('status', 'invalid', 'message', 'Give between 1 and 20 items at a time.');
    end if;
    v_day := coalesce(p_params->>'day', 'today');
    v_date := case v_day when 'today' then v_today when 'tomorrow' then v_today + 1 else null end;
    if v_date is null then return jsonb_build_object('status', 'invalid', 'message', 'The day must be today or tomorrow.'); end if;
    v_label := case when v_day = 'tomorrow' then 'tomorrow' else 'today' end;
    v_slots := '[]'::jsonb;
    v_lines := '[]'::jsonb;
    v_ok := false; -- will mean: a menu has to be created
    for v_line in select * from jsonb_array_elements(p_params->'items') loop
      v_res := owner_propose_action(p_actor, p_kind, jsonb_build_object(
        'item', v_line->>'item', 'variation', v_line->>'variation', 'day', v_day,
        'portions', coalesce(v_line->>'portions', p_params->>'portions'), 'dry', 'true'));
      if v_res->>'status' <> 'dry_ok' then
        return v_res || jsonb_build_object('failed_item', v_line->>'item');
      end if;
      if p_kind = 'add_to_menu' then
        v_lines := v_lines || jsonb_build_array(v_res->'add');
        if (v_res->>'no_menu')::boolean then v_ok := true; end if;
      else
        v_slots := v_slots || (v_res->'slots');
      end if;
    end loop;

    if p_kind = 'add_to_menu' then
      select jsonb_agg(e) into v_lines
        from (select distinct on (e->>'variation_id') e from jsonb_array_elements(v_lines) e) x;
      select 'Add ' || jsonb_array_length(v_lines) || case when jsonb_array_length(v_lines) = 1 then ' item' else ' items' end
             || ' to ' || v_label || '''s menu: '
             || string_agg((e->>'item') || ' (' || (e->>'label') || ', ₦' || to_char((e->>'price')::int, 'FM999,999,999')
                           || ') x ' || (e->>'portions') || ' portions', '; ')
             || '.' || case when v_ok then ' There is no menu for ' || v_label || ' yet, so one will be created and published (customers will see it).' else '' end
        into v_summary from jsonb_array_elements(v_lines) e;
      update owner_pending_actions set status = 'cancelled', resolved_at = now() where actor = p_actor and status = 'pending';
      insert into owner_pending_actions (actor, kind, params, summary)
      values (p_actor, 'add_to_menu', jsonb_build_object('date', v_date, 'adds', v_lines), v_summary)
      returning id into v_id;
    else
      select jsonb_agg(e) into v_slots
        from (select distinct on (e->>'slot_id') e from jsonb_array_elements(v_slots) e) x;
      select case p_kind when 'set_sold_out' then 'Mark ' || jsonb_array_length(v_slots) || ' items sold out for '
                         when 'set_available' then 'Make ' || jsonb_array_length(v_slots) || ' items available again for '
                         else 'Set ' || jsonb_array_length(v_slots) || ' items to their new portions for ' end
             || v_label || ': '
             || string_agg((e->>'item') || ' (' || (e->>'label') || ')'
                           || case p_kind when 'set_portions' then ' to ' || (e->>'to_left') || ' left'
                                          when 'set_available' then ' to ' || (e->>'to_left') || ' left'
                                          else ' (now ' || (e->>'from_left') || ' left)' end, '; ')
             || '.'
        into v_summary from jsonb_array_elements(v_slots) e;
      update owner_pending_actions set status = 'cancelled', resolved_at = now() where actor = p_actor and status = 'pending';
      insert into owner_pending_actions (actor, kind, params, summary)
      values (p_actor, p_kind, jsonb_build_object('date', v_date, 'slots', v_slots), v_summary)
      returning id into v_id;
    end if;
    return jsonb_build_object('status', 'pending', 'action_id', v_id, 'summary', v_summary, 'needs_pin', false);
  end if;

  -- Only one open proposal per person: a new one replaces the old.
  if not v_dry then
    update owner_pending_actions set status = 'cancelled', resolved_at = now()
     where actor = p_actor and status = 'pending';
  end if;

  if p_kind in ('set_sold_out', 'set_available', 'set_portions') then
    if p_kind = 'set_portions' then
      begin
        v_portions := (p_params->>'portions')::integer;
      exception when others then
        v_portions := null;
      end;
      if v_portions is null or v_portions < 0 or v_portions > 500 then
        return jsonb_build_object('status', 'invalid', 'message', 'How many portions? Give a whole number from 0 to 500.');
      end if;
    end if;
    -- "Chicken Curry Sauce with Steamed Rice (Regular)": the size in brackets is
    -- the variation, not part of the dish name.
    if v_item ~ '\(.+\)\s*$' then
      if v_var is null then
        v_var := nullif(btrim(substring(v_item from '\(([^()]*)\)\s*$')), '');
      end if;
      v_item := btrim(regexp_replace(v_item, '\s*\([^()]*\)\s*$', ''));
    end if;
    v_date := case v_day when 'today' then v_today when 'tomorrow' then v_today + 1 else null end;
    if v_date is null then return jsonb_build_object('status', 'invalid', 'message', 'The day must be today or tomorrow.'); end if;
    if char_length(v_item) < 2 then return jsonb_build_object('status', 'invalid', 'message', 'Which item?'); end if;
    v_label := case when v_day = 'tomorrow' then 'tomorrow' else 'today' end;

    select array_agg(distinct mi.name order by mi.name) into v_names
      from daily_menu_slots s
      join daily_menus d on d.id = s.daily_menu_id
      join menu_items mi on mi.id = s.menu_item_id
     where d.menu_date = v_date
       and owner_name_match(mi.name, v_item);

    if v_names is null then
      return jsonb_build_object('status', 'not_found',
        'message', 'No item matching "' || v_item || '" is on the menu for ' || v_label || '.');
    end if;
    if array_length(v_names, 1) > 1 then
      select n into v_name from unnest(v_names) n where lower(n) = lower(v_item) limit 1;
      if v_name is null then
        return jsonb_build_object('status', 'ambiguous', 'options', to_jsonb(v_names));
      end if;
    else
      v_name := v_names[1];
    end if;

    select jsonb_agg(jsonb_build_object(
             'slot_id', s.id, 'item', mi.name, 'label', v.label,
             'from_left', s.slots_left,
             'from_total', s.slots_total,
             'to_total', case when p_kind = 'set_portions' then greatest(s.slots_total, v_portions) else s.slots_total end,
             'to_left', case
               when p_kind = 'set_sold_out' then 0
               when p_kind = 'set_portions' then v_portions
               else least(s.slots_total, coalesce((
                      select (e->>'slots_left')::int
                        from admin_log l, jsonb_array_elements(l.before_value->'slots') e
                       where l.action = 'owner_action.set_sold_out'
                         and e->>'slot_id' = s.id::text
                       order by l.id desc limit 1), s.slots_total))
             end) order by v.sort_order, v.label)
      into v_slots
      from daily_menu_slots s
      join daily_menus d on d.id = s.daily_menu_id
      join menu_items mi on mi.id = s.menu_item_id
      join menu_item_variations v on v.id = s.variation_id
     where d.menu_date = v_date
       and mi.name = v_name
       and (v_var is null or v.label ilike '%' || v_var || '%')
       and (case
              when p_kind = 'set_sold_out' then s.slots_left > 0
              when p_kind = 'set_portions' then (s.slots_left <> v_portions or s.slots_total < v_portions)
              else (s.slots_left = 0 and s.slots_total > 0)
            end);

    if v_slots is null then
      -- nothing to change: explain why
      if exists (
        select 1 from daily_menu_slots s join daily_menus d on d.id = s.daily_menu_id
          join menu_items mi on mi.id = s.menu_item_id join menu_item_variations v on v.id = s.variation_id
         where d.menu_date = v_date and mi.name = v_name and (v_var is null or v.label ilike '%' || v_var || '%')
      ) then
        return jsonb_build_object('status', 'no_change', 'message',
          case when p_kind = 'set_sold_out'
               then v_name || ' is already sold out for ' || v_label || '.'
               when p_kind = 'set_portions'
               then v_name || ' already has ' || v_portions || ' portions left for ' || v_label || '.'
               else v_name || ' is already available for ' || v_label || '.' end);
      end if;
      return jsonb_build_object('status', 'not_found',
        'message', 'No size matching "' || v_var || '" for ' || v_name || ' on the ' || v_label || ' menu.');
    end if;

    if p_kind = 'set_portions' then
      select 'Set ' || v_name || ' (' || string_agg(e->>'label', ', ') || ') to ' || v_portions
             || ' portions left for ' || v_label || ' (now: ' || string_agg(e->>'from_left', ', ') || ' left).'
             || case when bool_or((e->>'to_total')::int > (e->>'from_total')::int)
                     then ' The total for the day also rises to ' || v_portions || '.' else '' end
        into v_summary
        from jsonb_array_elements(v_slots) e;
    else
    select
      case when p_kind = 'set_sold_out' then 'Mark ' else 'Make ' end
      || v_name || ' (' || string_agg(e->>'label', ', ') || ')'
      || case when p_kind = 'set_sold_out' then ' sold out for ' else ' available again for ' end || v_label || '. '
      || case when p_kind = 'set_sold_out' then 'Remaining portions will be set to 0 (now: '
              else 'Remaining portions will be set to ' end
      || string_agg(
           case when p_kind = 'set_sold_out' then (e->>'from_left') else (e->>'label') || ': ' || (e->>'to_left') end,
           ', ')
      || case when p_kind = 'set_sold_out' then ' left).' else '.' end
      into v_summary
      from jsonb_array_elements(v_slots) e;
    end if;

    if v_dry then
      return jsonb_build_object('status', 'dry_ok', 'slots', v_slots, 'summary', v_summary);
    end if;
    insert into owner_pending_actions (actor, kind, params, summary)
    values (p_actor, p_kind, jsonb_build_object('date', v_date, 'slots', v_slots), v_summary)
    returning id into v_id;
    return jsonb_build_object('status', 'pending', 'action_id', v_id, 'summary', v_summary);

  elsif p_kind in ('approve_order', 'reject_order') then
    if v_number = '' then return jsonb_build_object('status', 'invalid', 'message', 'Which order number?'); end if;
    select * into v_order from orders where order_number = v_number;
    if v_order.id is null then
      return jsonb_build_object('status', 'not_found', 'message', 'There is no order ' || v_number || '.');
    end if;
    -- Rejecting normally applies to orders waiting for approval. Orders the
    -- owner added by phone can also be cancelled (to undo a mistake) until
    -- they are on their way.
    if not (v_order.status = 'pending_approval'
            or (p_kind = 'reject_order' and v_order.source = 'owner'
                and v_order.status in ('awaiting_payment', 'paid', 'preparing'))) then
      return jsonb_build_object('status', 'no_change', 'message',
        'Order ' || v_number || ' is not waiting for approval (it is ' || replace(v_order.status, '_', ' ') || ').');
    end if;

    v_summary := case when p_kind = 'approve_order' then 'Approve ' else 'Reject ' end
      || 'order ' || v_order.order_number || ' for ' || v_order.customer_name
      || ', ₦' || to_char(v_order.total, 'FM999,999,999') || ' (' || replace(v_order.delivery_type, 'dispatch', 'delivery') || ', via ' || v_order.source || '). '
      || case when p_kind = 'approve_order'
              then 'It moves to awaiting payment and the customer is told.'
              else 'It is cancelled, the held portions go back on the menu and the customer is told.' end;

    insert into owner_pending_actions (actor, kind, params, summary)
    values (p_actor, p_kind,
            jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'from_status', v_order.status),
            v_summary)
    returning id into v_id;
    return jsonb_build_object('status', 'pending', 'action_id', v_id, 'summary', v_summary);

  elsif p_kind in ('set_price', 'set_prices') then
    if p_kind = 'set_price' then
      begin
        v_newp := (p_params->>'price')::integer;
      exception when others then
        v_newp := null;
      end;
      if v_newp is null or v_newp < 1 or v_newp > 500000 then
        return jsonb_build_object('status', 'invalid', 'message', 'Give the new price as a whole number of naira, from ₦1 to ₦500,000.');
      end if;
      if v_item ~ '\(.+\)\s*$' then
        if v_var is null then v_var := nullif(btrim(substring(v_item from '\(([^()]*)\)\s*$')), ''); end if;
        v_item := btrim(regexp_replace(v_item, '\s*\([^()]*\)\s*$', ''));
      end if;
      if char_length(v_item) < 2 then return jsonb_build_object('status', 'invalid', 'message', 'Which item?'); end if;

      select array_agg(distinct mi.name order by mi.name) into v_names
        from menu_items mi
       where mi.active and owner_name_match(mi.name, v_item);
      if v_names is null then
        return jsonb_build_object('status', 'not_found', 'message', 'No menu item matches "' || v_item || '".');
      end if;
      if array_length(v_names, 1) > 1 then
        select n into v_name from unnest(v_names) n where lower(n) = lower(v_item) limit 1;
        if v_name is null then return jsonb_build_object('status', 'ambiguous', 'options', to_jsonb(v_names)); end if;
      else
        v_name := v_names[1];
      end if;

      select count(*) into v_total_sizes
        from menu_items mi join menu_item_variations v on v.menu_item_id = mi.id
       where mi.active and mi.name = v_name and (v_var is null or v.label ilike '%' || v_var || '%');
      if v_total_sizes = 0 then
        return jsonb_build_object('status', 'not_found', 'message', 'No size matching "' || v_var || '" for ' || v_name || '.');
      end if;
      if v_var is null and v_total_sizes > 1 then
        return jsonb_build_object('status', 'ambiguous_size', 'item', v_name, 'options',
          (select jsonb_agg(v.label || ' (₦' || to_char(v.price, 'FM999,999,999') || ')' order by v.sort_order, v.label)
             from menu_items mi join menu_item_variations v on v.menu_item_id = mi.id
            where mi.active and mi.name = v_name));
      end if;

      select jsonb_agg(jsonb_build_object('variation_id', v.id, 'item', mi.name, 'label', v.label,
                                          'old_price', v.price, 'new_price', v_newp) order by v.sort_order, v.label)
        into v_changes
        from menu_items mi join menu_item_variations v on v.menu_item_id = mi.id
       where mi.active and mi.name = v_name and (v_var is null or v.label ilike '%' || v_var || '%')
         and v.price <> v_newp;
      if v_changes is null then
        return jsonb_build_object('status', 'no_change', 'message', v_name || ' already costs ₦' || to_char(v_newp, 'FM999,999,999') || '.');
      end if;

    else
      begin
        v_pct := (p_params->>'percent')::numeric;
      exception when others then
        v_pct := null;
      end;
      if v_pct is null or v_pct = 0 or v_pct < -50 or v_pct > 100 then
        return jsonb_build_object('status', 'invalid', 'message', 'Give a percentage between -50 and 100 (for example 10 to raise prices by 10%).');
      end if;
      v_cat := nullif(lower(btrim(coalesce(p_params->>'category', ''))), '');
      if v_cat is not null and v_cat not in ('food', 'drink') then
        return jsonb_build_object('status', 'invalid', 'message', 'The category must be food or drink.');
      end if;
      v_contains := nullif(btrim(coalesce(p_params->>'name_contains', '')), '');

      select jsonb_agg(jsonb_build_object('variation_id', v.id, 'item', mi.name, 'label', v.label,
                                          'old_price', v.price,
                                          'new_price', greatest(50, (round(v.price * (1 + v_pct / 100) / 50) * 50)::integer))
                       order by mi.name, v.sort_order, v.label)
        into v_changes
        from menu_items mi join menu_item_variations v on v.menu_item_id = mi.id
       where mi.active
         and (v_cat is null or mi.category = v_cat)
         and (v_contains is null or mi.name ilike '%' || v_contains || '%')
         and greatest(50, (round(v.price * (1 + v_pct / 100) / 50) * 50)::integer) <> v.price;
      if v_changes is null then
        return jsonb_build_object('status', 'no_change', 'message', 'No prices would change with that.');
      end if;
      if jsonb_array_length(v_changes) > 60 then
        return jsonb_build_object('status', 'invalid', 'message', 'That would change more than 60 prices. Narrow it down (a category or part of a name).');
      end if;
    end if;

    v_count := jsonb_array_length(v_changes);
    -- Risky = more than one price at once, or any price moving by more than 25%.
    select v_count > 1 or bool_or(abs((e->>'new_price')::numeric - (e->>'old_price')::numeric) > 0.25 * (e->>'old_price')::numeric)
      into v_pin from jsonb_array_elements(v_changes) e;

    select case when v_count = 1 then 'Change the price of ' else 'Change ' || v_count || ' prices: ' end
           || string_agg(
                (e->>'item') || ' (' || (e->>'label') || ') ₦' || to_char((e->>'old_price')::int, 'FM999,999,999')
                || ' to ₦' || to_char((e->>'new_price')::int, 'FM999,999,999'),
                '; ' order by ord)
           || case when v_count > 8 then ' and ' || (v_count - 8) || ' more' else '' end
           || '. New orders use the new prices; orders already placed keep theirs.'
           || case when v_pin then ' This needs your PIN.' else '' end
      into v_summary
      from (select e, ord from jsonb_array_elements(v_changes) with ordinality as t(e, ord) where ord <= 8) x;

    insert into owner_pending_actions (actor, kind, params, summary, needs_pin)
    values (p_actor, p_kind, jsonb_build_object('changes', v_changes), v_summary, v_pin)
    returning id into v_id;
    return jsonb_build_object('status', 'pending', 'action_id', v_id, 'summary', v_summary, 'needs_pin', v_pin);

  elsif p_kind = 'add_order' then
    v_cname := btrim(coalesce(p_params->>'customer_name', ''));
    v_phone := btrim(coalesce(p_params->>'phone', ''));
    v_dtype := lower(btrim(coalesce(p_params->>'delivery_type', '')));
    v_addr := btrim(coalesce(p_params->>'address', ''));
    v_pm := nullif(btrim(coalesce(p_params->>'payment_method', '')), '');
    v_note := nullif(btrim(coalesce(p_params->>'note', '')), '');
    v_paid := lower(coalesce(p_params->>'paid', 'false')) in ('true', 'yes', 'paid', '1');
    begin
      v_fee := coalesce(nullif(p_params->>'delivery_fee', '')::integer, 0);
    exception when others then
      v_fee := -1;
    end;
    v_date := case coalesce(p_params->>'day', 'today') when 'today' then v_today when 'tomorrow' then v_today + 1 else null end;
    v_label := case when coalesce(p_params->>'day', 'today') = 'tomorrow' then 'tomorrow' else 'today' end;

    if char_length(v_cname) < 2 then return jsonb_build_object('status', 'invalid', 'message', 'What is the customer''s name?'); end if;
    if normalize_phone(v_phone) is null then return jsonb_build_object('status', 'invalid', 'message', 'That does not look like a phone number.'); end if;
    if v_dtype not in ('delivery', 'pickup') then return jsonb_build_object('status', 'invalid', 'message', 'Is it delivery or pickup?'); end if;
    if v_dtype = 'delivery' and char_length(v_addr) < 6 then return jsonb_build_object('status', 'invalid', 'message', 'What is the delivery address?'); end if;
    if v_fee < 0 or v_fee > 50000 then return jsonb_build_object('status', 'invalid', 'message', 'The delivery fee must be a whole number of naira, up to ₦50,000.'); end if;
    if v_date is null then return jsonb_build_object('status', 'invalid', 'message', 'The day must be today or tomorrow.'); end if;
    if jsonb_typeof(p_params->'items') <> 'array' or jsonb_array_length(p_params->'items') not between 1 and 10 then
      return jsonb_build_object('status', 'invalid', 'message', 'Give between 1 and 10 items.');
    end if;
    if v_dtype = 'pickup' then v_fee := 0; end if;

    for v_line in select * from jsonb_array_elements(p_params->'items') loop
      begin
        v_qty := (v_line->>'quantity')::integer;
      exception when others then
        v_qty := null;
      end;
      if v_qty is null or v_qty < 1 or v_qty > 50 then
        return jsonb_build_object('status', 'invalid', 'message', 'Each quantity must be a whole number from 1 to 50.');
      end if;
      v_res := owner_resolve_menu_slot(v_line->>'item', v_line->>'variation', v_date);
      if v_res->>'status' <> 'ok' then return v_res; end if;
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'slot_id', v_res->>'slot_id', 'variation_id', v_res->>'variation_id', 'item', v_res->>'item',
        'label', v_res->>'label', 'unit_price', (v_res->>'price')::integer, 'quantity', v_qty));
    end loop;

    -- the same item twice must still fit in what is left
    select bool_and(t.qty <= s.slots_left) into v_ok
      from (select (e->>'slot_id')::uuid as slot_id, sum((e->>'quantity')::integer) as qty
              from jsonb_array_elements(v_lines) e group by 1) t
      join daily_menu_slots s on s.id = t.slot_id;
    if not coalesce(v_ok, false) then
      return jsonb_build_object('status', 'sold_out', 'message',
        'Not enough portions left for that. Check today''s menu, or set more portions first.');
    end if;

    select coalesce(sum((e->>'unit_price')::integer * (e->>'quantity')::integer), 0) into v_sub
      from jsonb_array_elements(v_lines) e;

    select 'Add a phone order for ' || v_cname || ' (' || v_phone || ') for ' || v_label || ': '
           || string_agg((e->>'quantity') || ' x ' || (e->>'item') || ' (' || (e->>'label') || ') ₦'
                         || to_char((e->>'unit_price')::int * (e->>'quantity')::int, 'FM999,999,999'), '; ')
           || '. ' || case when v_dtype = 'delivery'
                           then 'Delivery to ' || v_addr || case when v_fee > 0 then ' (fee ₦' || to_char(v_fee, 'FM999,999,999') || ')' else ' (no fee entered)' end
                           else 'Pickup' end
           || '. Total ₦' || to_char(v_sub + v_fee, 'FM999,999,999') || '. '
           || case when v_paid then 'Marked PAID' || coalesce(' by ' || v_pm, '') else 'Not yet paid' end
           || '. Added by owner.'
      into v_summary
      from jsonb_array_elements(v_lines) e;

    insert into owner_pending_actions (actor, kind, params, summary)
    values (p_actor, 'add_order',
            jsonb_build_object('date', v_date, 'customer_name', v_cname, 'phone', v_phone, 'delivery_type', v_dtype,
                               'address', case when v_dtype = 'delivery' then v_addr else null end,
                               'delivery_fee', v_fee, 'paid', v_paid, 'payment_method', v_pm, 'note', v_note,
                               'lines', v_lines, 'expected_total', v_sub + v_fee),
            v_summary)
    returning id into v_id;
    return jsonb_build_object('status', 'pending', 'action_id', v_id, 'summary', v_summary, 'needs_pin', false);

  elsif p_kind in ('take_over_chat', 'hand_back_chat') then
    v_res := owner_find_chat(p_params->>'customer');
    if v_res->>'status' <> 'ok' then return v_res; end if;
    if p_kind = 'take_over_chat' and v_res->>'mode' = 'owner' then
      return jsonb_build_object('status', 'no_change', 'message',
        'You already have ' || (v_res->>'name') || '''s chat: the assistant is not replying to this customer.');
    end if;
    if p_kind = 'hand_back_chat' and v_res->>'mode' = 'ai' then
      return jsonb_build_object('status', 'no_change', 'message',
        (v_res->>'name') || '''s chat is already with the assistant.');
    end if;
    v_summary := case when p_kind = 'take_over_chat'
        then 'Take over the chat with ' || (v_res->>'name') || ' (' || (v_res->>'channel') || '). Last message: "' || (v_res->>'preview')
             || '". The assistant will stop replying to this customer until you hand the chat back.'
        else 'Hand ' || (v_res->>'name') || '''s chat back to the assistant (' || (v_res->>'channel')
             || '). It will answer the customer''s next message.' end;
    insert into owner_pending_actions (actor, kind, params, summary)
    values (p_actor, p_kind,
            jsonb_build_object('conversation_id', v_res->>'conversation_id', 'name', v_res->>'name',
                               'channel', v_res->>'channel', 'from_mode', v_res->>'mode'),
            v_summary)
    returning id into v_id;
    return jsonb_build_object('status', 'pending', 'action_id', v_id, 'summary', v_summary, 'needs_pin', false);

  elsif p_kind in ('add_to_menu', 'remove_from_menu') then
    v_date := case v_day when 'today' then v_today when 'tomorrow' then v_today + 1 else null end;
    if v_date is null then return jsonb_build_object('status', 'invalid', 'message', 'The day must be today or tomorrow.'); end if;
    v_label := case when v_day = 'tomorrow' then 'tomorrow' else 'today' end;
    if v_item ~ '\(.+\)\s*$' then
      if v_var is null then v_var := nullif(btrim(substring(v_item from '\(([^()]*)\)\s*$')), ''); end if;
      v_item := btrim(regexp_replace(v_item, '\s*\([^()]*\)\s*$', ''));
    end if;
    if char_length(v_item) < 2 then return jsonb_build_object('status', 'invalid', 'message', 'Which item?'); end if;

    if p_kind = 'remove_from_menu' then
      v_res := owner_resolve_menu_slot(v_item, v_var, v_date);
      if v_res->>'status' <> 'ok' then return v_res; end if;
      v_summary := 'Remove ' || (v_res->>'item') || ' (' || (v_res->>'label') || ') from ' || v_label || '''s menu'
                   || ' (' || (v_res->>'slots_left') || ' portions left will no longer be offered). Orders already placed are not affected. This needs your PIN.';
      insert into owner_pending_actions (actor, kind, params, summary, needs_pin)
      values (p_actor, 'remove_from_menu',
              jsonb_build_object('date', v_date, 'slot_id', v_res->>'slot_id', 'item', v_res->>'item',
                                 'label', v_res->>'label', 'slots_left', (v_res->>'slots_left')::int),
              v_summary, true)
      returning id into v_id;
      return jsonb_build_object('status', 'pending', 'action_id', v_id, 'summary', v_summary, 'needs_pin', true);
    end if;

    -- add_to_menu: an existing (active) menu item goes onto that day's menu
    begin
      v_portions := (p_params->>'portions')::integer;
    exception when others then
      v_portions := null;
    end;
    if v_portions is null or v_portions < 1 or v_portions > 500 then
      return jsonb_build_object('status', 'invalid', 'message', 'How many portions? Give a whole number from 1 to 500.');
    end if;
    select array_agg(distinct mi.name order by mi.name) into v_names
      from menu_items mi where mi.active and owner_name_match(mi.name, v_item);
    if v_names is null then
      return jsonb_build_object('status', 'not_found', 'message',
        '"' || v_item || '" is not in your menu items. Add it under Menu Items in the dashboard first.');
    end if;
    if array_length(v_names, 1) > 1 then
      select n into v_name from unnest(v_names) n where lower(n) = lower(v_item) limit 1;
      if v_name is null then return jsonb_build_object('status', 'ambiguous', 'options', to_jsonb(v_names)); end if;
    else
      v_name := v_names[1];
    end if;
    select count(*) into v_total_sizes
      from menu_items mi join menu_item_variations v on v.menu_item_id = mi.id
     where mi.active and mi.name = v_name and (v_var is null or v.label ilike '%' || v_var || '%');
    if v_total_sizes = 0 then
      return jsonb_build_object('status', 'not_found', 'message', 'No size matching "' || v_var || '" for ' || v_name || '.');
    end if;
    if v_total_sizes > 1 then
      return jsonb_build_object('status', 'ambiguous_size', 'item', v_name, 'options',
        (select jsonb_agg(v.label || ' (₦' || to_char(v.price, 'FM999,999,999') || ')' order by v.sort_order, v.label)
           from menu_items mi join menu_item_variations v on v.menu_item_id = mi.id
          where mi.active and mi.name = v_name and (v_var is null or v.label ilike '%' || v_var || '%')));
    end if;
    select mi.id as menu_item_id, v.id as variation_id, mi.name as item, v.label, v.price
      into v_row
      from menu_items mi join menu_item_variations v on v.menu_item_id = mi.id
     where mi.active and mi.name = v_name and (v_var is null or v.label ilike '%' || v_var || '%');
    if exists (select 1 from daily_menu_slots s join daily_menus d on d.id = s.daily_menu_id
                where d.menu_date = v_date and s.variation_id = v_row.variation_id) then
      return jsonb_build_object('status', 'no_change', 'message',
        v_row.item || ' (' || v_row.label || ') is already on ' || v_label || '''s menu. To change its portions, say for example "set it to 5 portions".');
    end if;
    v_ok := exists (select 1 from daily_menus where menu_date = v_date);
    if v_dry then
      return jsonb_build_object('status', 'dry_ok', 'no_menu', not v_ok,
        'add', jsonb_build_object('menu_item_id', v_row.menu_item_id, 'variation_id', v_row.variation_id,
                                  'item', v_row.item, 'label', v_row.label, 'price', v_row.price, 'portions', v_portions));
    end if;
    v_summary := 'Add ' || v_row.item || ' (' || v_row.label || ', ₦' || to_char(v_row.price, 'FM999,999,999') || ') to '
                 || v_label || '''s menu with ' || v_portions || ' portions.'
                 || case when v_ok then '' else ' There is no menu for ' || v_label || ' yet, so one will be created and published (customers will see it).' end;
    insert into owner_pending_actions (actor, kind, params, summary)
    values (p_actor, 'add_to_menu',
            jsonb_build_object('date', v_date, 'adds', jsonb_build_array(jsonb_build_object(
                'menu_item_id', v_row.menu_item_id, 'variation_id', v_row.variation_id,
                'item', v_row.item, 'label', v_row.label, 'price', v_row.price, 'portions', v_portions))),
            v_summary)
    returning id into v_id;
    return jsonb_build_object('status', 'pending', 'action_id', v_id, 'summary', v_summary, 'needs_pin', false);

  elsif p_kind = 'undo_last' then
    select * into v_log from admin_log
     where action in ('owner_action.set_price', 'owner_action.set_prices', 'owner_action.set_sold_out',
                      'owner_action.set_available', 'owner_action.set_portions')
     order by id desc limit 1;
    if v_log.id is null then
      return jsonb_build_object('status', 'no_change', 'message', 'There is no price or portions change to undo.');
    end if;

    if v_log.action in ('owner_action.set_price', 'owner_action.set_prices') then
      v_changes := '[]'::jsonb;
      v_ok := true;
      for v_ch in select * from jsonb_array_elements(v_log.before_value->'prices') loop
        select price into v_newp from menu_item_variations where id = (v_ch->>'variation_id')::uuid;
        -- only undo if nobody has changed that price again since
        if v_newp is null or v_newp <> (
             select (a->>'price')::int from jsonb_array_elements(v_log.after_value->'prices') a
              where a->>'variation_id' = v_ch->>'variation_id' limit 1) then
          v_ok := false;
        end if;
        v_changes := v_changes || jsonb_build_array(jsonb_build_object(
          'variation_id', v_ch->>'variation_id', 'item', v_ch->>'item', 'label', v_ch->>'label',
          'old_price', v_newp, 'new_price', (v_ch->>'price')::int));
      end loop;
      if not v_ok then
        return jsonb_build_object('status', 'no_change', 'message',
          'Those prices have been changed again since, so I cannot undo that safely. Tell me the prices you want.');
      end if;
      v_count := jsonb_array_length(v_changes);
      select v_count > 1 or bool_or(abs((e->>'new_price')::numeric - (e->>'old_price')::numeric) > 0.25 * (e->>'old_price')::numeric)
        into v_pin from jsonb_array_elements(v_changes) e;
      select 'Undo the last price change: '
             || string_agg((e->>'item') || ' (' || (e->>'label') || ') ₦' || to_char((e->>'old_price')::int, 'FM999,999,999')
                           || ' back to ₦' || to_char((e->>'new_price')::int, 'FM999,999,999'), '; ' order by ord)
             || '.' || case when v_pin then ' This needs your PIN.' else '' end
        into v_summary
        from (select e, ord from jsonb_array_elements(v_changes) with ordinality as t(e, ord) where ord <= 8) x;
      insert into owner_pending_actions (actor, kind, params, summary, needs_pin)
      values (p_actor, case when v_count > 1 then 'set_prices' else 'set_price' end,
              jsonb_build_object('changes', v_changes), v_summary, v_pin)
      returning id into v_id;
      return jsonb_build_object('status', 'pending', 'action_id', v_id, 'summary', v_summary, 'needs_pin', v_pin);
    else
      v_slots := '[]'::jsonb;
      v_ok := true;
      for v_ch in select * from jsonb_array_elements(v_log.before_value->'slots') loop
        select s.slots_left, s.slots_total into v_count, v_newp from daily_menu_slots s where s.id = (v_ch->>'slot_id')::uuid;
        if v_count is null or v_count <> (
             select (a->>'slots_left')::int from jsonb_array_elements(v_log.after_value->'slots') a
              where a->>'slot_id' = v_ch->>'slot_id' limit 1) then
          v_ok := false;
        end if;
        v_slots := v_slots || jsonb_build_array(jsonb_build_object(
          'slot_id', v_ch->>'slot_id', 'item', v_ch->>'item', 'label', v_ch->>'label',
          'from_left', v_count, 'from_total', v_newp, 'to_total', v_newp,
          'to_left', least(coalesce(v_newp, 0), (v_ch->>'slots_left')::int)));
      end loop;
      if not v_ok then
        return jsonb_build_object('status', 'no_change', 'message',
          'Those portions have changed again since, so I cannot undo that safely. Tell me the number you want.');
      end if;
      select 'Undo the last portions change: '
             || string_agg((e->>'item') || ' (' || (e->>'label') || ') back to ' || (e->>'to_left') || ' left', '; ')
             || '.'
        into v_summary from jsonb_array_elements(v_slots) e;
      insert into owner_pending_actions (actor, kind, params, summary)
      values (p_actor, 'set_portions', jsonb_build_object('slots', v_slots), v_summary)
      returning id into v_id;
      return jsonb_build_object('status', 'pending', 'action_id', v_id, 'summary', v_summary, 'needs_pin', false);
    end if;
  end if;

  raise exception 'UNKNOWN_ACTION';
end;
$$;

-- Runs the one stored proposal for this person, if it is still fresh.
-- Risky proposals (needs_pin) run only with the right PIN.
drop function if exists owner_confirm_action(text);
create or replace function owner_confirm_action(p_actor text, p_pin text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_act owner_pending_actions;
  v_slot jsonb;
  v_ch jsonb;
  v_before jsonb := '[]'::jsonb;
  v_after jsonb := '[]'::jsonb;
  v_order orders;
  v_new_left int;
  v_cur int;
  v_bad int := 0;
  v_check jsonb;
  v_res jsonb;
  v_dm uuid;
  v_gone record;
  v_mode text;
begin
  if auth.role() <> 'service_role' then raise exception 'NOT_ALLOWED'; end if;

  select * into v_act from owner_pending_actions
   where actor = p_actor and status = 'pending'
   order by created_at desc limit 1 for update;
  if v_act.id is null then return jsonb_build_object('status', 'none'); end if;

  if v_act.expires_at < now() then
    update owner_pending_actions set status = 'expired', resolved_at = now() where id = v_act.id;
    return jsonb_build_object('status', 'expired');
  end if;

  -- A bare number is only ever treated as a PIN when the waiting action
  -- really asks for one. It can never confirm an ordinary action.
  if p_pin is not null and not v_act.needs_pin then
    return jsonb_build_object('status', 'not_a_pin_request');
  end if;
  if v_act.needs_pin then
    if p_pin is null then
      return jsonb_build_object('status', 'pin_required', 'summary', v_act.summary);
    end if;
    v_check := owner_pin_check(p_pin);
    if v_check->>'status' <> 'ok' then
      return v_check;   -- wrong / locked / not_set: the proposal stays waiting
    end if;
  end if;

  if v_act.kind in ('set_sold_out', 'set_available', 'set_portions') then
    for v_slot in select * from jsonb_array_elements(v_act.params->'slots') loop
      v_before := v_before || jsonb_build_array(jsonb_build_object(
        'slot_id', v_slot->>'slot_id', 'item', v_slot->>'item', 'label', v_slot->>'label',
        'slots_left', (select slots_left from daily_menu_slots where id = (v_slot->>'slot_id')::uuid)));
      update daily_menu_slots
         set slots_total = greatest(slots_total, coalesce((v_slot->>'to_total')::int, 0)),
             slots_left = least(greatest(slots_total, coalesce((v_slot->>'to_total')::int, 0)), (v_slot->>'to_left')::int)
       where id = (v_slot->>'slot_id')::uuid
      returning slots_left into v_new_left;
      v_after := v_after || jsonb_build_array(jsonb_build_object(
        'slot_id', v_slot->>'slot_id', 'item', v_slot->>'item', 'label', v_slot->>'label', 'slots_left', v_new_left));
    end loop;
    insert into admin_log (actor, action, summary, before_value, after_value)
    values (p_actor, 'owner_action.' || v_act.kind, v_act.summary,
            jsonb_build_object('slots', v_before), jsonb_build_object('slots', v_after));

  elsif v_act.kind in ('take_over_chat', 'hand_back_chat') then
    select mode into v_mode from conversations where id = (v_act.params->>'conversation_id')::uuid for update;
    if v_mode is null then
      update owner_pending_actions set status = 'failed', resolved_at = now() where id = v_act.id;
      return jsonb_build_object('status', 'failed', 'message', 'That chat no longer exists, so nothing was changed.');
    end if;
    if v_act.kind = 'take_over_chat' then
      if v_mode = 'owner' then
        update owner_pending_actions set status = 'failed', resolved_at = now() where id = v_act.id;
        return jsonb_build_object('status', 'failed', 'message', 'You already have that chat, so nothing was changed.');
      end if;
      insert into chat_messages (conversation_id, role, content)
      values ((v_act.params->>'conversation_id')::uuid, 'system', 'A member of our team has joined the chat.');
      update conversations
         set mode = 'owner', handoff_at = coalesce(handoff_at, now()), owner_unread = false,
             handoff_reason = coalesce(handoff_reason, 'Taken over by the owner'),
             updated_at = now(), last_message_at = now(),
             last_preview = 'A member of our team has joined the chat.', last_role = 'system'
       where id = (v_act.params->>'conversation_id')::uuid;
    else
      if v_mode = 'ai' then
        update owner_pending_actions set status = 'failed', resolved_at = now() where id = v_act.id;
        return jsonb_build_object('status', 'failed', 'message', 'That chat is already with the assistant, so nothing was changed.');
      end if;
      insert into chat_messages (conversation_id, role, content)
      values ((v_act.params->>'conversation_id')::uuid, 'system', 'You are back with the Edelicacies assistant. Ask me anything.');
      update conversations
         set mode = 'ai', handoff_reason = null, handoff_at = null, owner_unread = false,
             updated_at = now(), last_message_at = now(),
             last_preview = 'You are back with the Edelicacies assistant.', last_role = 'system'
       where id = (v_act.params->>'conversation_id')::uuid;
    end if;
    insert into admin_log (actor, action, summary, before_value, after_value)
    values (p_actor, 'owner_action.' || v_act.kind, v_act.summary,
            jsonb_build_object('chat', v_act.params->>'name', 'mode', v_mode),
            jsonb_build_object('chat', v_act.params->>'name',
                               'mode', case when v_act.kind = 'take_over_chat' then 'owner' else 'ai' end));

  elsif v_act.kind = 'add_to_menu' then
    -- Everything or nothing: if any item is already on the menu, change nothing.
    insert into daily_menus (menu_date, published) values ((v_act.params->>'date')::date, true)
      on conflict (menu_date) do nothing;
    select id into v_dm from daily_menus where menu_date = (v_act.params->>'date')::date;
    for v_ch in select * from jsonb_array_elements(v_act.params->'adds') loop
      if exists (select 1 from daily_menu_slots where daily_menu_id = v_dm and variation_id = (v_ch->>'variation_id')::uuid) then
        v_bad := v_bad + 1;
      end if;
    end loop;
    if v_bad > 0 then
      update owner_pending_actions set status = 'failed', resolved_at = now() where id = v_act.id;
      return jsonb_build_object('status', 'failed', 'message', 'One of those items is already on the menu now, so nothing was changed. Please ask again.');
    end if;
    for v_ch in select * from jsonb_array_elements(v_act.params->'adds') loop
      insert into daily_menu_slots (daily_menu_id, menu_item_id, variation_id, slots_total, slots_left, show_slots)
      values (v_dm, (v_ch->>'menu_item_id')::uuid, (v_ch->>'variation_id')::uuid,
              (v_ch->>'portions')::int, (v_ch->>'portions')::int, true);
    end loop;
    insert into admin_log (actor, action, summary, before_value, after_value)
    values (p_actor, 'owner_action.add_to_menu', v_act.summary,
            jsonb_build_object('on_menu', false),
            jsonb_build_object('on_menu', true,
                               'item', v_act.params->'adds'->0->>'item', 'label', v_act.params->'adds'->0->>'label',
                               'portions', (v_act.params->'adds'->0->>'portions')::int,
                               'items', v_act.params->'adds'));

  elsif v_act.kind = 'remove_from_menu' then
    delete from daily_menu_slots where id = (v_act.params->>'slot_id')::uuid
    returning slots_left, slots_total into v_gone;
    if v_gone.slots_left is null then
      update owner_pending_actions set status = 'failed', resolved_at = now() where id = v_act.id;
      return jsonb_build_object('status', 'failed', 'message', 'That item is no longer on the menu, so nothing was changed.');
    end if;
    insert into admin_log (actor, action, summary, before_value, after_value)
    values (p_actor, 'owner_action.remove_from_menu', v_act.summary,
            jsonb_build_object('on_menu', true, 'item', v_act.params->>'item', 'label', v_act.params->>'label',
                               'slots_left', v_gone.slots_left, 'slots_total', v_gone.slots_total),
            jsonb_build_object('on_menu', false));

  elsif v_act.kind = 'add_order' then
    -- Prices and portions must still be exactly what the owner was shown.
    for v_ch in select * from jsonb_array_elements(v_act.params->'lines') loop
      select price into v_cur from menu_item_variations where id = (v_ch->>'variation_id')::uuid;
      if v_cur is null or v_cur <> (v_ch->>'unit_price')::int then v_bad := v_bad + 1; end if;
    end loop;
    select count(*) into v_new_left
      from (select (e->>'slot_id')::uuid as slot_id, sum((e->>'quantity')::integer) as qty
              from jsonb_array_elements(v_act.params->'lines') e group by 1) t
      join daily_menu_slots s on s.id = t.slot_id
     where t.qty > s.slots_left;
    if v_bad > 0 or v_new_left > 0 then
      update owner_pending_actions set status = 'failed', resolved_at = now() where id = v_act.id;
      return jsonb_build_object('status', 'failed',
        'message', 'A price or the portions left changed since you asked, so the order was not added. Please ask again.');
    end if;
    v_res := place_order(
      (v_act.params->>'date')::date,
      v_act.params->>'customer_name', v_act.params->>'phone', null,
      case when v_act.params->>'delivery_type' = 'delivery' then 'dispatch' else 'pickup' end,
      v_act.params->>'address', null, null, null,
      case when v_act.params->>'delivery_type' = 'delivery' then (v_act.params->>'delivery_fee')::int else null end,
      null,
      concat_ws(' | ', 'Phone order added by owner',
                case when (v_act.params->>'paid')::boolean then 'Paid' || coalesce(' by ' || (v_act.params->>'payment_method'), '') else 'Not yet paid' end,
                v_act.params->>'note'),
      (select jsonb_agg(jsonb_build_object('variation_id', e->>'variation_id', 'quantity', (e->>'quantity')::int))
         from jsonb_array_elements(v_act.params->'lines') e));
    update orders
       set status = case when (v_act.params->>'paid')::boolean then 'paid' else 'awaiting_payment' end,
           source = 'owner', auto_cancel_at = null
     where id = (v_res->>'order_id')::uuid;
    insert into admin_log (actor, action, summary, after_value)
    values (p_actor, 'owner_action.add_order', v_act.summary,
            jsonb_build_object('order_number', v_res->>'order_number', 'total', (v_res->>'total')::int,
                               'paid', (v_act.params->>'paid')::boolean));
    update owner_pending_actions set status = 'done', resolved_at = now() where id = v_act.id;
    return jsonb_build_object('status', 'done', 'kind', 'add_order',
                              'summary', 'Order ' || (v_res->>'order_number') || ' added. ' || v_act.summary,
                              'order_number', v_res->>'order_number');

  elsif v_act.kind in ('set_price', 'set_prices') then
    -- If anyone changed a price since the proposal, change nothing at all.
    for v_ch in select * from jsonb_array_elements(v_act.params->'changes') loop
      select price into v_cur from menu_item_variations where id = (v_ch->>'variation_id')::uuid;
      if v_cur is null or v_cur <> (v_ch->>'old_price')::int then v_bad := v_bad + 1; end if;
    end loop;
    if v_bad > 0 then
      update owner_pending_actions set status = 'failed', resolved_at = now() where id = v_act.id;
      return jsonb_build_object('status', 'failed',
        'message', 'A price changed since you asked, so nothing was changed. Please ask again.');
    end if;
    for v_ch in select * from jsonb_array_elements(v_act.params->'changes') loop
      update menu_item_variations set price = (v_ch->>'new_price')::int where id = (v_ch->>'variation_id')::uuid;
      v_before := v_before || jsonb_build_array(jsonb_build_object(
        'variation_id', v_ch->>'variation_id', 'item', v_ch->>'item', 'label', v_ch->>'label', 'price', (v_ch->>'old_price')::int));
      v_after := v_after || jsonb_build_array(jsonb_build_object(
        'variation_id', v_ch->>'variation_id', 'item', v_ch->>'item', 'label', v_ch->>'label', 'price', (v_ch->>'new_price')::int));
    end loop;
    insert into admin_log (actor, action, summary, before_value, after_value)
    values (p_actor, 'owner_action.' || v_act.kind, v_act.summary,
            jsonb_build_object('prices', v_before), jsonb_build_object('prices', v_after));

  else
    select * into v_order from orders where id = (v_act.params->>'order_id')::uuid for update;
    if v_order.id is null or not (
         v_order.status = 'pending_approval'
         or (v_act.kind = 'reject_order' and v_order.source = 'owner' and v_order.status in ('awaiting_payment', 'paid', 'preparing'))
       ) then
      update owner_pending_actions set status = 'failed', resolved_at = now() where id = v_act.id;
      return jsonb_build_object('status', 'failed',
        'message', 'That order is no longer waiting for approval, so nothing was changed.');
    end if;
    if v_act.kind = 'approve_order' then
      perform approve_order(v_order.id);
    else
      perform set_order_status(v_order.id, 'cancelled');
    end if;
    insert into admin_log (actor, action, summary, before_value, after_value)
    values (p_actor, 'owner_action.' || v_act.kind, v_act.summary,
            jsonb_build_object('order_number', v_order.order_number, 'status', v_order.status),
            jsonb_build_object('order_number', v_order.order_number,
                               'status', case when v_act.kind = 'approve_order' then 'awaiting_payment' else 'cancelled' end));
  end if;

  update owner_pending_actions set status = 'done', resolved_at = now() where id = v_act.id;
  return jsonb_build_object('status', 'done', 'kind', v_act.kind, 'summary', v_act.summary,
                            'order_id', v_act.params->>'order_id', 'order_number', v_act.params->>'order_number');
end;
$$;

create or replace function owner_cancel_action(p_actor text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if auth.role() <> 'service_role' then raise exception 'NOT_ALLOWED'; end if;
  update owner_pending_actions set status = 'cancelled', resolved_at = now()
   where actor = p_actor and status = 'pending';
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

revoke all on function owner_propose_action(text, text, jsonb) from public, anon, authenticated;
grant execute on function owner_propose_action(text, text, jsonb) to service_role;
revoke all on function owner_confirm_action(text, text) from public, anon, authenticated;
grant execute on function owner_confirm_action(text, text) to service_role;
revoke all on function owner_cancel_action(text) from public, anon, authenticated;
grant execute on function owner_cancel_action(text) to service_role;

-- ============================================================================
-- PHASE 7: OWNER ASSISTANT CHAT HISTORY (so a refresh never clears it)
-- ============================================================================
-- Each owner sees only their own conversation with the owner assistant.
-- Customers have no access at all.

create table if not exists owner_chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 4000),
  created_at timestamptz not null default now()
);
create index if not exists owner_chat_messages_user_idx on owner_chat_messages(user_id, id);

alter table owner_chat_messages enable row level security;
drop policy if exists "owner_chat_messages own" on owner_chat_messages;
create policy "owner_chat_messages own"
  on owner_chat_messages for all to authenticated
  using (is_owner() and user_id = auth.uid())
  with check (is_owner() and user_id = auth.uid());

-- ============================================================================
-- PHASE 7 (step 6): THE OWNER ASSISTANT ON WHATSAPP
-- ============================================================================
-- Messages from a CONFIRMED owner number are routed (by the whatsapp Edge
-- Function, in code, before any AI) to the owner assistant. This table keeps
-- that short conversation so the assistant has context. Service key only.
-- A message that looks like a PIN (4-6 digits) is saved masked, never as digits.

create table if not exists owner_wa_messages (
  id bigint generated always as identity primary key,
  phone text not null,                       -- the owner's number, digits only
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 2000),
  wa_message_id text unique,                 -- Meta's id, so a repeat delivery is ignored
  created_at timestamptz not null default now()
);
create index if not exists owner_wa_messages_phone_idx on owner_wa_messages(phone, id);
alter table owner_wa_messages enable row level security;
-- No policies: nobody but the service key can read or write this table.

-- Tidy up: owner WhatsApp messages older than 30 days are removed each night.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'edelicacies-clean-owner-wa') then
    perform cron.unschedule('edelicacies-clean-owner-wa');
  end if;
end $$;

select cron.schedule(
  'edelicacies-clean-owner-wa',
  '0 3 * * *',
  $$ delete from owner_wa_messages where created_at < now() - interval '30 days'; $$
);
