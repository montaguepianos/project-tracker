import { useMemo } from 'react'
import { isSameDay, parseISO } from 'date-fns'

import { SquareCard } from '@/components/calendar/SquareCard'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useResizeObserver } from '@/hooks/useResizeObserver'
import { computePacking } from '@/lib/packing'
import { getWeekDays } from '@/lib/date'
import { formatDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import { usePlannerStore } from '@/store/plannerStore'
import { getFilteredItems, groupItemsByDate } from '@/store/selectors'
import type { PlannerItem, Project } from '@/types'

const LABEL_THRESHOLD = 28

export type WeekViewProps = {
  selectedItemId: string | null
  onSelectItem: (id: string) => void
  onEditItem: (id: string) => void
}

export function WeekView({ selectedItemId, onSelectItem, onEditItem }: WeekViewProps) {
  const items = usePlannerStore((state) => state.items)
  const filters = usePlannerStore((state) => state.filters)
  const projects = usePlannerStore((state) => state.projects)
  const referenceDate = usePlannerStore((state) => state.referenceDate)
  const focusedDate = usePlannerStore((state) => state.focusedDate)
  const setReferenceDate = usePlannerStore((state) => state.setReferenceDate)
  const setFocusedDate = usePlannerStore((state) => state.setFocusedDate)

  const parsedReference = useMemo(() => parseISO(referenceDate), [referenceDate])
  const weekDays = useMemo(() => getWeekDays(parsedReference), [parsedReference])
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects])
  const filtered = useMemo(() => getFilteredItems(items, filters, projects), [items, filters, projects])
  const grouped = useMemo(() => groupItemsByDate(filtered), [filtered])

  const handleFocus = (date: Date) => {
    const iso = formatDate(date, 'yyyy-MM-dd')
    setFocusedDate(iso)
    setReferenceDate(iso)
  }

  const handleOpenItem = (id: string) => {
    onSelectItem(id)
    onEditItem(id)
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div role="grid" aria-label="Week view" className="grid flex-1 grid-cols-7 gap-4 rounded-lg border bg-border p-4">
        {weekDays.map((day) => {
          const iso = formatDate(day, 'yyyy-MM-dd')
          const dayItems = grouped[iso] ?? []
          const isToday = isSameDay(day, new Date())
          const isFocused = iso === focusedDate

          return (
            <WeekDayColumn
              key={iso}
              date={day}
              items={dayItems}
              isFocused={isFocused}
              isToday={isToday}
              selectedItemId={selectedItemId}
              onFocus={handleFocus}
              onOpenItem={handleOpenItem}
              projectMap={projectMap}
            />
          )
        })}
      </div>
    </TooltipProvider>
  )
}

type WeekDayColumnProps = {
  date: Date
  items: PlannerItem[]
  isFocused: boolean
  isToday: boolean
  selectedItemId: string | null
  onFocus: (date: Date) => void
  onOpenItem: (id: string) => void
  projectMap: Map<string, Project>
}

function WeekDayColumn({ date, items, isFocused, isToday, selectedItemId, onFocus, onOpenItem, projectMap }: WeekDayColumnProps) {
  const { ref, width, height } = useResizeObserver<HTMLDivElement>()
  const layout = useMemo(() => computePacking(width, height, items.length), [width, height, items.length])
  const visibleItems = layout.visibleCount ? items.slice(0, layout.visibleCount) : []
  const overflowItems = layout.visibleCount < items.length ? items.slice(layout.visibleCount) : []

  const labelDate = formatDate(date, 'EEE d MMM')

  return (
    <div
      role="gridcell"
      tabIndex={isFocused ? 0 : -1}
      aria-selected={isFocused}
      onClick={() => onFocus(date)}
      className={cn(
        'flex h-full min-h-[240px] flex-col gap-3 rounded-lg bg-background p-3 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isFocused && 'ring-2 ring-primary/60',
      )}
    >
      <div className="flex items-center justify-between text-sm font-medium">
        <span>{labelDate}</span>
        {isToday && <span className="rounded-full bg-primary/90 px-2 py-0.5 text-[10px] text-primary-foreground">Today</span>}
      </div>
      <div
        ref={ref}
        className="grid flex-1 content-start justify-center"
        style={{
          gap: `${layout.gap}px`,
          gridTemplateColumns: layout.columns ? `repeat(${layout.columns}, ${layout.squareSize}px)` : undefined,
          gridAutoRows: layout.squareSize ? `${layout.squareSize}px` : undefined,
        }}
      >
        {visibleItems.map((item) => {
          const project = projectMap.get(item.projectId) ?? null
          return (
            <SquareCard
              key={item.id}
              item={item}
              project={project}
              isSelected={selectedItemId === item.id}
              onOpen={onOpenItem}
              size={layout.squareSize}
              showLabel={layout.squareSize >= LABEL_THRESHOLD}
              label={item.title}
            />
          )
        })}
        {overflowItems.length > 0 && (
          <OverflowBadge
            items={overflowItems}
            selectedItemId={selectedItemId}
            onOpen={onOpenItem}
            projectMap={projectMap}
            size={layout.squareSize}
          />
        )}
      </div>
    </div>
  )
}

type OverflowBadgeProps = {
  items: PlannerItem[]
  selectedItemId: string | null
  onOpen: (id: string) => void
  projectMap: Map<string, Project>
  size: number
}

function OverflowBadge({ items, selectedItemId, onOpen, projectMap, size }: OverflowBadgeProps) {
  const style = size > 0 ? { width: `${size}px`, height: `${size}px` } : undefined
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex flex-col items-center justify-center rounded-sm border border-dashed text-xs text-muted-foreground"
          style={style}
          aria-label={`View ${items.length} more item(s)`}
        >
          <Badge variant="secondary">+{items.length}</Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <ScrollArea className="max-h-64">
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 p-3 text-left text-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onOpen(item.id)}
                >
                  <span className="font-medium">{item.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {projectMap.get(item.projectId)?.name ?? 'Project'}
                  </span>
                  {selectedItemId === item.id && <span className="text-[10px] uppercase tracking-wide text-primary">Selected</span>}
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
