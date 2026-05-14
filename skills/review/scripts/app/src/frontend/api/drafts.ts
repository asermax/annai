import type { Draft, DraftInput, DraftPatch } from '../../shared/drafts.ts'
import type { ReviewDecision } from '../../shared/result.ts'
import type { SessionStateSnapshot } from '../../shared/session-state.ts'

const handle = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`annai api: ${res.status} ${text || res.statusText}`)
  }

  return res.json() as Promise<T>
}

export const fetchState = (): Promise<SessionStateSnapshot> =>
  fetch('/api/state').then(handle<SessionStateSnapshot>)

export const createDraft = (input: DraftInput): Promise<Draft> =>
  fetch('/api/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then(handle<Draft>)

export const updateDraft = (id: string, patch: DraftPatch): Promise<Draft> =>
  fetch(`/api/drafts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then(handle<Draft>)

export const deleteDraft = async (id: string): Promise<void> => {
  await fetch(`/api/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(handle<unknown>)
}

export const putPrBody = async (prBody: string): Promise<void> => {
  await fetch('/api/pr-body', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prBody }),
  }).then(handle<unknown>)
}

export const submitReview = (decision: ReviewDecision): Promise<{ commentCount: number }> =>
  fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  }).then(handle<{ commentCount: number }>)

export const dismissSession = async (): Promise<void> => {
  await fetch('/api/dismiss', { method: 'POST' }).then(handle<unknown>)
}
