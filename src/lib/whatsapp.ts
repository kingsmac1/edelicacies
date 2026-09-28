const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '2349021465560'

export function waLink(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`
  if (!message) return base
  return `${base}?text=${encodeURIComponent(message)}`
}

export const WHATSAPP_DISPLAY = '+234 902 146 5560'
export const WHATSAPP_TEL = 'tel:+2349021465560'
