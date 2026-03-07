import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@client/App'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { ErrorProvider, ErrorBanner } from '@client/context/ErrorContext'
import { AUTH_PAUSED } from '@client/pages/Login/Login.page'
import '@client/assets/index.css'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

if (import.meta.env.DEV && !clientId) {
  // En desarrollo, fallar rápido si falta el Client ID
  throw new Error('VITE_GOOGLE_CLIENT_ID no está configurado. Define esta variable en tu archivo .env.development.')
}

const content = (
  <ErrorProvider>
    <div className="min-h-screen bg-black">
      <div className="max-w-6xl mx-auto px-4 py-2">
        <ErrorBanner />
      </div>
      <App />
    </div>
  </ErrorProvider>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {AUTH_PAUSED ? content : (
      <GoogleOAuthProvider clientId={clientId}>
        {content}
      </GoogleOAuthProvider>
    )}
  </React.StrictMode>,
) 