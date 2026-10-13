import { supabase } from './supabase'

// A saved chat as the customer's browser sees it. The conversation id plus a
// secret token (kept only in this browser) is what lets them continue it.
export interface StoredChat {
  conversationId: string
  accessToken: string
}

export interface ChatMeta {
  whatsappUrl?: string | null
  orderNumber?: string | null
  trackUrl?: string | null
  enquirySaved?: boolean
}

export interface ChatMessageOut {
  id: number
  role: 'user' | 'assistant' | 'owner' | 'system'
  content: string
  meta: ChatMeta | null
  created_at: string
}

export type ChatMode = 'ai' | 'owner'

export interface SendResult {
  conversationId: string
  /** Only present when this message started a brand-new conversation. */
  accessToken?: string
  mode: ChatMode
  messages: ChatMessageOut[]
}

const STORAGE_KEY = 'edelicacies.chat.v1'

export function loadStoredChat(): StoredChat | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<StoredChat>
    if (typeof d.conversationId === 'string' && typeof d.accessToken === 'string') {
      return { conversationId: d.conversationId, accessToken: d.accessToken }
    }
    return null
  } catch {
    return null
  }
}

export function saveStoredChat(chat: StoredChat): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chat))
  } catch {
    /* private mode: the chat still works, it just won't survive a refresh */
  }
}

export function clearStoredChat(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* nothing to clear */
  }
}

export class ChatNotFoundError extends Error {}

// supabase.functions.invoke hides the server's message for non-2xx replies;
// this digs it out so we can tell "chat expired" from "server busy".
async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('chat', { body })
  if (error) {
    let status = 0
    let message = error.message
    try {
      const res = (error as { context?: Response }).context
      status = res?.status ?? 0
      const json = await res?.json()
      if (json?.error) message = json.error
    } catch {
      /* keep generic message */
    }
    if (status === 404) throw new ChatNotFoundError(message)
    throw new Error(message)
  }
  const parsed = typeof data === 'string' ? JSON.parse(data) : data
  if (parsed?.error) throw new Error(parsed.error)
  return parsed as T
}

export function sendChatMessage(message: string, chat: StoredChat | null): Promise<SendResult> {
  return invoke<SendResult>({
    message,
    ...(chat ? { conversationId: chat.conversationId, accessToken: chat.accessToken } : {}),
  })
}

export function pollChat(chat: StoredChat, after: number): Promise<{ mode: ChatMode; messages: ChatMessageOut[] }> {
  return invoke({ action: 'poll', conversationId: chat.conversationId, accessToken: chat.accessToken, after })
}
