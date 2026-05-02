#!/usr/bin/env bash
# VPS Panel Agent Installer
# Usage: curl -s https://yourpanel.com/install.sh | API_KEY=your_key_here bash
# Or:    API_KEY=your_key_here AGENT_PORT=7001 bash install.sh

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ─── Config ──────────────────────────────────────────────────────────────────
AGENT_PORT="${AGENT_PORT:-7001}"
AGENT_DIR="${AGENT_DIR:-/opt/vps-panel-agent}"
AGENT_REPO="${AGENT_REPO:-https://github.com/yourorg/vps-panel.git}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mongodb}"
PM2_APP_NAME="vps-agent"

# ─── Validate ─────────────────────────────────────────────────────────────────
[[ -z "${API_KEY:-}" ]] && error "API_KEY environment variable is required.\nUsage: API_KEY=your_key curl -s https://yourpanel.com/install.sh | bash"
[[ "$EUID" -ne 0 ]] && error "Please run as root (sudo bash)"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     VPS Panel Agent Installer        ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ─── OS Detection ────────────────────────────────────────────────────────────
info "Detecting OS..."
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  OS=$ID
  info "Detected: $PRETTY_NAME"
else
  warn "Cannot detect OS, assuming Debian/Ubuntu"
  OS="ubuntu"
fi

# ─── Install Node.js ─────────────────────────────────────────────────────────
install_node() {
  if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    info "Node.js already installed: $NODE_VER"
    # Require >= 18
    MAJOR=$(echo "$NODE_VER" | cut -d'.' -f1 | tr -d 'v')
    if [[ "$MAJOR" -lt 18 ]]; then
      warn "Node.js $NODE_VER is too old. Installing Node.js 20..."
    else
      return 0
    fi
  fi

  info "Installing Node.js 20 LTS..."
  case "$OS" in
    ubuntu|debian)
      apt-get update -qq
      apt-get install -y -qq curl ca-certificates
      curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
      apt-get install -y -qq nodejs
      ;;
    centos|rhel|fedora|rocky|almalinux)
      curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
      yum install -y nodejs >/dev/null 2>&1 || dnf install -y nodejs >/dev/null 2>&1
      ;;
    *)
      error "Unsupported OS: $OS. Install Node.js 20+ manually and re-run."
      ;;
  esac
  success "Node.js $(node --version) installed"
}

# ─── Install PM2 ─────────────────────────────────────────────────────────────
install_pm2() {
  if command -v pm2 &>/dev/null; then
    info "PM2 already installed: $(pm2 --version)"
    return 0
  fi
  info "Installing PM2..."
  npm install -g pm2 >/dev/null 2>&1
  pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
  success "PM2 $(pm2 --version) installed"
}

# ─── Install git ─────────────────────────────────────────────────────────────
install_git() {
  if command -v git &>/dev/null; then return 0; fi
  info "Installing git..."
  case "$OS" in
    ubuntu|debian) apt-get install -y -qq git ;;
    *) yum install -y git >/dev/null 2>&1 || dnf install -y git >/dev/null 2>&1 ;;
  esac
}

# ─── Setup agent ─────────────────────────────────────────────────────────────
setup_agent() {
  info "Setting up agent in $AGENT_DIR..."

  # Create dir
  mkdir -p "$AGENT_DIR"

  # If repo doesn't exist, clone. Else pull.
  if [[ -d "$AGENT_DIR/.git" ]]; then
    info "Updating existing agent..."
    cd "$AGENT_DIR" && git pull --quiet
  else
    # If no git (manual install), create agent inline
    info "Creating agent from installer..."
    create_agent_files
  fi

  # Write .env
  cat > "$AGENT_DIR/.env" <<ENV
PORT=${AGENT_PORT}
API_KEY=${API_KEY}
BACKUP_DIR=${BACKUP_DIR}
MONGO_URI=${MONGO_URI:-mongodb://localhost:27017}
NODE_ENV=production
ENV
  chmod 600 "$AGENT_DIR/.env"
  success ".env configured"

  # Install deps
  cd "$AGENT_DIR"
  info "Installing dependencies..."
  npm install --production --silent
  success "Dependencies installed"

  # Create backup dir
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"
  success "Backup dir: $BACKUP_DIR"
}

# ─── Create agent files inline (no git needed) ───────────────────────────────
create_agent_files() {
  mkdir -p "$AGENT_DIR"/{routes,controllers,utils,middleware}

  # package.json
  cat > "$AGENT_DIR/package.json" <<'PKGJSON'
{
  "name": "vps-panel-agent",
  "version": "1.0.0",
  "main": "app.js",
  "scripts": { "start": "node app.js" },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "systeminformation": "^5.22.10"
  }
}
PKGJSON

  info "Agent files created (download full source from your panel's git repo for complete functionality)"
  warn "For the full agent, clone from your panel repo and copy the agent/ directory to $AGENT_DIR"
}

# ─── Start with PM2 ──────────────────────────────────────────────────────────
start_agent() {
  cd "$AGENT_DIR"

  # Stop existing if running
  pm2 delete "$PM2_APP_NAME" 2>/dev/null || true

  pm2 start app.js \
    --name "$PM2_APP_NAME" \
    --env production \
    --max-restarts 10 \
    --restart-delay 3000 \
    >/dev/null 2>&1

  pm2 save >/dev/null 2>&1
  success "Agent started with PM2 (name: $PM2_APP_NAME)"
}

# ─── Open firewall port ───────────────────────────────────────────────────────
open_firewall() {
  info "Opening port $AGENT_PORT..."
  if command -v ufw &>/dev/null; then
    ufw allow "$AGENT_PORT/tcp" >/dev/null 2>&1 && success "UFW: port $AGENT_PORT opened"
  elif command -v firewall-cmd &>/dev/null; then
    firewall-cmd --permanent --add-port="$AGENT_PORT/tcp" >/dev/null 2>&1
    firewall-cmd --reload >/dev/null 2>&1
    success "Firewalld: port $AGENT_PORT opened"
  else
    warn "No firewall detected. Ensure port $AGENT_PORT is open manually."
  fi
}

# ─── Verify ───────────────────────────────────────────────────────────────────
verify_agent() {
  info "Verifying agent..."
  sleep 3

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-API-Key: ${API_KEY}" \
    "http://localhost:${AGENT_PORT}/ping" 2>/dev/null || echo "000")

  if [[ "$HTTP_CODE" == "200" ]]; then
    success "Agent is responding on port $AGENT_PORT ✅"
    return 0
  else
    warn "Agent not responding yet (HTTP $HTTP_CODE). Check: pm2 logs $PM2_APP_NAME"
    return 1
  fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  install_node
  install_pm2
  install_git
  setup_agent
  start_agent
  open_firewall
  verify_agent

  echo ""
  echo "════════════════════════════════════════════"
  success "VPS Panel Agent installed successfully!"
  echo "════════════════════════════════════════════"
  echo ""
  echo "  Agent port:  $AGENT_PORT"
  echo "  Agent dir:   $AGENT_DIR"
  echo "  Backup dir:  $BACKUP_DIR"
  echo "  PM2 name:    $PM2_APP_NAME"
  echo ""
  echo "  Commands:"
  echo "    pm2 status           — check agent status"
  echo "    pm2 logs $PM2_APP_NAME — view agent logs"
  echo "    pm2 restart $PM2_APP_NAME — restart agent"
  echo ""
  echo "  Now go to your panel and ping this server!"
  echo ""
}

main
