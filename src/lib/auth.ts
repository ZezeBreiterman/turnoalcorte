/**
 * Auth helpers — data primitives only. No react-router imports here.
 * Loaders in router.tsx call these and handle redirects themselves.
 *
 * Critical invariant: having a valid session (magic link) does NOT grant dashboard
 * access. The user must also have a row in `profiles`. This prevents anyone who
 * receives a magic link from accessing the dashboard without being provisioned.
 */
import { supabase } from './supabase'
import { setSentryUser, clearSentryUser } from './sentry'
import type { DbProfile } from '@/types/supabase'

export type Profile = DbProfile

// ── In-memory cache ───────────────────────────────────────────────────────────
// Avoids hitting Supabase on every loader call during the same session.
// Cleared on SIGNED_OUT event.
let _profileCache: Profile | null = null

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    _profileCache = null
  }
})

// ── Primitives ────────────────────────────────────────────────────────────────

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/** Fetch profile from DB. Returns null if no session or no profile row. */
export async function getProfile(): Promise<Profile | null> {
  if (_profileCache) return _profileCache

  const session = await getSession()
  if (!session) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (error || !data) return null

  _profileCache = data as Profile
  setSentryUser(_profileCache.id, _profileCache.role)
  return _profileCache
}

export function invalidateProfileCache() {
  _profileCache = null
}

export async function signOut() {
  clearSentryUser()
  invalidateProfileCache()
  await supabase.auth.signOut()
}
