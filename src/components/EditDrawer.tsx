import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { usePlannerStore } from '@/store/plannerStore'
import { deriveColour, ensureReadableText } from '@/lib/colour'
import { formatISODate, normaliseTitle } from '@/lib/string'

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
}

const EMPTY_DRAFT: Draft = {
  projectId: null,
  title: '',
  notes: '',
  date: formatISODate(new Date()),
  assignee: '',
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
  const [projectError, setProjectError] = useState('')

  useEffect(() => {
    if (currentItem) {
      setDraft({
        projectId: currentItem.projectId,
        title: currentItem.title,
        notes: currentItem.notes ?? '',
        date: currentItem.date,
        assignee: currentItem.assignee ?? '',
      })
      setCreatingProject(false)
      setProjectError('')
    } else if (open) {
      const defaultProject = projects[0]?.id ?? null
      setDraft((prev) => ({
        projectId: defaultProject,
        title: '',
        notes: '',
        date: date ?? prev.date,
        assignee: '',
      }))
      setCreatingProject(false)
      setProjectError('')
    }
  }, [currentItem, date, open, projects])

  useEffect(() => {
    if (!isCreatingProject) return
    if (!newProjectName) {
      setNewProjectColour('#1C7ED6')
      return
    }
    setNewProjectColour(deriveColour(newProjectName))
  }, [isCreatingProject, newProjectName])

  const selectedProject = projects.find((project) => project.id === draft.projectId) ?? null
  const previewColour = selectedProject?.colour ?? '#888888'
  const previewText = ensureReadableText(previewColour)

  const handleSubmit = () => {
    if (!draft.projectId) {
      setProjectError('Choose a project')
      return
    }

    const title = normaliseTitle(draft.title)
    if (!title) {
      window.alert('Title is required.')
      return
    }

    upsertItem({
      id: currentItem?.id,
      projectId: draft.projectId,
      title,
      notes: draft.notes.trim() || undefined,
      date: draft.date,
      assignee: draft.assignee.trim() || undefined,
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

  const handleProjectSelect = (value: string) => {
    if (value === '__create__') {
      setCreatingProject(true)
      setProjectError('')
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
    setCreatingProject(false)
    setNewProjectName('')
    setProjectError('')
  }

  return (
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
                  onChange={(event) => setNewProjectColour(event.target.value)}
                  className="h-9 w-16"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={handleCreateProject}>
                  Save project
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setCreatingProject(false)}>
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
                className="flex h-10 w-full items-center justify-center rounded-md border"
                style={{ backgroundColor: previewColour, color: previewText }}
              >
                {selectedProject ? selectedProject.name : 'Select a project'}
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
  )
}
