import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarDays, Filter, Pencil, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePlannerStore, getVisibleProjectIds } from '@/store/plannerStore'
import type { Filters } from '@/store/plannerStore'
import {
  clampToPlannerRange,
  getMonthRangeFor,
  getNextMonthRange,
  getNextTwoWeeksRange,
  getThisMonthRange,
  getThisWeekRange,
  getWeekRangeFor,
  getYearRangeFor,
  MAX_PLANNER_DATE,
  MIN_PLANNER_DATE,
} from '@/lib/date'
import { formatISODate } from '@/lib/string'
import { cn } from '@/lib/utils'
import type { PlannerItem, PlannerView, Project } from '@/types'
import { deriveColour } from '@/lib/colour'
import { ProjectDeleteDialog } from '@/components/ProjectDeleteDialog'

const PRESETS = [
  { value: 'this-week', label: 'This week' },
  { value: 'next-two-weeks', label: 'Next 2 weeks' },
  { value: 'this-month', label: 'This month' },
  { value: 'next-month', label: 'Next month' },
  { value: 'custom', label: 'Custom…' },
] as const

export function FiltersBar() {
  const filters = usePlannerStore((state) => state.filters)
  const setFilters = usePlannerStore((state) => state.setFilters)
  const projects = usePlannerStore((state) => state.projects)
  const toggleProjectVisibility = usePlannerStore((state) => state.toggleProjectVisibility)
  const selectAllProjects = usePlannerStore((state) => state.selectAllProjects)
  const clearProjectSelection = usePlannerStore((state) => state.clearProjectSelection)
  const items = usePlannerStore((state) => state.items)
  const view = usePlannerStore((state) => state.view)
  const referenceDate = usePlannerStore((state) => state.referenceDate)
  const focusedDate = usePlannerStore((state) => state.focusedDate)
  const setReferenceDate = usePlannerStore((state) => state.setReferenceDate)
  const setFocusedDate = usePlannerStore((state) => state.setFocusedDate)
  const setView = usePlannerStore((state) => state.setView)
  const itemsPerProject = useMemo(() => countItemsPerProject(items), [items])
  const [pendingRange, setPendingRange] = useState<{ start: string; end: string } | null>(null)

  useEffect(() => {
    if (filters.range.preset !== 'custom') {
      setPendingRange(null)
    }
  }, [filters.range.preset, filters.range.start, filters.range.end])

  const applyRangePreset = (range: { start: Date; end: Date }, preset: Filters['range']['preset']) => {
    const startIso = formatISODate(range.start)
    const endIso = formatISODate(range.end)

    setFilters((current) => ({
      ...current,
      range: {
        start: startIso,
        end: endIso,
        preset,
      },
    }))
  }

  const handlePresetChange = (next: string) => {
    switch (next) {
      case 'this-week': {
        const range = getThisWeekRange()
        const startIso = formatISODate(range.start)
        setReferenceDate(startIso)
        setFocusedDate(startIso)
        applyRangePreset(range, 'this-week')
        setPendingRange(null)
        return
      }
      case 'next-two-weeks': {
        const range = getNextTwoWeeksRange()
        const startIso = formatISODate(range.start)
        setReferenceDate(startIso)
        setFocusedDate(startIso)
        applyRangePreset(range, 'next-two-weeks')
        setPendingRange(null)
        return
      }
      case 'this-month': {
        if (view === 'year') {
          setView('month')
        }
        const range = getThisMonthRange()
        const startIso = formatISODate(range.start)
        setReferenceDate(startIso)
        setFocusedDate(startIso)
        applyRangePreset(range, 'this-month')
        setPendingRange(null)
        return
      }
      case 'next-month': {
        if (view === 'year') {
          setView('month')
        }
        const range = getNextMonthRange()
        const startIso = formatISODate(range.start)
        setReferenceDate(startIso)
        setFocusedDate(startIso)
        applyRangePreset(range, 'next-month')
        setPendingRange(null)
        return
      }
      default:
        setPendingRange({
          start: filters.range.start,
          end: filters.range.end,
        })
        setFilters((current) => ({
          ...current,
          range: {
            ...current.range,
            preset: 'custom',
          },
        }))
    }
  }

  const visibleProjectIds = useMemo(() => getVisibleProjectIds(filters, projects), [filters, projects])

  const jumpValue = useMemo(() => {
    if (view === 'year') {
      return format(parseISO(referenceDate), 'yyyy')
    }
    if (view === 'month') {
      return format(parseISO(referenceDate), 'yyyy-MM')
    }
    return format(parseISO(focusedDate), 'yyyy-MM-dd')
  }, [view, referenceDate, focusedDate])

  const handleApplyCustom = () => {
    const startRaw = pendingRange?.start ?? filters.range.start
    const endRaw = pendingRange?.end ?? filters.range.end
    if (!startRaw || !endRaw) return

    const startDate = clampToPlannerRange(parseISO(startRaw))
    const endDate = clampToPlannerRange(parseISO(endRaw))
    const startTime = startDate.getTime()
    const endTime = endDate.getTime()
    const startFinal = startTime <= endTime ? startDate : endDate
    const endFinal = startTime <= endTime ? endDate : startDate

    applyRangePreset({ start: startFinal, end: endFinal }, 'custom')

    if (view !== 'year') {
      const anchor = formatISODate(startFinal)
      setReferenceDate(anchor)
      setFocusedDate(anchor)
    }

    setPendingRange({ start: formatISODate(startFinal), end: formatISODate(endFinal) })
  }

  const handleJumpToDate = (value: string) => {
    if (!value) return

    if (view === 'year') {
      const numeric = Number.parseInt(value, 10)
      if (!Number.isFinite(numeric)) return
      const minYear = MIN_PLANNER_DATE.getFullYear()
      const maxYear = MAX_PLANNER_DATE.getFullYear()
      const clampedYear = Math.min(Math.max(numeric, minYear), maxYear)
      const base = clampToPlannerRange(new Date(clampedYear, 0, 1))
      const { start, end } = getYearRangeFor(base)
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
      return
    }

    if (view === 'month') {
      const [year, month] = value.split('-').map(Number)
      if (!year || !month) return
      const base = clampToPlannerRange(new Date(year, month - 1, 1))
      const { start, end } = getMonthRangeFor(base)
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
      return
    }

    const selected = clampToPlannerRange(parseISO(value))

    if (view === 'week') {
      const { start, end } = getWeekRangeFor(selected)
      const startIso = formatISODate(start)
      setReferenceDate(startIso)
      setFocusedDate(formatISODate(selected))
      setFilters((current) => ({
        ...current,
        range: {
          start: startIso,
          end: formatISODate(end),
          preset: 'custom',
        },
      }))
      return
    }

    const iso = formatISODate(selected)
    setReferenceDate(iso)
    setFocusedDate(iso)
    setFilters((current) => ({
      ...current,
      range: {
        start: iso,
        end: iso,
        preset: 'custom',
      },
    }))
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card/40 p-3">
      <ProjectsPopover
        filters={filters}
        projects={projects}
        itemsPerProject={itemsPerProject}
        toggleProjectVisibility={toggleProjectVisibility}
        selectAllProjects={selectAllProjects}
        clearProjectSelection={clearProjectSelection}
      />

      <ColourLegend
        projects={projects}
        visibleProjectIds={visibleProjectIds}
        toggleProjectVisibility={toggleProjectVisibility}
      />

      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <Select value={filters.range.preset} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filters.range.preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="from"
              type="date"
              value={pendingRange?.start ?? filters.range.start}
              onChange={(event) =>
                setPendingRange((current) => ({
                  start: event.target.value,
                  end: current?.end ?? filters.range.end,
                }))
              }
              className="h-9 w-36"
            />
            <Label htmlFor="to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="to"
              type="date"
              value={pendingRange?.end ?? filters.range.end}
              onChange={(event) =>
                setPendingRange((current) => ({
                  start: current?.start ?? filters.range.start,
                  end: event.target.value,
                }))
              }
              className="h-9 w-36"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label="Apply custom range"
              onClick={handleApplyCustom}
            >
              Apply
            </Button>
          </div>
        )}
        <JumpToDateControl view={view} value={jumpValue} onChange={handleJumpToDate} />
      </div>

      <div className="min-w-[200px] flex-1">
        <Input
          placeholder="Search by title"
          value={filters.search}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              search: event.target.value,
            }))
          }
        />
      </div>
    </div>
  )
}

