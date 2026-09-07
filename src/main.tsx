import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx' // Ensure the correct file extension is used
import './index.css'   // <-- Mude de style.css para index.css

// Regista o service worker — necessário para o site ser "instalável"
// (adicionar ao ecrã inicial) no Android/Chrome.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Erro ao registar service worker:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)