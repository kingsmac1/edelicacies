import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { Button } from '../ui/Button'

const pinIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

interface Props {
  lat: number
  lng: number
  onChange: (lat: number, lng: number) => void
}

function DraggableMarker({ lat, lng, onChange }: Props) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng)
    },
  })
  return (
    <Marker
      position={[lat, lng]}
      icon={pinIcon}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target as L.Marker
          const pos = marker.getLatLng()
          onChange(pos.lat, pos.lng)
        },
      }}
    />
  )
}

function FlyToOnLocate({ lat, lng, signal }: { lat: number; lng: number; signal: number }) {
  const map = useMap()
  useEffect(() => {
    if (signal > 0) map.flyTo([lat, lng], 16)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal])
  return null
}

export function LocationPicker({ lat, lng, onChange }: Props) {
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [located, setLocated] = useState(false)
  const [locateSignal, setLocateSignal] = useState(0)

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoError('Location is not available on this device/browser.')
      return
    }
    setLocating(true)
    setGeoError(null)
    setLocated(false)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude)
        setLocating(false)
        setLocated(true)
        setLocateSignal((n) => n + 1)
      },
      () => {
        setGeoError("Couldn't get your location. Drag the pin instead.")
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="md" onClick={useCurrentLocation} disabled={locating} type="button">
          {locating ? 'Locating…' : '📍 Use my current location'}
        </Button>
        {located && (
          <span className="flex items-center gap-1 text-[13px] font-medium text-emerald-600">
            ✓ Location found
          </span>
        )}
      </div>
      {geoError && <p className="mt-2 text-[13px] text-brand-600">{geoError}</p>}

      <div className="mt-3 h-56 w-full overflow-hidden rounded-xl ring-1 ring-ink-100">
        <MapContainer center={[lat, lng]} zoom={14} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <DraggableMarker lat={lat} lng={lng} onChange={onChange} />
          <FlyToOnLocate lat={lat} lng={lng} signal={locateSignal} />
        </MapContainer>
      </div>
      <p className="mt-1.5 text-[12px] text-ink-400">Tap the map or drag the pin to your exact location.</p>
    </div>
  )
}
