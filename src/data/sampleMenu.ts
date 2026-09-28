import type { DailyMenu, MenuItem } from '../types/menu'
import { todayLagos } from '../lib/format'

import chickenCurryRice from '../assets/menu/chicken-curry-rice.jpg'
import ofadaSauce from '../assets/menu/ofada-sauce.jpg'
import atamaSoup from '../assets/menu/atama-soup.jpg'
import ofeawku from '../assets/menu/ofeawku.jpg'
import assortedLocalStew from '../assets/menu/assorted-local-stew.jpg'
import chickenPlantainPeppersoup from '../assets/menu/chicken-plantain-peppersoup.jpg'
import nativeRiceChickenWings from '../assets/menu/native-rice-chicken-wings.jpg'
import coconutRiceGizzard from '../assets/menu/coconut-rice-gizzard.jpg'
import beefAfangSoup from '../assets/menu/beef-afang-soup.jpg'
import nativeRiceSnailsDriedfish from '../assets/menu/native-rice-snails-driedfish.jpg'
import pepperedChickenFeet from '../assets/menu/peppered-chicken-feet.jpg'
import egusiSoup from '../assets/menu/egusi-soup.jpg'
import nativeRiceTurkeySnails from '../assets/menu/native-rice-turkey-snails.jpg'
import plantainPottage from '../assets/menu/plantain-pottage.jpg'
import coconutRiceDoubleChicken from '../assets/menu/coconut-rice-double-chicken.jpg'
import catfishPlantainPeppersoup from '../assets/menu/catfish-plantain-peppersoup.jpg'
import afiaEfereEbod from '../assets/menu/afia-efere-ebod.jpg'
import asunJollofRice from '../assets/menu/asun-jollof-rice.jpg'
import smokeyJollofChicken from '../assets/menu/smokey-jollof-chicken.jpg'
import snailChickenStew from '../assets/menu/snail-chicken-stew.jpg'
import snailStew from '../assets/menu/snail-stew.jpg'
import gizdodo from '../assets/menu/gizdodo.jpg'
import eggSauce from '../assets/menu/egg-sauce.jpg'
import afangSoup from '../assets/menu/afang-soup.jpg'
import snailSauce from '../assets/menu/snail-sauce.jpg'
import tigernutCreamy from '../assets/menu/tigernut-creamy.jpg'
import tigernutChocChoo from '../assets/menu/tigernut-choc-choo.jpg'
import tigernutBeeBerry from '../assets/menu/tigernut-bee-berry.jpg'

