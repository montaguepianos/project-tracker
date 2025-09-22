import type { ComponentType } from 'react'
import {
  CalendarClock,
  ClipboardList,
  FlagTriangleRight,
  Lightbulb,
  Megaphone,
  Palette,
  PenTool,
  Rocket,
  Sparkles,
  Target,
  Users,
  Crown,
  Plane,
} from 'lucide-react'

export type PlannerIconDefinition = {
  value: string
  label: string
  icon: ComponentType<{ className?: string; size?: number }>
}

export type PlannerCustomIconDefinition = {
  key: string
  label: string
  icon: ComponentType<{ className?: string; size?: number }>
}

export const PLANNER_ICONS: PlannerIconDefinition[] = [
  { value: 'weekly', label: 'Weekly Catch-up', icon: CalendarClock },
  { value: 'strategy', label: 'Strategy', icon: Target },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'copy', label: 'Copywriting', icon: PenTool },
  { value: 'deadline', label: 'Deadline', icon: FlagTriangleRight },
  { value: 'vip', label: 'VIP Visit', icon: Crown },
  { value: 'travel', label: 'Travel', icon: Plane },
]

export const PLANNER_CUSTOM_ICON_COLLECTION: PlannerCustomIconDefinition[] = [
  { key: 'launch', label: 'Launch', icon: Rocket },
  { key: 'idea', label: 'Idea', icon: Lightbulb },
  { key: 'campaign', label: 'Campaign', icon: Megaphone },
  { key: 'creative', label: 'Creative', icon: Palette },
  { key: 'report', label: 'Report', icon: ClipboardList },
  { key: 'spark', label: 'Spark', icon: Sparkles },
  { key: 'travel', label: 'Travel', icon: Plane },
]

const BUILTIN_ICON_MAP = new Map(PLANNER_ICONS.map((entry) => [entry.value, entry]))
const CUSTOM_ICON_MAP = new Map(PLANNER_CUSTOM_ICON_COLLECTION.map((entry) => [entry.key, entry]))

export function getPlannerIconDefinition(value?: string) {
  if (!value) return null
  return BUILTIN_ICON_MAP.get(value) ?? null
}

export function getPlannerIconComponent(value?: string) {
  if (!value) return null
  return BUILTIN_ICON_MAP.get(value)?.icon ?? null
}

export function getPlannerCustomIconDefinition(key?: string) {
  if (!key) return null
  return CUSTOM_ICON_MAP.get(key) ?? null
}

export function getPlannerCustomIconComponent(key?: string) {
  if (!key) return null
  return CUSTOM_ICON_MAP.get(key)?.icon ?? null
}

export type ResolvedPlannerIcon = {
  component: ComponentType<{ className?: string; size?: number }> | null
  label: string | null
  source: 'builtin' | 'custom' | null
}

type IconLike = {
  icon?: string | null
  iconCustom?: {
    key: string
    label: string
  } | null
}

export function resolvePlannerIconMeta(item: IconLike): ResolvedPlannerIcon {
  if (item.iconCustom?.key) {
    const definition = getPlannerCustomIconDefinition(item.iconCustom.key)
    const label = item.iconCustom.label?.trim()
    return {
      component: definition?.icon ?? null,
      label: label || definition?.label || null,
      source: definition ? 'custom' : null,
    }
  }

  if (item.icon) {
    const definition = getPlannerIconDefinition(item.icon)
    return {
      component: definition?.icon ?? null,
      label: definition?.label ?? item.icon,
      source: definition ? 'builtin' : null,
    }
  }

  return { component: null, label: null, source: null }
}
