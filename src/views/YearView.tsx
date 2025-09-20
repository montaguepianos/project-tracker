import { useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import {
  addMonths,
  endOfMonth,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfYear,
} from 'date-fns'

import { TooltipProvider } from '@/components/ui/tooltip'
import { SquareCard } from '@/components/calendar/SquareCard'
import { OverflowBadge } from '@/components/calendar/OverflowBadge'
import { usePlannerStore } from '@/store/plannerStore'
import { getFilteredItems, groupItemsByDate } from '@/store/selectors'
import { getMonthMatrix, WEEKDAY_LABELS } from '@/lib/date'
import { formatISODate } from '@/lib/string'
import { cn } from '@/lib/utils'
import type { PlannerItem, Project } from '@/types'

const MAX_SQUARES = 3
const MINI_SQUARE_SIZE = 14

export type YearViewProps = {
  selectedItemId: string | null
  onSelectItem: (id: string) => void
  onShowDetails: (id: string) => void
  onOpenMonth: (date: Date) => void
  onOpenDay: (date: Date) => void
}

export function YearView({ selectedItemId, onSelectItem, onShowDetails, onOpenMonth, onOpenDay }: YearViewProps) {
  const items = usePlannerStore((state) => state.items)
  const filters = usePlannerStore((state) => state.filters)
  const projects = usePlannerStore((state) => state.projects)
  const referenceDate = usePlannerStore((state) => state.referenceDate)
  const focusedDate = usePlannerStore((state) => state.focusedDate)

  const yearStart = useMemo(() => startOfYear(parseISO(referenceDate)), [referenceDate])
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, index) => startOfMonth(addMonths(yearStart, index))),
    [yearStart],
  )

  const rangeStart = useMemo(() => {
    const value = filters.range.start ? parseISO(filters.range.start) : null
    return value && Number.isFinite(value.getTime()) ? value : null
  }, [filters.range.start])

  const rangeEnd = useMemo(() => {
    const value = filters.range.end ? parseISO(filters.range.end) : null
    return value && Number.isFinite(value.getTime()) ? value : null
  }, [filters.range.end])

  const isCustomRange =
    filters.range.preset === 'custom' && rangeStart !== null && rangeEnd !== null && rangeStart.getTime() <= rangeEnd.getTime()

  const monthsToRender = useMemo(() => {
    if (!isCustomRange || !rangeStart || !rangeEnd) {
      return months
    }
    return months.filter((monthDate) => {
      const start = monthDate
      const end = endOfMonth(monthDate)
      return end.getTime() >= rangeStart.getTime() && start.getTime() <= rangeEnd.getTime()
    })
  }, [isCustomRange, months, rangeEnd, rangeStart])

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects])
  const filteredItems = useMemo(() => getFilteredItems(items, filters, projects), [items, filters, projects])
  const groupedByDate = useMemo(() => groupItemsByDate(filteredItems), [filteredItems])
  const focusedIso = useMemo(() => formatISODate(parseISO(focusedDate)), [focusedDate])
  const focusDate = useMemo(() => parseISO(focusedIso), [focusedIso])
  const focusVisible = useMemo(() => monthsToRender.some((month) => isSameMonth(month, focusDate)), [monthsToRender, focusDate])
  const fallbackMonth = monthsToRender[0] ?? null

  const focusMonthRef = useRef<HTMLElement | null>(null)
  const hasScrolledRef = useRef(false)

  useEffect(() => {
    hasScrolledRef.current = false
    focusMonthRef.current = null
  }, [yearStart, filters.range.start, filters.range.end])

  useEffect(() => {
    if (focusMonthRef.current && !hasScrolledRef.current) {
      focusMonthRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      focusMonthRef.current.classList.add('ring-2', 'ring-primary/60')
      hasScrolledRef.current = true
      const node = focusMonthRef.current
      window.setTimeout(() => {
        node?.classList.remove('ring-2', 'ring-primary/60')
      }, 1200)
    }
  }, [monthsToRender])

  const year = yearStart.getFullYear()
  const hiddenBefore = isCustomRange && rangeStart && rangeStart.getFullYear() < year
  const hiddenAfter = isCustomRange && rangeEnd && rangeEnd.getFullYear() > year
  const noMonths = monthsToRender.length === 0

  return (
    <TooltipProvider delayDuration={150}>
      {noMonths ? (
        <p
          className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          No months in the selected range for {year}. Adjust the custom dates to view this year.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {monthsToRender.map((monthDate) => {
            const monthIso = monthDate.toISOString()
            const shouldFocus = focusVisible ? isSameMonth(focusDate, monthDate) : fallbackMonth ? monthDate.getTime() === fallbackMonth.getTime() : false

            return (
              <MiniMonth
                key={monthIso}
                monthDate={monthDate}
                groupedByDate={groupedByDate}
                projectMap={projectMap}
                selectedItemId={selectedItemId}
                focusedIso={focusedIso}
                onSelectItem={onSelectItem}
                onShowDetails={onShowDetails}
                onOpenMonth={onOpenMonth}
                onOpenDay={onOpenDay}
                isFocusMonth={shouldFocus}
                mountRef={shouldFocus ? focusMonthRef : undefined}
              />
            )
          })}
        </div>
      )}
      {isCustomRange && !noMonths && (hiddenBefore || hiddenAfter) && (
        <p className="mt-3 text-xs text-muted-foreground" role="status" aria-live="polite">
          Range extends {hiddenBefore ? 'before ' : ''}{hiddenAfter ? 'after ' : ''}{year}. Only months within this year are shown.
        </p>
      )}
    </TooltipProvider>
  )
}

