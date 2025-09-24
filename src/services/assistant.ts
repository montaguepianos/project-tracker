import { collection, doc, getDocs, Timestamp, getFirestore } from 'firebase/firestore'

import { auth, firebaseEnabled } from '@/services/firebase'
import { usePlannerStore } from '@/store/plannerStore'
import type { AssistantMessage, PlannerItem, Project } from '@/types'
import { formatDate } from '@/lib/date'

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_MODEL = 'gpt-5-mini'

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
  }>
  upcoming: Array<{
    id: string
    date: string
    project: string
    title: string
    notes?: string
    assignee?: string
  }>
  recent: Array<{
    id: string
    date: string
    project: string
    title: string
    notes?: string
    assignee?: string
  }>
}

type CallPlannerAssistantArgs = {
  conversation: AssistantMessage[]
}

type RemoteSnapshot = {
  items: PlannerItem[]
  projects: Project[]
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

  const remote = await maybeFetchRemoteSnapshot()
  const items = remote?.items?.length ? remote.items : localItems
  const projects = remote?.projects?.length ? remote.projects : localProjects

  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  const sortedItems = [...items].sort((a, b) => a.date.localeCompare(b.date))

  const upcoming = sortedItems
    .filter((item) => item.date >= today)
    .slice(0, 30)
    .map((item) => toSnapshotEntry(item, projects))

  const recent = [...sortedItems]
    .filter((item) => item.date < today)
    .slice(-20)
    .reverse()
    .map((item) => toSnapshotEntry(item, projects))

  const totalsByProject = projects.map((project) => {
    const projectItems = items.filter((item) => item.projectId === project.id)
    return {
      id: project.id,
      name: project.name,
      colour: project.colour,
      totalItems: projectItems.length,
      upcomingItems: projectItems.filter((item) => item.date >= today).length,
    }
  })

  return {
    generatedAt: now.toISOString(),
    totals: {
      items: items.length,
      projects: projects.length,
    },
    projects: totalsByProject,
    upcoming,
    recent,
  }
}

function toSnapshotEntry(item: PlannerItem, projects: Project[]) {
  const project = projects.find((candidate) => candidate.id === item.projectId)
  return {
    id: item.id,
    date: item.date,
    project: project?.name ?? item.projectId,
    title: item.title,
    notes: item.notes,
    assignee: item.assignee,
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
    'When drafting or editing descriptions, keep them action-oriented and under 80 words unless explicitly asked otherwise.',
    `Planner snapshot (ISO dates): ${context}`,
  ].join('\n\n')
}