type ProjectsPopoverProps = {
  filters: Filters
  projects: Project[]
  itemsPerProject: Record<string, number>
  toggleProjectVisibility: (id: string) => void
  selectAllProjects: () => void
  clearProjectSelection: () => void
}

type JumpToDateControlProps = {
  view: PlannerView
  value: string
  onChange: (value: string) => void
}

function ProjectsPopover({
  filters,
  projects,
  itemsPerProject,
  toggleProjectVisibility,
  selectAllProjects,
  clearProjectSelection,
}: ProjectsPopoverProps) {
  const addProject = usePlannerStore((state) => state.addProject)
  const updateProject = usePlannerStore((state) => state.updateProject)
  const deleteProject = usePlannerStore((state) => state.deleteProject)
  const [open, setOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createColour, setCreateColour] = useState('#1C7ED6')
  const [createColourDirty, setCreateColourDirty] = useState(false)
  const [createError, setCreateError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColour, setEditColour] = useState('#1C7ED6')
  const [editError, setEditError] = useState('')
  const [projectPendingDelete, setProjectPendingDelete] = useState<Project | null>(null)

  useEffect(() => {
    if (createColourDirty) return
    const derived = createName ? deriveColour(createName) : '#1C7ED6'
    setCreateColour(derived)
  }, [createColourDirty, createName])

  useEffect(() => {
    if (!open) {
      setEditingId(null)
      setEditError('')
      setCreateError('')
      setCreateColourDirty(false)
    }
  }, [open])

  const isAllSelected = filters.projectFilterMode === 'all'

  const buttonLabel = (() => {
    if (isAllSelected) return 'All projects'
    if (filters.projectIds.length === 0) return 'No projects'
    return `${filters.projectIds.length} selected`
  })()

  const handleCreate = () => {
    const trimmed = createName.trim()
    if (!trimmed) {
      setCreateError('Name is required')
      return
    }

    if (projects.some((project) => project.name.toLowerCase() === trimmed.toLowerCase())) {
      setCreateError('Project name must be unique')
      return
    }

    const projectId = addProject({ name: trimmed, colour: createColour })
    const state = usePlannerStore.getState()
    if (state.filters.projectFilterMode === 'include' && !state.filters.projectIds.includes(projectId)) {
      toggleProjectVisibility(projectId)
    }

    setCreateName('')
    setCreateColour('#1C7ED6')
    setCreateColourDirty(false)
    setCreateError('')
  }

  const startEditing = (project: Project) => {
    setEditingId(project.id)
    setEditName(project.name)
    setEditColour(project.colour)
    setEditError('')
  }

  const handleEditSave = () => {
    if (!editingId) return
    const trimmed = editName.trim()
    if (!trimmed) {
      setEditError('Name is required')
      return
    }

    if (projects.some((project) => project.id !== editingId && project.name.toLowerCase() === trimmed.toLowerCase())) {
      setEditError('Project name must be unique')
      return
    }

    updateProject(editingId, { name: trimmed, colour: editColour })
    setEditingId(null)
  }

  const handleDeleteRequest = (project: Project) => {
    setEditingId(null)
    setEditError('')
    setProjectPendingDelete(project)
  }

  const handleConfirmDelete = (reassignTo?: string) => {
    if (!projectPendingDelete) return
    const options = reassignTo ? { reassignTo } : undefined
    deleteProject(projectPendingDelete.id, options)
    setProjectPendingDelete(null)
  }

  const handleCancelDelete = () => {
    setProjectPendingDelete(null)
  }

  const pendingDeleteCount = projectPendingDelete ? itemsPerProject[projectPendingDelete.id] ?? 0 : 0

  const isProjectChecked = (projectId: string) => {
    if (filters.projectFilterMode === 'all') return true
    return filters.projectIds.includes(projectId)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            {buttonLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 space-y-4 p-4" align="start">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Projects</span>
            <div className="flex items-center gap-2 text-xs">
              <button type="button" onClick={selectAllProjects} className="underline-offset-2 hover:underline">
                Select all
              </button>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={clearProjectSelection} className="underline-offset-2 hover:underline">
                Clear all
              </button>
            </div>
          </div>

          <ul className="space-y-2">
            {projects.map((project) => {
              const checked = isProjectChecked(project.id)
              const isEditing = editingId === project.id
              const usage = itemsPerProject[project.id] ?? 0

              return (
                <li key={project.id} data-project-id={project.id} className="rounded-md border p-2">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="Project name" />
                      <div className="flex items-center gap-3">
                        <Label htmlFor={`colour-${project.id}`} className="text-xs text-muted-foreground">
                          Colour
                        </Label>
                        <Input
                          id={`colour-${project.id}`}
                          type="color"
                          value={editColour}
                          onChange={(event) => setEditColour(event.target.value)}
                          className="h-9 w-16"
                        />
                      </div>
                      {editError && <p className="text-xs text-destructive">{editError}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleEditSave}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Checkbox checked={checked} onCheckedChange={() => toggleProjectVisibility(project.id)} />
                      <span
                        className="flex h-4 w-4 rounded-sm border"
                        style={{ backgroundColor: project.colour }}
                        aria-hidden="true"
                      />
                      <div className="flex-1 text-sm">
                        <p className="font-medium leading-none">{project.name}</p>
                        {usage > 0 && (
                          <p className="text-xs text-muted-foreground">{usage} item{usage === 1 ? '' : 's'}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => startEditing(project)}
                          aria-label={`Edit ${project.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDeleteRequest(project)}
                          aria-label={`Delete ${project.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="space-y-2 rounded-md border border-dashed p-3">
            <p className="text-sm font-medium">Create project</p>
            <Input
              value={createName}
              onChange={(event) => {
                setCreateName(event.target.value)
                setCreateError('')
              }}
              placeholder="Name"
            />
            <div className="flex items-center gap-3">
              <Label htmlFor="new-project-colour" className="text-xs text-muted-foreground">
                Colour
              </Label>
              <Input
                id="new-project-colour"
                type="color"
                value={createColour}
                onChange={(event) => {
                  setCreateColour(event.target.value)
                  setCreateColourDirty(true)
                }}
                className="h-9 w-16"
              />
            </div>
            {createError && <p className="text-xs text-destructive">{createError}</p>}
            <Button type="button" size="sm" className="gap-2" onClick={handleCreate}>
              <Plus className="h-4 w-4" />
              Add project
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <ProjectDeleteDialog
        open={Boolean(projectPendingDelete)}
        project={projectPendingDelete}
        projects={projects}
        itemCount={pendingDeleteCount}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}


function JumpToDateControl({ view, value, onChange }: JumpToDateControlProps) {
  const isMonthView = view === 'month'
  const isYearView = view === 'year'

  const minValue = isYearView
    ? String(MIN_PLANNER_DATE.getFullYear())
    : format(MIN_PLANNER_DATE, isMonthView ? 'yyyy-MM' : 'yyyy-MM-dd')
  const maxValue = isYearView
    ? String(MAX_PLANNER_DATE.getFullYear())
    : format(MAX_PLANNER_DATE, isMonthView ? 'yyyy-MM' : 'yyyy-MM-dd')

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="jump-date" className="text-xs text-muted-foreground">
        {isYearView ? 'Jump to year' : 'Jump to date'}
      </Label>
      <Input
        id="jump-date"
        type={isYearView ? 'number' : isMonthView ? 'month' : 'date'}
        value={value}
        min={minValue}
        max={maxValue}
        step={isYearView ? 1 : undefined}
        inputMode={isYearView ? 'numeric' : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={isYearView ? 'h-9 w-[100px]' : isMonthView ? 'h-9 w-[140px]' : 'h-9 w-[160px]'}
      />
    </div>
  )
}

type ColourLegendProps = {
  projects: Project[]
  visibleProjectIds: string[]
  toggleProjectVisibility: (id: string) => void
}

function ColourLegend({ projects, visibleProjectIds, toggleProjectVisibility }: ColourLegendProps) {
  const visibleSet = useMemo(() => new Set(visibleProjectIds), [visibleProjectIds])
  const allVisible = visibleProjectIds.length === projects.length

  if (projects.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {projects.map((project) => {
        const isVisible = visibleSet.has(project.id)
        const dimmed = !isVisible && !allVisible
        return (
          <button
            key={project.id}
            type="button"
            className={cn(
              'flex items-center gap-2 rounded-full border px-2 py-1 text-xs transition-colors',
              dimmed ? 'opacity-40 hover:opacity-70' : 'hover:bg-muted',
            )}
            onClick={() => toggleProjectVisibility(project.id)}
            aria-pressed={isVisible || (allVisible && !visibleSet.size)}
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: project.colour }}
              aria-hidden="true"
            />
            <span>{project.name}</span>
          </button>
        )
      })}
    </div>
  )
}

function countItemsPerProject(items: PlannerItem[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.projectId] = (acc[item.projectId] ?? 0) + 1
    return acc
  }, {})
}
