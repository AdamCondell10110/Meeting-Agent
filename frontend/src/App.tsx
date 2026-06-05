import { useState } from 'react'
import { analyseTranscript, connectGmail } from './api'
import { AnalysisResults } from './components/AnalysisResults'
import { ChatPanel } from './components/ChatPanel'
import { ComposeEmailModal } from './components/ComposeEmailModal'
import { GmailBanner } from './components/GmailBanner'
import { TranscriptInput } from './components/TranscriptInput'
import type { Analysis, AnalysisMode, ComposeEmail } from './types'

function App() {
  const [transcript, setTranscript] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('deep')
  const [lastAnalysisMode, setLastAnalysisMode] = useState<AnalysisMode | null>(null)
  const [gmailToken, setGmailToken] = useState<string | null>(null)
  const [gmailUser, setGmailUser] = useState<string | null>(null)
  const [composeEmail, setComposeEmail] = useState<ComposeEmail | null>(null)

  const handleAnalyse = async () => {
    setLoading(true)
    setError('')
    setAnalysis(null)
    setLastAnalysisMode(null)
    try {
      const data = await analyseTranscript(transcript, analysisMode)
      setAnalysis(data)
      setLastAnalysisMode(analysisMode)
    } catch {
      setError('Failed to analyse transcript. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const handleGmailConnect = () => {
    connectGmail((token, email) => {
      setGmailToken(token)
      setGmailUser(email)
    })
  }

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <header className="mb-10 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-600/10 ring-1 ring-brand-500/30">
          <img src="/logo.svg" alt="" className="size-8" aria-hidden />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Meeting Summary Agent
        </h1>
        <p className="mt-2 text-base text-zinc-500 dark:text-zinc-400">
          Paste a transcript or upload a file and get instant analysis.
        </p>
      </header>

      <TranscriptInput
        transcript={transcript}
        onTranscriptChange={(val) => { setTranscript(val); setUploadedFileName(null) }}
        analysisMode={analysisMode}
        onAnalysisModeChange={setAnalysisMode}
        loading={loading}
        uploadedFileName={uploadedFileName}
        onFileLoaded={(text, name) => { setTranscript(text); setUploadedFileName(name); setError('') }}
        onFileError={setError}
        onAnalyse={handleAnalyse}
      />

      <GmailBanner
        gmailToken={gmailToken}
        gmailUser={gmailUser}
        onConnect={handleGmailConnect}
        onDisconnect={() => { setGmailToken(null); setGmailUser(null) }}
      />

      {error && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200"
        >
          <svg className="mt-0.5 size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {analysis && lastAnalysisMode && (
        <>
          <AnalysisResults analysis={analysis} lastAnalysisMode={lastAnalysisMode} />
          <div className="mt-6">
            <ChatPanel
              transcript={transcript}
              analysis={analysis}
              onSendAsEmail={(subject, body) => setComposeEmail({ to: '', subject, body })}
            />
          </div>
        </>
      )}

      {composeEmail && (
        <ComposeEmailModal
          composeEmail={composeEmail}
          gmailToken={gmailToken}
          gmailUser={gmailUser}
          onClose={() => setComposeEmail(null)}
          onTokenExpired={() => setGmailToken(null)}
        />
      )}
    </div>
  )
}

export default App
