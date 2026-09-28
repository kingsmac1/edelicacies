-- ============================================================================
-- EDELICACIES — DUMMY DATA (for trying out every dashboard section)
-- ============================================================================
-- Adds a handful of fake orders, customers, sales records, expenses, discount
-- codes, reviews and subscribers so every dashboard page has something to
-- show you. Every phone number used here starts with 0800000 — that's the
-- marker that makes this data easy to find and delete later.
--
-- Paste this into the Supabase SQL Editor AFTER schema.sql and
-- seed_menu_items.sql have both been run. Unlike schema.sql, this one is
-- meant to be run just ONCE — running it again adds a second set of dummy
-- orders and sales records rather than replacing the first set.
--
-- TO DELETE ALL OF THIS LATER, run:
--   delete from orders where customer_phone like '0800000%';
--   delete from customers where phone like '0800000%';
--   delete from manual_sales where note like 'DUMMY:%';
--   delete from expenses where note like 'DUMMY:%';
--   delete from discount_codes where code like 'DUMMY%';
--   delete from subscribers where email like '%dummy.edelicacies.test';
-- (The 3 past-dated daily menus this creates are harmless to leave — only
-- today's date ever shows on the live site — but delete them too if you'd
-- like a completely clean slate: delete from daily_menus where menu_date in
-- (current_date - 3, current_date - 2, current_date - 1);)
-- ============================================================================

do $$
declare
  v_item1_variation uuid;
  v_item1_id uuid;
  v_item1_name text;
  v_item1_price integer;
  v_item2_variation uuid;
  v_item2_id uuid;
  v_item2_name text;
  v_item2_price integer;
  v_menu_d3 uuid; -- 3 days ago
  v_menu_d2 uuid; -- 2 days ago
  v_menu_d1 uuid; -- yesterday
  v_order_id uuid;
