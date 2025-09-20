import { Fragment, useMemo } from 'react'
import { isSameMonth, isToday, parseISO } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SquareCard } from '@/components/calendar/SquareCard'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { usePlannerStore } from '@/store/plannerStore'
import { getFilteredItems, groupItemsByDate } from '@/store/selectors'
import { getMonthMatrix } from '@/lib/date'
import { formatISODate } from '@/lib/string'
import type { PlannerItem, Project } from '@/types'

const MAX_VISIBLE = 6

export type MonthViewProps = {
  selectedItemId: string | null
  onSelectItem: (id: string) => void
  onEditItem: (id: string) => void
}

export function MonthView({ selectedItemId, onSelectItem, onEditItem }: MonthViewProps) {
  const items = usePlannerStore((state) => state.items)
  const filters = usePlannerStore((state) => state.filters)
  const projects = usePlannerStore((state) => state.projects)
  const referenceDate = usePlannerStore((state) => state.referenceDate)
  const focusedDate = usePlannerStore((state) => state.focusedDate)
  const setReferenceDate = usePlannerStore((state) => state.setReferenceDate)
  const setFocusedDate = usePlannerStore((state) => state.setFocusedDate)

  const parsedReference = useMemo(() => parseISO(referenceDate), [referenceDate])
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects])
  const filtered = useMemo(() => getFilteredItems(items, filters, projects), [items, filters, projects])
  const grouped = useMemo(() => groupItemsByDate(filtered), [filtered])
  const weeks = useMemo(() => getMonthMatrix(parsedReference), [parsedReference])

  const handleFocus = (date: Date) => {
    const iso = formatISODate(date)
    setFocusedDate(iso)
    setReferenceDate(iso)
  }

  const handleOpenItem = (id: string) => {
    onSelectItem(id)
    onEditItem(id)
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div role="grid" aria-label="Month view" className="grid flex-1 grid-cols-7 gap-px rounded-lg border bg-border">
        {weeks.map((week, weekIndex) => (
          <Fragment key={weekIndex}>
            {week.map((day) => {
              const iso = formatISODate(day)
              const dayItems = grouped[iso] ?? []
              const visible = dayItems.slice(0, MAX_VISIBLE)
              const overflowItems = dayItems.slice(visible.length)
              const isCurrentMonth = isSameMonth(day, parsedReference)
              const isFocused = iso === focusedDate

              return (
                <DayCell
                  key={iso}
                  displayDate={day}
                  items={visible}
                  overflowItems={overflowItems}
                  isCurrentMonth={isCurrentMonth}
                  isFocused={isFocused}
                  isToday={isToday(day)}
                  selectedItemId={selectedItemId}
                  onFocus={handleFocus}
                  onOpenItem={handleOpenItem}
                  projectMap={projectMap}
                />
              )
            })}
          </Fragment>
        ))}
      </div>
    </TooltipProvider>
  )
}

type DayCellProps = {
  displayDate: Date
  items: PlannerItem[]
  overflowItems: PlannerItem[]
  isCurrentMonth: boolean
  isFocused: boolean
  isToday: boolean
  selectedItemId: string | null
  onFocus: (date: Date) => void
  onOpenItem: (id: string) => void
  projectMap: Map<string, Project>
}

function DayCell({
  displayDate,
  items,
  overflowItems,
  isCurrentMonth,
  isFocused,
  isToday,
  selectedItemId,
  onFocus,
  onOpenItem,
  projectMap,
}: DayCellProps) {
  return (
    <div
      role="gridcell"
      tabIndex={isFocused ? 0 : -1}
      aria-selected={isFocused}
      onFocus={() => onFocus(displayDate)}
      onClick={() => onFocus(displayDate)}
      className={cn(
        'flex h-32 flex-col gap-2 bg-background p-2 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring',
        isFocused && 'ring-2 ring-primary/60',
      )}
    >
      <div className="flex items-center justify-between text-xs">
        <span className={isCurrentMonth ? 'font-medium' : 'text-muted-foreground'}>{displayDate.getDate()}</span>
        {isToday && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">Today</span>}
      </div>
      <div className="grid flex-1 grid-cols-3 gap-1">
        {items.map((item) => (
          <SquareCard
            key={item.id}
            item={item}
            project={projectMap.get(item.projectId) ?? null}
            isSelected={selectedItemId === item.id}
            onOpen={onOpenItem}
          />
        ))}
        {overflowItems.length > 0 && (
          <OverflowBadge
            items={overflowItems}
            selectedItemId={selectedItemId}
            onOpen={onOpenItem}
            projectMap={projectMap}
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
}

function OverflowBadge({ items, selectedItemId, onOpen, projectMap }: OverflowBadgeProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-full flex-col items-center justify-center rounded-sm border border-dashed text-xs text-muted-foreground"
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
