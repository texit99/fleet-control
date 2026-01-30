import { useState, useEffect, useRef, useCallback } from 'react'

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

interface TerminalModal {
  agentId: string
  agentName: string
  content: string
  online: boolean
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
  const [terminalModal, setTerminalModal] = useState<TerminalModal | null>(null)
  const [terminalLoading, setTerminalLoading] = useState(false)
  const [mainMessage, setMainMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollingIntervalRef = useRef<number | null>(null)
  const terminalPollRef = useRef<number | null>(null)
  const terminalRef = useRef<HTMLPreElement | null>(null)

  const getApiKey = () => localStorage.getItem('cv_api_key') || ''

  // Terminal modal functions
  const fetchTerminal = useCallback(async (agentId: string, agentName: string) => {
    try {
      const res = await fetch(`/api/fleet/terminal/${agentId}`)
      const json = await res.json()
      if (res.ok && json.content) {
        setTerminalModal({
          agentId,
          agentName,
          content: json.content,
          online: json.online
        })
        // Auto-scroll to bottom
        setTimeout(() => {
          if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight
          }
        }, 50)
      } else if (!res.ok) {
        setTerminalModal({
          agentId,
          agentName,
          content: json.error || 'Failed to fetch terminal',
          online: false
        })
      }
    } catch (err) {
      console.error('Terminal fetch failed:', err)
    }
  }, [])

  const openTerminal = async (agent: Agent) => {
    if (agent.type === 'desktop' || agent.type === 'remote') {
      // Desktop/remote agents don't have tmux terminals
      return
    }
    setTerminalLoading(true)
    await fetchTerminal(agent.id, agent.name)
    setTerminalLoading(false)

    // Start polling while modal is open
    terminalPollRef.current = window.setInterval(() => {
      fetchTerminal(agent.id, agent.name)
    }, 2000)
  }

  const closeTerminal = () => {
    setTerminalModal(null)
    if (terminalPollRef.current) {
      clearInterval(terminalPollRef.current)
      terminalPollRef.current = null
    }
  }

  // Send message to Main
  const sendMessageToMain = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mainMessage.trim()) return

    setSendingMessage(true)
    try {
      const res = await fetch('/api/fleet/send-message/cv2-main', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': getApiKey(),
        },
        body: JSON.stringify({ message: mainMessage })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setMainMessage('')
      setFleetMessage({ type: 'success', text: 'Message sent to Main' })
      setTimeout(() => setFleetMessage(null), 2000)
    } catch (err) {
      setFleetMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setSendingMessage(false)
    }
  }

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
      eventSource.close()
      eventSourceRef.current = null
      setConnectionType('polling')
      startPolling()
    }

    eventSource.onopen = () => {
      setConnectionType('sse')
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
    startSSE()
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close()
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
      if (terminalPollRef.current) clearInterval(terminalPollRef.current)
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
            className={`agent-card ${agent.type !== 'desktop' && agent.type !== 'remote' ? 'clickable' : ''} ${agent.type === 'desktop' ? 'desktop-agent' : ''}`}
            onClick={() => agent.type !== 'desktop' && agent.type !== 'remote' && openTerminal(agent)}
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
              <div className="agent-header-buttons">
                {onAgentSelect && (
                  <button
                    className="btn-config"
                    onClick={(e) => { e.stopPropagation(); onAgentSelect(agent.id); }}
                    title="View identity documents"
                  >
                    ⚙️
                  </button>
                )}
                <span className={`status-badge ${agent.online ? 'online' : 'offline'}`}>
                  {agent.online ? (agent.type === 'desktop' ? 'Running' : 'Online') : (agent.type === 'desktop' ? 'Stopped' : 'Offline')}
                </span>
              </div>
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

            {/* CV2-Main special section */}
            {agent.id === 'cv2-main' && (
              <div className="main-commands-section">
                <form className="main-message-form" onSubmit={sendMessageToMain} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={mainMessage}
                    onChange={(e) => setMainMessage(e.target.value)}
                    placeholder="Send message to Main..."
                    className="main-message-input"
                    disabled={sendingMessage}
                  />
                  <button
                    type="submit"
                    className="btn-send-message"
                    disabled={sendingMessage || !mainMessage.trim()}
                  >
                    {sendingMessage ? <span className="spinner" /> : '➤'}
                  </button>
                </form>
                <button
                  className="btn btn-fleet-inbox"
                  onClick={fleetInboxCheck}
                  disabled={fleetActionLoading !== null}
                  title="Trigger inbox check for all fleet agents"
                >
                  {fleetActionLoading === 'inbox' ? <span className="spinner" /> : '📬 Fleet Inbox Check'}
                </button>
                {fleetMessage && (
                  <div className={`fleet-message ${fleetMessage.type}`}>{fleetMessage.text}</div>
                )}
              </div>
            )}

            {agent.type !== 'desktop' && agent.type !== 'remote' && (
              <div className="card-hint">Click to view terminal</div>
            )}
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

      {/* Terminal Modal */}
      {terminalModal && (
        <div className="modal-overlay" onClick={closeTerminal}>
          <div className="modal-content terminal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{terminalModal.agentName} Terminal</h3>
              <div className="terminal-header-actions">
                <button
                  className="btn-refresh"
                  onClick={() => fetchTerminal(terminalModal.agentId, terminalModal.agentName)}
                  title="Refresh"
                >
                  🔄
                </button>
                <span className={`status-badge ${terminalModal.online ? 'online' : 'offline'}`}>
                  {terminalModal.online ? 'Live' : 'Offline'}
                </span>
                <button className="modal-close" onClick={closeTerminal}>×</button>
              </div>
            </div>
            <div className="terminal-body">
              <pre ref={terminalRef} className="terminal-content">
                {terminalModal.content || 'No content'}
              </pre>
            </div>
            <div className="terminal-footer">
              <span className="terminal-hint">Auto-refreshes every 2s</span>
            </div>
          </div>
        </div>
      )}

      {/* Inbox Modal */}
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

      {terminalLoading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <span>Loading terminal...</span>
        </div>
      )}
    </div>
  )
}