begin
  select miv.id, mi.id, mi.name, miv.price
    into v_item1_variation, v_item1_id, v_item1_name, v_item1_price
    from menu_item_variations miv join menu_items mi on mi.id = miv.menu_item_id
    order by mi.sort_order, miv.sort_order limit 1;

  select miv.id, mi.id, mi.name, miv.price
    into v_item2_variation, v_item2_id, v_item2_name, v_item2_price
    from menu_item_variations miv join menu_items mi on mi.id = miv.menu_item_id
    order by mi.sort_order, miv.sort_order offset 1 limit 1;

  if v_item1_variation is null then
    raise notice 'No menu items found yet — add menu items (or run seed_menu_items.sql) before this script.';
    return;
  end if;
  if v_item2_variation is null then
    v_item2_variation := v_item1_variation;
    v_item2_id := v_item1_id;
    v_item2_name := v_item1_name;
    v_item2_price := v_item1_price;
  end if;

  -- ---- Dummy daily menus (past dates, won't affect today's real menu) ----
  insert into daily_menus (menu_date, published) values
    (current_date - 3, true), (current_date - 2, true), (current_date - 1, true)
  on conflict (menu_date) do nothing;

  select id into v_menu_d3 from daily_menus where menu_date = current_date - 3;
  select id into v_menu_d2 from daily_menus where menu_date = current_date - 2;
  select id into v_menu_d1 from daily_menus where menu_date = current_date - 1;

  insert into daily_menu_slots (daily_menu_id, menu_item_id, variation_id, slots_total, slots_left, show_slots)
  select d.id, v_item1_id, v_item1_variation, 20, 15, true
  from (values (v_menu_d3), (v_menu_d2), (v_menu_d1)) as d(id)
  on conflict (daily_menu_id, variation_id) do nothing;

  insert into daily_menu_slots (daily_menu_id, menu_item_id, variation_id, slots_total, slots_left, show_slots)
  select d.id, v_item2_id, v_item2_variation, 20, 15, true
  from (values (v_menu_d3), (v_menu_d2), (v_menu_d1)) as d(id)
  on conflict (daily_menu_id, variation_id) do nothing;

  -- ---- Dummy customers ----
  insert into customers (phone, name, email, first_order_at, last_order_at, orders_count, total_spent) values
    ('0800000001', 'Test Customer One', 'customer1@dummy.edelicacies.test', now() - interval '3 days', now() - interval '1 day', 2, (v_item1_price * 2 + v_item2_price)),
    ('0800000002', 'Test Customer Two', 'customer2@dummy.edelicacies.test', now() - interval '2 days', now() - interval '2 days', 1, v_item1_price),
    ('0800000003', 'Test Customer Three', null, now() - interval '3 days', now() - interval '3 days', 1, v_item2_price)
  on conflict (phone) do nothing;

  -- ---- Dummy orders across every status ----
  -- 1. Awaiting payment
  insert into orders (order_number, menu_date, customer_name, customer_phone, customer_email, delivery_type, subtotal, total, status, auto_cancel_at)
  values (next_order_number(), current_date - 1, 'Test Customer One', '0800000001', 'customer1@dummy.edelicacies.test', 'pickup', v_item1_price, v_item1_price, 'awaiting_payment', now() + interval '2 hours')
  returning id into v_order_id;
  insert into order_items (order_id, menu_item_id, variation_id, item_name, variation_label, unit_price, quantity, menu_date)
  values (v_order_id, v_item1_id, v_item1_variation, v_item1_name, 'Dummy size', v_item1_price, 1, current_date - 1);

  -- 2. Paid, dispatch
  insert into orders (order_number, menu_date, customer_name, customer_phone, customer_email, delivery_type, address_text, address_lat, address_lng, dispatch_fee_estimate, dispatch_fee_final, subtotal, total, status)
  values (next_order_number(), current_date - 2, 'Test Customer Two', '0800000002', 'customer2@dummy.edelicacies.test', 'dispatch', '2 Lanes, Uyo (dummy address)', 5.03, 7.94, 1500, 1500, v_item1_price, v_item1_price + 1500, 'paid')
  returning id into v_order_id;
  insert into order_items (order_id, menu_item_id, variation_id, item_name, variation_label, unit_price, quantity, menu_date)
  values (v_order_id, v_item1_id, v_item1_variation, v_item1_name, 'Dummy size', v_item1_price, 1, current_date - 2);

  -- 3. Preparing
  insert into orders (order_number, menu_date, customer_name, customer_phone, customer_email, delivery_type, subtotal, total, status)
  values (next_order_number(), current_date - 1, 'Test Customer Three', '0800000003', null, 'pickup', v_item2_price, v_item2_price, 'preparing')
  returning id into v_order_id;
  insert into order_items (order_id, menu_item_id, variation_id, item_name, variation_label, unit_price, quantity, menu_date)
  values (v_order_id, v_item2_id, v_item2_variation, v_item2_name, 'Dummy size', v_item2_price, 1, current_date - 1);

  -- 4. Out for delivery
  insert into orders (order_number, menu_date, customer_name, customer_phone, customer_email, delivery_type, address_text, address_lat, address_lng, dispatch_fee_estimate, dispatch_fee_final, subtotal, total, status)
  values (next_order_number(), current_date - 1, 'Test Customer One', '0800000001', 'customer1@dummy.edelicacies.test', 'dispatch', 'Along Oron Road, Uyo (dummy address)', 5.02, 7.93, 2000, 2000, v_item1_price + v_item2_price, v_item1_price + v_item2_price + 2000, 'out_for_delivery')
  returning id into v_order_id;
  insert into order_items (order_id, menu_item_id, variation_id, item_name, variation_label, unit_price, quantity, menu_date) values
    (v_order_id, v_item1_id, v_item1_variation, v_item1_name, 'Dummy size', v_item1_price, 1, current_date - 1),
    (v_order_id, v_item2_id, v_item2_variation, v_item2_name, 'Dummy size', v_item2_price, 1, current_date - 1);

  -- 5. Delivered (with a review)
  insert into orders (order_number, menu_date, customer_name, customer_phone, customer_email, delivery_type, subtotal, total, status, delivered_at, review_requested_at)
  values (next_order_number(), current_date - 3, 'Test Customer Two', '0800000002', 'customer2@dummy.edelicacies.test', 'pickup', v_item1_price, v_item1_price, 'delivered', now() - interval '1 day', now() - interval '20 hours')
  returning id into v_order_id;
  insert into order_items (order_id, menu_item_id, variation_id, item_name, variation_label, unit_price, quantity, menu_date)
  values (v_order_id, v_item1_id, v_item1_variation, v_item1_name, 'Dummy size', v_item1_price, 1, current_date - 3);
  insert into reviews (order_id, customer_name, rating, comment, show_on_site)
  values (v_order_id, 'Test Customer Two', 5, 'Dummy review — delicious and arrived on time! Delete me later.', true)
  on conflict (order_id) do nothing;

  -- 6. Cancelled
  insert into orders (order_number, menu_date, customer_name, customer_phone, customer_email, delivery_type, subtotal, total, status)
  values (next_order_number(), current_date - 2, 'Test Customer Three', '0800000003', null, 'pickup', v_item2_price, v_item2_price, 'cancelled')
  returning id into v_order_id;
  insert into order_items (order_id, menu_item_id, variation_id, item_name, variation_label, unit_price, quantity, menu_date)
  values (v_order_id, v_item2_id, v_item2_variation, v_item2_name, 'Dummy size', v_item2_price, 1, current_date - 2);

  -- 7. Delivered, no review yet (so you can see the un-reviewed state too)
  insert into orders (order_number, menu_date, customer_name, customer_phone, customer_email, delivery_type, subtotal, total, status, delivered_at)
  values (next_order_number(), current_date - 1, 'Test Customer One', '0800000001', 'customer1@dummy.edelicacies.test', 'pickup', v_item2_price, v_item2_price, 'delivered', now() - interval '30 minutes')
  returning id into v_order_id;
  insert into order_items (order_id, menu_item_id, variation_id, item_name, variation_label, unit_price, quantity, menu_date)
  values (v_order_id, v_item2_id, v_item2_variation, v_item2_name, 'Dummy size', v_item2_price, 1, current_date - 1);

  raise notice 'Dummy orders created using menu items: % and %', v_item1_name, v_item2_name;
