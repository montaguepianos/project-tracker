import type { ReactNode } from 'react'
import { useCallback, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight, Eye, FileDown, LayoutGrid, Printer, Rows3 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FiltersBar } from '@/components/FiltersBar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { usePlannerStore, getVisibleProjectIds } from '@/store/plannerStore'
import type { PlannerView, Project } from '@/types'
import { formatDate, MONTH_LABEL_FORMAT } from '@/lib/date'
import { formatISODate } from '@/lib/string'
import { exportElementToPdf } from '@/lib/pdf'

type AppShellProps = {
  children: ReactNode
  onAddItem: () => void
  onStepHeading?: (delta: number) => void
  canStepPrev?: boolean
  canStepNext?: boolean
}

const VIEW_ICONS: Record<PlannerView, React.ComponentType<{ className?: string }>> = {
  year: LayoutGrid,
  month: LayoutGrid,
  week: Rows3,
  day: Eye,
}

const VIEW_LABELS: Record<PlannerView, string> = {
  year: 'Year',
  month: 'Month',
  week: 'Week',
  day: 'Day',
}

const VIEW_ORDER: PlannerView[] = ['year', 'month', 'week', 'day']

export function AppShell({ children, onAddItem, onStepHeading, canStepNext = true, canStepPrev = true }: AppShellProps) {
  const view = usePlannerStore((state) => state.view)
  const referenceDate = usePlannerStore((state) => state.referenceDate)
  const setView = usePlannerStore((state) => state.setView)
  const filters = usePlannerStore((state) => state.filters)
  const projects = usePlannerStore((state) => state.projects)

  const contentRef = useRef<HTMLDivElement>(null)

  const visibleProjectIds = useMemo(() => getVisibleProjectIds(filters, projects), [filters, projects])
  const legendProjects = useMemo(() => {
    if (view === 'day') return []
    const allowed = new Set(visibleProjectIds)
    return projects.filter((project) => allowed.has(project.id))
  }, [projects, visibleProjectIds, view])

  const handlePrint = useCallback(() => {
    const orientation = view === 'day' ? 'portrait' : 'landscape'
    const style = document.createElement('style')
    style.setAttribute('data-print-orientation', orientation)
    style.textContent = `@page { size: A4 ${orientation}; margin: 12mm; }`
    document.head.appendChild(style)

    window.setTimeout(() => {
      window.print()
      window.setTimeout(() => {
        if (style.parentNode) {
          style.parentNode.removeChild(style)
        }
      }, 0)
    }, 50)
  }, [view])

  const handleDownloadPdf = useCallback(async () => {
    if (!contentRef.current) return
    const orientation = view === 'day' ? 'portrait' : 'landscape'
    const filename = `planner-${view}-${formatISODate(referenceDate)}.pdf`
    document.body.classList.add('exporting-pdf')
    try {
      await exportElementToPdf(contentRef.current, { filename, orientation })
    } catch (error) {
      console.error('Failed to export PDF', error)
    } finally {
      document.body.classList.remove('exporting-pdf')
    }
  }, [referenceDate, view])

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Planning</p>
              <div className="flex items-center gap-2">
                {onStepHeading && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => onStepHeading(-1)}
                    disabled={!canStepPrev}
                    aria-label={`Previous ${view}`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                <h1 className="text-lg font-semibold">{formatDate(referenceDate, MONTH_LABEL_FORMAT)}</h1>
                {onStepHeading && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => onStepHeading(1)}
                    disabled={!canStepNext}
                    aria-label={`Next ${view}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 print-hidden">
              {VIEW_ORDER.map((option) => {
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
              <div className="flex items-center gap-2">
                <Button variant="outline" className="gap-2" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button variant="outline" className="gap-2" onClick={handleDownloadPdf}>
                  <FileDown className="h-4 w-4" />
                  PDF
                </Button>
                <Button onClick={onAddItem}>Add item</Button>
                <ThemeToggle />
              </div>
            </div>
          </div>
          <div className="print-hidden">
            <FiltersBar />
          </div>
        </div>
      </header>
      <main ref={contentRef} className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 printable-content">
        {children}
        <PrintableLegend projects={legendProjects} />
        <PrintFooter />
      </main>
    </div>
  )
}

function PrintableLegend({ projects }: { projects: Project[] }) {
  if (projects.length === 0) return null

  return (
    <section className="print-only mt-8 border-t pt-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Project legend</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {projects.map((project) => (
          <div key={project.id} className="flex items-center gap-2 text-sm">
            <span
              className="h-3 w-3 rounded-sm border"
              style={{ backgroundColor: project.colour }}
              aria-hidden="true"
            />
            <span>{project.name}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function PrintFooter() {
  const printableDate = formatDate(new Date(), 'd MMM yyyy')
  return (
    <footer className="print-only mt-10 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
      <span>Leila’s Visual Project Tracker</span>
      <span>Printed {printableDate}</span>
    </footer>
  )
}
