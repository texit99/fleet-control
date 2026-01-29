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

export default function FleetStatus() {
  const [data, setData] = useState<FleetStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
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
            <div className="inbox-count">
              Inbox: {agent.inbox_count} message{agent.inbox_count !== 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
