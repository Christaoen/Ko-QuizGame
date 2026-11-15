import { createClient } from '@supabase/supabase-js'

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
const projectHost = (() => {
  try {
    const url = new URL(projectUrl)
    return url.protocol === 'https:' ? url.host : ''
  } catch { return '' }
})()
export const configured = Boolean(projectHost && publishableKey)
const gameUrl = `https://${projectHost}/functions/v1/game`
const client = configured ? createClient(projectUrl, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}) : null

export type GradeReply = {
  score: number
  correct: boolean
  expected: string[]
  duration_ms: number
  total_score: number
  total_ms: number
  ranked: boolean
  completed: boolean
}
export type BoardRow = { username: string; score: number; total_ms: number; rank: number }
export type PlayerAttempt = {
  number: number; completed: boolean; score: number; total_ms: number; started_at: string
  answers: { question: number; answer: string[]; score: number; duration_ms: number }[]
}
export type AdminData = {
  players: { username: string; starts: number }[]
  attempts: {
    id: string; username: string; number: number; question: number; score: number
    total_ms: number; started_at: string; completed_at: string | null
    answers: PlayerAttempt['answers']
  }[]
}

type ApiError = { error?: string }
const messages: Record<string, string> = {
  'Name unavailable or attempts exhausted': '该用户名不可用或两次答题机会已用完。',
  'Answer rejected or attempt expired': '答题已失效或提交顺序不正确，请检查是否超时。',
  'Attempt unavailable': '本次答题已失效，不能继续。',
  'Unauthorized': '请使用独立的后台账号登录。',
  'Forbidden': '该账号没有后台权限。',
}

export async function gameRequest<T>(body: Record<string, unknown>, jwt?: string): Promise<T> {
  if (!configured) throw Error('服务尚未配置，请先填写 Project URL 和 Publishable Key。')
  let response: Response
  try {
    response = await fetch(gameUrl, {
      method: 'POST', cache: 'no-store',
      headers: {
        'content-type': 'application/json', apikey: publishableKey,
        ...(jwt ? { authorization: `Bearer ${jwt}` } : {}),
      },
      body: JSON.stringify(body),
    })
  } catch { throw Error('连接失败，请检查网络和服务器状态。') }
  const data: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const reason = (data as ApiError).error
    throw Error((reason && messages[reason]) || (response.status === 503 ? '服务暂不可用。' : '请求失败，请稍后重试。'))
  }
  return data as T
}

export async function adminLogin(email: string, password: string) {
  if (!client) throw Error('服务尚未配置。')
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) throw Error('后台登录失败，请检查邮箱和密码。')
  return data.session.access_token
}

export async function adminLogout() {
  await client?.auth.signOut({ scope: 'local' })
}
