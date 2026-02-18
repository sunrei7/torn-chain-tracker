export default function DateNav({ date, onChange }) {
  function shift(days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    onChange(d.toISOString().slice(0, 10));
  }

  return (
    <div className="date-nav">
      <button onClick={() => shift(-1)}>&larr; Prev</button>
      <input
        type="date"
        value={date}
        onChange={(e) => onChange(e.target.value)}
      />
      <button onClick={() => shift(1)}>Next &rarr;</button>
    </div>
  );
}
