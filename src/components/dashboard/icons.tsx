import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconOrders(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M8 3.5h8a1 1 0 0 1 1 1V4h1a1 1 0 0 1 1 1v14.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h1v.5a1 1 0 0 0 1 1z" />
      <path d="M9 10.5h6M9 14h6M9 17.5h4" />
    </Base>
  )
}

export function IconCalendar(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M16 2.5v4M8 2.5v4M3.5 10h17" />
    </Base>
  )
}

export function IconBowl(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 12h16a8 8 0 0 1-16 0z" />
      <path d="M12 4v3.2M8.7 5v2.3M15.3 5v2.3" />
    </Base>
  )
}

export function IconUsers(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6" />
      <circle cx="17.2" cy="9.2" r="2.3" />
      <path d="M15 20c.15-2.6 1.7-4.5 3.8-5" />
    </Base>
  )
}

export function IconFileText(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 3h6l4.5 4.5V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M13 3v4.5h4.5" />
      <path d="M9 12.5h6M9 15.5h6M9 9.5h2" />
    </Base>
  )
}

export function IconWallet(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1.2h1.3a1 1 0 0 1 1 1v7.6a1 1 0 0 1-1 1H5.5a2 2 0 0 1-2-2z" />
      <circle cx="16.3" cy="13" r="1.3" fill="currentColor" stroke="none" />
    </Base>
  )
}

export function IconBarChart(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4.5 20V11M11 20V4M17.5 20v-6.5M3.5 20h17" />
    </Base>
  )
}

export function IconTag(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20.3 13.1 11 3.8a1.7 1.7 0 0 0-1.2-.5L4 3.2a.8.8 0 0 0-.8.8l-.1 5.8c0 .45.18.88.5 1.2l9.3 9.3a2 2 0 0 0 2.8 0l4.6-4.6a2 2 0 0 0 0-2.6z" />
      <circle cx="7.7" cy="7.7" r="1.3" fill="currentColor" stroke="none" />
    </Base>
  )
}

export function IconStar(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.3 14.6 8.6l5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.9z" />
    </Base>
  )
}

export function IconBell(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 9.5a6 6 0 0 1 12 0c0 4.6 1.8 5.8 1.8 5.8H4.2S6 14.1 6 9.5z" />
      <path d="M10.2 19a1.8 1.8 0 0 0 3.6 0" />
    </Base>
  )
}

export function IconMail(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.3 6.5 12 13l8.7-6.5" />
    </Base>
  )
}

export function IconSliders(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 6h9M17 6h3M4 12h4M10 12h10M4 18h11M19 18h1" />
      <circle cx="14" cy="6" r="2" />
      <circle cx="7" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </Base>
  )
}

export function IconMore(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  )
}
