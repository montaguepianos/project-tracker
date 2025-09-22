import { beforeEach, describe, expect, test } from 'vitest'

import { resolvePlannerIconMeta } from '@/lib/icons'
import { usePlannerStore } from '@/store/plannerStore'

function resetStore() {
  const initial = usePlannerStore.getState()
  usePlannerStore.setState({
    items: [],
    undo: null,
    projects: initial.projects,
  })
}

describe('custom icon integration', () => {
  beforeEach(() => {
    resetStore()
  })

  test('custom icon survives save and resolves for rendering', () => {
    const store = usePlannerStore.getState()
    const projectId = store.projects[0]?.id ?? ''
    expect(projectId).not.toEqual('')

    const itemId = store.upsertItem({
      projectId,
      title: 'Custom icon item',
      date: '2025-01-01',
      notes: undefined,
      assignee: undefined,
      icon: undefined,
      iconCustom: { key: 'idea', label: 'Bright idea' },
    })

    const saved = usePlannerStore.getState().items.find((entry) => entry.id === itemId)
    expect(saved).toBeDefined()
    expect(saved?.icon).toBeUndefined()
    expect(saved?.iconCustom).toEqual({ key: 'idea', label: 'Bright idea' })

    const resolved = resolvePlannerIconMeta(saved ?? { icon: null, iconCustom: null })
    expect(resolved.source).toBe('custom')
    expect(resolved.label).toBe('Bright idea')
    expect(resolved.component).toBeTruthy()

    usePlannerStore.getState().upsertItem({
      id: itemId,
      projectId,
      title: 'Custom icon item',
      date: '2025-01-01',
      notes: undefined,
      assignee: undefined,
      icon: 'meeting',
    })

    const updated = usePlannerStore.getState().items.find((entry) => entry.id === itemId)
    expect(updated).toBeDefined()
    expect(updated?.icon).toBe('meeting')
    expect(updated?.iconCustom).toBeUndefined()
  })
})
