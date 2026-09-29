import { waLink, WHATSAPP_DISPLAY, WHATSAPP_TEL } from '../../lib/whatsapp'
import logoMark from '../../assets/brand/logo-mark.png'

const currentYear = new Date().getFullYear()

export function Footer() {
  return (
    <footer className="mt-16 border-t border-ink-100 bg-ink-900 px-4 py-10 text-ink-200">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-2">
          <img src={logoMark} alt="" className="h-8 w-auto" />
          <span className="font-display text-xl font-medium text-white">Edelicacies</span>
        </div>
        <p className="mt-3 max-w-sm text-sm leading-relaxed">
          Good for your taste buds. Freshly made food and Tigernut drinks, delivered across Uyo.
        </p>

        <div className="mt-6 grid gap-1 text-sm">
          <a href={WHATSAPP_TEL} className="w-fit py-1 hover:text-white">
            +234 902 146 5560
          </a>
          <a href={waLink('Hi Edelicacies! I have a question.')} className="w-fit py-1 hover:text-white">
            Chat on WhatsApp: {WHATSAPP_DISPLAY}
          </a>
        </div>

        <p className="mt-8 text-xs text-ink-400">
          &copy; {currentYear} Edelicacies. Serving Uyo only, for now.
        </p>
        <p className="mt-2 text-xs text-ink-400">
          Powered by{' '}
          <a
            href="https://emkaydigitals.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white"
          >
            Emkay Digitals
          </a>
        </p>
      </div>
    </footer>
  )
}
