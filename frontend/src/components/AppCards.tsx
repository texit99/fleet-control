import { useState, useEffect, useCallback } from 'react'

interface Service {
  id: string
  name: string
  port: number
  running: boolean
  status_text: string
  launchable: boolean
}

// Service icons and URLs mapping
const SERVICE_CONFIG: Record<string, { icon: string; url?: string }> = {
  'command-center': { icon: '🎛️', url: 'http://localhost:8110' },
  'fleet-chat': { icon: '💬', url: 'http://localhost:8200' },
  'fleet-viewer': { icon: '👁️', url: 'http://localhost:8111' },
  'voice-stt': { icon: '🎤' },
  'pm-app': { icon: '📋', url: 'http://localhost:3001' },
  'trigger-api': { icon: '⚡', url: 'http://localhost:8100/health' },
}

export default function AppCards() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const getApiKey = () => localStorage.getItem('cv_api_key') || ''

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
    const interval = setInterval(fetchServices, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [fetchServices])

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

  const openService = (serviceId: string) => {
    const config = SERVICE_CONFIG[serviceId]
    if (config?.url) {
      window.open(config.url, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="apps-section">
        <h2>Services</h2>
        <div style={{ color: 'var(--text-secondary)' }}>Loading services...</div>
      </div>
    )
  }

  return (
    <div className="apps-section">
      <h2>Services</h2>
      <div className="app-grid">
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
                {service.running && config.url && (
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
                        onClick={() => openService(service.id)}
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
    </div>
  )
}
