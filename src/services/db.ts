import {
  collection,
  deleteDoc,
  doc,
  enableIndexedDbPersistence,
  getDocs,
  limit,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type CollectionReference,
} from 'firebase/firestore'

import type { PlannerItem, Project } from '@/types'
import { db } from '@/services/firebase'
import { SYS } from '@/services/systemProjects'

export function initPersistence() {
  // Best-effort offline cache; ignore multi-tab/unsupported errors
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  enableIndexedDbPersistence(db).catch(() => {})
}

export function getUserRefs(uid: string) {
  const base = doc(db, 'users', uid)
  const projectsCol = collection(base, 'projects') as CollectionReference
  const itemsCol = collection(base, 'items') as CollectionReference
  return { projectsCol, itemsCol }
}

export async function ensureSystemProjects(uid: string) {
  const { projectsCol } = getUserRefs(uid)
  const ensure = async (id: string, name: string) => {
    const ref = doc(projectsCol, id)
    const snap = await getDocs(query(projectsCol, where('id', '==', id)))
    if (!snap.empty) return
    await setDoc(ref, {
      id,
      name,
      color: '#6B7280',
      system: true,
      kind: 'archived',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  await ensure(SYS.archivedId, 'Archived')
}

export async function upsertProject(uid: string, project: Project) {
  const { projectsCol } = getUserRefs(uid)
  const ref = doc(projectsCol, project.id)
  const payload: any = {
    id: project.id,
    name: project.name,
    color: project.colour,
    updatedAt: serverTimestamp(),
  }
  if (!project.createdAt) payload.createdAt = serverTimestamp()
  await setDoc(ref, payload, { merge: true })
}

export async function deleteProject(uid: string, projectId: string) {
  const { projectsCol } = getUserRefs(uid)
  const ref = doc(projectsCol, projectId)
  await deleteDoc(ref)
}

export async function upsertItem(uid: string, item: PlannerItem) {
  const { itemsCol } = getUserRefs(uid)
  const ref = doc(itemsCol, item.id)
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

export async function deleteItem(uid: string, itemId: string) {
  const { itemsCol } = getUserRefs(uid)
  const ref = doc(itemsCol, itemId)
  await deleteDoc(ref)
}

export async function moveProjectToArchived(uid: string, projectId: string, archivedProjectId: string) {
  const { projectsCol, itemsCol } = getUserRefs(uid)
  const max = 400
  // page until empty
  // Firestore has no offset; re-query each time
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await getDocs(query(itemsCol, where('projectId', '==', projectId), limit(max)))
    if (snap.empty) break
    const batch = writeBatch(getFirestore())
    snap.forEach((d) => {
      batch.update(d.ref, { projectId: archivedProjectId, updatedAt: serverTimestamp() })
    })
    await batch.commit()
    if (snap.size < max) break
  }
  await deleteDoc(doc(projectsCol, projectId))
}
