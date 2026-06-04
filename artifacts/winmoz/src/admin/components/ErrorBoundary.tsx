import { Component, type ReactNode } from "react";

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="p-8 text-red-600 text-sm font-mono whitespace-pre-wrap">
          <strong>Render error:</strong>{"\n"}{this.state.error.message}{"\n"}{this.state.error.stack}
        </div>
      );
    }
    return this.props.children;
  }
}
