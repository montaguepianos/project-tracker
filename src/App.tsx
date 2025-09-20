import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, parseISO } from 'date-fns'

import { AppShell } from '@/components/layout/AppShell'
import { EditDrawer } from '@/components/EditDrawer'
import { useUrlSync } from '@/hooks/useUrlSync'
import { useThemeStore } from '@/store/themeStore'
import { usePlannerStore } from '@/store/plannerStore'
import { MonthView } from '@/views/MonthView'
import { formatISODate } from '@/lib/string'

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
  const initTheme = useThemeStore((state) => state.initTheme)

  const view = usePlannerStore((state) => state.view)
  const focusedDate = usePlannerStore((state) => state.focusedDate)
  const setFocusedDate = usePlannerStore((state) => state.setFocusedDate)
  const setReferenceDate = usePlannerStore((state) => state.setReferenceDate)
  const deleteItem = usePlannerStore((state) => state.deleteItem)
  const undo = usePlannerStore((state) => state.undo)
  const restoreLastDeleted = usePlannerStore((state) => state.restoreLastDeleted)
  const items = usePlannerStore((state) => state.items)

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

  const openDrawerForDate = useCallback((date: string) => {
    setSelectedItemId(null)
    setDrawerState({ open: true, date, itemId: null })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) return

      if (view === 'month') {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          moveFocus(-1)
          return
        }

        if (event.key === 'ArrowRight') {
          event.preventDefault()
          moveFocus(1)
          return
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault()
          moveFocus(-7)
          return
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault()
          moveFocus(7)
          return
        }
      }

      if (event.key.toLowerCase() === 'e' && selectedItemId) {
        event.preventDefault()
        setDrawerState({ open: true, itemId: selectedItemId })
        return
      }

      if (event.key === 'Delete' && selectedItemId) {
        event.preventDefault()
        const confirmDelete = window.confirm('Delete the selected item?')
        if (confirmDelete) {
          deleteItem(selectedItemId)
          setSelectedItemId(null)
        }
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        restoreLastDeleted()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteItem, focusedDate, moveFocus, restoreLastDeleted, selectedItemId, view])

  useEffect(() => {
    if (!selectedItemId) return
    const exists = items.some((item) => item.id === selectedItemId)
    if (!exists) {
      setSelectedItemId(null)
    }
  }, [items, selectedItemId])

  const handleAdd = () => openDrawerForDate(focusedDate)

  return (
    <AppShell onAddItem={handleAdd}>
      {view === 'month' ? (
        <MonthView
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
          onEditItem={(id) => {
            setSelectedItemId(id)
            setDrawerState({ open: true, itemId: id })
          }}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          {view === 'week' ? 'Week view coming soon' : 'Day view coming soon'}
        </div>
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
    </AppShell>
  )
}
