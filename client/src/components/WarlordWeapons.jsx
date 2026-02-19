import { useState, useCallback } from 'react';

export default function WarlordWeapons({ apiKey, sendMessage, weapons }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!apiKey || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://api.torn.com/v2/faction/armory/weapons?key=${encodeURIComponent(apiKey)}`
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error.error);
        return;
      }

      const items = data.armory ?? [];
      const warlordWeapons = items
        .filter((item) => item.bonuses?.some((b) => b.bonus === 'Warlord'))
        .map((item) => {
          const bonus = item.bonuses.find((b) => b.bonus === 'Warlord');
          return {
            id: item.id,
            name: item.name,
            image: `https://www.torn.com/images/items/${item.id}/large.png`,
            warlord: bonus.value,
          };
        });

      sendMessage({ type: 'warlord_weapons', data: warlordWeapons });
    } catch {
      setError('Failed to fetch faction inventory');
    } finally {
      setLoading(false);
    }
  }, [apiKey, loading, sendMessage]);

  return (
    <div className="warlord-weapons">
      <div className="warlord-weapons__header">
        <h3 className="warlord-weapons__title">Warlord Weapons</h3>
        <button className="warlord-weapons__refresh" onClick={refresh} disabled={loading}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14"
            style={{ transform: loading ? 'rotate(360deg)' : 'none', transition: loading ? 'transform 0.6s linear' : 'none' }}>
            <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0v2.43l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219z" clipRule="evenodd"/>
          </svg>
          Refresh
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {weapons === null && !error && (
        <p className="warlord-weapons__empty">Click refresh to load faction inventory</p>
      )}

      {weapons !== null && weapons.length === 0 && !error && (
        <p className="warlord-weapons__empty">No Warlord weapons in faction inventory</p>
      )}

      {weapons !== null && weapons.length > 0 && (
        <table className="warlord-weapons__table">
          <thead>
            <tr>
              <th></th>
              <th>Weapon</th>
              <th>Warlord</th>
            </tr>
          </thead>
          <tbody>
            {weapons.map((w, i) => (
              <tr key={i}>
                <td className="warlord-weapons__img-cell">
                  <img
                    src={w.image}
                    alt={w.name}
                    className="warlord-weapons__img"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </td>
                <td className="warlord-weapons__name">{w.name}</td>
                <td className="warlord-weapons__value">{w.warlord}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
