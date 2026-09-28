-- ============================================================================
-- EDELICACIES — SEED: MENU ITEMS
-- ============================================================================
-- Populates your real dishes (names, descriptions, sizes and prices) pulled
-- from your WhatsApp price list, so you're not starting from a blank dashboard.
-- Paste this into the Supabase SQL Editor and click Run, the same way you did
-- with schema.sql. It's safe to run more than once — it won't create duplicates.
--
-- Photos are NOT included here — uploading files needs you to be logged in as
-- the owner first (Storage requires that for security). Once you've created your
-- login (SETUP.md Step 4), open each item under Menu Items and add its photo —
-- the pictures are already sitting in src/assets/menu/ for reference.
--
-- Everything below is active and ready to schedule under Daily Menu & Slots
-- whenever you're ready to put a day's menu live.
-- ============================================================================

insert into menu_items (id, name, category, description, active, sort_order)
values
  ('8b06532f-c2f8-41b9-9f1d-1c60f3c881bb', 'Chicken Curry Sauce with Steamed Rice', 'food', 'Perfectly spiced chicken curry sauce paired with steamed white rice.', true, 0),
  ('1193aa05-b8b0-4dc0-87a2-42f641c7bf62', 'Ofada Sauce', 'food', 'Goatmeat, eggs and cowmeat in rich ofada sauce, paired with rice, yam or plantain.', true, 1),
  ('6d0dbd63-fce7-423f-a936-9e9569ba8d7d', 'Atama Soup', 'food', 'Made with snails, stockfish, kpomo, dried fish and goatmeat.', true, 2),
  ('59e52dbc-261d-49d2-8cda-56083eac4238', 'Ofeawku', 'food', 'A hearty pot made with stockfish, dried fish, goatmeat and beef.', true, 3),
  ('708b1b0c-3e18-4634-a371-6870bead9c31', 'Assorted Local Stew', 'food', 'Assorted local stew paired with beans and plantain cubes.', true, 4),
  ('4fecff1f-a794-410e-9043-915105fd19a2', 'Chicken and Plantain Peppersoup', 'food', 'Warm, peppery chicken peppersoup with plantain.', true, 5),
  ('6ad80390-aa15-457c-9915-22cd680ad12a', 'Native Rice with Chicken Wings', 'food', 'Native rice with perfectly sauced chicken wings, egg and plantain cubes.', true, 6),
  ('968690b8-d69a-4616-b906-f109cd437c7f', 'Creamy Coconut Rice with Gizzard', 'food', 'Creamy coconut rice with gizzard and goatmeat.', true, 7),
  ('91d7cc74-9d19-437f-bada-e80c585098d3', 'Beef Afang Soup', 'food', 'Classic afang soup made with beef.', true, 8),
  ('fd4f8e6b-52a4-47bc-b031-b9b8812c7867', 'Native Rice with Snails & Dried Fish', 'food', 'Native rice with snails, kpomo and dried fish.', true, 9),
  ('ea63fc9b-440a-41ef-a820-e5062ac0589a', 'Peppered Chicken Feet', 'food', 'Spicy peppered chicken feet, 10 pieces.', true, 10),
  ('5912c1eb-ac73-4f25-81eb-cfbdeeac3cb4', 'Egusi Soup', 'food', 'Rich, well-seasoned egusi soup.', true, 11),
  ('6a7aa6a3-b5b6-45f7-8490-7b5bd528f344', 'Native Rice with Turkey & Snails', 'food', 'Native rice with sauced turkey, snails and egg.', true, 12),
  ('a39243bc-c314-4d9b-85d5-7ad0de7d7077', 'Plantain Pottage', 'food', 'Made with smoked fish, snails, goatmeat and kpomo.', true, 13),
  ('9de25668-308d-4ff2-9ace-949ac75a974b', 'Creamy Coconut Rice with Double Chicken', 'food', 'Creamy coconut rice with double chicken and egg.', true, 14),
  ('e17e29b1-83ed-4b82-ac4d-e253a263c0fd', 'Catfish & Plantain Peppersoup', 'food', 'Catfish and plantain peppersoup paired with steamed rice.', true, 15),
  ('a8b1ff3f-b445-41e3-8562-c92f23660ea4', 'Afia Efere Ebod', 'food', 'Traditional white soup, made the authentic way.', true, 16),
  ('cf349dc5-7a5c-480c-9743-20da2252d6f6', 'Asun Jollof Rice', 'food', 'Smoky jollof rice with asun and plantain cubes.', true, 17),
  ('e0d2b285-9e79-4819-a62f-252a30bc4dd0', 'Smokey Jollof Rice with Peppered Chicken', 'food', 'Smokey jollof rice with peppered chicken and plantain cubes.', true, 18),
  ('f4f0c21a-20ea-40a1-8b9b-151177f49c6b', 'Snail and Chicken Stew', 'food', 'Rich stew loaded with snail and chicken.', true, 19),
  ('8557ee4f-b98a-4ad3-9329-74e640e9d5b5', 'Snail Stew', 'food', 'Soulfully made snail stew.', true, 20),
  ('2c7d4c47-e54a-4b8c-92c6-da92dc7e8660', 'Gizdodo', 'food', 'Gizzard and dodo (fried plantain) tossed in sauce.', true, 21),
  ('4b81996a-f7d7-4782-af80-256fb4541d9e', 'Egg Sauce', 'food', 'Rich, home-style egg sauce.', true, 22),
  ('71aa9dfe-3477-4b50-aa61-d3b6e24808d0', 'Afang Soup', 'food', 'Classic afang soup, made fresh.', true, 23),
  ('d003ed3d-b63b-41e6-a888-a255d824018f', 'Snail Sauce', 'food', 'Snails cooked down in a rich sauce.', true, 24),
  ('ad97c717-0e2c-4293-a737-e69cc99949c9', 'Creamy Tigernut Juice', 'drink', 'Our signature creamy tigernut juice, chilled and naturally sweet.', true, 25),
  ('0454a2b7-5023-4d27-a1fb-2feb83476b44', 'Choc Choo Tigernut Juice', 'drink', 'Tigernut juice blended with rich chocolate.', true, 26),
  ('9e400822-22d6-405d-9b2c-c316ff8b211a', 'Bee Berry Tigernut Juice', 'drink', 'Tigernut juice with a fruity berry twist, naturally sweetened with honey.', true, 27)
