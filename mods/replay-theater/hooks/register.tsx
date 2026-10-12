import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallResult } from 'claude-code'

import type { Band, Scene, Step } from '../types'
import { relativeTo, unifiedDiff } from './diff'

const PANE = 'replay-theater'
const TITLE = 'Replay Theater'
const MAX_STEPS = 300
// How long each step stays on screen while playing.
const STEP_MS = 1800

const steps = atom({ plugin: 'replay-theater', key: 'steps' } as const, [])
const cursor = atom({ plugin: 'replay-theater', key: 'cursor' } as const, 0)
const isPlaying = atom({ plugin: 'replay-theater', key: 'isPlaying' } as const, false)
const band = atom({ plugin: 'replay-theater', key: 'band' } as const, null as Band)
const scenes = atom({ plugin: 'replay-theater', key: 'scenes' } as const, [] as Scene[])
const MAX_SCENES = 50

type Edit = { tool: string; path: string; before: string | undefined; fallbackBefore: string; fallbackAfter: string }

const readText = ($: EngineInterface, path: string) => $.fs.read(path).catch(() => undefined)

const isDone = (ran: ToolCallResult) => ran.deny === undefined && ran.isError !== true

/** What Claude said in the message holding the call, and the prompt it answered. */
const narration = async ($: EngineInterface, toolUseId: string, agentId: string | undefined) => {
  const found = agentId === undefined ? await $.session.messages() : await $.session.messages({ agentId })
  const messages = Array.isArray(found) ? found : []
  const at = messages.findLastIndex(m => m.toolUses.some(use => use.tool_use_id === toolUseId))
  // The text may be a message of its own just before the call's: walk back to the last tool row.
  let note = at < 0 ? '' : (messages[at]?.text ?? '').trim()
  for (let i = at - 1; note === '' && i >= 0; i--) {
    const message = messages[i]
    if (!message || message.role !== 'assistant' || message.toolUses.length > 0) break
    note = message.text.trim()
  }
  const asked = messages
    .slice(0, at < 0 ? messages.length : at)
    .findLast(m => m.role === 'user' && m.text.trim() !== '' && (m.toolResults?.length ?? 0) === 0)

  return { note: note.slice(0, 600), prompt: (asked?.text ?? '').trim().slice(0, 300) }
}

let editsThisTurn = 0
let filesThisTurn = new Set<string>()
let firstStepThisTurn: string | undefined
let isTicking = false

const record = async ($: EngineInterface, edit: Edit, toolUseId: string, agentId: string | undefined) => {
  const after = await readText($, edit.path)
  const diff =
    after !== undefined && (edit.before !== undefined || edit.tool === 'Write')
      ? unifiedDiff(edit.before ?? '', after)
      : unifiedDiff(edit.fallbackBefore, edit.fallbackAfter)
  if (diff.added === 0 && diff.removed === 0) return

  const cwd = await $.session.cwd().catch(() => '')
  const { note, prompt } = await narration($, toolUseId, agentId).catch(() => ({ note: '', prompt: '' }))
  const step: Step = {
    id: toolUseId,
    tool: edit.tool,
    path: edit.path,
    file: relativeTo(edit.path, cwd),
    prompt,
    note,
    diff: diff.text,
    added: diff.added,
    removed: diff.removed,
    isNew: edit.before === undefined && edit.tool === 'Write',
    isCut: diff.isCut,
  }
  await update($, steps, list => [...list, step].slice(-MAX_STEPS))
  if (agentId === undefined) {
    editsThisTurn++
    firstStepThisTurn ??= step.id
    filesThisTurn.add(step.file)
  }
}

/** The first step of the latest prompt's run of edits. */
const sceneStart = (list: readonly Step[]) => {
  const prompt = list[list.length - 1]?.prompt
  let at = list.length - 1
  while (at > 0 && list[at - 1]?.prompt === prompt) at--

  return Math.max(0, at)
}

