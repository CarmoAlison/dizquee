// Sessão do Supabase + profile + permissões do usuário logado
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TERMS_VERSION } from '../constants/legal'
import { getSession, onAuthChange, signOut as authSignOut } from '../services/authService'
import { flushPendingAvatar, getMyPermissions, getProfile } from '../services/profileService'
import { AuthContext } from './contexts'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const [profile, setProfile] = useState(null)
  const [permissions, setPermissions] = useState([])
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState(null)
  const [isRecovery, setIsRecovery] = useState(false)

  useEffect(() => {
    let active = true
    getSession()
      .then((s) => active && setSession(s))
      .catch(() => active && setSession(null))
      .finally(() => active && setInitializing(false))

    // Importante: não fazer chamadas ao Supabase dentro deste callback.
    const unsubscribe = onAuthChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
      if (event === 'SIGNED_OUT') setIsRecovery(false)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const userId = session?.user?.id

  const loadProfile = useCallback(
    async ({ silent = false } = {}) => {
      if (!userId) {
        setProfile(null)
        setPermissions([])
        return
      }
      if (!silent) setProfileLoading(true)
      try {
        const p = await getProfile(userId)
        const perms = p?.is_staff && p?.is_active && !p?.is_banned ? await getMyPermissions() : []
        setProfile(p)
        setPermissions(perms)
        setProfileError(null)
        if (p && !p.avatar_url) {
          const updated = await flushPendingAvatar(p)
          if (updated) setProfile(updated)
        }
      } catch (error) {
        setProfileError(error)
      } finally {
        if (!silent) setProfileLoading(false)
      }
    },
    [userId],
  )

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  // Ao voltar para a aba, atualiza o profile (ex.: banimento, troca de perfil)
  useEffect(() => {
    if (!userId) return undefined
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadProfile({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId, loadProfile])

  const signOut = useCallback(async () => {
    await authSignOut()
    setProfile(null)
    setPermissions([])
  }, [])

  const value = useMemo(() => {
    const user = session?.user ?? null
    const needsProfileCompletion = Boolean(
      user &&
        profile &&
        (!profile.username ||
          !profile.full_name ||
          !profile.phone ||
          !profile.terms_accepted_at ||
          profile.terms_version !== TERMS_VERSION),
    )
    return {
      session,
      user,
      profile,
      permissions,
      profileError,
      loading: initializing || (Boolean(user) && profileLoading && !profile),
      isAuthenticated: Boolean(user),
      isBanned: Boolean(profile?.is_banned),
      isStaff: Boolean(profile?.is_staff && profile?.is_active && !profile?.is_banned),
      needsProfileCompletion,
      isRecovery,
      refreshProfile: loadProfile,
      setProfile,
      signOut,
    }
  }, [session, profile, permissions, profileError, initializing, profileLoading, isRecovery, loadProfile, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
