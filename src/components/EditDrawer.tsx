import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { usePlannerStore } from '@/store/plannerStore'
import { deriveColour, ensureReadableText } from '@/lib/colour'
import {
  PLANNER_ICONS,
  PLANNER_CUSTOM_ICON_COLLECTION,
  getPlannerCustomIconComponent,
  getPlannerCustomIconDefinition,
  resolvePlannerIconMeta,
} from '@/lib/icons'
import { formatISODate, normaliseTitle } from '@/lib/string'
import { parseYmdSafe } from '@/lib/date'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type EditDrawerProps = {
  open: boolean
  itemId?: string | null
  date?: string
  onClose: () => void
}

type Draft = {
  projectId: string | null
  title: string
  notes: string
  date: string
  assignee: string
  icon: string | null
  iconCustom: {
    key: string
    label: string
  } | null
}

const EMPTY_DRAFT: Draft = {
  projectId: null,
  title: '',
  notes: '',
  date: formatISODate(new Date()),
  assignee: '',
  icon: null,
  iconCustom: null,
}

export function EditDrawer({ open, itemId, date, onClose }: EditDrawerProps) {
  const items = usePlannerStore((state) => state.items)
  const projects = usePlannerStore((state) => state.projects)
  const addProject = usePlannerStore((state) => state.addProject)
  const upsertItem = usePlannerStore((state) => state.upsertItem)
  const deleteItem = usePlannerStore((state) => state.deleteItem)

  const currentItem = useMemo(() => items.find((item) => item.id === itemId), [itemId, items])
  const [draft, setDraft] = useState<Draft>(() => ({
    ...EMPTY_DRAFT,
    date: date ?? EMPTY_DRAFT.date,
  }))
  const [isCreatingProject, setCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectColour, setNewProjectColour] = useState('#1C7ED6')
  const [newProjectColourDirty, setNewProjectColourDirty] = useState(false)
  const [projectError, setProjectError] = useState('')
  const [isCustomIconDialogOpen, setCustomIconDialogOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [titleError, setTitleError] = useState('')

  const initialisedRef = useRef<{ mode: 'existing' | 'new' | null; itemId: string | null; version: string | null }>(
    { mode: null, itemId: null, version: null },
  )

  useEffect(() => {
    if (!open) {
      initialisedRef.current = { mode: null, itemId: null, version: null }
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    if (currentItem) {
      const version = currentItem.updatedAt ?? ''
      if (
        initialisedRef.current.mode === 'existing' &&
        initialisedRef.current.itemId === currentItem.id &&
        initialisedRef.current.version === version
      ) {
        return
      }

      setDraft({
        projectId: currentItem.projectId,
        title: currentItem.title,
        notes: currentItem.notes ?? '',
        date: currentItem.date,
        assignee: currentItem.assignee ?? '',
        icon: currentItem.icon ?? null,
        iconCustom: currentItem.iconCustom ?? null,
      })
      initialisedRef.current = { mode: 'existing', itemId: currentItem.id, version }
      setCreatingProject(false)
      setProjectError('')
      return
    }

    if (initialisedRef.current.mode === 'new') {
      return
    }

    const defaultProject = projects[0]?.id ?? null
    const initialDate = date ?? formatISODate(new Date())
    setDraft({
      projectId: defaultProject,
      title: '',
      notes: '',
      date: initialDate,
      assignee: '',
      icon: null,
      iconCustom: null,
    })
    initialisedRef.current = { mode: 'new', itemId: null, version: null }
    setCreatingProject(false)
    setProjectError('')
  }, [currentItem, date, open, projects])

  useEffect(() => {
    if (!isCreatingProject) return
    if (newProjectColourDirty) return
    const derived = newProjectName ? deriveColour(newProjectName) : '#1C7ED6'
    setNewProjectColour(derived)
  }, [isCreatingProject, newProjectColourDirty, newProjectName])

  const selectedProject = projects.find((project) => project.id === draft.projectId) ?? null
  const previewColour = selectedProject?.colour ?? '#888888'
  const previewText = ensureReadableText(previewColour)
  const resolvedIcon = resolvePlannerIconMeta(draft)
  const IconPreview = resolvedIcon.component
  const iconAccessibleName = resolvedIcon.label ?? undefined
  const iconSelectValue = (() => {
    if (draft.icon) return draft.icon
    if (draft.iconCustom) return `custom:${draft.iconCustom.key}`
    return 'none'
  })()
  const CustomSummaryIcon = draft.iconCustom
    ? getPlannerCustomIconComponent(draft.iconCustom.key)
    : null

  useEffect(() => {
    // TEMP: debug state propagation
    console.log('draft.iconCustom changed', draft.iconCustom)
  }, [draft.iconCustom])

  const handleSubmit = () => {
    setFormError('')
    if (!draft.projectId) {
      setProjectError('Choose a project')
      return
    }

    const title = normaliseTitle(draft.title)
    if (!title) {
      setTitleError('Please add a title.')
      return
    }

    const selectedDate = draft.date || formatISODate(new Date())
    const d = parseYmdSafe(selectedDate)
    if (!d.ok) {
      setFormError('Please choose a valid date.')
      return
    }

    const iconCustom = (() => {
      const candidate = draft.iconCustom
      if (!candidate) return undefined
      const key = candidate.key?.trim()
      if (!key) return undefined
      const label = candidate.label?.trim() || key
      return { key, label }
    })()

    console.log('submit.upsert.input', { draft, iconCustom })
    upsertItem({
      id: currentItem?.id,
      projectId: draft.projectId,
      title,
      notes: draft.notes.trim() || undefined,
      date: d.value,
      assignee: draft.assignee.trim() || undefined,
      icon: iconCustom ? undefined : draft.icon ?? undefined,
      iconCustom,
    })

    onClose()
  }

  const handleDelete = () => {
    if (!currentItem) return
    const confirmation = window.confirm('Delete this item? This can be undone from the toast.')
    if (!confirmation) return
    deleteItem(currentItem.id)
    onClose()
  }

  const resetNewProjectFields = () => {
    setCreatingProject(false)
    setNewProjectName('')
    setNewProjectColour('#1C7ED6')
    setNewProjectColourDirty(false)
    setProjectError('')
  }

  const handleIconSelect = (value: string) => {
    console.log('iconSelect.change', value)
    if (!value) {
      // Ignore spurious empty value emissions from Radix/native select sync
      return
    }
    if (value === '__choose__') {
      setCustomIconDialogOpen(true)
      return
    }
    if (value === 'none') {
      setDraft((prev) => ({ ...prev, icon: null, iconCustom: null }))
      return
    }
    if (value.startsWith('custom:')) {
      const key = value.slice('custom:'.length)
      if (!key) {
        setCustomIconDialogOpen(true)
        return
      }
      setDraft((prev) => {
        if (prev.iconCustom?.key === key) {
          return prev
        }
        const definition = getPlannerCustomIconDefinition(key)
        return {
          ...prev,
          icon: null,
          iconCustom: {
            key,
            label: definition?.label ?? key,
          },
        }
      })
      return
    }
    setDraft((prev) => ({ ...prev, icon: value, iconCustom: null }))
  }

  const iconTriggerRef = useRef<HTMLButtonElement | null>(null)

  const handleCustomIconApply = (selection: { key: string; label: string }) => {
    // TEMP: debug test flow
    console.log('handleCustomIconApply', selection)
    setDraft((prev) => {
      console.log('setDraft apply prev.iconCustom -> next', prev.iconCustom, selection)
      return { ...prev, icon: null, iconCustom: selection }
    })
    setCustomIconDialogOpen(false)
    window.requestAnimationFrame(() => {
      iconTriggerRef.current?.focus()
    })
  }

  const handleCustomIconCancel = () => {
    setCustomIconDialogOpen(false)
  }

  const handleClearCustomIcon = () => {
    setDraft((prev) => ({ ...prev, icon: null, iconCustom: null }))
  }

  const handleProjectSelect = (value: string) => {
    if (value === '__create__') {
      setCreatingProject(true)
      setProjectError('')
      setNewProjectColourDirty(false)
      const fallbackName = newProjectName || 'New project'
      setNewProjectColour(deriveColour(fallbackName))
      return
    }

    setDraft((prev) => ({ ...prev, projectId: value }))
    setCreatingProject(false)
    setProjectError('')
  }

  const handleCreateProject = () => {
    const trimmed = newProjectName.trim()
    if (!trimmed) {
      setProjectError('Project name is required')
      return
    }

    if (projects.some((project) => project.name.toLowerCase() === trimmed.toLowerCase())) {
      setProjectError('Project name must be unique')
      return
    }

    const projectId = addProject({ name: trimmed, colour: newProjectColour })
    setDraft((prev) => ({ ...prev, projectId }))
    resetNewProjectFields()
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
        <SheetContent>
        <SheetHeader>
          <SheetTitle>{currentItem ? 'Edit item' : 'Add item'}</SheetTitle>
        </SheetHeader>
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select value={draft.projectId ?? ''} onValueChange={handleProjectSelect}>
              <SelectTrigger id="project">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
                <SelectItem value="__create__">Create new project…</SelectItem>
              </SelectContent>
            </Select>
            {projectError && <p className="text-xs text-destructive">{projectError}</p>}
          </div>

          {isCreatingProject && (
            <div className="space-y-3 rounded-md border border-dashed p-3">
              <p className="text-sm font-medium">New project</p>
              <Input
                value={newProjectName}
                onChange={(event) => {
                  setNewProjectName(event.target.value)
                  setProjectError('')
                  setNewProjectColourDirty(false)
                }}
                placeholder="Project name"
              />
              <div className="flex items-center gap-3">
                <Label htmlFor="drawer-new-project-colour" className="text-xs text-muted-foreground">
                  Colour
                </Label>
                <Input
                  id="drawer-new-project-colour"
                  type="color"
                  value={newProjectColour}
                  onChange={(event) => {
                    setNewProjectColour(event.target.value)
                    setNewProjectColourDirty(true)
                  }}
                  className="h-9 w-16"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={handleCreateProject}>
                  Save project
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={resetNewProjectFields}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={draft.title}
              onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
              required
              placeholder="Homepage hero"
            />
            {titleError && <p className="text-xs text-destructive">{titleError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={draft.notes}
              onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Key details"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="icon">Icon</Label>
            <Select value={iconSelectValue} onValueChange={handleIconSelect}>
              <SelectTrigger id="icon" ref={iconTriggerRef}>
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    {IconPreview && (
                      <IconPreview
                        className="h-4 w-4"
                        {...(iconAccessibleName ? { 'aria-label': iconAccessibleName, role: 'img' } : { 'aria-hidden': true })}
                      />
                    )}
                    <span className="text-sm font-medium" data-testid="icon-summary-label">{resolvedIcon.label ?? 'None'}</span>
                  </span>
                  <SelectValue className="sr-only" placeholder="None" />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectSeparator />
                {PLANNER_ICONS.map((entry) => {
                  const IconComponent = entry.icon
                  return (
                    <SelectItem key={entry.value} value={entry.value}>
                      <span className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4" aria-hidden="true" />
                        {entry.label}
                      </span>
                    </SelectItem>
                  )
                })}
                {draft.iconCustom && (
                  <>
                    <SelectSeparator />
                    <SelectItem value={`custom:${draft.iconCustom.key}`}>
                      <span className="flex items-center gap-2">
                        {CustomSummaryIcon && (
                          <CustomSummaryIcon
                            className="h-4 w-4"
                            {...(draft.iconCustom.label
                              ? { 'aria-label': draft.iconCustom.label, role: 'img' }
                              : { 'aria-hidden': true })}
                          />
                        )}
                        Custom icon: {draft.iconCustom.label}
                      </span>
                    </SelectItem>
                  </>
                )}
                <SelectSeparator />
                <SelectItem value="__choose__" data-testid="choose-custom-icon">Choose from collection…</SelectItem>
              </SelectContent>
            </Select>
            {draft.iconCustom && (
              <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex items-center gap-3">
                  {CustomSummaryIcon && (
                    <CustomSummaryIcon
                      className="h-5 w-5"
                      {...(draft.iconCustom.label
                        ? { 'aria-label': draft.iconCustom.label, role: 'img' }
                        : { 'aria-hidden': true })}
                    />
                  )}
                  <div className="flex flex-col">
                    <span className="font-medium">{draft.iconCustom.label}</span>
                    <span className="text-xs text-muted-foreground">Custom icon from collection</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setCustomIconDialogOpen(true)}>
                    Change…
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={handleClearCustomIcon}>
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={draft.date}
                onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))}
                required
              />
              {formError && <p className="text-xs text-destructive">{formError}</p>}
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="assignee">Assignee</Label>
              <Input
                id="assignee"
                value={draft.assignee}
                onChange={(event) => setDraft((prev) => ({ ...prev, assignee: event.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Colour</Label>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md border"
                style={{ backgroundColor: previewColour, color: previewText }}
              >
                {IconPreview && (
                  <IconPreview
                    className="h-4 w-4"
                    size={16}
                    {...(iconAccessibleName ? { 'aria-label': iconAccessibleName, role: 'img' } : { 'aria-hidden': true })}
                  />
                )}
                <span>{selectedProject ? selectedProject.name : 'Select a project'}</span>
              </div>
            </div>
          </div>
          <SheetFooter className="pt-4">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-between">
              {currentItem ? (
                <Button variant="destructive" type="button" onClick={handleDelete}>
                  Delete
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Projects manage their own colours.</span>
              )}
              <div className="flex gap-2">
                <Button variant="outline" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </div>
          </SheetFooter>
        </form>
        </SheetContent>
      </Sheet>
      <CustomIconDialog
        open={isCustomIconDialogOpen}
        initialValue={draft.iconCustom}
        onCancel={handleCustomIconCancel}
        onConfirm={handleCustomIconApply}
      />
    </>
  )
}

type CustomIconDialogProps = {
  open: boolean
  initialValue: {
    key: string
    label: string
  } | null
  onCancel: () => void
  onConfirm: (value: { key: string; label: string }) => void
}

function CustomIconDialog({ open, initialValue, onCancel, onConfirm }: CustomIconDialogProps) {
  const [selectedKey, setSelectedKey] = useState<string>(() => initialValue?.key ?? PLANNER_CUSTOM_ICON_COLLECTION[0]?.key ?? '')
  const [label, setLabel] = useState<string>(() => initialValue?.label ?? PLANNER_CUSTOM_ICON_COLLECTION[0]?.label ?? '')
  const [labelDirty, setLabelDirty] = useState(false)
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line no-console
    console.log('customDialog.open', true)
    const fallbackKey = PLANNER_CUSTOM_ICON_COLLECTION[0]?.key ?? ''
    const nextKey = initialValue?.key ?? fallbackKey
    setSelectedKey(nextKey)
    const definition = getPlannerCustomIconDefinition(nextKey)
    const defaultLabel = definition?.label ?? nextKey
    const providedLabel = initialValue?.label ?? ''
    setLabel(providedLabel || defaultLabel)
    setLabelDirty(initialValue ? providedLabel.trim() !== defaultLabel : false)
  }, [initialValue, open])

  const definition = useMemo(() => getPlannerCustomIconDefinition(selectedKey), [selectedKey])
  const IconComponent = definition?.icon ?? null

  const handleSelect = (key: string) => {
    // eslint-disable-next-line no-console
    console.log('customDialog.select', key)
    setSelectedKey(key)
    const nextDefinition = getPlannerCustomIconDefinition(key)
    if (!labelDirty) {
      setLabel(nextDefinition?.label ?? key)
    }
  }

  const handleConfirm = () => {
    if (!selectedKey) {
      onCancel()
      return
    }
    const activeDefinition = getPlannerCustomIconDefinition(selectedKey)
    const trimmed = label.trim() || activeDefinition?.label || selectedKey
    // eslint-disable-next-line no-console
    console.log('customDialog.confirm', { key: selectedKey, label: trimmed })
    onConfirm({ key: selectedKey, label: trimmed })
  }

  if (PLANNER_CUSTOM_ICON_COLLECTION.length === 0) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onCancel() : undefined)}>
      <DialogContent className="max-w-md" aria-describedby={descriptionId} data-testid="custom-icon-dialog">
        <DialogHeader>
          <DialogTitle>Choose an icon</DialogTitle>
          <DialogDescription id={descriptionId}>Select from the collection and give it a display name.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {PLANNER_CUSTOM_ICON_COLLECTION.map((entry) => {
              const Icon = entry.icon
              const isSelected = entry.key === selectedKey
              return (
                <button
                  key={entry.key}
                  type="button"
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-md border p-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-muted bg-background',
                  )}
                  onClick={() => handleSelect(entry.key)}
                  aria-pressed={isSelected}
                  aria-label={entry.label}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span>{entry.label}</span>
                </button>
              )
            })}
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-icon-label">Display name</Label>
            <Input
              id="custom-icon-label"
              value={label}
              onChange={(event) => {
                setLabel(event.target.value)
                setLabelDirty(true)
              }}
              placeholder="Icon name"
            />
          </div>
          {IconComponent && (
            <div className="flex items-center gap-3 rounded-md border bg-muted/40 p-3 text-sm">
              <IconComponent className="h-6 w-6" aria-hidden="true" />
              <span>{label.trim() || definition?.label || selectedKey}</span>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} data-testid="custom-icon-use">
            Use icon
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
