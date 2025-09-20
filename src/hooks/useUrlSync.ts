import { useEffect, useMemo, useRef } from 'react'

import { usePlannerStore } from '@/store/plannerStore'
import type { Filters } from '@/store/plannerStore'
import type { PlannerView, Project } from '@/types'

type UrlSnapshot = {
  view: PlannerView
  referenceDate: string
  year?: number
  filters: Filters
}

function normalizeToken(value: string | null) {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function mapTokensToProjectIds(tokens: string[], projects: Project[]) {
  if (!tokens.length) return []
  const byId = new Map(projects.map((project) => [project.id, project.id]))
  const byName = new Map(projects.map((project) => [project.name.toLowerCase(), project.id]))
  const seen = new Set<string>()
  const resolved: string[] = []

  for (const token of tokens) {
    if (!token) continue
    const direct = byId.get(token)
    const fallback = byName.get(token.toLowerCase())
    const projectId = direct ?? fallback
    if (!projectId || seen.has(projectId)) continue
    seen.add(projectId)
    resolved.push(projectId)
  }

  return resolved
}

function buildSearchString(snapshot: UrlSnapshot) {
  const params = new URLSearchParams()
  params.set('view', snapshot.view)
  params.set('date', snapshot.referenceDate)

  if (snapshot.view === 'year') {
    const reference = normalizeToken(snapshot.referenceDate)
    const year = reference ? reference.slice(0, 4) : snapshot.year?.toString()
    if (year) {
      params.set('year', year)
    }
  }

  if (snapshot.filters.projectFilterMode === 'include') {
    params.set('projects', snapshot.filters.projectIds.join(','))
  }

  if (snapshot.filters.search) {
    params.set('search', snapshot.filters.search)
  }

  if (snapshot.filters.range.start) {
    params.set('from', snapshot.filters.range.start)
  }

  if (snapshot.filters.range.end) {
    params.set('to', snapshot.filters.range.end)
  }

  params.set('preset', snapshot.filters.range.preset)

  const query = params.toString()
  return query
}

function parseSearch(search: string, fallback: UrlSnapshot, projects: Project[]): UrlSnapshot {
  const params = new URLSearchParams(search)
  const parsedView = normalizeToken(params.get('view'))
  const view: PlannerView = parsedView === 'week' || parsedView === 'day' || parsedView === 'year' ? parsedView : 'month'

  const rawYear = params.get('year')
  const yearFromParam = rawYear ? Number.parseInt(rawYear, 10) : undefined

  let nextDate = normalizeToken(params.get('date')) ?? fallback.referenceDate
  if (view === 'year') {
    const year = Number.isFinite(yearFromParam) ? (yearFromParam as number) : Number.parseInt(nextDate.slice(0, 4), 10)
    const normalizedYear = Number.isFinite(year) ? year : new Date().getFullYear()
    nextDate = `${String(normalizedYear).padStart(4, '0')}-01-01`
  }

  const rawProjects = params.get('projects')
  const projectFilterMode: Filters['projectFilterMode'] = rawProjects === null ? 'all' : 'include'
  const projectIds = rawProjects
    ? mapTokensToProjectIds(
        rawProjects
          .split(',')
          .map((token) => token.trim())
          .filter((token) => token.length > 0),
        projects,
      )
    : []

  const searchTerm = params.get('search') ?? fallback.filters.search
  const from = params.get('from') ?? fallback.filters.range.start
  const to = params.get('to') ?? fallback.filters.range.end
  const presetParam = params.get('preset')
  const preset: Filters['range']['preset'] =
    presetParam === 'next-two-weeks' ||
    presetParam === 'this-month' ||
    presetParam === 'next-month' ||
    presetParam === 'custom'
      ? presetParam
      : 'this-week'

  const snapshot: UrlSnapshot = {
    view,
    referenceDate: nextDate,
    filters: {
      projectFilterMode,
      projectIds,
      search: searchTerm,
      range: {
        start: from,
        end: to,
        preset,
      },
    },
  }

  if (view === 'year') {
    const year = Number.parseInt(nextDate.slice(0, 4), 10)
    if (Number.isFinite(year)) {
      snapshot.year = year
    }
  }

  return snapshot
}

function snapshotsEqual(a: UrlSnapshot, b: UrlSnapshot) {
  return (
    a.view === b.view &&
    a.referenceDate === b.referenceDate &&
    a.filters.projectFilterMode === b.filters.projectFilterMode &&
    a.filters.search === b.filters.search &&
    a.filters.range.start === b.filters.range.start &&
    a.filters.range.end === b.filters.range.end &&
    a.filters.range.preset === b.filters.range.preset &&
    a.filters.projectIds.length === b.filters.projectIds.length &&
    a.filters.projectIds.every((id, index) => id === b.filters.projectIds[index])
  )
}

export function useUrlSync() {
  const view = usePlannerStore((state) => state.view)
  const referenceDate = usePlannerStore((state) => state.referenceDate)
  const filters = usePlannerStore((state) => state.filters)
  const projects = usePlannerStore((state) => state.projects)

  const setView = usePlannerStore((state) => state.setView)
  const setReferenceDate = usePlannerStore((state) => state.setReferenceDate)
  const setFilters = usePlannerStore((state) => state.setFilters)

  const snapshot = useMemo<UrlSnapshot>(
    () => ({
      view,
      referenceDate,
      year: view === 'year' ? Number.parseInt(referenceDate.slice(0, 4), 10) : undefined,
      filters,
    }),
    [filters, referenceDate, view],
  )

  const stateRef = useRef(snapshot)
  const projectsRef = useRef(projects)
  const hasHydrated = useRef(false)
  const isApplyingFromUrl = useRef(false)
  const lastPushedRef = useRef<string>('')

  useEffect(() => {
    stateRef.current = snapshot
  }, [snapshot])

  useEffect(() => {
    projectsRef.current = projects
  }, [projects])

  useEffect(() => {
    const applyFromUrl = () => {
      const currentSnapshot = stateRef.current
      const nextSnapshot = parseSearch(window.location.search, currentSnapshot, projectsRef.current)

      if (snapshotsEqual(nextSnapshot, currentSnapshot)) {
        hasHydrated.current = true
        return
      }

      isApplyingFromUrl.current = true

      setView(nextSnapshot.view)
      setReferenceDate(nextSnapshot.referenceDate)
      setFilters(() => ({
        projectFilterMode: nextSnapshot.filters.projectFilterMode,
        projectIds: [...nextSnapshot.filters.projectIds],
        search: nextSnapshot.filters.search,
        range: { ...nextSnapshot.filters.range },
      }))

      lastPushedRef.current = buildSearchString(nextSnapshot)
      isApplyingFromUrl.current = false
      hasHydrated.current = true
    }

    applyFromUrl()
    window.addEventListener('popstate', applyFromUrl)
    return () => window.removeEventListener('popstate', applyFromUrl)
  }, [setFilters, setReferenceDate, setView])

  useEffect(() => {
    if (!hasHydrated.current || isApplyingFromUrl.current) {
      return
    }

    const nextSearch = buildSearchString(snapshot)
    if (nextSearch === lastPushedRef.current) {
      return
    }

    lastPushedRef.current = nextSearch
    const base = window.location.pathname
    window.history.replaceState({}, '', nextSearch ? `${base}?${nextSearch}` : base)
  }, [snapshot])
}
