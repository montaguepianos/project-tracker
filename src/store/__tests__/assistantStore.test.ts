import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAssistantStore } from '@/store/assistantStore'
import { callPlannerAssistant } from '@/services/assistant'

vi.mock('@/services/assistant', () => ({
  callPlannerAssistant: vi.fn(),
}))

const callPlannerAssistantMock = vi.mocked(callPlannerAssistant)

describe('assistantStore', () => {
  beforeEach(() => {
    useAssistantStore.setState((state) => ({
      ...state,
      open: false,
      status: 'idle',
      error: null,
      messages: state.messages.slice(0, 1),
    }))
    callPlannerAssistantMock.mockReset()
  })

  it('sends a message and stores the assistant reply', async () => {
    callPlannerAssistantMock.mockResolvedValue('There are 3 items due tomorrow.')

    await useAssistantStore.getState().sendMessage('What is due tomorrow?')

    const { messages, status } = useAssistantStore.getState()
    expect(callPlannerAssistantMock).toHaveBeenCalledTimes(1)
    expect(status).toBe('idle')
    expect(messages[messages.length - 1]).toMatchObject({
      role: 'assistant',
      content: 'There are 3 items due tomorrow.',
    })
  })

  it('records an error if the assistant request fails', async () => {
    callPlannerAssistantMock.mockRejectedValue(new Error('network down'))

    await useAssistantStore.getState().sendMessage('Give me a summary')

    const { status, error } = useAssistantStore.getState()
    expect(status).toBe('error')
    expect(error).toContain('network down')
  })

  it('ignores blank messages', async () => {
    await useAssistantStore.getState().sendMessage('   ')

    expect(callPlannerAssistantMock).not.toHaveBeenCalled()
  })
})
