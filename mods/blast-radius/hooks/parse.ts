// Finds recursive deletes in a shell command, without running anything.

export type Shell = 'bash' | 'powershell'

export type Deletion = {
  /** How the delete was spelled, for the dialog title: `rm -rf`. */
  verb: string
  /** The segment of the command that deletes. */
  segment: string
  /** The targets as written. */
  paths: string[]
  /** The `cd` steps before it in the same command, in order. */
  cds: string[]
}

type Token = { text: string; isQuoted: boolean }

const SEPARATORS = ['&&', '||', ';', '|', '&', '\n']

/** Splits a command into segments on unquoted separators, keeping quotes. */
export const splitSegments = (command: string, shell: Shell): string[] => {
  const segments: string[] = []
  let current = ''
  let quote: string | undefined
  const escape = shell === 'bash' ? '\\' : '`'

  for (let i = 0; i < command.length; i++) {
    const ch = command.charAt(i)
    if (ch === escape && quote !== "'" && i + 1 < command.length) {
      current += ch + command.charAt(i + 1)
      i++
      continue
    }
    if (quote) {
      if (ch === quote) quote = undefined
      current += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
      continue
    }
    const sep = SEPARATORS.find(s => command.startsWith(s, i))
    if (sep) {
      segments.push(current)
      current = ''
      i += sep.length - 1
      continue
    }
    current += ch
  }
  segments.push(current)

  return segments.map(s => s.trim()).filter(s => s.length > 0)
}

/** Splits one segment into words, dropping quotes but remembering them. */
export const tokenize = (segment: string, shell: Shell): Token[] => {
  const tokens: Token[] = []
  let text = ''
  let isQuoted = false
  let hasWord = false
  let quote: string | undefined
  const escape = shell === 'bash' ? '\\' : '`'

  for (let i = 0; i < segment.length; i++) {
    const ch = segment.charAt(i)
    if (ch === escape && quote !== "'" && i + 1 < segment.length) {
      text += segment.charAt(i + 1)
      hasWord = true
      i++
      continue
    }
    if (quote) {
      if (ch === quote) quote = undefined
      else text += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      isQuoted = true
      hasWord = true
      continue
    }
    if (/\s/.test(ch)) {
      if (hasWord) tokens.push({ text, isQuoted })
      text = ''
      isQuoted = false
      hasWord = false
      continue
    }
    text += ch
    hasWord = true
  }
  if (hasWord) tokens.push({ text, isQuoted })

  return tokens
}

const PREFIXES = new Set(['sudo', 'command', 'builtin', 'exec', 'nice', 'time', 'doas'])
const PS_DELETE = new Set(['remove-item', 'rm', 'ri', 'del', 'erase', 'rd', 'rmdir'])
const PS_PATH_PARAMS = /^-(path|literalpath|lp|pspath)$/i
const PS_VALUE_PARAMS = /^-(filter|include|exclude|credential|stream)$/i

const baseName = (word: string) => word.replace(/^.*[\\/]/, '').replace(/\.exe$/i, '')

const findBash = (tokens: Token[]): Omit<Deletion, 'segment' | 'cds'> | undefined => {
  const textAt = (at: number) => tokens[at]?.text ?? ''
  let at = 0
  while (at < tokens.length && (PREFIXES.has(textAt(at)) || /^\w+=/.test(textAt(at)))) at++
  if (at >= tokens.length || baseName(textAt(at)) !== 'rm') return undefined

  let isRecursive = false
  const flags: string[] = []
  const paths: string[] = []
  let isPastFlags = false
  for (const token of tokens.slice(at + 1)) {
    const word = token.text
    if (!isPastFlags && !token.isQuoted && word === '--') {
      isPastFlags = true
      continue
    }
    if (!isPastFlags && !token.isQuoted && word.startsWith('-') && word.length > 1) {
      flags.push(word)
      if (word === '--recursive' || (/^-[rRfidvI]+$/.test(word) && /[rR]/.test(word))) isRecursive = true
      continue
    }
    paths.push(word)
  }
  if (!isRecursive) return undefined

  return { verb: ['rm', ...flags].join(' '), paths }
}

