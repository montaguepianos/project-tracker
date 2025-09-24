import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import { del, get, set as idbSet } from 'idb-keyval'
import { nanoid } from 'nanoid'
import { firebaseEnabled, auth } from '@/services/firebase'
import { SYS } from '@/services/systemProjects'
import { upsertProject as remoteUpsertProject, upsertItem as remoteUpsertItem, deleteItem as remoteDeleteItem, moveProjectToArchived } from '@/services/db'

import type { DateRangePreset, PlannerItem, PlannerView, Project } from '@/types'
import { deriveColour } from '@/lib/colour'
import { getThisMonthRange } from '@/lib/date'
import { formatISODate } from '@/lib/string'

export type DateRange = {
  start: string
  end: string
  preset: DateRangePreset
}

export type Filters = {
  projectFilterMode: 'all' | 'include'
  projectIds: string[]
  search: string
  range: DateRange
}

type UndoState = {
  item: PlannerItem
} | null

type PlannerStore = {
  items: PlannerItem[]
  projects: Project[]
  view: PlannerView
  referenceDate: string
  focusedDate: string
  filters: Filters
  undo: UndoState
  setView: (view: PlannerView) => void
  setReferenceDate: (date: string) => void
  setFocusedDate: (date: string) => void
  setFilters: (updater: (prev: Filters) => Filters) => void
  toggleProjectVisibility: (projectId: string) => void
  selectAllProjects: () => void
  clearProjectSelection: () => void
  addProject: (input: { name: string; colour: string }) => string
  updateProject: (id: string, input: { name: string; colour: string }) => void
  deleteProject: (id: string) => void
  upsertItem: (input: Omit<PlannerItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => string
  deleteItem: (id: string) => void
  restoreLastDeleted: () => void
  replaceProjects: (projects: Project[]) => void
  replaceItems: (items: PlannerItem[]) => void
}

const storage = {
  getItem: async (name: string) => {
    const value = await get<string>(name)
    return value ?? null
  },
  setItem: async (name: string, value: string) => {
    await idbSet(name, value)
  },
  removeItem: async (name: string) => {
    await del(name)
  },
}

function areArraysEqual(a: string[], b: string[]) {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false
  }
  return true
}

function areRangesEqual(a: DateRange, b: DateRange) {
  return a.start === b.start && a.end === b.end && a.preset === b.preset
}

function areFiltersEqual(a: Filters, b: Filters) {
  return (
    a.projectFilterMode === b.projectFilterMode &&
    areArraysEqual(a.projectIds, b.projectIds) &&
    a.search === b.search &&
    areRangesEqual(a.range, b.range)
  )
}

const initialRange = () => {
  const { start, end } = getThisMonthRange()
  return {
    start: formatISODate(start),
    end: formatISODate(end),
    preset: 'this-month' as DateRangePreset,
  }
}

const initialFilters = (): Filters => ({
  projectFilterMode: 'all',
  projectIds: [],
  search: '',
  range: initialRange(),
})

function createDefaultProject(): Project {
  const now = new Date().toISOString()
  return {
    id: SYS.archivedId,
    name: 'Archived',
    colour: '#6B7280',
    createdAt: now,
    updatedAt: now,
  }
}

type PersistedStateV1 = {
  items?: unknown
  projects?: Project[]
  colourOverrides?: Record<string, string>
}

type PersistedStateV2 = {
  items: PlannerItem[]
  projects: Project[]
}

type LegacyItem = {
  id?: string
  project?: string
  title?: string
  notes?: string
  date?: string
  assignee?: string
  colour?: string
  icon?: string
  iconCustom?: {
    key?: string
    label?: string
  }
  createdAt?: string
  updatedAt?: string
}

function sanitizeProjectIds(ids: string[], projects: Project[]) {
  if (ids.length === 0) return []
  const allowed = new Set(projects.map((project) => project.id))
  return ids.filter((id) => allowed.has(id))
}

