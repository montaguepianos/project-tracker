import { collection, doc, getDoc, setDoc, serverTimestamp, type CollectionReference } from 'firebase/firestore'

import { db, firebaseEnabled } from '@/services/firebase'

export const SYS = { archivedId: 'sys-archived' } as const

function getProjectsCol(uid: string) {
  const base = doc(db, 'users', uid)
  return collection(base, 'projects') as CollectionReference
}

export async function ensureSystemProjects(uid: string | null | undefined) {
  if (!firebaseEnabled || !uid) return
  const { archivedId } = SYS
  const col = getProjectsCol(uid)

  const ensure = async (id: string, name: string) => {
    const ref = doc(col, id)
    const snap = await getDoc(ref)
    if (snap.exists()) return
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

  await ensure(archivedId, 'Archived')
}

export function getArchivedProjectId(): string | null {
  if (!firebaseEnabled) return null
  return SYS.archivedId
}
