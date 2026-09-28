import { useState } from 'react'
import type { MenuCategory } from '../../types/menu'
import type { MenuItemWithVariations, VariationInput } from '../../lib/api/menuItems'
import { createMenuItem, updateMenuItem, uploadMenuItemImage } from '../../lib/api/menuItems'
import { Button } from '../ui/Button'

interface Props {
  item: MenuItemWithVariations | null
  onClose: () => void
  onSaved: () => void
}

interface FormVariation extends VariationInput {
  key: string
}

function toFormVariations(item: MenuItemWithVariations | null): FormVariation[] {
  if (!item || item.menu_item_variations.length === 0) {
    return [{ key: crypto.randomUUID(), label: '', price: 0 }]
  }
  return item.menu_item_variations.map((v) => ({ key: v.id, id: v.id, label: v.label, price: v.price }))
}

export function MenuItemFormModal({ item, onClose, onSaved }: Props) {
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState<MenuCategory>(item?.category ?? 'food')
  const [description, setDescription] = useState(item?.description ?? '')
  const [active, setActive] = useState(item?.active ?? true)
  const [variations, setVariations] = useState<FormVariation[]>(() => toFormVariations(item))
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(item?.image_url ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateVariation(key: string, patch: Partial<FormVariation>) {
    setVariations((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)))
  }

  function addVariation() {
    setVariations((prev) => [...prev, { key: crypto.randomUUID(), label: '', price: 0 }])
  }

  function removeVariation(key: string) {
    setVariations((prev) => (prev.length > 1 ? prev.filter((v) => v.key !== key) : prev))
  }

  function handleFileChange(file: File | null) {
    setImageFile(file)
    if (file) setImagePreview(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    setError(null)
    if (!name.trim()) return setError('Give this item a name.')
    const cleanVariations = variations
      .map((v) => ({ ...v, label: v.label.trim() }))
      .filter((v) => v.label && v.price > 0)
    if (cleanVariations.length === 0) {
      return setError('Add at least one size/variation with a price.')
    }

    setSaving(true)
    try {
      let imageUrl = imagePreview && !imageFile ? imagePreview : null
      if (imageFile) {
        imageUrl = await uploadMenuItemImage(item?.id ?? crypto.randomUUID(), imageFile)
      }

      const payload = {
        name: name.trim(),
        category,
        description: description.trim(),
        imageUrl,
        active,
        variations: cleanVariations,
      }

      if (item) {
        await updateMenuItem(item.id, payload)
      } else {
        await createMenuItem(payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink-900/50" />
      <div className="animate-slide-up relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-3xl">
        <h2 className="text-lg font-semibold text-ink-800">{item ? 'Edit item' : 'Add menu item'}</h2>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-[13px] font-semibold text-ink-500">Photo</label>
            <label className="flex h-36 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-ink-200 bg-ink-50">
              {imagePreview ? (
                <img src={imagePreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[13px] text-ink-400">Tap to upload a photo</span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div>
            <label className="mb-1 block text-[13px] font-semibold text-ink-500">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chicken Curry Sauce with Steamed Rice"
              className="min-h-12 w-full rounded-xl border border-ink-100 px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-[13px] font-semibold text-ink-500">Category</label>
            <div className="flex gap-2">
              {(['food', 'drink'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`min-h-11 flex-1 rounded-xl text-[14px] font-semibold capitalize ${
                    category === c ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[13px] font-semibold text-ink-500">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="A short, appetising description"
              className="w-full rounded-xl border border-ink-100 px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[13px] font-semibold text-ink-500">Sizes / variations</label>
              <button type="button" onClick={addVariation} className="text-[13px] font-semibold text-brand-600">
                + Add size
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {variations.map((v) => (
                <div key={v.key} className="flex items-center gap-2">
                  <input
                    value={v.label}
                    onChange={(e) => updateVariation(v.key, { label: e.target.value })}
                    placeholder="e.g. Big Pack"
                    className="min-h-11 flex-1 rounded-xl border border-ink-100 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <input
                    type="number"
                    min={0}
                    value={v.price || ''}
                    onChange={(e) => updateVariation(v.key, { price: Number(e.target.value) })}
                    placeholder="Price"
                    className="min-h-11 w-28 rounded-xl border border-ink-100 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeVariation(v.key)}
                    disabled={variations.length <= 1}
                    aria-label="Remove size"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-400 disabled:opacity-30"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>

          <label className="flex min-h-11 items-center justify-between rounded-xl bg-ink-50 px-4">
            <span className="text-[14px] font-medium text-ink-700">Active (visible when scheduled)</span>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-5 w-5 accent-brand-500"
            />
          </label>

          {error && <p className="text-[13px] font-medium text-brand-600">{error}</p>}

          <div className="flex gap-2">
            <Button variant="ghost" fullWidth onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button fullWidth onClick={() => void handleSubmit()} disabled={saving}>
              {saving ? 'Saving…' : 'Save item'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
