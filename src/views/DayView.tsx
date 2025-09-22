import { useMemo } from 'react'
import { addDays, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NotesContent } from '@/components/NotesContent'
import { usePlannerStore } from '@/store/plannerStore'
import { getFilteredItems } from '@/store/selectors'
import { formatISODate } from '@/lib/string'
import { formatDate } from '@/lib/date'
import { ensureReadableText } from '@/lib/colour'
import { cn } from '@/lib/utils'
import { resolvePlannerIconMeta } from '@/lib/icons'
import type { PlannerItem, Project } from '@/types'

export type DayViewProps = {
  selectedItemId: string | null
  onSelectItem: (id: string | null) => void
  onEditItem: (id: string) => void
  onRequestDeleteItem: (id: string) => void
}

export function DayView({ selectedItemId, onSelectItem, onEditItem, onRequestDeleteItem }: DayViewProps) {
  const items = usePlannerStore((state) => state.items)
  const filters = usePlannerStore((state) => state.filters)
  const projects = usePlannerStore((state) => state.projects)
  const focusedDate = usePlannerStore((state) => state.focusedDate)
  const referenceDate = usePlannerStore((state) => state.referenceDate)
  const setFocusedDate = usePlannerStore((state) => state.setFocusedDate)
  const setReferenceDate = usePlannerStore((state) => state.setReferenceDate)

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects])

  const filtered = useMemo(() => getFilteredItems(items, filters, projects), [items, filters, projects])
  const dayItems = useMemo(() => selectAndSortDayItems(filtered, projectMap, focusedDate), [filtered, projectMap, focusedDate])

  const handleNavigate = (delta: number) => {
    const next = addDays(parseISO(focusedDate), delta)
    const iso = formatISODate(next)
    setFocusedDate(iso)
    setReferenceDate(iso)
  }

  const handleEdit = (item: PlannerItem) => {
    onSelectItem(item.id)
    onEditItem(item.id)
  }

  const handleDelete = (item: PlannerItem) => {
    onSelectItem(item.id)
    onRequestDeleteItem(item.id)
  }

  const dayLabel = formatDate(focusedDate, 'EEEE d MMMM yyyy')
  const secondaryLabel = formatDate(referenceDate, 'EEEE d MMMM yyyy')

  return (
    <section aria-labelledby="day-view-heading" className="flex flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-4 shadow-sm">
        <div>
          <h2 id="day-view-heading" className="text-lg font-semibold">
            {dayLabel}
          </h2>
          <p className="text-sm text-muted-foreground">Focused day view</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous day"
            onClick={() => handleNavigate(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next day"
            onClick={() => handleNavigate(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div role="list" aria-label={`Items scheduled for ${secondaryLabel}`} className="flex flex-1 flex-col gap-4">
        {dayItems.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-12 text-center text-sm text-muted-foreground">
            No items today. Use Add item to create one.
          </div>
        ) : (
          dayItems.map((item) => (
            <DayViewItem
              key={item.id}
              item={item}
              project={projectMap.get(item.projectId) ?? null}
              isSelected={selectedItemId === item.id}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item)}
              onFocus={() => onSelectItem(item.id)}
            />
          ))
        )}
      </div>
    </section>
  )
}

type SortableItem = PlannerItem & {
  projectName: string
}

function selectAndSortDayItems(items: PlannerItem[], projectMap: Map<string, Project>, day: string) {
  const matching: SortableItem[] = []

  for (const item of items) {
    if (item.date !== day) continue
    const projectName = projectMap.get(item.projectId)?.name ?? ''
    matching.push({ ...item, projectName })
  }

  return matching.sort((a, b) => {
    const nameCompare = a.projectName.localeCompare(b.projectName, 'en-GB', { sensitivity: 'base' })
    if (nameCompare !== 0) return nameCompare
    return a.title.localeCompare(b.title, 'en-GB', { sensitivity: 'base' })
  })
}

type DayViewItemProps = {
  item: PlannerItem
  project: Project | null
  isSelected: boolean
  onEdit: () => void
  onDelete: () => void
  onFocus: () => void
}

function DayViewItem({ item, project, isSelected, onEdit, onDelete, onFocus }: DayViewItemProps) {
  const background = project?.colour ?? '#888888'
  const textColour = ensureReadableText(background)
  const resolvedIcon = resolvePlannerIconMeta(item)
  const Icon = resolvedIcon.component
  const iconLabel = resolvedIcon.label ?? 'Icon'

  return (
    <article
      role="listitem"
      tabIndex={0}
      onFocus={onFocus}
      className={cn(
        'group rounded-lg border bg-background p-5 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
        isSelected && 'ring-2 ring-primary/60',
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
              style={{ backgroundColor: background, color: textColour }}
            >
              {project?.name?.charAt(0) ?? '?'}
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{project?.name ?? 'Untitled project'}</span>
              <span className="text-lg font-medium leading-tight">{item.title}</span>
            </div>
          </div>
          {item.assignee && (
            <p className="text-sm text-muted-foreground">
              Assigned to <span className="font-medium text-foreground">{item.assignee}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span>{formatDate(item.date, 'EEE d MMM yyyy')}</span>
            {Icon && (
              <span className="inline-flex items-center gap-1 text-foreground">
                <Icon
                  className="h-4 w-4"
                  {...(resolvedIcon.label ? { 'aria-label': resolvedIcon.label, role: 'img' } : { 'aria-hidden': true })}
                />
                <span className="text-sm font-medium">{iconLabel}</span>
              </span>
            )}
          </div>
          {item.notes && (
            <div className="rounded-md bg-muted/40 p-3">
              <NotesContent value={item.notes} />
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
            <Button type="button" variant="outline" className="text-destructive" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}
