import { useState, useEffect } from 'react';

export default function WatcherSelect({ selected, onSelect, sessionToken }) {
  const [watchers, setWatchers] = useState([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const authHeaders = sessionToken
    ? { Authorization: `Bearer ${sessionToken}` }
    : {};

  useEffect(() => {
    fetch('/api/watchers', { headers: authHeaders })
      .then((r) => r.json())
      .then(setWatchers);
  }, [sessionToken]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    if (!newName.trim()) return;

    const res = await fetch('/api/watchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ name: newName.trim() }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      return;
    }

    const watcher = await res.json();
    setWatchers((prev) => [...prev, watcher].sort((a, b) => a.name.localeCompare(b.name)));
    onSelect(watcher);
    setNewName('');
  }

  return (
    <div className="watcher-select">
      <label>
        Watcher:
        <select
          value={selected?.id || ''}
          onChange={(e) => {
            const w = watchers.find((w) => w.id === Number(e.target.value));
            onSelect(w || null);
          }}
        >
          <option value="">-- Select --</option>
          {watchers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>

      <form onSubmit={handleCreate} className="create-watcher">
        <input
          type="text"
          placeholder="New watcher name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
      {error && <span className="error">{error}</span>}
    </div>
  );
}
