// "Remember me on this device": the customer's checkout details, kept in
// their own browser (localStorage). Nothing is sent anywhere. Every access is
// wrapped in try/catch because private windows and blocked storage can throw.

const KEY = 'edelicacies.customer.v1'

export interface SavedDetails {
  name: string
  phone: string
  email: string
  deliveryType: 'dispatch' | 'pickup'
  addressText: string
  lat: number | null
  lng: number | null
}

export function loadSavedDetails(): SavedDetails | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<SavedDetails>
    if (typeof d.name !== 'string' || typeof d.phone !== 'string') return null
    return {
      name: d.name,
      phone: d.phone,
      email: typeof d.email === 'string' ? d.email : '',
      deliveryType: d.deliveryType === 'pickup' ? 'pickup' : 'dispatch',
      addressText: typeof d.addressText === 'string' ? d.addressText : '',
      lat: typeof d.lat === 'number' ? d.lat : null,
      lng: typeof d.lng === 'number' ? d.lng : null,
    }
  } catch {
    return null
  }
}

export function saveDetails(details: SavedDetails): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(details))
  } catch {
    /* storage unavailable: the customer simply types details next time */
  }
}

export function clearSavedDetails(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
}
