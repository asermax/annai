import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'

import type { DiffSide, Draft, DraftInput } from '../../shared/drafts.ts'
import type { ReviewDecision } from '../../shared/result.ts'
import {
  createDraft as apiCreate,
  deleteDraft as apiDelete,
  dismissSession as apiDismiss,
  fetchState as apiFetchState,
  putPrBody as apiPutPrBody,
  submitReview as apiSubmit,
  updateDraft as apiUpdate,
} from '../api/drafts.ts'

// ---- anchor types used by the inline composer ----

export type LineAnchor = { kind: 'line', path: string, line: number, side: DiffSide }
export type RangeAnchor = { kind: 'range', path: string, startLine: number, startSide: DiffSide, line: number, side: DiffSide }
export type Anchor = LineAnchor | RangeAnchor

// ---- state ----

export type FinishedKind = 'submitted' | 'dismissed'

export interface DraftsState {
  ready: boolean
  drafts: Draft[]
  prBody: string
  activeAnchor: Anchor | null
  activeFileComposerPath: string | null
  resolvedSuggestionIds: string[]   // accepted-as-draft or dismissed; in-memory only
  confirmReview: ReviewDecision | null
  confirmDismiss: boolean
  submitting: boolean
  submitError: string | null
  finished: FinishedKind | null
}

const initialState: DraftsState = {
  ready: false,
  drafts: [],
  prBody: '',
  activeAnchor: null,
  activeFileComposerPath: null,
  resolvedSuggestionIds: [],
  confirmReview: null,
  confirmDismiss: false,
  submitting: false,
  submitError: null,
  finished: null,
}

type Action =
  | { type: 'init', drafts: Draft[], prBody: string }
  | { type: 'open-anchor', anchor: Anchor }
  | { type: 'close-anchor' }
  | { type: 'open-file-composer', path: string }
  | { type: 'close-file-composer' }
  | { type: 'draft-added', draft: Draft }
  | { type: 'draft-updated', draft: Draft }
  | { type: 'draft-removed', id: string }
  | { type: 'pr-body-set', prBody: string }
  | { type: 'resolve-suggestion', id: string }
  | { type: 'open-confirm-review', decision: ReviewDecision }
  | { type: 'close-confirm-review' }
  | { type: 'open-confirm-dismiss' }
  | { type: 'close-confirm-dismiss' }
  | { type: 'submit-start' }
  | { type: 'submit-fail', error: string }
  | { type: 'finish', kind: FinishedKind }

const reducer = (state: DraftsState, action: Action): DraftsState => {
  switch (action.type) {
    case 'init':
      return { ...state, ready: true, drafts: action.drafts, prBody: action.prBody }
    case 'open-anchor':
      // opening an inline anchor closes any open file-level composer
      return { ...state, activeAnchor: action.anchor, activeFileComposerPath: null }
    case 'close-anchor':
      return { ...state, activeAnchor: null }
    case 'open-file-composer':
      // opening a file-level composer closes any open inline anchor and any other file-level composer
      return { ...state, activeFileComposerPath: action.path, activeAnchor: null }
    case 'close-file-composer':
      return { ...state, activeFileComposerPath: null }
    case 'draft-added':
      return {
        ...state,
        drafts: [...state.drafts, action.draft],
        activeAnchor: null,
        activeFileComposerPath: action.draft.kind === 'file' ? null : state.activeFileComposerPath,
      }
    case 'draft-updated':
      return { ...state, drafts: state.drafts.map(d => (d.id === action.draft.id ? action.draft : d)) }
    case 'draft-removed':
      return { ...state, drafts: state.drafts.filter(d => d.id !== action.id) }
    case 'pr-body-set':
      return { ...state, prBody: action.prBody }
    case 'resolve-suggestion':
      return state.resolvedSuggestionIds.includes(action.id)
        ? state
        : { ...state, resolvedSuggestionIds: [...state.resolvedSuggestionIds, action.id] }
    case 'open-confirm-review':
      return { ...state, confirmReview: action.decision, submitError: null }
    case 'close-confirm-review':
      return { ...state, confirmReview: null }
    case 'open-confirm-dismiss':
      return { ...state, confirmDismiss: true }
    case 'close-confirm-dismiss':
      return { ...state, confirmDismiss: false }
    case 'submit-start':
      return { ...state, submitting: true, submitError: null }
    case 'submit-fail':
      return { ...state, submitting: false, submitError: action.error }
    case 'finish':
      return {
        ...state,
        submitting: false,
        confirmReview: null,
        confirmDismiss: false,
        finished: action.kind,
      }
    default:
      return state
  }
}

// ---- context ----

