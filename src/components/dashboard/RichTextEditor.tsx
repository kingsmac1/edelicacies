import { useEffect, useRef, useState } from 'react'

function ToolbarButton({ onClick, label, children }: { onClick: () => void; label: string; children: string }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="min-h-8 min-w-8 rounded-lg px-2 text-[13px] font-semibold text-ink-600 hover:bg-white"
    >
      {children}
    </button>
  )
}

// A small visual editor (contentEditable) with a raw-HTML switch. No extra
// library: bold, italic, lists and links are all we need for emails.
export function RichTextEditor({
  value,
  onChange,
  minHeight = 200,
}: {
  value: string
  onChange: (html: string) => void
  minHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [showSource, setShowSource] = useState(false)

  // Load the value into the editor once, and again when leaving HTML view.
  // Never on every keystroke: that would fight the cursor.
  useEffect(() => {
    if (!showSource && ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSource])

  function exec(command: string, arg?: string) {
    if (document.activeElement !== ref.current) ref.current?.focus()
    document.execCommand(command, false, arg)
    onChange(ref.current?.innerHTML ?? '')
  }

  function addLink() {
    const url = window.prompt('Link address (start with https://):')
    if (url) exec('createLink', url)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-ink-100 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-ink-100 bg-ink-50 px-2 py-1.5">
        {!showSource && (
          <>
            <ToolbarButton onClick={() => exec('bold')} label="Bold">B</ToolbarButton>
            <ToolbarButton onClick={() => exec('italic')} label="Italic">I</ToolbarButton>
            <ToolbarButton onClick={() => exec('underline')} label="Underline">U</ToolbarButton>
            <ToolbarButton onClick={() => exec('insertUnorderedList')} label="Bullet list">• List</ToolbarButton>
            <ToolbarButton onClick={() => exec('insertOrderedList')} label="Numbered list">1. List</ToolbarButton>
            <ToolbarButton onClick={addLink} label="Add link">Link</ToolbarButton>
            <ToolbarButton onClick={() => exec('insertText', '{{name}}')} label="Insert the customer's first name">
              + Name
            </ToolbarButton>
          </>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowSource((v) => !v)}
          className="rounded-lg px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500 hover:bg-white"
        >
          {showSource ? 'Visual' : 'HTML'}
        </button>
      </div>

      {showSource ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={10}
          className="w-full resize-y px-3 py-2.5 font-mono text-[12px] focus:outline-none"
        />
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={() => onChange(ref.current?.innerHTML ?? '')}
          style={{ minHeight }}
          className="px-3 py-2.5 text-[14px] leading-relaxed focus:outline-none [&_a]:text-brand-600 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
        />
      )}
    </div>
  )
}
