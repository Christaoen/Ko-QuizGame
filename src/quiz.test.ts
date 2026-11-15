import { expect, it } from 'vitest'
import { formatTime, rankRows } from './quiz'

it('sorts rank by score then total time and formats a clock', () => {
  const rows = [{ name: 'slow', score: 80, seconds: 70 }, { name: 'fast', score: 80, seconds: 50 }, { name: 'top', score: 100, seconds: 90 }]
  expect(rankRows(rows).map((row) => row.name)).toEqual(['top', 'fast', 'slow'])
  expect(formatTime(71)).toBe('01:11')
})
