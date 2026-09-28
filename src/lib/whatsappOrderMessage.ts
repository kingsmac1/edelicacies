import type { CartLine } from '../context/CartContext'
import { formatNaira, formatDateLong } from './format'

export interface WhatsAppOrderInput {
  orderNumber: string
  customerName: string
  customerPhone: string
  lines: CartLine[]
  subtotal: number
  discountAmount: number
  discountCode: string | null
  deliveryType: 'dispatch' | 'pickup'
  dispatchFeeEstimate: number | null
  pickupWindowLabel: string | null
  total: number
  addressText: string | null
  addressLat: number | null
  addressLng: number | null
  menuDate: string
}

export function buildWhatsAppOrderMessage(input: WhatsAppOrderInput): string {
  const itemLines = input.lines
    .map((l) => `• ${l.itemName} (${l.variationLabel}) × ${l.quantity} — ${formatNaira(l.unitPrice * l.quantity)}`)
    .join('\n')

  const parts = [
    `*New order ${input.orderNumber}*`,
    `${input.customerName} · ${input.customerPhone}`,
    '',
    itemLines,
    '',
    `Subtotal: ${formatNaira(input.subtotal)}`,
  ]

  if (input.discountAmount > 0) {
    parts.push(`Discount (${input.discountCode}): -${formatNaira(input.discountAmount)}`)
  }

  if (input.deliveryType === 'dispatch') {
    parts.push(
      `Dispatch fee (estimate): ${input.dispatchFeeEstimate != null ? formatNaira(input.dispatchFeeEstimate) : 'TBC'}`,
    )
  } else {
    parts.push(`Pickup time: ${input.pickupWindowLabel ?? 'TBC'}`)
  }

  parts.push(`*Total: ${formatNaira(input.total)}*`)
  parts.push('')
  parts.push(`Menu date: ${formatDateLong(input.menuDate)}`)

  if (input.deliveryType === 'dispatch') {
    if (input.addressText) parts.push(`Address: ${input.addressText}`)
    if (input.addressLat != null && input.addressLng != null) {
      parts.push(`Map: https://maps.google.com/?q=${input.addressLat},${input.addressLng}`)
    }
  }

  return parts.join('\n')
}