function normaliseArchivedState(state: PersistedStateV2): PersistedStateV2 {
  const archivedId = SYS.archivedId
  const nowIso = new Date().toISOString()
  const rawItems = state.items ?? []
  const rawProjects = state.projects ?? []

  const legacyArchivedCandidates = rawProjects.filter(
    (project) => project.id !== archivedId && project.name.trim().toLowerCase() === 'archived',
  )
  const legacyArchivedIds = new Set(legacyArchivedCandidates.map((project) => project.id))

  const archivedWithTargetId = rawProjects.find((project) => project.id === archivedId)
  const archivedSource = archivedWithTargetId ?? legacyArchivedCandidates[0]

  const archivedProject: Project = archivedSource

    ? {
        ...archivedSource,
        id: archivedId,
        name: archivedSource.name?.trim() || 'Archived',
        colour: archivedSource.colour || '#6B7280',
        createdAt: archivedSource.createdAt ?? nowIso,
        updatedAt: archivedSource.updatedAt ?? archivedSource.createdAt ?? nowIso,
      }
    : createDefaultProject()

  const normalisedItems = rawItems.map((item) => {
    if (item.projectId === archivedId) {
      return item
    }
    if (legacyArchivedIds.has(item.projectId)) {
      return {
        ...item,
        projectId: archivedId,
        updatedAt: nowIso,
      }
    }
    return item
  })

  const otherProjects = rawProjects.filter(
    (project) => project.id !== archivedId && !legacyArchivedIds.has(project.id),
  )

  const dedupedOthers: Project[] = []
  const seen = new Set<string>()
  for (const project of otherProjects) {
    if (seen.has(project.id)) continue
    seen.add(project.id)
    dedupedOthers.push(project)
  }

  return {
    items: normalisedItems,
    projects: [...dedupedOthers, archivedProject],
  }
}

function ensureFiltersConsistency(filters: Filters, projects: Project[]): Filters {
  const cleanIds = sanitizeProjectIds(filters.projectIds, projects)
  const uniqueIds = Array.from(new Set(cleanIds))
  const archivedId = SYS.archivedId
  const nonArchivedIds = projects
    .filter((project) => project.id !== archivedId)
    .map((project) => project.id)
  const totalNonArchived = nonArchivedIds.length

  if (filters.projectFilterMode === 'include') {
    const includesArchived = uniqueIds.includes(archivedId)
    const selectedNonArchived = uniqueIds.filter((id) => id !== archivedId).length

    if (!includesArchived && selectedNonArchived === totalNonArchived) {
      return { ...filters, projectFilterMode: 'all', projectIds: [] }
    }

    return { ...filters, projectIds: uniqueIds }
  }

  return {
    ...filters,
    projectIds: [],
    projectFilterMode: 'all',
  }
}

