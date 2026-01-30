import { useState, useEffect } from 'react'
import { formatAgentId } from '../utils/formatAgentId'

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

interface ModalData {
  title: string
  instruction: string
  command: string
}


export default function FleetControl() {
  const [data, setData] = useState<FleetStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [modal, setModal] = useState<ModalData | null>(null)
  const [copied, setCopied] = useState(false)
  const [mainMessage, setMainMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  const getApiKey = () => localStorage.getItem('cv_api_key') || ''

  const sendMessageToMain = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mainMessage.trim()) return

    const apiKey = getApiKey()
    if (!apiKey) {
      setMessage({ type: 'error', text: 'API key required. Enter it below.' })
      return
    }

    setSendingMessage(true)
    try {
      const res = await fetch('/api/fleet/send-message/cv2-main', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({ message: mainMessage })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setMainMessage('')
      setMessage({ type: 'success', text: 'Message sent to Main' })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setSendingMessage(false)
    }
  }

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/fleet/status')
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setData(json)
    } catch {
      // Silent fail on refresh
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const doAction = async (endpoint: string, label: string) => {
    setActionLoading(endpoint)
    setMessage(null)

    try {
      const res = await fetch(`/api${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': getApiKey(),
        },
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Action failed')
      }

      setMessage({ type: 'success', text: `${label}: ${json.status}` })
      await fetchStatus()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Action failed' })
    } finally {
      setActionLoading(null)
    }
  }

  const launchAgent = (agentId: string) => doAction(`/fleet/launch/${agentId}`, `Launch ${agentId}`)
  const killAgent = (agentId: string) => doAction(`/fleet/kill/${agentId}`, `Kill ${agentId}`)
  const restartAgent = (agentId: string) => doAction(`/fleet/restart/${agentId}`, `Restart ${agentId}`)
  const launchAll = () => doAction('/fleet/launch-all', 'Launch All')
  const killAll = () => doAction('/fleet/kill-all', 'Kill All')

  // Context management actions
  const doContextAction = async (endpoint: string, label: string) => {
    setActionLoading(endpoint)
    setMessage(null)

    try {
      const res = await fetch(`/api${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': getApiKey(),
        },
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Action failed')
      }

      // Check if response is a modal (for cv2-app)
      if (json.status === 'modal' && json.modal) {
        setModal(json.modal)
        setCopied(false)
      } else {
        setMessage({ type: 'success', text: `${label}: ${json.status}` })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Action failed' })
    } finally {
      setActionLoading(null)
    }
  }

  const saveContext = (agentId: string) => doContextAction(`/fleet/context/save/${agentId}`, `Save ${agentId}`)
  const pullContext = (agentId: string) => doContextAction(`/fleet/context/pull/${agentId}`, `Pull ${agentId}`)
  const nudgeAgent = (agentId: string) => doContextAction(`/fleet/context/nudge/${agentId}`, `Nudge ${agentId}`)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const closeModal = () => {
    setModal(null)
    setCopied(false)
  }

  const checkInbox = (agentId: string) => doContextAction(`/fleet/context/inbox/${agentId}`, `Inbox ${agentId}`)
  const fleetInboxCheck = () => doContextAction('/fleet/inbox-check-all', 'Fleet Inbox Check')
  const fleetSaveAll = () => doContextAction('/fleet/save-all', 'Fleet Save')
  const fleetPullAll = () => doContextAction('/fleet/pull-all', 'Fleet Pull')

  if (loading && !data) {
    return <div>Loading...</div>
  }

  return (
    <div>
      {message && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      <div className="bulk-actions">
        <h3>Bulk Actions</h3>
        <button
          className="btn btn-success"
          onClick={launchAll}
          disabled={actionLoading !== null}
        >
          {actionLoading === '/fleet/launch-all' ? <span className="spinner" /> : 'Launch All'}
        </button>
        <button
          className="btn btn-danger"
          onClick={killAll}
          disabled={actionLoading !== null}
        >
          {actionLoading === '/fleet/kill-all' ? <span className="spinner" /> : 'Kill All'}
        </button>
      </div>

      <div className="agent-grid">
        {data?.agents.map((agent) => (
          <div key={agent.id} className="agent-card">
            <div className="agent-header">
              <div>
                <div className="agent-name">{agent.name}</div>
                <div className="agent-id">{formatAgentId(agent.id)}</div>
              </div>
              <span className={`status-badge ${agent.online ? 'online' : 'offline'}`}>
                {agent.online ? 'Online' : 'Offline'}
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

            <div className="control-buttons">
              {!agent.online ? (
                <button
                  className="btn btn-success"
                  onClick={() => launchAgent(agent.id)}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === `/fleet/launch/${agent.id}` ? (
                    <span className="spinner" />
                  ) : (
                    'Launch'
                  )}
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-danger"
                    onClick={() => killAgent(agent.id)}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === `/fleet/kill/${agent.id}` ? (
                      <span className="spinner" />
                    ) : (
                      'Kill'
                    )}
                  </button>
                  <button
                    className="btn btn-warning"
                    onClick={() => restartAgent(agent.id)}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === `/fleet/restart/${agent.id}` ? (
                      <span className="spinner" />
                    ) : (
                      'Restart'
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Context Management Buttons */}
            <div className="context-buttons">
              <button
                className="btn btn-context btn-save"
                onClick={() => saveContext(agent.id)}
                disabled={actionLoading !== null || (!agent.online && agent.type !== 'desktop')}
                title="Save context checkpoint"
              >
                {actionLoading === `/fleet/context/save/${agent.id}` ? (
                  <span className="spinner" />
                ) : (
                  '💾 Save'
                )}
              </button>
              <button
                className="btn btn-context btn-pull"
                onClick={() => pullContext(agent.id)}
                disabled={actionLoading !== null || (!agent.online && agent.type !== 'desktop')}
                title="Pull recent context"
              >
                {actionLoading === `/fleet/context/pull/${agent.id}` ? (
                  <span className="spinner" />
                ) : (
                  '📥 Pull'
                )}
              </button>
              <button
                className="btn btn-context btn-nudge"
                onClick={() => nudgeAgent(agent.id)}
                disabled={actionLoading !== null || (!agent.online && agent.type !== 'desktop')}
                title="Send recovery prompt"
              >
                {actionLoading === `/fleet/context/nudge/${agent.id}` ? (
                  <span className="spinner" />
                ) : (
                  '🔔 Nudge'
                )}
              </button>
              <button
                className="btn btn-context btn-inbox"
                onClick={() => checkInbox(agent.id)}
                disabled={actionLoading !== null || (!agent.online && agent.type !== 'desktop')}
                title="Pull DB inbox"
              >
                {actionLoading === `/fleet/context/inbox/${agent.id}` ? (
                  <span className="spinner" />
                ) : (
                  '📬 Inbox'
                )}
              </button>
            </div>

            {/* Fleet-wide commands - CV2-Main only */}
            {agent.id === 'cv2-main' && (
              <div className="fleet-commands-section">
                <form className="main-message-form" onSubmit={sendMessageToMain}>
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
                <div className="fleet-commands-row">
                  <button
                    className="btn btn-fleet-cmd btn-fleet-save"
                    onClick={fleetSaveAll}
                    disabled={actionLoading !== null}
                    title="Save context for all fleet agents"
                  >
                    {actionLoading === '/fleet/save-all' ? (
                      <span className="spinner" />
                    ) : (
                      '💾 Fleet Save'
                    )}
                  </button>
                  <button
                    className="btn btn-fleet-cmd btn-fleet-pull"
                    onClick={fleetPullAll}
                    disabled={actionLoading !== null}
                    title="Pull context for all fleet agents"
                  >
                    {actionLoading === '/fleet/pull-all' ? (
                      <span className="spinner" />
                    ) : (
                      '📥 Fleet Pull'
                    )}
                  </button>
                </div>
                <button
                  className="btn btn-fleet-inbox"
                  onClick={fleetInboxCheck}
                  disabled={actionLoading !== null}
                  title="Check inbox for all fleet agents"
                >
                  {actionLoading === '/fleet/inbox-check-all' ? (
                    <span className="spinner" />
                  ) : (
                    '📬 Fleet Inbox Check'
                  )}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal for CV2-App copy/paste commands */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.title}</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <p>{modal.instruction}</p>
              <pre className="modal-command">{modal.command}</pre>
              <button
                className={`btn ${copied ? 'btn-success' : 'btn-primary'}`}
                onClick={() => copyToClipboard(modal.command)}
              >
                {copied ? '✓ Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        </div>
      )}


      <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
        <h4 style={{ marginBottom: '0.5rem' }}>API Key</h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          Control actions require an API key. Store it below (saved to localStorage).
        </p>
        <input
          type="password"
          placeholder="Enter API key"
          defaultValue={getApiKey()}
          onChange={(e) => localStorage.setItem('cv_api_key', e.target.value)}
          style={{
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            width: '300px',
          }}
        />
      </div>
    </div>
  )
}
