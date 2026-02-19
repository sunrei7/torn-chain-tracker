import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'chain-tracker-auth';

export function useAuth() {
  const [sessionToken, setSessionToken] = useState(null);
  const [user, setUser] = useState(null);
  const [apiKey, setApiKey] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, restore from localStorage and validate
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      // Quick validation: try hitting a protected endpoint
      fetch('/api/watchers', {
        headers: { Authorization: `Bearer ${parsed.sessionToken}` },
      }).then((res) => {
        if (res.ok) {
          setSessionToken(parsed.sessionToken);
          setUser(parsed.user);
          setApiKey(parsed.apiKey);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (apiKey) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }
    setSessionToken(data.sessionToken);
    setUser(data.user);
    setApiKey(apiKey);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, apiKey }));
  }, []);

  const logout = useCallback(() => {
    setSessionToken(null);
    setUser(null);
    setApiKey(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const authHeaders = useCallback(() => {
    if (!sessionToken) return {};
    return { Authorization: `Bearer ${sessionToken}` };
  }, [sessionToken]);

  return { sessionToken, user, apiKey, loading, login, logout, authHeaders };
}
