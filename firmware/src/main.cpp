/*
 * Greenhouse ESP32 controller
 * - Connects to WiFi + MQTT broker (your VPS backend)
 * - Reads DHT22 (temp/humidity) + capacitive soil moisture
 * - Drives 3 relays: pump, light, fan
 * - Modes per actuator: manual | schedule | auto
 *   * manual/schedule: backend sends explicit on/off commands
 *   * auto: this firmware enforces climate rules LOCALLY so it keeps working
 *           even if the internet/VPS drops.
 *
 * Topics:
 *   up   gh/<id>/up/hello    {name,fw}
 *        gh/<id>/up/sensors  {temperature,humidity,soil_moisture}
 *        gh/<id>/up/state    {pump,light,fan}
 *   down gh/<id>/dn/cmd      {key,action:"on"|"off",duration_min?}
 *        gh/<id>/dn/config   {rules:{...}, modes:[{key,mode}]}
 */
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include "config.h"

WiFiClient net;
PubSubClient mqtt(net);
DHT dht(PIN_DHT, DHT22);

// actuator state
struct Act { const char* key; uint8_t pin; bool on; String mode; uint32_t offAt; };
Act acts[3] = {
  { "pump",  PIN_RELAY_PUMP,  false, "manual", 0 },
  { "light", PIN_RELAY_LIGHT, false, "manual", 0 },
  { "fan",   PIN_RELAY_FAN,   false, "manual", 0 },
};

// auto rules (defaults; overwritten by dn/config)
struct { float onAbove=32, offBelow=29; bool enabled=true; } fanTemp;
struct { float onAbove=85, offBelow=75; bool enabled=true; } fanHum;
struct { float onBelow=35, offAbove=60; int maxRunMin=15; bool enabled=true; } pumpSoil;

float gTemp = NAN, gHum = NAN, gSoil = NAN;
uint32_t lastSensor = 0;
char topicBuf[64];

Act* findAct(const char* k) {
  for (auto &a : acts) if (strcmp(a.key, k) == 0) return &a;
  return nullptr;
}

void applyRelay(Act &a) {
  bool level = a.on;
  if (RELAY_ACTIVE_LOW) level = !level;
  digitalWrite(a.pin, level ? HIGH : LOW);
}

const char* t(const char* suffix) {
  snprintf(topicBuf, sizeof(topicBuf), "gh/%s/%s", DEVICE_ID, suffix);
  return topicBuf;
}

void publishState() {
  StaticJsonDocument<128> d;
  for (auto &a : acts) d[a.key] = a.on;
  char buf[128]; size_t n = serializeJson(d, buf);
  mqtt.publish(t("up/state"), (uint8_t*)buf, n, false);
}

void setActuator(Act &a, bool on, uint32_t durationMs = 0) {
  a.on = on;
  a.offAt = (on && durationMs > 0) ? millis() + durationMs : 0;
  // global pump safety cap
  if (strcmp(a.key, "pump") == 0 && on) {
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
  mqtt.publish(t("up/sensors"), (uint8_t*)buf, n, false);
}

// Local climate automation for actuators in "auto" mode
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
      else if (gHum <= fanHum.offBelow && gTemp <= fanTemp.offBelow) want = false;
    }
    if (want != fan->on) setActuator(*fan, want);
  }

  Act *pump = findAct("pump");
  if (pump && pump->mode == "auto" && pumpSoil.enabled && !isnan(gSoil)) {
    if (!pump->on && gSoil <= pumpSoil.onBelow) {
      setActuator(*pump, true, (uint32_t)pumpSoil.maxRunMin * 60000UL);
    } else if (pump->on && gSoil >= pumpSoil.offAbove) {
      setActuator(*pump, false);
    }
  }
}

void onMessage(char* topic, byte* payload, unsigned int len) {
  StaticJsonDocument<512> d;
  if (deserializeJson(d, payload, len)) return;

  if (strstr(topic, "/dn/cmd")) {
    const char* key = d["key"] | "";
    const char* action = d["action"] | "";
    Act *a = findAct(key);
    if (!a) return;
    uint32_t dur = d["duration_min"].is<int>() ? (uint32_t)d["duration_min"] * 60000UL : 0;
    setActuator(*a, strcmp(action, "on") == 0, dur);
  }
  else if (strstr(topic, "/dn/config")) {
    JsonObject rules = d["rules"];
    if (!rules.isNull()) {
      if (rules["fan_temp"].is<JsonObject>()) {
        fanTemp.onAbove = rules["fan_temp"]["onAbove"] | fanTemp.onAbove;
        fanTemp.offBelow = rules["fan_temp"]["offBelow"] | fanTemp.offBelow;
        fanTemp.enabled = rules["fan_temp"]["enabled"] | true;
      }
      if (rules["fan_humidity"].is<JsonObject>()) {
        fanHum.onAbove = rules["fan_humidity"]["onAbove"] | fanHum.onAbove;
        fanHum.offBelow = rules["fan_humidity"]["offBelow"] | fanHum.offBelow;
        fanHum.enabled = rules["fan_humidity"]["enabled"] | true;
      }
      if (rules["pump_soil"].is<JsonObject>()) {
        pumpSoil.onBelow = rules["pump_soil"]["onBelow"] | pumpSoil.onBelow;
        pumpSoil.offAbove = rules["pump_soil"]["offAbove"] | pumpSoil.offAbove;
        pumpSoil.maxRunMin = rules["pump_soil"]["maxRunMin"] | pumpSoil.maxRunMin;
        pumpSoil.enabled = rules["pump_soil"]["enabled"] | true;
      }
    }
    JsonArray modes = d["modes"];
    for (JsonObject m : modes) {
      Act *a = findAct(m["key"] | "");
      if (a) a->mode = String((const char*)(m["mode"] | "manual"));
    }
  }
}

void connectMqtt() {
  while (!mqtt.connected()) {
    if (mqtt.connect(DEVICE_ID, MQTT_USER, MQTT_PASS)) {
      mqtt.subscribe(t("dn/cmd"));
      mqtt.subscribe(t("dn/config"));
      StaticJsonDocument<96> d; d["name"] = "Greenhouse Controller"; d["fw"] = FW_VERSION;
      char buf[96]; size_t n = serializeJson(d, buf);
      mqtt.publish(t("up/hello"), (uint8_t*)buf, n, false);
      publishState();
    } else {
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  for (auto &a : acts) { pinMode(a.pin, OUTPUT); applyRelay(a); }
  analogReadResolution(12);
  dht.begin();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) delay(300);

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMessage);
  mqtt.setBufferSize(512);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) { WiFi.reconnect(); delay(500); }
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  uint32_t nowMs = millis();

  // duration auto-off
  for (auto &a : acts) {
    if (a.on && a.offAt && nowMs >= a.offAt) setActuator(a, false);
  }

  if (nowMs - lastSensor >= SENSOR_INTERVAL_MS) {
    lastSensor = nowMs;
    readAndPublishSensors();
    runAutomation();
  }
}
