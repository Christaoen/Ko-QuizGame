import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Volume2, VolumeX, ArrowRight, Check, X } from 'lucide-react'
import { fifthOptions, formatTime, questions, type Letter, type Result } from './quiz'
import { adminLogin, adminLogout, configured, gameRequest, type AdminData, type BoardRow, type GradeReply, type PlayerAttempt } from './api'
import './style.css'

type Screen = 'cover' | 'name' | 'question' | 'wrong' | 'answer' | 'correct' | 'result' | 'leaderboard' | 'records' | 'admin'
type Area = { key: Letter; left: number; top: number; width: number; height: number }

const image1: Area[] = [
  { key: 'A', left: 18.5, top: 12.6, width: 30.5, height: 23.5 },
  { key: 'B', left: 54.5, top: 12.6, width: 31, height: 23.5 },
  { key: 'C', left: 18.5, top: 37.7, width: 30.5, height: 34.2 },
  { key: 'D', left: 54.5, top: 37.7, width: 31, height: 34.2 },
  { key: 'E', left: 18.5, top: 73, width: 30.5, height: 24 },
  { key: 'F', left: 54.2, top: 73.2, width: 31.8, height: 23.7 }
]
const image2: Area[] = [
  { key: 'C', left: 48.2, top: 23.5, width: 48.2, height: 36.7 },
  { key: 'D', left: 7.2, top: 65.8, width: 41.4, height: 31.4 },
  { key: 'B', left: 52.5, top: 63.6, width: 44.6, height: 33.6 },
  { key: 'A', left: 27.2, top: 41.6, width: 39.2, height: 30 },
]
const image3: Area[] = [
  { key: 'A', left: 11.2, top: 59.4, width: 34.3, height: 16.1 },
  { key: 'B', left: 55.5, top: 58.8, width: 33.7, height: 18.8 },
  { key: 'C', left: 11.2, top: 76.9, width: 34.3, height: 19.9 },
  { key: 'D', left: 55.5, top: 76.9, width: 33.7, height: 19.9 },
]
const image4: Area[] = [
  { key: 'A', left: 14.5, top: 49.8, width: 33.1, height: 24.4 },
  { key: 'B', left: 54.4, top: 49.8, width: 33.1, height: 24.4 },
  { key: 'C', left: 14.5, top: 75, width: 33.1, height: 24.1 },
  { key: 'D', left: 54.4, top: 75, width: 33.1, height: 24.1 },
]
const imageUrls = [
  new URL('../1.jpg', import.meta.url).href, new URL('../2.jpg', import.meta.url).href,
  new URL('../3.jpg', import.meta.url).href, new URL('../4.jpg', import.meta.url).href,
  new URL('../5.jpg', import.meta.url).href,
]
const posterUrl = new URL('../0.png', import.meta.url).href
const sounds = {
  right: new URL('../right.mp3', import.meta.url).href,
  win: new URL('../win.mp3', import.meta.url).href,
  damie: new URL('../damie.mp3', import.meta.url).href,
}

