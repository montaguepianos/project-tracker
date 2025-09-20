import { useMemo } from 'react'
import { isToday, parseISO } from 'date-fns'

import { TooltipProvider } from '@/components/ui/tooltip'
import { SquareCard } from '@/components/calendar/SquareCard'
import { OverflowBadge } from '@/components/calendar/OverflowBadge'
import { cn } from '@/lib/utils'
import { formatDate, getWeekDays } from '@/lib/date'
import { computeSquarePacking } from '@/lib/packing'
import { formatISODate } from '@/lib/string'
import { usePlannerStore } from '@/store/plannerStore'
import { getFilteredItems, groupItemsByDate } from '@/store/selectors'
import { useResizeObserver } from '@/hooks/useResizeObserver'
import type { PlannerItem, Project } from '@/types'

const LABEL_THRESHOLD = 32
const LABEL_LINE_HEIGHT = 18
const MIN_CARD_SIZE = 18

export type WeekViewProps = {
  selectedItemId: string | null
  onSelectItem: (id: string) => void
  onShowDetails: (id: string) => void
}

type WeekLayout = {
  squareSize: number
  gap: number
  columns: number
  rows: number
  visibleCount: number
  showLabels: boolean
}

export function WeekView({ selectedItemId, onSelectItem, onShowDetails }: WeekViewProps) {
  const items = usePlannerStore((state) => state.items)
  const filters = usePlannerStore((state) => state.filters)
  const projects = usePlannerStore((state) => state.projects)
  const referenceDate = usePlannerStore((state) => state.referenceDate)
  const focusedDate = usePlannerStore((state) => state.focusedDate)
  const setFocusedDate = usePlannerStore((state) => state.setFocusedDate)
  const setReferenceDate = usePlannerStore((state) => state.setReferenceDate)
  const setView = usePlannerStore((state) => state.setView)

  const parsedReference = useMemo(() => parseISO(referenceDate), [referenceDate])
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects])
  const filtered = useMemo(() => getFilteredItems(items, filters, projects), [items, filters, projects])
  const grouped = useMemo(() => groupItemsByDate(filtered), [filtered])
  const days = useMemo(() => getWeekDays(parsedReference), [parsedReference])

  const handleFocus = (nextDate: Date) => {
    const iso = formatISODate(nextDate)
    setFocusedDate(iso)
    setReferenceDate(iso)
  }

  const handleActivateItem = (id: string) => {
    onSelectItem(id)
    onShowDetails(id)
  }

  const openDayView = (nextDate: Date) => {
    const iso = formatISODate(nextDate)
    setFocusedDate(iso)
    setReferenceDate(iso)
    setView('day')
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-x-auto">
        <div
          role="grid"
          aria-label="Week view"
          className="grid min-w-[980px] grid-cols-7 gap-4"
        >
          {days.map((day) => {
            const iso = formatISODate(day)
            const dayItems = grouped[iso] ?? []
            const isFocused = focusedDate === iso
            const dayLabel = formatDate(day, 'EEE d MMM')

            return (
              <WeekDayCell
                key={iso}
                date={day}
                label={dayLabel}
                items={dayItems}
                isToday={isToday(day)}
                isFocused={isFocused}
                projectMap={projectMap}
                selectedItemId={selectedItemId}
                onFocus={handleFocus}
                onActivateItem={handleActivateItem}
                onOpenDay={openDayView}
              />
          )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}

type WeekDayCellProps = {
  date: Date
  label: string
  items: PlannerItem[]
  isToday: boolean
  isFocused: boolean
  projectMap: Map<string, Project>
  selectedItemId: string | null
  onFocus: (date: Date) => void
  onActivateItem: (id: string) => void
  onOpenDay: (date: Date) => void
}

function WeekDayCell({
  date,
  label,
  items,
  isToday,
  isFocused,
  projectMap,
  selectedItemId,
  onFocus,
  onActivateItem,
  onOpenDay,
}: WeekDayCellProps) {
  const { ref, width, height } = useResizeObserver<HTMLDivElement>()

  const layout = useMemo<WeekLayout>(() => {
    if (!items.length || width <= 0 || height <= 0) {
      return { squareSize: 0, gap: 6, columns: 0, rows: 0, visibleCount: 0, showLabels: false }
    }

    const base = computeSquarePacking(width, height, items.length, {
      minSize: MIN_CARD_SIZE,
    })

    if (base.squareSize < LABEL_THRESHOLD) {
      return { ...base, showLabels: false }
    }

    const withLabel = computeSquarePacking(width, height, items.length, {
      minSize: MIN_CARD_SIZE,
      extraRowHeight: LABEL_LINE_HEIGHT,
    })

    if (withLabel.squareSize < LABEL_THRESHOLD) {
      return { ...base, showLabels: false }
    }

    return { ...withLabel, showLabels: true }
  }, [height, items.length, width])

  const visibleItems = layout.visibleCount ? items.slice(0, layout.visibleCount) : []
  const overflowItems = layout.visibleCount < items.length ? items.slice(layout.visibleCount) : []

  return (
    <div
      role="gridcell"
      tabIndex={isFocused ? 0 : -1}
      aria-selected={isFocused}
      onFocus={() => onFocus(date)}
      onClick={() => onFocus(date)}
      onDoubleClick={(event) => {
        const target = event.target as HTMLElement
        if (target.closest('[data-prevent-day-open="true"]')) {
          return
        }
        onFocus(date)
        onOpenDay(date)
      }}
      className={cn(
        'flex min-h-[260px] flex-col rounded-lg border bg-background p-4 outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
        isFocused && 'ring-2 ring-primary/60',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{formatDate(date, 'EEEE')}</span>
        </div>
        {isToday && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">Today</span>
        )}
      </div>
      <div
        ref={ref}
        className="mt-4 grid flex-1 content-start justify-center"
        style={{
          gap: `${layout.gap}px`,
          gridTemplateColumns: layout.columns ? `repeat(${layout.columns}, ${layout.squareSize}px)` : undefined,
          gridAutoRows:
            layout.squareSize > 0
              ? `${layout.squareSize + (layout.showLabels ? LABEL_LINE_HEIGHT : 0)}px`
              : undefined,
        }}
      >
        {visibleItems.map((item) => (
          <div
            key={item.id}
            className="flex w-full flex-col items-start text-left"
            style={{ width: `${layout.squareSize}px` }}
          >
            <SquareCard
              item={item}
              project={projectMap.get(item.projectId) ?? null}
              isSelected={selectedItemId === item.id}
              onActivate={(id) => {
                onFocus(date)
                onActivateItem(id)
              }}
              size={layout.squareSize}
            />
            {layout.showLabels && (
              <span className="mt-1 w-full truncate text-xs font-medium text-foreground">{item.title}</span>
            )}
          </div>
        ))}
        {overflowItems.length > 0 && (
          <OverflowBadge
            items={overflowItems}
            selectedItemId={selectedItemId}
            onActivate={(id) => {
              onFocus(date)
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