export const usePlannerStore = create<PlannerStore>()(
  devtools(
    persist(
      (set, getState) => ({
        items: [],
        projects: [createDefaultProject()],
        view: 'month',
        referenceDate: formatISODate(new Date()),
        focusedDate: formatISODate(new Date()),
        filters: initialFilters(),
        undo: null,
        setView: (view) =>
          set((state) => (state.view === view ? state : { view })),
        setReferenceDate: (date) =>
          set((state) => (state.referenceDate === date ? state : { referenceDate: date })),
        setFocusedDate: (date) =>
          set((state) => (state.focusedDate === date ? state : { focusedDate: date })),
        setFilters: (updater) =>
          set((state) => {
            const next = updater(state.filters)
            if (areFiltersEqual(next, state.filters)) {
              return state
            }

            const consistent = ensureFiltersConsistency(next, state.projects)
            if (areFiltersEqual(consistent, state.filters)) {
              return state
            }

            return { filters: consistent }
          }),
        toggleProjectVisibility: (projectId) =>
          set((state) => {
            const exists = state.projects.some((project) => project.id === projectId)
            if (!exists) return state

            if (state.filters.projectFilterMode === 'all') {
              // When in 'all' (meaning all non-archived are visible), switching to include mode:
              // - If clicking a non-archived project → remove it from the selection
              // - If clicking Archived → add it to the selection (alongside all non-archived)
              const archivedId = SYS.archivedId
              const nonArchivedIds = state.projects.map((p) => p.id).filter((id) => id !== archivedId)
              const nextIds = projectId === archivedId
                ? [...nonArchivedIds, archivedId]
                : nonArchivedIds.filter((id) => id !== projectId)
              return {
                filters: {
                  ...state.filters,
                  projectFilterMode: 'include',
                  projectIds: nextIds,
                },
              }
            }

            const ids = new Set(state.filters.projectIds)
            if (ids.has(projectId)) {
              ids.delete(projectId)
            } else {
              ids.add(projectId)
            }

            const nextIds = Array.from(ids)
            const archivedId = SYS.archivedId
            const totalNonArchived = state.projects.filter((project) => project.id !== archivedId).length
            const selectedNonArchived = nextIds.filter((id) => id !== archivedId).length
            const includesArchived = nextIds.includes(archivedId)

            if (!includesArchived && selectedNonArchived === totalNonArchived) {
              return {
                filters: {
                  ...state.filters,
                  projectFilterMode: 'all',
                  projectIds: [],
                },
              }
            }

            return {
              filters: {
                ...state.filters,
                projectFilterMode: 'include',
                projectIds: nextIds,
              },
            }
          }),
        selectAllProjects: () =>
          set((state) => {
            if (state.filters.projectFilterMode === 'all') return state
            return {
              filters: {
                ...state.filters,
                projectFilterMode: 'all',
                projectIds: [],
              },
            }
          }),
        clearProjectSelection: () =>
          set((state) => ({
            filters: {
              ...state.filters,
              projectFilterMode: 'include',
              projectIds: [],
            },
          })),
        addProject: ({ name, colour }) => {
          const normalisedName = name.trim()
          const now = new Date().toISOString()

          const existing = getState().projects.find(
            (project) => project.name.toLowerCase() === normalisedName.toLowerCase(),
          )
          if (existing) {
            return existing.id
          }

          const project: Project = {
            id: nanoid(),
            name: normalisedName,
            colour,
            createdAt: now,
            updatedAt: now,
          }

          set((state) => {
            const projects = [...state.projects, project]
            const filters = ensureFiltersConsistency(state.filters, projects)
            return {
              projects,
              filters,
            }
          })
          if (firebaseEnabled && auth.currentUser?.uid) {
            const uid = auth.currentUser.uid
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            remoteUpsertProject(uid, project).catch((err) => console.error('[firestore] upsertProject', err))
          }
          return project.id
        },
        updateProject: (id, { name, colour }) =>
          set((state) => {
            const projects = state.projects.map((project) => {
              if (project.id !== id) return project
              const nextName = name.trim()
              if (project.name === nextName && project.colour === colour) {
                return project
              }
              return {
                ...project,
                name: nextName,
                colour,
                updatedAt: new Date().toISOString(),
              }
            })

            const filters = ensureFiltersConsistency(state.filters, projects)
            const next = {
              projects,
              filters,
            }
            if (firebaseEnabled && auth.currentUser?.uid) {
              const updated = projects.find((p) => p.id === id)
              if (updated) {
                const uid = auth.currentUser.uid
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                remoteUpsertProject(uid, updated).catch((err) => console.error('[firestore] updateProject', err))
              }
            }
            return next
          }),
        deleteProject: (id) =>
          set((state) => {
            if (!state.projects.some((project) => project.id === id)) {
              return state
            }

            const archivedId = SYS.archivedId
            if (id === archivedId) {
              return state
            }

            const projects = state.projects.filter((project) => project.id !== id)
            const items = state.items.map((item) => {
              if (item.projectId !== id) return item
              return {
                ...item,
                projectId: archivedId,
                updatedAt: new Date().toISOString(),
              }
            })

            const filters = ensureFiltersConsistency(state.filters, projects)

            const nextState = {
              projects,
              items,
              filters,
            }
            // Firestore persist move to archived if enabled
            if (firebaseEnabled && auth.currentUser?.uid) {
              const uid = auth.currentUser.uid
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              moveProjectToArchived(uid, id, archivedId).catch((err) => {
                console.error('[firestore] moveProjectToArchived', err)
              })
            }
            return nextState
          }),
        upsertItem: (input) => {
          if (!input || typeof input !== 'object') {
            console.error('upsertItem: invalid payload')
            return ''
          }
          if (!input.projectId) {
            console.error('upsertItem: missing projectId')
            return ''
          }
          if (!input.date || typeof input.date !== 'string') {
            console.error('upsertItem: invalid date', (input as any)?.date)
            return ''
          }

          const projectExists = getState().projects.some((project) => project.id === input.projectId)
          if (!projectExists) {
            throw new Error('Project does not exist for item')
          }

          const now = new Date().toISOString()
          const id = input.id ?? nanoid()
          const existing = getState().items.find((item) => item.id === id)

          const rawCustomKey = typeof input.iconCustom?.key === 'string' ? input.iconCustom.key.trim() : undefined
          const customLabel = typeof input.iconCustom?.label === 'string' ? input.iconCustom.label.trim() : undefined
          const hasCustomIcon = !!rawCustomKey

          const nextItem: PlannerItem = {
            id,
            projectId: input.projectId,
            title: input.title,
            notes: input.notes,
            date: input.date,
            assignee: input.assignee,
            icon: hasCustomIcon ? undefined : (typeof input.icon === 'string' ? input.icon : undefined),
            iconCustom: hasCustomIcon
              ? {
                  key: rawCustomKey as string,
                  label: customLabel || (rawCustomKey as string),
                }
              : undefined,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          }

          const prevItems = getState().items
          set((state) => {
            const items = existing
              ? state.items.map((item) => (item.id === id ? nextItem : item))
              : [...state.items, nextItem]

            return {
              items,
              undo: null,
            }
          })

          if (firebaseEnabled && auth.currentUser?.uid) {
            const uid = auth.currentUser.uid
            remoteUpsertItem(uid, nextItem).catch((err) => {
              console.error('[firestore] upsertItem', err)
              set({ items: prevItems })
            })
          }
          return id
        },
        deleteItem: (id) => {
          const target = getState().items.find((item) => item.id === id)
          if (!target) return

          set((state) => ({
            items: state.items.filter((item) => item.id !== id),
            undo: { item: target },
          }))
          if (firebaseEnabled && auth.currentUser?.uid) {
            const uid = auth.currentUser.uid
            remoteDeleteItem(uid, id).catch((err) => console.error('[firestore] deleteItem', err))
          }
        },
        restoreLastDeleted: () => {
          const undo = getState().undo
          if (!undo) return

          const restored = { ...undo.item, updatedAt: new Date().toISOString() }
          set((state) => ({ items: [...state.items, restored], undo: null }))
        },
        replaceProjects: (projects) =>
          set((state) => {
            const hasArchived = projects.some((project) => project.id === SYS.archivedId)
            const nextProjects = hasArchived ? projects : [...projects, createDefaultProject()]
            return {
              projects: nextProjects,
              filters: ensureFiltersConsistency(state.filters, nextProjects),
            }
          }),
        replaceItems: (items) =>
          set({
            items,
            undo: null,
          }),
      }),
      {
        name: 'planner-store',
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({
          items: state.items,
          projects: state.projects,
        }),
        version: 2,
        migrate: (persistedState: unknown, version) => {
          const legacyState = persistedState as PersistedStateV1 | undefined
          if (!legacyState) return legacyState

          if (version === 0 || !('projects' in legacyState)) {
            const legacyItems = Array.isArray(legacyState.items)
              ? (legacyState.items as LegacyItem[])
              : []
            const colourOverrides = legacyState.colourOverrides ?? {}
            const projectsMap = new Map<string, Project>()
            const items: PlannerItem[] = []
            const ensureProject = (name: string, colourHint?: string): Project => {
              const trimmed = name.trim() || 'Archived'
              const key = trimmed.toLowerCase()
              if (projectsMap.has(key)) {
                return projectsMap.get(key) as Project
              }
              const now = new Date().toISOString()
              const colour = colourHint ?? colourOverrides[trimmed] ?? deriveColour(trimmed)
              const project: Project = {
                id: nanoid(),
                name: trimmed,
                colour,
                createdAt: now,
                updatedAt: now,
              }
              projectsMap.set(key, project)
              return project
            }

            for (const raw of legacyItems) {
              const projectName = typeof raw.project === 'string' ? raw.project : 'Archived'
              const project = ensureProject(projectName, raw.colour)
              const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
              const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt
              const customIcon = (() => {
                const candidate = raw.iconCustom
                if (!candidate || typeof candidate !== 'object') return undefined
                const key = typeof candidate.key === 'string' ? candidate.key : undefined
                if (!key) return undefined
                const label =
                  typeof candidate.label === 'string' && candidate.label.trim()
                    ? candidate.label
                    : key
                return { key, label }
              })()
              items.push({
                id: raw.id ?? nanoid(),
                projectId: project.id,
                title: raw.title ?? '',
                notes: raw.notes,
                date: raw.date ?? formatISODate(new Date()),
                assignee: raw.assignee,
                icon: typeof raw.icon === 'string' ? raw.icon : undefined,
                iconCustom: customIcon,
                createdAt,
                updatedAt,
              })
            }

            if (projectsMap.size === 0) {
              const project = createDefaultProject()
              projectsMap.set(project.name.toLowerCase(), project)
            }

            return normaliseArchivedState({
              items,
              projects: Array.from(projectsMap.values()),
            })
          }

          if (version < 2) {
            const items = Array.isArray(legacyState.items)
              ? (legacyState.items as PlannerItem[])
              : []
            const projects = Array.isArray(legacyState.projects) ? legacyState.projects : []
            return normaliseArchivedState({ items, projects })
          }

          const items = Array.isArray(legacyState.items) ? (legacyState.items as PlannerItem[]) : []
          const projects = Array.isArray(legacyState.projects) ? legacyState.projects : []
          return normaliseArchivedState({ items, projects })
        },
      },
    ),
  ),
)

export function getVisibleProjectIds(filters: Filters, projects: Project[]) {
  if (filters.projectFilterMode === 'include') {
    return filters.projectIds
  }
  const archivedId = SYS.archivedId
  return projects.map((project) => project.id).filter((id) => id !== archivedId)
}
