# 🖥️ VPS Panel — Self-Hosted Server Management

A production-ready SaaS-style VPS management panel. Connect your servers, monitor stats in real-time, manage PM2 apps, stream logs, and take MongoDB backups — all from one UI.

---

## Architecture

```
Browser (Next.js)
     │  JWT auth
     ▼
Backend API (Node.js + Express + Socket.io)
     │  API Key (X-API-Key header)
     ▼
Agent (Node.js on each VPS)
     │
     ├── systeminformation  → CPU/RAM/Disk stats
     ├── PM2                → App management
     ├── mongodump          → Backups
     └── SSE stream         → Live logs
```

**Frontend never talks directly to the VPS.** All communication goes through the backend.

---

## Features

| Feature | Status |
|---------|--------|
| JWT Register / Login | ✅ |
| Add / delete servers | ✅ |
| API key generation (hashed, shown once) | ✅ |
| CPU / RAM / Disk charts (live polling) | ✅ |
| PM2 app list, restart, stop | ✅ |
| Real-time log streaming (Socket.io + SSE) | ✅ |
| MongoDB backup + download | ✅ |
| Rate limiting + helmet security | ✅ |
| Agent install script | ✅ |

---

## Project Structure

```
vps-panel/
├── backend/           Node.js + Express API
│   ├── controllers/
│   ├── models/        User.js, Server.js
│   ├── routes/
│   ├── middleware/    auth.js (JWT)
│   ├── services/      agentService.js
│   ├── sockets/       index.js (log streaming)
│   └── app.js
│
├── agent/             Runs ON the VPS
│   ├── controllers/   status, apps, backup, logs
│   ├── routes/
│   ├── utils/         shell.js (safe exec)
│   ├── middleware/    apiKeyAuth.js
│   └── app.js
│
├── frontend/          Next.js 14 App Router
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── page.js        Server list
│   │   │   └── server/[id]/   Server detail
│   │   ├── login/
│   │   └── register/
│   ├── components/
│   │   ├── ServerCard.jsx
│   │   ├── StatsChart.jsx     Chart.js line graphs
│   │   ├── LogsViewer.jsx     Terminal-style log UI
│   │   ├── BackupList.jsx
│   │   └── AddServerModal.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   └── useLogStream.js    Socket.io log hook
│   └── lib/
│       └── api.js             Axios + interceptors
│
└── install.sh         One-line agent installer
```

---

## Setup

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- (On each VPS) Node.js 18+, PM2, mongodump

---

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm install
npm run dev       # development
npm start         # production
```

**Environment variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend port | `5000` |
| `MONGODB_URI` | MongoDB connection string | required |
| `JWT_SECRET` | Secret for signing JWTs | required |
| `JWT_EXPIRES_IN` | Token expiry | `7d` |
| `FRONTEND_URL` | CORS origin | `http://localhost:3000` |
| `AGENT_TIMEOUT` | Agent request timeout (ms) | `10000` |

---

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Edit NEXT_PUBLIC_API_URL and NEXT_PUBLIC_SOCKET_URL
npm install
npm run dev       # http://localhost:3000
npm run build && npm start   # production
```

**Environment variables:**

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_SOCKET_URL` | Backend Socket.io URL |

---

### 3. Agent (on each VPS)

**Option A — One-line install:**

```bash
curl -s https://yourpanel.com/install.sh | API_KEY=your_api_key_here bash
```

**Option B — Manual:**

```bash
# Copy the agent/ directory to your VPS
scp -r agent/ user@your-vps:/opt/vps-panel-agent

# SSH into VPS
ssh user@your-vps
cd /opt/vps-panel-agent

cp .env.example .env
# Edit .env: set API_KEY, PORT, MONGO_URI, BACKUP_DIR

npm install --production
pm2 start app.js --name vps-agent
pm2 save
pm2 startup
```

**Agent environment variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Agent listen port | `7001` |
| `API_KEY` | Must match the key from the panel | required |
| `BACKUP_DIR` | Where to store backups | `/var/backups/mongodb` |
| `MONGO_URI` | Local MongoDB URI | `mongodb://localhost:27017` |
| `BACKEND_IP` | Restrict CORS to backend IP | — |

