import { useState, useEffect, useCallback } from 'react'

interface Service {
  id: string
  name: string
  port: number
  running: boolean
  status_text: string
  launchable: boolean
}

interface StaticApp {
  id: string
  name: string
  icon: string
  url: string
  healthUrl?: string
  port?: number
  host?: string
}

interface RemoteMachine {
  id: string
  name: string
  icon: string
  provider: string
  publicIp: string
  tailscaleIp?: string
  sshUser?: string
  description: string
}

// Remote VPS/Machines
const REMOTE_MACHINES: RemoteMachine[] = [
  {
    id: 'hostinger-vps',
    name: 'Hostinger VPS',
    icon: '☁️',
    provider: 'Hostinger',
    publicIp: '153.92.214.24',
    tailscaleIp: '', // TODO: Configure Tailscale
    sshUser: 'root',
    description: 'Mobile Claude Code access via Termius',
  },
]

// Static apps not managed by trigger-api
const STATIC_APPS: StaticApp[] = [
  {
    id: 'homepage',
    name: 'Dashboard',
    icon: '🏠',
    url: 'http://dashboard.cv2.local/',
    healthUrl: 'http://localhost:3000',
    port: 3000,
  },
  {
    id: 'accountant',
    name: 'Accountant',
    icon: '📊',
    url: 'http://accountant.cv2.local/',
    healthUrl: 'http://localhost:5173',
    port: 5173,
  },
  {
    id: 'fleet-control',
    name: 'Fleet Control',
    icon: '🚀',
    url: 'http://fleet.cv2.local/',
    healthUrl: 'http://localhost:8510',
    port: 8510,
  },
  {
    id: 'open-webui',
    name: 'Open WebUI',
    icon: '🤖',
    url: 'http://100.97.157.8:3080/',
    healthUrl: 'http://localhost:3080',
    port: 3080,
  },
  {
    id: 'n8n',
    name: 'n8n Workflows',
    icon: '⚙️',
    url: 'http://100.97.157.8:5678/',
    healthUrl: 'http://localhost:5678',
    port: 5678,
  },
  {
    id: 'pm-app',
    name: 'Project Manager',
    icon: '📋',
    url: 'http://pm.cv2.local/',
    healthUrl: 'http://localhost:3001',
    port: 3001,
  },
]

// Service icons and URLs mapping for API services
const SERVICE_CONFIG: Record<string, { icon: string; url?: string }> = {
  'command-center': { icon: '🎛️', url: 'http://localhost:8110' },
  'fleet-chat': { icon: '💬', url: 'http://localhost:8200' },
  'fleet-viewer': { icon: '👁️', url: 'http://localhost:8111' },
  'voice-stt': { icon: '🎤' },
  'trigger-api': { icon: '⚡', url: 'http://localhost:8100/health' },
}

