import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { BotMessageSquare, LoaderCircle, Send, X } from 'lucide-react'

import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useAssistantStore } from '@/store/assistantStore'
import { formatDate } from '@/lib/date'
import { cn } from '@/lib/utils'

export function PlannerAssistant() {
  const open = useAssistantStore((state) => state.open)
  const toggle = useAssistantStore((state) => state.toggle)
  const status = useAssistantStore((state) => state.status)
  const error = useAssistantStore((state) => state.error)
  const messages = useAssistantStore((state) => state.messages)
  const sendMessage = useAssistantStore((state) => state.sendMessage)

  const [draft, setDraft] = useState('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status, open])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    void sendMessage(draft)
    setDraft('')
  }

  return (
    <Sheet open={open} onOpenChange={toggle}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 border-l bg-background p-0 sm:max-w-md">
        <SheetHeader className="flex flex-row items-center justify-between border-b px-6 py-4 text-left">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <BotMessageSquare className="h-5 w-5 text-primary" aria-hidden="true" />
            </span>
            <div>
              <SheetTitle className="text-base">AI Planner Assistant</SheetTitle>
              <p className="text-xs text-muted-foreground">Ask about projects or draft new task details.</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => toggle(false)} aria-label="Close assistant">
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>
        <div className="flex flex-1 flex-col overflow-hidden">
          <ScrollArea className="flex-1 px-6 py-4">
            <div className="flex flex-col gap-4">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    'flex flex-col gap-1 rounded-lg border p-3 text-sm shadow-sm',
                    message.role === 'user' ? 'ml-auto max-w-[85%] bg-accent/40' : 'mr-auto max-w-[90%] bg-background',
                  )}
                >
                  <header className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{message.role === 'user' ? 'You' : 'Assistant'}</span>
                    <time dateTime={message.createdAt}>{formatDate(message.createdAt, 'd MMM HH:mm')}</time>
                  </header>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                </article>
              ))}
              {status === 'sending' && (
                <div className="mr-auto flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Thinking…
                </div>
              )}
              {error && (
                <div className="mr-auto flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <Badge variant="secondary" className="bg-destructive text-destructive-foreground">
                    Error
                  </Badge>
                  <p className="leading-snug">{error}</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          <SheetFooter className="border-t px-6 py-4">
            <form onSubmit={handleSubmit} className="w-full space-y-3" aria-label="Send a message to the planner assistant">
              <label className="sr-only" htmlFor="assistant-message">
                Message
              </label>
              <Textarea
                id="assistant-message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type a question or request a draft…"
                rows={3}
                className="resize-none"
                data-testid="assistant-input"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  The assistant uses current planner data and the OpenAI API.
                </p>
                <Button type="submit" disabled={status === 'sending'} aria-label="Send message">
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </Button>
              </div>
            </form>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  )
}
