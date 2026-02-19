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

    let startDiff = 0;
    while (
      startDiff < newDisplay.length &&
      startDiff < oldDisplay.length &&
      newDisplay[startDiff] === oldDisplay[startDiff]
    ) startDiff++;

    let endDiff = 0;
    while (
      endDiff < newDisplay.length - startDiff &&
      endDiff < oldDisplay.length - startDiff &&
      newDisplay[newDisplay.length - 1 - endDiff] === oldDisplay[oldDisplay.length - 1 - endDiff]
    ) endDiff++;

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

      <div className="login-disclosure">
        <h2 className="login-disclosure__title">Before you connect your API key</h2>
        <p className="login-disclosure__intro">
          In accordance with Torn's API guidelines, we are required to disclose how your data is collected, stored, and used.
        </p>

        <div className="login-disclosure__section">
          <h3>What we store</h3>
          <ul>
            <li>Your Torn username and player ID</li>
            <li>Your faction ID</li>
            <li>Your API key — stored server-side and never exposed to other users</li>
          </ul>
        </div>

        <div className="login-disclosure__section">
          <h3>What we access via your key</h3>
          <ul>
            <li><strong>User basic &amp; profile</strong> — to verify your identity and faction membership on sign-up</li>
            <li><strong>User bars</strong> — your energy is read periodically and shared with online faction members in real time</li>
            <li><strong>Faction chain</strong> — chain timer and status displayed to all faction members</li>
            <li><strong>Faction armory weapons</strong> — on manual refresh, used to display Warlord-modded weapons to faction members</li>
          </ul>
        </div>

        <div className="login-disclosure__section">
          <h3>Who can see your data</h3>
          <ul>
            <li>Your energy level is visible to other online members of your faction</li>
            <li>Your username and watch status are visible to other online faction members</li>
            <li>Your API key is never shared with anyone</li>
          </ul>
        </div>

        <div className="login-disclosure__section">
          <h3>Key security</h3>
          <ul>
            <li>Use the "Generate Custom API Key" button to create a key with the minimum required scopes only</li>
            <li>Never share your API key with anyone — Torn staff will never ask for it</li>
            <li>Your Torn password is never requested or stored by this tool</li>
            <li>You can revoke your key at any time from <a href="https://www.torn.com/preferences.php#tab=api" target="_blank" rel="noopener noreferrer">Torn preferences</a></li>
          </ul>
        </div>

        <div className="login-disclosure__section">
          <h3>Rate limits</h3>
          <ul>
            <li>Torn enforces a maximum of 100 API requests per minute per user across all keys</li>
            <li>This tool polls at intervals of 15 seconds or longer to stay well within limits</li>
          </ul>
        </div>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <a
          className="btn btn-generate"
          href="https://www.torn.com/preferences.php#tab=api?step=addNewKey&title=ChainTracker&user=basic,bars,profile&faction=weapons"
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
          I have read and agree to the data disclosure above
        </label>
        <button type="submit" className="btn btn-signup" disabled={!canSubmit}>
          {loading ? 'Signing up...' : 'Sign Up'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
