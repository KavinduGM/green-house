/* =====================================================================
   GREENHOUSE ESP32 CONTROLLER  —  Arduino IDE sketch
   ---------------------------------------------------------------------
   Controls: water pump, grow light, blower fan (via relays)
   Reads:    DHT22 (temp/humidity) + capacitive soil-moisture sensor
   Talks to: your VPS backend over MQTT (control from the phone app)

   ----- BEFORE YOU UPLOAD -----
   1) Arduino IDE → Boards Manager → install "esp32 by Espressif Systems".
   2) Library Manager → install:
        - "PubSubClient" by Nick O'Leary
        - "ArduinoJson" by Benoit Blanchon  (v7)
        - "DHT sensor library" by Adafruit  (+ "Adafruit Unified Sensor")
   3) Edit the 4 settings in the CONFIG block below.
   4) Tools → Board → "ESP32 Dev Module", select the COM port, click Upload.
   ===================================================================== */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

/* ===================== CONFIG — EDIT THESE ===================== */
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

#define MQTT_HOST       "YOUR_VPS_IP"     // e.g. "203.0.113.10"  (your Hostinger VPS)
#define MQTT_PORT       1883
#define MQTT_USER       "greenhouse"       // = backend MQTT_USERNAME
#define MQTT_PASS       "change-me-mqtt"    // = backend MQTT_PASSWORD

#define DEVICE_ID       "greenhouse-01"     // keep as-is (matches the seeded device)
#define FW_VERSION      "fw-1.0.0"

/* ---- GPIO pin map (match your wiring / the diagram) ---- */
#define PIN_RELAY_PUMP  26
#define PIN_RELAY_LIGHT 27
#define PIN_RELAY_FAN   25
#define PIN_DHT         4        // DHT22 data
#define PIN_SOIL        34       // soil moisture analog (input-only pin)

// Most cheap relay boards are ACTIVE-LOW (LOW = ON). Set false if yours is active-high.
#define RELAY_ACTIVE_LOW true

// Soil calibration (raw 12-bit ADC): reading in dry air, and fully in water.
#define SOIL_DRY        3200
#define SOIL_WET        1300

#define SENSOR_INTERVAL_MS  10000     // publish sensors every 10 s
#define PUMP_MAX_RUN_MS     1800000   // safety: never run pump > 30 min
/* ============================================================== */

WiFiClient   net;
PubSubClient mqtt(net);
DHT          dht(PIN_DHT, DHT22);

struct Act { const char* key; uint8_t pin; bool on; String mode; uint32_t offAt; };
Act acts[3] = {
  { "pump",  PIN_RELAY_PUMP,  false, "manual", 0 },
  { "light", PIN_RELAY_LIGHT, false, "manual", 0 },
  { "fan",   PIN_RELAY_FAN,   false, "manual", 0 },
};

struct { float onAbove = 32, offBelow = 29; bool enabled = true; } fanTemp;
struct { float onAbove = 85, offBelow = 75; bool enabled = true; } fanHum;
struct { float onBelow = 35, offAbove = 60; int maxRunMin = 15; bool enabled = true; } pumpSoil;

float gTemp = NAN, gHum = NAN, gSoil = NAN;
uint32_t lastSensor = 0;
char topicBuf[64];

Act* findAct(const char* k) { for (auto &a : acts) if (strcmp(a.key, k) == 0) return &a; return nullptr; }

void applyRelay(Act &a) {
  bool level = a.on;
  if (RELAY_ACTIVE_LOW) level = !level;
  digitalWrite(a.pin, level ? HIGH : LOW);
}

const char* T(const char* suffix) { snprintf(topicBuf, sizeof(topicBuf), "gh/%s/%s", DEVICE_ID, suffix); return topicBuf; }

void publishState() {
  StaticJsonDocument<128> d;
  for (auto &a : acts) d[a.key] = a.on;
  char buf[128]; size_t n = serializeJson(d, buf);
  mqtt.publish(T("up/state"), (uint8_t*)buf, n, false);
}

void setActuator(Act &a, bool on, uint32_t durationMs = 0) {
  a.on = on;
  a.offAt = (on && durationMs > 0) ? millis() + durationMs : 0;
  if (strcmp(a.key, "pump") == 0 && on) {        // global pump flood-safety cap
    uint32_t cap = millis() + PUMP_MAX_RUN_MS;
    if (a.offAt == 0 || a.offAt > cap) a.offAt = cap;
  }
  applyRelay(a);
  publishState();
}

float readSoilPct() {
  int raw = analogRead(PIN_SOIL);
  float pct = 100.0f * (float)(SOIL_DRY - raw) / (float)(SOIL_DRY - SOIL_WET);
  if (pct < 0) pct = 0; if (pct > 100) pct = 100;
  return pct;
}

