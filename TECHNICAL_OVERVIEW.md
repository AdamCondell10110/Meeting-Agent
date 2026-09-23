# Meeting Intelligence Assistant — Technical Deep Dive

---

## Table of Contents
1. [Architecture & Request Flow](#1-architecture--request-flow)
2. [Frontend Entry Point — `index.html` & `main.tsx`](#2-frontend-entry-point)
3. [Build Tooling — `vite.config.ts` & `tsconfig.app.json`](#3-build-tooling)
4. [Styling — `index.css`](#4-styling--indexcss)
5. [Types & Shared Interfaces — `types.ts`](#5-types--shared-interfaces--typests)
6. [API Layer — `api.ts`](#6-api-layer--apits)
7. [Root Component — `App.tsx`](#7-root-component--apptsx)
8. [Components](#8-components)
   - 8a. [TranscriptInput.tsx](#8a-transcriptinputtsx)
   - 8b. [GmailBanner.tsx](#8b-gmailbannertsx)
   - 8c. [AnalysisResults.tsx](#8c-analysisresultstsx)
   - 8d. [ChatPanel.tsx](#8d-chatpaneltsx)
   - 8e. [ComposeEmailModal.tsx](#8e-composeemailtsx)
   - 8f. [Spinner.tsx](#8f-spinnertsx)
9. [PDF Export — `exportPdf.ts`](#9-pdf-export--exportpdfts)
10. [Backend](#10-backend)
    - 10a. [main.py](#10a-mainpy)
    - 10b. [ai_client.py](#10b-ai_clientpy)
    - 10c. [models.py](#10c-modelspy)
    - 10d. [routes/analyse.py](#10d-routesanalysepy)
    - 10e. [routes/chat.py](#10e-routeschatpy)

**Features covered:** transcript analysis (quick & deep modes), file upload (.txt/.docx), export to PDF, multi-turn follow-up chat, send emails via Gmail API.

---

## 1. Architecture & Request Flow

The application is split into two completely separate processes that communicate over HTTP.

```
Browser
  │
  │  User pastes transcript + selects mode
  │  → clicks "Analyse Transcript"
  │
  ├── POST /analyse
  │     body: { transcript: "...", mode: "deep" }
  │
Backend (Vercel)
  │
  ├── Builds a text prompt
  ├── Calls Google Gemini 2.5 Flash API
  ├── Parses JSON from the model response
  └── Returns { summary, action_items, risks, decisions }
  │
Browser
  └── Renders the result cards
  │
  │  User types a follow-up question in the chat box
  │  → clicks Send (or presses Enter)
  │
  ├── POST /chat
  │     body: { transcript, analysis, messages: [...history, newUserMsg] }
  │
Backend
  │
  ├── Builds a multi-turn contents array for Gemini
  │     (context block → seed reply → full conversation history)
  ├── Calls Gemini with the full history
  └── Returns { reply: "..." }
  │
Browser
  └── Appends assistant reply to the chat UI
  │
  │  User clicks "Send as email" on an assistant message
  │  → fills in recipient + edits subject/body in compose modal
  │  → clicks Send
  │
  ├── POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
  │     Authorization: Bearer <access_token>
  │     body: { raw: "<base64url MIME message>" }
  │
Gmail API (Google)
  │
  └── Delivers the email
      (backend is NOT involved — this call goes directly from the browser)
```

There is no database, no authentication, and no server-side session. Every request is fully stateless — for both endpoints. The chat endpoint receives the entire conversation history on every message and reconstructs context from scratch each time. The backend holds no memory between calls.

---

## 2. Frontend Entry Point

### `frontend/index.html`

This is the single HTML file the browser loads. It is intentionally minimal:

```html
<head>
  ...
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```

- `<div id="root">` — an empty container. React will mount the entire application inside this div at runtime. The HTML itself contains no visible content.
- `type="module"` on the app script tag tells the browser to load the file as an ES Module (enables `import`/`export` syntax natively in the browser during development).
- Vite intercepts the request for `main.tsx` during development and transpiles it on-the-fly. In production (after `npm run build`), Vite replaces this script tag with the bundled and hashed output file.
- **Google Identity Services script** — `accounts.google.com/gsi/client` loads Google's OAuth 2.0 library. It is loaded with `async defer` so it does not block page rendering. Once loaded, it attaches a `window.google.accounts.oauth2` object that the frontend uses to open the OAuth popup for Gmail. This is a CDN-hosted script managed by Google — it does not need to be installed as an npm package.

### `frontend/src/main.tsx`

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- **`createRoot`** — This is the React 18+ API for mounting a React application. It takes a real DOM node and returns a root object you can call `.render()` on. The `!` after `getElementById('root')` is a TypeScript non-null assertion — it tells the compiler "I guarantee this won't be null", because if `#root` doesn't exist the app is broken anyway.
- **`StrictMode`** — A React development tool that wraps the app and deliberately runs certain lifecycle functions twice (in development only) to expose side effects. It produces no visible output and has zero effect in production builds. If you ever notice a component's `useEffect` running twice locally, this is why.
- Importing `'./index.css'` here causes Vite to process and inject that stylesheet into the page. CSS doesn't need an explicit export — importing the file is enough.

---

## 3. Build Tooling

### `frontend/vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

Vite is the build tool — it serves a fast dev server and compiles the app for production.

- **`@vitejs/plugin-react`** — Adds support for JSX/TSX transformation (converts `<div>` syntax to `React.createElement(...)` calls), and enables React Fast Refresh during development (hot module replacement that preserves component state when you edit a file).
- **`@tailwindcss/vite`** — Tailwind v4's Vite integration. Instead of running as a PostCSS plugin, it integrates directly into Vite's pipeline. It scans your source files for Tailwind class names and generates only the CSS that's actually used. This is why you don't see a `tailwind.config.js` file — configuration moved into CSS itself in v4.

### `frontend/tsconfig.app.json`

Key compiler options explained:

| Option | Value | What it means |
|--------|-------|----------------|
| `target` | `es2023` | Output JavaScript that uses modern JS features (no polyfills for older browsers) |
| `lib` | `["ES2023", "DOM"]` | TypeScript knows about DOM types (`document`, `HTMLElement`, etc.) and ES2023 built-ins |
| `moduleResolution` | `bundler` | Tells TS to resolve imports the way Vite/webpack do, not the way Node.js does — allows importing `.tsx` extensions directly |
| `allowImportingTsExtensions` | `true` | Lets you write `import App from './App.tsx'` with the `.tsx` extension explicitly |
| `verbatimModuleSyntax` | `true` | Forces you to write `import type` for type-only imports; helps bundlers tree-shake correctly |
| `noEmit` | `true` | TypeScript only type-checks — it never outputs `.js` files. Vite handles the actual compilation via its own transpiler (esbuild) |
| `jsx` | `react-jsx` | Uses the modern JSX transform (React 17+). You do not need `import React from 'react'` at the top of every file |
| `noUnusedLocals` | `true` | Compile error if you declare a variable and never use it |
| `erasableSyntaxOnly` | `true` | Forbids TypeScript features that can't be removed by simply erasing type annotations (e.g. `const enum`, namespace). This is a new strict option aligned with the direction of stripping types without a full compilation step |

---

## 4. Styling — `index.css`

### Tailwind v4 Import

```css
@import "tailwindcss";
```

In Tailwind v4 this single line replaces the three `@tailwind base/components/utilities` directives from v3. It includes all of Tailwind's reset, base styles, and utility generation.

### Custom Theme with `@theme`

```css
@theme {
  --color-brand-400: #9d5cff;
  --color-brand-500: #7e14ff;
  --color-brand-600: #863bff;
  --color-brand-700: #6b21d4;
  --font-sans: 'Plus Jakarta Sans', system-ui, sans-serif;
}
```

`@theme` is a Tailwind v4 directive. CSS custom properties declared inside it become Tailwind utility classes automatically. For example, `--color-brand-500` generates classes like `bg-brand-500`, `text-brand-500`, `border-brand-500`, `ring-brand-500`, etc. This is why `bg-brand-600` works in the components even though it isn't a built-in Tailwind colour.

The font declaration makes `font-sans` use Plus Jakarta Sans instead of Tailwind's default Inter/system-ui stack.

### Dark Mode

```css
@media (prefers-color-scheme: dark) {
  @theme {
    --color-surface: #18181b;
  }
}
```

Tailwind v4 supports dark mode via CSS custom properties. When the OS is in dark mode, the theme variables are overridden. Classes like `dark:bg-zinc-950` in the JSX work through Tailwind's `dark:` variant, which generates CSS wrapped in a `@media (prefers-color-scheme: dark)` query.

### `@layer base`

```css
@layer base {
  body {
    @apply antialiased bg-zinc-50 text-zinc-600 font-sans dark:bg-zinc-950 dark:text-zinc-400;
  }
}
```

`@layer base` is a CSS cascade layer — styles here are lower-priority than component/utility styles, preventing accidental overrides. `@apply` inlines Tailwind utility classes directly into a CSS rule, so `body` gets the page background, default text colour, and font without needing classes in HTML.

### `@keyframes fadeIn`

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

A standard CSS animation. The results section uses `animate-[fadeIn_0.4s_ease-out_forwards]` — this is Tailwind's arbitrary value syntax `animate-[...]`, which directly injects that string as the value of the `animation` CSS property. `forwards` means the element keeps the final state (fully visible, not translated) after the animation completes.

---

## 5. Types & Shared Interfaces — `types.ts`

All TypeScript interfaces, type aliases, and shared constants live in a single `types.ts` file and are imported by whichever modules need them.

```ts
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
```

These are TypeScript **interfaces** — they describe the shape of objects but produce no JavaScript at runtime (they're erased during compilation). They serve two purposes: they give the editor autocomplete when you access properties, and they produce a type error if the backend ever returns a response that doesn't match the expected structure.

`AnalysisMode` uses a **union type** — a variable of this type can only ever hold the exact string `'quick'` or the exact string `'deep'`. Assigning `'medium'` would be a compile error.

`Message` represents a single chat turn. The `role` union (`'user' | 'assistant'`) mirrors the `role` field the backend sends to Gemini, making it straightforward to pass `messages` directly in the request body.

`ComposeEmail` holds the three editable fields of the compose modal. It is `null` when the modal is closed and non-null when open — a common React pattern for optional overlay state.

`MODE_LABELS` is a typed constant record mapping each mode value to its display string. Using `Record<AnalysisMode, string>` means TypeScript will error if a new mode is added without a corresponding label.

**`declare global { interface Window { google: ... } }`** — Google Identity Services loads via a `<script>` tag in `index.html`, not as an npm package, so TypeScript has no type information for it. The `declare global` block manually extends the built-in `Window` interface to describe exactly the part of the GIS API used here (`initTokenClient`). This is the standard TypeScript pattern for adding types to third-party globals that load outside the module system — it produces no JavaScript at runtime.

---

## 6. API Layer — `api.ts`

All network calls — both to the backend and to external services — are centralised in `api.ts`. Components import individual functions rather than calling `fetch` directly. This means if the backend URL or request format ever changes, there is exactly one place to update it.

### `analyseTranscript`

```ts
export async function analyseTranscript(transcript: string, mode: AnalysisMode): Promise<Analysis> {
  const response = await fetch('http://127.0.0.1:8000/analyse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, mode }),
  })
  if (!response.ok) throw new Error('Something went wrong')
  return response.json()
}
```

The function is `async`, meaning it returns a Promise and can use `await` inside it. **`fetch`** is the browser's built-in HTTP client. `await fetch(...)` pauses execution until the server responds with headers (not the full body). **`response.ok`** is `true` for any 2xx HTTP status code — a 4xx or 5xx from the server does **not** automatically throw, so you must check this manually. **`response.json()`** reads the response body as a stream and parses it as JSON; this is a second async operation because the body arrives separately from the headers.

### `sendChatMessage`

```ts
export async function sendChatMessage(
  transcript: string,
  analysis: Analysis,
  messages: Message[]
): Promise<string> {
  const response = await fetch('http://127.0.0.1:8000/chat', { ... })
  if (!response.ok) throw new Error('Something went wrong')
  const data = await response.json()
  return data.reply
}
```

Returns just the reply string rather than the full response object. Callers don't need to know the response envelope shape (`{ reply: "..." }`) — that detail is hidden inside this function.

### `buildMimeMessage` and `sendGmailMessage`

```ts
function buildMimeMessage(to, subject, body, from): string {
  const message = [
    `From: ${from}`, `To: ${to}`, `Subject: ${subject}`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8',
    '', body,
  ].join('\r\n')
  const bytes = new TextEncoder().encode(message)
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
```

The Gmail API's send endpoint expects the email as a **base64url-encoded MIME message** in the `raw` field. MIME format requires `\r\n` (CRLF) line endings and a blank line separating headers from body.

`btoa` (built-in browser function) converts a binary string to base64, but only handles byte values 0–255 — it cannot directly encode UTF-8 strings. The fix: `TextEncoder` converts the string to a `Uint8Array` of UTF-8 bytes, then `Array.from(bytes, b => String.fromCharCode(b)).join('')` converts each byte back to the equivalent Latin-1 character, producing a string that `btoa` can safely encode. The trailing replacements convert from standard base64 (`+`, `/`, `=` padding) to base64url (`-`, `_`, no padding) as required by the Gmail API spec.

`buildMimeMessage` is not exported — it is an implementation detail of `sendGmailMessage` and nothing else should call it directly.

```ts
export async function sendGmailMessage(to, subject, body, from, token): Promise<void> {
  const raw = buildMimeMessage(to, subject, body, from)
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  if (response.status === 401) throw new Error('GMAIL_AUTH_EXPIRED')
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message ?? 'Failed to send email')
  }
}
```

The `Authorization: Bearer` header presents the OAuth access token to the Gmail API. `me` in the URL path is a special alias meaning "the authenticated user" — the API resolves it from the token. A `401` response means the access token has expired (tokens last 1 hour). Rather than embedding UI logic here, the function throws a sentinel error string `'GMAIL_AUTH_EXPIRED'` that `ComposeEmailModal` can detect and use to trigger a `onTokenExpired` callback — keeping the API layer free of React state concerns.

### `connectGmail`

```ts
export function connectGmail(onSuccess: (token: string, email: string | null) => void): void {
  const tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
    scope: 'https://www.googleapis.com/auth/gmail.send email',
    callback: async (response) => {
      if (!response.access_token) return
      const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${response.access_token}` },
      }).then((r) => r.json())
      onSuccess(response.access_token, info.email ?? null)
    },
  })
  tokenClient.requestAccessToken()
}
```

`initTokenClient` configures an OAuth 2.0 token request. `requestAccessToken()` opens the Google sign-in popup. When the user approves, the `callback` fires with a short-lived access token (valid for 1 hour). Two scopes are requested: `gmail.send` (permission to send email) and `email` (permission to read the user's email address via the userinfo endpoint, used for the `From:` header and the connected-account banner).

`import.meta.env.VITE_GOOGLE_CLIENT_ID` reads from a `frontend/.env.local` file. Vite exposes any env var prefixed with `VITE_` to the browser bundle. The Client ID is not a secret — it is visible in the page source — but OAuth security comes from the authorised origins list configured in Google Cloud, not from keeping the ID hidden.

The callback-based design keeps `connectGmail` free of React state. The caller (`App.tsx`) passes an `onSuccess` function that calls `setGmailToken` and `setGmailUser` — the API layer never touches React state directly.

---

## 7. Root Component — `App.tsx`

`App.tsx` is intentionally thin after the refactor. Its only responsibilities are holding shared state, wiring callbacks, and composing the page layout from child components.

```ts
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
```

`useState` returns a tuple of `[currentValue, setter]`. Calling the setter triggers a re-render.

| Variable | Purpose |
|----------|---------|
| `transcript` | The raw text content — lives here because it's sent to both `/analyse` and `/chat` |
| `analysis` | The parsed response from `/analyse`. `null` means no result yet — also used to conditionally render the results + chat sections |
| `loading` | `true` while the `/analyse` fetch is in-flight |
| `error` | Non-empty string means something went wrong with analysis |
| `uploadedFileName` | Set when a file is uploaded; cleared when the user types manually |
| `analysisMode` | Which mode the toggle is set to — sent to the backend |
| `lastAnalysisMode` | The mode used for the most recent completed analysis. Separate from `analysisMode` because the user could change the toggle after running an analysis — the results display needs to know what mode produced the current results |
| `gmailToken` | The OAuth access token. `null` means Gmail is not connected. Passed to `ComposeEmailModal`; set to `null` on expiry via `onTokenExpired` |
| `gmailUser` | The connected user's email address — displayed in the banner and used as the `From:` header |
| `composeEmail` | `null` when the compose modal is closed; a `ComposeEmail` object when open |

**Chat state is not here.** `messages`, `chatInput`, `chatLoading`, and `chatError` all live inside `ChatPanel` because nothing outside that component needs them. When `analysis` is set to `null` at the start of a new analysis run, `ChatPanel` unmounts (it only renders inside `{analysis && ...}`), which resets its internal state automatically. When the new analysis arrives and `ChatPanel` remounts, it starts fresh — no explicit reset logic needed.

```tsx
const handleAnalyse = async () => {
  setLoading(true)
  setError('')
  setAnalysis(null)      // unmounts ChatPanel → resets chat state
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
```

**`finally`** — this block runs whether the `try` succeeded or the `catch` ran. It guarantees the spinner is always hidden after the request completes, regardless of outcome.

---

## 8. Components

### 8a. `TranscriptInput.tsx`

Owns the file input ref and all file-reading logic. Props:

| Prop | Type | Purpose |
|------|------|---------|
| `transcript` | `string` | Controlled textarea value |
| `onTranscriptChange` | `(val: string) => void` | Called on keystroke; App resets `uploadedFileName` to `null` |
| `analysisMode` | `AnalysisMode` | Current toggle state |
| `onAnalysisModeChange` | `(mode: AnalysisMode) => void` | Toggle click handler |
| `loading` | `boolean` | Disables the Analyse button and shows the spinner |
| `uploadedFileName` | `string \| null` | Shown in the character-count line |
| `onFileLoaded` | `(text, name) => void` | Called after a file is successfully read |
| `onFileError` | `(error) => void` | Called on read failure or unsupported type |
| `onAnalyse` | `() => void` | Analyse button click |

**File upload flow:**

- **`fileInputRef`** — A `useRef<HTMLInputElement>` pointing to the hidden `<input type="file">`. The visible "Upload file" button calls `fileInputRef.current?.click()` to open the system file picker programmatically. This is a standard pattern for custom-styled file inputs — the native input is hidden with `sr-only` (screen-reader only, visually hidden) and the visible button triggers it.
- **`.txt` files** — read via `FileReader.readAsText`, which UTF-8 decodes the bytes.
- **`.docx` files** — cannot be read as plain text because they are ZIP archives containing XML. `readAsArrayBuffer` reads the raw bytes, then the `mammoth` library parses the Word XML format and extracts plain text.
- **`await import('mammoth')`** — A **dynamic import**. Instead of loading mammoth at startup, it's loaded on-demand only when a `.docx` file is selected. Vite automatically code-splits dynamic imports into a separate chunk, keeping the initial bundle smaller.
- **`reset()`** — After reading, the file input's value is cleared (`e.target.value = ''`). Without this, selecting the same file twice in a row wouldn't trigger `onChange` (browsers don't fire `change` if the value didn't change).

**Mode toggle:**

```tsx
{(['quick', 'deep'] as const).map((mode) => (
  <button aria-pressed={analysisMode === mode} onClick={() => onAnalysisModeChange(mode)}>
    {MODE_LABELS[mode]}
  </button>
))}
```

`(['quick', 'deep'] as const)` — The `as const` assertion narrows the array type from `string[]` to the tuple `['quick', 'deep']`, allowing TypeScript to infer that each `mode` in the `.map()` callback is specifically `'quick' | 'deep'` rather than `string`. `aria-pressed` communicates the toggle state to screen readers.

---

### 8b. `GmailBanner.tsx`

A stateless presentational component. Conditionally renders one of two states based on whether `gmailToken` is non-null:

- **Not connected** — shows an envelope icon, a prompt to connect, and a "Connect Gmail" button that calls `onConnect`.
- **Connected** — turns emerald, shows a checkmark and `gmailUser` email, with a "Disconnect" link that calls `onDisconnect`.

No logic lives here — it only reflects state passed in as props and fires callbacks upward.

---

### 8c. `AnalysisResults.tsx`

Renders the full analysis output. Props are just `analysis: Analysis` and `lastAnalysisMode: AnalysisMode`. It does not need callbacks — it is pure display.

The component has an internal `EmptyState` helper for the "no items" case in each list:

```tsx
function EmptyState({ message }: { message: string }) {
  return <p className="text-sm italic text-zinc-500">{message}</p>
}
```

This lives inside `AnalysisResults.tsx` rather than as a separate file because nothing else uses it.

The action items table is built with plain HTML `<table>` elements positioned at fixed column offsets — Owner, Task, Deadline. The deep-mode sections (action items, decisions, risks) are wrapped in `{lastAnalysisMode === 'deep' && (...)}` so they only render when the analysis was a deep run.

The export button calls `exportToPdf(analysis, lastAnalysisMode)` imported from `exportPdf.ts` — no state or callbacks needed for this, so `AnalysisResults` can call it directly.

---

### 8d. `ChatPanel.tsx`

Owns all chat state internally:

```ts
const [messages, setMessages] = useState<Message[]>([])
const [chatInput, setChatInput] = useState('')
const [chatLoading, setChatLoading] = useState(false)
const [chatError, setChatError] = useState('')
const chatEndRef = useRef<HTMLDivElement>(null)
```

Because `ChatPanel` only renders inside `{analysis && ...}` in `App.tsx`, it mounts fresh every time a new analysis completes — no explicit reset needed when the user re-analyses.

**`sendMessage`:**

```ts
const sendMessage = async () => {
  const userMsg: Message = { role: 'user', content: text }
  const nextMessages = [...messages, userMsg]
  setMessages(nextMessages)
  setChatInput('')
  // ...
  const reply = await sendChatMessage(transcript, analysis, nextMessages)
  setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
}
```

Several important patterns here:

- **Optimistic append** — the user message is added to `messages` immediately (before the fetch completes), so the UI feels instant.
- **Snapshot before send** — `nextMessages` is built from the current state and used both in `setMessages` and in the `sendChatMessage` call. If we had used `messages` directly in the call instead, there would be a race condition: because `setMessages` is asynchronous, `messages` might not include the new user message at the time the fetch body is serialised.
- **`setMessages((prev) => ...)`** — The assistant reply uses the **functional updater form**. This takes the most recent state as `prev` rather than closing over a stale snapshot of `messages`. This matters because the `messages` captured in the closure at the start of `sendMessage` doesn't include the user message that was just appended.
- **Scroll with a timeout** — `setTimeout(..., 50)` defers the scroll by one render cycle. Without this, `scrollIntoView` fires before React has committed the new message to the DOM.

**`parseEmailDraft`:**

```ts
function parseEmailDraft(content: string): { subject: string; body: string } {
  const lines = content.split('\n')
  const subjectLine = lines.find((l) => l.toLowerCase().startsWith('subject:'))
  ...
}
```

When the AI is asked to draft an email it typically starts with `Subject: ...` on its own line. This helper extracts that line as the subject and uses the rest as the body, pre-filling the compose modal. Lives in `ChatPanel.tsx` because it is only called from the "Send as email" button on assistant messages — nothing else uses it.

**ReactMarkdown with custom components:**

```tsx
<ReactMarkdown
  components={{
    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="list-disc pl-4">{children}</ul>,
  }}
>
  {msg.content}
</ReactMarkdown>
```

`react-markdown` parses the markdown string into a React element tree. By default it renders plain HTML tags with no styling; the `components` prop overrides each tag with a version that includes Tailwind classes. Without this, a `<p>` inside the zinc bubble would have no bottom margin, making paragraphs run together. The `last:mb-0` on paragraphs removes the bottom margin from the final paragraph to prevent extra whitespace inside the bubble.

**Bouncing-dots loading indicator:**

```tsx
<span className="size-1.5 animate-bounce [animation-delay:0ms]" />
<span className="size-1.5 animate-bounce [animation-delay:150ms]" />
<span className="size-1.5 animate-bounce [animation-delay:300ms]" />
```

Three dots each run Tailwind's `animate-bounce` animation but with staggered delays using the arbitrary property syntax `[animation-delay:Xms]`. This creates the classic typing indicator effect.

**Textarea keyboard handling:**

```tsx
onKeyDown={(e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}}
```

`e.preventDefault()` suppresses the default `Enter` behaviour (inserting a newline). `Shift+Enter` is not caught, so it falls through to the default and inserts a newline — the expected behaviour for a chat-style input.

---

### 8e. `ComposeEmailModal.tsx`

Owns its own form state rather than modifying state in `App`. When opened, it receives the initial draft values as a prop and copies them into local state:

```ts
const [draft, setDraft] = useState(initial)  // initialised from prop once on mount
const [sending, setSending] = useState(false)
const [sentSuccess, setSentSuccess] = useState(false)
const [error, setError] = useState('')
```

This means edits inside the modal don't reach `App` at all. The modal is self-contained — it opens, the user edits, it either sends or is cancelled, and it closes. `App` only needs to know the outcome (success → close; token expired → clear token), not the intermediate editing state.

The `send` function handles the `GMAIL_AUTH_EXPIRED` sentinel from `sendGmailMessage`:

```ts
} catch (e) {
  if (e instanceof Error && e.message === 'GMAIL_AUTH_EXPIRED') {
    onTokenExpired()   // clears gmailToken in App — forces reconnect
    setError('Gmail session expired — please reconnect.')
  } else {
    setError(e instanceof Error ? e.message : 'Failed to send email')
  }
}
```

On successful send, a green banner appears and the modal auto-closes after 2 seconds via `setTimeout(onClose, 2000)`.

The backdrop click handler uses an identity check on the event target:

```tsx
onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
```

`e.currentTarget` is the backdrop `<div>`. `e.target` is whatever element was actually clicked. If they are the same element (the user clicked the backdrop itself rather than the modal content inside it), the modal closes. Clicks on the modal card do not close it because they bubble up to the backdrop with `e.target` set to an inner element.

---

### 8f. `Spinner.tsx`

A minimal SVG spinner used in `TranscriptInput` (while analysing) and `ComposeEmailModal` (while sending). Extracted as its own component to avoid duplicating the SVG markup.

```tsx
export function Spinner() {
  return (
    <svg className="size-5 animate-spin text-white" ...>
      <circle className="opacity-25" ... />
      <path className="opacity-75" ... />
    </svg>
  )
}
```

`animate-spin` is a Tailwind class that applies a CSS `rotate` animation. The two-element SVG (a faint full circle + a bright arc) is the standard CSS spinner pattern — the arc appears to chase itself around the circle.

---

## 9. PDF Export — `exportPdf.ts`

### Page Geometry Constants

```ts
const PAGE_WIDTH = 210   // A4 width in mm
const PAGE_HEIGHT = 297  // A4 height in mm
const MARGIN = 15        // left/right margin in mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2  // = 180mm of usable width
const BOTTOM_LIMIT = PAGE_HEIGHT - 20          // y-position where a new page is triggered
```

jsPDF works in millimetres by default when you pass `unit: 'mm'`. All `x` and `y` coordinates are distances from the top-left corner of the page.

### `checkPageBreak`

```ts
function checkPageBreak(doc: jsPDF, y: number, needed = 10): number {
  if (y + needed > BOTTOM_LIMIT) {
    doc.addPage()
    return 20
  }
  return y
}
```

The PDF is built by tracking a `y` cursor — a number representing how far down the page the next element should be placed. Before drawing anything, this function checks whether there's enough vertical space (`needed` mm) before the bottom limit. If not, it calls `doc.addPage()` and resets `y` to `20` (top margin of the new page).

### `addSectionHeader`

```ts
doc.setFont('helvetica', 'bold')
doc.setFontSize(12)
doc.text(title.toUpperCase(), MARGIN, y)
y += 2
doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)  // horizontal rule
return y + 6
```

jsPDF has a stateful drawing context — `setFont` and `setFontSize` affect all subsequent `text()` calls until changed. `doc.line(x1, y1, x2, y2)` draws a straight line; here it draws a full-width divider below the section title.

### `addBodyText`

```ts
const lines = doc.splitTextToSize(text, CONTENT_WIDTH) as string[]
for (const line of lines) {
  y = checkPageBreak(doc, y, 6)
  doc.text(line, MARGIN, y)
  y += 5.5
}
```

`splitTextToSize` is jsPDF's text-wrapping utility. It takes a string and a maximum width and returns an array of lines that fit within that width given the current font size. The loop then places each line individually, checking for page breaks between lines.

### `addBulletList`

```ts
doc.text('•', MARGIN, y)
doc.text(lines[0], MARGIN + 5, y)
// subsequent wrapped lines are indented to align with the first line
doc.text(lines[i], MARGIN + 5, y)
```

The bullet character is placed at the left margin, and the text is offset 5mm to the right. Wrapped continuation lines use the same `MARGIN + 5` indent so they align with the first line of text, not the bullet.

### Action Items Table

```ts
doc.text('OWNER', MARGIN, y)
doc.text('TASK', MARGIN + 38, y)
doc.text('DEADLINE', MARGIN + 130, y)
```

jsPDF has no native HTML table concept. The table is simulated by positioning text at fixed `x` offsets — OWNER at 15mm, TASK at 53mm, DEADLINE at 145mm. The column widths are fixed values chosen to fill the 180mm content width proportionally. For multi-line tasks, the row height is calculated from the number of wrapped lines (`taskLines.length * 5.5`) so the next row starts below the tallest cell.

### Footer

```ts
const totalPages = doc.getNumberOfPages()
for (let i = 1; i <= totalPages; i++) {
  doc.setPage(i)
  doc.text(`Page ${i} of ${totalPages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: 'right' })
}
```

`doc.getNumberOfPages()` is called **after** all content is written, so the total is accurate. The loop uses `doc.setPage(i)` to go back to each page and draw the footer text.

### File Name

```ts
const fileName = `meeting-analysis-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.pdf`
```

`getMonth()` returns 0–11 (January is 0), so `+ 1` is needed. `padStart(2, '0')` ensures single-digit months/days are zero-padded (e.g. `06` not `6`) to produce a consistent `YYYY-MM-DD` filename. `doc.save(fileName)` triggers a browser file download.

---

## 10. Backend

The backend is split across five files: an app factory, a shared AI client, request/response models, and two route modules — one per endpoint.

```
backend/
  main.py          ← FastAPI app, CORS, router registration
  ai_client.py     ← Gemini client singleton
  models.py        ← Pydantic request models
  routes/
    analyse.py     ← POST /analyse
    chat.py        ← POST /chat
```

---

### 10a. `main.py`

```python
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.analyse import router as analyse_router
from routes.chat import router as chat_router

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)

app.include_router(analyse_router)
app.include_router(chat_router)
```

`load_dotenv()` is called **before** the route imports. This ordering is critical: `ai_client.py` is imported transitively when the route modules are imported, and it calls `os.getenv("GEMINI_API_KEY")` at module load time. If `load_dotenv()` ran after the imports, the `.env` file would not yet be loaded and the key would be `None`, crashing on startup.

`app.include_router()` registers all routes defined in a router object onto the main app. Each route module creates its own `APIRouter()` and decorates handlers with `@router.post(...)` — the router is then handed to the app here.

**CORS middleware:**

```python
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)
```

When you run the backend with `uvicorn main:app`, uvicorn is the ASGI server that handles the actual TCP connections and feeds HTTP requests to FastAPI.

---

### 10b. `ai_client.py`

```python
import os
from google import genai

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
```

A single file that creates one `genai.Client` instance at module load time. Both route modules import this same `client` object — Python's module system caches imports, so they always get the same instance rather than creating a new client per request.

The `google-genai` package (`google.genai`) is the newer, unified SDK that replaced the older `google.generativeai` package.

---

### 10c. `models.py`

```python
from typing import Literal
from pydantic import BaseModel

class TranscriptRequest(BaseModel):
    transcript: str
    mode: Literal["quick", "deep"] = "deep"

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    transcript: str
    analysis: dict
    messages: list[ChatMessage]
```

Pydantic is a data validation library. When FastAPI receives a POST request, it automatically parses the JSON body and validates it against the relevant model. If `transcript` is missing, or `mode` is something other than `"quick"` or `"deep"`, FastAPI returns a 422 Unprocessable Entity error automatically — you write no validation code yourself.

`Literal["quick", "deep"]` is a type from Python's `typing` module — equivalent to TypeScript's union type `'quick' | 'deep'`. `= "deep"` is the default value, so clients that don't send `mode` get deep analysis.

`ChatRequest.analysis` is typed as `dict` rather than a specific Pydantic model. The analysis shape is already validated by the `/analyse` endpoint, so defining a duplicate model here would be unnecessary coupling. The `.get()` calls in the chat handler deal with any missing keys gracefully.

`ChatMessage` is used only as the element type inside `ChatRequest.messages` — it gives Pydantic enough information to validate each message object in the list individually.

---

### 10d. `routes/analyse.py`

```python
router = APIRouter()

JSON_SCHEMA = """
{
"summary": "...",
"action_items": [{"owner": "name", "task": "...", "deadline": "..."}],
"risks": [...],
"decisions": [...]
}
"""

def build_prompt(mode: Literal["quick", "deep"], transcript: str) -> str:
    if mode == "quick":
        instructions = """..."""
    else:
        instructions = f"""...{JSON_SCHEMA}..."""
    return f"{instructions}\n\nTranscript:\n{transcript}"

@router.post("/analyse")
async def analyse_transcript(request: TranscriptRequest):
    prompt = build_prompt(request.mode, request.transcript)
    response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
    raw_json = response.text.replace("```json", "").replace("```", "").strip()
    try:
        result = json.loads(raw_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse AI response as JSON")
    return result
```

`build_prompt` assembles the full prompt string sent to Gemini. The key design decision is **structural prompting** — the instructions embed an exact JSON schema the model must return. This is one of the most reliable ways to get consistent structured output from an LLM: rather than hoping the model invents the right structure, you show it exactly what to produce.

- **`@router.post("/analyse")`** — Registers this function as the handler for HTTP `POST /analyse`. Routes are mounted onto the FastAPI app in `main.py` via `include_router`.
- **`async def`** — Makes this an async function. FastAPI runs async handlers in an event loop, meaning it can handle other requests while this one is waiting for Gemini to respond, without blocking a thread.
- **`response.text.replace("```json", "").replace("```", "")`** — Even when instructed to return only JSON, models sometimes wrap their output in markdown code fences. These are stripped before parsing.
- **`json.loads`** — Python's standard library JSON parser. It raises `json.JSONDecodeError` if the string isn't valid JSON, caught and converted to a 500 HTTP error.
- **`return result`** — FastAPI automatically serialises the returned Python dict to a JSON response body with the correct `Content-Type: application/json` header.

---

### 10e. `routes/chat.py`

```python
@router.post("/chat")
async def chat(request: ChatRequest):
    context = f"""You are an AI meeting assistant...
TRANSCRIPT: {request.transcript}
ANALYSIS: Summary: {request.analysis.get('summary', '')} ..."""

    contents = [
        types.Content(role="user",  parts=[types.Part(text=context)]),
        types.Content(role="model", parts=[types.Part(text="Understood. I have the transcript and analysis. How can I help?")]),
    ]
    for msg in request.messages:
        role = "user" if msg.role == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part(text=msg.content)]))

    response = client.models.generate_content(model="gemini-2.5-flash", contents=contents)
    return {"reply": response.text}
```

The `types` module provides strongly-typed Python classes for the Gemini API's message format. Rather than passing raw dicts like `{"role": "user", "parts": [{"text": "..."}]}`, the handler uses `types.Content` and `types.Part`. This is functionally equivalent but gives Python type-checkers and IDE autocompletion insight into the structure.

**Why the seeded model reply?** Gemini's multi-turn API requires turns to alternate strictly: user → model → user → model. The context block is placed as the first user turn. Without a corresponding model turn after it, the next real user message would violate the alternating structure and cause an API error. The seed reply (`"Understood. I have the transcript and analysis..."`) acts as a placeholder model turn that establishes the alternation before the real conversation begins.

**Why send the full history on every request?** This backend is stateless — it stores nothing between requests. The entire conversation must be reconstructed on every call by replaying the message history. This is the standard pattern for stateless LLM chat APIs. The trade-off is that token usage grows with each message (you're re-sending everything every time), but for typical meeting follow-up conversations this is negligible.

**Context construction** — the `context` f-string embeds both the raw transcript and the structured analysis fields. Providing both is deliberate: the raw transcript contains nuance (tone, exact quotes, names) that the structured analysis may have summarised away, but the structured analysis provides clear signals about what was decided and who owns what. The model can draw from both when answering questions.

### Why Gemini 2.5 Flash

Gemini 2.5 Flash is a mid-tier model optimised for speed and cost over raw capability. For structured extraction from meeting transcripts — a well-defined, factual task — it performs comparably to larger models at a fraction of the latency and cost.
