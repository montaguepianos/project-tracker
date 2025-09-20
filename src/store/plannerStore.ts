import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import { del, get, set as idbSet } from 'idb-keyval'
import { nanoid } from 'nanoid'

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
  deleteProject: (id: string, options?: { reassignTo?: string }) => void
  upsertItem: (input: Omit<PlannerItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => string
  deleteItem: (id: string) => void
  restoreLastDeleted: () => void
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
    id: nanoid(),
    name: 'General',
    colour: '#1C7ED6',
    createdAt: now,
    updatedAt: now,
  }
}

type PersistedStateV1 = {
  items?: unknown
  projects?: Project[]
  colourOverrides?: Record<string, string>
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
  createdAt?: string
  updatedAt?: string
}

function sanitizeProjectIds(ids: string[], projects: Project[]) {
  if (ids.length === 0) return []
  const allowed = new Set(projects.map((project) => project.id))
  return ids.filter((id) => allowed.has(id))
}

function ensureFiltersConsistency(filters: Filters, projects: Project[]): Filters {
  const cleanIds = sanitizeProjectIds(filters.projectIds, projects)
  if (filters.projectFilterMode === 'include') {
    if (cleanIds.length === projects.length) {
      return { ...filters, projectFilterMode: 'all', projectIds: [] }
    }
    return { ...filters, projectIds: cleanIds }
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
              return {
                filters: {
                  ...state.filters,
                  projectFilterMode: 'include',
                  projectIds: [projectId],
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
            if (nextIds.length === 0) {
              return {
                filters: {
                  ...state.filters,
                  projectFilterMode: 'include',
                  projectIds: [],
                },
              }
            }

            if (nextIds.length === state.projects.length) {
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
            return {
              projects,
              filters,
            }
          }),
        deleteProject: (id, options) =>
          set((state) => {
            if (!state.projects.some((project) => project.id === id)) {
              return state
            }

            if (state.projects.length <= 1) {
              return state
            }

            const reassignment = options?.reassignTo
            if (state.items.some((item) => item.projectId === id)) {
              if (!reassignment) {
                return state
              }
            }

            const projects = state.projects.filter((project) => project.id !== id)
            const items = state.items.map((item) => {
              if (item.projectId !== id) return item
              if (!reassignment) return item
              return {
                ...item,
                projectId: reassignment,
                updatedAt: new Date().toISOString(),
              }
            })

            const filters = ensureFiltersConsistency(state.filters, projects)

            return {
              projects,
              items,
              filters,
            }
          }),
        upsertItem: (input) => {
          const projectExists = getState().projects.some((project) => project.id === input.projectId)
          if (!projectExists) {
            throw new Error('Project does not exist for item')
          }

          const now = new Date().toISOString()
          const id = input.id ?? nanoid()
          const existing = getState().items.find((item) => item.id === id)

          const nextItem: PlannerItem = {
            id,
            projectId: input.projectId,
            title: input.title,
            notes: input.notes,
            date: input.date,
            assignee: input.assignee,
            icon: input.icon,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          }

          set((state) => {
            const items = existing
              ? state.items.map((item) => (item.id === id ? nextItem : item))
              : [...state.items, nextItem]

            return {
              items,
              undo: null,
            }
          })

          return id
        },
        deleteItem: (id) => {
          const target = getState().items.find((item) => item.id === id)
          if (!target) return

          set((state) => ({
            items: state.items.filter((item) => item.id !== id),
            undo: { item: target },
          }))
        },
        restoreLastDeleted: () => {
          const undo = getState().undo
          if (!undo) return

          const restored = { ...undo.item, updatedAt: new Date().toISOString() }
          set((state) => ({ items: [...state.items, restored], undo: null }))
        },
      }),
      {
        name: 'planner-store',
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({
          items: state.items,
          projects: state.projects,
        }),
        version: 1,
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
              const trimmed = name.trim() || 'General'
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
              const projectName = typeof raw.project === 'string' ? raw.project : 'General'
              const project = ensureProject(projectName, raw.colour)
              const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
              const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt
              items.push({
                id: raw.id ?? nanoid(),
                projectId: project.id,
                title: raw.title ?? '',
                notes: raw.notes,
                date: raw.date ?? formatISODate(new Date()),
                assignee: raw.assignee,
                icon: typeof raw.icon === 'string' ? raw.icon : undefined,
                createdAt,
                updatedAt,
              })
            }

            if (projectsMap.size === 0) {
              const project = createDefaultProject()
              projectsMap.set(project.name.toLowerCase(), project)
            }

            return {
              items,
              projects: Array.from(projectsMap.values()),
            }
          }

          return legacyState
        },
      },
    ),
  ),
)

export function getVisibleProjectIds(filters: Filters, projects: Project[]) {
  if (filters.projectFilterMode === 'include') {
    return filters.projectIds
  }
  return projects.map((project) => project.id)
}
