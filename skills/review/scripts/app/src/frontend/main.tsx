import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App.tsx'
import { readInitialTheme } from './components/ThemeToggle.tsx'
import './styles/global.css'

// Set theme synchronously before React mounts so the first paint already
// reflects the persisted choice — no light → dark flash.
document.documentElement.setAttribute('data-theme', readInitialTheme())

const rootEl = document.getElementById('root')
if (rootEl == null) throw new Error('annai: #root element missing')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
