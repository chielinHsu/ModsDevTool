import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { findDeletions, formatBytes, resolvePath } from './parse'

describe('findDeletions', () => {
  test('finds rm -rf and its target', () => {
    const [hit] = findDeletions('rm -rf build', 'bash')
    expect(hit?.verb).toBe('rm -rf')
    expect(hit?.paths).toEqual(['build'])
  })

  test('ignores rm without -r and other commands', () => {
    expect(findDeletions('rm -f a.txt', 'bash')).toEqual([])
    expect(findDeletions('echo "rm -rf /"', 'bash')).toEqual([])
    expect(findDeletions('git status', 'bash')).toEqual([])
  })

  test('reads chains, sudo, quotes and cd', () => {
    const hits = findDeletions('cd app && sudo rm -r --force "dist dir" -- -odd; ls', 'bash')
    expect(hits.length).toBe(1)
    expect(hits[0]?.paths).toEqual(['dist dir', '-odd'])
    expect(hits[0]?.cds).toEqual(['app'])
  })

  test('finds PowerShell Remove-Item -Recurse in its spellings', () => {
    expect(findDeletions('Remove-Item -Recurse -Force build', 'powershell')[0]?.paths).toEqual(['build'])
    expect(findDeletions('rm -r -fo .\\out,.\\tmp', 'powershell')[0]?.paths).toEqual(['.\\out', '.\\tmp'])
    expect(findDeletions('Remove-Item -LiteralPath "C:\\x y" -Recurse', 'powershell')[0]?.paths).toEqual(['C:\\x y'])
    expect(findDeletions('rmdir /s /q build', 'powershell')[0]?.paths).toEqual(['build'])
    expect(findDeletions('Remove-Item -Force a.txt', 'powershell')).toEqual([])
  })
})

test('resolvePath folds cd, .. and Git Bash drives', () => {
  expect(resolvePath('build', 'C:\\proj', [], undefined)).toBe('C:/proj/build')
  expect(resolvePath('../x', 'C:\\proj', ['app'], undefined)).toBe('C:/proj/x')
  expect(resolvePath('/c/tmp/out', 'C:\\proj', [], undefined)).toBe('C:/tmp/out')
  expect(resolvePath('~/cache', '/home/me/p', [], '/home/me')).toBe('/home/me/cache')
  expect(resolvePath('./out/../dist', '', ['app'], undefined)).toBe('app/dist')
})

test('formatBytes', () => {
  expect(formatBytes(512)).toBe('512 B')
  expect(formatBytes(498 * 1024)).toBe('498 KB')
  expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
})

const TREE: Record<string, { name: string; kind: 'file' | 'dir'; size: number }[]> = {
  '/p/build': [
    { name: 'index.html', kind: 'file', size: 1000 },
    { name: 'assets', kind: 'dir', size: 0 },
  ],
  '/p/build/assets': [{ name: 'app.js', kind: 'file', size: 3000 }],
}

// The engine hands $.fs hooks the path made absolute for this platform (`C:\p\build`).
const inTree = (path: string) => TREE[path.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')]

const fakeWorld = (on: On, answer: string, asked: string[]) => {
  on('session.cwd', () => ({ value: '/p' }))
  mock.env(on, {})
  on('fs.stat', ($, e) => {
    return inTree(e.path) ? { value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: false } } : { deny: 'ENOENT' }
  })
  on('fs.list', ($, e) => ({
    value: (inTree(e.path) ?? []).map(entry => ({ ...entry, mtimeMs: 0, isLink: false })),
  }))
  on('tool.call', ($, e) => {
    if (e.tool === 'AskUserQuestion') {
      const question = e.questions[0]?.question ?? ''
      asked.push(question)
      return { result: { questions: e.questions, answers: { [question]: answer } } }
    }
    asked.push(`ran ${e.tool}`)
    return { result: { stdout: 'ran', stderr: '', interrupted: false } }
  })
}

test('Proceed lets rm -rf run after showing what it deletes', async ($, on) => {
  const asked: string[] = []
  fakeWorld(on, 'Proceed', asked)
  const ran = await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  expect(asked.length).toBe(2)
  expect(asked[0]).toContain('2 files')
  expect(asked[1]).toBe('ran Bash')
  expect(ran.deny).toBeUndefined()
})

test('Cancel refuses rm -rf', async ($, on) => {
  const asked: string[] = []
  fakeWorld(on, 'Cancel', asked)
  const ran = await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  expect(asked.length).toBe(1)
  expect(ran.deny ?? ran.text).toContain('cancelled')
})

test('nothing to delete asks nothing', async ($, on) => {
  const asked: string[] = []
  fakeWorld(on, 'Cancel', asked)
  const ran = await $.tool.call({ tool: 'Bash', command: 'rm -rf nothing-here' })
  expect(asked).toEqual(['ran Bash'])
})
