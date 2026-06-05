import { exportToPdf } from '../exportPdf'
import type { Analysis, AnalysisMode } from '../types'
import { MODE_LABELS } from '../types'

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm italic text-zinc-500 dark:text-zinc-500">{message}</p>
}

interface Props {
  analysis: Analysis
  lastAnalysisMode: AnalysisMode
}

export function AnalysisResults({ analysis, lastAnalysisMode }: Props) {
  return (
    <div className="mt-10 space-y-6 opacity-0 animate-[fadeIn_0.4s_ease-out_forwards]">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-block rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-700 dark:text-brand-300">
          {MODE_LABELS[lastAnalysisMode]}
        </span>
        <button
          type="button"
          onClick={() => exportToPdf(analysis, lastAnalysisMode)}
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
            <div className="-mx-2 overflow-x-auto px-2">
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
                    <tr key={i} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
                      <td className="py-3 pr-4 align-top">
                        <span className="inline-block rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-300">
                          {item.owner}
                        </span>
                      </td>
                      <td className="py-3 pr-4 align-top text-zinc-800 dark:text-zinc-200">{item.task}</td>
                      <td className="py-3 align-top text-zinc-500 dark:text-zinc-400">{item.deadline || '—'}</td>
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
                  <li key={i} className="border-l-2 border-emerald-500/60 pl-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{d}</li>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
              Risks
            </h2>
            {analysis.risks.length > 0 ? (
              <ul className="space-y-3">
                {analysis.risks.map((r, i) => (
                  <li key={i} className="border-l-2 border-amber-500/60 pl-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{r}</li>
                ))}
              </ul>
            ) : (
              <EmptyState message="No risks flagged." />
            )}
          </section>
        </div>
      )}
    </div>
  )
}
