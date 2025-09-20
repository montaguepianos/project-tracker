import type { ReactNode } from 'react'
import { Eye, LayoutGrid, Rows3 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FiltersBar } from '@/components/FiltersBar'
import { usePlannerStore } from '@/store/plannerStore'
import type { PlannerView } from '@/types'
import { formatDate, MONTH_LABEL_FORMAT } from '@/lib/date'

type AppShellProps = {
  children: ReactNode
  onAddItem: () => void
}

const VIEW_ICONS: Record<PlannerView, React.ComponentType<{ className?: string }>> = {
  month: LayoutGrid,
  week: Rows3,
  day: Eye,
}

const VIEW_LABELS: Record<PlannerView, string> = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
}

export function AppShell({ children, onAddItem }: AppShellProps) {
  const view = usePlannerStore((state) => state.view)
  const referenceDate = usePlannerStore((state) => state.referenceDate)
  const setView = usePlannerStore((state) => state.setView)

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Planning</p>
              <h1 className="text-lg font-semibold">{formatDate(referenceDate, MONTH_LABEL_FORMAT)}</h1>
            </div>
            <div className="flex items-center gap-2">
              {(Object.keys(VIEW_LABELS) as PlannerView[]).map((option) => {
                const Icon = VIEW_ICONS[option]
                const isActive = view === option
                return (
                  <Button
                    key={option}
                    variant={isActive ? 'default' : 'outline'}
                    onClick={() => setView(option)}
                    aria-pressed={isActive}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {VIEW_LABELS[option]}
                  </Button>
                )
              })}
              <Button onClick={onAddItem} className="ml-2">Add item</Button>
            </div>
          </div>
          <FiltersBar />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6">
        {children}
      </main>
    </div>
  )
}
