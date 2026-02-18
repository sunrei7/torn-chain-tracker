import { useState, useEffect } from 'react';
import WatcherSelect from './WatcherSelect.jsx';
import DateNav from './DateNav.jsx';
import Timeline from './Timeline.jsx';
import TimeZoneToggle from './TimeZoneToggle.jsx';
import { useSchedule } from '../hooks/useSchedule.js';

function todayStr(useTCT) {
  if (useTCT) return new Date().toISOString().slice(0, 10);
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayStartISO(dateStr, useTCT) {
  if (useTCT) return new Date(dateStr + 'T00:00:00Z').toISOString();
  return new Date(dateStr + 'T00:00:00').toISOString();
}

function dayEndISO(dateStr, useTCT) {
  const d = useTCT
    ? new Date(dateStr + 'T00:00:00Z')
    : new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export default function PlannerPage({ sessionToken, onLogout }) {
  const [watcher, setWatcher] = useState(null);
  const [useTCT, setUseTCT] = useState(false);
  const [date, setDate] = useState(() => todayStr(false));
  const { slots, connected, fetchSchedule, addSignups, removeSignups } =
    useSchedule(sessionToken);

  useEffect(() => {
    fetchSchedule(dayStartISO(date, useTCT), dayEndISO(date, useTCT));
  }, [date, useTCT, fetchSchedule]);

  function handleTZChange(newUseTCT) {
    setDate(todayStr(newUseTCT));
    setUseTCT(newUseTCT);
  }

  return (
    <div className="app">
      <header>
        <h1>Chain Tracker</h1>
        <div className="header-right">
          <span className={`status ${connected ? 'online' : 'offline'}`}>
            {connected ? 'Live' : 'Reconnecting...'}
          </span>
          <a href="#/" className="btn btn-back">Home</a>
          <button onClick={onLogout}>Logout</button>
        </div>
      </header>
      <div className="controls">
        <WatcherSelect selected={watcher} onSelect={setWatcher} sessionToken={sessionToken} />
        <DateNav date={date} onChange={setDate} />
        <TimeZoneToggle useTCT={useTCT} onChange={handleTZChange} />
      </div>
      <Timeline
        date={date}
        slots={slots}
        watcher={watcher}
        useTCT={useTCT}
        onAdd={addSignups}
        onRemove={removeSignups}
      />
    </div>
  );
}
