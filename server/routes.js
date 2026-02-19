import { Router } from 'express';
import crypto from 'crypto';
import {
  listWatchers,
  createWatcher,
  addSignups,
  removeSignups,
  getSchedule,
  createUser,
  getUserByApiKey,
  getUserByTornId,
  updateUserApiKey,
  getUserBySession,
  getApiKeyBySession,
  countUsers,
} from './db.js';

// Track online users: userId -> last activity timestamp
const activeUsers = new Map();
const ONLINE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = header.slice(7);
  const user = getUserBySession(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid session token' });
  }
  req.user = user;
  activeUsers.set(user.id, Date.now());
  next();
}

export function createRoutes(broadcast) {
  const router = Router();

  // --- Auth (no middleware) ---
  router.post('/api/auth/signup', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.length !== 16) {
      return res.status(400).json({ error: 'API key must be 16 characters' });
    }

    // Check if user already exists
    const existing = getUserByApiKey(apiKey);
    if (existing) {
      return res.json({
        sessionToken: existing.session_token,
        user: { id: existing.id, tornId: existing.torn_id, username: existing.username, isAdmin: !!existing.is_admin },
      });
    }

    // Validate against Torn API
    let tornData;
    try {
      const resp = await fetch(
        `https://api.torn.com/user/?selections=basic&key=${encodeURIComponent(apiKey)}`
      );
      tornData = await resp.json();
    } catch {
      return res.status(502).json({ error: 'Failed to reach Torn API' });
    }

    if (tornData.error) {
      return res.status(400).json({ error: `Torn API error: ${tornData.error.error}` });
    }

    if (!tornData.faction || tornData.faction.faction_id === 0) {
      return res.status(403).json({ error: 'Please join a faction in order to use this tool' });
    }

    const tornId = tornData.player_id;
    const username = tornData.name;
    const sessionToken = crypto.randomUUID();

    // Check if this Torn account already exists (different API key)
    const existingByTornId = getUserByTornId(tornId);
    if (existingByTornId) {
      const updated = updateUserApiKey(tornId, username, apiKey, sessionToken);
      return res.json({
        sessionToken,
        user: { id: updated.id, tornId: updated.torn_id, username: updated.username, isAdmin: !!updated.is_admin },
      });
    }

    try {
      const user = createUser(tornId, username, apiKey, sessionToken);
      // Create a watcher with the same name as the user
      try {
        createWatcher(username);
      } catch (err) {
        // Ignore duplicate watcher name — another user may share the name
        if (!err.message.includes('UNIQUE')) throw err;
      }
      return res.status(201).json({ sessionToken, user: { ...user, isAdmin: false } });
    } catch (err) {
      throw err;
    }
  });

  // --- Protected routes (middleware applied per-route) ---
  router.get('/api/stats', authMiddleware, (_req, res) => {
    const now = Date.now();
    let onlineCount = 0;
    for (const [userId, lastSeen] of activeUsers) {
      if (now - lastSeen <= ONLINE_TIMEOUT) {
        onlineCount++;
      } else {
        activeUsers.delete(userId);
      }
    }
    res.json({ totalUsers: countUsers(), onlineUsers: onlineCount });
  });

  router.get('/api/energy', authMiddleware, async (req, res) => {
    const token = req.headers.authorization.slice(7);
    const apiKey = getApiKeyBySession(token);
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not found' });
    }

    let data;
    try {
      const resp = await fetch(
        `https://api.torn.com/user/?selections=bars&key=${encodeURIComponent(apiKey)}`
      );
      data = await resp.json();
    } catch {
      return res.status(502).json({ error: 'Failed to reach Torn API' });
    }

    if (data.error) {
      return res.status(400).json({ error: `Torn API error: ${data.error.error}` });
    }

    const energy = data.energy || {};
    res.json({ current: energy.current ?? 0, max: energy.maximum ?? 0 });
  });

  router.get('/api/chain', authMiddleware, async (req, res) => {
    const token = req.headers.authorization.slice(7);
    const apiKey = getApiKeyBySession(token);
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not found' });
    }

    let data;
    try {
      const resp = await fetch(
        `https://api.torn.com/faction/?selections=chain&key=${encodeURIComponent(apiKey)}`
      );
      data = await resp.json();
    } catch {
      return res.status(502).json({ error: 'Failed to reach Torn API' });
    }

    if (data.error) {
      return res.status(400).json({ error: `Torn API error: ${data.error.error}` });
    }

    const chain = data.chain || {};
    res.json({
      current: chain.current || 0,
      max: chain.max || 0,
      end: chain.end || 0,
      cooldown: chain.cooldown || 0,
    });
  });

  router.get('/api/watchers', authMiddleware, (_req, res) => {
    res.json(listWatchers());
  });

  router.post('/api/watchers', authMiddleware, (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    try {
      const watcher = createWatcher(name.trim());
      res.status(201).json(watcher);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Name already exists' });
      }
      throw err;
    }
  });

  router.get('/api/schedule', authMiddleware, (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to are required' });
    }
    res.json({ slots: getSchedule(from, to) });
  });

  router.post('/api/signups', authMiddleware, (req, res) => {
    const { watcherId, slots } = req.body;
    if (!watcherId || !Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ error: 'watcherId and slots[] required' });
    }
    const now = new Date().toISOString();
    const past = slots.filter((s) => s < now);
    if (past.length > 0) {
      return res.status(400).json({ error: 'Cannot sign up for past time slots' });
    }
    addSignups(watcherId, slots);
    broadcast();
    res.json({ ok: true });
  });

  router.delete('/api/signups', authMiddleware, (req, res) => {
    const { watcherId, slots } = req.body;
    if (!watcherId || !Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ error: 'watcherId and slots[] required' });
    }
    removeSignups(watcherId, slots);
    broadcast();
    res.json({ ok: true });
  });

  return router;
}