end $$;

-- ---- Dummy manual sales (Records) ----
insert into manual_sales (sale_date, customer_name, customer_phone, items_text, amount, delivery_fee, payment_method, note, paid) values
  (current_date - 1, 'Test Walk-in Customer', '0800000004', 'Dummy walk-in order', 8000, 0, 'Cash', 'DUMMY: walk-in sale, safe to delete', true),
  (current_date - 2, 'Test WhatsApp Order', '0800000005', 'Dummy WhatsApp order', 12500, 1500, 'Transfer', 'DUMMY: WhatsApp sale, safe to delete', true),
  (current_date - 3, 'Test Unpaid Order', '0800000006', 'Dummy phone order', 6000, 0, 'Cash', 'DUMMY: unpaid, safe to delete', false);

-- ---- Dummy expenses ----
insert into expenses (expense_date, category, amount, note) values
  (current_date - 1, 'Ingredients', 15000, 'DUMMY: rice and chicken, safe to delete'),
  (current_date - 1, 'Gas', 5000, 'DUMMY: cooking gas refill, safe to delete'),
  (current_date - 2, 'Packaging', 3500, 'DUMMY: takeout packs, safe to delete'),
  (current_date - 3, 'Transport', 2000, 'DUMMY: market run, safe to delete');

-- ---- Dummy discount codes ----
insert into discount_codes (code, percent_off, fixed_off, min_order_amount, max_uses, active) values
  ('DUMMY10', 10, null, 5000, 100, true),
  ('DUMMYFIXED', null, 1000, null, 50, true),
  ('DUMMYOLD', 20, null, null, 10, false)
on conflict (code) do nothing;

-- ---- Dummy subscribers ----
insert into subscribers (name, email, whatsapp) values
  ('Test Subscriber One', 'sub1@dummy.edelicacies.test', '0800000007'),
  ('Test Subscriber Two', 'sub2@dummy.edelicacies.test', '0800000008'),
  ('Test Subscriber Three', 'sub3@dummy.edelicacies.test', '0800000009')
on conflict (lower(email)) do nothing;
