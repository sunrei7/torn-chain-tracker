import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth.js';
import LoginPage from './components/LoginPage.jsx';
import HomePage from './components/HomePage.jsx';
import PlannerPage from './components/PlannerPage.jsx';

function getHash() {
  return window.location.hash || '#/';
}

export default function App() {
  const { sessionToken, user, apiKey, loading, login, logout } = useAuth();
  const [hash, setHash] = useState(getHash);

  useEffect(() => {
    function onHashChange() {
      setHash(getHash());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Redirect logic
  useEffect(() => {
    if (loading) return;
    if (!sessionToken && hash !== '#/login') {
      window.location.hash = '#/login';
    } else if (sessionToken && hash === '#/login') {
      window.location.hash = '#/';
    }
  }, [sessionToken, hash, loading]);

  if (loading) {
    return <div className="app"><p>Loading...</p></div>;
  }

  function handleLogout() {
    logout();
    window.location.hash = '#/login';
  }

  if (hash === '#/login' || !sessionToken) {
    return <LoginPage onLogin={login} />;
  }

  if (hash === '#/planner') {
    return <PlannerPage sessionToken={sessionToken} onLogout={handleLogout} />;
  }

  // Default: home
  return <HomePage user={user} sessionToken={sessionToken} apiKey={apiKey} onLogout={handleLogout} />;
}
