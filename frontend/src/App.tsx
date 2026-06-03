import { useState } from 'react'

interface ActionItem {
  owner: string
  task: string
  deadline: string
}

interface Analysis {
  summary: string
  action_items: ActionItem[]
  risks: string[]
  decisions: string[]
}

function App() {
  const [transcript, setTranscript] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const analyse = async () => {
    setLoading(true)
    setError('')
    setAnalysis(null)

    try {
      const response = await fetch('https://meeting-agent-production-ba4f.up.railway.app/analyse', { //http://127.0.0.1:8000/analyse
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })

      if (!response.ok) throw new Error('Something went wrong')

      const data = await response.json()
      setAnalysis(data)
    } catch (err) {
      setError('Failed to analyse transcript. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1>Meeting Intelligence Assistant</h1>
      <p style={{ color: '#666' }}>Paste a meeting transcript and get instant analysis.</p>

      <textarea
        style={{ width: '100%', height: '200px', padding: '12px', fontSize: '14px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
        placeholder="Paste your meeting transcript here..."
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
      />

      <button
        onClick={analyse}
        disabled={loading || !transcript}
        style={{ marginTop: '12px', padding: '12px 24px', background: '#0066ff', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' }}
      >
        {loading ? 'Analysing...' : 'Analyse Transcript'}
      </button>

      {error && <p style={{ color: 'red', marginTop: '12px' }}>{error}</p>}

      {analysis && (
        <div style={{ marginTop: '32px' }}>
          <h2>Summary</h2>
          <p>{analysis.summary}</p>

          <h2>Action Items</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Owner</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Task</th>
                <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Deadline</th>
              </tr>
            </thead>
            <tbody>
              {analysis.action_items.map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{item.owner}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{item.task}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{item.deadline || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Decisions</h2>
          <ul>{analysis.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul>

          <h2>Risks</h2>
          <ul>{analysis.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

export default App