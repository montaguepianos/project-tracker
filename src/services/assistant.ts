import { collection, doc, getDocs, Timestamp, getFirestore } from 'firebase/firestore'

import { auth, firebaseEnabled } from '@/services/firebase'
import { usePlannerStore, getVisibleProjectIds } from '@/store/plannerStore'
import type { AssistantMessage, PlannerItem, Project } from '@/types'
import { formatDate } from '@/lib/date'
import { resolvePlannerIconMeta } from '@/lib/icons'

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_MODEL = 'gpt-4o-mini'

export type PlannerSnapshot = {
  generatedAt: string
  totals: {
    items: number
    projects: number
  }
  projects: Array<{
    id: string
    name: string
    colour: string
    totalItems: number
    upcomingItems: number
    iconCounts: Array<{
      key: string
      label: string
      source: 'builtin' | 'custom' | 'unknown'
      count: number
    }>
  }>
  icons: Array<{
    key: string
    label: string
    source: 'builtin' | 'custom' | 'unknown'
    totalItems: number
    projectIds: string[]
    projectNames: string[]
  }>
  upcoming: Array<{
    id: string
    projectId: string
    date: string
    project: string
    title: string
    notes?: string
    assignee?: string
    iconKey?: string | null
    iconLabel?: string | null
    iconSource?: 'builtin' | 'custom' | null
  }>
  recent: Array<{
    id: string
    projectId: string
    date: string
    project: string
    title: string
    notes?: string
    assignee?: string
    iconKey?: string | null
    iconLabel?: string | null
    iconSource?: 'builtin' | 'custom' | null
  }>
}

type CallPlannerAssistantArgs = {
  conversation: AssistantMessage[]
}

type RemoteSnapshot = {
  items: PlannerItem[]
  projects: Project[]
}

type IconDescriptor = {
  key: string | null
  label: string | null
  source: 'builtin' | 'custom' | null
}

type IconAggregate = {
  key: string
  label: string
  source: 'builtin' | 'custom' | 'unknown'
  totalItems: number
  projectIds: Set<string>
}

type ProjectIconAggregate = {
  key: string
  label: string
  source: 'builtin' | 'custom' | 'unknown'
  count: number
}

export async function callPlannerAssistant({ conversation }: CallPlannerAssistantArgs) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API key missing. Set VITE_OPENAI_API_KEY to enable the assistant.')
  }

  const snapshot = await buildPlannerSnapshot()
  const model = import.meta.env.VITE_OPENAI_MODEL || DEFAULT_MODEL

  const systemPrompt = buildSystemPrompt(snapshot)

  const body = {
    model,
    temperature: 1,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...conversation.map((message) => ({
        role: message.role,
        content: enrichMessageContent(message),
      })),
    ],
  }

  const response = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const failure = await response.json()
      if (failure?.error?.message) {
        detail = failure.error.message
      }
    } catch (error) {
      // ignore JSON parse errors
    }
    throw new Error(`Assistant request failed: ${detail}`)
  }

  const payload = await response.json()
  const content: string | undefined = payload?.choices?.[0]?.message?.content
  return typeof content === 'string' ? content.trim() : ''
}

function enrichMessageContent(message: AssistantMessage) {
  const timestamp = formatDate(message.createdAt, 'd MMM yyyy HH:mm')
  return `${message.content}\n(Sent by ${message.role === 'user' ? 'planner owner' : 'assistant'} at ${timestamp})`
}

