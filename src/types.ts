export type Project = {
  id: string
  name: string
  colour: string
  createdAt: string
  updatedAt: string
}

export type PlannerItem = {
  id: string
  projectId: string
  title: string
  notes?: string
  date: string
  assignee?: string
  icon?: string
  iconCustom?: {
    key: string
    label: string
  }
  createdAt: string
  updatedAt: string
}

export type PlannerView = 'year' | 'month' | 'week' | 'day'

export type DateRangePreset =
  | 'this-week'
  | 'next-two-weeks'
  | 'this-month'
  | 'next-month'
  | 'custom'

export type AssistantRole = 'user' | 'assistant'

export type AssistantMessage = {
  id: string
  role: AssistantRole
  content: string
  createdAt: string
}
