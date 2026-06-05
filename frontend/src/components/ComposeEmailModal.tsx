import { useState } from 'react'
import { sendGmailMessage } from '../api'
import type { ComposeEmail } from '../types'
import { Spinner } from './Spinner'

interface Props {
  composeEmail: ComposeEmail
  gmailToken: string | null
  gmailUser: string | null
  onClose: () => void
  onTokenExpired: () => void
}

export function ComposeEmailModal({ composeEmail: initial, gmailToken, gmailUser, onClose, onTokenExpired }: Props) {
  const [draft, setDraft] = useState(initial)
  const [sending, setSending] = useState(false)
  const [sentSuccess, setSentSuccess] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    if (!gmailToken || !gmailUser) return
    setSending(true)
    setError('')
    try {
      await sendGmailMessage(draft.to, draft.subject, draft.body, gmailUser, gmailToken)
      setSentSuccess(true)
      setTimeout(onClose, 2000)
    } catch (e) {
      if (e instanceof Error && e.message === 'GMAIL_AUTH_EXPIRED') {
        onTokenExpired()
        setError('Gmail session expired — please reconnect.')
      } else {
        setError(e instanceof Error ? e.message : 'Failed to send email')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Send Email</h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">To</label>
            <input
              type="email"
              placeholder="recipient@example.com"
              value={draft.to}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Subject</label>
            <input
              type="text"
              placeholder="Subject"
              value={draft.subject}
              onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Body</label>
            <textarea
              rows={10}
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              className="w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200">
            {error}
          </div>
        )}

        {sentSuccess && (
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
            onClick={onClose}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending || !draft.to.trim() || !gmailToken}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <><Spinner /> Sending…</> : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
