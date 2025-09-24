import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/firebase', () => ({
  auth: { currentUser: null },
  firebaseEnabled: false,
}))

import { callPlannerAssistant } from '@/services/assistant'
import { usePlannerStore } from '@/store/plannerStore'
import { SYS } from '@/services/systemProjects'

const originalFetch = global.fetch

describe('callPlannerAssistant snapshot', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key')
    vi.stubEnv('VITE_OPENAI_MODEL', 'test-model')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const nowIso = new Date().toISOString()

    usePlannerStore.setState((state) => ({
      ...state,
      projects: [
        {
          id: 'proj-active',
          name: 'Active Work',
          colour: '#1C7ED6',
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        {
          id: SYS.archivedId,
          name: 'Archived',
          colour: '#6B7280',
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
      items: [
        {
          id: 'item-1',
          projectId: 'proj-active',
          title: 'VIP Brief',
          notes: 'Prep for upcoming visit',
          date: '2099-01-05',
          assignee: 'Leila',
          icon: 'vip',
          iconCustom: undefined,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        {
          id: 'item-2',
          projectId: SYS.archivedId,
          title: 'VIP Retrospective',
          notes: 'Review last season',
          date: '2001-06-15',
          assignee: 'Sam',
          icon: 'vip',
          iconCustom: undefined,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ],
      filters: {
        projectFilterMode: 'include',
        projectIds: ['proj-active'],
        search: '',
        range: {
          start: '2024-01-01',
          end: '2100-12-31',
          preset: 'custom',
        },
      },
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    if (originalFetch) {
      global.fetch = originalFetch
    } else {
      delete (global as { fetch?: typeof fetch }).fetch
    }
  })

  it('filters snapshot by selected projects and includes icon metadata', async () => {
    const conversation = [
      {
        id: 'm-1',
        role: 'user' as const,
        content: 'Any VIP work coming up?',
        createdAt: new Date().toISOString(),
      },
    ]

    await callPlannerAssistant({ conversation })

    const fetchMock = vi.mocked(global.fetch)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const firstCall = fetchMock.mock.calls[0]
    const body = JSON.parse(firstCall[1]?.body as string)
    const systemPrompt: string = body.messages[0].content
    const snapshotJson = systemPrompt.split('Planner snapshot (ISO dates): ')[1]
    expect(snapshotJson).toBeDefined()
    const snapshot = JSON.parse(snapshotJson)

    expect(snapshot.totals.items).toBe(1)
    expect(snapshot.projects).toHaveLength(1)
    expect(snapshot.upcoming[0]).toMatchObject({
      iconKey: 'vip',
      iconLabel: 'VIP Visit',
    })
    expect(snapshot.icons[0]).toMatchObject({
      key: 'vip',
      totalItems: 1,
      projectIds: ['proj-active'],
    })

    usePlannerStore.setState((state) => ({
      filters: {
        ...state.filters,
        projectFilterMode: 'include',
        projectIds: ['proj-active', SYS.archivedId],
      },
    }))

    fetchMock.mockClear()

    await callPlannerAssistant({
      conversation: [
        {
          id: 'm-2',
          role: 'user' as const,
          content: 'Show all VIP tasks',
          createdAt: new Date().toISOString(),
        },
      ],
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const secondBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    const secondPrompt: string = secondBody.messages[0].content
    const secondSnapshot = JSON.parse(secondPrompt.split('Planner snapshot (ISO dates): ')[1])

    expect(secondSnapshot.totals.items).toBe(2)
    const vipIcon = secondSnapshot.icons.find((icon: { key: string }) => icon.key === 'vip')
    expect(vipIcon).toBeDefined()
    expect(vipIcon.projectIds).toContain(SYS.archivedId)
  })
})
