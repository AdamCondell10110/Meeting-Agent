interface Props {
  gmailToken: string | null
  gmailUser: string | null
  onConnect: () => void
  onDisconnect: () => void
}

export function GmailBanner({ gmailToken, gmailUser, onConnect, onDisconnect }: Props) {
  if (gmailToken) {
    return (
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
        <span className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {gmailUser ?? 'Gmail connected'}
        </span>
        <button
          type="button"
          onClick={onDisconnect}
          className="text-sm text-emerald-600 underline hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-5 py-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <span className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Connect Gmail to send follow-up emails
      </span>
      <button
        type="button"
        onClick={onConnect}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
      >
        Connect Gmail
      </button>
    </div>
  )
}
