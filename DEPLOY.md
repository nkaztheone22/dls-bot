# Deploying DLS Bot to Hetzner

## What you need

- A Hetzner Cloud account (cloud.hetzner.com)
- A GitHub account (to push the code and trigger auto-deploys)
- Git installed on your local machine

---

## Step 1 — Create a Hetzner server

1. Go to [cloud.hetzner.com](https://cloud.hetzner.com) and create a new project
2. Click **Add Server**
3. Choose these settings:
   - **Location**: any (Frankfurt is closest for most users)
   - **Image**: Ubuntu 24.04
   - **Type**: CX22 (2 vCPU, 4 GB RAM) — ~€4/month is enough
   - **SSH Key**: add your public SSH key (required for auto-deploy)
4. Click **Create & Buy Now**
5. Note the server's **public IP address**

---

## Step 2 — Connect to your server

```bash
ssh root@YOUR_SERVER_IP
```

---

## Step 3 — Install Docker & Git

Run these commands on the server:

```bash
apt-get update
apt-get install -y ca-certificates curl git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

Verify it works:
```bash
docker --version
docker compose version
```

---

## Step 4 — Push the code to GitHub

On your **local machine**:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

## Step 5 — Clone and do the first deploy on the server

On the **Hetzner server**:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git /root/dls-bot
cd /root/dls-bot
docker compose build
docker compose up -d
```

The first build takes 5–10 minutes (installs all dependencies, compiles everything). After that, auto-deploys take about the same time but run unattended.

---

## Step 6 — Set up auto-deploy via GitHub Actions

Every time you push to `main`, GitHub will automatically SSH into your server, pull the latest code, rebuild, and restart the containers. To enable this:

### 6a — Get your private SSH key

On your **local machine**, show your private key:
```bash
cat ~/.ssh/id_ed25519
```
Copy the entire output (including the `-----BEGIN...` and `-----END...` lines).

> If you used a different key name (e.g. `id_rsa`), use that filename instead.

### 6b — Create a Telegram bot for notifications

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts — give it any name and username
3. BotFather will give you a **bot token** (looks like `123456:ABCdef...`) — copy it
4. Start a chat with your new bot (search for it by username and press **Start**)
5. Open this URL in your browser to get your **chat ID** (replace `YOUR_BOT_TOKEN`):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
   Look for `"id"` inside the `"chat"` object in the response — that number is your chat ID

### 6c — Add secrets to your GitHub repo

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add these four:

| Secret name | Value |
|---|---|
| `HETZNER_HOST` | Your server's IP address (e.g. `65.21.100.200`) |
| `HETZNER_SSH_KEY` | The full private key text you copied above |
| `TELEGRAM_BOT_TOKEN` | The token from BotFather |
| `TELEGRAM_CHAT_ID` | Your chat ID from the getUpdates URL |

### 6d — Done

From now on, every `git push origin main` will trigger an automatic redeploy. You'll get a Telegram message whether it succeeds or fails, with a direct link to the logs. You can also watch the progress under the **Actions** tab on GitHub.

---

## Step 7 — Pair your WhatsApp

Open your browser and go to:
```
http://YOUR_SERVER_IP
```

You'll see the DLS Bot dashboard. Click **"Use Phone Number"**, enter your number, and enter the pairing code in WhatsApp when prompted.

Since this server has a **dedicated IP**, WhatsApp will connect without any issues.

> **Important:** On first deploy, make sure `auth_info/` on the server is empty (it will be, since it's a fresh clone). Starting fresh gives WhatsApp no reason to reject the connection.

---

## Useful commands on the server

```bash
# View live logs from all containers
docker compose logs -f

# View only API/bot logs
docker compose logs -f api

# Restart just the bot (e.g. after it disconnects)
docker compose restart api

# Stop everything
docker compose down

# Manual rebuild (normally done automatically by GitHub Actions)
docker compose build && docker compose up -d
```

---

## Persistent data

Your bot session and settings survive container restarts and rebuilds because they are mounted as volumes:

| Folder on server | Contents |
|---|---|
| `/root/dls-bot/auth_info/` | WhatsApp session — your login credentials |
| `/root/dls-bot/data/` | Settings (antilink, banned words, etc.) and user warnings |

---

## Optional — Add HTTPS with a domain

If you have a domain, point an **A record** at your server IP. Then on the server:

```bash
# Install certbot
apt-get install -y certbot

# Stop the nginx container temporarily
cd /root/dls-bot && docker compose stop nginx

# Get a certificate (standalone mode)
certbot certonly --standalone -d yourdomain.com

# Update docker-compose.yml to mount certs and expose 443
```

Or use Hetzner's **Load Balancer** (in the Cloud console) which handles HTTPS termination automatically with no extra config.

---

## Troubleshooting

**Bot keeps getting 401 / won't show a QR or pairing code**
- Clear the old session and restart: `rm -rf /root/dls-bot/auth_info && docker compose restart api`
- Wait a few minutes then try pairing from the dashboard again.

**Dashboard shows "Cannot connect to API"**
- Check all containers are up: `docker compose ps`
- Check API logs: `docker compose logs api`

**Port 80 already in use on the server**
- Check what's using it: `ss -tlnp | grep :80`
- Stop the conflicting service, or change `"80:80"` to e.g. `"8080:80"` in `docker-compose.yml`.

**Auto-deploy failed in GitHub Actions**
- Open the **Actions** tab on GitHub and click the failed run to see the error log.
- Most common cause: the `HETZNER_SSH_KEY` secret was not copied correctly (must include the full header/footer lines).
