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
  current_task?: string | null
  task_status?: string
  last_status_line?: string | null
}

interface FleetStatusResponse {
  agents: Agent[]
  online_count: number
  total_count: number
}

interface FleetStatusProps {
  onAgentSelect?: (agentId: string) => void
}

interface InboxModal {
  agentId: string
  agentName: string
  files: string[]
}

export default function FleetStatus({ onAgentSelect }: FleetStatusProps) {
  const [data, setData] = useState<FleetStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionType, setConnectionType] = useState<'sse' | 'polling'>('sse')
  const [inboxModal, setInboxModal] = useState<InboxModal | null>(null)
  const [inboxLoading, setInboxLoading] = useState<string | null>(null)
  const [fleetActionLoading, setFleetActionLoading] = useState<string | null>(null)
  const [fleetMessage, setFleetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollingIntervalRef = useRef<number | null>(null)

  const getApiKey = () => localStorage.getItem('cv_api_key') || ''

  const fleetInboxCheck = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setFleetActionLoading('inbox')
    setFleetMessage(null)
    try {
      const res = await fetch('/api/fleet/inbox-check-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': getApiKey(),
        },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setFleetMessage({ type: 'success', text: json.status })
      setTimeout(() => setFleetMessage(null), 3000)
    } catch (err) {
      setFleetMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setFleetActionLoading(null)
    }
  }

  const checkInbox = async (agentId: string, agentName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setInboxLoading(agentId)
    try {
      const res = await fetch(`/api/fleet/context/inbox/${agentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': getApiKey(),
        },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to check inbox')

      if (json.inbox_files) {
        setInboxModal({ agentId, agentName, files: json.inbox_files })
      }
    } catch (err) {
      console.error('Inbox check failed:', err)
    } finally {
      setInboxLoading(null)
    }
  }

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
            {agent.current_task && (
              <div className="agent-task">
                <span className="task-label">Task:</span> {agent.current_task}
              </div>
            )}
            {agent.task_status && agent.task_status !== 'unknown' && (
              <div className="agent-task-status">
                <span className={`task-indicator ${agent.task_status}`}></span>
                {agent.task_status === 'active' ? 'In Progress' : agent.task_status}
              </div>
            )}
            <div className="inbox-row">
              <span className="inbox-count">
                Inbox: {agent.inbox_count} message{agent.inbox_count !== 1 ? 's' : ''}
              </span>
              <button
                className="btn-inbox-check"
                onClick={(e) => checkInbox(agent.id, agent.name, e)}
                disabled={inboxLoading !== null}
                title="View inbox"
              >
                {inboxLoading === agent.id ? <span className="spinner" /> : '📬'}
              </button>
            </div>
            {/* Fleet Inbox Check - CV2-Main only */}
            {agent.id === 'cv2-main' && (
              <div className="fleet-commands-section">
                <button
                  className="btn btn-fleet-inbox"
                  onClick={fleetInboxCheck}
                  disabled={fleetActionLoading !== null}
                  title="Trigger inbox check for all fleet agents"
                >
                  {fleetActionLoading === 'inbox' ? (
                    <span className="spinner" />
                  ) : (
                    '📬 Fleet Inbox Check'
                  )}
                </button>
                {fleetMessage && (
                  <div className={`fleet-message ${fleetMessage.type}`}>{fleetMessage.text}</div>
                )}
              </div>
            )}
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

      {inboxModal && (
        <div className="modal-overlay" onClick={() => setInboxModal(null)}>
          <div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{inboxModal.agentName} Inbox</h3>
              <button className="modal-close" onClick={() => setInboxModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {inboxModal.files.length === 0 ? (
                <p>No messages in inbox</p>
              ) : (
                <div className="inbox-list">
                  {inboxModal.files.map((file, idx) => (
                    <div key={idx} className="inbox-item">{file}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
