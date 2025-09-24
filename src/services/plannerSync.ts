import { onSnapshot, Timestamp, getFirestore, collection, doc, type Unsubscribe } from 'firebase/firestore'

import type { PlannerItem, Project } from '@/types'
import { firebaseEnabled } from '@/services/firebase'
import { usePlannerStore } from '@/store/plannerStore'

let unsubs: { items?: Unsubscribe; projects?: Unsubscribe } = {}

export function start(uid: string) {
  stop()
  if (!firebaseEnabled || !uid) return
  const db = getFirestore()
  const projectsCol = collection(doc(collection(db, 'users'), uid), 'projects')
  const itemsCol = collection(doc(collection(db, 'users'), uid), 'items')

  unsubs.projects = onSnapshot(
    projectsCol,
    (snap) => {
      const projects: Project[] = snap.docs.map((d) => {
        const data = d.data() as any
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt ?? new Date().toISOString()
        const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt ?? createdAt
        return {
          id: data.id ?? d.id,
          name: data.name ?? '',
          colour: data.colour ?? data.color ?? '#1C7ED6',
          createdAt,
          updatedAt,
        }
      })

      usePlannerStore.getState().replaceProjects(projects)
    },
    (err) => console.error('[plannerSync] projects snapshot error', err),
  )

  unsubs.items = onSnapshot(
    itemsCol,
    (snap) => {
      const items: PlannerItem[] = snap.docs.map((d) => {
        const data = d.data() as any
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt ?? new Date().toISOString()
        const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt ?? createdAt
        const iconCustom = data.iconCustom && typeof data.iconCustom === 'object' && data.iconCustom.key
          ? { key: String(data.iconCustom.key), label: String(data.iconCustom.label ?? data.iconCustom.key) }
          : undefined
        return {
          id: data.id ?? d.id,
          projectId: data.projectId ?? '',
          title: data.title ?? '',
          notes: data.notes ?? undefined,
          date: data.date ?? '',
          assignee: data.assignee ?? undefined,
          icon: typeof data.icon === 'string' ? data.icon : undefined,
          iconCustom,
          createdAt,
          updatedAt,
        }
      })
      usePlannerStore.getState().replaceItems(items)
    },
    (err) => console.error('[plannerSync] items snapshot error', err),
  )
}

export function stop() {
  unsubs.items?.()
  unsubs.projects?.()
  unsubs = {}
}
