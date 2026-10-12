export type BlastFile = { path: string; size: number }

export type Blast = {
  command: string
  verb: string
  count: number
  bytes: number
  files: BlastFile[]
  more: number
  paths: string[]
  missing: string[]
  unresolved: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'blast-radius': { pending: Record<string, Blast> }
  }
}
