import { useEffect, useRef } from 'react'

import { subscribeItems, subscribeProjects, isFirestoreOn } from '@/services/firestore'
import { usePlannerStore } from '@/store/plannerStore'

export function usePlannerSync(uid: string | null) {
  const set = usePlannerStore.setState
  const get = usePlannerStore.getState
  const unsubRef = useRef<{ items?: () => void; projects?: () => void }>({})

  useEffect(() => {
    // Teardown existing
    unsubRef.current.items?.()
    unsubRef.current.projects?.()
    unsubRef.current = {}

    if (!uid || !isFirestoreOn()) {
      // Clear on sign-out
      set({ items: [], projects: get().projects.slice(0, 1) })
      return
    }

    unsubRef.current.projects = subscribeProjects(uid, (projects) => {
      const filters = get().filters
      set({ projects: projects.length ? projects : get().projects, filters })
    })
    unsubRef.current.items = subscribeItems(uid, (items) => {
      set({ items })
    })

    return () => {
      unsubRef.current.items?.()
      unsubRef.current.projects?.()
      unsubRef.current = {}
    }
  }, [uid, set])

  return null
}


