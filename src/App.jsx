import { supabase } from './supabaseClient'
import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [applications, setApplications] = useState([])
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [companyName, setCompanyName] = useState('')
  const [companySuggestions, setCompanySuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [jobPostUrl, setJobPostUrl] = useState('')
  const [position, setPosition] = useState('')
  const [applyDate, setApplyDate] = useState('')
  const [scheduleLabel, setScheduleLabel] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [source, setSource] = useState('')
  const [searchText, setSearchText] = useState('')
  const [filterStatus, setFilterStatus] = useState('전체')
  const [submitting, setSubmitting] = useState(false)

  const [openFormId, setOpenFormId] = useState(null)
  const [reflectionText, setReflectionText] = useState('')
  const [reflecting, setReflecting] = useState(false)

  const [openListId, setOpenListId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [editingReflectionId, setEditingReflectionId] = useState(null)
  const [editReflectionText, setEditReflectionText] = useState('')
  const [updatingReflection, setUpdatingReflection] = useState(false)
  const [reflectionsByApp, setReflectionsByApp] = useState({})
  const [report, setReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [companyInsight, setCompanyInsight] = useState(null)
  const [companyInsightLoading, setCompanyInsightLoading] = useState(false)
  const [insightAppId, setInsightAppId] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [rehearsalContext, setRehearsalContext] = useState(null)
  const [positionInsight, setPositionInsight] = useState(null)
  const [positionInsightLoading, setPositionInsightLoading] = useState(false)
  const [positionInsightAppId, setPositionInsightAppId] = useState(null)
  const [checkedItems, setCheckedItems] = useState({})
  const [rehearsal, setRehearsal] = useState(null)
  const [rehearsalAnswer, setRehearsalAnswer] = useState('')
  const [followUpQuestion, setFollowUpQuestion] = useState(null)
  const [followUpAnswer, setFollowUpAnswer] = useState('')
  const [rehearsalLoading, setRehearsalLoading] = useState(false)
  const [rehearsalFeedback, setRehearsalFeedback] = useState(null)

  function toggleCheck(index) {
    setCheckedItems((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  async function startRehearsal(tag) {
    setRehearsalContext({ type: 'report' })
    setRehearsalLoading(true)
    setRehearsal(null)
    setFollowUpQuestion(null)
    setRehearsalFeedback(null)
    setRehearsalAnswer('')
    setFollowUpAnswer('')
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/rehearsal/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag }),
      })
      const data = await res.json()
      setRehearsal(data)
    } catch (err) {
      alert('질문 생성 중 오류가 발생했어요')
    } finally {
      setRehearsalLoading(false)
    }
  }

  async function startRehearsalFromInsight(question, appId) {
    setRehearsalContext({ type: 'insight', appId })
    setRehearsalLoading(true)
    setRehearsal(null)
    setFollowUpQuestion(null)
    setRehearsalFeedback(null)
    setRehearsalAnswer('')
    setFollowUpAnswer('')
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/rehearsal/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, tag: '다른 지원자 공통 질문' }),
      })
      const data = await res.json()
      setRehearsal(data)
    } catch (err) {
      alert('연습 시작 중 오류가 발생했어요')
    } finally {
      setRehearsalLoading(false)
    }
  }

  function renderRehearsalCard() {
    return (
      <div className="rehearsal-card">
        {rehearsal.source_reflections && rehearsal.source_reflections.length > 0 && (
          <div className="source-quote-box">
            <p className="source-quote-label">이 질문은 당신의 이 회고를 참고했어요</p>
            {rehearsal.source_reflections.map((text, i) => (
              <p className="source-quote" key={i}>"{text}"</p>
            ))}
          </div>
        )}
        <p className="rehearsal-question">Q. {rehearsal.question}</p>

        {!followUpQuestion && !rehearsalFeedback && (
          <>
            <textarea
              placeholder="이 질문에 어떻게 답하시겠어요?"
              value={rehearsalAnswer}
              onChange={(e) => setRehearsalAnswer(e.target.value)}
              rows={4}
            />
            <button type="button" onClick={submitFirstAnswer} disabled={rehearsalLoading}>
              {rehearsalLoading ? '면접관이 생각 중...' : '답변 제출'}
            </button>
          </>
        )}

        {followUpQuestion && !rehearsalFeedback && (
          <div className="followup-block">
            <p className="rehearsal-question followup">Q2. {followUpQuestion}</p>
            <textarea
              placeholder="꼬리질문에 답해보세요"
              value={followUpAnswer}
              onChange={(e) => setFollowUpAnswer(e.target.value)}
              rows={4}
            />
            <button type="button" onClick={submitFollowUpAnswer} disabled={rehearsalLoading}>
              {rehearsalLoading ? '피드백 준비 중...' : '답변 제출하고 피드백 받기'}
            </button>
          </div>
        )}

        {rehearsalFeedback && (
          <div className="rehearsal-feedback">
            <p className="feedback-label">AI 피드백</p>
            <p>{rehearsalFeedback}</p>
          </div>
        )}
      </div>
    )
  }

  async function submitFirstAnswer() {
    if (!rehearsalAnswer.trim()) return
    setRehearsalLoading(true)
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/rehearsal/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rehearsal_id: rehearsal.id, answer: rehearsalAnswer }),
      })
      const data = await res.json()
      setFollowUpQuestion(data.follow_up_question)
    } catch (err) {
      alert('꼬리질문 생성 중 오류가 발생했어요')
    } finally {
      setRehearsalLoading(false)
    }
  }

  async function submitFollowUpAnswer() {
    if (!followUpAnswer.trim()) return
    setRehearsalLoading(true)
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/rehearsal/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rehearsal_id: rehearsal.id, follow_up_answer: followUpAnswer }),
      })
      const data = await res.json()
      setRehearsalFeedback(data.feedback)
    } catch (err) {
      alert('피드백 생성 중 오류가 발생했어요')
    } finally {
      setRehearsalLoading(false)
    }
  }

  async function authFetch(url, options = {}) {
    const token = session?.access_token
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    })
  }

  async function fetchApplications() {
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/applications`)
      if (!res.ok) throw new Error('불러오기 실패')
      const data = await res.json()
      setApplications(data)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function fetchReflectionsForApp(applicationId) {
    const res = await authFetch(
      `${import.meta.env.VITE_API_URL}/applications/${applicationId}/reflections`
    )
    const data = await res.json()
    setReflectionsByApp((prev) => ({ ...prev, [applicationId]: data }))
  }

  async function fetchAllReflections(apps) {
    for (const app of apps) {
      await fetchReflectionsForApp(app.id)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return

    async function init() {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/applications`)
      const data = await res.json()
      setApplications(data)
      setLoading(false)
      await fetchAllReflections(data)
    }
    init()
  }, [session])

  async function handleCompanyNameChange(value) {
    setCompanyName(value)
    if (value.trim().length < 1) {
      setCompanySuggestions([])
      return
    }
    try {
      const res = await authFetch(
        `${import.meta.env.VITE_API_URL}/companies/suggest?q=${encodeURIComponent(value)}`
      )
      const data = await res.json()
      setCompanySuggestions(data)
      setShowSuggestions(true)
    } catch (err) {
      // 추천 실패는 조용히 무시 (핵심 기능 아님)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!companyName.trim()) return

    setSubmitting(true)
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          position: position,
          apply_date: applyDate || null,
          next_schedule_date: scheduleDate || null,
          next_schedule_label: scheduleLabel || null,
          source: source || null,
          job_post_url: jobPostUrl || null,
        }),
      })
      if (!res.ok) throw new Error('저장 실패')

      setCompanyName('')
      setPosition('')
      setApplyDate('')
      setScheduleLabel('')
      setScheduleDate('')
      setSource('')
      setJobPostUrl('')
      await fetchApplications()
    } catch (err) {
      alert('저장 중 오류가 발생했어요: ' + err.message)
    }
    setSubmitting(false)
  }

  async function handleStatusChange(applicationId, newStatus) {
    const res = await authFetch(
      `${import.meta.env.VITE_API_URL}/applications/${applicationId}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      }
    )
    if (res.ok) {
      setApplications((prev) =>
        prev.map((app) =>
          app.id === applicationId ? { ...app, status: newStatus } : app
        )
      )
    }
  }

  async function handleDeleteApplication(applicationId) {
    const confirmed = window.confirm('이 지원 카드를 삭제할까요? 관련 회고도 함께 삭제돼요.')
    if (!confirmed) return

    const res = await authFetch(`${import.meta.env.VITE_API_URL}/applications/${applicationId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      await fetchApplications()
    } else {
      alert('삭제 중 오류가 발생했어요')
    }
  }

  function startEdit(app) {
    setEditingId(app.id)
    setEditData({
      company_name: app.company_name,
      position: app.position || '',
      apply_date: app.apply_date || '',
    })
  }

  async function handleUpdateApplication(applicationId, original) {
    const res = await authFetch(`${import.meta.env.VITE_API_URL}/applications/${applicationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: editData.company_name,
        position: editData.position || null,
        apply_date: editData.apply_date || null,
        next_schedule_date: original.next_schedule_date || null,
        next_schedule_label: original.next_schedule_label || null,
        source: original.source || null,
      }),
    })
    if (res.ok) {
      setEditingId(null)
      await fetchApplications()
    } else {
      alert('수정 중 오류가 발생했어요')
    }
  }

  async function handleAddReflection(applicationId) {
    if (!reflectionText.trim()) return
    setReflecting(true)

    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/reflections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: applicationId,
          raw_text: reflectionText,
        }),
      })

      if (!res.ok) throw new Error('저장 실패')

      setReflectionText('')
      setOpenFormId(null)
      setOpenListId(applicationId)
      await fetchReflectionsForApp(applicationId)
      await fetchApplications()
    } catch (err) {
      alert('저장 중 오류가 발생했어요: ' + err.message)
    } finally {
      setReflecting(false)
    }
  }

  async function handleDeleteReflection(reflectionId, applicationId) {
    const confirmed = window.confirm('이 회고를 삭제할까요?')
    if (!confirmed) return

    const res = await authFetch(`${import.meta.env.VITE_API_URL}/reflections/${reflectionId}`, {
      method: 'DELETE',
    })

    if (!res.ok) {
      alert('삭제 중 오류가 발생했어요')
    } else {
      await fetchReflectionsForApp(applicationId)
    }
  }

  function startEditReflection(reflection) {
    setEditingReflectionId(reflection.id)
    setEditReflectionText(reflection.raw_text || '')
  }

  async function handleUpdateReflection(reflectionId, applicationId) {
    if (!editReflectionText.trim()) return
    setUpdatingReflection(true)
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/reflections/${reflectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: editReflectionText, application_id: applicationId }),
      })
      if (!res.ok) throw new Error('수정 실패')

      setEditingReflectionId(null)
      await fetchReflectionsForApp(applicationId)
      await fetchApplications()
    } catch (err) {
      alert('수정 중 오류가 발생했어요: ' + err.message)
    } finally {
      setUpdatingReflection(false)
    }
  }

  async function handleViewReport() {
    setReportLoading(true)
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/report`)
      const data = await res.json()
      setReport(data)
    } catch (err) {
      alert('리포트를 불러오는 중 오류가 발생했어요')
    } finally {
      setReportLoading(false)
    }
  }

  async function viewCompanyInsight(app) {
    setInsightAppId(app.id)
    setCompanyInsightLoading(true)
    setCompanyInsight(null)
    try {
      const res = await authFetch(
        `${import.meta.env.VITE_API_URL}/company-insights/${encodeURIComponent(app.company_name)}`
      )
      const data = await res.json()
      setCompanyInsight(data)
    } catch (err) {
      alert('인사이트를 불러오는 중 오류가 발생했어요')
    } finally {
      setCompanyInsightLoading(false)
    }
  }

  async function viewPositionInsight(app) {
    setPositionInsightAppId(app.id)
    setPositionInsightLoading(true)
    setPositionInsight(null)
    try {
      const res = await authFetch(
        `${import.meta.env.VITE_API_URL}/position-insights/${encodeURIComponent(app.position)}`
      )
      const data = await res.json()
      setPositionInsight(data)
    } catch (err) {
      alert('인사이트를 불러오는 중 오류가 발생했어요')
    } finally {
      setPositionInsightLoading(false)
    }
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}월 ${d.getDate()}일`
  }

  function getDday(dateStr) {
    if (!dateStr) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(dateStr)
    const diff = Math.round((target - today) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'D-day'
    if (diff > 0) return `D-${diff}`
    return `D+${Math.abs(diff)}`
  }

  async function handleAuthSubmit(e) {
    e.preventDefault()
    setAuthError('')

    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword })
      if (error) setAuthError(error.message)
      else setAuthError('가입 완료! 이메일을 확인해서 인증해주세요. (또는 바로 로그인 시도해보세요)')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      if (error) setAuthError(error.message)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (authLoading) {
    return <div className="auth-loading">불러오는 중...</div>
  }

  if (!session) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <h1 className="auth-title">취준 회고 저널</h1>
          <p className="auth-subtitle">오늘의 지원을 기록하고, 내일의 패턴을 발견해요</p>

          <form onSubmit={handleAuthSubmit} className="auth-form">
            <input
              type="email"
              placeholder="이메일"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="비밀번호 (6자 이상)"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
            />
            <button type="submit">{authMode === 'login' ? '로그인' : '회원가입'}</button>
          </form>

          {authError && <p className="auth-error">{authError}</p>}

          <button
            type="button"
            className="auth-switch"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'signup' : 'login')
              setAuthError('')
            }}
          >
            {authMode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <header className="journal-header">
        <div className="header-top">
          <div>
            <h1>취준 회고 저널</h1>
            <p>오늘의 지원을 기록하고, 내일의 패턴을 발견해요</p>
          </div>
          <button type="button" className="logout-btn" onClick={handleLogout}>로그아웃</button>
        </div>
      </header>

      {!loading && !error && applications.length === 0 && (
        <div className="onboarding-state">
          <p className="onboarding-title">취준 회고 저널에 오신 걸 환영해요 👋</p>
          <p className="onboarding-desc">
            이 서비스는 이렇게 도와드려요
          </p>
          <ul className="onboarding-steps">
            <li>
              <span className="onboarding-num">1</span>
              <div>
                <strong>지원 카드를 등록</strong>하고 회사별 진행 상황을 한눈에 관리하세요
              </div>
            </li>
            <li>
              <span className="onboarding-num">2</span>
              <div>
                면접 후 <strong>편하게 회고를 남기면</strong>, AI가 자동으로 정리해드려요
              </div>
            </li>
            <li>
              <span className="onboarding-num">3</span>
              <div>
                회고가 쌓이면 <strong>AI 패턴 분석</strong>과 <strong>약점 리허설</strong>로 다음 면접을 준비하세요
              </div>
            </li>
            <li>
              <span className="onboarding-num">4</span>
              <div>
                같은 회사 지원자가 쌓이면 <strong>다른 사람들이 자주 받은 질문</strong>도 확인할 수 있어요
              </div>
            </li>
          </ul>
          <p className="onboarding-cta">아래에서 첫 지원 카드를 등록해보세요 ↓</p>
        </div>
      )}

      {applications.length > 0 && (
        <div className="summary-bar">
          <div className="summary-item">
            <span className="summary-number">{applications.length}</span>
            <span className="summary-label">총 지원</span>
          </div>
          <div className="summary-item">
            <span className="summary-number">
              {applications.filter((a) => a.status === '서류중' || a.status === '면접중').length}
            </span>
            <span className="summary-label">진행중</span>
          </div>
          <div className="summary-item">
            <span className="summary-number">
              {applications.filter((a) => a.status === '최종합격').length}
            </span>
            <span className="summary-label">합격</span>
          </div>
          <div className="summary-item">
            <span className="summary-number">
              {applications.filter((a) => a.status === '불합격').length}
            </span>
            <span className="summary-label">불합격</span>
          </div>
        </div>
      )}

      {applications.filter((a) => a.next_schedule_date).length > 0 && (
        <div className="upcoming-section">
          <h3>다가오는 일정</h3>
          <ul className="upcoming-list">
            {applications
              .filter((a) => a.next_schedule_date)
              .sort((a, b) => new Date(a.next_schedule_date) - new Date(b.next_schedule_date))
              .map((a) => (
                <li key={a.id}>
                  <span className="dday">{getDday(a.next_schedule_date)}</span>
                  {a.company_name} · {a.next_schedule_label}
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="report-section">
        <button type="button" className="report-btn" onClick={handleViewReport} disabled={reportLoading}>
          {reportLoading ? '분석하는 중...' : '📊 내 패턴 분석 리포트 보기'}
        </button>

        {report && (
          <div className="report-card">
            {report.enough_data ? (
              <>
                <p>{report.summary}</p>
                {report.checklist && report.checklist.length > 0 && (
                  <div className="checklist">
                    <p className="checklist-title">다음 면접 전 체크리스트</p>
                    <ul>
                      {report.checklist.map((item, i) => (
                        <li key={i}>
                          <label>
                            <input
                              type="checkbox"
                              checked={!!checkedItems[i]}
                              onChange={() => toggleCheck(i)}
                            />
                            <span className={checkedItems[i] ? 'checked-text' : ''}>{item}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rehearsal-section">
                  <p className="checklist-title">약점 리허설</p>
                  <div className="tag-buttons">
                    {Object.keys(report.stats.tag_counts).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="tag-practice-btn"
                        onClick={() => startRehearsal(tag)}
                      >
                        {tag} 연습하기
                      </button>
                    ))}
                  </div>

                  {rehearsalLoading && !rehearsal && rehearsalContext?.type === 'report' && (
                    <p className="rehearsal-loading">질문 준비 중...</p>
                  )}

                  {rehearsal && rehearsalContext?.type === 'report' && renderRehearsalCard()}
                </div>
              </>
            ) : (
              <p className="report-empty">{report.message}</p>
            )}
          </div>
        )}
      </div>

      <form className="add-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="company-input-wrapper">
            <input
              type="text"
              placeholder="회사명 (필수)"
              value={companyName}
              onChange={(e) => handleCompanyNameChange(e.target.value)}
              onFocus={() => companySuggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              required
            />
            {showSuggestions && companySuggestions.length > 0 && (
              <ul className="company-suggestions">
                {companySuggestions.map((name) => (
                  <li
                    key={name}
                    onMouseDown={() => {
                      setCompanyName(name)
                      setShowSuggestions(false)
                    }}
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <input
            type="text"
            placeholder="직무"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
          <input
            type="date"
            value={applyDate}
            onChange={(e) => setApplyDate(e.target.value)}
          />
        </div>
        <div className="form-row">
          <input
            type="url"
            placeholder="공고 링크 (선택)"
            value={jobPostUrl}
            onChange={(e) => setJobPostUrl(e.target.value)}
          />
        </div>
        <div className="form-row">
          <input
            type="text"
            placeholder="다음 일정 (예: 1차 면접)"
            value={scheduleLabel}
            onChange={(e) => setScheduleLabel(e.target.value)}
          />
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
          />
        </div>
        <div className="form-row">
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">지원 출처 선택</option>
            <option value="사람인">사람인</option>
            <option value="잡코리아">잡코리아</option>
            <option value="원티드">원티드</option>
            <option value="자체 채용페이지">자체 채용페이지</option>
            <option value="기타">기타</option>
          </select>
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? '저장 중...' : '+ 지원 기록하기'}
        </button>
      </form>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="회사명 검색"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="search-input"
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="전체">전체 상태</option>
          <option value="지원함">지원함</option>
          <option value="서류중">서류중</option>
          <option value="면접중">면접중</option>
          <option value="최종합격">최종합격</option>
          <option value="불합격">불합격</option>
        </select>
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p>에러 발생: {error}</p>}

      {!loading && applications.length > 0 && (() => {
        const filtered = applications.filter((app) => {
          const matchesSearch = app.company_name.toLowerCase().includes(searchText.toLowerCase())
          const matchesStatus = filterStatus === '전체' || app.status === filterStatus
          return matchesSearch && matchesStatus
        })

        if (filtered.length === 0) {
          return <p className="no-result">조건에 맞는 지원 카드가 없어요</p>
        }

        return (
        <ul className="card-list">
          {filtered.map((app) => {
            const reflections = reflectionsByApp[app.id] || []
            return (
              <li key={app.id} className="app-card-wrapper">
                <div className="app-card">
                  {editingId === app.id ? (
                    <div className="edit-row">
                      <input
                        type="text"
                        value={editData.company_name}
                        onChange={(e) => setEditData({ ...editData, company_name: e.target.value })}
                      />
                      <input
                        type="text"
                        value={editData.position}
                        onChange={(e) => setEditData({ ...editData, position: e.target.value })}
                      />
                      <button type="button" onClick={() => handleUpdateApplication(app.id, app)}>저장</button>
                      <button type="button" onClick={() => setEditingId(null)}>취소</button>
                    </div>
                  ) : (
                    <div>
                      <span className="company">{app.company_name}</span>
                      {app.position && <span className="position"> · {app.position}</span>}
                      {app.source && <span className="source-tag">{app.source}</span>}
                      {app.job_post_url && (
                        <a href={app.job_post_url} target="_blank" rel="noreferrer" className="link-icon">🔗</a>
                      )}
                    </div>
                  )}
                  <div className="card-actions">
                    <select
                      className="status-tag status-select"
                      value={app.status}
                      onChange={(e) => handleStatusChange(app.id, e.target.value)}
                    >
                      <option value="지원함">지원함</option>
                      <option value="서류중">서류중</option>
                      <option value="면접중">면접중</option>
                      <option value="최종합격">최종합격</option>
                      <option value="불합격">불합격</option>
                    </select>
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() =>
                        setOpenListId(openListId === app.id ? null : app.id)
                      }
                    >
                      회고 {reflections.length}개
                    </button>
                    <button
                      type="button"
                      className="reflect-btn"
                      onClick={() =>
                        setOpenFormId(openFormId === app.id ? null : app.id)
                      }
                    >
                      회고 작성
                    </button>
                    <button
                      type="button"
                      className="more-btn"
                      onClick={() => setOpenMenuId(openMenuId === app.id ? null : app.id)}
                    >
                      ⋯
                    </button>
                  </div>

                  {openMenuId === app.id && (
                    <div className="secondary-actions">
                      <button type="button" className="text-btn" onClick={() => startEdit(app)}>
                        수정
                      </button>
                      <button type="button" className="text-btn danger" onClick={() => handleDeleteApplication(app.id)}>
                        삭제
                      </button>
                      <button
                        type="button"
                        className="text-btn insight-btn"
                        onClick={() => viewCompanyInsight(app)}
                      >
                        이 회사 지원자 인사이트
                      </button>
                      {app.position && (
                        <button
                          type="button"
                          className="text-btn insight-btn"
                          onClick={() => viewPositionInsight(app)}
                        >
                          이 직무 지원자 인사이트
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {openListId === app.id && (
                  <div className="reflection-list">
                    {reflections.length === 0 ? (
                      <p className="no-reflection">아직 남긴 회고가 없어요</p>
                    ) : (
                      reflections.map((r) => (
                        <div key={r.id} className="reflection-entry">
                          {editingReflectionId === r.id ? (
                            <div className="reflection-edit">
                              <textarea
                                value={editReflectionText}
                                onChange={(e) => setEditReflectionText(e.target.value)}
                                rows={3}
                              />
                              <div className="reflection-edit-actions">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReflection(r.id, app.id)}
                                  disabled={updatingReflection}
                                >
                                  {updatingReflection ? 'AI 재분석 중...' : '저장'}
                                </button>
                                <button type="button" onClick={() => setEditingReflectionId(null)}>
                                  취소
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="entry-top">
                                <span className="entry-date">{formatDate(r.recorded_at)}</span>
                                <span className="mini-tag">{r.stage}</span>
                                <span className="mini-tag">{r.result}</span>
                                {r.reason_tags?.split(',').filter(Boolean).map((t) => (
                                  <span className="mini-tag" key={t}>{t}</span>
                                ))}
                                <button
                                  type="button"
                                  className="delete-btn"
                                  onClick={() => startEditReflection(r)}
                                >
                                  수정
                                </button>
                                <button
                                  type="button"
                                  className="delete-btn"
                                  onClick={() => handleDeleteReflection(r.id, app.id)}
                                >
                                  삭제
                                </button>
                              </div>
                              <p className="entry-memo">{r.memo}</p>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {insightAppId === app.id && (
                  <div className="company-insight-box">
                    {companyInsightLoading ? (
                      <p className="insight-loading">다른 지원자 데이터를 모으는 중...</p>
                    ) : companyInsight?.enough_data ? (
                      <>
                        <p className="insight-header">
                          {app.company_name} 지원자 {companyInsight.applicant_count}명의 공통 경향
                        </p>
                        <p>{companyInsight.summary}</p>
                        {companyInsight.common_questions && companyInsight.common_questions.length > 0 && (
                          <div className="common-questions">
                            <p className="common-q-label">자주 나온 질문 유형</p>
                            <ul>
                              {companyInsight.common_questions.map((q, i) => (
                                <li key={i}>
                                  {q}
                                  <button
                                    type="button"
                                    className="practice-this-btn"
                                    onClick={() => startRehearsalFromInsight(q, app.id)}
                                  >
                                    이 질문으로 연습하기
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {rehearsalLoading && rehearsalContext?.type === 'insight' && rehearsalContext.appId === app.id && (
                          <p className="rehearsal-loading">연습 준비 중...</p>
                        )}

                        {rehearsal && rehearsalContext?.type === 'insight' && rehearsalContext.appId === app.id && renderRehearsalCard()}
                      </>
                    ) : (
                      <p className="insight-empty">{companyInsight?.message}</p>
                    )}
                  </div>
                )}
                {positionInsightAppId === app.id && (
                  <div className="company-insight-box position-box">
                    {positionInsightLoading ? (
                      <p className="insight-loading">다른 지원자 데이터를 모으는 중...</p>
                    ) : positionInsight?.enough_data ? (
                      <>
                        <p className="insight-header">
                          {app.position} 직무 지원자 {positionInsight.applicant_count}명의 공통 경향
                        </p>
                        <p>{positionInsight.summary}</p>
                        {positionInsight.common_questions && positionInsight.common_questions.length > 0 && (
                          <div className="common-questions">
                            <p className="common-q-label">자주 나온 질문 유형</p>
                            <ul>
                              {positionInsight.common_questions.map((q, i) => (
                                <li key={i}>{q}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="insight-empty">{positionInsight?.message}</p>
                    )}
                  </div>
                )}

                {openFormId === app.id && (
                  <div className="reflection-form">
                    <textarea
                      placeholder="오늘 어떤 전형을 봤고, 어떻게 느꼈는지 편하게 적어주세요"
                      value={reflectionText}
                      onChange={(e) => setReflectionText(e.target.value)}
                      rows={3}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddReflection(app.id)}
                      disabled={reflecting}
                    >
                      {reflecting ? 'AI가 정리하는 중...' : '회고 저장'}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        )
      })()}
    </div>
  )
}

export default App