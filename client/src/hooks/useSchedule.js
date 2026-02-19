import { useState, useEffect, useRef, useCallback } from 'react';

export function useSchedule(sessionToken) {
  const [slots, setSlots] = useState({});
  const [eyeStates, setEyeStates] = useState({});
  const [warlordWeapons, setWarlordWeapons] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const onReconnectRef = useRef(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const tokenParam = sessionToken ? `?token=${encodeURIComponent(sessionToken)}` : '';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws${tokenParam}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Fire reconnect callback so eye can re-send its state
      if (onReconnectRef.current) onReconnectRef.current();
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'schedule') {
        setSlots(msg.data.slots);
      } else if (msg.type === 'eye_states') {
        setEyeStates(msg.data);
      } else if (msg.type === 'warlord_weapons') {
        setWarlordWeapons(msg.data);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => ws.close();
  }, [sessionToken]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const authHeaders = useCallback(() => {
    if (!sessionToken) return {};
    return { Authorization: `Bearer ${sessionToken}` };
  }, [sessionToken]);

  const fetchSchedule = useCallback(async (from, to) => {
    const res = await fetch(
      `/api/schedule?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: authHeaders() }
    );
    const data = await res.json();
    setSlots(data.slots);
  }, [authHeaders]);

  const addSignups = useCallback(async (watcherId, slotList) => {
    await fetch('/api/signups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ watcherId, slots: slotList }),
    });
  }, [authHeaders]);

  const removeSignups = useCallback(async (watcherId, slotList) => {
    await fetch('/api/signups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ watcherId, slots: slotList }),
    });
  }, [authHeaders]);

  const setOnReconnect = useCallback((fn) => {
    onReconnectRef.current = fn;
  }, []);

  return {
    slots, eyeStates, warlordWeapons, connected,
    fetchSchedule, addSignups, removeSignups,
    sendMessage, setOnReconnect,
  };
}
