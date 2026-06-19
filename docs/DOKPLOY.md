# Deploy with Dokploy

One `docker-compose.yml` deploys everything: the API, the **MQTT broker** for the ESP32,
the SQLite database (on a persistent volume), and the web dashboard — all in one container.

## 1. In Dokploy → **Create → Compose**
- **Provider:** GitHub → repo `KavinduGM/green-house`, branch `main`
- **Compose Path:** `docker-compose.yml` (it's in the repo root)
- **Compose Type:** Docker Compose

## 2. Set Environment variables (Dokploy → Environment tab)
Paste these and fill in real values:
```env
MQTT_PASSWORD=pick-a-strong-mqtt-password
APP_PASSWORD=your-app-login-password
JWT_SECRET=run `openssl rand -hex 32` and paste it here
ANTHROPIC_API_KEY=sk-ant-...your NEW rotated key...
# optional overrides:
# APP_EMAIL=kavindu@groovymark.com
# MQTT_USERNAME=greenhouse
# ANTHROPIC_MODEL=claude-opus-4-8
```
> The three with `:?` in the compose file (`MQTT_PASSWORD`, `APP_PASSWORD`, `JWT_SECRET`)
> are required — the deploy intentionally fails if they're missing, so you never run with defaults.

## 3. Deploy
Hit **Deploy**. Dokploy builds the image and starts the container. First build takes a few
minutes (it compiles the backend and bundles the web app).

## 4. Ports & access
The container publishes two ports on the VPS:

| Port | Use | How to reach it |
| --- | --- | --- |
| `8080` | API + web dashboard | `http://YOUR_VPS_IP:8080` — or attach a **Domain** in Dokploy pointing to port 8080 (gives you HTTPS automatically) |
| `1883` | MQTT (ESP32) | the ESP32 connects to `YOUR_VPS_IP:1883` |

Make sure your Hostinger firewall allows **8080** and **1883** (Dokploy/Traefik manages 80/443).

### Recommended: add a domain for HTTPS
In the Dokploy app → **Domains** → add e.g. `greenhouse.yourdomain.com` → Host port `8080`.
Dokploy issues a free TLS cert. Then use `https://greenhouse.yourdomain.com` as the
**Server URL** in the phone app. (MQTT stays on `1883` by IP — that's fine.)

## 5. Point the app + ESP32 at it
- **App:** open the APK, set Server URL to your domain (or `http://IP:8080`), log in with
  `APP_EMAIL` / `APP_PASSWORD`.
- **ESP32:** in `firmware/src/config.h` set `MQTT_HOST` = your VPS IP, `MQTT_PASS` = the
  `MQTT_PASSWORD` you set above. Flash it.

## Data & updates
- All data (SQLite DB + uploaded photos) persists in the `greenhouse-data` Docker volume —
  survives redeploys.
- To update: push to `main`, then hit **Redeploy** (or enable Auto-Deploy in Dokploy so every
  push redeploys automatically).
