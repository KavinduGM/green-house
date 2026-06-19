# ESP32 controller — wiring & flashing

Controls the **12 V water pump** (drip irrigation), the **light**, and the **blower fan**
via relays, and reads **temperature/humidity (DHT22)** and **soil moisture**.

## Parts (your kit)
- NodeMCU ESP32 (30-pin, Type-C)
- 3-channel (or 3× 1-channel) relay module
- DHT22 / AM2302 temperature & humidity sensor
- Capacitive soil moisture sensor (analog)
- Diaphragm pump 12 V 4.5 L/min (TY-44520), a light, a fan — all 12 V
- 12 V power supply for the loads + the pump

## Wiring

| ESP32 pin | Connects to |
| --- | --- |
| GPIO26 | Relay IN1 → **pump** |
| GPIO27 | Relay IN2 → **light** |
| GPIO25 | Relay IN3 → **fan** |
| GPIO4  | DHT22 data (+ 10kΩ pull-up to 3V3) |
| GPIO34 | Soil sensor analog out (input-only pin) |
| 3V3    | DHT22 VCC, soil sensor VCC |
| VIN/5V | Relay module VCC (most boards need 5 V) |
| GND    | Common ground — **ESP32, relays, sensors, and the 12 V supply ground must be tied together** |

**Loads:** wire each 12 V device through its relay's COM/NO contacts on the 12 V supply.
The ESP32 only switches the relay coil; the 12 V never touches the ESP32.

> Relay boards are usually **active-LOW**. The firmware defaults to that
> (`RELAY_ACTIVE_LOW true` in `firmware/src/config.h`). Flip it if your relays are active-high.

### Drip math (already wired into the app)
Your setup delivers ~1 L/plant per 15 min, so the app shows run-time → litres and the
pump's manual/auto run uses minutes. Adjust in the Control screen.

## Flashing

1. Install **VS Code** + the **PlatformIO** extension (or the PlatformIO CLI).
2. Open the `firmware/` folder.
3. Edit `firmware/src/config.h`:
   - `WIFI_SSID` / `WIFI_PASSWORD` — your onsite router
   - `MQTT_HOST` — your VPS public IP (or domain)
   - `MQTT_USER` / `MQTT_PASS` — must match the backend `.env`
   - Confirm the GPIO pins match your wiring
   - Calibrate `SOIL_DRY` / `SOIL_WET` (read raw values in dry air vs in water)
4. Connect the ESP32 by USB and click **Upload** (or `pio run -t upload`).
5. Open the serial monitor (115200 baud) to watch it connect.

When it connects, it appears **Online** on the app's dashboard and Control screen.

## Modes (per device: pump / light / fan)
- **Manual** — you flip it on/off from the app (pump also takes a run duration).
- **Schedule** — runs at the times you set on the Control screen.
- **Auto** — the ESP32 enforces the climate rules **locally**:
  - Fan turns on above your temperature/humidity thresholds.
  - Pump runs when soil moisture drops below your threshold (with a max run-time cap).
  Auto keeps working even if the internet or VPS goes down.

## Safety
- The firmware caps any single pump run at 30 min (`PUMP_MAX_RUN_MS`) as a flood guard.
- Use a fused 12 V supply rated above the combined load of pump + fan + light.
