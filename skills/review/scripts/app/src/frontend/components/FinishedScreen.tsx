import { useEffect, useState } from 'react'

import type { FinishedKind } from '../state/drafts.tsx'

interface Props {
  kind: FinishedKind
}

const CLOSE_DELAY_MS = 400
const FALLBACK_DELAY_MS = 1500

export const FinishedScreen = ({ kind }: Props) => {
  const [showFallback, setShowFallback] = useState(false)

  useEffect(() => {
    const closeTimer = setTimeout(() => window.close(), CLOSE_DELAY_MS)
    const fallbackTimer = setTimeout(() => setShowFallback(true), FALLBACK_DELAY_MS)

    return () => {
      clearTimeout(closeTimer)
      clearTimeout(fallbackTimer)
    }
  }, [])

  const headline = kind === 'submitted' ? 'Review submitted.' : 'Session dismissed.'

  return (
    <div className="finished-screen">
      <div className="finished-card">
        <h2>{headline}</h2>
        <p>Closing this tab…</p>
        {showFallback ? (
          <>
            <p className="hint">Your browser blocked the auto-close. You can close this tab manually.</p>
            <button type="button" onClick={() => window.close()}>Close tab</button>
          </>
        ) : null}
      </div>
    </div>
  )
}
