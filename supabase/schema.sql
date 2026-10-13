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

-- settings (no secrets live here — just public operational settings like
-- the announcement banner and shop coordinates)
drop policy if exists "settings public read" on settings;
create policy "settings public read"
  on settings for select
  to anon, authenticated
  using (true);

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
alter table orders add constraint orders_source_check check (source in ('website', 'chat'));

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
