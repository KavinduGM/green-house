# Deploying the backend to your Hostinger KVM2 VPS

The backend is one Node process that serves the API, hosts the **MQTT broker** the
ESP32 connects to, stores everything in SQLite, and proxies Claude. The app and the
ESP32 both connect to this VPS.

## 1. Point a hostname (optional but recommended)
Use your VPS public IP directly (e.g. `http://203.0.113.10:8080`) or set up a
subdomain (e.g. `greenhouse.yourdomain.com`) in Hostinger's DNS pointing to the VPS IP.

## 2. Install Node on the VPS
SSH in (`ssh root@YOUR_VPS_IP`) and:
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git
```

## 3. Copy the project up
From your Mac:
```bash
# from the project root
rsync -av --exclude node_modules --exclude dist --exclude data \
  backend/ root@YOUR_VPS_IP:/opt/greenhouse/backend/
```
(Or `git clone` if you push this repo somewhere.)

## 4. Configure
```bash
cd /opt/greenhouse/backend
cp .env.example .env
nano .env
```
Set these in `.env`:
- `APP_PASSWORD` — your app login password
- `JWT_SECRET` — a long random string (`openssl rand -hex 32`)
- `MQTT_PASSWORD` — password the ESP32 will use
- `ANTHROPIC_API_KEY` — your **new** key (the one you shared is compromised — rotate it)

## 5. Build & run
```bash
npm install
npm run build
node dist/index.js     # quick test — should print API + MQTT listening
```

## 6. Keep it running (systemd)
Create `/etc/systemd/system/greenhouse.service`:
```ini
[Unit]
Description=Greenhouse backend
After=network.target

[Service]
WorkingDirectory=/opt/greenhouse/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
EnvironmentFile=/opt/greenhouse/backend/.env

[Install]
WantedBy=multi-user.target
```
Then:
```bash
systemctl daemon-reload
systemctl enable --now greenhouse
systemctl status greenhouse
```

## 7. Open the firewall ports
```bash
ufw allow 8080/tcp     # API (the app)
ufw allow 1883/tcp     # MQTT (the ESP32)
```
> In Hostinger's panel, also confirm these ports are open in any cloud firewall.

## 8. (Optional) HTTPS
For a secure `https://` URL, put **Caddy** or **nginx** in front:
```bash
apt-get install -y caddy
# /etc/caddy/Caddyfile:
greenhouse.yourdomain.com {
    reverse_proxy localhost:8080
}
```
Caddy gets a free TLS certificate automatically. Then use
`https://greenhouse.yourdomain.com` as the Server URL in the app.
The MQTT port (1883) stays as-is for the ESP32.

## 9. Hosting the web app too (optional)
The backend serves anything in `backend/public/`. To use the app in a browser:
```bash
cd app && npm run build
scp -r dist/* root@YOUR_VPS_IP:/opt/greenhouse/backend/public/
```
Then `http://YOUR_VPS_IP:8080` opens the app in a browser as well as the API.

## First login
The first boot creates your user from `APP_EMAIL` / `APP_PASSWORD`. Use those in the app.
