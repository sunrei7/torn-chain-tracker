import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { URL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRoutes } from './routes.js';
import { getSchedule, getUserBySession } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json());

// WebSocket server on /ws path
const wss = new WebSocketServer({ server, path: '/ws' });

// Eye states for all connected authenticated users: userId -> { state, username }
const eyeStates = new Map();

// Latest warlord weapons per faction: factionId -> weapons array
const factionWarlordWeapons = new Map();

function broadcastSchedule(factionId) {
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 2);

  const slots = getSchedule(from.toISOString(), to.toISOString());
  const message = JSON.stringify({ type: 'schedule', data: { slots } });

  for (const client of wss.clients) {
    if (client.readyState === 1 && client._factionId === factionId) {
      client.send(message);
    }
  }
}

function buildEyeStatesPayload(factionId) {
  const states = {};
  for (const [userId, data] of eyeStates) {
    if (data.factionId === factionId) {
      states[userId] = { state: data.state, username: data.username, energy: data.energy ?? null };
    }
  }
  return states;
}

function broadcastEyeStates(factionId) {
  const message = JSON.stringify({ type: 'eye_states', data: buildEyeStatesPayload(factionId) });
  for (const client of wss.clients) {
    if (client.readyState === 1 && client._factionId === factionId) {
      client.send(message);
    }
  }
}

wss.on('connection', (ws, req) => {
  // Authenticate via query param: /ws?token=<sessionToken>
  let wsUser = null;
  try {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    if (token) {
      wsUser = getUserBySession(token);
    }
  } catch {
    // ignore parse errors
  }

  // Attach user to ws for cleanup
  ws._userId = wsUser?.id ?? null;
  ws._username = wsUser?.username ?? null;
  ws._factionId = wsUser?.faction_id ?? null;

  // Register authenticated user as online (default: not_watching)
  if (ws._userId) {
    eyeStates.set(ws._userId, { state: 'not_watching', username: ws._username, factionId: ws._factionId });
  }

  // Send current schedule on connect (faction-scoped data is handled client-side via watchers)
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 2);

  const slots = getSchedule(from.toISOString(), to.toISOString());
  ws.send(JSON.stringify({ type: 'schedule', data: { slots } }));

  // Send current eye states on connect (filtered to this user's faction)
  ws.send(JSON.stringify({ type: 'eye_states', data: buildEyeStatesPayload(ws._factionId) }));

  // Send latest warlord weapons if available for this faction
  if (ws._factionId && factionWarlordWeapons.has(ws._factionId)) {
    ws.send(JSON.stringify({ type: 'warlord_weapons', data: factionWarlordWeapons.get(ws._factionId) }));
  }

  // Broadcast updated online list to faction members
  if (ws._userId) {
    broadcastEyeStates(ws._factionId);
  }

  // Handle incoming messages
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'eye_state' && ws._userId) {
      const newState = msg.state;
      if (!['not_watching', 'watching', 'watching_idle'].includes(newState)) return;

      const prev = eyeStates.get(ws._userId) || {};
      eyeStates.set(ws._userId, { state: newState, username: ws._username, factionId: ws._factionId, energy: prev.energy ?? null });
      broadcastEyeStates(ws._factionId);
    }

    if (msg.type === 'energy' && ws._userId) {
      const { current, max } = msg;
      if (typeof current !== 'number' || typeof max !== 'number') return;

      const prev = eyeStates.get(ws._userId) || {};
      eyeStates.set(ws._userId, { ...prev, energy: { current, max } });
      broadcastEyeStates(ws._factionId);
    }

    if (msg.type === 'warlord_weapons' && ws._factionId) {
      if (!Array.isArray(msg.data)) return;
      factionWarlordWeapons.set(ws._factionId, msg.data);
      const broadcast = JSON.stringify({ type: 'warlord_weapons', data: msg.data });
      for (const client of wss.clients) {
        if (client.readyState === 1 && client._factionId === ws._factionId) {
          client.send(broadcast);
        }
      }
    }
  });

  // On disconnect, remove from online list and notify faction
  ws.on('close', () => {
    if (ws._userId) {
      eyeStates.delete(ws._userId);
      broadcastEyeStates(ws._factionId);
    }
  });
});

app.use(createRoutes(broadcastSchedule));

// Serve built client in production
const clientDist = join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => res.sendFile(join(clientDist, 'index.html')));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
