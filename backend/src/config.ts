import 'dotenv/config';
import path from 'node:path';

const root = process.cwd();

export const config = {
  port: Number(process.env.PORT ?? 8080),
  mqttPort: Number(process.env.MQTT_PORT ?? 1883),
  mqttUsername: process.env.MQTT_USERNAME ?? 'greenhouse',
  mqttPassword: process.env.MQTT_PASSWORD ?? 'change-me-mqtt',
  appEmail: (process.env.APP_EMAIL ?? 'admin@local').toLowerCase(),
  appPassword: process.env.APP_PASSWORD ?? 'change-me-please',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8',
  uploadDir: path.resolve(root, process.env.UPLOAD_DIR ?? './data/uploads'),
  firmwareDir: path.resolve(root, process.env.FIRMWARE_DIR ?? './data/firmware'),
  dbPath: path.resolve(root, process.env.DB_PATH ?? './data/greenhouse.db'),
  // Base URL the ESP32 uses to download OTA firmware (defaults to the request host).
  otaBaseUrl: process.env.OTA_BASE_URL ?? '',
};

export const hasClaude = () => config.anthropicApiKey.startsWith('sk-ant-');