const advance = async ($: EngineInterface) => {
  const list = await read($, steps)
  const at = await read($, cursor)
  if (at >= list.length - 1) {
    isTicking = false
    await update($, isPlaying, () => false)
    return
  }
  await update($, cursor, () => at + 1)
}

/** Opens the pane at step `at`. */
const openTheater = async ($: EngineInterface, at: number) => {
  await update($, cursor, () => at)
  await $.ui.open({ id: PANE, title: TITLE, focus: true, closeOnEscape: true })
}

/** Opens the pane at a turn's first edit, or the latest turn's when it has scrolled out. */
const openScene = async ($: EngineInterface, firstStepId: string) => {
  const list = await read($, steps)
  if (list.length === 0) return
  const at = list.findIndex(step => step.id === firstStepId)
  await openTheater($, at < 0 ? sceneStart(list) : at)
}

/** The scene a reply block ends, matched on the turn's final text. */
const sceneFor = (all: readonly Scene[], text: string) => {
  const block = text.trim()
  return block === '' ? undefined : all.findLast(scene => scene.answer.endsWith(block))
}

const summary = (edits: number, files: number) =>
  `${edits} edit${edits === 1 ? '' : 's'}${files > 1 ? ` across ${files} files` : ''}`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'replay',
      description: 'Replay the edits Claude made, step by step',
      argumentHint: '[all | last | <step> | clear]',
      immediate: true,
    })
    $.clock.every(STEP_MS, () => {
      if (isTicking) void advance($)
    })

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    editsThisTurn = 0
    firstStepThisTurn = undefined
    filesThisTurn = new Set()

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const edits = editsThisTurn
      const files = filesThisTurn.size
      const firstStepId = firstStepThisTurn
      const answer = e.answer.trim().slice(-4000)
      await update($, band, () => (edits > 0 ? { edits, files } : null))
      if (edits > 0 && firstStepId !== undefined && answer !== '') {
        await update($, scenes, all => [...all, { answer, edits, files, firstStepId }].slice(-MAX_SCENES))
      }
    }

    return next(e)
  })

  // A Replay button under the reply that ended a turn of edits: drawn on every surface.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const drawn = await next(e)
    const scene = sceneFor(await read($, scenes), e.props.text)
    if (scene === undefined) return drawn

    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {drawn}
        <Box flexDirection="row" alignItems="center" gap={2} marginTop={1}>
          <Text color="#d6409f" bold>
            ▶ Replay: {summary(scene.edits, scene.files)}
          </Text>
          <Button key={`replay-${scene.firstStepId}`} label="Replay" onPress={() => openScene($, scene.firstStepId)} />
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const last = await read($, band)
    if (e.props.hasSurvey || last === null) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const watch = async () => {
      const list = await read($, steps)
      if (list.length > 0) await openTheater($, sceneStart(list))
    }

    return (
      <Box flexDirection="row" alignItems="center" gap={2}>
        <Text color="#d6409f" bold>
          ▶ Replay: {summary(last.edits, last.files)}
        </Text>
        <Button key="replay" hotkey="r" label="Replay" onPress={watch} />
      </Box>
    )
  })

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const before = await readText($, e.file_path)
    const ran = await next(e)
    if (isDone(ran)) {
      const edit = { tool: 'Edit', path: e.file_path, before, fallbackBefore: e.old_string, fallbackAfter: e.new_string }
      await record($, edit, e.tool_use_id, e.agentId)
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const before = await readText($, e.file_path)
    const ran = await next(e)
    if (isDone(ran)) {
      const edit = { tool: 'Write', path: e.file_path, before, fallbackBefore: before ?? '', fallbackAfter: e.content }
      await record($, edit, e.tool_use_id, e.agentId)
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) => {
    const ran = await next(e)
    if (isDone(ran)) {
      const removed = e.edit_mode === 'delete' ? '(deleted cell)' : ''
      const added = e.edit_mode === 'delete' ? '' : e.new_source
      const edit = { tool: 'NotebookEdit', path: e.notebook_path, before: undefined, fallbackBefore: removed, fallbackAfter: added }
      await record($, edit, e.tool_use_id, e.agentId)
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'replay' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'clear') {
      isTicking = false
      await update($, steps, () => [])
      await update($, cursor, () => 0)
      await update($, isPlaying, () => false)
      await update($, band, () => null)
      await update($, scenes, () => [])
      await $.ui.close({ id: PANE })

      return { text: 'Replay Theater: cleared the recorded edits.' }
    }

    const list = await read($, steps)
    if (list.length === 0) return { text: 'Replay Theater: no edits recorded in this session yet.' }

    const asked = Number.parseInt(arg, 10)
    const at =
      arg === 'all' ? 0
      : arg === 'last' ? list.length - 1
      : Number.isFinite(asked) ? Math.min(Math.max(asked, 1), list.length) - 1
      : sceneStart(list)
    await openTheater($, at)

    return { text: `Replay Theater: ${list.length} edit${list.length === 1 ? '' : 's'}, from step ${at + 1}.` }
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    isTicking = false
    await update($, isPlaying, () => false)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Code, Text } = $.ui.resolve(e)
    const list = await read($, steps)
    if (list.length === 0) return <Text dimColor>No edits yet. Ask Claude to change something, then /replay.</Text>

    const at = Math.min(Math.max(await read($, cursor), 0), list.length - 1)
    const step = list[at] as Step
    const playing = await read($, isPlaying)
    const files = new Set(list.map(s => s.file)).size
    const isFirst = at === 0
    const isLast = at === list.length - 1
    const go = (to: number) => update($, cursor, () => Math.min(Math.max(to, 0), list.length - 1))
    const toggle = async () => {
      if (!playing && isLast) await go(sceneStart(list) === at ? 0 : sceneStart(list))
      isTicking = !playing
      await update($, isPlaying, () => !playing)
    }

    // One mark per step while they fit, a bar otherwise.
    const width = Math.max(10, e.props.bodyColumns - 2)
    const track =
      list.length <= width / 2
        ? list.map((_, i) => (i < at ? '●' : i === at ? '◉' : '○')).join(' ')
        : '━'.repeat(Math.round((width * (at + 1)) / list.length)) +
          '─'.repeat(width - Math.round((width * (at + 1)) / list.length))
    const verb = step.isNew ? 'Created' : 'Edited'

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text color="claude" bold>
            ✻ {TITLE}
          </Text>
          <Text dimColor>
            Step {at + 1} / {list.length} · {files} file{files === 1 ? '' : 's'}
            {playing ? ' · playing' : ''}
          </Text>
        </Box>
        {step.prompt !== '' && (
          <Box alignSelf="flex-end" borderStyle="round" borderColor="subtle" paddingX={1}>
            <Text wrap="truncate-end">{step.prompt}</Text>
          </Box>
        )}
        {step.note !== '' && <Text>{step.note}</Text>}
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text dimColor>{verb}</Text>
            <Text bold wrap="truncate-middle">
              {step.file}
            </Text>
            <Text color="success">+{step.added}</Text>
            <Text color="error">-{step.removed}</Text>
            {step.tool === 'NotebookEdit' && <Text dimColor>(notebook cell)</Text>}
          </Box>
          <Code key={`diff-${step.id}`} source={step.diff} format="diff" path={step.file} wrap="truncate-end" />
          {step.isCut && <Text dimColor>... more changes in this step are not shown</Text>}
        </Box>
        <Text color="claude">{track}</Text>
        <Box flexDirection="row" gap={2}>
          <Button key="first" hotkey="f" plain dimColor={isFirst} label="First" onPress={() => go(0)} />
          <Button key="prev" hotkey="p" plain dimColor={isFirst} label="Prev" onPress={() => go(at - 1)} />
          <Button key="play" hotkey="k" plain label={playing ? 'Pause' : 'Play'} onPress={toggle} />
          <Button key="next" hotkey="n" plain dimColor={isLast} label="Next" onPress={() => go(at + 1)} />
          <Button key="last" hotkey="l" plain dimColor={isLast} label="Last" onPress={() => go(list.length - 1)} />
        </Box>
      </Box>
    )
  })
}
