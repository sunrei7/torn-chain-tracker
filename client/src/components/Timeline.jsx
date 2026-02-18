import { useMemo, useState, useEffect } from 'react';
import SlotRow from './SlotRow.jsx';

function generateSlots(dateStr, useTCT) {
  const slots = [];
  const base = useTCT
    ? new Date(dateStr + 'T00:00:00Z')
    : new Date(dateStr + 'T00:00:00');
  for (let i = 0; i < 96; i++) {
    const d = new Date(base.getTime() + i * 15 * 60 * 1000);
    slots.push(d.toISOString());
  }
  return slots;
}

export default function Timeline({ date, slots, watcher, useTCT, onAdd, onRemove }) {
  const timeSlots = useMemo(() => generateSlots(date, useTCT), [date, useTCT]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
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
            useTCT={useTCT}
            disabled={!watcher}
            onToggle={() => {
              if (isSignedUp) {
                onRemove(watcher.id, [iso]);
              } else {
                onAdd(watcher.id, [iso]);
              }
            }}
          />
        );
      })}
    </div>
  );
}
