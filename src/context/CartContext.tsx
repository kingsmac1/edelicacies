import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface CartLine {
  id: string
  itemId: string
  itemName: string
  image: string
  variationId: string
  variationLabel: string
  unitPrice: number
  quantity: number
  slotsLeft: number
}

interface CartState {
  menuDate: string | null
  lines: CartLine[]
}

interface PendingAdd {
  itemId: string
  itemName: string
  image: string
  variationId: string
  variationLabel: string
  unitPrice: number
  quantity: number
  slotsLeft: number
  menuDate: string
}

interface CartContextValue {
  menuDate: string | null
  lines: CartLine[]
  subtotal: number
  itemCount: number
  conflictDate: string | null
  addLine: (input: PendingAdd) => 'added' | 'conflict'
  removeLine: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  resolveConflict: () => void
  dismissConflict: () => void
}

const STORAGE_KEY = 'edelicacies.cart.v1'

const CartContext = createContext<CartContextValue | null>(null)

function loadInitial(): CartState {
  if (typeof window === 'undefined') return { menuDate: null, lines: [] }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { menuDate: null, lines: [] }
    const parsed = JSON.parse(raw) as CartState
    if (!parsed || !Array.isArray(parsed.lines)) return { menuDate: null, lines: [] }
    return parsed
  } catch {
    return { menuDate: null, lines: [] }
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(loadInitial)
  const [pendingConflict, setPendingConflict] = useState<PendingAdd | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore storage failures (private browsing, quota, etc.)
    }
  }, [state])

  const addLine = (input: PendingAdd): 'added' | 'conflict' => {
    if (state.menuDate && state.menuDate !== input.menuDate && state.lines.length > 0) {
      setPendingConflict(input)
      return 'conflict'
    }
    setState((prev) => {
      const existing = prev.lines.find(
        (l) => l.itemId === input.itemId && l.variationId === input.variationId,
      )
      if (existing) {
        const nextQty = Math.min(existing.quantity + input.quantity, input.slotsLeft)
        return {
          menuDate: input.menuDate,
          lines: prev.lines.map((l) =>
            l.id === existing.id ? { ...l, quantity: nextQty, slotsLeft: input.slotsLeft } : l,
          ),
        }
      }
      const line: CartLine = {
        id: `${input.itemId}:${input.variationId}`,
        itemId: input.itemId,
        itemName: input.itemName,
        image: input.image,
        variationId: input.variationId,
        variationLabel: input.variationLabel,
        unitPrice: input.unitPrice,
        quantity: Math.min(input.quantity, input.slotsLeft),
        slotsLeft: input.slotsLeft,
      }
      return { menuDate: input.menuDate, lines: [...prev.lines, line] }
    })
    return 'added'
  }

  const applyConflictResolution = (input: PendingAdd) => {
    setState({
      menuDate: input.menuDate,
      lines: [
        {
          id: `${input.itemId}:${input.variationId}`,
          itemId: input.itemId,
          itemName: input.itemName,
          image: input.image,
          variationId: input.variationId,
          variationLabel: input.variationLabel,
          unitPrice: input.unitPrice,
          quantity: Math.min(input.quantity, input.slotsLeft),
          slotsLeft: input.slotsLeft,
        },
      ],
    })
    setPendingConflict(null)
  }

  const removeLine = (id: string) => {
    setState((prev) => {
      const lines = prev.lines.filter((l) => l.id !== id)
      return { menuDate: lines.length ? prev.menuDate : null, lines }
    })
  }

  const updateQuantity = (id: string, quantity: number) => {
    setState((prev) => ({
      ...prev,
      lines: prev.lines
        .map((l) => (l.id === id ? { ...l, quantity: Math.max(0, Math.min(quantity, l.slotsLeft)) } : l))
        .filter((l) => l.quantity > 0),
    }))
  }

  const clearCart = () => setState({ menuDate: null, lines: [] })

  const subtotal = useMemo(
    () => state.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    [state.lines],
  )
  const itemCount = useMemo(() => state.lines.reduce((sum, l) => sum + l.quantity, 0), [state.lines])

  const value: CartContextValue = {
    menuDate: state.menuDate,
    lines: state.lines,
    subtotal,
    itemCount,
    conflictDate: pendingConflict?.menuDate ?? null,
    addLine,
    removeLine,
    updateQuantity,
    clearCart,
    resolveConflict: () => {
      if (pendingConflict) applyConflictResolution(pendingConflict)
    },
    dismissConflict: () => setPendingConflict(null),
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
