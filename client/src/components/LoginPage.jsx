import { useState } from 'react';

function getMasked(val) {
  if (val.length <= 4) return val;
  return val.slice(0, 4) + '*'.repeat(val.length - 4);
}

export default function LoginPage({ onLogin }) {
  const [apiKey, setApiKey] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = apiKey.length === 16 && agreed && !loading;

  function handleChange(e) {
    const newDisplay = e.target.value;
    const oldDisplay = getMasked(apiKey);
    if (newDisplay === oldDisplay) return;

    // Find where the edit starts (from left)
    let startDiff = 0;
    while (
      startDiff < newDisplay.length &&
      startDiff < oldDisplay.length &&
      newDisplay[startDiff] === oldDisplay[startDiff]
    ) startDiff++;

    // Find where the edit ends (from right), without overlapping startDiff
    let endDiff = 0;
    while (
      endDiff < newDisplay.length - startDiff &&
      endDiff < oldDisplay.length - startDiff &&
      newDisplay[newDisplay.length - 1 - endDiff] === oldDisplay[oldDisplay.length - 1 - endDiff]
    ) endDiff++;

    // Characters newly typed/pasted are in newDisplay between startDiff and (length - endDiff)
    const inserted = newDisplay.slice(startDiff, newDisplay.length - endDiff);
    const newReal = (
      apiKey.slice(0, startDiff) +
      inserted +
      apiKey.slice(oldDisplay.length - endDiff)
    ).slice(0, 16);

    setApiKey(newReal);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(apiKey);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <h1 className="login-title">Chain Tracker</h1>
      <form className="login-form" onSubmit={handleSubmit}>
        <a
          className="btn btn-generate"
          href="https://www.torn.com/preferences.php#tab=api?step=addNewKey&title=ChainTracker&user=hof,faction,basic,profile,cooldowns,refills,attacks,battlestats,bars,personalstats&faction=members,rankedwarreport,warfare,wars,rankedwars,chain&torn=rankedwarreport,rankedwars"
          target="_blank"
          rel="noopener noreferrer"
        >
          Generate Custom API Key
        </a>
        <input
          type="text"
          className="login-input"
          placeholder="Enter your 16-character API key"
          maxLength={16}
          value={getMasked(apiKey)}
          onChange={handleChange}
        />
        <label className="login-checkbox">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          I agree to terms and conditions (to be added later)
        </label>
        <button type="submit" className="btn btn-signup" disabled={!canSubmit}>
          {loading ? 'Signing up...' : 'Sign Up'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
