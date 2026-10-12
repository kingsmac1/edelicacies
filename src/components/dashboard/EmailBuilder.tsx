import { useRef, useState } from 'react'
import {
  BLOCK_LABELS,
  BRAND_RED,
  duplicateBlock,
  makeBlock,
  type Align,
  type BlockType,
  type EmailBlock,
} from '../../lib/emailBlocks'
import { RichTextEditor } from './RichTextEditor'

export interface BuilderDish {
  id: string
  name: string
  description: string
  image_url: string | null
}

const inputCls =
  'min-h-10 w-full rounded-xl border border-ink-100 bg-white px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500'

const ADDABLE: BlockType[] = ['heading', 'paragraph', 'image', 'dish', 'button', 'divider', 'spacer']

function AlignPicker({ value, onChange }: { value: Align; onChange: (a: Align) => void }) {
  return (
    <div className="flex gap-1">
      {(['left', 'center', 'right'] as const).map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onChange(a)}
          className={`min-h-9 rounded-lg px-3 text-[12px] font-semibold capitalize ${
            value === a ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-600'
          }`}
        >
          {a}
        </button>
      ))}
    </div>
  )
}

export function EmailBuilder({
  blocks,
  onChange,
  dishes,
  uploadImage,
}: {
  blocks: EmailBlock[]
  onChange: (blocks: EmailBlock[]) => void
  dishes: BuilderDish[]
  uploadImage: (file: File) => Promise<string>
}) {
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingBlock = useRef<string | null>(null)

  function update(id: string, patch: Partial<EmailBlock>) {
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as EmailBlock) : b)))
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...blocks]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  function remove(id: string) {
    onChange(blocks.filter((b) => b.id !== id))
  }

  function pickFile(id: string) {
    pendingBlock.current = id
    fileRef.current?.click()
  }

  async function handleFile(file: File | undefined) {
    const id = pendingBlock.current
    if (!file || !id) return
    setUploadError(null)
    setUploadingId(id)
    try {
      const url = await uploadImage(file)
      update(id, { src: url } as Partial<EmailBlock>)
    } catch {
      setUploadError('Could not upload that image. Please try a smaller JPG or PNG.')
    } finally {
      setUploadingId(null)
    }
  }

  function renderEditor(block: EmailBlock) {
    switch (block.type) {
      case 'heading':
        return (
          <div className="flex flex-col gap-2">
            <input
              className={inputCls}
              value={block.text}
              onChange={(e) => update(block.id, { text: e.target.value })}
              aria-label="Heading text"
            />
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={block.level}
                onChange={(e) => update(block.id, { level: e.target.value as 'h1' | 'h2' | 'h3' })}
                className="min-h-9 rounded-lg border border-ink-100 px-2 text-[13px]"
              >
                <option value="h1">Large</option>
                <option value="h2">Medium</option>
                <option value="h3">Small</option>
              </select>
              <AlignPicker value={block.align} onChange={(align) => update(block.id, { align })} />
            </div>
          </div>
        )

      case 'paragraph':
        return <RichTextEditor value={block.html} onChange={(html) => update(block.id, { html })} minHeight={90} />

      case 'image':
        return (
          <div className="flex flex-col gap-2">
            {block.src && (
              <img src={block.src} alt="" className="max-h-40 w-auto rounded-xl border border-ink-100 object-contain" />
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => pickFile(block.id)}
                className="min-h-10 rounded-xl bg-ink-900 px-4 text-[13px] font-semibold text-white"
              >
                {uploadingId === block.id ? 'Uploading…' : block.src ? 'Replace image' : 'Upload image'}
              </button>
              <select
                value=""
                onChange={(e) => {
                  const dish = dishes.find((d) => d.id === e.target.value)
                  if (dish?.image_url) update(block.id, { src: dish.image_url, alt: dish.name } as Partial<EmailBlock>)
                }}
                className="min-h-10 rounded-xl border border-ink-100 px-2 text-[13px]"
                aria-label="Use a dish photo"
              >
                <option value="">Use a dish photo…</option>
                {dishes
                  .filter((d) => d.image_url)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </div>
            <input
              className={inputCls}
              placeholder="Or paste an image address (https://…)"
              value={block.src}
              onChange={(e) => update(block.id, { src: e.target.value } as Partial<EmailBlock>)}
            />
            <input
              className={inputCls}
              placeholder="Link when clicked (optional)"
              value={block.link}
              onChange={(e) => update(block.id, { link: e.target.value } as Partial<EmailBlock>)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[13px] text-ink-600">
                Width
                <input
                  type="range"
                  min={30}
                  max={100}
                  value={block.width}
                  onChange={(e) => update(block.id, { width: Number(e.target.value) } as Partial<EmailBlock>)}
                />
                {block.width}%
              </label>
              <AlignPicker value={block.align} onChange={(align) => update(block.id, { align } as Partial<EmailBlock>)} />
            </div>
          </div>
        )

      case 'dish':
        return (
          <div className="flex flex-col gap-2">
            <select
              value={block.menuItemId}
              onChange={(e) => {
                const dish = dishes.find((d) => d.id === e.target.value)
                if (dish) {
                  update(block.id, {
                    menuItemId: dish.id,
                    name: dish.name,
                    description: dish.description,
                    imageUrl: dish.image_url ?? '',
                  } as Partial<EmailBlock>)
                }
              }}
              className="min-h-10 rounded-xl border border-ink-100 px-2 text-[14px]"
              aria-label="Choose a dish"
            >
              <option value="">Choose a dish…</option>
              {dishes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {block.name && (
              <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-2">
                {block.imageUrl ? (
                  <img src={block.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-white text-[11px] text-ink-300">
                    No photo
                  </span>
                )}
                <span className="text-[14px] font-semibold text-ink-800">{block.name}</span>
              </div>
            )}
            <label className="flex items-center gap-2 text-[13px] text-ink-600">
              <input
                type="checkbox"
                checked={block.showDescription}
                onChange={(e) => update(block.id, { showDescription: e.target.checked } as Partial<EmailBlock>)}
                className="h-4 w-4 accent-brand-500"
              />
              Show the dish description
            </label>
          </div>
        )

      case 'button':
        return (
          <div className="flex flex-col gap-2">
            <input
              className={inputCls}
              placeholder="Button text"
              value={block.label}
              onChange={(e) => update(block.id, { label: e.target.value } as Partial<EmailBlock>)}
            />
            <input
              className={inputCls}
              placeholder="Where it goes, e.g. https://your-site.com"
              value={block.link}
              onChange={(e) => update(block.id, { link: e.target.value } as Partial<EmailBlock>)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[13px] text-ink-600">
                Colour
                <input
                  type="color"
                  value={block.color || BRAND_RED}
                  onChange={(e) => update(block.id, { color: e.target.value } as Partial<EmailBlock>)}
                  className="h-9 w-12 rounded border border-ink-100"
                />
              </label>
              <AlignPicker value={block.align} onChange={(align) => update(block.id, { align } as Partial<EmailBlock>)} />
            </div>
          </div>
        )

      case 'divider':
        return <p className="text-[13px] text-ink-400">A thin line to separate sections.</p>

      case 'spacer':
        return (
          <label className="flex items-center gap-2 text-[13px] text-ink-600">
            Height
            <input
              type="range"
              min={8}
              max={80}
              value={block.height}
              onChange={(e) => update(block.id, { height: Number(e.target.value) } as Partial<EmailBlock>)}
            />
            {block.height}px
          </label>
        )
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {blocks.length === 0 && (
        <p className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-[14px] text-ink-400">
          Your email is empty. Add a block below.
        </p>
      )}

      {blocks.map((block, index) => (
        <div key={block.id} className="rounded-2xl bg-ink-50 p-3 ring-1 ring-ink-100">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-400">
              {BLOCK_LABELS[block.type]}
            </span>
            <div className="flex gap-1">
              {(
                [
                  ['↑', 'Move up', () => move(index, -1), index === 0],
                  ['↓', 'Move down', () => move(index, 1), index === blocks.length - 1],
                  ['⧉', 'Duplicate', () => onChange([...blocks.slice(0, index + 1), duplicateBlock(block), ...blocks.slice(index + 1)]), false],
                  ['✕', 'Remove', () => remove(block.id), false],
                ] as const
              ).map(([icon, label, action, disabled]) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  title={label}
                  disabled={disabled}
                  onClick={action}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[14px] text-ink-600 ring-1 ring-ink-100 disabled:opacity-30"
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          {renderEditor(block)}
        </div>
      ))}

      {uploadError && <p className="text-[13px] font-medium text-brand-600">{uploadError}</p>}

      <div>
        <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-400">Add a block</p>
        <div className="flex flex-wrap gap-2">
          {ADDABLE.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange([...blocks, makeBlock(type)])}
              className="min-h-10 rounded-full bg-white px-4 text-[13px] font-semibold text-ink-700 ring-1 ring-ink-100 hover:bg-ink-50"
            >
              + {BLOCK_LABELS[type]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
