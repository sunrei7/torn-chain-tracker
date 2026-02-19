import { useState, useEffect, useMemo } from 'react';
import { useSchedule } from '../hooks/useSchedule.js';
import SlotRow from './SlotRow.jsx';
import WatchEye from './WatchEye.jsx';
import ChainStatus from './ChainStatus.jsx';
import OnlineUsers from './OnlineUsers.jsx';

function generateUpcomingSlots() {
  const slots = [];
  const now = new Date();
  // Round down to nearest 15-min boundary
  const mins = now.getMinutes();
  now.setMinutes(mins - (mins % 15), 0, 0);
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getTime() + i * 15 * 60 * 1000);
    slots.push(d.toISOString());
  }
  return slots;
}

export default function HomePage({ user, sessionToken, onLogout }) {
  const [watcher, setWatcher] = useState(null);
  const [now, setNow] = useState(Date.now());
  const { slots, eyeStates, connected, fetchSchedule, addSignups, removeSignups, sendMessage, setOnReconnect } =
    useSchedule(sessionToken);

  const timeSlots = useMemo(() => generateUpcomingSlots(), []);

  // Find this user's watcher by username
  useEffect(() => {
    fetch('/api/watchers', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((r) => r.json())
      .then((watchers) => {
        const match = watchers.find((w) => w.name === user.username);
        if (match) setWatcher(match);
      })
      .catch(() => {});
  }, [sessionToken, user.username]);

  // Fetch schedule for the 2-hour window
  useEffect(() => {
    if (timeSlots.length === 0) return;
    const from = timeSlots[0];
    const last = new Date(new Date(timeSlots[timeSlots.length - 1]).getTime() + 15 * 60 * 1000);
    fetchSchedule(from, last.toISOString());
  }, [timeSlots, fetchSchedule]);

  // Fetch own energy every 30s while connected and send via WS
  useEffect(() => {
    if (!connected) return;

    async function fetchAndSendEnergy() {
      try {
        const res = await fetch('/api/energy', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (!res.ok) return;
        const { current, max } = await res.json();
        sendMessage({ type: 'energy', current, max });
      } catch {
        // ignore
      }
    }

    fetchAndSendEnergy();
    const id = setInterval(fetchAndSendEnergy, 30_000);
    return () => clearInterval(id);
  }, [connected, sessionToken, sendMessage]);

  // Tick for past-slot detection
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="home-page">
      <header>
        <h1>Chain Tracker <span className="app-version">v{__APP_VERSION__}</span></h1>
        <div className="header-right">
          <span className={`status ${connected ? 'online' : 'offline'}`}>
            {connected ? 'Live' : 'Reconnecting...'}
          </span>
          <span className="header-username">{user.username}</span>
          <button onClick={onLogout}>Logout</button>
        </div>
      </header>
      <div className="home-content">
        <div className="home-dashboard">
          <ChainStatus sessionToken={sessionToken} />
          <WatchEye sendMessage={sendMessage} setOnReconnect={setOnReconnect} />
          <OnlineUsers eyeStates={eyeStates} />
        </div>

        <div className="home-timeline">
          <h3>Next 2 hours</h3>
          <div className="timeline">
            <div className="slot-row header">
              <span className="slot-time">Time</span>
              <span className="slot-count">#</span>
              <span className="slot-names">Watchers</span>
              <span className="slot-toggle-header"></span>
            </div>
            {timeSlots.map((iso) => {
              const watchers = slots[iso] || [];
              const isSignedUp = watcher
                ? watchers.some((w) => w.id === watcher.id)
                : false;
              const isPast = new Date(iso).getTime() + 15 * 60 * 1000 <= now;

              return (
                <SlotRow
                  key={iso}
                  time={iso}
                  watchers={watchers}
                  isSignedUp={isSignedUp}
                  isPast={isPast}
                  useTCT={false}
                  disabled={!watcher}
                  onToggle={() => {
                    if (!watcher) return;
                    if (isSignedUp) {
                      removeSignups(watcher.id, [iso]);
                    } else {
                      addSignups(watcher.id, [iso]);
                    }
                  }}
                />
              );
            })}
          </div>
        </div>

        <nav className="home-nav">
          <a href="#/planner" className="btn btn-nav">Open Full Planner</a>
        </nav>
      </div>
    </div>
  );
}
