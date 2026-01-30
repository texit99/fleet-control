import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Doc {
  name: string
  label: string
  exists: boolean
}

interface AgentDetailProps {
  agentId: string
  onBack: () => void
}

export default function AgentDetail({ agentId, onBack }: AgentDetailProps) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const [docContent, setDocContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [contentLoading, setContentLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch available docs for this agent
  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await fetch(`/api/agent/${agentId}/docs`)
        if (!res.ok) throw new Error('Failed to fetch agent docs')
        const json = await res.json()
        setDocs(json.docs)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchDocs()
  }, [agentId])

  // Fetch doc content when selected
  const handleDocSelect = async (docName: string) => {
    setSelectedDoc(docName)
    setContentLoading(true)
    try {
      const res = await fetch(`/api/agent/${agentId}/doc/${docName}`)
      if (!res.ok) throw new Error('Failed to fetch document')
      const json = await res.json()
      setDocContent(json.content)
    } catch (err) {
      setDocContent(`Error loading document: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setContentLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading agent details...</div>
  }

  if (error) {
    return (
      <div>
        <button className="btn btn-secondary back-btn" onClick={onBack}>
          ← Back to Status
        </button>
        <div className="message error">{error}</div>
      </div>
    )
  }

  const agentName = agentId.replace('cv2-', '').replace(/-/g, ' ')

  return (
    <div className="agent-detail">
      <div className="agent-detail-header">
        <button className="btn btn-secondary back-btn" onClick={onBack}>
          ← Back
        </button>
        <h2>{agentName.charAt(0).toUpperCase() + agentName.slice(1)}</h2>
        <span className="agent-detail-id">{agentId}</span>
      </div>

      <div className="agent-detail-layout">
        {/* Left side: Document buttons */}
        <div className="doc-buttons">
          <h3>Identity Documents</h3>
          <div className="doc-button-list">
            {docs.map((doc) => (
              <button
                key={doc.name}
                className={`doc-btn ${selectedDoc === doc.name ? 'active' : ''} ${!doc.exists ? 'disabled' : ''}`}
                onClick={() => doc.exists && handleDocSelect(doc.name)}
                disabled={!doc.exists}
              >
                <span className="doc-btn-label">{doc.label}</span>
                <span className="doc-btn-name">{doc.name}</span>
                {!doc.exists && <span className="doc-btn-missing">Not Found</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Right side: Document viewer */}
        <div className="doc-viewer">
          {selectedDoc ? (
            <>
              <div className="doc-viewer-header">
                <h3>{docs.find(d => d.name === selectedDoc)?.label || selectedDoc}</h3>
                <span className="doc-filename">{selectedDoc}</span>
              </div>
              <div className="doc-content markdown-body">
                {contentLoading ? (
                  <div className="loading">Loading document...</div>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{docContent}</ReactMarkdown>
                )}
              </div>
            </>
          ) : (
            <div className="doc-placeholder">
              <p>Select a document from the left panel to view its contents</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
