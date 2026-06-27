// (PlatformIO build of the same v1.2 firmware as the Arduino sketch)
/* =====================================================================
   GREENHOUSE ESP32 CONTROLLER  —  v1.2  (dynamic actuators + OTA + self-heal)
   ---------------------------------------------------------------------
   - Reads DHT22 (temp/humidity) + capacitive soil-moisture sensor
   - Drives ANY number of relays you define in the app (key + GPIO pin),
     pushed live from the server — no reflash needed to add a button.
   - Generic automation: any actuator can be driven by any sensor + thresholds.
   - Self-healing reconnect + reboot, and OTA firmware updates over the internet.

   ----- BEFORE YOU UPLOAD (one time, via USB) -----
   Boards Manager: "esp32 by Espressif". Libraries: PubSubClient, ArduinoJson v7,
   DHT sensor library (+ Adafruit Unified Sensor). Edit CONFIG below. Upload.
   After this, add/rename relays and rules from the app — they push automatically.
   ===================================================================== */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <HTTPUpdate.h>

/* ===================== CONFIG — EDIT THESE ===================== */
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"
#define MQTT_HOST       "72.60.201.67"
#define MQTT_PORT       1883
#define MQTT_USER       "greenhouse"
#define MQTT_PASS       "0eyYG1ihBnUNG8Q4cGo7"
#define DEVICE_ID       "greenhouse-01"
#define FW_VERSION      "fw-1.2.0"

#define PIN_DHT         4
#define PIN_SOIL        34
#define SOIL_DRY        3200
#define SOIL_WET        1300

#define SENSOR_INTERVAL_MS   10000
#define OFFLINE_REBOOT_MS    300000     // self-heal: reboot if no MQTT for 5 min
/* ============================================================== */

WiFiClient   net;
PubSubClient mqtt(net);
DHT          dht(PIN_DHT, DHT22);

#define MAX_ACT   12
#define MAX_RULES 16

struct Act { char key[24]; int pin; bool activeLow; bool on; char mode[12]; uint32_t offAt; int capMin; };
Act acts[MAX_ACT]; int actCount = 0;

struct Rule {
  char actuator[24]; char sensor[16];
  bool hasOnAbove; float onAbove; bool hasOffBelow; float offBelow;
  bool hasOnBelow; float onBelow; bool hasOffAbove; float offAbove; int maxRunMin;
};
Rule rules[MAX_RULES]; int ruleCount = 0;

float gTemp = NAN, gHum = NAN, gSoil = NAN;
uint32_t lastSensor = 0, lastMqttOk = 0, lastReconnect = 0;
char topicBuf[64];

const char* T(const char* s) { snprintf(topicBuf, sizeof(topicBuf), "gh/%s/%s", DEVICE_ID, s); return topicBuf; }
Act* findAct(const char* k) { for (int i = 0; i < actCount; i++) if (strcmp(acts[i].key, k) == 0) return &acts[i]; return nullptr; }

void applyRelay(Act &a) {
  if (a.pin < 0) return;
  bool level = a.activeLow ? !a.on : a.on;
  digitalWrite(a.pin, level ? HIGH : LOW);
}

void publishState() {
  JsonDocument d;
  for (int i = 0; i < actCount; i++) d[acts[i].key] = acts[i].on;
  char buf[512]; size_t n = serializeJson(d, buf, sizeof(buf));
  mqtt.publish(T("up/state"), (uint8_t*)buf, n, false);
}

void setActuator(Act &a, bool on, uint32_t durationMs = 0) {
  a.on = on;
  a.offAt = (on && durationMs > 0) ? millis() + durationMs : 0;
  if (a.capMin > 0 && on) {                                   // per-actuator safety cap
    uint32_t cap = millis() + (uint32_t)a.capMin * 60000UL;
    if (a.offAt == 0 || a.offAt > cap) a.offAt = cap;
  }
  applyRelay(a);
  publishState();
}

float sensorVal(const char* s) {
  if (!strcmp(s, "temperature")) return gTemp;
  if (!strcmp(s, "humidity")) return gHum;
  if (!strcmp(s, "soil_moisture")) return gSoil;
  return NAN;
}

void runAutomation() {
  for (int i = 0; i < actCount; i++) {
    Act &a = acts[i];
    if (strcmp(a.mode, "auto") != 0) continue;
    bool reqOn = false, reqOff = false; uint32_t dur = 0;
    for (int j = 0; j < ruleCount; j++) {
      Rule &r = rules[j];
      if (strcmp(r.actuator, a.key) != 0) continue;
      float v = sensorVal(r.sensor);
      if (isnan(v)) continue;
      if (r.hasOnAbove && v >= r.onAbove) reqOn = true;
      if (r.hasOnBelow && v <= r.onBelow) { reqOn = true; if (r.maxRunMin > 0) dur = (uint32_t)r.maxRunMin * 60000UL; }
      if (r.hasOffBelow && v <= r.offBelow) reqOff = true;
      if (r.hasOffAbove && v >= r.offAbove) reqOff = true;
    }
    bool want = a.on;
    if (reqOn) want = true; else if (reqOff) want = false;     // ON wins on conflict
    if (want != a.on) setActuator(a, want, want ? dur : 0);
  }
}

