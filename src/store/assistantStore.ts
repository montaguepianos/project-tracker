import { create } from 'zustand'
import { nanoid } from 'nanoid'

import type { AssistantMessage } from '@/types'
import { callPlannerAssistant } from '@/services/assistant'

export type AssistantStatus = 'idle' | 'sending' | 'error'

type AssistantStore = {
  open: boolean
  status: AssistantStatus
  error: string | null
  messages: AssistantMessage[]
  toggle: (next?: boolean) => void
  openPanel: () => void
  closePanel: () => void
  reset: () => void
  sendMessage: (content: string) => Promise<void>
}

const INITIAL_ASSISTANT_MESSAGE: AssistantMessage = {
  id: nanoid(),
  role: 'assistant',
  content: 'Hi! I’m your AI assistant here to help you with this planner. How can I assist you today?',
  createdAt: new Date().toISOString(),
}

export const useAssistantStore = create<AssistantStore>((set, get) => ({
  open: false,
  status: 'idle',
  error: null,
  messages: [INITIAL_ASSISTANT_MESSAGE],
  toggle: (next) => {
    set((state) => {
      const open = typeof next === 'boolean' ? next : !state.open
      return { ...state, open }
    })
  },
  openPanel: () => {
    set((state) => (state.open ? state : { ...state, open: true }))
  },
  closePanel: () => {
    set((state) => (state.open ? { ...state, open: false } : state))
  },
  reset: () => {
    set({
      messages: [
        { ...INITIAL_ASSISTANT_MESSAGE, id: nanoid(), createdAt: new Date().toISOString() },
      ],
      status: 'idle',
      error: null,
    })
  },
  sendMessage: async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return

    const userMessage: AssistantMessage = {
      id: nanoid(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    }

    const conversation = [...get().messages, userMessage]

    set({
      messages: conversation,
      status: 'sending',
      error: null,
    })

    try {
      const reply = await callPlannerAssistant({ conversation })

      if (!reply) {
        throw new Error('The assistant returned an empty response.')
      }

      const assistantMessage: AssistantMessage = {
        id: nanoid(),
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
      }

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        status: 'idle',
      }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Something went wrong while contacting the assistant.'
      set({
        status: 'error',
        error: message,
      })
    }
  },
}))
