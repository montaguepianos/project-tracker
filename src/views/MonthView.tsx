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
import { useResizeObserver } from '@/hooks/useResizeObserver'

const MIN_CARD_SIZE = 14
const GAP_LARGE = 6
const GAP_MEDIUM = 4
const GAP_SMALL = 2

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
  isCurrentMonth,
  isFocused,
  isToday,
  selectedItemId,
  onFocus,
  onOpenItem,
  projectMap,
}: DayCellProps) {
  const { ref, width, height } = useResizeObserver<HTMLDivElement>()
  const layout = useMemo(() => computePacking(width, height, items.length), [width, height, items.length])
  const visibleItems = layout.visibleCount ? items.slice(0, layout.visibleCount) : []
  const overflowItems = layout.visibleCount < items.length ? items.slice(layout.visibleCount) : []

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
            onOpen={onOpenItem}
            size={layout.squareSize}
          />
        ))}
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

type PackingResult = {
  squareSize: number
  gap: number
  columns: number
  rows: number
  visibleCount: number
}

function computePacking(width: number, height: number, count: number): PackingResult {
  if (!count || width <= 0 || height <= 0) {
    return { squareSize: 0, gap: GAP_LARGE, columns: 0, rows: 0, visibleCount: 0 }
  }

  let best: PackingResult | null = null
  const maxColumns = Math.max(1, Math.floor((width + GAP_SMALL) / (MIN_CARD_SIZE + GAP_SMALL)))
  const maxRows = Math.max(1, Math.floor((height + GAP_SMALL) / (MIN_CARD_SIZE + GAP_SMALL)))

  for (let columns = 1; columns <= Math.min(count, maxColumns); columns++) {
    const rows = Math.ceil(count / columns)
    if (rows > maxRows) continue

    const gapCandidates = [GAP_LARGE, GAP_MEDIUM, GAP_SMALL]
    for (const gap of gapCandidates) {
      const size = availableSquare(width, height, columns, rows, gap)
      const candidate: PackingResult = { squareSize: size, gap, columns, rows, visibleCount: count }
      if (!best || size > best.squareSize) {
        best = candidate
      }
    }
  }

  if (best && best.squareSize >= MIN_CARD_SIZE) {
    return best
  }

  const fallbackGap = GAP_SMALL
  const columns = Math.max(1, Math.floor((width + fallbackGap) / (MIN_CARD_SIZE + fallbackGap)))
  const rows = Math.max(1, Math.floor((height + fallbackGap) / (MIN_CARD_SIZE + fallbackGap)))
  const visibleCapacity = Math.max(1, columns * rows)
  const visibleCount = Math.min(count, visibleCapacity)
  const size = availableSquare(width, height, columns, rows, fallbackGap)

  return {
    squareSize: Math.max(MIN_CARD_SIZE, size),
    gap: fallbackGap,
    columns,
    rows,
    visibleCount,
  }
}

function availableSquare(width: number, height: number, columns: number, rows: number, gap: number) {
  const widthAvailable = width - gap * (columns - 1)
  const heightAvailable = height - gap * (rows - 1)
  return Math.max(0, Math.min(widthAvailable / columns, heightAvailable / rows))
}
