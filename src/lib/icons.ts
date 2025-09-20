import type { ComponentType } from 'react'
import { CalendarClock, FlagTriangleRight, PenTool, Target, Users } from 'lucide-react'

export type PlannerIconDefinition = {
  value: string
  label: string
  icon: ComponentType<{ className?: string; size?: number }>
}

export const PLANNER_ICONS: PlannerIconDefinition[] = [
  { value: 'weekly', label: 'Weekly Catch-up', icon: CalendarClock },
  { value: 'strategy', label: 'Strategy', icon: Target },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'copy', label: 'Copywriting', icon: PenTool },
  { value: 'deadline', label: 'Deadline', icon: FlagTriangleRight },
]

export function getPlannerIconComponent(value?: string) {
  if (!value) return null
  return PLANNER_ICONS.find((entry) => entry.value === value)?.icon ?? null
}
