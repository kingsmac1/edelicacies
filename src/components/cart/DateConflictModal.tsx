import { useCart } from '../../context/CartContext'
import { Button } from '../ui/Button'

export function DateConflictModal() {
  const { conflictDate, dismissConflict, resolveConflict } = useCart()
  if (!conflictDate) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Close" onClick={dismissConflict} className="absolute inset-0 bg-ink-900/50" />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center">
        <h3 className="text-lg font-semibold text-ink-800">Finish your current order first</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-400">
          Your cart has items from a different menu date. Each order is for one date at a time — start a new
          cart for this date, or keep what you have.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button fullWidth onClick={resolveConflict}>
            Start new cart for this date
          </Button>
          <Button fullWidth variant="ghost" onClick={dismissConflict}>
            Keep my current cart
          </Button>
        </div>
      </div>
    </div>
  )
}
