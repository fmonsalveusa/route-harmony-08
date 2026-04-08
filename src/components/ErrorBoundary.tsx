import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  // Componente opcional para mostrar en lugar del error genérico
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — captura errores de cualquier componente hijo
 * y muestra un mensaje amigable en lugar de tumbar toda la app.
 *
 * Uso:
 *   <ErrorBoundary>
 *     <MiComponente />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Log del error para diagnóstico
    console.error('[ErrorBoundary] Error capturado:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="text-5xl">⚠️</div>
            <h2 className="text-xl font-semibold text-foreground">
              Algo salió mal
            </h2>
            <p className="text-muted-foreground text-sm">
              Ocurrió un error inesperado. Puedes intentar recargar la sección
              o refrescar la página si el problema persiste.
            </p>
            {this.state.error && (
              <p className="text-xs text-muted-foreground bg-muted rounded p-2 font-mono text-left break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Reintentar
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Recargar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
