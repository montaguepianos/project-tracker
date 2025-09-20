import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { PlannerItem, Project } from '@/types'

export type OverflowBadgeProps = {
  items: PlannerItem[]
  selectedItemId: string | null
  onActivate: (id: string) => void
  projectMap: Map<string, Project>
  size: number
}

export function OverflowBadge({ items, selectedItemId, onActivate, projectMap, size }: OverflowBadgeProps) {
  const style = size > 0 ? { width: `${size}px`, height: `${size}px` } : undefined

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex flex-col items-center justify-center rounded-sm border border-dashed text-xs text-muted-foreground"
          style={style}
          aria-label={`View ${items.length} more item(s)`}
          data-prevent-day-open="true"
        >
          <Badge variant="secondary">+{items.length}</Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <ScrollArea className="max-h-64">
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 p-3 text-left text-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onActivate(item.id)}
                  data-prevent-day-open="true"
                >
                  <span className="font-medium">{item.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {projectMap.get(item.projectId)?.name ?? 'Project'}
                  </span>
                  {selectedItemId === item.id && <span className="text-[10px] uppercase tracking-wide text-primary">Selected</span>}
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
