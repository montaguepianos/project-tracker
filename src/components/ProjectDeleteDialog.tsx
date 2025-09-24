import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Project } from '@/types'
import { SYS } from '@/services/systemProjects'

export type ProjectDeleteDialogProps = {
  open: boolean
  project: Project | null
  projects: Project[]
  itemCount: number
  onCancel: () => void
  onConfirm: () => void
}

export function ProjectDeleteDialog({
  open,
  project,
  projects,
  itemCount,
  onCancel,
  onConfirm,
}: ProjectDeleteDialogProps) {
  const archivedProject = useMemo(() => projects.find((candidate) => candidate.id === SYS.archivedId), [projects])

  const isArchivedTarget = project?.id === SYS.archivedId

  const disableDelete =
    project == null ||
    isArchivedTarget ||
    !archivedProject

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onCancel()
    }
  }

  const handleConfirm = () => {
    if (!project || disableDelete) return
    onConfirm()
  }

  const descriptionId = project ? `delete-project-${project.id}-description` : undefined

  const description = (() => {
    if (!project) return ''
    if (isArchivedTarget) {
      return 'The Archived project keeps a record of old work and cannot be removed.'
    }
    if (!archivedProject) {
      return 'Add an Archived project before deleting so existing items have somewhere to move.'
    }
    if (itemCount === 0) {
      return 'This will move the project to Archived. This action cannot be undone.'
    }
    if (itemCount === 1) {
      return 'This project contains 1 item. It will be moved to “Archived” when you delete the project.'
    }
    return `This project contains ${itemCount} items. They will be moved to “Archived” when you delete the project.`
  })()

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby={descriptionId} className="max-w-md space-y-4">
        <DialogHeader>
          <DialogTitle>Delete project "{project?.name ?? ''}"?</DialogTitle>
          {project && (
            <DialogDescription id={descriptionId}>{description}</DialogDescription>
          )}
        </DialogHeader>

        {itemCount > 0 && project && !isArchivedTarget && archivedProject && archivedProject.id !== project.id && (
          <div className="rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
            All {itemCount} item{itemCount === 1 ? '' : 's'} will be moved to "{archivedProject.name}".
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} autoFocus>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={disableDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
