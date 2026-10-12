-- ============================================================================
-- EDELICACIES — FAQ NOTES FOR THE AI ASSISTANT (Phase 3)
-- ============================================================================
-- Paste into the Supabase SQL Editor and run. Safe to run again: it only
-- inserts when the faqs table is completely empty, so it never duplicates
-- notes or overwrites ones you later edit.
--
-- To change a note later, edit its row in Table Editor -> faqs (and, once
-- embeddings exist in Phase 3, re-run the embedding step for that row).
--
-- Every fact here comes from the owner. Area names come from the owner plus
-- public area guides; the delivery distance itself is always worked out at
-- checkout from the customer's location, not from this list.
-- ============================================================================

insert into faqs (question, answer, sort_order)
select v.question, v.answer, v.sort_order
from (values
  (
    $q$Where do you deliver?$q$,
    $q$We deliver to every area within 20 km of our shop in Uyo. That covers most of Uyo city and several nearby towns. If you are farther than 20 km, message us on WhatsApp and the owner will arrange delivery with you personally.$q$,
    10
  ),
  (
    $q$Do you deliver to Ewet Housing?$q$,
    $q$Yes. Ewet Housing is in Uyo, close to our shop, and well within our 20 km delivery area.$q$,
    20
  ),
  (
    $q$How much is delivery? What are your delivery fees?$q$,
    $q$Delivery fees depend on how far you are from our shop, measured in a straight line: 0 to 2 km is N1,500. 2 to 5 km is N2,000. 5 to 8 km is N2,500. 8 to 11 km is N3,000. 11 to 14 km is N3,500. 14 to 17 km is N4,000. 17 to 20 km is N4,500.$q$,
    30
  ),
  (
    $q$How do I find out the delivery fee for my area?$q$,
    $q$Add your items to the cart and go to checkout, then share your location or place the pin on the map. The website works out your distance and shows the delivery fee. Our team confirms the final fee.$q$,
    40
  ),
  (
    $q$Which areas do you deliver to? Do you deliver to Osongama, Shelter Afrique, Four Lanes, Two Lanes, IBB Avenue, Atiku or Itam?$q$,
    $q$Yes. We deliver to all the major areas of Uyo main town. These include Ewet Housing Estate, Shelter Afrique, Osongama Estate, Four Lanes, Two Lanes, IBB Avenue, Atiku Abubakar Avenue, Itam and Itam Industrial Layout, Ekom Iman, Nwaniba, Banking Layout and Ikpa Road. If your area is not named here, we still deliver there as long as it is within 20 km of our shop. Share your location at checkout and the website will confirm.$q$,
    50
  ),
  (
    $q$Do you deliver along main roads and avenues in Uyo such as Aka Road, Abak Road, Oron Road, Ikot Ekpene Road or Wellington Bassey Way?$q$,
    $q$Yes. We deliver to addresses along Uyo's main roads and avenues, including Aka Road, Abak Road, Oron Road, Ikot Ekpene Road, Ikpa Road, Nwaniba Road, Wellington Bassey Way, Nsikak Eduok Avenue, Udo Udoma Avenue, General Edet Akpan Avenue, Captain Iniobong Ekong Avenue, Okon Amasi Avenue, Atiku Abubakar Avenue, IBB Avenue, Nelson Mandela Road, Hospital Road, House of Assembly Road, Ring Road 3, Full Life Avenue, Aka Nung Udoe Road and Teeves School Road. If your area is not named here, we still deliver there as long as it is within 20 km of our shop. Share your location at checkout and the website will confirm.$q$,
    51
  ),
  (
    $q$Do you deliver to the University of Uyo, Ibom Plaza, the Secretariat, the stadium or other landmarks?$q$,
    $q$Yes. We deliver around Uyo's main landmarks, including the University of Uyo (main road and town campus area), Ibom Plaza, the Akwa Ibom State Secretariat, Ibom Tropicana, Godswill Akpabio International Stadium, Dakkada Towers, Ibibio Museum, Ibom e-Library and the Central Bank of Nigeria area. If your area is not named here, we still deliver there as long as it is within 20 km of our shop. Share your location at checkout and the website will confirm.$q$,
    52
  ),
  (
    $q$Do you deliver to Use Offot, Afaha Offot, Mbribit, Anua, Nduetong, Etoi or other communities around Uyo?$q$,
    $q$Yes, communities around Uyo such as Use Offot, Afaha Offot, Nsukara Offot, Anua, Mbribit, Ikot Ekpe, Etoi, Mbiabong, Nduetong and Ifa Ikot Okan are covered as long as they are within 20 km of our shop. The website works out your exact distance when you share your location at checkout.$q$,
    53
  ),
  (
    $q$Do you deliver to my area, street or community? I can't find my area on your list.$q$,
    $q$If your address is within 20 km of our shop in Uyo, we deliver there, even if your area is not named in our list. Share your location at checkout and the website will confirm whether you are within range and show your delivery fee. If you are beyond 20 km, message us on WhatsApp and the owner will arrange it with you.$q$,
    54
  ),
  (
    $q$Do you deliver outside 20 km?$q$,
    $q$Delivery beyond 20 km is not automatic, but it can be arranged. Message us on WhatsApp and the owner will agree the delivery with you personally.$q$,
    60
  ),
  (
    $q$When will my food be delivered? How long does delivery take?$q$,
    $q$Delivery starts once your meal is ready. Some meals are breakfast and some are lunch, so timing depends on the meal. You will get an email when our rider is on the way.$q$,
    70
  ),
  (
    $q$Can I pre-order for tomorrow?$q$,
    $q$Yes. Once tomorrow's menu is published you can order it today from the Tomorrow's Menu section on our website. Delivery starts when the meal is ready, and you will be emailed when the rider is on the way.$q$,
    80
  ),
  (
    $q$What are your opening hours? Are you open on Sundays?$q$,
    $q$We do not have fixed opening hours. We cook according to what is available, and on some days there are no meals at all. Some meals are available on Sundays too. The menu on our website shows what is available for the day, and you can subscribe on the website to be notified when a menu goes live.$q$,
    90
  ),
  (
    $q$How do I pay?$q$,
    $q$After you place your order on the website, you are taken to WhatsApp with a ready-made message. Our team approves your order and then sends you the account details to pay into. Please only pay into the account details our team sends you on WhatsApp.$q$,
    100
  ),
  (
    $q$Do you give refunds?$q$,
    $q$Yes. If your order was approved by mistake, for example the slots were not actually available, or if your payment arrived too late, we refund you. Our team handles refunds on WhatsApp after verifying the order.$q$,
    110
  ),
  (
    $q$What if my food is wrong or spoilt?$q$,
    $q$Please tell us on WhatsApp as soon as you notice. After our team verifies the problem, we will replace the food or refund you, depending on the case.$q$,
    120
  ),
  (
    $q$Do you take bulk or catering orders?$q$,
    $q$Yes. Message us on WhatsApp with what you need and we will continue the conversation there.$q$,
    130
  ),
  (
    $q$Can I pick up my order myself?$q$,
    $q$Yes. You can pick up at our shop in Uyo during one of the pickup windows: 12pm to 1pm, 1pm to 2pm, or 2pm to 3pm. We confirm the exact address with you on WhatsApp.$q$,
    140
  )
) as v(question, answer, sort_order)
where not exists (select 1 from faqs);
