import { describe, expect, test } from 'claude-code/testing'

import { relativeTo, unifiedDiff } from './diff'

describe('unifiedDiff', () => {
  test('one changed line with context', () => {
    const diff = unifiedDiff('a\nb\nfunction greet() {}\nc\n', 'a\nb\nfunction welcome() {}\nc\n')
    expect(diff.added).toBe(1)
    expect(diff.removed).toBe(1)
    expect(diff.text).toBe('@@ -1,4 +1,4 @@\n a\n b\n-function greet() {}\n+function welcome() {}\n c')
  })

  test('a new file is one added hunk', () => {
    const diff = unifiedDiff('', 'x\ny\n')
    expect(diff.text).toBe('@@ -0,0 +1,2 @@\n+x\n+y')
  })

  test('far-apart changes are separate hunks', () => {
    const before = Array.from({ length: 30 }, (_, i) => `line ${i}`)
    const after = [...before]
    after[2] = 'changed 2'
    after[25] = 'changed 25'
    const diff = unifiedDiff(before.join('\n'), after.join('\n'))
    expect(diff.text.match(/^@@/gm)?.length).toBe(2)
    expect(diff.added).toBe(2)
  })

  test('no change is empty', () => {
    expect(unifiedDiff('same', 'same')).toEqual({ text: '', added: 0, removed: 0, isCut: false })
  })
})

test('relativeTo', () => {
  expect(relativeTo('C:\\proj\\src\\greet.js', 'C:\\Proj')).toBe('src/greet.js')
  expect(relativeTo('/other/x.js', '/proj')).toBe('/other/x.js')
})

const PANE_PROPS = {
  title: 'Replay Theater',
  isFocused: true,
  bodyColumns: 80,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
} as const

test('records edits with narration and steps through them', async ($, on) => {
  const files: Record<string, string> = {
    '/p/greet.js': 'export function greet() {}\n',
    '/p/app.js': 'greet()\n',
  }
  const ids: string[] = []
  const key = (path: string) => path.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')

  on('session.cwd', () => ({ value: '/p' }))
  on('fs.read', ($, e) => {
    const text = files[key(e.path)]
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('session.messages', () => ({
    value: [
      { role: 'user', text: 'Rename greet to welcome everywhere', toolUses: [] },
      // As the transcript stores it: the text and the tool call as rows of their own.
      { role: 'assistant', text: "Renaming the function where it's defined.", toolUses: [] },
      { role: 'assistant', text: '', toolUses: ids.map(id => ({ tool_use_id: id, tool: 'Edit', input: {} })) },
    ],
  }))
  on('tool.call', ($, e) => {
    if (e.tool !== 'Edit') return { result: {} }
    ids.push(e.tool_use_id ?? '')
    const path = key(e.file_path)
    files[path] = (files[path] ?? '').replace(e.old_string, e.new_string)
    return { result: { filePath: e.file_path } }
  })

  await $.tool.call({ tool: 'Edit', file_path: '/p/greet.js', old_string: 'greet', new_string: 'welcome' })
  await $.tool.call({ tool: 'Edit', file_path: '/p/app.js', old_string: 'greet', new_string: 'welcome' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'replay-theater',
      surface,
      component: 'Pane',
      requestId: 'replay-theater',
      props: PANE_PROPS,
    })
    await ui.press({ key: 'first' })
    expect((await ui.find({ text: /Step 1 \/ 2/ }))?.text).toContain('2 files')
    expect(await ui.find({ text: "Renaming the function where it's defined." })).toBeDefined()
    expect(await ui.find({ text: 'Rename greet to welcome everywhere' })).toBeDefined()
    expect(await ui.find({ text: 'greet.js' })).toBeDefined()

    await ui.press({ key: 'next' })
    expect(await ui.find({ text: /Step 2 \/ 2/ })).toBeDefined()
    expect(await ui.find({ text: 'app.js' })).toBeDefined()
    await ui.unmount()
  }
})

test('the band above the prompt opens the theater', async ($, on) => {
  on('session.cwd', () => ({ value: '/p' }))
  // Every read differs from the last, so each Write is a change.
  let reads = 0
  on('fs.read', () => ({ value: `version ${reads++}\n` }))
  on('session.messages', () => ({ value: [] }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', () => ({ text: '' }))
  // The engine's own reply row, which the plugin draws its button under.
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  const opened: string[] = []
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  for (const file of ['a', 'a', 'b', 'b', 'c', 'd']) {
    await $.tool.call({ tool: 'Write', file_path: `/p/${file}.js`, content: 'x\n' })
  }
  await $.turn.complete({
    answer: 'Working on it.\n\nRenamed it in 4 files.',
    durationMs: 1,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'replay-theater',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 80, scroll: { offset: 0, bodyRows: 4 }, view: {} },
    })
    expect((await ui.find({ text: /Replay: 6 edits/ }))?.text).toContain('across 4 files')
    await ui.press({ key: 'replay' })
    expect(opened.at(-1)).toBe('replay-theater')
    await ui.unmount()

    // The reply block that ended the turn carries its own Replay button.
    const reply = await $.ui.mount({
      plugin: 'replay-theater',
      surface,
      component: 'AssistantMessage',
      props: { text: 'Renamed it in 4 files.', isFirstOfReply: false },
    })
    expect((await reply.find({ text: /Replay: 6 edits/ }))?.text).toContain('across 4 files')
    const button = await reply.find({ type: 'Button' })
    opened.length = 0
    await reply.press({ key: button?.key ?? '' })
    expect(opened).toEqual(['replay-theater'])
    await reply.unmount()

    // Other reply blocks stay as they were.
    const other = await $.ui.mount({
      plugin: 'replay-theater',
      surface,
      component: 'AssistantMessage',
      props: { text: 'Something unrelated.', isFirstOfReply: true },
    })
    expect(await other.find({ type: 'Button' })).toBeUndefined()
    await other.unmount()
  }
})
