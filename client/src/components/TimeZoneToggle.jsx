export default function TimeZoneToggle({ useTCT, onChange }) {
  return (
    <div className="tz-toggle">
      <button
        className={!useTCT ? 'active' : ''}
        onClick={() => onChange(false)}
      >
        Local
      </button>
      <button
        className={useTCT ? 'active' : ''}
        onClick={() => onChange(true)}
      >
        TCT
      </button>
    </div>
  );
}