void readAndPublishSensors() {
  float h = dht.readHumidity();
  float tC = dht.readTemperature();
  if (!isnan(h)) gHum = h;
  if (!isnan(tC)) gTemp = tC;
  gSoil = readSoilPct();

  StaticJsonDocument<128> d;
  if (!isnan(gTemp)) d["temperature"] = gTemp;
  if (!isnan(gHum)) d["humidity"] = gHum;
  d["soil_moisture"] = gSoil;
  char buf[128]; size_t n = serializeJson(d, buf);
  mqtt.publish(T("up/sensors"), (uint8_t*)buf, n, false);
}

void runAutomation() {
  Act *fan = findAct("fan");
  if (fan && fan->mode == "auto") {
    bool want = fan->on;
    if (fanTemp.enabled && !isnan(gTemp)) {
      if (gTemp >= fanTemp.onAbove) want = true;
      else if (gTemp <= fanTemp.offBelow) want = false;
    }
    if (fanHum.enabled && !isnan(gHum)) {
      if (gHum >= fanHum.onAbove) want = true;
      else if (gHum <= fanHum.offBelow && (isnan(gTemp) || gTemp <= fanTemp.offBelow)) want = false;
    }
    if (want != fan->on) setActuator(*fan, want);
  }

  Act *pump = findAct("pump");
  if (pump && pump->mode == "auto" && pumpSoil.enabled && !isnan(gSoil)) {
    if (!pump->on && gSoil <= pumpSoil.onBelow)
      setActuator(*pump, true, (uint32_t)pumpSoil.maxRunMin * 60000UL);
    else if (pump->on && gSoil >= pumpSoil.offAbove)
      setActuator(*pump, false);
  }
}

void onMessage(char* topic, byte* payload, unsigned int len) {
  StaticJsonDocument<512> d;
  if (deserializeJson(d, payload, len)) return;

  if (strstr(topic, "/dn/cmd")) {
    Act *a = findAct(d["key"] | "");
    if (!a) return;
    uint32_t dur = d["duration_min"].is<int>() ? (uint32_t)d["duration_min"] * 60000UL : 0;
    setActuator(*a, strcmp(d["action"] | "", "on") == 0, dur);
  }
  else if (strstr(topic, "/dn/config")) {
    JsonObject r = d["rules"];
    if (!r.isNull()) {
      if (r["fan_temp"].is<JsonObject>())     { fanTemp.onAbove = r["fan_temp"]["onAbove"] | fanTemp.onAbove; fanTemp.offBelow = r["fan_temp"]["offBelow"] | fanTemp.offBelow; fanTemp.enabled = r["fan_temp"]["enabled"] | true; }
      if (r["fan_humidity"].is<JsonObject>()) { fanHum.onAbove = r["fan_humidity"]["onAbove"] | fanHum.onAbove; fanHum.offBelow = r["fan_humidity"]["offBelow"] | fanHum.offBelow; fanHum.enabled = r["fan_humidity"]["enabled"] | true; }
      if (r["pump_soil"].is<JsonObject>())    { pumpSoil.onBelow = r["pump_soil"]["onBelow"] | pumpSoil.onBelow; pumpSoil.offAbove = r["pump_soil"]["offAbove"] | pumpSoil.offAbove; pumpSoil.maxRunMin = r["pump_soil"]["maxRunMin"] | pumpSoil.maxRunMin; pumpSoil.enabled = r["pump_soil"]["enabled"] | true; }
    }
    for (JsonObject m : d["modes"].as<JsonArray>()) {
      Act *a = findAct(m["key"] | "");
      if (a) a->mode = String((const char*)(m["mode"] | "manual"));
    }
  }
}

void connectMqtt() {
  while (!mqtt.connected()) {
    Serial.print("MQTT… ");
    if (mqtt.connect(DEVICE_ID, MQTT_USER, MQTT_PASS)) {
      Serial.println("connected");
      mqtt.subscribe(T("dn/cmd"));
      mqtt.subscribe(T("dn/config"));
      StaticJsonDocument<96> d; d["name"] = "Greenhouse Controller"; d["fw"] = FW_VERSION;
      char buf[96]; size_t n = serializeJson(d, buf);
      mqtt.publish(T("up/hello"), (uint8_t*)buf, n, false);
      publishState();
    } else {
      Serial.printf("failed rc=%d, retry in 2s\n", mqtt.state());
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  for (auto &a : acts) { pinMode(a.pin, OUTPUT); applyRelay(a); }   // start all OFF
  analogReadResolution(12);
  dht.begin();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi…");
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) { delay(300); Serial.print("."); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " connected" : " (will keep retrying)");

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMessage);
  mqtt.setBufferSize(512);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) { WiFi.reconnect(); delay(500); }
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  uint32_t nowMs = millis();
  for (auto &a : acts) if (a.on && a.offAt && nowMs >= a.offAt) setActuator(a, false);

  if (nowMs - lastSensor >= SENSOR_INTERVAL_MS) {
    lastSensor = nowMs;
    readAndPublishSensors();
    runAutomation();
  }
}
