export type MenuCategory = 'food' | 'drink'

export interface MenuVariation {
  id: string
  label: string
  price: number
}

export interface MenuItem {
  id: string
  name: string
  category: MenuCategory
  description: string
  image: string
  variations: MenuVariation[]
  active: boolean
}

export interface DailySlot {
  itemId: string
  variationId: string
  slotsTotal: number
  slotsLeft: number
  showSlots: boolean
}

export interface DailyMenu {
  date: string
  items: MenuItem[]
  slots: DailySlot[]
}
