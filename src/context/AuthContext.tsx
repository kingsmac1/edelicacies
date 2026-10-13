import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  /** true / false once known; null while we are still checking. */
  isOwner: boolean | null
  /** Owner login (email + password). */
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  /** Customer login step 1: email the customer a 6-digit code. */
  sendLoginCode: (email: string) => Promise<{ error: string | null }>
  /** Customer login step 2: check the code they typed. */
  verifyLoginCode: (email: string, code: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Being logged in is NOT the same as being the owner (customers can log in
  // too). Ask the database. The database enforces this on its own as well;
  // this only decides what the website shows.
  const userId = session?.user.id ?? null
  useEffect(() => {
    if (!userId) {
      setIsOwner(null)
      return
    }
    let cancelled = false
    setIsOwner(null)
    supabase.rpc('is_owner').then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        // PGRST202 = the is_owner function has not been created yet (schema
        // not re-run). Until then only the owner can have an account, so keep
        // the old behaviour rather than locking the owner out.
        setIsOwner(error.code === 'PGRST202')
      } else {
        setIsOwner(Boolean(data))
      }
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const sendLoginCode: AuthContextValue['sendLoginCode'] = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    return { error: error?.message ?? null }
  }

  const verifyLoginCode: AuthContextValue['verifyLoginCode'] = async (email, code) => {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, isOwner, signIn, sendLoginCode, verifyLoginCode, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
