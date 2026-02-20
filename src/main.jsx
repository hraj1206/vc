import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { Buffer } from 'buffer'
import process from 'process'

window.global = window
window.Buffer = Buffer
window.process = process

// Some libraries expect these to be present on process
if (!process.nextTick) process.nextTick = (fn, ...args) => setTimeout(() => fn(...args), 0)
if (!process.env) process.env = {}

import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
