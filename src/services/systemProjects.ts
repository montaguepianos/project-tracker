import { collection, doc, getDoc, setDoc, serverTimestamp, type CollectionReference } from 'firebase/firestore'

import { db, firebaseEnabled } from '@/services/firebase'

export const SYS = { generalId: 'sys-general', archivedId: 'sys-archived' } as const

function getProjectsCol(uid: string) {
  const base = doc(db, 'users', uid)
  return collection(base, 'projects') as CollectionReference
}

export async function ensureSystemProjects(uid: string | null | undefined) {
  if (!firebaseEnabled || !uid) return
  const { generalId, archivedId } = SYS
  const col = getProjectsCol(uid)

  const ensure = async (id: string, name: string, kind: 'default' | 'archived') => {
    const ref = doc(col, id)
    const snap = await getDoc(ref)
    if (snap.exists()) return
    await setDoc(ref, {
      id,
      name,
      color: kind === 'archived' ? '#6B7280' : '#1C7ED6',
      system: true,
      kind,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  await Promise.all([
    ensure(generalId, 'General', 'default'),
    ensure(archivedId, 'Archived', 'archived'),
  ])
}

export function getArchivedProjectId(): string | null {
  if (!firebaseEnabled) return null
  return SYS.archivedId
}


