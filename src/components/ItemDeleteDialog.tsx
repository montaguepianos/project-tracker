import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { PlannerItem, Project } from '@/types'

export type ItemDeleteDialogProps = {
  open: boolean
  item: PlannerItem | null
  project: Project | null
  onCancel: () => void
  onConfirm: () => void
}

export function ItemDeleteDialog({ open, item, project, onCancel, onConfirm }: ItemDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onCancel() : undefined)}>
      <DialogContent aria-describedby={item ? `delete-item-${item.id}-description` : undefined} className="max-w-sm space-y-4">
        <DialogHeader>
          <DialogTitle>Delete this item?</DialogTitle>
          {item && (
            <DialogDescription id={`delete-item-${item.id}-description`}>
              "{item.title}" ({project?.name ?? 'Untitled project'}) will be deleted. You can undo this action from the banner.
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} autoFocus>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={!item}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
