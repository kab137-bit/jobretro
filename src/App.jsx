import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

function App() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 폼 입력값 상태
  const [companyName, setCompanyName] = useState('')
  const [position, setPosition] = useState('')
  const [applyDate, setApplyDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function fetchApplications() {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setApplications(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchApplications()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!companyName.trim()) return

    setSubmitting(true)
    const { error } = await supabase.from('applications').insert({
      company_name: companyName,
      position: position,
      apply_date: applyDate || null,
      status: '지원함',
    })

    if (error) {
      alert('저장 중 오류가 발생했어요: ' + error.message)
    } else {
      setCompanyName('')
      setPosition('')
      setApplyDate('')
      await fetchApplications()
    }
    setSubmitting(false)
  }

  return (
    <div>
      <header className="journal-header">
        <h1>취준 회고 저널</h1>
        <p>오늘의 지원을 기록하고, 내일의 패턴을 발견해요</p>
      </header>

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
        <button type="submit" disabled={submitting}>
          {submitting ? '저장 중...' : '+ 지원 기록하기'}
        </button>
      </form>

      {loading && <p>불러오는 중...</p>}
      {error && <p>에러 발생: {error}</p>}

      {!loading && !error && applications.length === 0 && (
        <div className="empty-state">
          <strong>아직 기록된 지원이 없어요</strong>
          첫 지원 카드를 추가하면 여기에 쌓이기 시작해요
        </div>
      )}

      {!loading && applications.length > 0 && (
        <ul className="card-list">
          {applications.map((app) => (
            <li key={app.id} className="app-card">
              <div>
                <span className="company">{app.company_name}</span>
                {app.position && <span className="position"> · {app.position}</span>}
              </div>
              <span className="status-tag">{app.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App