# 🌱 Greenhouse — Grow · Monitor · Control

A modern, minimalist greenhouse management system: an Android app + a backend on
your Hostinger VPS + an ESP32 controller. Track plants, predict growth with AI,
manage fertilizer schedules, and control irrigation/lighting/climate from anywhere.

## What's in here

| Folder | What it is |
| --- | --- |
| `app/` | The mobile app (React + Capacitor). Builds to an installable Android **APK**. |
| `backend/` | Node + TypeScript API, SQLite database, **embedded MQTT broker**, Claude AI proxy. Runs on your VPS. |
| `firmware/` | ESP32 controller code (PlatformIO) for pump, light, fan + DHT22 & soil sensors. |
| `docs/` | Step-by-step setup guides. |
| `dist/PlantPulse-v1.0.apk` | **The ready-to-install app.** Copy to your phone and tap to install. |

## Quick start (3 parts)

1. **Backend on the VPS** → easiest with **Dokploy**: [docs/DOKPLOY.md](docs/DOKPLOY.md)
   (one `docker-compose.yml` runs the API + MQTT broker + DB + web dashboard). Manual
   install without Docker: [docs/DEPLOY.md](docs/DEPLOY.md). Either way you paste your
   **new** Anthropic API key into the server config (never in the app).
2. **Install the app** → copy `dist/PlantPulse-v1.0.apk` to your phone, tap it, allow
   "install from unknown sources", open it, and enter your VPS address + login.
   See [docs/APK-INSTALL.md](docs/APK-INSTALL.md).
3. **Flash the ESP32** → wire it up and flash the firmware. See [docs/HARDWARE.md](docs/HARDWARE.md).

## Features

- 📸 **Photo → layout**: snap your hand-drawn grow-bag diagram, AI extracts the bag positions.
- 🌶️ **Bulk planting**: "today I planted 10 chilli" — one name, one date, many bags.
- 📈 **AI growth prediction**: per-crop model + your logged measurements continuously retrain the curve (predicted vs actual chart).
- 🧪 **Fertilizer scheduler**: auto-program from the planting date (Albert Solution, YaraMila Target on day 14, Grow More K44 around flowering) with reminders.
- 🐛 **Defect diagnosis**: describe/snap a problem, AI suggests cause + treatment, saved to the care log.
- 🪴 **2D visual compare**: see each plant drawn to scale — tall vs behind, side by side.
- 💧 **IoT control**: pump / light / fan — manual, scheduled, or fully automatic (climate rules run on the ESP32 even if the internet drops).
- 📊 Live dashboard with temperature, humidity, soil moisture and 24h history.

## Security note
The Anthropic API key lives **only** in `backend/.env` on your VPS. The app talks to your
backend, which calls Claude. Rotate the key you shared earlier — treat it as compromised.

## Rebuilding the APK after changes
```bash
./build-apk.sh        # outputs dist/PlantPulse-v1.0.apk
```
