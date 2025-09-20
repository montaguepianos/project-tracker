import { memo } from 'react'

import { ensureReadableText } from '@/lib/colour'
import type { PlannerItem, Project } from '@/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type SquareCardProps = {
  item: PlannerItem
  project: Project | null
  isSelected: boolean
  onOpen: (id: string) => void
}

const SquareCardBase = ({ item, project, isSelected, onOpen }: SquareCardProps) => {
  const background = project?.colour ?? '#888888'
  const textColour = ensureReadableText(background)
  const projectName = project?.name ?? 'Project'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative aspect-square w-full rounded-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            isSelected && 'ring-2 ring-offset-2 ring-primary ring-offset-background',
          )}
          style={{ backgroundColor: background, color: textColour }}
          aria-label={`${projectName}: ${item.title}`}
          onClick={() => onOpen(item.id)}
        >
          <span className="sr-only">{item.title}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="flex flex-col gap-1 text-left">
          <p className="text-sm font-medium">{item.title}</p>
          <p className="text-xs text-muted-foreground">{projectName}</p>
          {item.assignee && <p className="text-xs">Assigned to {item.assignee}</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export const SquareCard = memo(SquareCardBase)
