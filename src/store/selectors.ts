import { compareAsc, isWithinInterval, parseISO } from 'date-fns'

import { resolvePlannerIconMeta } from '@/lib/icons'
import { SYS } from '@/services/systemProjects'
import type { PlannerItem, Project } from '@/types'
import type { Filters } from './plannerStore'

export function getFilteredItems(items: PlannerItem[], filters: Filters, projects: Project[]) {
  const projectMap = new Map(projects.map((project) => [project.id, project]))
  const projectFilterEnabled = filters.projectFilterMode === 'include'
  const archivedId = SYS.archivedId
  // In include mode, show ONLY the explicitly selected projects. Empty set means show none.
  const allowedProjects = projectFilterEnabled ? new Set(filters.projectIds) : null

  return items
    .filter((item) => {
      if (projectFilterEnabled && allowedProjects && !allowedProjects.has(item.projectId)) {
        return false
      }
      // In 'all' mode, hide archived by default
      if (!projectFilterEnabled && item.projectId === archivedId) {
        return false
      }

      if (filters.search) {
        const safeTerm = filters.search.toLowerCase()
        const projectName = projectMap.get(item.projectId)?.name ?? ''
        const iconMeta = resolvePlannerIconMeta(item)
        const iconLabel = iconMeta.label ?? ''
        const haystack = `${item.title} ${item.notes ?? ''} ${projectName} ${item.assignee ?? ''} ${iconLabel}`.toLowerCase()
        if (!haystack.includes(safeTerm)) {
          return false
        }
      }

      const { start, end } = filters.range
      if (start && end) {
        const date = parseISO(item.date)
        const inInterval = isWithinInterval(date, { start: parseISO(start), end: parseISO(end) })
        if (!inInterval) {
          return false
        }
      }

      return true
    })
    .sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)))
}

export function groupItemsByDate(items: PlannerItem[]) {
  return items.reduce<Record<string, PlannerItem[]>>((acc, item) => {
    if (!acc[item.date]) {
      acc[item.date] = []
    }

    acc[item.date].push(item)
    return acc
  }, {})
}
