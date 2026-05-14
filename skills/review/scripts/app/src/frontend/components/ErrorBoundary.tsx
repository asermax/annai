import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

import { reportClientError } from '../api/client-errors.ts'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// Top-level boundary so a render-time throw (e.g. a runtime assertion inside
// @pierre/diffs setup) lands as a visible fallback instead of an empty body,
// and gets reported to the daemon so `annai.sh status` / `watch` see it.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError (error: Error): State {
    return { error }
  }

  componentDidCatch (error: Error, info: ErrorInfo): void {
    reportClientError({
      source: 'error-boundary',
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
    })
  }

  render (): ReactNode {
    if (this.state.error != null) {
      return (
        <div className="status-banner error" role="alert">
          <strong>Surface failed to render.</strong>
          <div>{this.state.error.message}</div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
            Run <code>annai.sh status</code> for the recorded error, or check the watch stream for the matching <code>daemon-error</code> event.
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
