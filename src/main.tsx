import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// ── Register all node definitions before mounting ──────────────────────────
import { registerPlatformNodes } from './nodes/platform'
import { registerMiliastraNodes } from './nodes/miliastra'

registerPlatformNodes()
registerMiliastraNodes()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
