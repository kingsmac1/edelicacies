import { useEffect, useState } from 'react'
import {
  deleteMenuItem,
  fetchAllMenuItems,
  setMenuItemActive,
  type MenuItemWithVariations,
} from '../../lib/api/menuItems'
import { formatNaira } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { MenuItemFormModal } from '../../components/dashboard/MenuItemFormModal'

export function OwnerMenuItems() {
  const [items, setItems] = useState<MenuItemWithVariations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<MenuItemWithVariations | null | 'new'>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setItems(await fetchAllMenuItems())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load menu items.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleToggleActive(item: MenuItemWithVariations) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, active: !i.active } : i)))
    try {
      await setMenuItemActive(item.id, !item.active)
    } catch {
      void load()
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMenuItem(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete item.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink-800">Menu Items</h1>
        <Button onClick={() => setEditing('new')}>+ Add item</Button>
      </div>

      {error && <p className="mt-4 text-[14px] font-medium text-brand-600">{error}</p>}

      {loading ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-center text-[14px] text-ink-400">
          No menu items yet. Add your first one to get started.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-8">
          {(['food', 'drink'] as const).map((cat) => {
            const catItems = items.filter((i) => i.category === cat)
            if (catItems.length === 0) return null
            return (
              <section key={cat}>
                <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-400">
                  {cat === 'food' ? 'Food' : 'Drinks'}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {catItems.map((item) => (
                    <div key={item.id} className="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-ink-100">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink-100">
                        {item.image_url && (
                          <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[15px] font-semibold text-ink-800">{item.name}</p>
                            {!item.active && (
                              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-400">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[13px] text-ink-500">
                            {item.menu_item_variations
                              .map((v) => `${v.label} ${formatNaira(v.price)}`)
                              .join(' · ') || 'No sizes yet'}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-[13px] font-semibold">
                          <button onClick={() => setEditing(item)} className="text-brand-600">
                            Edit
                          </button>
                          <button onClick={() => void handleToggleActive(item)} className="text-ink-500">
                            {item.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button onClick={() => setDeletingId(item.id)} className="text-ink-400">
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {editing && (
        <MenuItemFormModal
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void load()
          }}
        />
      )}

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Close"
            onClick={() => setDeletingId(null)}
            className="absolute inset-0 bg-ink-900/50"
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <h3 className="text-lg font-semibold text-ink-800">Delete this item?</h3>
            <p className="mt-2 text-[14px] text-ink-400">
              This also removes it from any daily menus it's scheduled on. This can't be undone.
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="ghost" fullWidth onClick={() => setDeletingId(null)}>
                Cancel
              </Button>
              <Button fullWidth onClick={() => void handleDelete(deletingId)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
