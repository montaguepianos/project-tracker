import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import * as plannerSync from '@/services/plannerSync'

import { auth, googleProvider, firebaseEnabled } from '@/services/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!firebaseEnabled) {
      setUser(null)
      setLoading(false)
      return
    }
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const uid = useMemo(() => user?.uid ?? null, [user])

  useEffect(() => {
    if (uid) {
      plannerSync.start(uid)
      return () => plannerSync.stop()
    }
    plannerSync.stop()
  }, [uid])

  return {
    user,
    uid,
    loading,
    enabled: firebaseEnabled,
    signInWithGoogle: async () => {
      if (!firebaseEnabled) return
      await signInWithPopup(auth, googleProvider)
    },
    signOut: async () => {
      if (!firebaseEnabled) return
      await signOut(auth)
    },
  }
}


