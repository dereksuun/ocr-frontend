import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
  componentStack?: string;
};

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    this.setState({ error, componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card">
          <div className="page-header">
            <div>
              <h1>Erro na tela</h1>
              <p className="help-text">
                Ocorreu um erro inesperado durante a renderização.
              </p>
            </div>
          </div>
          {import.meta.env.DEV ? (
            <pre className="json-block">
              {this.state.error?.message}
              {"\n"}
              {this.state.error?.stack}
              {"\n"}
              {this.state.componentStack}
            </pre>
          ) : null}
        </div>
      );
    }

    return this.props.children;
  }
}
