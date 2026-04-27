import { Component, type ErrorInfo, type ReactNode } from 'react'

interface UiErrorBoundaryProps {
  title: string
  className?: string
  children: ReactNode
}

interface UiErrorBoundaryState {
  hasError: boolean
}

export default class UiErrorBoundary extends Component<UiErrorBoundaryProps, UiErrorBoundaryState> {
  state: UiErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): UiErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(_error: unknown, _errorInfo: ErrorInfo) {
    // Keep the app usable even if one UI section fails to render.
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={`ui-fallback ${this.props.className ?? ''}`}>
          <span className="ui-fallback-title">{this.props.title}</span>
          <span className="ui-fallback-copy">This section ran into a UI error. Reload or continue using the panels below.</span>
        </div>
      )
    }

    return this.props.children
  }
}
