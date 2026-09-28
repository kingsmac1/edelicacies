import { useSettings } from '../../hooks/useSettings'

export function AnnouncementBar() {
  const settings = useSettings()
  if (!settings.announcement_banner.enabled) return null

  return (
    <div className="bg-ink-900 px-4 py-2 text-center text-[13px] font-medium text-white">
      {settings.announcement_banner.text}
    </div>
  )
}
