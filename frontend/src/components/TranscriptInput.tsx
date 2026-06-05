import { useRef } from 'react'
import type { AnalysisMode } from '../types'
import { MODE_LABELS } from '../types'
import { Spinner } from './Spinner'

interface Props {
  transcript: string
  onTranscriptChange: (value: string) => void
  analysisMode: AnalysisMode
  onAnalysisModeChange: (mode: AnalysisMode) => void
  loading: boolean
  uploadedFileName: string | null
  onFileLoaded: (text: string, fileName: string) => void
  onFileError: (error: string) => void
  onAnalyse: () => void
}

export function TranscriptInput({
  transcript,
  onTranscriptChange,
  analysisMode,
  onAnalysisModeChange,
  loading,
  uploadedFileName,
  onFileLoaded,
  onFileError,
  onAnalyse,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reset = () => { e.target.value = '' }
    const lowerName = file.name.toLowerCase()

    if (lowerName.endsWith('.txt')) {
      const reader = new FileReader()
      reader.onerror = () => onFileError('Failed to read file.')
      reader.onload = (event) => {
        const text = event.target?.result
        if (typeof text !== 'string') return
        onFileLoaded(text, file.name)
        reset()
      }
      reader.readAsText(file)
    } else if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
      const reader = new FileReader()
      reader.onerror = () => onFileError('Failed to read file.')
      reader.onload = async (event) => {
        const arrayBuffer = event.target?.result
        if (!(arrayBuffer instanceof ArrayBuffer)) return
        try {
          const mammoth = await import('mammoth')
          const result = await mammoth.extractRawText({ arrayBuffer })
          onFileLoaded(result.value, file.name)
          reset()
        } catch {
          onFileError('Failed to read file.')
          reset()
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      onFileError('Unsupported file type. Please upload a .txt, .docx or .doc file.')
      reset()
    }
  }

  return (
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload file
        </button>
      </div>

      <textarea
        id="transcript"
        className="min-h-[220px] w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-sm text-zinc-800 placeholder:text-zinc-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400"
        placeholder="Paste your meeting transcript here..."
        value={transcript}
        onChange={(e) => onTranscriptChange(e.target.value)}
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
              onClick={() => onAnalysisModeChange(mode)}
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
        onClick={onAnalyse}
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
  )
}
