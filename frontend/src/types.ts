export interface ActionItem {
  owner: string
  task: string
  deadline: string
}

export interface Analysis {
  summary: string
  action_items: ActionItem[]
  risks: string[]
  decisions: string[]
}

export type AnalysisMode = 'quick' | 'deep'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface ComposeEmail {
  to: string
  subject: string
  body: string
}

export const MODE_LABELS: Record<AnalysisMode, string> = {
  quick: 'Quick summary',
  deep: 'Deep analysis',
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
