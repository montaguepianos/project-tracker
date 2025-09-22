import { useCallback, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NotesContent } from '@/components/NotesContent'
import { ensureReadableText } from '@/lib/colour'
import { formatDate } from '@/lib/date'
import { resolvePlannerIconMeta } from '@/lib/icons'
import type { PlannerItem, Project } from '@/types'

export type ItemDetailsModalProps = {
  open: boolean
  item: PlannerItem | null
  project: Project | null
  onClose: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function ItemDetailsModal({ open, item, project, onClose, onEdit, onDelete }: ItemDetailsModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')

  const resolvedIcon = useMemo(
    () => (item ? resolvePlannerIconMeta(item) : { component: null, label: null, source: null }),
    [item],
  )
  const Icon = resolvedIcon.component
  const projectInitial = project?.name?.charAt(0) ?? '?'
  const swatchText = ensureReadableText(project?.colour ?? '#888888')

  const handleCopy = useCallback(async () => {
    if (!item) return
    const clipboard = navigator?.clipboard
    if (!clipboard) {
      setCopyState('error')
      setTimeout(() => setCopyState('idle'), 2000)
      return
    }

    const summary = buildCopySummary(item, project)
    try {
      await clipboard.writeText(summary)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch (error) {
      console.error('Failed to copy item details', error)
      setCopyState('error')
      setTimeout(() => setCopyState('idle'), 2000)
    }
  }, [item, project])

  const handleEdit = useCallback(() => {
    if (!item) return
    onEdit(item.id)
  }, [item, onEdit])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!item) return
      if (event.key.toLowerCase() === 'e' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        onEdit(item.id)
      }
    },
    [item, onEdit],
  )

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent onKeyDown={handleKeyDown} className="max-w-xl space-y-6" aria-describedby={item ? `item-${item.id}-description` : undefined}>
        {item && (
          <div className="space-y-6">
            <DialogHeader className="space-y-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold"
                  style={{ backgroundColor: project?.colour ?? '#888888', color: swatchText }}
                >
                  {projectInitial}
                </span>
                <div className="flex flex-col text-left">
                  <DialogTitle>{item.title}</DialogTitle>
                  <DialogDescription id={`item-${item.id}-description`}>
                    {project?.name ?? 'Untitled project'} • {formatDate(item.date, 'EEE d MMM yyyy')}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                {item.assignee && <span>Assigned to {item.assignee}</span>}
                {Icon && (
                  <span className="inline-flex items-center gap-1 text-foreground">
                    <Icon
                      className="h-4 w-4"
                      {...(resolvedIcon.label ? { 'aria-label': resolvedIcon.label, role: 'img' } : { 'aria-hidden': true })}
                    />
                    <span className="text-sm font-medium">{resolvedIcon.label ?? 'Icon'}</span>
                  </span>
                )}
              </div>
            </DialogHeader>

            {item.notes && (
              <section aria-label="Notes" className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Notes</h3>
                <NotesContent value={item.notes} />
              </section>
            )}
          </div>
        )}

        <DialogFooter className="flex w-full flex-col gap-2 sm:flex-row sm:justify-between sm:space-x-0">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {copyState === 'copied' && <span className="text-foreground">Copied!</span>}
            {copyState === 'error' && <span className="text-destructive">Copy failed</span>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button type="button" variant="outline" onClick={handleCopy} disabled={!item}>
              Copy details
            </Button>
            <Button type="button" onClick={handleEdit} disabled={!item}>
              Edit
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => item && onDelete(item.id)}
              disabled={!item}
            >
              Delete
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function buildCopySummary(item: PlannerItem, project: Project | null) {
  const parts: string[] = []
  parts.push(`Title: ${item.title}`)
  parts.push(`Project: ${project?.name ?? 'Untitled project'}`)
  parts.push(`Date: ${formatDate(item.date, 'EEE d MMM yyyy')}`)
  const iconMeta = resolvePlannerIconMeta(item)
  if (iconMeta.label) {
    parts.push(`Icon: ${iconMeta.label}`)
  }
  if (item.assignee) {
    parts.push(`Assignee: ${item.assignee}`)
  }
  if (item.notes) {
    parts.push('\nNotes:\n' + item.notes.trim())
  }
  return parts.join('\n')
}
