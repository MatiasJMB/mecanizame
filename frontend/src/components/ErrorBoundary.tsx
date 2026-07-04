import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

/** Captura errores de render de React y muestra un fallback recuperable en vez de dejar la app
 *  en blanco. Red de seguridad ante un join nullable inesperado o una fecha malformada. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Error no capturado en el render:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 p-6 text-center text-gray-100">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-500/10 text-red-400">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-lg font-black">Algo salió mal</h1>
          <p className="mt-1 max-w-sm text-sm text-gray-400">
            Ocurrió un error inesperado. Recarga la página para continuar; tus datos están a salvo.
          </p>
        </div>
        <button onClick={() => window.location.reload()}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white transition-colors hover:bg-blue-500">
          Recargar
        </button>
      </div>
    );
  }
}
