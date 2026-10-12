export type Step = {
  id: string
  tool: string
  /** The file as written, absolute. */
  path: string
  /** The file as shown: relative to the session directory when under it. */
  file: string
  /** The person's prompt the edit answered. */
  prompt: string
  /** What Claude said in the message that made the edit. */
  note: string
  /** Unified-diff hunks. */
  diff: string
  added: number
  removed: number
  isNew: boolean
  isCut: boolean
}

/** The last turn's edits, for the band above the prompt; null hides it. */
export type Band = { edits: number; files: number } | null

/** One turn that edited: the reply it ended on, so a Replay button can sit under it. */
export type Scene = { answer: string; edits: number; files: number; firstStepId: string }

declare module 'claude-code' {
  interface PluginState {
    'replay-theater': { steps: Step[]; cursor: number; isPlaying: boolean; band: Band; scenes: Scene[] }
  }
}
