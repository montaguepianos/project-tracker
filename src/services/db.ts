import {
  collection,
  deleteDoc,
  doc,
  enableIndexedDbPersistence,
  serverTimestamp,
  setDoc,
  type CollectionReference,
} from 'firebase/firestore'

import type { PlannerItem, Project } from '@/types'
import { db } from '@/services/firebase'

export function initPersistence() {
  try {
    // Best-effort offline cache; ignore multi-tab/unsupported errors
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    enableIndexedDbPersistence(db).catch(() => {})
  } catch {}
}

export function getUserRefs(uid: string) {
  const base = doc(db, 'users', uid)
  const projectsCol = collection(base, 'projects') as CollectionReference
  const itemsCol = collection(base, 'items') as CollectionReference
  return { projectsCol, itemsCol }
}

export async function upsertProject(uid: string, project: Project) {
  const { projectsCol } = getUserRefs(uid)
  const ref = doc(projectsCol, project.id)
  const payload: any = {
    id: project.id,
    name: project.name,
    color: project.colour, // map to Firestore 'color'
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


