# Meeting Intelligence Assistant

An AI-powered web app that analyses meeting transcripts and extracts structured insights.

## Live Demo
https://meeting-agent-weld.vercel.app/

## What it does
- Summarises the meeting
- Extracts action items with owners and deadlines
- Identifies decisions made
- Flags risks and unresolved issues
- Multi-turn follow-up chat against the transcript
- Send follow-up emails directly via Gmail

## Tech Stack
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Python, FastAPI
- AI: Google Gemini 3.1 Flash Lite
- Deployed on Vercel (frontend) and Railway (backend)

## Project Structure

```
meeting-agent/
├── frontend/
│   └── src/
│       ├── main.tsx               # React entry point
│       ├── App.tsx                # Root component — state wiring + layout
│       ├── types.ts               # Shared TypeScript interfaces & constants
│       ├── api.ts                 # All fetch calls (backend + Gmail API)
│       ├── exportPdf.ts           # PDF generation (jsPDF)
│       ├── index.css              # Tailwind v4 + custom theme
│       └── components/
│           ├── Spinner.tsx
│           ├── TranscriptInput.tsx    # Textarea, file upload, mode toggle
│           ├── GmailBanner.tsx        # Gmail connect/disconnect strip
│           ├── AnalysisResults.tsx    # Summary, action items, decisions, risks
│           ├── ChatPanel.tsx          # Multi-turn chat UI
│           └── ComposeEmailModal.tsx  # Email compose + send modal
└── backend/
    ├── main.py                    # FastAPI app setup, CORS, router registration
    ├── ai_client.py               # Gemini client singleton
    ├── models.py                  # Pydantic request/response models
    └── routes/
        ├── analyse.py             # POST /analyse — transcript analysis
        └── chat.py                # POST /chat — follow-up conversation
```
