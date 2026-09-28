export interface DeliveryBand {
  min_km: number
  max_km: number
  price: number
}

export interface DeliveryStepConfig {
  step_km: number
  step_price: number
}

export interface DispatchQuote {
  available: boolean
  distanceKm: number
  fee: number | null
  reason?: string
}

const SHOP_LAT = Number(import.meta.env.VITE_SHOP_LAT) || 5.034433
const SHOP_LNG = Number(import.meta.env.VITE_SHOP_LNG) || 7.937081

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Great-circle distance between two lat/lng points, in kilometres. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function distanceFromShopKm(lat: number, lng: number): number {
  return haversineKm(SHOP_LAT, SHOP_LNG, lat, lng)
}

/**
 * Looks up the dispatch fee for a distance from the shop. Bands cover
 * [min_km, max_km); beyond the last band's max_km, the fee steps up by
 * `step.step_price` for every `step.step_km` past it, rounded up.
 */
export function calculateDispatchFee(
  distanceKm: number,
  bands: DeliveryBand[],
  step: DeliveryStepConfig,
  maxDeliveryKm: number,
): DispatchQuote {
  if (distanceKm > maxDeliveryKm) {
    return { available: false, distanceKm, fee: null, reason: 'Outside delivery area' }
  }

  const sorted = [...bands].sort((a, b) => a.min_km - b.min_km)
  const band = sorted.find((b) => distanceKm >= b.min_km && distanceKm < b.max_km)
  if (band) {
    return { available: true, distanceKm, fee: band.price }
  }

  const lastBand = sorted[sorted.length - 1]
  if (!lastBand || distanceKm < lastBand.max_km) {
    return { available: false, distanceKm, fee: null, reason: 'No pricing band covers this distance' }
  }

  const extraKm = distanceKm - lastBand.max_km
  const steps = Math.ceil(extraKm / step.step_km)
  const fee = lastBand.price + steps * step.step_price
  return { available: true, distanceKm, fee }
}
