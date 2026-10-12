// Line diffs as unified-diff hunks, for the Code element's `format: 'diff'`.

export type Diff = { text: string; added: number; removed: number; isCut: boolean }

type Op = { kind: ' ' | '-' | '+'; line: string }

// Past this many cells the middle of a change is drawn as one replace.
const MAX_CELLS = 1_000_000

export const splitLines = (text: string): string[] =>
  text === '' ? [] : text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')

const lcs = (a: readonly string[], b: readonly string[]): Op[] => {
  const n = a.length
  const m = b.length
  const table = new Int32Array((n + 1) * (m + 1))
  const at = (i: number, j: number) => table[i * (m + 1) + j] ?? 0
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * (m + 1) + j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1))
    }
  }
  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: ' ', line: a[i] as string })
      i++
      j++
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      ops.push({ kind: '-', line: a[i++] as string })
    } else {
      ops.push({ kind: '+', line: b[j++] as string })
    }
  }
  while (i < n) ops.push({ kind: '-', line: a[i++] as string })
  while (j < m) ops.push({ kind: '+', line: b[j++] as string })

  return ops
}

export const diffLines = (a: readonly string[], b: readonly string[]): Op[] => {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  const middle =
    midA.length * midB.length <= MAX_CELLS
      ? lcs(midA, midB)
      : [...midA.map(line => ({ kind: '-' as const, line })), ...midB.map(line => ({ kind: '+' as const, line }))]

  return [
    ...a.slice(0, start).map(line => ({ kind: ' ' as const, line })),
    ...middle,
    ...a.slice(endA).map(line => ({ kind: ' ' as const, line })),
  ]
}

/** `before` to `after` as hunks with `context` lines around each change, at most `maxLines` drawn. */
export const unifiedDiff = (before: string, after: string, context = 3, maxLines = 400): Diff => {
  const ops = diffLines(splitLines(before), splitLines(after))
  const changed = ops.flatMap((op, index) => (op.kind === ' ' ? [] : [index]))
  const added = ops.filter(op => op.kind === '+').length
  const removed = ops.filter(op => op.kind === '-').length

  // Ranges of ops to show, changes merged when their context touches.
  const ranges: [number, number][] = []
  for (const index of changed) {
    const from = Math.max(0, index - context)
    const to = Math.min(ops.length - 1, index + context)
    const last = ranges[ranges.length - 1]
    if (last && from <= last[1] + 1) last[1] = Math.max(last[1], to)
    else ranges.push([from, to])
  }

  // Line numbers before each op.
  const oldAt: number[] = []
  const newAt: number[] = []
  let oldLine = 1
  let newLine = 1
  for (const op of ops) {
    oldAt.push(oldLine)
    newAt.push(newLine)
    if (op.kind !== '+') oldLine++
    if (op.kind !== '-') newLine++
  }

  const hunks: string[] = []
  let drawn = 0
  let isCut = false
  for (const [from, to] of ranges) {
    const slice = ops.slice(from, to + 1)
    if (drawn > 0 && drawn + slice.length > maxLines) {
      isCut = true
      break
    }
    const oldCount = slice.filter(op => op.kind !== '+').length
    const newCount = slice.filter(op => op.kind !== '-').length
    const oldStart = (oldAt[from] ?? 1) - (oldCount === 0 ? 1 : 0)
    const newStart = (newAt[from] ?? 1) - (newCount === 0 ? 1 : 0)
    hunks.push(
      [`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`, ...slice.map(op => op.kind + op.line)].join('\n'),
    )
    drawn += slice.length
  }

  return { text: hunks.join('\n'), added, removed, isCut }
}

/** `src/greet.js` for a file under `cwd`, the path as written otherwise. */
export const relativeTo = (path: string, cwd: string): string => {
  const slashed = path.replace(/\\/g, '/')
  const root = cwd.replace(/\\/g, '/').replace(/\/$/, '') + '/'
  const isCaseless = /^[A-Za-z]:/.test(root)
  const isUnder = isCaseless ? slashed.toLowerCase().startsWith(root.toLowerCase()) : slashed.startsWith(root)

  return root !== '/' && isUnder ? slashed.slice(root.length) : slashed
}
