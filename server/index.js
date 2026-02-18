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

function broadcastSchedule() {
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 2);

  const slots = getSchedule(from.toISOString(), to.toISOString());
  const message = JSON.stringify({ type: 'schedule', data: { slots } });

  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

function buildEyeStatesPayload() {
  const states = {};
  for (const [userId, data] of eyeStates) {
    states[userId] = { state: data.state, username: data.username, energy: data.energy ?? null };
  }
  return states;
}

function broadcastEyeStates() {
  const message = JSON.stringify({ type: 'eye_states', data: buildEyeStatesPayload() });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
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

  // Register authenticated user as online (default: not_watching)
  if (ws._userId) {
    eyeStates.set(ws._userId, { state: 'not_watching', username: ws._username });
  }

  // Send current schedule on connect
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 2);

  const slots = getSchedule(from.toISOString(), to.toISOString());
  ws.send(JSON.stringify({ type: 'schedule', data: { slots } }));

  // Send current eye states on connect
  ws.send(JSON.stringify({ type: 'eye_states', data: buildEyeStatesPayload() }));

  // Broadcast updated online list to everyone
  if (ws._userId) {
    broadcastEyeStates();
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
      eyeStates.set(ws._userId, { state: newState, username: ws._username, energy: prev.energy ?? null });
      broadcastEyeStates();
    }

    if (msg.type === 'energy' && ws._userId) {
      const { current, max } = msg;
      if (typeof current !== 'number' || typeof max !== 'number') return;

      const prev = eyeStates.get(ws._userId) || {};
      eyeStates.set(ws._userId, { ...prev, energy: { current, max } });
      broadcastEyeStates();
    }
  });

  // On disconnect, remove from online list and reset eye state
  ws.on('close', () => {
    if (ws._userId) {
      eyeStates.delete(ws._userId);
      broadcastEyeStates();
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
