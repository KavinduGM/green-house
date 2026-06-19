#pragma once
// ============== EDIT THESE for your greenhouse ==============

// --- WiFi (your onsite router) ---
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// --- MQTT broker = your Hostinger VPS public IP/host + the backend MQTT_PORT ---
#define MQTT_HOST       "YOUR_VPS_IP"      // e.g. "203.0.113.10"
#define MQTT_PORT       1883
#define MQTT_USER       "greenhouse"        // must match backend .env MQTT_USERNAME
#define MQTT_PASS       "change-me-mqtt"     // must match backend .env MQTT_PASSWORD

// --- This controller's id (must match a device row; default seeded id) ---
#define DEVICE_ID       "greenhouse-01"
#define FW_VERSION      "fw-1.0.0"

// --- GPIO pin map (change to your wiring) ---
#define PIN_RELAY_PUMP  26
#define PIN_RELAY_LIGHT 27
#define PIN_RELAY_FAN   25
#define PIN_DHT         4          // DHT22 data pin
#define PIN_SOIL        34         // soil moisture analog (ADC1)

// Most cheap relay boards are ACTIVE-LOW (LOW = ON). Set false if yours is active-high.
#define RELAY_ACTIVE_LOW true

// Soil moisture calibration (raw ADC). Measure yours:
//   SOIL_DRY  = reading in dry air, SOIL_WET = reading fully in water.
#define SOIL_DRY        3200
#define SOIL_WET        1300

// Timings
#define SENSOR_INTERVAL_MS  10000   // publish sensors every 10s
#define PUMP_MAX_RUN_MS     1800000 // hard safety cap: never run pump > 30 min
