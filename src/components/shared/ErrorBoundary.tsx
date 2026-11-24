import { Component, ReactNode } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Window render failed', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background text-foreground p-6 flex items-center justify-center">
          <div className="max-w-lg rounded-lg border border-destructive/30 bg-card p-5 space-y-3">
            <h1 className="text-lg font-bold text-destructive">تعذر فتح نافذة الحضور</h1>
            <p className="text-sm text-muted-foreground">
              حصل خطأ أثناء تحميل النافذة. اقفلها وافتحها مرة تانية، ولو ظهرت الرسالة دي ابعت تفاصيل الخطأ.
            </p>
            <pre className="max-h-48 overflow-auto rounded bg-muted p-3 text-xs text-muted-foreground whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
