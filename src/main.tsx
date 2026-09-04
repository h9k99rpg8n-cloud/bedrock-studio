import { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './editor.css';

function fallbackUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

try {
  const globalObject = globalThis as typeof globalThis & { crypto?: Crypto };
  if (!globalObject.crypto) {
    Object.defineProperty(globalObject, 'crypto', {
      configurable: true,
      value: { randomUUID: fallbackUuid },
    });
  } else if (typeof globalObject.crypto.randomUUID !== 'function') {
    Object.defineProperty(globalObject.crypto, 'randomUUID', {
      configurable: true,
      value: fallbackUuid,
    });
  }
} catch {
  // The app can still start; project creation will surface a visible error if needed.
}

type BoundaryState = { error: string | null };

class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Bedrock Studio runtime error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: '100vh', padding: 24, background: '#090d13', color: '#e5e7eb' }}>
          <div style={{ maxWidth: 620, margin: '10vh auto', padding: 24, border: '1px solid #374151', borderRadius: 18, background: '#0f151d' }}>
            <h1 style={{ marginTop: 0 }}>Bedrock Studio could not start</h1>
            <p style={{ color: '#94a3b8' }}>A runtime error occurred. The page is no longer allowed to fail silently.</p>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#fca5a5' }}>{this.state.error}</pre>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: 12, padding: '10px 14px', border: 0, borderRadius: 10, fontWeight: 800, background: '#34d399', color: '#07120d' }}
            >
              Reload
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
