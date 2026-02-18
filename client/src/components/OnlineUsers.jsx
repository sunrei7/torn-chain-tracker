const STATE_COLORS = {
  watching: '#4ade80',
  watching_idle: '#facc15',
  not_watching: '#666',
};

export default function OnlineUsers({ eyeStates }) {
  // eyeStates: { [userId]: { state, username } }
  // Only show users who have a WS connection (present in eyeStates)
  // Sort: watching first, then idle, then not_watching
  const ORDER = { watching: 0, watching_idle: 1, not_watching: 2 };

  const users = Object.entries(eyeStates)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (ORDER[a.state] ?? 3) - (ORDER[b.state] ?? 3));

  return (
    <div className="online-users">
      <div className="online-users__header">
        <span className="online-users__label">Online</span>
        <span className="online-users__info" tabIndex={0} aria-label="Legend">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="11" height="11">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-.75 3.5h1.5v4h-1.5v-4z"/>
          </svg>
          <div className="online-users__tooltip" role="tooltip">
            <div className="online-users__tooltip-row">
              <span className="online-users__dot" style={{ background: '#4ade80' }} />
              Watching
            </div>
            <div className="online-users__tooltip-row">
              <span className="online-users__dot" style={{ background: '#facc15' }} />
              Watching, idle
            </div>
            <div className="online-users__tooltip-row">
              <span className="online-users__dot" style={{ background: '#666' }} />
              Not watching
            </div>
          </div>
        </span>
      </div>
      {users.length === 0 && (
        <span className="online-users__empty">No one</span>
      )}
      <ul className="online-users__list">
        {users.map((u) => (
          <li key={u.id} className="online-users__item">
            <span
              className="online-users__dot"
              style={{ background: STATE_COLORS[u.state] || '#666' }}
            />
            <span className="online-users__name">{u.username}</span>
            {u.energy && (
              <span className="online-users__energy" title="Energy">
                ⚡{u.energy.current}<span className="online-users__energy-max">/{u.energy.max}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
