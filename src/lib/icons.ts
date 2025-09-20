import type { ComponentType } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Megaphone,
  MessageSquare,
  PenTool,
  Share2,
  Target,
  Users,
} from 'lucide-react'

export type PlannerIconDefinition = {
  value: string
  label: string
  icon: ComponentType<{ className?: string; size?: number }>
}

export const PLANNER_ICONS: PlannerIconDefinition[] = [
  { value: 'comms', label: 'Communications', icon: Megaphone },
  { value: 'social', label: 'Social Post', icon: Share2 },
  { value: 'strategy', label: 'Strategy', icon: Target },
  { value: 'weekly', label: 'Weekly Catch-up', icon: CalendarClock },
  { value: 'review', label: 'Review', icon: ClipboardList },
  { value: 'copy', label: 'Copywriting', icon: PenTool },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'notes', label: 'Notes', icon: MessageSquare },
  { value: 'approval', label: 'Approval', icon: CheckCircle2 },
]

export function getPlannerIconComponent(value?: string) {
  if (!value) return null
  return PLANNER_ICONS.find((entry) => entry.value === value)?.icon ?? null
}
