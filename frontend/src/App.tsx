import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { exportToPdf } from './exportPdf'

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

type AnalysisMode = 'quick' | 'deep'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string }) => void
          }) => { requestAccessToken: () => void }
        }
      }
    }
  }
}

interface ComposeEmail {
  to: string
  subject: string
  body: string
}

const MODE_LABELS: Record<AnalysisMode, string> = {
  quick: 'Quick summary',
  deep: 'Deep analysis',
}

function Spinner() {
  return (
    <svg
      className="size-5 animate-spin text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-zinc-500 dark:text-zinc-500 italic">{message}</p>
}

function App() {
  const [transcript, setTranscript] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('deep')
  const [lastAnalysisMode, setLastAnalysisMode] = useState<AnalysisMode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState('')
  const [gmailToken, setGmailToken] = useState<string | null>(null)
  const [gmailUser, setGmailUser] = useState<string | null>(null)
  const [composeEmail, setComposeEmail] = useState<ComposeEmail | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSentSuccess, setEmailSentSuccess] = useState(false)
  const [emailError, setEmailError] = useState('')

  const resetFileInput = (input: HTMLInputElement) => {
    input.value = ''
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const lowerName = file.name.toLowerCase()

    if (lowerName.endsWith('.txt')) {
      const reader = new FileReader()
      reader.onerror = () => setError('Failed to read file.')
      reader.onload = (event) => {
        const text = event.target?.result
        if (typeof text !== 'string') return
        setTranscript(text)
        setUploadedFileName(file.name)
        setError('')
        resetFileInput(e.target)
      }
      reader.readAsText(file)
    } else if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
      const reader = new FileReader()
      reader.onerror = () => setError('Failed to read file.')
      reader.onload = async (event) => {
        const arrayBuffer = event.target?.result
        if (!(arrayBuffer instanceof ArrayBuffer)) return
        try {
          const mammoth = await import('mammoth')
          const result = await mammoth.extractRawText({ arrayBuffer })
          setTranscript(result.value)
          setUploadedFileName(file.name)
          setError('')
          resetFileInput(e.target)
        } catch {
          setError('Failed to read file.')
          resetFileInput(e.target)
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      setError('Unsupported file type. Please upload a .txt, .docx or .doc file.')
      resetFileInput(e.target)
    }
  }
  const analyse = async () => {
    setLoading(true)
    setError('')
    setAnalysis(null)
    setLastAnalysisMode(null)
    setMessages([])
    setChatError('')

    try {
      const response = await fetch('https://meeting-agent-production-ba4f.up.railway.app/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, mode: analysisMode }),
      })

      if (!response.ok) throw new Error('Something went wrong')

      const data = await response.json()
      setAnalysis(data)
      setLastAnalysisMode(analysisMode)
    } catch {
      setError('Failed to analyse transcript. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const parseEmailDraft = (content: string): { subject: string; body: string } => {
    const lines = content.split('\n')
    const subjectLine = lines.find((l) => l.toLowerCase().startsWith('subject:'))
    if (subjectLine) {
      const subject = subjectLine.replace(/^subject:\s*/i, '').trim()
      const body = lines.filter((l) => l !== subjectLine).join('\n').trimStart()
      return { subject, body }
    }
    return { subject: '', body: content }
  }

  const connectGmail = () => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
      scope: 'https://www.googleapis.com/auth/gmail.send email',
      callback: (response) => {
        if (!response.access_token) return
        setGmailToken(response.access_token)
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${response.access_token}` },
        })
          .then((r) => r.json())
          .then((info: { email?: string }) => setGmailUser(info.email ?? null))
      },
    })
    tokenClient.requestAccessToken()
  }

  const buildMimeMessage = (to: string, subject: string, body: string, from: string): string => {
    const message = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n')
    const bytes = new TextEncoder().encode(message)
    const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }

  const sendViaGmail = async () => {
    if (!composeEmail || !gmailToken || !gmailUser) return
    setSendingEmail(true)
    setEmailError('')
    try {
      const raw = buildMimeMessage(composeEmail.to, composeEmail.subject, composeEmail.body, gmailUser)
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gmailToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      })
      if (response.status === 401) {
        setGmailToken(null)
        throw new Error('Gmail session expired — please reconnect.')
      }
      if (!response.ok) {
        const err = await response.json() as { error?: { message?: string } }
        throw new Error(err.error?.message ?? 'Failed to send email')
      }
      setEmailSentSuccess(true)
      setTimeout(() => setComposeEmail(null), 2000)
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : 'Failed to send email')
    } finally {
      setSendingEmail(false)
    }
  }

  const sendMessage = async () => {
    const text = chatInput.trim()
    if (!text || chatLoading || !analysis) return

    const userMsg: Message = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setChatInput('')
    setChatLoading(true)
    setChatError('')

    try {
      const response = await fetch('https://meeting-agent-production-ba4f.up.railway.app/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, analysis, messages: nextMessages }),
      })
      if (!response.ok) throw new Error('Something went wrong')
      const data = await response.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch {
      setChatError('Failed to get a response. Please try again.')
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <header className="mb-10 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-600/10 ring-1 ring-brand-500/30">
          <img src="/favicon.svg" alt="" className="size-8" aria-hidden />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Meeting Intelligence Assistant
        </h1>
        <p className="mt-2 text-base text-zinc-500 dark:text-zinc-400">
          Paste a transcript or upload a file and get instant analysis.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-white/10">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="transcript" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Meeting transcript
          </label>
          <input
            ref={fileInputRef}
            id="transcript-file"
            type="file"
            accept=".txt,.doc,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Upload file
          </button>
        </div>
        <textarea
          id="transcript"
          className="min-h-[220px] w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-sm text-zinc-800 placeholder:text-zinc-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400"
          placeholder="Paste your meeting transcript here..."
          value={transcript}
          onChange={(e) => {
            setTranscript(e.target.value)
            setUploadedFileName(null)
          }}
        />
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          {uploadedFileName
            ? `Loaded: ${uploadedFileName} · ${transcript.length.toLocaleString()} characters`
            : transcript.length > 0
              ? `${transcript.length.toLocaleString()} characters`
              : 'No transcript yet · Supports .txt, .docx, .doc'}
        </p>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Analysis mode</p>
          <div
            className="inline-flex w-full rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800 sm:w-auto"
            role="group"
            aria-label="Analysis mode"
          >
            {(['quick', 'deep'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={analysisMode === mode}
                onClick={() => setAnalysisMode(mode)}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
                  analysisMode === mode
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {MODE_LABELS[mode]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
            {analysisMode === 'quick'
              ? 'Summary only — faster.'
              : 'Full breakdown with action items, decisions, and risks.'}
          </p>
        </div>

        <button
          type="button"
          onClick={analyse}
          disabled={loading || !transcript.trim()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-zinc-900 sm:w-auto"
        >
          {loading ? (
            <>
              <Spinner />
              Analysing...
            </>
          ) : (
            'Analyse Transcript'
          )}
        </button>
      </section>

      {gmailToken ? (
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <span className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {gmailUser ?? 'Gmail connected'}
          </span>
          <button
            type="button"
            onClick={() => { setGmailToken(null); setGmailUser(null) }}
            className="text-sm text-emerald-600 underline hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-5 py-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Connect Gmail to send follow-up emails
          </span>
          <button
            type="button"
            onClick={connectGmail}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
          >
            Connect Gmail
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200"
        >
          <svg className="mt-0.5 size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {analysis && (
        <div className="mt-10 space-y-6 opacity-0 animate-[fadeIn_0.4s_ease-out_forwards]">
          <div className="flex items-center justify-between gap-3">
            {lastAnalysisMode && (
              <span className="inline-block rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-700 dark:text-brand-300">
                {MODE_LABELS[lastAnalysisMode]}
              </span>
            )}
            <button
              type="button"
              onClick={() => exportToPdf(analysis!, lastAnalysisMode!)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export PDF
            </button>
          </div>
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              Summary
            </h2>
            <p className="text-lg leading-relaxed text-zinc-800 dark:text-zinc-100">{analysis.summary}</p>
          </section>

          {lastAnalysisMode === 'deep' && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </span>
              Action Items
            </h2>
            {analysis.action_items.length > 0 ? (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                      <th className="pb-3 pr-4 font-semibold text-zinc-600 dark:text-zinc-400">Owner</th>
                      <th className="pb-3 pr-4 font-semibold text-zinc-600 dark:text-zinc-400">Task</th>
                      <th className="pb-3 font-semibold text-zinc-600 dark:text-zinc-400">Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.action_items.map((item, i) => (
                      <tr
                        key={i}
                        className="border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                      >
                        <td className="py-3 pr-4 align-top">
                          <span className="inline-block rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-300">
                            {item.owner}
                          </span>
                        </td>
                        <td className="py-3 pr-4 align-top text-zinc-800 dark:text-zinc-200">{item.task}</td>
                        <td className="py-3 align-top text-zinc-500 dark:text-zinc-400">
                          {item.deadline || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No action items identified." />
            )}
          </section>
          )}

          {lastAnalysisMode === 'deep' && (
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                Decisions
              </h2>
              {analysis.decisions.length > 0 ? (
                <ul className="space-y-3">
                  {analysis.decisions.map((d, i) => (
                    <li
                      key={i}
                      className="border-l-2 border-emerald-500/60 pl-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
                    >
                      {d}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState message="No decisions recorded." />
              )}
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </span>
                Risks
              </h2>
              {analysis.risks.length > 0 ? (
                <ul className="space-y-3">
                  {analysis.risks.map((r, i) => (
                    <li
                      key={i}
                      className="border-l-2 border-amber-500/60 pl-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState message="No risks flagged." />
              )}
            </section>
          </div>
          )}

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </span>
              Ask a follow-up question
            </h2>

            {messages.length > 0 && (
              <div className="mb-4 max-h-96 space-y-3 overflow-y-auto pr-1">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col opacity-0 animate-[fadeIn_0.3s_ease-out_forwards] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'rounded-br-sm bg-brand-600 text-white'
                          : 'rounded-bl-sm bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>,
                            ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 last:mb-0">{children}</ol>,
                            li: ({ children }) => <li className="mb-0.5">{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        msg.content
                      )}
                    </div>
                    {msg.role === 'assistant' && (
                      <button
                        type="button"
                        onClick={() => {
                          const { subject, body } = parseEmailDraft(msg.content)
                          setComposeEmail({ to: '', subject, body })
                          setEmailSentSuccess(false)
                          setEmailError('')
                        }}
                        className="mt-1 flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Send as email
                      </button>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
                      <div className="flex gap-1">
                        <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}

            {chatError && (
              <div
                role="alert"
                className="mb-3 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200"
              >
                <p className="text-sm font-medium">{chatError}</p>
              </div>
            )}

            <div className="flex gap-2">
              <textarea
                rows={1}
                className="min-h-[42px] flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400"
                placeholder="Ask anything about this meeting…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-zinc-900"
              >
                {chatLoading ? <Spinner /> : (
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">Press Enter to send · Shift+Enter for a new line</p>
          </section>
        </div>
      )}
      {composeEmail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setComposeEmail(null) }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Send Email</h2>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">To</label>
                <input
                  type="email"
                  placeholder="recipient@example.com"
                  value={composeEmail.to}
                  onChange={(e) => setComposeEmail((c) => c ? { ...c, to: e.target.value } : null)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Subject</label>
                <input
                  type="text"
                  placeholder="Subject"
                  value={composeEmail.subject}
                  onChange={(e) => setComposeEmail((c) => c ? { ...c, subject: e.target.value } : null)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Body</label>
                <textarea
                  rows={10}
                  value={composeEmail.body}
                  onChange={(e) => setComposeEmail((c) => c ? { ...c, body: e.target.value } : null)}
                  className="w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
            </div>

            {emailError && (
              <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200">
                {emailError}
              </div>
            )}

            {emailSentSuccess && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-200">
                Email sent successfully!
              </div>
            )}

            {!gmailToken && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                Connect Gmail above to enable sending.
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setComposeEmail(null)}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendViaGmail}
                disabled={sendingEmail || !(composeEmail?.to.trim()) || !gmailToken}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingEmail ? <><Spinner /> Sending…</> : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
