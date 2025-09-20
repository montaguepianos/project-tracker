import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import './index.css'

const RootApp = import.meta.env.DEV ? (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
) : (
  <App />
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {RootApp}
  </StrictMode>,
)