export default function AppCards() {
  const [services, setServices] = useState<Service[]>([])
  const [appStatus, setAppStatus] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const getApiKey = () => localStorage.getItem('cv_api_key') || ''

  // Check health of static apps
  const checkAppHealth = useCallback(async (app: StaticApp): Promise<boolean> => {
    if (!app.healthUrl) return false
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)
      await fetch(app.healthUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      return true // no-cors request succeeded - server is responding
    } catch {
      return false
    }
  }, [])

  const checkAllApps = useCallback(async () => {
    const status: Record<string, boolean> = {}
    await Promise.all(
      STATIC_APPS.map(async (app) => {
        status[app.id] = await checkAppHealth(app)
      })
    )
    setAppStatus(status)
  }, [checkAppHealth])

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch('/api/services')
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setServices(json.services || [])
    } catch (err) {
      console.error('Failed to fetch services:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchServices()
    checkAllApps()
    const interval = setInterval(() => {
      fetchServices()
      checkAllApps()
    }, 10000)
    return () => clearInterval(interval)
  }, [fetchServices, checkAllApps])

  const startService = async (serviceId: string) => {
    setActionLoading(serviceId)
    try {
      const res = await fetch(`/api/services/${serviceId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': getApiKey(),
        },
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to start')
      }
      await fetchServices()
    } catch (err) {
      console.error('Start failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const stopService = async (serviceId: string) => {
    setActionLoading(serviceId)
    try {
      const res = await fetch(`/api/services/${serviceId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': getApiKey(),
        },
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to stop')
      }
      await fetchServices()
    } catch (err) {
      console.error('Stop failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const openUrl = (url: string) => {
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="apps-section">
        <h2>Apps & Services</h2>
        <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="apps-section">
      <h2>Apps</h2>
      <div className="app-grid">
        {/* Static Apps */}
        {STATIC_APPS.map((app) => {
          const isRunning = appStatus[app.id] ?? false

          return (
            <div
              key={app.id}
              className={`app-card ${isRunning ? 'running' : ''}`}
            >
              <div className="app-card-header">
                <div className="app-card-title">
                  <div className="app-card-icon">{app.icon}</div>
                  <div>
                    <div className="app-card-name">{app.name}</div>
                    <div className="app-card-url">{app.url.replace('http://', '').replace('/', '')}</div>
                  </div>
                </div>
                <div className={`app-card-status ${isRunning ? 'running' : 'stopped'}`}>
                  <span className="app-card-status-dot" />
                  {isRunning ? 'Online' : 'Offline'}
                </div>
              </div>

              <div className="app-card-details">
                {app.port && (
                  <div className="app-card-detail">
                    <span className="app-card-detail-label">Port</span>
                    <span className="app-card-detail-value">{app.port}</span>
                  </div>
                )}
                {isRunning && (
                  <div className="health-indicator healthy">
                    ✓ Responding
                  </div>
                )}
              </div>

              <div className="app-card-actions">
                <button
                  className="app-card-btn primary"
                  onClick={() => openUrl(app.url)}
                >
                  Open
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <h2 style={{ marginTop: '2rem' }}>Services</h2>
      <div className="app-grid">
        {/* API-managed Services */}
        {services.map((service) => {
          const config = SERVICE_CONFIG[service.id] || { icon: '📦' }
          const isLoading = actionLoading === service.id

          return (
            <div
              key={service.id}
              className={`app-card ${service.running ? 'running' : ''}`}
            >
              <div className="app-card-header">
                <div className="app-card-title">
                  <div className="app-card-icon">{config.icon}</div>
                  <div>
                    <div className="app-card-name">{service.name}</div>
                    <div className="app-card-url">localhost:{service.port}</div>
                  </div>
                </div>
                <div className={`app-card-status ${service.running ? 'running' : 'stopped'}`}>
                  <span className="app-card-status-dot" />
                  {service.status_text}
                </div>
              </div>

              <div className="app-card-details">
                <div className="app-card-detail">
                  <span className="app-card-detail-label">Port</span>
                  <span className="app-card-detail-value">{service.port}</span>
                </div>
                {service.running && (
                  <div className="health-indicator healthy">
                    ✓ Healthy
                  </div>
                )}
              </div>

              <div className="app-card-actions">
                {service.running ? (
                  <>
                    {config.url && (
                      <button
                        className="app-card-btn primary"
                        onClick={() => openUrl(config.url!)}
                      >
                        Open
                      </button>
                    )}
                    {service.launchable && (
                      <button
                        className="app-card-btn danger"
                        onClick={() => stopService(service.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? <span className="spinner" /> : 'Stop'}
                      </button>
                    )}
                  </>
                ) : (
                  service.launchable && (
                    <button
                      className="app-card-btn primary"
                      onClick={() => startService(service.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? <span className="spinner" /> : 'Start'}
                    </button>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Remote Machines / VPS */}
      {REMOTE_MACHINES.length > 0 && (
        <>
          <h2 style={{ marginTop: '2rem' }}>Remote Machines</h2>
          <div className="app-grid">
            {REMOTE_MACHINES.map((machine) => (
              <div key={machine.id} className="app-card">
                <div className="app-card-header">
                  <div className="app-card-title">
                    <div className="app-card-icon">{machine.icon}</div>
                    <div>
                      <div className="app-card-name">{machine.name}</div>
                      <div className="app-card-url">{machine.provider}</div>
                    </div>
                  </div>
                  <div className="app-card-status stopped">
                    <span className="app-card-status-dot" />
                    VPS
                  </div>
                </div>

                <div className="app-card-details">
                  <div className="app-card-detail">
                    <span className="app-card-detail-label">Public IP</span>
                    <span className="app-card-detail-value">{machine.publicIp}</span>
                  </div>
                  {machine.tailscaleIp && (
                    <div className="app-card-detail">
                      <span className="app-card-detail-label">Tailscale</span>
                      <span className="app-card-detail-value">{machine.tailscaleIp}</span>
                    </div>
                  )}
                  <div className="app-card-detail">
                    <span className="app-card-detail-label">User</span>
                    <span className="app-card-detail-value">{machine.sshUser || 'N/A'}</span>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  {machine.description}
                </div>

                <div className="app-card-actions">
                  <button
                    className="app-card-btn"
                    onClick={() => navigator.clipboard.writeText(`ssh ${machine.sshUser}@${machine.publicIp}`)}
                  >
                    Copy SSH
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
