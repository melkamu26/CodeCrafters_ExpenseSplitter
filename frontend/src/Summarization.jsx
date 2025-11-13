import { useEffect, useMemo, useState } from 'react'

const API = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5050'

export default function Summary({ username }) {
  const [basic, setBasic] = useState(null)
  const [ai, setAi] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiErr, setAiErr] = useState('')

  const loadBasic = async () => {
    setLoading(true); setErr('')
    try {
      const r = await fetch(`${API}/api/summary?user=${encodeURIComponent(username)}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to load summary')
      setBasic(d)
    } catch (e) {
      setErr(e.message)
    } finally { setLoading(false) }
  }

  const loadAi = async () => {
    setAiLoading(true); setAiErr('')
    try {
      const r = await fetch(`${API}/api/summary/ai?user=${encodeURIComponent(username)}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || d.details || 'AI request failed')
      setAi(d.text || '')
    } catch (e) {
      setAiErr(e.message); setAi('')
    } finally { setAiLoading(false) }
  }

  useEffect(() => { loadBasic() }, [username])

  const total = basic?.total ?? 0
  const topGroup = basic?.byGroup?.[0]?.group || '-'
  const recentCount = basic?.quick?.countRecent ?? 0
  const avgRecent = basic?.quick?.avgRecent ?? 0

  const top3 = useMemo(() => {
    if (!basic?.byGroup?.length) return []
    const list = basic.byGroup.slice(0, 3)
    const max = Math.max(...list.map(g => g.total || 0), 1)
    return list.map(g => ({ ...g, pct: Math.round(((g.total || 0) / max) * 100) }))
  }, [basic])

  const currency = (n) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n || 0)


  const renderAi = () => {
    if (!ai) return <div className="empty">Click “Get AI Summary”.</div>
    const lines = ai.split(/\r?\n/).filter(Boolean)
    const bullets = lines.filter(l => /^\s*-\s+/.test(l)).map(l => l.replace(/^\s*-\s+/, ''))
    const paras   = lines.filter(l => !/^\s*-\s+/.test(l))
    return (
      <>
        {paras.length > 0 && (
          <div className="ai-paras">
            {paras.map((t, i) => <p key={i}>{t}</p>)}
          </div>
        )}
        {bullets.length > 0 && (
          <ul className="ai-bullets">
            {bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}
      </>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="title gradient-title">Smart Summary</h1>
          <p className="subtitle">AI powered overview of your expenses</p>
        </div>
        <div className="btn-row">
          <button className="btn ghost" onClick={loadBasic} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button className="btn" onClick={loadAi} disabled={aiLoading}>
            {aiLoading ? 'Thinking…' : 'Get AI Summary'}
          </button>
        </div>
      </div>

      {err && (
        <div className="panel"><div className="message-error">❌ {err}</div></div>
      )}

      {!err && (
        <>
          {/* KPIs */}
          <div className="cards-grid">
            <div className="stat-card">
              <div className="stat-label">Total Spend</div>
              <div className="stat-value">{currency(total)}</div>
              <div className="stat-sub">Across all groups</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Top Group</div>
              <div className="stat-value smaller">{topGroup}</div>
              <div className="stat-sub">{basic?.byGroup?.length || 0} groups</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Recent Count</div>
              <div className="stat-value">{recentCount}</div>
              <div className="stat-sub">Last 10</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg (Recent)</div>
              <div className="stat-value">{currency(avgRecent)}</div>
              <div className="stat-sub">Per expense</div>
            </div>
          </div>

          {/* Overview split into two subcards; AI summary on the right */}
          <div className="grid-2">
            <div className="panel">
              <div className="panel-title">Overview</div>

              {loading ? (
                <div className="skeleton tall" />
              ) : !basic ? (
                <div className="empty">No data</div>
              ) : (
                <div className="overview-split">
                  {/* Left: Top Groups */}
                  <div className="subcard">
                    <div className="section-title">Top Groups</div>
                    {!top3.length ? (
                      <div className="empty">No group data</div>
                    ) : (
                      <div className="bar-list">
                        {top3.map((g, i) => (
                          <div key={i} className="bar-row">
                            <div className="bar-row-title">{g.group}</div>
                            <div className="bar"><div className="bar-fill" style={{ width: `${g.pct}%` }} /></div>
                            <div className="bar-value">{currency(g.total)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Recent */}
                  <div className="subcard">
                    <div className="section-title">Recent</div>
                    {Array.isArray(basic.recent) && basic.recent.length ? (
                      <ul className="list compact">
                        {basic.recent.map((e, idx) => (
                          <li key={idx} className="list-row">
                            <div className="list-main">
                              <div className="list-title">{e.title || 'Expense'}</div>
                              <div className="list-sub">
                                {new Date(e.date).toLocaleDateString()} • {e.group || '-'}
                              </div>
                            </div>
                            <div className="amount neg">{currency(e.amount)}</div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="empty">No recent expenses</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="panel ai-panel">
              <div className="panel-head">
                <div className="panel-title">AI Summary</div>
                <div className="panel-actions">
                  <button
                    className="chip"
                    onClick={() => ai && navigator.clipboard.writeText(ai)}
                    disabled={!ai}
                  >
                    Copy
                  </button>
                  <button className="chip" onClick={loadAi} disabled={aiLoading}>Regenerate</button>
                </div>
              </div>

              {aiErr && <div className="message-error" style={{ marginBottom: 8 }}>❌ {aiErr}</div>}

              {aiLoading ? (
                <div className="skeleton tall" />
              ) : (
                <div className="ai-scroll">
                  {renderAi()}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}