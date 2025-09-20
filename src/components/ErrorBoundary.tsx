import { Component, type ErrorInfo, type ReactNode } from 'react'

const DEV_FALLBACK_STYLES = {
  container:
    'mx-auto mt-16 max-w-lg rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive-foreground shadow-lg',
  heading: 'text-lg font-semibold mb-2',
  body: 'text-sm leading-6 text-muted-foreground',
  button:
    'mt-4 inline-flex items-center rounded-md border border-destructive bg-background px-3 py-1 text-sm font-medium text-destructive hover:bg-destructive/10',
}

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  private handleReset = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className={DEV_FALLBACK_STYLES.container} role="alert">
        <h2 className={DEV_FALLBACK_STYLES.heading}>Something went wrong.</h2>
        <p className={DEV_FALLBACK_STYLES.body}>
          The interface hit an unexpected error. Check the console for details. You can refresh or continue after
          addressing the issue.
        </p>
        <button type="button" onClick={this.handleReset} className={DEV_FALLBACK_STYLES.button}>
          Reload application
        </button>
      </div>
    )
  }
}
