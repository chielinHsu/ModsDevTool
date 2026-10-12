import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Blast, BlastFile } from '../types'
import {
  findDeletions,
  formatBytes,
  globToRegExp,
  isUnresolvable,
  normalize,
  resolvePath,
} from './parse'
import type { Deletion, Shell } from './parse'

const HEADER = 'Blast'
const PROCEED = 'Proceed'
const CANCEL = 'Cancel'
// How far one preview walks before it stops counting.
const MAX_ENTRIES = 20_000
// How many paths the dialog keeps to draw.
const MAX_LISTED = 200

const pending = atom({ plugin: 'blast-radius', key: 'pending' } as const, {})

type Walk = { files: BlastFile[]; count: number; bytes: number; isTruncated: boolean }

const relativeTo = (path: string, cwd: string, isCaseless: boolean) => {
  if (cwd === '') return path
  const root = normalize(cwd).replace(/\/$/, '') + '/'
  const isUnder = isCaseless ? path.toLowerCase().startsWith(root.toLowerCase()) : path.startsWith(root)

  return isUnder ? path.slice(root.length) : path
}

/** Expands a wildcard in the last segment of `path`; other paths as they are. */
const expand = async ($: EngineInterface, path: string, isCaseless: boolean): Promise<string[]> => {
  const cut = path.lastIndexOf('/')
  const name = path.slice(cut + 1)
  if (!/[*?]/.test(name)) return [path]
  const dir = path.slice(0, cut) || '/'
  if (/[*?]/.test(dir)) return []
  const pattern = globToRegExp(name, isCaseless)
  const entries = await $.fs.list(dir).catch(() => [])

  return entries
    .filter(entry => pattern.test(entry.name) && (name.startsWith('.') || !entry.name.startsWith('.')))
    .map(entry => `${dir.replace(/\/$/, '')}/${entry.name}`)
}

/** Every file under `path`, as rm would meet it: links are removed, not followed. */
const walk = async ($: EngineInterface, path: string, into: Walk, show: (p: string) => string) => {
  const stat = await $.fs.stat(path).catch(() => undefined)
  if (!stat) return false
  const queue: string[] = []
  const add = (file: string, size: number) => {
    into.count++
    into.bytes += size
    if (into.files.length < MAX_LISTED) into.files.push({ path: show(file), size })
  }
  if (stat.kind === 'dir' && !stat.isLink) queue.push(path)
  else add(path, stat.isLink ? 0 : stat.size)

  while (queue.length > 0) {
    if (into.count >= MAX_ENTRIES) {
      into.isTruncated = true
      break
    }
    const dir = queue.shift() as string
    const entries = await $.fs.list(dir).catch(() => [])
    for (const entry of entries) {
      const child = `${dir.replace(/\/$/, '')}/${entry.name}`
      if (entry.kind === 'dir' && !entry.isLink) queue.push(child)
      else add(child, entry.kind === 'file' ? entry.size : 0)
    }
  }

  return true
}

const preview = async ($: EngineInterface, command: string, deletions: Deletion[]): Promise<Blast> => {
  // Unknown, paths stay relative: $.fs reads them against the working directory.
  const cwd = await $.session.cwd().catch(() => '')
  const isCaseless = /^[A-Za-z]:/.test(cwd)
  const home = (await $.env.get('HOME').catch(() => undefined)) ?? (await $.env.get('USERPROFILE').catch(() => undefined))
  const show = (p: string) => relativeTo(p, cwd, isCaseless)
  const into: Walk = { files: [], count: 0, bytes: 0, isTruncated: false }
  const missing: string[] = []
  const unresolved: string[] = []
  const paths: string[] = []

  for (const deletion of deletions) {
    if (deletion.cds.some(isUnresolvable)) {
      unresolved.push(...deletion.paths)
      continue
    }
    for (const written of deletion.paths) {
      paths.push(written)
      if (isUnresolvable(written)) {
        unresolved.push(written)
        continue
      }
      const absolute = resolvePath(written, cwd, deletion.cds, home)
      const matches = await expand($, absolute, isCaseless)
      if (matches.length === 0) missing.push(written)
      for (const match of matches) {
        const isThere = await walk($, match, into, show)
        if (!isThere) missing.push(written)
      }
    }
  }

  return {
    command,
    verb: deletions[0]?.verb ?? 'rm',
    count: into.count,
    bytes: into.bytes,
    files: into.files,
    more: into.isTruncated ? -1 : into.count - into.files.length,
    paths,
    missing,
    unresolved,
  }
}

