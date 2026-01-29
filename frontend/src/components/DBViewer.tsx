import { useState } from 'react'

interface MemoryEntry {
  id: number
  agent: string
  category: string
  content: string
  timestamp: string
  similarity?: number
}

export default function DBViewer() {
  const [query, setQuery] = useState('')
  const [agent, setAgent] = useState('all')
  const [results, setResults] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'search' | 'recent'>('recent')

  const agents = [
    'all',
    'cv2-main',
    'cv2-ops',
    'cv2-ops2',
    'cv2-research',
    'cv2-it',
    'cv2-critic',
    'cv2-ui',
  ]

  const fetchRecent = async () => {
    setLoading(true)
    setError(null)
    setMode('recent')

    try {
      const agentParam = agent === 'all' ? '' : agent
      const res = await fetch(`/api/db/recent?agent=${agentParam}&limit=20`)

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to fetch')
      }

      const json = await res.json()
      setResults(json.entries || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recent entries')
    } finally {
      setLoading(false)
    }
  }

  const doSearch = async () => {
    if (!query.trim()) {
      fetchRecent()
      return
    }

    setLoading(true)
    setError(null)
    setMode('search')

    try {
      const agentParam = agent === 'all' ? '' : agent
      const res = await fetch(`/api/db/search?q=${encodeURIComponent(query)}&agent=${agentParam}&limit=20`)

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Search failed')
      }

      const json = await res.json()
      setResults(json.entries || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      doSearch()
    }
  }

  return (
    <div className="db-viewer">
      <div className="search-bar">
        <select
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          style={{
            padding: '0.75rem',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            minWidth: '150px',
          }}
        >
          {agents.map((a) => (
            <option key={a} value={a}>
              {a === 'all' ? 'All Agents' : a}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search memory (or leave empty for recent)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
        />

        <button className="btn btn-primary" onClick={doSearch} disabled={loading}>
          {loading ? <span className="spinner" /> : 'Search'}
        </button>

        <button className="btn btn-secondary" onClick={fetchRecent} disabled={loading}>
          Recent
        </button>
      </div>

      {error && <div className="message error">{error}</div>}

      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        {mode === 'search' && query ? `Search results for "${query}"` : 'Recent entries'}
        {results.length > 0 && ` (${results.length})`}
      </div>

      <div className="memory-list">
        {results.length === 0 && !loading && (
          <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>
            {mode === 'search' ? 'No results found. Try a different search term.' : 'No entries yet. Click "Recent" to load.'}
          </div>
        )}

        {results.map((entry, idx) => (
          <div key={entry.id || idx} className="memory-entry">
            <div className="memory-header">
              <span>
                <strong>{entry.agent}</strong> | {entry.category}
                {entry.similarity !== undefined && (
                  <span style={{ marginLeft: '0.5rem', color: 'var(--accent)' }}>
                    ({(entry.similarity * 100).toFixed(1)}% match)
                  </span>
                )}
              </span>
              <span>{new Date(entry.timestamp).toLocaleString()}</span>
            </div>
            <div className="memory-content">
              {entry.content.length > 500
                ? entry.content.substring(0, 500) + '...'
                : entry.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