export interface DraftsApi extends DraftsState {
  openAnchor: (anchor: Anchor) => void
  closeAnchor: () => void
  openFileComposer: (path: string) => void
  closeFileComposer: () => void
  addDraft: (input: DraftInput) => Promise<Draft>
  editDraft: (id: string, body: string) => Promise<Draft>
  dismissDraft: (id: string) => Promise<void>
  setPrBody: (body: string) => void
  resolveSuggestion: (id: string) => void
  openConfirmReview: (decision: ReviewDecision) => void
  closeConfirmReview: () => void
  openConfirmDismiss: () => void
  closeConfirmDismiss: () => void
  submit: (decision: ReviewDecision) => Promise<void>
  dismissSession: () => Promise<void>
}

const DraftsContext = createContext<DraftsApi | null>(null)

interface ProviderProps {
  children: ReactNode
}

export const DraftsProvider = ({ children }: ProviderProps) => {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    apiFetchState()
      .then(snap => dispatch({ type: 'init', drafts: snap.drafts, prBody: snap.prBody }))
      .catch(err => {
        // surface load error in console; initial state stays empty
        console.error('annai: failed to load session state', err)
        dispatch({ type: 'init', drafts: [], prBody: '' })
      })
  }, [])

  const openAnchor = useCallback((anchor: Anchor) => dispatch({ type: 'open-anchor', anchor }), [])
  const closeAnchor = useCallback(() => dispatch({ type: 'close-anchor' }), [])

  const openFileComposer = useCallback((path: string) => dispatch({ type: 'open-file-composer', path }), [])
  const closeFileComposer = useCallback(() => dispatch({ type: 'close-file-composer' }), [])

  const addDraft = useCallback(async (input: DraftInput): Promise<Draft> => {
    const draft = await apiCreate(input)
    dispatch({ type: 'draft-added', draft })

    return draft
  }, [])

  const editDraft = useCallback(async (id: string, body: string): Promise<Draft> => {
    const draft = await apiUpdate(id, { body })
    dispatch({ type: 'draft-updated', draft })

    return draft
  }, [])

  const dismissDraft = useCallback(async (id: string): Promise<void> => {
    await apiDelete(id)
    dispatch({ type: 'draft-removed', id })
  }, [])

  const setPrBody = useCallback((body: string) => {
    dispatch({ type: 'pr-body-set', prBody: body })
    // fire-and-forget; server is durable, network failure surfaces in console
    apiPutPrBody(body).catch(err => console.error('annai: pr-body PUT failed', err))
  }, [])

  const resolveSuggestion = useCallback((id: string) => dispatch({ type: 'resolve-suggestion', id }), [])

  const openConfirmReview = useCallback((decision: ReviewDecision) => dispatch({ type: 'open-confirm-review', decision }), [])
  const closeConfirmReview = useCallback(() => dispatch({ type: 'close-confirm-review' }), [])
  const openConfirmDismiss = useCallback(() => dispatch({ type: 'open-confirm-dismiss' }), [])
  const closeConfirmDismiss = useCallback(() => dispatch({ type: 'close-confirm-dismiss' }), [])

  const submit = useCallback(async (decision: ReviewDecision): Promise<void> => {
    dispatch({ type: 'submit-start' })
    try {
      await apiSubmit(decision)
      dispatch({ type: 'finish', kind: 'submitted' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      dispatch({ type: 'submit-fail', error: message })
      throw err
    }
  }, [])

  const dismissSession = useCallback(async (): Promise<void> => {
    dispatch({ type: 'submit-start' })
    try {
      await apiDismiss()
      dispatch({ type: 'finish', kind: 'dismissed' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      dispatch({ type: 'submit-fail', error: message })
      throw err
    }
  }, [])

  const value = useMemo<DraftsApi>(() => ({
    ...state,
    openAnchor,
    closeAnchor,
    openFileComposer,
    closeFileComposer,
    addDraft,
    editDraft,
    dismissDraft,
    setPrBody,
    resolveSuggestion,
    openConfirmReview,
    closeConfirmReview,
    openConfirmDismiss,
    closeConfirmDismiss,
    submit,
    dismissSession,
  }), [state, openAnchor, closeAnchor, openFileComposer, closeFileComposer, addDraft, editDraft, dismissDraft, setPrBody, resolveSuggestion, openConfirmReview, closeConfirmReview, openConfirmDismiss, closeConfirmDismiss, submit, dismissSession])

  return <DraftsContext.Provider value={value}>{children}</DraftsContext.Provider>
}

export const useDrafts = (): DraftsApi => {
  const ctx = useContext(DraftsContext)
  if (ctx == null) throw new Error('useDrafts must be used inside <DraftsProvider>')

  return ctx
}

export const useDraftsForFile = (path: string): { drafts: Draft[] } => {
  const { drafts } = useDrafts()

  return useMemo(() => ({
    drafts: drafts.filter(d => d.path === path),
  }), [drafts, path])
}
