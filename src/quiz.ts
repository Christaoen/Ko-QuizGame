export type Letter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
export type Result = { question: number; score: number; seconds: number }

export const questions = [
  { image: '1.jpg', prompt: '1.Select all the males with an eagle in the picture below.（选出下列所有男性）', type: 'multi' },
  { image: '2.jpg', prompt: '2.下面哪个是迷惑的边界中黄睦渊的原配jio丫？', type: 'single' },
  { image: '3.jpg', prompt: '3.朴子（左）和林辛路（右）的mouth分别对应下面的', type: 'text' },
  { image: '4.jpg', prompt: '4.The object in the picture below is whose brother?（谁的老二）', type: 'single' },
  { image: '5.jpg', prompt: '5.此人在干嘛', type: 'single' },
] as const

export const fifthOptions = [
  '跟踪lp被发现，想装不认识跑路',
  '在lp面前通过跑步+蛙跳展示超绝运动天赋证明自己',
  '跟lp兄弟喝酒喝醉了，准备回家',
] as const

export function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds))
  return `${Math.floor(safeSeconds / 60).toString().padStart(2, '0')}:${(safeSeconds % 60).toString().padStart(2, '0')}`
}

export function rankRows(rows: { name: string; score: number; seconds: number }[]) {
  return [...rows].sort((a, b) => b.score - a.score || a.seconds - b.seconds)
}