on conflict (id) do nothing;

insert into menu_item_variations (id, menu_item_id, label, price, sort_order)
values
  ('595eaadb-11b3-4bf8-8e7c-f5cfdae16264', '8b06532f-c2f8-41b9-9f1d-1c60f3c881bb', 'Regular', 5800, 0),
  ('f466dec3-a5e4-4251-b5ea-2ae2287f183e', '1193aa05-b8b0-4dc0-87a2-42f641c7bf62', 'Big Pack', 11500, 0),
  ('96f4886c-9116-44bd-ae81-6eb632c9b735', '6d0dbd63-fce7-423f-a936-9e9569ba8d7d', '1 Litre', 20000, 0),
  ('893ed308-532e-4578-83b0-971661b47328', '59e52dbc-261d-49d2-8cda-56083eac4238', 'Small Pack', 6000, 0),
  ('55bbdc4b-7391-45ad-9e74-6f6d77cac677', '59e52dbc-261d-49d2-8cda-56083eac4238', 'Big Pack', 11500, 1),
  ('5f2dfdbf-3c0c-425e-afb4-3d267e2e79a4', '708b1b0c-3e18-4634-a371-6870bead9c31', 'Regular', 6000, 0),
  ('7306058d-7537-4cb6-bddc-be969f8ca773', '4fecff1f-a794-410e-9043-915105fd19a2', 'Regular', 6500, 0),
  ('5f58d26b-0cde-4db7-bbed-f83d9b08c1c7', '6ad80390-aa15-457c-9915-22cd680ad12a', 'Regular', 5800, 0),
  ('f8699d70-a6f3-4ccc-9235-bb512b464e0d', '968690b8-d69a-4616-b906-f109cd437c7f', 'Regular', 10000, 0),
  ('0665dc3d-4940-40aa-961f-0187cc97f59e', '91d7cc74-9d19-437f-bada-e80c585098d3', 'Regular', 5800, 0),
  ('41c533e0-9dca-4e50-9e62-b522f98d1338', '91d7cc74-9d19-437f-bada-e80c585098d3', '3 Litres', 58000, 1),
  ('e7662972-4c60-4ae6-a609-493373174737', 'fd4f8e6b-52a4-47bc-b031-b9b8812c7867', 'Regular', 12000, 0),
  ('3f8b14ba-7dd1-434e-9cf7-c46f34f89990', 'ea63fc9b-440a-41ef-a820-e5062ac0589a', '10 pcs', 4500, 0),
  ('50f38fd9-52ff-4535-b37e-41a4ff8f51ad', '5912c1eb-ac73-4f25-81eb-cfbdeeac3cb4', 'Regular', 6000, 0),
  ('a55a5c94-9958-476d-933e-159d3cf4acad', '6a7aa6a3-b5b6-45f7-8490-7b5bd528f344', 'Regular', 16000, 0),
  ('ce27aa73-2bd8-423b-a6fc-edf025e40e37', 'a39243bc-c314-4d9b-85d5-7ad0de7d7077', 'Regular', 9000, 0),
  ('52d82943-4e6c-4446-b6c2-f8deb3e5d854', '9de25668-308d-4ff2-9ace-949ac75a974b', 'Regular', 11500, 0),
  ('020bdddd-986a-4b8a-aa85-9fb241968f01', 'e17e29b1-83ed-4b82-ac4d-e253a263c0fd', 'Regular', 10000, 0),
  ('72634146-cf15-4914-a307-53e8efb6a1fc', 'a8b1ff3f-b445-41e3-8562-c92f23660ea4', 'Regular', 16000, 0),
  ('10a3b4dc-4285-48aa-b984-c3c1b7d7645b', 'cf349dc5-7a5c-480c-9743-20da2252d6f6', 'Regular', 9000, 0),
  ('5e45b650-da5d-45dc-9d03-9f8f9e15dc3c', 'e0d2b285-9e79-4819-a62f-252a30bc4dd0', 'Regular', 6000, 0),
  ('62f4033f-c869-4d41-add8-81d6b2047f6b', 'f4f0c21a-20ea-40a1-8b9b-151177f49c6b', '1 Litre', 25000, 0),
  ('35511366-e76d-4246-a905-a87836ce02f9', 'f4f0c21a-20ea-40a1-8b9b-151177f49c6b', '2 Litres', 48000, 1),
  ('1332d65e-b4ef-4c60-8ed7-077ec5eb9086', '8557ee4f-b98a-4ad3-9329-74e640e9d5b5', 'Regular', 6000, 0),
  ('51088a56-7d18-4ce4-b889-2d0d43224898', '2c7d4c47-e54a-4b8c-92c6-da92dc7e8660', 'Regular', 5000, 0),
  ('00bf304f-3fb5-426c-93d9-11b51220036c', '4b81996a-f7d7-4782-af80-256fb4541d9e', 'Regular', 12000, 0),
  ('10dc6c32-b134-4e00-9e98-7abda402f76b', '71aa9dfe-3477-4b50-aa61-d3b6e24808d0', '3 Litres', 58000, 0),
  ('9687e4cf-8608-4da6-86ec-0a165214aa32', 'd003ed3d-b63b-41e6-a888-a255d824018f', 'Regular', 6000, 0),
  ('035b4fb8-354a-4381-a6ac-840c87b7d2d1', 'ad97c717-0e2c-4293-a737-e69cc99949c9', 'Bottle', 2500, 0),
  ('f635ebe9-be98-4bbb-b02f-d287de9741ab', 'ad97c717-0e2c-4293-a737-e69cc99949c9', 'Pack of 10', 23000, 1),
  ('aa11481c-f2cf-457d-8c4b-c4e3de05a585', '0454a2b7-5023-4d27-a1fb-2feb83476b44', 'Bottle', 2500, 0),
  ('24abf389-f944-44aa-9fa9-8cb0ba31dd70', '0454a2b7-5023-4d27-a1fb-2feb83476b44', 'Pack of 10', 23000, 1),
  ('6a727f2f-23ea-4c72-8da5-5d84728ce50a', '9e400822-22d6-405d-9b2c-c316ff8b211a', 'Bottle', 2500, 0),
  ('9576d3f8-8439-4225-96e6-16301cedae91', '9e400822-22d6-405d-9b2c-c316ff8b211a', 'Pack of 10', 23000, 1)
on conflict (id) do nothing;

