import { Fragment, useMemo } from 'react'
import { isSameMonth, isToday, parseISO } from 'date-fns'

import { SquareCard } from '@/components/calendar/SquareCard'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { usePlannerStore } from '@/store/plannerStore'
import { getFilteredItems, groupItemsByDate } from '@/store/selectors'
import { getMonthMatrix } from '@/lib/date'
import { formatISODate } from '@/lib/string'
import type { PlannerItem, Project } from '@/types'
import { useResizeObserver } from '@/hooks/useResizeObserver'
import { computeSquarePacking } from '@/lib/packing'
import { OverflowBadge } from '@/components/calendar/OverflowBadge'

export type MonthViewProps = {
  selectedItemId: string | null
  onSelectItem: (id: string) => void
  onShowDetails: (id: string) => void
}

export function MonthView({ selectedItemId, onSelectItem, onShowDetails }: MonthViewProps) {
  const items = usePlannerStore((state) => state.items)
  const filters = usePlannerStore((state) => state.filters)
  const projects = usePlannerStore((state) => state.projects)
  const referenceDate = usePlannerStore((state) => state.referenceDate)
  const focusedDate = usePlannerStore((state) => state.focusedDate)
  const setReferenceDate = usePlannerStore((state) => state.setReferenceDate)
  const setFocusedDate = usePlannerStore((state) => state.setFocusedDate)
  const setView = usePlannerStore((state) => state.setView)

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

  const handleActivateItem = (id: string) => {
    onSelectItem(id)
    onShowDetails(id)
  }

  const openDayView = (date: Date) => {
    const iso = formatISODate(date)
    setFocusedDate(iso)
    setReferenceDate(iso)
    setView('day')
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div role="grid" aria-label="Month view" className="grid flex-1 grid-cols-7 gap-px rounded-lg border bg-border">
        {weeks.map((week, weekIndex) => (
          <Fragment key={weekIndex}>
            {week.map((day) => {
              const iso = formatISODate(day)
              const dayItems = grouped[iso] ?? []
              const isCurrentMonth = isSameMonth(day, parsedReference)
              const isFocused = iso === focusedDate

              return (
                <DayCell
                  key={iso}
                  displayDate={day}
                  items={dayItems}
                  isCurrentMonth={isCurrentMonth}
                  isFocused={isFocused}
                  isToday={isToday(day)}
                  selectedItemId={selectedItemId}
                  onFocus={handleFocus}
                  onActivateItem={handleActivateItem}
                  onOpenDay={openDayView}
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
  isCurrentMonth: boolean
  isFocused: boolean
  isToday: boolean
  selectedItemId: string | null
  onFocus: (date: Date) => void
  onActivateItem: (id: string) => void
  onOpenDay: (date: Date) => void
  projectMap: Map<string, Project>
}

function DayCell({
  displayDate,
  items,
  isCurrentMonth,
  isFocused,
  isToday,
  selectedItemId,
  onFocus,
  onActivateItem,
  onOpenDay,
  projectMap,
}: DayCellProps) {
  const { ref, width, height } = useResizeObserver<HTMLDivElement>()
  const layout = useMemo(() => computeSquarePacking(width, height, items.length), [width, height, items.length])
  const visibleItems = layout.visibleCount ? items.slice(0, layout.visibleCount) : []
  const overflowItems = layout.visibleCount < items.length ? items.slice(layout.visibleCount) : []

  return (
    <div
      role="gridcell"
      tabIndex={isFocused ? 0 : -1}
      aria-selected={isFocused}
      onFocus={() => onFocus(displayDate)}
      onClick={() => onFocus(displayDate)}
      onDoubleClick={(event) => {
        const target = event.target as HTMLElement
        if (target.closest('[data-prevent-day-open="true"]')) {
          return
        }
        onFocus(displayDate)
        onOpenDay(displayDate)
      }}
      className={cn(
        'flex h-32 flex-col gap-2 bg-background p-2 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring',
        isFocused && 'ring-2 ring-primary/60',
      )}
    >
      <div className="flex items-center justify-between text-xs">
        <span className={isCurrentMonth ? 'font-medium' : 'text-muted-foreground'}>{displayDate.getDate()}</span>
        {isToday && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">Today</span>}
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
        {visibleItems.map((item) => (
          <SquareCard
            key={item.id}
            item={item}
            project={projectMap.get(item.projectId) ?? null}
            isSelected={selectedItemId === item.id}
            onActivate={(id) => {
              onFocus(displayDate)
              onActivateItem(id)
            }}
            size={layout.squareSize}
          />
        ))}
        {overflowItems.length > 0 && (
          <OverflowBadge
            items={overflowItems}
            selectedItemId={selectedItemId}
            onActivate={(id) => {
              onFocus(displayDate)
              onActivateItem(id)
            }}
            projectMap={projectMap}
            size={layout.squareSize}
          />
        )}
      </div>
    </div>
  )
}