async function buildPlannerSnapshot(): Promise<PlannerSnapshot> {
  const localState = usePlannerStore.getState()
  const localItems = localState.items
  const localProjects = localState.projects
  const filters = localState.filters

  const remote = await maybeFetchRemoteSnapshot()
  const items = remote?.items?.length ? remote.items : localItems
  const projects = remote?.projects?.length ? remote.projects : localProjects

  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  const visibleProjectIds = new Set(getVisibleProjectIds(filters, projects))
  const visibleProjects = projects.filter((project) => visibleProjectIds.has(project.id))
  const projectLookup = new Map(visibleProjects.map((project) => [project.id, project]))

  const sortedItems = [...items].sort((a, b) => a.date.localeCompare(b.date))
  const filteredItems = sortedItems.filter((item) => visibleProjectIds.has(item.projectId))

  const iconTotals = new Map<string, IconAggregate>()
  const iconsByProject = new Map<string, Map<string, ProjectIconAggregate>>()

  for (const item of filteredItems) {
    const descriptor = describeIcon(item)
    if (!descriptor.key) continue
    const projectId = item.projectId

    const projectEntryMap = iconsByProject.get(projectId) ?? new Map<string, ProjectIconAggregate>()
    const existingProjectEntry = projectEntryMap.get(descriptor.key) ?? {
      key: descriptor.key,
      label: normaliseIconLabel(descriptor),
      source: toSnapshotIconSource(descriptor.source),
      count: 0,
    }
    existingProjectEntry.count += 1
    // always prefer the most up-to-date label/source if present
    if (descriptor.label) existingProjectEntry.label = descriptor.label
    if (descriptor.source) existingProjectEntry.source = toSnapshotIconSource(descriptor.source)
    projectEntryMap.set(descriptor.key, existingProjectEntry)
    iconsByProject.set(projectId, projectEntryMap)

    const totalEntry = iconTotals.get(descriptor.key) ?? {
      key: descriptor.key,
      label: normaliseIconLabel(descriptor),
      source: toSnapshotIconSource(descriptor.source),
      totalItems: 0,
      projectIds: new Set<string>(),
    }
    totalEntry.totalItems += 1
    if (descriptor.label) totalEntry.label = descriptor.label
    if (descriptor.source) totalEntry.source = toSnapshotIconSource(descriptor.source)
    totalEntry.projectIds.add(projectId)
    iconTotals.set(descriptor.key, totalEntry)
  }

  const upcoming = filteredItems
    .filter((item) => item.date >= today)
    .slice(0, 30)
    .map((item) => toSnapshotEntry(item, projectLookup))

  const recent = filteredItems
    .filter((item) => item.date < today)
    .slice(-20)
    .reverse()
    .map((item) => toSnapshotEntry(item, projectLookup))

  const totalsByProject = visibleProjects.map((project) => {
    const projectItems = filteredItems.filter((item) => item.projectId === project.id)
    const iconCounts = Array.from(iconsByProject.get(project.id)?.values() ?? [])
      .map((entry) => ({
        key: entry.key,
        label: entry.label,
        source: entry.source,
        count: entry.count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return {
      id: project.id,
      name: project.name,
      colour: project.colour,
      totalItems: projectItems.length,
      upcomingItems: projectItems.filter((item) => item.date >= today).length,
      iconCounts,
    }
  })

  const iconSummary = Array.from(iconTotals.values())
    .map((entry) => {
      const projectIds = Array.from(entry.projectIds)
      const projectNames = projectIds
        .map((projectId) => projectLookup.get(projectId)?.name ?? projectId)
        .sort((a, b) => a.localeCompare(b))

      return {
        key: entry.key,
        label: entry.label,
        source: entry.source,
        totalItems: entry.totalItems,
        projectIds,
        projectNames,
      }
    })
    .sort((a, b) => b.totalItems - a.totalItems || a.label.localeCompare(b.label))

  return {
    generatedAt: now.toISOString(),
    totals: {
      items: filteredItems.length,
      projects: visibleProjects.length,
    },
    projects: totalsByProject,
    icons: iconSummary,
    upcoming,
    recent,
  }
}

function toSnapshotEntry(item: PlannerItem, projects: Map<string, Project>) {
  const project = projects.get(item.projectId)
  const iconDescriptor = describeIcon(item)
  return {
    id: item.id,
    projectId: item.projectId,
    date: item.date,
    project: project?.name ?? item.projectId,
    title: item.title,
    notes: item.notes,
    assignee: item.assignee,
    iconKey: iconDescriptor.key,
    iconLabel: iconDescriptor.label,
    iconSource: iconDescriptor.source,
  }
}

async function maybeFetchRemoteSnapshot(): Promise<RemoteSnapshot | null> {
  if (!firebaseEnabled) return null
  const currentUser = auth.currentUser
  if (!currentUser) return null

  try {
    const db = getFirestore()
    const userDoc = doc(collection(db, 'users'), currentUser.uid)
    const projectsSnap = await getDocs(collection(userDoc, 'projects'))
    const itemsSnap = await getDocs(collection(userDoc, 'items'))

    const projects: Project[] = projectsSnap.docs.map((docSnap) => {
      const data = docSnap.data() as any
      const createdAt = normaliseTimestamp(data.createdAt)
      const updatedAt = normaliseTimestamp(data.updatedAt ?? data.createdAt)
      return {
        id: data.id ?? docSnap.id,
        name: data.name ?? '',
        colour: data.colour ?? data.color ?? '#1C7ED6',
        createdAt,
        updatedAt,
      }
    })

    const items: PlannerItem[] = itemsSnap.docs.map((docSnap) => {
      const data = docSnap.data() as any
      const createdAt = normaliseTimestamp(data.createdAt)
      const updatedAt = normaliseTimestamp(data.updatedAt ?? data.createdAt)
      const iconCustom = data.iconCustom && typeof data.iconCustom === 'object' && data.iconCustom.key
        ? { key: String(data.iconCustom.key), label: String(data.iconCustom.label ?? data.iconCustom.key) }
        : undefined
      return {
        id: data.id ?? docSnap.id,
        projectId: data.projectId ?? '',
        title: data.title ?? '',
        notes: data.notes ?? undefined,
        date: data.date ?? '',
        assignee: data.assignee ?? undefined,
        icon: typeof data.icon === 'string' ? data.icon : undefined,
        iconCustom,
        createdAt,
        updatedAt,
      }
    })

    return { items, projects }
  } catch (error) {
    console.warn('[assistant] Failed to refresh from Firestore; using local snapshot.', error)
    return null
  }
}

function normaliseTimestamp(value: unknown) {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString()
  }
  if (typeof value === 'string') {
    return value
  }
  if (value && typeof value === 'object' && 'seconds' in (value as Record<string, unknown>)) {
    try {
      const seconds = Number((value as any).seconds)
      if (!Number.isNaN(seconds)) {
        return new Date(seconds * 1000).toISOString()
      }
    } catch (error) {
      // ignore
    }
  }
  return new Date().toISOString()
}

function buildSystemPrompt(snapshot: PlannerSnapshot) {
  const context = JSON.stringify(snapshot)
  return [
    'You are Leila’s AI planner assistant. Help summarise projects, surface upcoming or past work, and draft concise descriptions in UK English.',
    'You can rely on the planner snapshot provided below. If the user asks for actions outside the data, explain the limitation politely.',
    'Only the projects currently visible in the planner filters are included. If a request might rely on hidden projects, remind the user to adjust filters.',
    'Each item includes icon metadata (iconKey/iconLabel) and there is an icon summary listing counts by icon type. Use that when searching by icon.',
    'When drafting or editing descriptions, keep them action-oriented and under 80 words unless explicitly asked otherwise.',
    `Planner snapshot (ISO dates): ${context}`,
  ].join('\n\n')
}

function describeIcon(item: PlannerItem): IconDescriptor {
  const meta = resolvePlannerIconMeta(item)

  if (item.iconCustom?.key) {
    const label = item.iconCustom.label?.trim() || meta.label || item.iconCustom.key
    return {
      key: item.iconCustom.key,
      label,
      source: meta.source ?? 'custom',
    }
  }

  if (item.icon) {
    const label = meta.label || item.icon
    return {
      key: item.icon,
      label,
      source: meta.source ?? 'builtin',
    }
  }

  return { key: null, label: null, source: null }
}

function normaliseIconLabel(descriptor: IconDescriptor) {
  return descriptor.label?.trim() || descriptor.key || 'Unknown icon'
}

function toSnapshotIconSource(source: 'builtin' | 'custom' | null): 'builtin' | 'custom' | 'unknown' {
  if (source === 'builtin' || source === 'custom') return source
  return 'unknown'
}
