'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase/lazy'
import type { Profile } from '@/types'
import { fetchOwnProfile } from '@/lib/profile'

interface AuthState {
  /** Signed-in profile, known on the very first paint (the server reads the session cookie) */
  profile: Profile | null
  isLoggedIn: boolean
  isVerified: boolean
  /** Server-verified admin flag (for showing the menu item only) */
  isAdmin: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

/**
 * Session state for the whole app. The server layout resolves the user + profile from the cookie and passes them
 * in, so the header never flashes "Log in / Sign up" for someone who is signed in. After that the browser only
 * listens for real sign-in / sign-out events (a momentary empty session while a token refreshes is ignored).
 */
export function AuthProvider({ initialProfile, initialIsAdmin = false, children }: { initialProfile: Profile | null; initialIsAdmin?: boolean; children: React.ReactNode }) {
  const router = useRouter()
  const qc = useQueryClient()
  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  const busy = useRef(false)
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin)
  useEffect(() => { setIsAdmin(initialIsAdmin) }, [initialIsAdmin])

  // The server re-rendered (login, logout, router.refresh()) → adopt its answer
  useEffect(() => { setProfile(initialProfile) }, [initialProfile])

  // Signing in or out changes whose cart this is. The cart that was cached while browsing as a guest ("guest: true")
  // must not survive a login — it made every Add to cart say "Log in to add items" for someone who was signed in.
  const accountId = initialProfile?.id ?? null
  const lastAccount = useRef(accountId)
  useEffect(() => {
    if (lastAccount.current === accountId) return
    lastAccount.current = accountId
    void qc.invalidateQueries({ queryKey: ['cart'] })
  }, [accountId, qc])

  const refreshProfile = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const supabase = await getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const data = await fetchOwnProfile(supabase, user.id)
      if (data) setProfile(data as Profile)
    } finally {
      busy.current = false
    }
  }, [])

  // Only signed-in visitors need to hear about a sign-out elsewhere; guests never load the Supabase client at all.
  const loggedIn = !!profile
  useEffect(() => {
    if (!loggedIn) return
    let off: (() => void) | undefined
    let cancelled = false
    void getSupabase().then((supabase) => {
      if (cancelled) return
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') { setProfile(null); setIsAdmin(false); router.refresh() }
        else if (event === 'USER_UPDATED') void refreshProfile()
      })
      off = () => subscription.unsubscribe()
    })
    return () => { cancelled = true; off?.() }
  }, [loggedIn, refreshProfile, router])

  const signOut = useCallback(async () => {
    const supabase = await getSupabase()
    await supabase.auth.signOut()
    setProfile(null)
    setIsAdmin(false)
    router.push('/')
    router.refresh()
  }, [router])

  const value = useMemo<AuthState>(() => ({
    profile, isLoggedIn: !!profile, isVerified: profile?.verification_status === 'VERIFIED', isAdmin, refreshProfile, signOut,
  }), [profile, isAdmin, refreshProfile, signOut])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuthState() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuthState must be used inside AuthProvider')
  return ctx
}
