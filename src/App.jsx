import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [companyName, setCompanyName] = useState('')
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
  const [reflectionsByApp, setReflectionsByApp] = useState({})
  const [report, setReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)

  async function fetchApplications() {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/applications`)
      if (!res.ok) throw new Error('불러오기 실패')
      const data = await res.json()
      setApplications(data)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function fetchReflectionsForApp(applicationId) {
    const res = await fetch(
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
    async function init() {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/applications`)
      const data = await res.json()
      setApplications(data)
      setLoading(false)
      await fetchAllReflections(data)
    }
    init()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!companyName.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          position: position,
          apply_date: applyDate || null,
          next_schedule_date: scheduleDate || null,
          next_schedule_label: scheduleLabel || null,
          source: source || null,
        }),
      })
      if (!res.ok) throw new Error('저장 실패')

      setCompanyName('')
      setPosition('')
      setApplyDate('')
      setScheduleLabel('')
      setScheduleDate('')
      setSource('')
      await fetchApplications()
    } catch (err) {
      alert('저장 중 오류가 발생했어요: ' + err.message)
    }
    setSubmitting(false)
  }

  async function handleStatusChange(applicationId, newStatus) {
    const res = await fetch(
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

  async function handleAddReflection(applicationId) {
    if (!reflectionText.trim()) return
    setReflecting(true)

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/reflections`, {
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
    } catch (err) {
      alert('저장 중 오류가 발생했어요: ' + err.message)
    } finally {
      setReflecting(false)
    }
  }

  async function handleDeleteReflection(reflectionId, applicationId) {
    const confirmed = window.confirm('이 회고를 삭제할까요?')
    if (!confirmed) return

    const res = await fetch(`${import.meta.env.VITE_API_URL}/reflections/${reflectionId}`, {
      method: 'DELETE',
    })

    if (!res.ok) {
      alert('삭제 중 오류가 발생했어요')
    } else {
      await fetchReflectionsForApp(applicationId)
    }
  }

  async function handleViewReport() {
    setReportLoading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/report`)
      const data = await res.json()
      setReport(data)
    } catch (err) {
      alert('리포트를 불러오는 중 오류가 발생했어요')
    } finally {
      setReportLoading(false)
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

  return (
    <div>
      <header className="journal-header">
        <h1>취준 회고 저널</h1>
        <p>오늘의 지원을 기록하고, 내일의 패턴을 발견해요</p>
      </header>

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
              <p>{report.summary}</p>
            ) : (
              <p className="report-empty">{report.message}</p>
            )}
          </div>
        )}
      </div>

      <form className="add-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <input
            type="text"
            placeholder="회사명 (필수)"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
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

      {!loading && !error && applications.length === 0 && (
        <div className="empty-state">
          <strong>아직 기록된 지원이 없어요</strong>
          첫 지원 카드를 추가하면 여기에 쌓이기 시작해요
        </div>
      )}

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
                  <div>
                    <span className="company">{app.company_name}</span>
                    {app.position && <span className="position"> · {app.position}</span>}
                    {app.source && <span className="source-tag">{app.source}</span>}
                  </div>
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
                  </div>
                </div>

                {openListId === app.id && (
                  <div className="reflection-list">
                    {reflections.length === 0 ? (
                      <p className="no-reflection">아직 남긴 회고가 없어요</p>
                    ) : (
                      reflections.map((r) => (
                        <div key={r.id} className="reflection-entry">
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
                              onClick={() => handleDeleteReflection(r.id, app.id)}
                            >
                              삭제
                            </button>
                          </div>
                          <p className="entry-memo">{r.memo}</p>
                        </div>
                      ))
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