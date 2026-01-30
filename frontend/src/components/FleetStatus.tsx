import { useState, useEffect, useRef } from 'react'

interface Agent {
  id: string
  name: string
  online: boolean
  status: string
  inbox_count: number
  type?: 'cli' | 'desktop' | 'remote'
  host?: string
  ip?: string
}

interface FleetStatusResponse {
  agents: Agent[]
  online_count: number
  total_count: number
}

interface FleetStatusProps {
  onAgentSelect?: (agentId: string) => void
}

export default function FleetStatus({ onAgentSelect }: FleetStatusProps) {
  const [data, setData] = useState<FleetStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionType, setConnectionType] = useState<'sse' | 'polling'>('sse')
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollingIntervalRef = useRef<number | null>(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/fleet/status')
      if (!res.ok) throw new Error('Failed to fetch fleet status')
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const startSSE = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const eventSource = new EventSource('/api/fleet/status/stream')
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const json = JSON.parse(event.data)
        if (!json.error) {
          setData(json)
          setError(null)
          setLoading(false)
        }
      } catch {
        // Ignore parse errors
      }
    }

    eventSource.onerror = () => {
      // SSE failed, fall back to polling
      eventSource.close()
      eventSourceRef.current = null
      setConnectionType('polling')
      startPolling()
    }

    eventSource.onopen = () => {
      setConnectionType('sse')
      // Stop polling if it was running
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }

  const startPolling = () => {
    fetchStatus()
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }
    pollingIntervalRef.current = window.setInterval(fetchStatus, 5000)
  }

  useEffect(() => {
    // Try SSE first
    startSSE()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  if (loading && !data) {
    return <div className="loading">Loading fleet status...</div>
  }

  if (error) {
    return <div className="message error">{error}</div>
  }

  if (!data) return null

  return (
    <div>
      <div className="summary-stats">
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {data.online_count}
          </div>
          <div className="stat-label">Online</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {data.total_count - data.online_count}
          </div>
          <div className="stat-label">Offline</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.total_count}</div>
          <div className="stat-label">Total Agents</div>
        </div>
      </div>

      <div className="agent-grid">
        {data.agents.map((agent) => (
          <div
            key={agent.id}
            className={`agent-card ${onAgentSelect ? 'clickable' : ''} ${agent.type === 'desktop' ? 'desktop-agent' : ''}`}
            onClick={() => onAgentSelect?.(agent.id)}
            role={onAgentSelect ? 'button' : undefined}
            tabIndex={onAgentSelect ? 0 : undefined}
            onKeyDown={(e) => {
              if (onAgentSelect && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onAgentSelect(agent.id)
              }
            }}
          >
            <div className="agent-header">
              <div>
                <div className="agent-name">{agent.name}</div>
                <div className="agent-id">
                  {agent.id}
                  {agent.type === 'desktop' && <span className="type-badge desktop">Desktop</span>}
                  {agent.type === 'remote' && <span className="type-badge remote">Remote</span>}
                </div>
              </div>
              <span className={`status-badge ${agent.online ? 'online' : 'offline'}`}>
                {agent.online ? (agent.type === 'desktop' ? 'Running' : 'Online') : (agent.type === 'desktop' ? 'Stopped' : 'Offline')}
              </span>
            </div>
            <div className="inbox-count">
              Inbox: {agent.inbox_count} message{agent.inbox_count !== 1 ? 's' : ''}
            </div>
            {onAgentSelect && <div className="card-hint">Click to view details →</div>}
          </div>
        ))}
      </div>

      <div className="connection-status">
        {connectionType === 'sse' ? (
          <span style={{ color: 'var(--success)' }}>Live updates (SSE)</span>
        ) : (
          <span style={{ color: 'var(--warning)' }}>Polling (5s)</span>
        )}
      </div>
    </div>
  )
}
