import { db, now } from '../db.js';
import { sendCommand } from '../mqtt.js';
import { emit } from '../bus.js';

// Ticks every minute. Fires schedules whose on_time matches the current minute
// (turns the actuator on, then off after duration_min). The ESP32 also enforces
// duration locally as a safety net in case the server/network drops.

interface ScheduleRow {
  id: number;
  device_id: string;
  actuator_key: string;
  days_mask: number;
  on_time: string;
  duration_min: number;
  enabled: number;
  last_run: string | null;
}

export function startScheduler() {
  setInterval(tick, 60_000);
  tick();
}

function tick() {
  const d = new Date();
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const todayStr = d.toISOString().slice(0, 10);
  const dayBit = 1 << d.getDay(); // 0=Sun

  const rows = db
    .prepare('SELECT * FROM schedules WHERE enabled = 1 AND on_time = ?')
    .all(hhmm) as ScheduleRow[];

  for (const s of rows) {
    if (!(s.days_mask & dayBit)) continue;
    if (s.last_run === `${todayStr} ${hhmm}`) continue; // already fired this minute today
    db.prepare('UPDATE schedules SET last_run = ? WHERE id = ?').run(`${todayStr} ${hhmm}`, s.id);

    sendCommand(s.device_id, { key: s.actuator_key, action: 'on', duration_min: s.duration_min, source: 'schedule' });
    setLocalState(s.device_id, s.actuator_key, 1);
    emit({ type: 'automation', deviceId: s.device_id, message: `Schedule: ${s.actuator_key} ON for ${s.duration_min} min` });

    if (s.duration_min > 0) {
      setTimeout(() => {
        sendCommand(s.device_id, { key: s.actuator_key, action: 'off', source: 'schedule' });
        setLocalState(s.device_id, s.actuator_key, 0);
        emit({ type: 'automation', deviceId: s.device_id, message: `Schedule: ${s.actuator_key} OFF (duration elapsed)` });
      }, s.duration_min * 60_000);
    }
  }
}

function setLocalState(deviceId: string, key: string, state: number) {
  db.prepare('UPDATE actuators SET state = ?, updated_at = ? WHERE device_id = ? AND key = ?').run(
    state, now(), deviceId, key,
  );
}
