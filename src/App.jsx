import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

function App() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchApplications() {
      const { data, error } = await supabase
        .from('applications')
        .select('*')

      if (error) {
        setError(error.message)
      } else {
        setApplications(data)
      }
      setLoading(false)
    }

    fetchApplications()
  }, [])

  return (
    <div>
      <header className="journal-header">
        <h1>취준 회고 저널</h1>
        <p>오늘의 지원을 기록하고, 내일의 패턴을 발견해요</p>
      </header>

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
              <span className="company">{app.company_name}</span>
              <span className="status-tag">{app.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App