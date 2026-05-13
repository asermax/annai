import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App.tsx'
import './styles/global.css'

const rootEl = document.getElementById('root')
if (rootEl == null) throw new Error('annai: #root element missing')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
