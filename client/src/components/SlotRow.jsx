export default function SlotRow({ time, watchers, isSignedUp, onToggle, disabled, isPast, useTCT }) {
  const count = watchers.length;
  const colorClass = count === 0 ? 'coverage-red' : count === 1 ? 'coverage-yellow' : 'coverage-green';

  const label = new Date(time).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    ...(useTCT ? { timeZone: 'UTC' } : {}),
  });

  return (
    <div className={`slot-row ${colorClass}${isPast ? ' past' : ''}`}>
      <span className="slot-time">{label}</span>
      <span className="slot-count">{count}</span>
      <span className="slot-names">
        {watchers.map((w) => w.name).join(', ') || '—'}
      </span>
      <button
        className={`slot-toggle ${isSignedUp ? 'signed-up' : ''}`}
        onClick={onToggle}
        disabled={disabled || (isPast && !isSignedUp)}
      >
        {isSignedUp ? 'Leave' : 'Join'}
      </button>
    </div>
  );
}