void applyConfig(JsonDocument &d) {
  if (d["actuators"].is<JsonArray>()) {
    Act old[MAX_ACT]; int oldN = actCount;
    for (int i = 0; i < oldN; i++) old[i] = acts[i];
    actCount = 0;
    for (JsonObject o : d["actuators"].as<JsonArray>()) {
      if (actCount >= MAX_ACT) break;
      Act &a = acts[actCount];
      strlcpy(a.key, o["key"] | "", sizeof(a.key));
      a.pin = o["pin"] | -1;
      a.activeLow = o["active_low"] | true;
      strlcpy(a.mode, o["mode"] | "manual", sizeof(a.mode));
      a.capMin = o["safety_cap_min"] | 0;
      a.on = false; a.offAt = 0;
      for (int i = 0; i < oldN; i++) if (strcmp(old[i].key, a.key) == 0) { a.on = old[i].on; a.offAt = old[i].offAt; }
      if (a.pin >= 0) { pinMode(a.pin, OUTPUT); applyRelay(a); }
      actCount++;
    }
  }
  if (d["autorules"].is<JsonArray>()) {
    ruleCount = 0;
    for (JsonObject o : d["autorules"].as<JsonArray>()) {
      if (ruleCount >= MAX_RULES) break;
      Rule &r = rules[ruleCount];
      strlcpy(r.actuator, o["actuator_key"] | "", sizeof(r.actuator));
      strlcpy(r.sensor, o["sensor"] | "", sizeof(r.sensor));
      r.hasOnAbove = !o["on_above"].isNull();  r.onAbove = o["on_above"] | 0.0f;
      r.hasOffBelow = !o["off_below"].isNull(); r.offBelow = o["off_below"] | 0.0f;
      r.hasOnBelow = !o["on_below"].isNull();  r.onBelow = o["on_below"] | 0.0f;
      r.hasOffAbove = !o["off_above"].isNull(); r.offAbove = o["off_above"] | 0.0f;
      r.maxRunMin = o["max_run_min"] | 0;
      ruleCount++;
    }
  }
  publishState();
}

void doOta(const char* url) {
  Serial.printf("OTA: %s\n", url);
  WiFiClient c; httpUpdate.rebootOnUpdate(true);
  t_httpUpdate_return r = httpUpdate.update(c, url);
  if (r == HTTP_UPDATE_FAILED) Serial.printf("OTA failed: %s\n", httpUpdate.getLastErrorString().c_str());
}

void readAndPublishSensors() {
  float h = dht.readHumidity(), t = dht.readTemperature();
  if (!isnan(h)) gHum = h;
  if (!isnan(t)) gTemp = t;
  int raw = analogRead(PIN_SOIL);
  float pct = 100.0f * (float)(SOIL_DRY - raw) / (float)(SOIL_DRY - SOIL_WET);
  gSoil = pct < 0 ? 0 : pct > 100 ? 100 : pct;

  JsonDocument d;
  if (!isnan(gTemp)) d["temperature"] = gTemp;
  if (!isnan(gHum)) d["humidity"] = gHum;
  d["soil_moisture"] = gSoil;
  char buf[160]; size_t n = serializeJson(d, buf, sizeof(buf));
  mqtt.publish(T("up/sensors"), (uint8_t*)buf, n, false);
}

void onMessage(char* topic, byte* payload, unsigned int len) {
  JsonDocument d;
  if (deserializeJson(d, payload, len)) return;
  if (strstr(topic, "/dn/cmd")) {
    Act *a = findAct(d["key"] | "");
    if (!a) return;
    uint32_t dur = d["duration_min"].is<int>() ? (uint32_t)d["duration_min"] * 60000UL : 0;
    setActuator(*a, strcmp(d["action"] | "", "on") == 0, dur);
  } else if (strstr(topic, "/dn/ota")) {
    const char* url = d["url"] | "";
    if (strlen(url) > 0) doOta(url);
  } else if (strstr(topic, "/dn/config")) {
    applyConfig(d);
  }
}

bool mqttConnectOnce() {
  if (!mqtt.connect(DEVICE_ID, MQTT_USER, MQTT_PASS)) return false;
  mqtt.subscribe(T("dn/cmd"));
  mqtt.subscribe(T("dn/config"));
  mqtt.subscribe(T("dn/ota"));
  JsonDocument d; d["name"] = "Greenhouse Controller"; d["fw"] = FW_VERSION;
  char buf[96]; size_t n = serializeJson(d, buf, sizeof(buf));
  mqtt.publish(T("up/hello"), (uint8_t*)buf, n, false);   // server replies with dn/config
  publishState();
  return true;
}

void setup() {
  Serial.begin(115200);
  // boot-safe: park the 3 legacy relay pins OFF (active-low) until config arrives
  for (int p : {25, 26, 27}) { pinMode(p, OUTPUT); digitalWrite(p, HIGH); }
  analogReadResolution(12);
  dht.begin();

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi…");
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) { delay(300); Serial.print("."); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " connected" : " (retrying)");

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMessage);
  mqtt.setBufferSize(2048);    // room for dynamic actuator/rule config
  mqtt.setKeepAlive(20);
  lastMqttOk = millis();
}

void loop() {
  uint32_t nowMs = millis();
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqtt.connected()) {
      if (nowMs - lastReconnect > 5000) { lastReconnect = nowMs; Serial.print("MQTT… "); Serial.println(mqttConnectOnce() ? "connected" : "retry"); }
    } else { mqtt.loop(); lastMqttOk = nowMs; }
  }
  if (nowMs - lastMqttOk > OFFLINE_REBOOT_MS) { Serial.println("Offline too long — rebooting"); delay(200); ESP.restart(); }

  for (int i = 0; i < actCount; i++) if (acts[i].on && acts[i].offAt && nowMs >= acts[i].offAt) setActuator(acts[i], false);

  if (nowMs - lastSensor >= SENSOR_INTERVAL_MS) {
    lastSensor = nowMs;
    if (mqtt.connected()) readAndPublishSensors();
    runAutomation();
  }
}