type MiniMonthProps = {
  monthDate: Date
  groupedByDate: Record<string, PlannerItem[]>
  projectMap: Map<string, Project>
  selectedItemId: string | null
  focusedIso: string
  onSelectItem: (id: string) => void
  onShowDetails: (id: string) => void
  onOpenMonth: (date: Date) => void
  onOpenDay: (date: Date) => void
  isFocusMonth?: boolean
  mountRef?: MutableRefObject<HTMLElement | null>
}

function MiniMonth({
  monthDate,
  groupedByDate,
  projectMap,
  selectedItemId,
  focusedIso,
  onSelectItem,
  onShowDetails,
  onOpenMonth,
  onOpenDay,
  isFocusMonth = false,
  mountRef,
}: MiniMonthProps) {
  const matrix = useMemo(() => getMonthMatrix(monthDate), [monthDate])
  const monthLabel = format(monthDate, 'MMM yyyy')

  return (
    <section
      ref={(node) => {
        if (isFocusMonth && mountRef) {
          mountRef.current = node
        }
      }}
      className={cn(
        'rounded-lg border bg-background p-3 shadow-sm transition',
        isFocusMonth && 'border-primary/60 shadow-primary/10',
      )}
    >
      <button
        type="button"
        className="mb-2 flex items-center justify-between text-sm font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onOpenMonth(monthDate)}
      >
        {monthLabel}
      </button>
      <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="text-center">
            {label.charAt(0)}
          </span>
        ))}
      </div>
      <div className="mt-2 grid gap-1">
        {matrix.map((week, index) => (
          <div key={index} className="grid grid-cols-7 gap-1 text-[11px]">
            {week.map((day) => {
              const iso = formatISODate(day)
              const dayItems = groupedByDate[iso] ?? []
              const isCurrentMonth = isSameMonth(day, monthDate)
              const isFocused = iso === focusedIso

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onOpenDay(day)}
                  onDoubleClick={() => onOpenDay(day)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-sm border border-transparent p-1 text-left text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isCurrentMonth ? 'bg-background' : 'bg-muted/40 text-muted-foreground',
                    isFocused && 'border-primary/60 ring-1 ring-primary/40',
                  )}
                >
                  <span className="text-[10px] font-medium leading-none">{day.getDate()}</span>
                  <div className="flex flex-wrap gap-[2px]">
                    {dayItems.slice(0, MAX_SQUARES).map((item) => (
                      <SquareCard
                        key={item.id}
                        size={MINI_SQUARE_SIZE}
                        item={item}
                        project={projectMap.get(item.projectId) ?? null}
                        isSelected={selectedItemId === item.id}
                        onActivate={(id) => {
                          onSelectItem(id)
                          onShowDetails(id)
                        }}
                      />
                    ))}
                    {dayItems.length > MAX_SQUARES && (
                      <OverflowBadge
                        items={dayItems.slice(MAX_SQUARES)}
                        selectedItemId={selectedItemId}
                        onActivate={(id) => {
                          onSelectItem(id)
                          onShowDetails(id)
                        }}
                        projectMap={projectMap}
                        size={MINI_SQUARE_SIZE}
                      />
                    )}
                  </div>
                  {isToday(day) && <span className="mt-1 rounded-sm bg-primary px-1.5 py-[1px] text-[9px] text-primary-foreground">Today</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