const findPowerShell = (tokens: Token[]): Omit<Deletion, 'segment' | 'cds'> | undefined => {
  const name = tokens[0]?.text
  if (name === undefined || !PS_DELETE.has(name.toLowerCase())) return undefined

  let isRecursive = false
  const flags: string[] = []
  const paths: string[] = []
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i] as Token
    const word = token.text
    if (!token.isQuoted && /^\/s$/i.test(word)) {
      isRecursive = true
      flags.push(word)
      continue
    }
    if (!token.isQuoted && /^\/q$/i.test(word)) {
      flags.push(word)
      continue
    }
    if (!token.isQuoted && word.startsWith('-') && word.length > 1) {
      const colon = word.indexOf(':')
      const param = colon < 0 ? word : word.slice(0, colon)
      const inline = colon < 0 ? undefined : word.slice(colon + 1)
      if (PS_PATH_PARAMS.test(param)) {
        const value = inline ?? tokens[++i]?.text
        if (value !== undefined) paths.push(...value.split(',').filter(Boolean))
        continue
      }
      if (PS_VALUE_PARAMS.test(param)) {
        if (inline === undefined) i++
        continue
      }
      flags.push(word)
      if (/^-r(e(c(u(r(s(e)?)?)?)?)?)?$/i.test(param) || /^-[a-z]*r[a-z]*$/i.test(param) && param.length <= 3) {
        isRecursive = true
      }
      continue
    }
    paths.push(...word.split(',').filter(Boolean))
  }
  if (!isRecursive) return undefined

  return { verb: [name, ...flags].join(' '), paths }
}

/** Every recursive delete in `command`, with the `cd`s that run before it. */
export const findDeletions = (command: string, shell: Shell): Deletion[] => {
  const found: Deletion[] = []
  const cds: string[] = []

  for (const segment of splitSegments(command, shell)) {
    const tokens = tokenize(segment, shell)
    const head = tokens[0]?.text.toLowerCase()
    if ((head === 'cd' || head === 'set-location' || head === 'sl' || head === 'pushd') && tokens.length > 1) {
      const target = tokens.find((t, i) => i > 0 && !(!t.isQuoted && t.text.startsWith('-')))
      if (target) cds.push(target.text)
      continue
    }
    const hit = shell === 'powershell' ? findPowerShell(tokens) ?? findBash(tokens) : findBash(tokens)
    if (hit && hit.paths.length > 0) found.push({ ...hit, segment, cds: [...cds] })
  }

  return found
}

/** True for a path the hook cannot expand on its own: a variable or a subshell. */
export const isUnresolvable = (path: string) => /[$`]|^%|%$/.test(path)

const isAbsolute = (path: string) => /^([A-Za-z]:)?[\\/]/.test(path) || /^[A-Za-z]:$/.test(path)

/** `/c/Users/x` (Git Bash) as `C:/Users/x` when the session is on Windows. */
const fromMsys = (path: string, isWindows: boolean) =>
  isWindows ? path.replace(/^\/([a-zA-Z])(\/|$)/, (_, d: string, s: string) => `${d.toUpperCase()}:${s || '/'}`) : path

/** Folds `.` and `..`, forward slashes throughout. */
export const normalize = (path: string): string => {
  const slashed = path.replace(/\\/g, '/')
  const root = /^[A-Za-z]:\//.test(slashed) ? slashed.slice(0, 3) : slashed.startsWith('/') ? '/' : ''
  const parts: string[] = []
  for (const part of slashed.slice(root.length).split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }

  return root + parts.join('/')
}

/** Resolves `path` against the session directory and the `cd`s before it; `cwd` '' keeps it relative. */
export const resolvePath = (path: string, cwd: string, cds: readonly string[], home: string | undefined): string => {
  const isWindows = /^[A-Za-z]:/.test(cwd)
  const expand = (p: string) => {
    const msys = fromMsys(p, isWindows)
    if (home && (msys === '~' || msys.startsWith('~/') || msys.startsWith('~\\'))) return home + msys.slice(1)

    return msys
  }
  const join = (base: string, step: string) => (isAbsolute(step) || base === '' ? step : `${base}/${step}`)
  const base = cds.reduce((at, cd) => join(at, expand(cd)), cwd)

  return normalize(join(base, expand(path)))
}

/** A shell wildcard (`*`, `?`) in one path segment, as a RegExp. */
export const globToRegExp = (glob: string, isCaseless: boolean) =>
  new RegExp(
    `^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`,
    isCaseless ? 'i' : '',
  )

/** `498 KB`, `1.2 MB`. */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }

  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}
