import { useState, useEffect } from 'react'

interface Agent {
  id: string
  name: string
  online: boolean
  status: string
  inbox_count: number
}

interface FleetStatusResponse {
  agents: Agent[]
  online_count: number
  total_count: number
}

export default function FleetControl() {
  const [data, setData] = useState<FleetStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const getApiKey = () => localStorage.getItem('cv_api_key') || ''

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
                <div className="agent-id">{agent.id}</div>
              </div>
              <span className={`status-badge ${agent.online ? 'online' : 'offline'}`}>
                {agent.online ? 'Online' : 'Offline'}
              </span>
            </div>

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
          </div>
        ))}
      </div>

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
