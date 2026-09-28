export interface MenuItemRow {
  id: string
  name: string
  category: 'food' | 'drink'
  description: string
  image_url: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface MenuItemVariationRow {
  id: string
  menu_item_id: string
  label: string
  price: number
  sort_order: number
  created_at: string
}

export interface DailyMenuRow {
  id: string
  menu_date: string
  published: boolean
  created_at: string
}

export interface DailyMenuSlotRow {
  id: string
  daily_menu_id: string
  menu_item_id: string
  variation_id: string
  slots_total: number
  slots_left: number
  show_slots: boolean
}

export interface AnnouncementBannerSetting {
  enabled: boolean
  text: string
}

export interface BusinessHoursSetting {
  text: string
}

export interface ShopLocationSetting {
  lat: number
  lng: number
}

export interface SlotHoldSetting {
  minutes: number
}

export interface ReviewDelaySetting {
  hours: number
}

export interface MaxDeliverySetting {
  km: number
}

export interface DeliveryStepSetting {
  step_km: number
  step_price: number
}

export interface PickupInstructionsSetting {
  text: string
}

export interface OwnerEmailSetting {
  email: string
}

export type ExpenseCategoriesSetting = string[]

export interface SettingsMap {
  announcement_banner: AnnouncementBannerSetting
  business_hours: BusinessHoursSetting
  shop_location: ShopLocationSetting
  slot_hold_minutes: SlotHoldSetting
  review_delay_hours: ReviewDelaySetting
  max_delivery_km: MaxDeliverySetting
  delivery_step: DeliveryStepSetting
  pickup_instructions: PickupInstructionsSetting
  owner_email: OwnerEmailSetting
  expense_categories: ExpenseCategoriesSetting
}

export type OrderStatus =
  | 'awaiting_payment'
  | 'paid'
  | 'preparing'
  | 'out_for_delivery'
  | 'ready_for_pickup'
  | 'delivered'
  | 'cancelled'

export interface DeliveryBandRow {
  id: string
  min_km: number
  max_km: number
  price: number
  sort_order: number
}

export interface PickupWindowRow {
  id: string
  label: string
  sort_order: number
  active: boolean
}

export interface OrderRow {
  id: string
  order_number: string
  menu_date: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  delivery_type: 'dispatch' | 'pickup'
  address_text: string | null
  address_lat: number | null
  address_lng: number | null
  pickup_window_id: string | null
  dispatch_fee_estimate: number | null
  dispatch_fee_final: number | null
  subtotal: number
  discount_code: string | null
  discount_amount: number
  total: number
  status: OrderStatus
  note: string | null
  created_at: string
  updated_at: string
  auto_cancel_at: string | null
  delivered_at: string | null
  review_requested_at: string | null
}

export interface OrderItemRow {
  id: string
  order_id: string
  menu_item_id: string | null
  variation_id: string | null
  item_name: string
  variation_label: string
  unit_price: number
  quantity: number
  menu_date: string
}

export interface CustomerRow {
  id: string
  phone: string
  name: string | null
  email: string | null
  first_order_at: string
  last_order_at: string
  orders_count: number
  total_spent: number
  updated_at: string
}

export interface DiscountCodeRow {
  id: string
  code: string
  percent_off: number | null
  fixed_off: number | null
  start_date: string | null
  end_date: string | null
  max_uses: number | null
  used_count: number
  min_order_amount: number | null
  active: boolean
  created_at: string
}

export interface ReviewRow {
  id: string
  order_id: string
  customer_name: string | null
  rating: number
  comment: string | null
  show_on_site: boolean
  created_at: string
}

export interface SubscriberRow {
  id: string
  name: string | null
  email: string
  whatsapp: string | null
  unsubscribed: boolean
  created_at: string
}

export interface ManualSaleRow {
  id: string
  sale_date: string
  customer_name: string | null
  customer_phone: string | null
  items_text: string | null
  amount: number
  delivery_fee: number
  payment_method: string | null
  note: string | null
  paid: boolean
  created_at: string
}

export interface ExpenseRow {
  id: string
  expense_date: string
  category: string
  amount: number
  note: string | null
  created_at: string
}
