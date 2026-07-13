import ReactDOM from 'react-dom/client'
import { StrictMode } from 'react'
import App from './App.jsx'
import AdminRoot from './admin/AdminRoot.jsx'
import MemorySphereVisualizer from './components/MemorySphereVisualizer.jsx'
import './index.css'

const MOUNT_ID = 'memory-remix'
const ADMIN_ROUTES = new Set(['/admin', '/admin-login', '/dashboard'])
const isAdminRoute = ADMIN_ROUTES.has(window.location.pathname)

const mountAdmin = () => {
  let container = document.getElementById('admin-root')

  if (!container) {
    container = document.createElement('div')
    container.id = 'admin-root'
    container.style.position = 'fixed'
    container.style.inset = '0'
    container.style.zIndex = '2147483647'
    document.body.appendChild(container)
  }

  if (!container._reactRoot) {
    container._reactRoot = ReactDOM.createRoot(container)
  }

  container._reactRoot.render(
    <StrictMode>
      <AdminRoot />
    </StrictMode>
  )

  return true
}

const initPlayer = () => {
  const container = document.getElementById(MOUNT_ID)

  if (!container) {
    console.warn(`[Memory Remix] Container #${MOUNT_ID} not found. Waiting for DOM...`)
    return false
  }

  container.innerHTML = ''

  const debugMode = container.getAttribute('data-debug') === 'true'
  const samples = {
    kick: container.getAttribute('data-kick-url'),
    snare: container.getAttribute('data-snare-url'),
    hihat: container.getAttribute('data-hihat-url'),
  }

  ReactDOM.createRoot(container).render(
    <StrictMode>
      <App debugMode={debugMode} samples={samples} />
    </StrictMode>
  )

  return true
}

window.mountMemoryVisualizer = (container, howlInstance) => {
  if (!container) return
  if (container._reactRoot) return container._reactRoot

  const root = ReactDOM.createRoot(container)
  container._reactRoot = root

  root.render(
    <StrictMode>
      <MemorySphereVisualizer howlInstance={howlInstance} />
    </StrictMode>
  )

  return root
}

window.unmountMemoryVisualizer = (container) => {
  if (container && container._reactRoot) {
    container._reactRoot.unmount()
    container._reactRoot = null
    container.innerHTML = ''
  }
}

if (isAdminRoute) {
  mountAdmin()
} else {
  const mounted = initPlayer()

  if (!mounted) {
    document.addEventListener('DOMContentLoaded', initPlayer)
  }
}

