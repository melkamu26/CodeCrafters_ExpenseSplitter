import { useEffect, useMemo, useState } from 'react'
const API = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5050'

export default function SettlementSuggestions({ username, groupId = null }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const currency = (v) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(v || 0)

  const initials = (name = '') =>
    name.trim().split(/\s+/).slice(0,2).map(s => s[0]?.toUpperCase() || '').join('')

  const fetchData = async () => {
    setLoading(true); setErr('')
    try {
      const url = groupId
        ? `${API}/api/settlements/suggest?groupId=${encodeURIComponent(groupId)}`
        : `${API}/api/settlements/suggest?user=${encodeURIComponent(username)}`
      const r = await fetch(url)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to load suggestions')
      setData(d)
    } catch (e) {
      setErr(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [username, groupId])

  const groups = useMemo(() => {
    if (groupId && data) return [{ groupId, groupName: data.groupName, transfers: data.transfers || [] }]
    if (Array.isArray(data)) return data
    return []
  }, [data, groupId])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="title gradient-title">Settlement Suggestions</h1>
          <p className="subtitle">Smart, minimal transfers to settle up</p>
        </div>
        <div className="btn-row">
          <button className="btn ghost" onClick={fetchData} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {err && (
        <div className="panel">
          <div className="message-error">❌ {err}</div>
        </div>
      )}

      {!err && (
        <div className="settle-grid">
          {loading ? (
            <>
              <div className="panel equal-height"><div className="skeleton tall"/></div>
              <div className="panel equal-height"><div className="skeleton tall"/></div>
              <div className="panel equal-height"><div className="skeleton tall"/></div>
            </>
          ) : groups.length === 0 ? (
            <div className="panel">
              <div className="empty">No groups found.</div>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.groupId} className="panel equal-height">
                <div className="settle-head">
                  <div className="settle-title">{g.groupName}</div>
                  <div className={`badge ${g.transfers?.length ? 'warn' : 'ok'}`}>
                    {g.transfers?.length ? `${g.transfers.length} transfer${g.transfers.length>1?'s':''}` : 'All settled'}
                  </div>
                </div>

                <div className="scroll">
                  {!g.transfers || g.transfers.length === 0 ? (
                    <div className="empty small">🎉 Nothing to do here.</div>
                  ) : (
                    <ul className="settle-list">
                      {g.transfers.map((t, idx) => (
                        <li key={idx} className="settle-row">
                          <div className="who">
                            <div className="avatar">{initials(t.from)}</div>
                            <div className="name">{t.from}</div>
                            <div className="arrow">→</div>
                            <div className="avatar alt">{initials(t.to)}</div>
                            <div className="name">{t.to}</div>
                          </div>
                          <div className="amt">{currency(t.amount)}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}