const summary = (blast: Blast) =>
  `${blast.more < 0 ? 'at least ' : ''}${blast.count} file${blast.count === 1 ? '' : 's'} (${formatBytes(blast.bytes)})`

const guard = async ($: EngineInterface, command: string, shell: Shell) => {
  const deletions = findDeletions(command, shell)
  if (deletions.length === 0) return undefined
  const blast = await preview($, command, deletions)
  if (blast.count === 0 && blast.unresolved.length === 0) return undefined

  const short = command.length > 120 ? `${command.slice(0, 117)}...` : command
  const question = `Blast Radius: \`${short}\` would delete ${summary(blast)}. Proceed?`
  await update($, pending, all => ({ ...all, [question]: blast }))
  const answer = await $.ui
    .ask(question, { options: [PROCEED, CANCEL], header: HEADER })
    .catch(() => CANCEL)
  await update($, pending, all => {
    const { [question]: _, ...rest } = all
    return rest
  })

  return answer === PROCEED
    ? undefined
    : `Blast Radius: the user cancelled \`${short}\`, which would have deleted ${summary(blast)}. ` +
        'Do not retry this delete; ask the user what they want removed.'
}

export const register: Register = on => {
  const failed = (name: string) => `${name}: could not preview this delete, so it was held.`

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const refusal = typeof e.command === 'string' ? await guard($, e.command, 'bash') : undefined

    return refusal === undefined ? next(e) : { deny: refusal }
  }).catch(($, e, next) => (next.called ? next(e) : { deny: failed($.plugin.name) }))

  on('tool.call', { tool: 'PowerShell' }, async ($, e, next) => {
    const refusal = typeof e.command === 'string' ? await guard($, e.command, 'powershell') : undefined

    return refusal === undefined ? next(e) : { deny: refusal }
  }).catch(($, e, next) => (next.called ? next(e) : { deny: failed($.plugin.name) }))

  on('ui.render', { component: 'AskUserQuestion' }, async ($, e, next) => {
    const first = e.props.questions[0] as { question?: string; header?: string } | undefined
    const blast = first?.header === HEADER ? (await read($, pending))[first.question ?? ''] : undefined
    if (!blast) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const room = Math.max(3, (e.viewport?.rows ?? 30) - 16)
    const shown = blast.files.slice(0, room)
    const hidden = blast.more < 0 ? -1 : blast.count - shown.length
    const dialog = await next(e)

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="warning" paddingX={1}>
        <Text color="warning" bold>
          ⚠ Blast Radius · {blast.verb}
        </Text>
        <Box flexDirection="row" gap={1}>
          <Text dimColor>Command</Text>
          <Text bold wrap="truncate-end">
            {blast.command}
          </Text>
        </Box>
        <Box flexDirection="row" gap={1}>
          <Text dimColor>Would  </Text>
          <Text color="error" bold>
            delete {summary(blast)}
          </Text>
        </Box>
        <Box flexDirection="column" paddingLeft={1} marginTop={1}>
          {shown.map(file => (
            <Text wrap="truncate-middle">{file.path}</Text>
          ))}
          {hidden !== 0 && <Text dimColor>{hidden < 0 ? '... and more (stopped counting)' : `... and ${hidden} more`}</Text>}
        </Box>
        {blast.missing.length > 0 && <Text dimColor>Not found: {blast.missing.join(' ')}</Text>}
        {blast.unresolved.length > 0 && (
          <Text color="warning">Cannot preview (variables): {blast.unresolved.join(' ')}</Text>
        )}
        <Text dimColor italic>
          Paths: {blast.paths.join(' ')}
        </Text>
        {dialog}
      </Box>
    )
  })
}