---

## How to Connect a VPS

1. Go to **Dashboard → Add Server**
2. Enter name, IP/hostname, and agent port (default: 7001)
3. Copy the generated **API key** (shown ONCE — save it!)
4. On your VPS, run the install script with that key:
   ```bash
   API_KEY=<your_key> bash install.sh
   ```
5. Back in the panel, click **Ping** on the server card to verify connectivity

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Frontend → Backend | JWT Bearer token |
| Backend → Agent | API key in `X-API-Key` header (SHA-256 hashed in DB) |
| API key comparison | `crypto.timingSafeEqual` (prevents timing attacks) |
| Shell commands | `execFile` with no shell + arg whitelist (no injection possible) |
| File downloads | Path is resolved + validated against backup dir (no traversal) |
| Rate limiting | 200 req/15min globally, 20/15min on auth routes |
| HTTP security | `helmet` (CSP, HSTS, etc.) |

**What the agent does NOT allow:**
- Raw shell access
- Arbitrary command execution
- File system access outside backup dir
- Any command not in the whitelist

---

## Deployment (Nginx + SSL)

### Backend + Agent (same or different servers)

```nginx
# /etc/nginx/sites-available/vpspanel-backend
server {
    listen 443 ssl http2;
    server_name api.yourpanel.com;

    ssl_certificate /etc/letsencrypt/live/api.yourpanel.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourpanel.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";   # for Socket.io
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;                # long timeout for log streams
    }
}
```

```nginx
# /etc/nginx/sites-available/vpspanel-frontend
server {
    listen 443 ssl http2;
    server_name yourpanel.com;

    ssl_certificate /etc/letsencrypt/live/yourpanel.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourpanel.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Get SSL certificates:**
```bash
certbot --nginx -d yourpanel.com -d api.yourpanel.com
```

**Start with PM2:**
```bash
# Backend
cd /opt/vps-panel/backend
pm2 start app.js --name vps-backend

# Frontend
cd /opt/vps-panel/frontend
npm run build
pm2 start npm --name vps-frontend -- start

pm2 save
pm2 startup
```

---

## API Reference

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Current user |

### Servers (all require JWT)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/servers` | List servers |
| POST | `/api/servers` | Add server |
| GET | `/api/servers/:id` | Get server |
| PATCH | `/api/servers/:id` | Update server |
| DELETE | `/api/servers/:id` | Delete server |
| POST | `/api/servers/:id/ping` | Ping agent |
| POST | `/api/servers/:id/regenerate-key` | New API key |
| GET | `/api/servers/:id/status` | Stats |
| GET | `/api/servers/:id/apps` | PM2 apps |
| POST | `/api/servers/:id/apps/restart` | Restart app |
| POST | `/api/servers/:id/apps/stop` | Stop app |
| POST | `/api/servers/:id/backup` | Trigger backup |
| GET | `/api/servers/:id/backups` | List backups |
| GET | `/api/servers/:id/backups/:filename/download` | Download |

### Socket.io Events
```js
// Connect
const socket = io(SOCKET_URL, { auth: { token: 'your_jwt' } });

// Subscribe to logs
socket.emit('subscribe_logs', { serverId, appName, lines: 200 });

// Receive
socket.on('log_line', ({ message, type, timestamp, appName }) => {});
socket.on('log_error', ({ message }) => {});
socket.on('log_end', () => {});

// Stop
socket.emit('unsubscribe_logs');
```

---

## Development Notes

- Agent uses `systeminformation` — no root required for stats
- PM2 must be installed on the VPS and the agent must be in the same user context as PM2
- `mongodump` must be in PATH on the VPS
- Log streaming uses SSE (agent) → Socket.io (backend) → WebSocket (browser)
- API keys are stored SHA-256 hashed; the raw key is shown once at creation
- To regenerate a key: Dashboard → Server → Regenerate Key (update agent .env too)

---

## License

MIT
