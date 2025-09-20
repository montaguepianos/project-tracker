import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, addMonths, parseISO, startOfMonth } from 'date-fns'

import { AppShell } from '@/components/layout/AppShell'
import { EditDrawer } from '@/components/EditDrawer'
import { useUrlSync } from '@/hooks/useUrlSync'
import { useThemeStore } from '@/store/themeStore'
import { usePlannerStore } from '@/store/plannerStore'
import { MonthView } from '@/views/MonthView'
import { WeekView } from '@/views/WeekView'
import { DayView } from '@/views/DayView'
import { ItemDetailsModal } from '@/components/ItemDetailsModal'
import { ItemDeleteDialog } from '@/components/ItemDeleteDialog'
import { formatISODate } from '@/lib/string'
import { clampToPlannerRange, getMonthRangeFor, MIN_PLANNER_DATE, MAX_PLANNER_DATE } from '@/lib/date'

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || target.isContentEditable || tag === 'select'
}

export default function App() {
  useUrlSync()

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [drawerState, setDrawerState] = useState<{ open: boolean; itemId?: string | null; date?: string }>({
    open: false,
  })
  const [detailsItemId, setDetailsItemId] = useState<string | null>(null)
  const [itemDeleteId, setItemDeleteId] = useState<string | null>(null)
  const initTheme = useThemeStore((state) => state.initTheme)

  const view = usePlannerStore((state) => state.view)
  const referenceDate = usePlannerStore((state) => state.referenceDate)
  const focusedDate = usePlannerStore((state) => state.focusedDate)
  const setFocusedDate = usePlannerStore((state) => state.setFocusedDate)
  const setReferenceDate = usePlannerStore((state) => state.setReferenceDate)
  const setFilters = usePlannerStore((state) => state.setFilters)
  const deleteItem = usePlannerStore((state) => state.deleteItem)
  const undo = usePlannerStore((state) => state.undo)
  const restoreLastDeleted = usePlannerStore((state) => state.restoreLastDeleted)
  const items = usePlannerStore((state) => state.items)
  const projects = usePlannerStore((state) => state.projects)

  const focused = useMemo(() => parseISO(focusedDate), [focusedDate])

  useEffect(() => {
    initTheme()
  }, [initTheme])

  const moveFocus = useCallback(
    (delta: number) => {
      const next = addDays(focused, delta)
      const iso = formatISODate(next)
      setFocusedDate(iso)
      setReferenceDate(iso)
    },
    [focused, setFocusedDate, setReferenceDate],
  )

  const stepMonth = useCallback(
    (delta: number) => {
      const base = clampToPlannerRange(startOfMonth(parseISO(referenceDate)))
      const target = clampToPlannerRange(addMonths(base, delta))
      const { start, end } = getMonthRangeFor(target)
      const startIso = formatISODate(start)

      setReferenceDate(startIso)
      setFocusedDate(startIso)
      setFilters((current) => ({
        ...current,
        range: {
          start: startIso,
          end: formatISODate(end),
          preset: 'custom',
        },
      }))
    },
    [referenceDate, setFilters, setFocusedDate, setReferenceDate],
  )

  const openDrawerForDate = useCallback((date: string) => {
    setSelectedItemId(null)
    setDrawerState({ open: true, date, itemId: null })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) return

      const handleDirectional = (delta: number) => {
        event.preventDefault()
        moveFocus(delta)
      }

      if (view === 'month' || view === 'week' || view === 'day') {
        switch (event.key) {
          case 'ArrowLeft':
            handleDirectional(-1)
            return
          case 'ArrowRight':
            handleDirectional(1)
            return
          case 'ArrowUp':
            if (view === 'month') {
              handleDirectional(-7)
            }
            return
          case 'ArrowDown':
            if (view === 'month') {
              handleDirectional(7)
            }
            return
          case 'PageUp':
            if (view !== 'day') {
              handleDirectional(-7)
            }
            return
          case 'PageDown':
            if (view !== 'day') {
              handleDirectional(7)
            }
            return
          default:
            break
        }

        if (view === 'month') {
          if (event.key === '[') {
            event.preventDefault()
            stepMonth(-1)
            return
          }
          if (event.key === ']') {
            event.preventDefault()
            stepMonth(1)
            return
          }
        }
      }

      if (event.key.toLowerCase() === 'e' && selectedItemId) {
        event.preventDefault()
        setDrawerState({ open: true, itemId: selectedItemId })
        return
      }

      if (event.key === 'Delete' && selectedItemId) {
        event.preventDefault()
        setItemDeleteId(selectedItemId)
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        restoreLastDeleted()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusedDate, moveFocus, restoreLastDeleted, selectedItemId, stepMonth, view])

  useEffect(() => {
    if (!selectedItemId) return
    const exists = items.some((item) => item.id === selectedItemId)
    if (!exists) {
      setSelectedItemId(null)
    }
  }, [items, selectedItemId])

  useEffect(() => {
    if (!detailsItemId) return
    const exists = items.some((item) => item.id === detailsItemId)
    if (!exists) {
      setDetailsItemId(null)
    }
  }, [detailsItemId, items])

  useEffect(() => {
    if (!itemDeleteId) return
    const exists = items.some((item) => item.id === itemDeleteId)
    if (!exists) {
      setItemDeleteId(null)
    }
  }, [itemDeleteId, items])

  const openDrawerForItem = useCallback((id: string) => {
    setSelectedItemId(id)
    setDrawerState({ open: true, itemId: id })
  }, [])

  const handleAdd = () => openDrawerForDate(focusedDate)

  const handleShowDetails = useCallback((id: string) => {
    setSelectedItemId(id)
    setDetailsItemId(id)
  }, [])

  const handleRequestDeleteItem = useCallback((id: string) => {
    setItemDeleteId(id)
  }, [])

  const handleCancelDeleteItem = useCallback(() => {
    setItemDeleteId(null)
  }, [])

  const handleConfirmDeleteItem = useCallback(() => {
    if (!itemDeleteId) return
    deleteItem(itemDeleteId)
    setSelectedItemId((current) => (current === itemDeleteId ? null : current))
    setDetailsItemId((current) => (current === itemDeleteId ? null : current))
    setItemDeleteId(null)
  }, [deleteItem, itemDeleteId])

  const detailItem = useMemo(() => items.find((item) => item.id === detailsItemId) ?? null, [detailsItemId, items])
  const detailProject = useMemo(() => {
    if (!detailItem) return null
    return projects.find((project) => project.id === detailItem.projectId) ?? null
  }, [detailItem, projects])

  const deleteItemTarget = useMemo(() => items.find((item) => item.id === itemDeleteId) ?? null, [itemDeleteId, items])
  const deleteItemProject = useMemo(() => {
    if (!deleteItemTarget) return null
    return projects.find((project) => project.id === deleteItemTarget.projectId) ?? null
  }, [deleteItemTarget, projects])

  const monthAnchor = useMemo(() => startOfMonth(parseISO(referenceDate)), [referenceDate])
  const minMonth = startOfMonth(MIN_PLANNER_DATE)
  const maxMonth = startOfMonth(MAX_PLANNER_DATE)
  const canStepPrevMonth = monthAnchor.getTime() > minMonth.getTime()
  const canStepNextMonth = monthAnchor.getTime() < maxMonth.getTime()

  return (
    <AppShell
      onAddItem={handleAdd}
      onStepMonth={view === 'month' ? stepMonth : undefined}
      canStepPrevMonth={view === 'month' ? canStepPrevMonth : undefined}
      canStepNextMonth={view === 'month' ? canStepNextMonth : undefined}
    >
      {view === 'month' && (
        <MonthView
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
          onShowDetails={handleShowDetails}
        />
      )}
      {view === 'week' && (
        <WeekView
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
          onShowDetails={handleShowDetails}
        />
      )}
      {view === 'day' && (
        <DayView
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
          onEditItem={openDrawerForItem}
          onRequestDeleteItem={handleRequestDeleteItem}
        />
      )}

      {undo && (
        <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border bg-background px-4 py-2 shadow-lg">
          <span className="mr-3 text-sm">Item deleted.</span>
          <button
            type="button"
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
            onClick={restoreLastDeleted}
          >
            Undo
          </button>
        </div>
      )}

      <EditDrawer
        open={drawerState.open}
        itemId={drawerState.itemId ?? undefined}
        date={drawerState.date}
        onClose={() => setDrawerState({ open: false })}
      />

      <ItemDetailsModal
        open={Boolean(detailsItemId && detailItem)}
        item={detailItem}
        project={detailProject}
        onClose={() => setDetailsItemId(null)}
        onEdit={(id) => {
          setDetailsItemId(null)
          openDrawerForItem(id)
        }}
        onDelete={(id) => {
          setDetailsItemId(null)
          setItemDeleteId(id)
        }}
      />

      <ItemDeleteDialog
        open={Boolean(itemDeleteId && deleteItemTarget)}
        item={deleteItemTarget}
        project={deleteItemProject}
        onCancel={handleCancelDeleteItem}
        onConfirm={handleConfirmDeleteItem}
      />
    </AppShell>
  )
}
