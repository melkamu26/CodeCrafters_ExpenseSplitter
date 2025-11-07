import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000'

export default function Groups({ username, onOpen }) {
  const [groups, setGroups] = useState([])
  const [groupName, setGroupName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [message, setMessage] = useState('')

  const loadGroups = async () => {
    try {
      const r = await fetch(`${API}/api/groups/list?user=${encodeURIComponent(username)}`)
      const d = await r.json()
      const list = Array.isArray(d) ? d : []
      setGroups(list)
      if (list.length && !selectedGroupId) setSelectedGroupId(String(list[0].id))
    } catch {
      setMessage('❌ Failed to connect to server')
    }
  }

  useEffect(() => { loadGroups() }, [username])

  const createGroup = async () => {
    if (!groupName) { setMessage('❌ Enter group name'); return }
    try {
      const r = await fetch(`${API}/api/groups/create`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ groupName, username })
      })
      const d = await r.json().catch(()=>({}))
      if (r.ok) { setMessage('✅ Group created'); setGroupName(''); loadGroups() }
      else setMessage('❌ ' + (d.error || 'Failed'))
    } catch { setMessage('❌ Failed to connect to server') }
  }

  const addMember = async () => {
    if (!selectedGroupId) { setMessage('❌ Select a group'); return }
    if (!memberName) { setMessage('❌ Enter member username'); return }
    try {
      const r = await fetch(`${API}/api/groups/add-member`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ groupId: selectedGroupId, memberName })
      })
      const d = await r.json().catch(()=>({}))
      if (r.ok) { 
        setMessage('Member added'); 
        setMemberName('');
        loadGroups();
      }
      else setMessage('❌ ' + (d.error || 'Failed'))
    } catch { setMessage('❌ Failed to connect to server') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="title">Groups</h1>
          <p className="subtitle">Create new groups and manage members</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">Create a New Group</div>
          <div className="form-group">
            <label className="form-label">Group Name</label>
            <input
              className="input large-input"
              placeholder="Enter group name"
              value={groupName}
              onChange={e=>setGroupName(e.target.value)}
            />
            <button className="btn wide-btn" onClick={createGroup}>Create Group</button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Add Member to Group</div>
          <div className="form-group">
            <label className="form-label">Select Group</label>
            <select
              className="input large-input"
              value={selectedGroupId}
              onChange={e=>setSelectedGroupId(e.target.value)}
            >
              <option value="" disabled>Select group</option>
              {groups.map(g=> <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>

            <label className="form-label">Member Username</label>
            <input
              className="input large-input"
              placeholder="Enter member username"
              value={memberName}
              onChange={e=>setMemberName(e.target.value)}
            />

            <button className="btn wide-btn" onClick={addMember}>Add Member</button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Your Groups</div>
        {groups.length===0 ? (
          <div className="empty">No groups yet</div>
        ) : (
          <ul className="cards">
            {groups.map(g => (
              <li key={g.id} className="card-item">
                <div className="card-title">{g.name}</div>
                <div className="card-sub">Owner: {g.owner}</div>
                <div className="card-sub" style={{ marginTop: '6px' }}>
                  Members:
                  {Array.isArray(g.members) && g.members.length > 0 ? (
                    <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                      {g.members.map((m, i) => (
                        <li key={i} style={{ listStyle: 'disc' }}>{m}</li>
                      ))}
                    </ul>
                  ) : (
                    <span> none yet</span>
                  )}
                </div>
                <button
                  className="btn"
                  style={{ marginTop: 10, width: '100%' }}
                  onClick={() => onOpen(g)}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {message && <div className={`toast ${message.includes('✅')?'ok':'err'}`}>{message}</div>}
    </div>
  )
}