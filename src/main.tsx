import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx' // Ensure the correct file extension is used
import './index.css'   // <-- Mude de style.css para index.css

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)