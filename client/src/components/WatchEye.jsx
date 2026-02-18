import { useState, useEffect, useRef, useCallback } from 'react';

const IDLE_TIMEOUT = 2 * 60 * 1000; // 2 minutes

// "not_watching" | "watching" | "watching_idle"

function EyeOpen({ color }) {
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 32s12-20 28-20 28 20 28 20-12 20-28 20S4 32 4 32z"
        stroke={color}
        strokeWidth="3"
        fill="none"
      />
      <circle cx="32" cy="32" r="10" stroke={color} strokeWidth="3" fill="none" />
      <circle cx="32" cy="32" r="4" fill={color} />
    </svg>
  );
}

function EyeCrossed({ color }) {
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 32s12-20 28-20 28 20 28 20-12 20-28 20S4 32 4 32z"
        stroke={color}
        strokeWidth="3"
        fill="none"
      />
      <circle cx="32" cy="32" r="10" stroke={color} strokeWidth="3" fill="none" />
      <circle cx="32" cy="32" r="4" fill={color} />
      <line x1="10" y1="10" x2="54" y2="54" stroke={color} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

const STATE_CONFIG = {
  not_watching: { label: 'Not watching', color: '#666', Icon: EyeCrossed },
  watching:     { label: 'Watching',     color: '#4ade80', Icon: EyeOpen },
  watching_idle:{ label: 'Idle',         color: '#facc15', Icon: EyeOpen },
};

export default function WatchEye({ sendMessage, setOnReconnect }) {
  const [state, setState] = useState('not_watching');
  const idleTimer = useRef(null);
  const stateRef = useRef(state);

  // Keep ref in sync for the reconnect callback
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Send state to server whenever it changes
  useEffect(() => {
    sendMessage({ type: 'eye_state', state });
  }, [state, sendMessage]);

  // On WS reconnect, re-send current state
  useEffect(() => {
    setOnReconnect(() => {
      sendMessage({ type: 'eye_state', state: stateRef.current });
    });
  }, [sendMessage, setOnReconnect]);

  const resetIdleTimer = useCallback(() => {
    if (stateRef.current !== 'watching' && stateRef.current !== 'watching_idle') return;
    clearTimeout(idleTimer.current);
    if (stateRef.current === 'watching_idle') setState('watching');
    idleTimer.current = setTimeout(() => setState('watching_idle'), IDLE_TIMEOUT);
  }, []);

  // Idle detection: listen for user activity while watching
  useEffect(() => {
    if (state !== 'watching' && state !== 'watching_idle') {
      clearTimeout(idleTimer.current);
      return;
    }

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, resetIdleTimer));

    // Start the idle countdown
    idleTimer.current = setTimeout(() => setState('watching_idle'), IDLE_TIMEOUT);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
      clearTimeout(idleTimer.current);
    };
  }, [state, resetIdleTimer]);

  function handleClick() {
    if (state === 'not_watching') {
      setState('watching');
    } else {
      setState('not_watching');
    }
  }

  const { label, color, Icon } = STATE_CONFIG[state];

  return (
    <button
      className={`watch-eye watch-eye--${state}`}
      onClick={handleClick}
      title={label}
      type="button"
    >
      <Icon color={color} />
      <span className="watch-eye__label" style={{ color }}>{label}</span>
    </button>
  );
}
