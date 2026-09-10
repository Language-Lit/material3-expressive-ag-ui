import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@language-lit/material3-expressive/styles.css'
import '../src/styles/styles.css'
import './playground.css'

import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
