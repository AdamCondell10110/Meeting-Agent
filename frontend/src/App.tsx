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

  const analyse = async () => {
    setLoading(true)
    setError('')
    setAnalysis(null)

    try {
      const response = await fetch('https://meeting-agent-production-ba4f.up.railway.app/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })

      if (!response.ok) throw new Error('Something went wrong')

      const data = await response.json()
      setAnalysis(data)
    } catch {
      setError('Failed to analyse transcript. Is the backend running?')
    } finally {
      setLoading(false)
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
          Paste a meeting transcript and get instant analysis.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-white/10">
        <label htmlFor="transcript" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Meeting transcript
        </label>
        <textarea
          id="transcript"
          className="min-h-[220px] w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-sm text-zinc-800 placeholder:text-zinc-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400"
          placeholder="Paste your meeting transcript here..."
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
        />
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          {transcript.length > 0 ? `${transcript.length.toLocaleString()} characters` : 'No transcript yet'}
        </p>

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
        </div>
      )}
    </div>
  )
}

export default App
