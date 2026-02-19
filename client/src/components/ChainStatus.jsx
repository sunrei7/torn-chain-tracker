import { useState, useEffect, useRef, useCallback } from 'react';

const POLL_INTERVAL = 15_000; // re-fetch every 15s

function formatCooldown(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// CS bomb-style beep via Web Audio API
function playBeep(audioCtx) {
  if (!audioCtx || audioCtx.state === 'closed') return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.08);
}

export default function ChainStatus({ sessionToken }) {
  const [chain, setChain] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [cooldownCountdown, setCooldownCountdown] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('chainSoundEnabled') === 'true'; } catch { return false; }
  });

  const intervalRef = useRef(null);
  const audioCtxRef = useRef(null);
  const beepIntervalRef = useRef(null);

  const fetchChain = useCallback(async () => {
    try {
      const res = await fetch('/api/chain', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const fetchedAt = Date.now();
      setChain({ ...data, _fetchedAt: fetchedAt });
      const nowSec = Math.floor(fetchedAt / 1000);
      setCountdown(data.end > 0 ? Math.max(0, data.end - nowSec) : 0);
      setCooldownCountdown(data.cooldown);
    } catch {
      // ignore
    }
  }, [sessionToken]);

  // Poll chain data
  useEffect(() => {
    fetchChain();
    const id = setInterval(fetchChain, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchChain]);

  // Tick the countdown every second
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (!chain) return;
      const nowSec = Math.floor(Date.now() / 1000);
      if (chain.end > 0) {
        setCountdown(Math.max(0, chain.end - nowSec));
      }
      if (chain.cooldown > 0) {
        const elapsed = Math.floor((Date.now() - chain._fetchedAt) / 1000);
        setCooldownCountdown(Math.max(0, chain.cooldown - elapsed));
      }
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [chain]);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('chainSoundEnabled', String(next)); } catch {}
      // Initialize or resume AudioContext on user gesture
      if (next) {
        if (!audioCtxRef.current) {
          try {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
          } catch { /* unsupported */ }
        } else if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
      }
      return next;
    });
  }, []);

  // Compute beep tier — only changes at threshold boundaries (90, 60, 30)
  // 0 = silent, 1 = 1/1.5s (every 1500ms), 2 = 2/s (every 500ms), 3 = 4/s (every 250ms)
  const isActiveForBeep = chain !== null && chain.current > 0 && chain.end > 0 && chain.cooldown === 0;
  let beepTier = 0;
  if (isActiveForBeep && soundEnabled && countdown > 0 && countdown <= 90) {
    if (countdown > 60) beepTier = 1;
    else if (countdown > 30) beepTier = 2;
    else beepTier = 3;
  }

  // Beep effect — only re-runs when tier changes (at 120, 60, 30 second marks)
  useEffect(() => {
    if (beepIntervalRef.current) {
      clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
    if (beepTier === 0) return;

    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } catch { return; }
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    const intervalMs = beepTier === 1 ? 1500 : beepTier === 2 ? 500 : 250;

    playBeep(audioCtxRef.current);
    beepIntervalRef.current = setInterval(() => {
      playBeep(audioCtxRef.current);
    }, intervalMs);

    return () => {
      if (beepIntervalRef.current) {
        clearInterval(beepIntervalRef.current);
        beepIntervalRef.current = null;
      }
    };
  }, [beepTier]);

  const SoundButton = (
    <button
      className={`chain-status__sound-btn${soundEnabled ? ' active' : ''}`}
      onClick={toggleSound}
      title={soundEnabled ? 'Disable alarm sound' : 'Enable alarm sound'}
      aria-label={soundEnabled ? 'Disable alarm sound' : 'Enable alarm sound'}
    >
      {soundEnabled ? (
        // Speaker with waves (on)
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path d="M10 3.5a.5.5 0 0 0-.8-.4L5.6 6H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.6l3.6 2.9a.5.5 0 0 0 .8-.4V3.5z"/>
          <path d="M13.5 5.5a.5.5 0 0 1 .7.1 7 7 0 0 1 0 8.8.5.5 0 0 1-.8-.6 6 6 0 0 0 0-7.6.5.5 0 0 1 .1-.7z"/>
          <path d="M15.7 3.3a.5.5 0 0 1 .7.1 10 10 0 0 1 0 13.2.5.5 0 1 1-.8-.6 9 9 0 0 0 0-12 .5.5 0 0 1 .1-.7z"/>
        </svg>
      ) : (
        // Speaker muted (off)
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path d="M10 3.5a.5.5 0 0 0-.8-.4L5.6 6H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.6l3.6 2.9a.5.5 0 0 0 .8-.4V3.5z"/>
          <path d="M13 7l4 4m0-4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        </svg>
      )}
    </button>
  );

  if (!chain) {
    return (
      <div className="chain-status chain-status--loading">
        <div className="chain-status__top">
          <span className="chain-status__label">Chain</span>
          {SoundButton}
        </div>
        <span className="chain-status__value">...</span>
      </div>
    );
  }

  const isActive = chain.current > 0 && chain.end > 0 && chain.cooldown === 0;
  const isCooldown = chain.cooldown > 0;

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className={`chain-status ${isActive ? 'chain-status--active' : isCooldown ? 'chain-status--cooldown' : 'chain-status--inactive'}`}>
      <div className="chain-status__top">
        <span className="chain-status__label">Chain</span>
        {SoundButton}
      </div>
      <span className="chain-status__hits">{chain.current}</span>
      {isActive && (
        <span className={`chain-status__timer${countdown <= 120 && countdown > 60 ? ' chain-status__timer--urgent' : countdown <= 60 ? ' chain-status__timer--critical' : ''}`}>{timeStr}</span>
      )}
      {isCooldown && (
        <span className="chain-status__cooldown">
          Cooldown
          <span className="chain-status__cooldown-timer">
            {formatCooldown(cooldownCountdown)}
          </span>
        </span>
      )}
      {!isActive && !isCooldown && (
        <span className="chain-status__inactive">Inactive</span>
      )}
    </div>
  );
}