function App() {
  const [screen, setScreen] = useState<Screen>('cover')
  const [name, setName] = useState('')
  const [player, setPlayer] = useState('')
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<Letter[]>([])
  const [blanks, setBlanks] = useState<[Letter | '', Letter | '']>(['', ''])
  const [activeBlank, setActiveBlank] = useState<0 | 1>(0)
  const [results, setResults] = useState<Result[]>([])
  const [muted, setMuted] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState('')
  const [answerError, setAnswerError] = useState(false)
  const [adminTab, setAdminTab] = useState<'players' | 'results' | 'records' | 'eligibility'>('players')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminToken, setAdminToken] = useState('')
  const [adminData, setAdminData] = useState<AdminData | null>(null)
  const [board, setBoard] = useState<BoardRow[]>([])
  const [history, setHistory] = useState<PlayerAttempt[]>([])
  const [busy, setBusy] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [lastGrade, setLastGrade] = useState<GradeReply | null>(null)
  const [totalScore, setTotalScore] = useState(0)
  const [totalMs, setTotalMs] = useState(0)
  const [ranked, setRanked] = useState(false)
  const tokenRef = useRef('')
  const pendingAnswer = useRef<Letter[] | null>(null)
  const submittingRef = useRef(false)
  const advancingRef = useRef(false)
  const returnScreen = useRef<Screen>('cover')
  const startAt = useRef(Date.now())
  const scheduled = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  const screenRef = useRef(screen)
  screenRef.current = screen

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 250)
    return () => { window.clearInterval(tick); if (scheduled.current) clearTimeout(scheduled.current); audio.current?.pause() }
  }, [])

  function play(key: keyof typeof sounds) {
    if (mutedRef.current) return
    audio.current?.pause()
    const next = new Audio(sounds[key])
    next.volume = { right: 0.5, win: 0.44, damie: 0.44 }[key]
    audio.current = next
    void next.play().catch(() => {})
  }

  function toggleSound() {
    if (!muted) audio.current?.pause()
    mutedRef.current = !muted
    setMuted(!muted)
  }

  function openQuestion(nextIndex: number) {
    setIndex(nextIndex)
    pendingAnswer.current = null
    setRequestError('')
    setSelected([])
    setBlanks(['', ''])
    setAnswerError(false)
    setActiveBlank(0)
    startAt.current = Date.now()
    setScreen('question')
    window.scrollTo(0, 0)
  }

  async function advance(nextIndex: number) {
    if (advancingRef.current) return
    advancingRef.current = true
    setBusy(true)
    setRequestError('')
    try {
      const next = await gameRequest<{ question: number }>({ action: 'advance', token: tokenRef.current })
      if (next.question !== nextIndex + 1) throw Error('题目顺序异常，请暂停并联系管理员。')
      openQuestion(nextIndex)
    } catch (problem) {
      setRequestError((problem as Error).message)
    } finally {
      advancingRef.current = false
      setBusy(false)
    }
  }

  function finishOrNext(nextIndex: number) {
    if (nextIndex === 5) {
      play('win')
      setScreen('result')
      window.scrollTo(0, 0)
    } else void advance(nextIndex)
  }

  async function confirmName(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    const clean = name.trim()
    if (!clean) { setError('Please enter your user name.'); return }
    setBusy(true)
    setError('')
    try {
      const response = await gameRequest<{ token: string; question: number }>({ action: 'start', username: clean })
      if (!response.token || response.question !== 1) throw Error('服务响应异常，请暂停并联系管理员。')
      tokenRef.current = response.token
      setPlayer(clean)
      setResults([])
      setLastGrade(null)
      setRequestError('')
      setTotalScore(0)
      setTotalMs(0)
      setRanked(false)
      openQuestion(0)
    } catch (problem) { setError((problem as Error).message) }
    finally { setBusy(false) }
  }

  function toggleChoice(letter: Letter) {
    if (pendingAnswer.current || busy) return
    setAnswerError(false)
    if (index !== 0) { setSelected([letter]); return }
    setSelected((current) => current.includes(letter) ? current.filter((item) => item !== letter) : [...current, letter])
  }

  function chooseMouth(letter: Letter) {
    if (pendingAnswer.current || busy) return
    setAnswerError(false)
    setBlanks((current) => {
      const next: [Letter | '', Letter | ''] = [...current]
      next[activeBlank] = letter
      return next
    })
    setActiveBlank(1)
  }

  async function confirmAnswer() {
    if (screenRef.current !== 'question' || submittingRef.current) return
    if (!pendingAnswer.current && (index === 2 ? !blanks[0] || !blanks[1] : selected.length === 0)) {
      setAnswerError(true)
      return
    }
    submittingRef.current = true
    setBusy(true)
    setAnswerError(false)
    setRequestError('')
    const answer: Letter[] = pendingAnswer.current ?? (index === 2 ? [blanks[0], blanks[1]] as Letter[] : [...selected])
    pendingAnswer.current = answer
    try {
      const reply = await gameRequest<GradeReply>({ action: 'submit', token: tokenRef.current, question: index + 1, answer })
      if (!Array.isArray(reply.expected) || typeof reply.score !== 'number' || typeof reply.correct !== 'boolean') {
        throw Error('服务响应异常，请暂停并联系管理员。')
      }
      setLastGrade(reply)
      setTotalScore(reply.total_score)
      setTotalMs(reply.total_ms)
      setRanked(reply.ranked)
      setResults((current) => current.length > index ? current : [
        ...current, { question: index + 1, score: reply.score, seconds: reply.duration_ms / 1000 },
      ])
      if (reply.correct) {
        play('right')
        setScreen('correct')
        scheduled.current = setTimeout(() => finishOrNext(index + 1), 1150)
      } else {
        play('damie')
        setScreen('wrong')
        scheduled.current = setTimeout(() => setScreen('answer'), 2100)
      }
    } catch (problem) { setRequestError((problem as Error).message) }
    finally { submittingRef.current = false; setBusy(false) }
  }

  async function showLeaderboard() {
    setBusy(true)
    setRequestError('')
    try {
      const data = await gameRequest<{ rows: BoardRow[] }>({ action: 'leaderboard' })
      setBoard(data.rows)
      setScreen('leaderboard')
    } catch (problem) { setRequestError((problem as Error).message) }
    finally { setBusy(false) }
  }

  async function showRecords(lookupName = player) {
    const clean = lookupName.trim()
    if (!clean) { setError('Please enter your user name.'); return }
    setBusy(true)
    setRequestError('')
    setError('')
    try {
      const data = await gameRequest<{ attempts: PlayerAttempt[] }>({ action: 'results', username: clean })
      setHistory(data.attempts)
      setScreen('records')
    } catch (problem) { setError((problem as Error).message); setRequestError((problem as Error).message) }
    finally { setBusy(false) }
  }

  async function signInAdmin(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setRequestError('')
    try {
      const jwt = await adminLogin(adminEmail, adminPassword)
      const data = await gameRequest<AdminData>({ action: 'admin' }, jwt)
      setAdminToken(jwt)
      setAdminData(data)
      setAdminPassword('')
    } catch (problem) {
      await adminLogout()
      setRequestError((problem as Error).message)
    } finally { setBusy(false) }
  }

  async function signOutAdmin() {
    await adminLogout()
    setAdminToken('')
    setAdminData(null)
    setAdminEmail('')
    setAdminPassword('')
    setRequestError('')
  }

  const displayTime = formatTime(screen === 'question' ? (now - startAt.current) / 1000 : (results[index]?.seconds ?? 0))
  const correctChoices = lastGrade?.expected ?? []
  const isCorrectChoice = (letter: Letter) => screen === 'answer' && correctChoices.includes(letter)

  return (
    <div className={`app ${screen === 'cover' || screen === 'name' ? 'on-poster' : ''}`}>
      <header className="topbar">
        <span className="brand">{screen !== 'cover' && <>KCS <i /><span>INTERACTIVE QUIZ</span></>}</span>
        <button type="button" className="sound-button" onClick={toggleSound} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} title={muted ? 'Sound off' : 'Sound on'} aria-pressed={!muted}>
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </header>

      {(screen === 'cover' || screen === 'name') && (
        <main className="poster-screen">
          <div className="poster" style={{ backgroundImage: `url(${posterUrl})` }}>
            <div className="poster-controls">
              {screen === 'cover' ? (
                <div className="cover-content">
                  <button className="primary poster-button" onClick={() => setScreen('name')}>Game Start <ArrowRight size={18} /></button>
                </div>
              ) : (
                <form className="name-form" onSubmit={confirmName}>
                  <label htmlFor="player-name">User Name</label>
                  <input id="player-name" type="text" maxLength={32} autoComplete="off" placeholder="Enter your name" value={name} onChange={(event) => { setName(event.target.value); setError('') }} />
                  {error && <p className="form-error" role="alert">{error}</p>}
                  <button className="primary poster-button" type="submit" disabled={busy || !configured}>{busy ? '连接中…' : 'Confirm'} <ArrowRight size={18} /></button>
                  <p className="demo-hint">{configured ? '每个用户名最多开始两次；开始即占用一次，中途退出也不会返还。' : '服务尚未配置，暂不能开始答题。'}</p>
                  <button className="text-button" type="button" onClick={() => void showRecords(name)} disabled={busy || !configured}>View answer records (no attempt used)</button>
                </form>
              )}
            </div>
          </div>
        </main>
      )}

      {(screen === 'question' || screen === 'wrong' || screen === 'answer' || screen === 'correct') && (
        <main className="quiz-page">
          <div className="quiz-meta"><span>QUESTION {String(index + 1).padStart(2, '0')} <b>/ 05</b></span><span>{screen === 'question' ? displayTime : formatTime(results[index]?.seconds ?? 0)}</span></div>
          <div className="progress"><span style={{ width: `${(index + 1) * 20}%` }} /></div>
          <div className="question-body">
            {index !== 2 && index !== 4 && <h1 className="question-title">{questions[index].prompt}</h1>}
            <div className="image-stage">
              <img src={imageUrls[index]} alt={`Question ${index + 1} illustration`} draggable={false} />
              {index === 2 && (
                <>
                  <div className="image-prompt mouth-prompt">{questions[index].prompt} <button type="button" className={`inline-blank ${activeBlank === 0 && screen === 'question' ? 'is-active' : ''}`} aria-label="Choose first blank" aria-pressed={activeBlank === 0} disabled={screen !== 'question' || busy || Boolean(pendingAnswer.current)} onClick={() => setActiveBlank(0)}>{blanks[0] || ''}</button> 和 <button type="button" className={`inline-blank ${activeBlank === 1 && screen === 'question' ? 'is-active' : ''}`} aria-label="Choose second blank" aria-pressed={activeBlank === 1} disabled={screen !== 'question' || busy || Boolean(pendingAnswer.current)} onClick={() => setActiveBlank(1)}>{blanks[1] || ''}</button>？</div>
                  {screen === 'question' && <span className="mouth-help">{activeBlank === 0 ? '先点图选第一空' : '再点图选第二空'} · 点击下划线可修改</span>}
                </>
              )}
              {index === 4 && <div className="image-prompt last-prompt"><strong>{questions[index].prompt}</strong><div className="last-options">{fifthOptions.map((text, position) => <button key={text} type="button" disabled={screen !== 'question' || busy || Boolean(pendingAnswer.current)} className={`last-option ${screen === 'answer' && correctChoices.includes('ABC'[position]) ? 'is-correct' : selected.includes('ABC'[position] as Letter) && screen === 'question' ? 'is-selected' : ''}`} onClick={() => toggleChoice('ABC'[position] as Letter)}><b>{'ABC'[position]}.</b> {text}</button>)}</div></div>}
              {screen === 'answer' && index !== 4 && <div className={`answer-note ${index === 2 ? 'answer-note-mouth' : ''}`} role="status"><span>正确答案</span><strong>{correctChoices.join(index === 2 ? '、' : '')}</strong>{index === 2 && <small>左 {correctChoices[0]} · 右 {correctChoices[1]}</small>}</div>}
              {(index === 0 || index === 1 || index === 2 || index === 3) && (index === 0 ? image1 : index === 1 ? image2 : index === 2 ? image3 : image4).map(({ key, left, top, width, height }) => (
                <button key={key} type="button" aria-label={`Option ${key}`} aria-pressed={index === 2 ? blanks.includes(key) : selected.includes(key)} disabled={screen !== 'question' || busy || Boolean(pendingAnswer.current)} className={`image-choice ${isCorrectChoice(key) ? 'is-correct' : screen === 'question' && (index === 2 ? blanks.includes(key) : selected.includes(key)) ? 'is-selected' : ''} ${index === 1 ? `choice-${key}` : ''} ${index === 2 ? 'mouth-choice' : ''}`} style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }} onClick={() => index === 2 ? chooseMouth(key) : toggleChoice(key)}>{index !== 1 && <span className="choice-label">{key}</span>}{index === 2 && screen === 'question' && (blanks[0] === key || blanks[1] === key) && <span className="mouth-order">{blanks[0] === key ? '1' : ''}{blanks[1] === key ? '2' : ''}</span>}{index === 2 && screen === 'answer' && <span className="mouth-order correct-order">{key === correctChoices[0] ? '1' : ''}{key === correctChoices[1] ? '2' : ''}</span>}</button>
              ))}
              {index === 4 && screen === 'answer' && <div className="answer-note answer-note-last" role="status"><span>正确答案</span><strong>{correctChoices.join('')}</strong></div>}
            </div>
            <div className="quiz-bottom"><span>{answerError && screen === 'question' ? <span className="answer-error" role="alert">{index === 2 ? '请先选满两张图片，再确认。' : '请先选择答案，再确认。'}</span> : screen === 'question' ? index === 2 ? '先选第一空，再选第二空；可返回修改。' : 'Select your answer, then confirm.' : screen === 'answer' ? '绿色边框标出正确选项' : ' '}</span>{screen === 'question' && <button className="primary" onClick={() => void confirmAnswer()} disabled={busy}>{busy ? '提交中…' : pendingAnswer.current ? 'Retry submission' : 'Confirm'} <ArrowRight size={17} /></button>}{(screen === 'answer' || (screen === 'correct' && requestError)) && <button className="primary" onClick={() => finishOrNext(index + 1)} disabled={busy}>{busy ? '加载中…' : requestError ? 'Retry next' : 'Next'} <ArrowRight size={17} /></button>}</div>
            {requestError && <p className="form-error" role="alert">{requestError}</p>}
          </div>
          {screen === 'wrong' && <div className="flash flash-wrong" role="status"><div className="flash-symbol"><X size={76} strokeWidth={2.5} /></div><div className="wrong-answer-card"><span>正确答案</span><strong>{correctChoices.join(index === 2 ? '、' : '')}</strong>{index === 2 && <small>左 {correctChoices[0]} · 右 {correctChoices[1]}</small>}</div></div>}
          {screen === 'correct' && <div className="flash flash-right" role="status"><div className="flash-symbol"><Check size={76} strokeWidth={2.5} /></div><span>CORRECT</span></div>}
        </main>
      )}

      {screen === 'result' && <main className="end-page">
        <span className="eyebrow">THE END · KCS</span><h1>Your result</h1>
        <div className="result-card"><span className="eyebrow">QUIZ COMPLETE</span>
          <div className="result-score">{totalScore}<small> / 100</small></div>
          <div className="result-details"><div><span>Total time</span><strong>{formatTime(totalMs / 1000)}</strong></div>
            <div><span>Leaderboard</span><strong>{ranked ? 'Eligible' : 'Not ranked'}</strong></div></div>
          <span className="result-caption">5 questions completed</span>
        </div>
        <button className="primary wide-button" onClick={() => void showLeaderboard()} disabled={busy}>{busy ? '加载中…' : 'View leaderboard'} <ArrowRight size={17} /></button>
        <button className="text-button" onClick={() => void showRecords()} disabled={busy}>View answer records</button>
        {requestError && <p className="form-error" role="alert">{requestError}</p>}
        <p className="closing">感谢参与，祝每一位参与的贝贝顺风顺水顺财神，有钱有颜万事成！<br />（以上纯属娱乐，如果在这个过程中因画面等感到不适主包表示不好意思）</p>
      </main>}
      {screen === 'leaderboard' && <main className="list-page">
        <h1>Leaderboard</h1><div className="leaderboard"><div className="row table-head"><span>RANK</span><span>PLAYER</span><span>SCORE</span><span>TIME</span></div>
          {board.map((row) => <div className={`row ${row.username === player ? 'your-row' : ''}`} key={row.username}><span>{String(row.rank).padStart(2, '0')}</span><strong>{row.username}</strong><span>{row.score}</span><span>{formatTime(row.total_ms / 1000)}</span></div>)}
        </div><button className="text-button" onClick={() => setScreen('result')}>Back to result</button>
      </main>}
      {screen === 'records' && <main className="list-page">
        <h1>Answer records</h1><p className="small-note">任何知道相同用户名的人都可以查看该名字的记录；此方式不能验证本人。</p>
        {history.length === 0 && <p className="small-note">没有可公开查看的记录。</p>}
        {history.map((attempt) => <section className="record-attempt" key={attempt.number}>
          <h2>Attempt {attempt.number} · {attempt.completed ? `${attempt.score} / 100` : 'Unfinished'}</h2>
          <p className="small-note">{attempt.answers.length} / 5 questions · {formatTime(attempt.total_ms / 1000)}</p>
          {attempt.answers.map((answer) => <div className="record-line" key={answer.question}><strong>Question {answer.question}: {answer.answer.join(answer.question === 3 ? ' / ' : '')}</strong><span>{answer.score} / 20 · {formatTime(answer.duration_ms / 1000)}</span></div>)}
        </section>)}
        <button className="text-button" onClick={() => setScreen(results.length === 5 ? 'result' : 'name')}>Back</button>
      </main>}
      {screen === 'admin' && <main className="list-page admin-page">
        <h1>Admin dashboard</h1>
        {!adminToken || !adminData ? <form className="admin-login" onSubmit={(event) => void signInAdmin(event)}>
          <p className="small-note">后台账号需要独立登录；答题用户名不授予后台权限。</p>
          <label htmlFor="admin-email">Email</label><input id="admin-email" type="email" autoComplete="username" required value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} />
          <label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoComplete="current-password" required value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} />
          <button className="primary" disabled={busy || !configured} type="submit">{busy ? '登录中…' : 'Sign in'}</button>
        </form> : <>
          <button className="text-button" onClick={() => void signOutAdmin()}>Sign out</button>
          <div className="admin-tabs" aria-label="Admin sections">
            {(['players', 'results', 'records', 'eligibility'] as const).map((tab) => <button key={tab} type="button" aria-pressed={adminTab === tab} className={adminTab === tab ? 'active' : ''} onClick={() => setAdminTab(tab)}>{tab === 'records' ? 'Answer records' : tab[0].toUpperCase() + tab.slice(1)}</button>)}
          </div><div className="admin-section">
            <h2>{adminTab === 'records' ? 'Answer records' : adminTab[0].toUpperCase() + adminTab.slice(1)}</h2>
            {(adminTab === 'players' || adminTab === 'eligibility') && <div className="admin-list">{adminData.players.map((item) => <div key={item.username}><strong>{item.username}</strong><span>{item.starts} / 2 starts</span></div>)}</div>}
            {adminTab === 'results' && <div className="admin-list">{adminData.attempts.map((item) => <div key={item.id}><strong>{item.username} · Attempt {item.number}</strong><span>{item.completed_at ? `${item.score} points · ${formatTime(item.total_ms / 1000)}` : 'Unfinished'}</span></div>)}</div>}
            {adminTab === 'records' && <div className="admin-list">{adminData.attempts.flatMap((attempt) => attempt.answers.map((item) => <div key={`${attempt.id}-${item.question}`}><strong>{attempt.username} · Attempt {attempt.number} · Q{item.question}: {item.answer.join(item.question === 3 ? ' / ' : '')}</strong><span>{item.score} / 20 · {formatTime(item.duration_ms / 1000)}</span></div>))}</div>}
          </div>
        </>}
        {requestError && <p className="form-error" role="alert">{requestError}</p>}
        <button className="text-button" onClick={() => { setRequestError(''); setScreen(returnScreen.current) }}>Back to game</button>
      </main>}
      <footer className="footer"><span>{screen === 'cover' ? '' : '© KCS'}</span>{screen !== 'admin' && <button type="button" onClick={() => { returnScreen.current = screen; setRequestError(''); setScreen('admin') }}>Admin</button>}</footer>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
