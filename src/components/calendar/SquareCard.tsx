import { memo } from 'react'

import { ensureReadableText } from '@/lib/colour'
import { resolvePlannerIconMeta } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { PlannerItem, Project } from '@/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type SquareCardProps = {
  item: PlannerItem
  project: Project | null
  isSelected: boolean
  onActivate: (id: string) => void
  size: number
}

const SquareCardBase = ({ item, project, isSelected, onActivate, size }: SquareCardProps) => {
  const background = project?.colour ?? '#888888'
  const textColour = ensureReadableText(background)
  const projectName = project?.name ?? 'Project'
  const { component: Icon, label: iconLabel } = resolvePlannerIconMeta(item)
  const iconSize = Math.max(10, Math.min(22, size * 0.6))
  const accessibleLabel = iconLabel
    ? `${projectName}: ${item.title}, ${iconLabel}`
    : `${projectName}: ${item.title}`

  return (
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
          aria-label={accessibleLabel}
          aria-haspopup="dialog"
          data-prevent-day-open="true"
          onClick={(event) => {
            event.stopPropagation()
            onActivate(item.id)
          }}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <span className="sr-only">{accessibleLabel}</span>
          {Icon && (
            <Icon
              data-testid="square-card-icon"
              className="pointer-events-none"
              size={iconSize}
              {...(iconLabel ? { 'aria-label': iconLabel, role: 'img' } : { 'aria-hidden': true })}
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="flex flex-col gap-1 text-left">
          <p className="text-sm font-medium">{item.title}</p>
          <p className="text-xs text-muted-foreground">{projectName}</p>
          {iconLabel && <p className="text-xs text-muted-foreground">Icon: {iconLabel}</p>}
          {item.assignee && <p className="text-xs">Assigned to {item.assignee}</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export const SquareCard = memo(SquareCardBase)
