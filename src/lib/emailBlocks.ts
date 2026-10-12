// The data behind the dashboard's email builder (Messaging -> Email builder).
// Each block is a plain object the builder edits; blocksToHtml is the only
// place that turns them into the HTML string that is emailed. The "Simple"
// writing mode produces the same kind of HTML string, so the server never
// needs to know which mode wrote a message.

export type Align = 'left' | 'center' | 'right'

export type EmailBlock =
  | { id: string; type: 'heading'; text: string; level: 'h1' | 'h2' | 'h3'; align: Align }
  | { id: string; type: 'paragraph'; html: string }
  | { id: string; type: 'image'; src: string; alt: string; link: string; width: number; align: Align }
  | {
      id: string
      type: 'dish'
      menuItemId: string
      name: string
      description: string
      imageUrl: string
      showDescription: boolean
    }
  | { id: string; type: 'button'; label: string; link: string; color: string; align: Align }
  | { id: string; type: 'divider' }
  | { id: string; type: 'spacer'; height: number }

export type BlockType = EmailBlock['type']

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: 'Heading',
  paragraph: 'Text',
  image: 'Image',
  dish: 'Dish card',
  button: 'Button',
  divider: 'Divider',
  spacer: 'Space',
}

export const BRAND_RED = '#ff002c'

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

export function makeBlock(type: BlockType): EmailBlock {
  const id = newId()
  switch (type) {
    case 'heading':
      return { id, type, text: 'Your headline here', level: 'h2', align: 'left' }
    case 'paragraph':
      return { id, type, html: 'Hi {{name}}, write your message here…' }
    case 'image':
      return { id, type, src: '', alt: '', link: '', width: 100, align: 'center' }
    case 'dish':
      return { id, type, menuItemId: '', name: '', description: '', imageUrl: '', showDescription: true }
    case 'button':
      return { id, type, label: 'Order now', link: '', color: BRAND_RED, align: 'left' }
    case 'divider':
      return { id, type }
    case 'spacer':
      return { id, type, height: 24 }
  }
}

export function defaultBlocks(): EmailBlock[] {
  return [makeBlock('heading'), makeBlock('paragraph')]
}

export function duplicateBlock(block: EmailBlock): EmailBlock {
  return { ...block, id: newId() }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

const HEADING_SIZE = { h1: '28px', h2: '22px', h3: '18px' } as const

function blockToHtml(block: EmailBlock): string {
  switch (block.type) {
    case 'heading':
      return `<${block.level} style="margin:0 0 16px;font-size:${HEADING_SIZE[block.level]};line-height:1.3;color:#121216;text-align:${block.align};">${esc(block.text)}</${block.level}>`

    case 'paragraph':
      return `<div style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2b2b33;">${block.html}</div>`

    case 'image': {
      if (!block.src) return ''
      const img = `<img src="${esc(block.src)}" alt="${esc(block.alt)}" style="display:block;width:${block.width}%;max-width:100%;border-radius:12px;margin:${block.align === 'center' ? '0 auto' : block.align === 'right' ? '0 0 0 auto' : '0'};" />`
      const wrapped = block.link ? `<a href="${esc(block.link)}" target="_blank" rel="noopener noreferrer">${img}</a>` : img
      return `<div style="margin:0 0 16px;text-align:${block.align};">${wrapped}</div>`
    }

    case 'dish': {
      if (!block.name) return ''
      const photo = block.imageUrl
        ? `<img src="${esc(block.imageUrl)}" alt="${esc(block.name)}" style="display:block;width:100%;max-width:100%;border-radius:12px;margin:0 0 10px;" />`
        : ''
      const desc =
        block.showDescription && block.description
          ? `<div style="margin:4px 0 0;font-size:14px;color:#6b6b75;">${esc(block.description)}</div>`
          : ''
      return `<div style="margin:0 0 20px;">${photo}<div style="font-size:17px;font-weight:700;color:#121216;">${esc(block.name)}</div>${desc}</div>`
    }

    case 'button':
      if (!block.link) return ''
      return `<div style="margin:0 0 16px;text-align:${block.align};"><a href="${esc(block.link)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${esc(block.color)};color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;padding:12px 28px;border-radius:999px;">${esc(block.label)}</a></div>`

    case 'divider':
      return `<hr style="margin:24px 0;border:none;border-top:1px solid #e6e6e8;" />`

    case 'spacer':
      return `<div style="height:${block.height}px;line-height:${block.height}px;font-size:1px;">&nbsp;</div>`
  }
}

export function blocksToHtml(blocks: EmailBlock[]): string {
  return blocks.map(blockToHtml).filter(Boolean).join('\n')
}

// Close copy of what the server wraps around the message, for the preview.
export function previewShell(bodyHtml: string): string {
  const sample = bodyHtml.replace(/\{\{\s*name\s*\}\}/gi, 'Ekaette')
  return `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:-apple-system,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
      <div style="text-align:center;margin-bottom:24px;"><span style="font-size:24px;font-weight:700;color:${BRAND_RED};">Edelicacies</span></div>
      <div style="background:#fff;border-radius:16px;padding:24px;color:#121216;line-height:1.55;font-size:15px;">${sample || '<p style="color:#9a9aa2">Your message will appear here.</p>'}</div>
      <p style="text-align:center;color:#9a9aa2;font-size:11px;margin-top:16px;">
        You are receiving this because you ordered from, or signed up for updates from, Edelicacies. Unsubscribe<br />WhatsApp us
      </p>
    </div></body></html>`
}
