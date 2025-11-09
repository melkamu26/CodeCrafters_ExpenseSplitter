import { useEffect, useMemo, useState } from 'react'

const API = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000'

export default function GroupDetails({ username, group, onPickGroup, titleOverride = 'Add Expenses' }) {
  const [groups, setGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState(group?.id || '')
  const [selectedGroup, setSelectedGroup] = useState(group || null)

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [paidBy, setPaidBy] = useState(username || '')
  const [splitType, setSplitType] = useState('equal')
  const [splitMembers, setSplitMembers] = useState([])
  const [notes, setNotes] = useState('')

  const [message, setMessage] = useState('')
  const [expenses, setExpenses] = useState([])

  const canSubmit = selectedGroupId && title && amount

  const currency = (v) =>
    Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(v || 0)

  const members = useMemo(() => selectedGroup?.members || [], [selectedGroup])

  const normalizeDate = (v) => {
    if (!v) return new Date().toISOString().slice(0, 10)
    // already yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
    // mm/dd/yyyy or m/d/yy
    const m = v.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
    if (m) {
      let [_, mm, dd, yy] = m
      if (yy.length === 2) yy = '20' + yy
      const D = new Date(Number(yy), Number(mm) - 1, Number(dd))
      if (!isNaN(D.getTime())) return D.toISOString().slice(0, 10)
    }
    // fallback: today
    return new Date().toISOString().slice(0, 10)
  }

  const loadGroups = async () => {
    try {
      const r = await fetch(`${API}/api/groups/list?user=${encodeURIComponent(username)}`)
      const d = await r.json()
      const list = Array.isArray(d) ? d : []
      setGroups(list)
      if (!selectedGroupId && list.length) setSelectedGroupId(String(list[0].id))
    } catch {
      setMessage('❌ Failed to load groups')
    }
  }

  const loadExpenses = async (gid) => {
    if (!gid) return
    try {
      const r = await fetch(`${API}/api/expenses/list?groupId=${encodeURIComponent(gid)}`)
      const d = await r.json()
      setExpenses(Array.isArray(d) ? d : [])
    } catch {
      setMessage('❌ Failed to load expenses')
    }
  }

  // initial groups + prefill from session receipt
  useEffect(() => {
    loadGroups()
    const raw = sessionStorage.getItem('receiptData')
    if (raw) {
      try {
        const rd = JSON.parse(raw)
        if (rd) {
          setTitle(rd.category || 'Purchase')
          if (rd.amount != null) setAmount(String(rd.amount))
          setDate(normalizeDate(rd.date))
          setNotes((rd.lineItems && rd.lineItems.length)
            ? rd.lineItems.map(li => `${li.name} - $${(li.price ?? '').toString()}`).join('; ')
            : '')
        }
      } catch {}
      sessionStorage.removeItem('receiptData')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username])

  // if a group was passed from "Open" button
  useEffect(() => {
    if (group?.id) setSelectedGroupId(String(group.id))
  }, [group?.id])

  // when selected group or groups load, sync selectedGroup, expenses, paidBy, splitMembers
  useEffect(() => {
    if (!selectedGroupId) {
      setSelectedGroup(null)
      setSplitMembers([])
      return
    }
    const g = groups.find(x => String(x.id) === String(selectedGroupId)) || null
    setSelectedGroup(g)
    loadExpenses(selectedGroupId)
    if (g?.members?.length) {
      setPaidBy(g.members.includes(username) ? username : g.members[0])
      setSplitMembers(g.members.slice())
    } else {
      setPaidBy(username || '')
      setSplitMembers([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, groups])

  const toggleMember = (m) => {
    setSplitMembers(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  const addExpense = async () => {
    if (!canSubmit) {
      setMessage('❌ Select a group and enter title & amount')
      return
    }
    let membersToSplit = splitType === 'equal' ? members : splitMembers
    if (!membersToSplit || membersToSplit.length === 0) {
      setMessage('❌ Select at least one member for split')
      return
    }
    try {
      const payload = {
        groupId: selectedGroupId,
        title,
        amount: parseFloat(amount),
        date,
        paidBy,
        split: {
          type: splitType,
          members: membersToSplit
        },
        notes
      }
      const r = await fetch(`${API}/api/expenses/create`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        setMessage('✅ Expense added')
        setTitle('')
        setAmount('')
        setNotes('')
        loadExpenses(selectedGroupId)
      } else {
        setMessage('❌ ' + (d.error || 'Failed'))
      }
    } catch {
      setMessage('❌ Failed to connect to server')
    }
  }

  const deleteExpense = async (expenseId) => {
    if (!window.confirm('Delete this expense?')) return
    try {
      const r = await fetch(`${API}/api/expenses/delete`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ expenseId })
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        setMessage('✅ Expense deleted')
        loadExpenses(selectedGroupId)
      } else {
        setMessage('❌ ' + (d.error || 'Failed to delete'))
      }
    } catch {
      setMessage('❌ Failed to connect to server')
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="title">{titleOverride}</h1>
          <p className="subtitle">
            {selectedGroup ? `Owner: ${selectedGroup.owner}` : 'Select a group to begin'}
          </p>
        </div>
      </div>

      <div className="panel" style={{ padding: 12 }}>
        <label className="form-label">Select Group</label>
        <select
          className="input large-input"
          value={selectedGroupId}
          onChange={e => setSelectedGroupId(e.target.value)}
        >
          <option value="" disabled>Select group…</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">Add Expense</div>
          <div className="form-group" style={{ display: 'grid', gap: 12 }}>
            <label className="form-label">Title</label>
            <input
              className="input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Dinner, Uber, Rent..."
              disabled={!selectedGroupId}
            />

            <label className="form-label">Amount</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={!selectedGroupId}
            />

            <label className="form-label">Date</label>
            <input
              className="input"
              type="date"
              value={date}
              onChange={e => setDate(normalizeDate(e.target.value))}
              disabled={!selectedGroupId}
            />

            <label className="form-label">Paid By</label>
            <select
              className="input"
              value={paidBy}
              onChange={e => setPaidBy(e.target.value)}
              disabled={!selectedGroupId}
            >
              <option value="">Select member</option>
              {members.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <label className="form-label">Split Type</label>
            <select
              className="input"
              value={splitType}
              onChange={e => setSplitType(e.target.value)}
              disabled={!selectedGroupId}
            >
              <option value="equal">Equal (All Members)</option>
              <option value="custom">Custom (Select Members)</option>
            </select>

            {splitType === 'custom' && members.length > 0 && (
              <div style={{
                marginTop: 8, padding: 12, backgroundColor: '#1e293b',
                borderRadius: 8, display: 'grid', gap: 8
              }}>
                <label className="form-label">Select Members to Split With</label>
                {members.map(mem => (
                  <label key={mem} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0' }}>
                    <input
                      type="checkbox"
                      checked={splitMembers.includes(mem)}
                      onChange={() => toggleMember(mem)}
                    />
                    {mem}
                  </label>
                ))}
              </div>
            )}

            <label className="form-label">Notes</label>
            <input
              className="input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="optional"
              disabled={!selectedGroupId}
            />

            <button className="btn" onClick={addExpense} disabled={!canSubmit}>
              Add Expense
            </button>
          </div>
        </div>

        <div
          className="panel recent-expenses"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            alignItems: 'stretch',
            justifyContent: 'flex-start',
            paddingTop: 8,
            maxHeight: 480,
            overflowY: 'auto'
          }}
        >
          <div className="panel-title">Recent Expenses</div>
          {!selectedGroupId ? (
            <div className="empty">Select a group to view expenses</div>
          ) : expenses.length === 0 ? (
            <div className="empty">No expenses yet</div>
          ) : (
            <ul className="list" style={{ marginTop: 4 }}>
              {expenses.map((e, i) => (
                <li key={i} className="list-row">
                  <div className="list-main">
                    <div className="list-title">{e.title || 'Expense'}</div>
                    <div className="list-sub">
                      {new Date(e.date || Date.now()).toLocaleDateString()} <br />Paid by {e.paidBy || '-'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div className="amount neg">{currency(Math.abs(e.amount || 0))}</div>
                    <button
                      onClick={() => deleteExpense(e.id)}
                      style={{
                        background: '#dc2626',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: 55,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 800
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {message && (
        <div className={`toast ${message.includes('✅') ? 'ok' : 'err'}`}>
          {message}
        </div>
      )}
    </div>
  )
}