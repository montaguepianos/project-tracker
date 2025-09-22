import { useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'

const ALLOWED_EMAILS = [
  'leilaelizabethchapman@gmail.com',
  'chappers.coldharbour@googlemail.com',
]

export function useAllowedUser() {
  const { user, loading, signInWithGoogle, signOut, enabled } = useAuth()
  const [verified, setVerified] = useState(false)
  const lastDeniedUidRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setVerified(true)
      return
    }
    if (loading) return

    if (!user) {
      setVerified(true)
      return
    }

    const email = (user.email ?? '').toLowerCase()
    const allowed = ALLOWED_EMAILS.includes(email)

    if (allowed) {
      setVerified(true)
      return
    }

    if (lastDeniedUidRef.current !== user.uid) {
      // Alert once per session per uid
      window.alert('This account is not authorised to use Leila Planner.')
      lastDeniedUidRef.current = user.uid
    }

    ;(async () => {
      try {
        await signOut()
      } finally {
        setVerified(true)
      }
    })()
  }, [enabled, loading, user, signOut])

  const gatedUser = useMemo(() => {
    if (enabled && !verified) return null
    return user
  }, [enabled, verified, user])

  const gatedUid = useMemo(() => (gatedUser ? gatedUser.uid : null), [gatedUser])

  return {
    user: gatedUser,
    uid: gatedUid,
    loading: loading || (enabled && !verified),
    enabled,
    signInWithGoogle,
    signOut,
  }
}


