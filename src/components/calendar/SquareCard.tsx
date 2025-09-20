import { memo } from 'react'

import { ensureReadableText } from '@/lib/colour'
import { getPlannerIconComponent } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { PlannerItem, Project } from '@/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const LABEL_THRESHOLD = 32

type SquareCardProps = {
  item: PlannerItem
  project: Project | null
  isSelected: boolean
  onOpen: (id: string) => void
  size: number
  showLabel?: boolean
  label?: string
}

const SquareCardBase = ({ item, project, isSelected, onOpen, size, showLabel = false, label }: SquareCardProps) => {
  const background = project?.colour ?? '#888888'
  const textColour = ensureReadableText(background)
  const projectName = project?.name ?? 'Project'
  const Icon = getPlannerIconComponent(item.icon)
  const iconSize = Math.max(10, Math.min(22, size * 0.6))

  const wrapperStyle = size > 0 ? { width: `${size}px` } : undefined
  const shouldShowLabel = showLabel && label && size >= LABEL_THRESHOLD

  return (
    <div className="flex flex-col items-center gap-1" style={wrapperStyle}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'relative flex items-center justify-center rounded-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isSelected && 'ring-2 ring-offset-2 ring-primary ring-offset-background',
            )}
            style={{
              backgroundColor: background,
              color: textColour,
              width: `${size}px`,
              height: `${size}px`,
            }}
            aria-label={`${projectName}: ${item.title}`}
            onClick={() => onOpen(item.id)}
          >
            <span className="sr-only">{item.title}</span>
            {Icon && <Icon className="pointer-events-none" size={iconSize} />}
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
      {shouldShowLabel && (
        <span className="w-full truncate text-[10px] leading-3 text-muted-foreground">{label}</span>
      )}
    </div>
  )
}

export const SquareCard = memo(SquareCardBase)
