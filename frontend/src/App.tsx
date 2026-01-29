import { useState } from 'react'
import FleetStatus from './components/FleetStatus'
import FleetControl from './components/FleetControl'
import DBViewer from './components/DBViewer'
import AgentDetail from './components/AgentDetail'
import './App.css'

type Tab = 'status' | 'control' | 'db'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('status')
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)

  const handleAgentSelect = (agentId: string) => {
    setSelectedAgent(agentId)
  }

  const handleBackToStatus = () => {
    setSelectedAgent(null)
  }

  // If an agent is selected, show agent detail view
  if (selectedAgent) {
    return (
      <div className="app">
        <header className="header">
          <h1>Fleet Control</h1>
          <nav className="tabs">
            <button className="active">Agent Details</button>
          </nav>
        </header>
        <main className="content">
          <AgentDetail agentId={selectedAgent} onBack={handleBackToStatus} />
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Fleet Control</h1>
        <nav className="tabs">
          <button
            className={activeTab === 'status' ? 'active' : ''}
            onClick={() => setActiveTab('status')}
          >
            Status
          </button>
          <button
            className={activeTab === 'control' ? 'active' : ''}
            onClick={() => setActiveTab('control')}
          >
            Control
          </button>
          <button
            className={activeTab === 'db' ? 'active' : ''}
            onClick={() => setActiveTab('db')}
          >
            Memory DB
          </button>
        </nav>
      </header>

      <main className="content">
        {activeTab === 'status' && <FleetStatus onAgentSelect={handleAgentSelect} />}
        {activeTab === 'control' && <FleetControl />}
        {activeTab === 'db' && <DBViewer />}
      </main>
    </div>
  )
}

export default App
