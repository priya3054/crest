import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { StoreProvider } from './context/store.jsx'
import { UIProvider } from './context/ui.jsx'
import { AuthProvider, useAuth } from './context/auth.jsx'
import { AuthScreen } from './screens/AuthScreen.jsx'

// Decide what to render based on auth: a brief loader while we check any saved
// token, the login/signup screen when logged out, or the full app when logged in.
// The store + UI providers only mount once authenticated, so polling and data
// fetching never run without a token.
function Root() {
  const { user, ready } = useAuth()
  if (!ready) {
    return (
      <div className="empty" style={{ marginTop: 160 }}>
        <div className="muted">Loading…</div>
      </div>
    )
  }
  if (!user) return <AuthScreen />
  return (
    <StoreProvider>
      <UIProvider>
        <App />
      </UIProvider>
    </StoreProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
