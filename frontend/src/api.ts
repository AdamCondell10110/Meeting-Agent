import type { Analysis, AnalysisMode, Message } from './types'

export async function analyseTranscript(transcript: string, mode: AnalysisMode): Promise<Analysis> {
  const response = await fetch('https://meeting-agent-production-ba4f.up.railway.app/analyse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, mode }),
  })
  if (!response.ok) throw new Error('Something went wrong')
  return response.json()
}

export async function sendChatMessage(
  transcript: string,
  analysis: Analysis,
  messages: Message[]
): Promise<string> {
  const response = await fetch('https://meeting-agent-production-ba4f.up.railway.app/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, analysis, messages }),
  })
  if (!response.ok) throw new Error('Something went wrong')
  const data = await response.json()
  return data.reply
}

function buildMimeMessage(to: string, subject: string, body: string, from: string): string {
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
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sendGmailMessage(
  to: string,
  subject: string,
  body: string,
  from: string,
  token: string
): Promise<void> {
  const raw = buildMimeMessage(to, subject, body, from)
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })
  if (response.status === 401) throw new Error('GMAIL_AUTH_EXPIRED')
  if (!response.ok) {
    const err = await response.json() as { error?: { message?: string } }
    throw new Error(err.error?.message ?? 'Failed to send email')
  }
}

export function connectGmail(onSuccess: (token: string, email: string | null) => void): void {
  const tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
    scope: 'https://www.googleapis.com/auth/gmail.send email',
    callback: async (response) => {
      if (!response.access_token) return
      const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${response.access_token}` },
      }).then((r) => r.json()) as { email?: string }
      onSuccess(response.access_token, info.email ?? null)
    },
  })
  tokenClient.requestAccessToken()
}
