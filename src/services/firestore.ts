import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'

import type { PlannerItem, Project } from '@/types'
import { auth, db, firebaseEnabled } from '@/services/firebase'

export function isFirestoreOn(): boolean {
  return firebaseEnabled && Boolean(auth.currentUser)
}

function userRoot(uid: string) {
  return doc(db, 'users', uid)
}

export function subscribeProjects(
  uid: string | null | undefined,
  cb: (projects: Project[]) => void,
): Unsubscribe {
  if (!firebaseEnabled || !uid) return () => {}
  const colRef = collection(userRoot(uid), 'projects')
  return onSnapshot(
    colRef,
    (snap) => {
      const projects: Project[] = snap.docs.map((d) => {
        const data = d.data() as any
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt ?? new Date().toISOString()
        const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt ?? createdAt
        return {
          id: data.id ?? d.id,
          name: data.name ?? '',
          colour: data.colour ?? data.color ?? '#1C7ED6',
          archived: typeof data.archived === 'boolean' ? data.archived : undefined,
          createdAt,
          updatedAt,
        }
      })
      cb(projects)
    },
    (err) => console.error('[firestore] subscribeProjects error', err),
  )
}

export function subscribeItems(
  uid: string | null | undefined,
  cb: (items: PlannerItem[]) => void,
): Unsubscribe {
  if (!firebaseEnabled || !uid) return () => {}
  const colRef = collection(userRoot(uid), 'items')
  return onSnapshot(
    colRef,
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
          notes: data.notes,
          date: data.date ?? '',
          assignee: data.assignee,
          icon: typeof data.icon === 'string' ? data.icon : undefined,
          iconCustom,
          createdAt,
          updatedAt,
        }
      })
      cb(items)
    },
    (err) => console.error('[firestore] subscribeItems error', err),
  )
}

export async function upsertProject(uid: string | null | undefined, project: Project): Promise<void> {
  if (!firebaseEnabled || !uid) return
  const ref = doc(collection(userRoot(uid), 'projects'), project.id)
  const payload: any = {
    id: project.id,
    name: project.name,
    colour: project.colour,
    updatedAt: serverTimestamp(),
  }
  // Optional archived flag not present in Project type yet; ignore for now
  if (!project.createdAt) payload.createdAt = serverTimestamp()
  await setDoc(ref, payload, { merge: true })
}

export async function deleteProject(uid: string | null | undefined, projectId: string): Promise<void> {
  if (!firebaseEnabled || !uid) return
  const ref = doc(collection(userRoot(uid), 'projects'), projectId)
  await deleteDoc(ref)
}

export async function upsertItem(uid: string | null | undefined, item: PlannerItem): Promise<void> {
  if (!firebaseEnabled || !uid) return
  const ref = doc(collection(userRoot(uid), 'items'), item.id)
  const payload: any = {
    id: item.id,
    projectId: item.projectId,
    title: item.title,
    notes: item.notes ?? null,
    date: item.date,
    assignee: item.assignee ?? null,
    icon: item.icon ?? null,
    iconCustom: item.iconCustom ?? null,
    updatedAt: serverTimestamp(),
  }
  if (!item.createdAt) payload.createdAt = serverTimestamp()
  await setDoc(ref, payload, { merge: true })
}

export async function deleteItem(uid: string | null | undefined, itemId: string): Promise<void> {
  if (!firebaseEnabled || !uid) return
  const ref = doc(collection(userRoot(uid), 'items'), itemId)
  await deleteDoc(ref)
}