export const sampleMenuItems: MenuItem[] = [
  {
    id: 'chicken-curry-rice',
    name: 'Chicken Curry Sauce with Steamed Rice',
    category: 'food',
    description: 'Perfectly spiced chicken curry sauce paired with steamed white rice.',
    image: chickenCurryRice,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 5800 }],
  },
  {
    id: 'ofada-sauce',
    name: 'Ofada Sauce',
    category: 'food',
    description: 'Goatmeat, eggs and cowmeat in rich ofada sauce, paired with rice, yam or plantain.',
    image: ofadaSauce,
    active: true,
    variations: [{ id: 'big', label: 'Big Pack', price: 11500 }],
  },
  {
    id: 'atama-soup',
    name: 'Atama Soup',
    category: 'food',
    description: 'Made with snails, stockfish, kpomo, dried fish and goatmeat.',
    image: atamaSoup,
    active: true,
    variations: [{ id: '1litre', label: '1 Litre', price: 20000 }],
  },
  {
    id: 'ofeawku',
    name: 'Ofeawku',
    category: 'food',
    description: 'A hearty pot made with stockfish, dried fish, goatmeat and beef.',
    image: ofeawku,
    active: true,
    variations: [
      { id: 'small', label: 'Small Pack', price: 6000 },
      { id: 'big', label: 'Big Pack', price: 11500 },
    ],
  },
  {
    id: 'assorted-local-stew',
    name: 'Assorted Local Stew',
    category: 'food',
    description: 'Assorted local stew paired with beans and plantain cubes.',
    image: assortedLocalStew,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 6000 }],
  },
  {
    id: 'chicken-plantain-peppersoup',
    name: 'Chicken and Plantain Peppersoup',
    category: 'food',
    description: 'Warm, peppery chicken peppersoup with plantain.',
    image: chickenPlantainPeppersoup,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 6500 }],
  },
  {
    id: 'native-rice-chicken-wings',
    name: 'Native Rice with Chicken Wings',
    category: 'food',
    description: 'Native rice with perfectly sauced chicken wings, egg and plantain cubes.',
    image: nativeRiceChickenWings,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 5800 }],
  },
  {
    id: 'coconut-rice-gizzard',
    name: 'Creamy Coconut Rice with Gizzard',
    category: 'food',
    description: 'Creamy coconut rice with gizzard and goatmeat.',
    image: coconutRiceGizzard,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 10000 }],
  },
  {
    id: 'beef-afang-soup',
    name: 'Beef Afang Soup',
    category: 'food',
    description: 'Classic afang soup made with beef.',
    image: beefAfangSoup,
    active: true,
    variations: [
      { id: 'regular', label: 'Regular', price: 5800 },
      { id: '3litre', label: '3 Litres', price: 58000 },
    ],
  },
  {
    id: 'native-rice-snails-driedfish',
    name: 'Native Rice with Snails & Dried Fish',
    category: 'food',
    description: 'Native rice with snails, kpomo and dried fish.',
    image: nativeRiceSnailsDriedfish,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 12000 }],
  },
  {
    id: 'peppered-chicken-feet',
    name: 'Peppered Chicken Feet',
    category: 'food',
    description: 'Spicy peppered chicken feet, 10 pieces.',
    image: pepperedChickenFeet,
    active: true,
    variations: [{ id: '10pcs', label: '10 pcs', price: 4500 }],
  },
  {
    id: 'egusi-soup',
    name: 'Egusi Soup',
    category: 'food',
    description: 'Rich, well-seasoned egusi soup.',
    image: egusiSoup,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 6000 }],
  },
  {
    id: 'native-rice-turkey-snails',
    name: 'Native Rice with Turkey & Snails',
    category: 'food',
    description: 'Native rice with sauced turkey, snails and egg.',
    image: nativeRiceTurkeySnails,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 16000 }],
  },
  {
    id: 'plantain-pottage',
    name: 'Plantain Pottage',
    category: 'food',
    description: 'Made with smoked fish, snails, goatmeat and kpomo.',
    image: plantainPottage,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 9000 }],
  },
  {
    id: 'coconut-rice-double-chicken',
    name: 'Creamy Coconut Rice with Double Chicken',
    category: 'food',
    description: 'Creamy coconut rice with double chicken and egg.',
    image: coconutRiceDoubleChicken,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 11500 }],
  },
  {
    id: 'catfish-plantain-peppersoup',
    name: 'Catfish & Plantain Peppersoup',
    category: 'food',
    description: 'Catfish and plantain peppersoup paired with steamed rice.',
    image: catfishPlantainPeppersoup,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 10000 }],
  },
  {
    id: 'afia-efere-ebod',
    name: 'Afia Efere Ebod',
    category: 'food',
    description: 'Traditional white soup, made the authentic way.',
    image: afiaEfereEbod,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 16000 }],
  },
  {
    id: 'asun-jollof-rice',
    name: 'Asun Jollof Rice',
    category: 'food',
    description: 'Smoky jollof rice with asun and plantain cubes.',
    image: asunJollofRice,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 9000 }],
  },
  {
    id: 'smokey-jollof-chicken',
    name: 'Smokey Jollof Rice with Peppered Chicken',
    category: 'food',
    description: 'Smokey jollof rice with peppered chicken and plantain cubes.',
    image: smokeyJollofChicken,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 6000 }],
  },
  {
    id: 'snail-chicken-stew',
    name: 'Snail and Chicken Stew',
    category: 'food',
    description: 'Rich stew loaded with snail and chicken.',
    image: snailChickenStew,
    active: true,
    variations: [
      { id: '1litre', label: '1 Litre', price: 25000 },
      { id: '2litre', label: '2 Litres', price: 48000 },
    ],
  },
  {
    id: 'snail-stew',
    name: 'Snail Stew',
    category: 'food',
    description: 'Soulfully made snail stew.',
    image: snailStew,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 6000 }],
  },
  {
    id: 'gizdodo',
    name: 'Gizdodo',
    category: 'food',
    description: 'Gizzard and dodo (fried plantain) tossed in sauce.',
    image: gizdodo,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 5000 }],
  },
  {
    id: 'egg-sauce',
    name: 'Egg Sauce',
    category: 'food',
    description: 'Rich, home-style egg sauce.',
    image: eggSauce,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 12000 }],
  },
  {
    id: 'afang-soup',
    name: 'Afang Soup',
    category: 'food',
    description: 'Classic afang soup, made fresh.',
    image: afangSoup,
    active: true,
    variations: [{ id: '3litre', label: '3 Litres', price: 58000 }],
  },
  {
    id: 'snail-sauce',
    name: 'Snail Sauce',
    category: 'food',
    description: 'Snails cooked down in a rich sauce.',
    image: snailSauce,
    active: true,
    variations: [{ id: 'regular', label: 'Regular', price: 6000 }],
  },
  {
    id: 'tigernut-creamy',
    name: 'Creamy Tigernut Juice',
    category: 'drink',
    description: 'Our signature creamy tigernut juice, chilled and naturally sweet.',
    image: tigernutCreamy,
    active: true,
    variations: [
      { id: 'bottle', label: 'Bottle', price: 2500 },
      { id: 'pack10', label: 'Pack of 10', price: 23000 },
    ],
  },
  {
    id: 'tigernut-choc-choo',
    name: 'Choc Choo Tigernut Juice',
    category: 'drink',
    description: 'Tigernut juice blended with rich chocolate.',
    image: tigernutChocChoo,
    active: true,
    variations: [
      { id: 'bottle', label: 'Bottle', price: 2500 },
      { id: 'pack10', label: 'Pack of 10', price: 23000 },
    ],
  },
  {
    id: 'tigernut-bee-berry',
    name: 'Bee Berry Tigernut Juice',
    category: 'drink',
    description: 'Tigernut juice with a fruity berry twist, naturally sweetened with honey.',
    image: tigernutBeeBerry,
    active: true,
    variations: [
      { id: 'bottle', label: 'Bottle', price: 2500 },
      { id: 'pack10', label: 'Pack of 10', price: 23000 },
    ],
  },
]

export function buildSampleDailyMenu(): DailyMenu {
  const date = todayLagos()
  return {
    date,
    items: sampleMenuItems,
    slots: sampleMenuItems.flatMap((item) =>
      item.variations.map((v, idx) => {
        const total = item.category === 'drink' ? 30 : 10 + (idx === 0 ? 5 : 0)
        // A couple of items are deliberately low / sold out to show those states.
        const left =
          item.id === 'peppered-chicken-feet'
            ? 0
            : item.id === 'egg-sauce'
              ? 2
              : total
        return {
          itemId: item.id,
          variationId: v.id,
          slotsTotal: total,
          slotsLeft: left,
          showSlots: true,
        }
      }),
    ),
  }
}
