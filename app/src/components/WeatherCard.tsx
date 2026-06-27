import { Droplets, Wind, CloudRain } from 'lucide-react';
import type { Weather } from '../lib/types';
import { describeWeather, weekday } from '../lib/weather';
import { Card } from './ui';

export function WeatherCard({ weather, compact }: { weather: Weather; compact?: boolean }) {
  const c = weather.current;
  const d = describeWeather(c.weather_code, c.is_day);
  return (
    <Card className="bg-gradient-to-br from-sky-50 to-leaf-50/40">
      <div className="flex items-center gap-3">
        <span className="text-4xl leading-none">{d.icon}</span>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{Math.round(c.temperature_2m)}°</span>
            <span className="text-sm text-gray-500">{d.label}</span>
          </div>
          <p className="text-xs text-gray-400">
            {weather.location ? `${weather.location} · ` : ''}feels {Math.round(c.apparent_temperature)}°
          </p>
        </div>
      </div>
      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><Droplets size={13} className="text-sky-500" /> {Math.round(c.relative_humidity_2m)}%</span>
        <span className="flex items-center gap-1"><CloudRain size={13} className="text-sky-500" /> {c.precipitation} mm</span>
        <span className="flex items-center gap-1"><Wind size={13} className="text-gray-400" /> {Math.round(c.wind_speed_10m)} km/h</span>
      </div>

      {!compact && weather.daily?.time?.length > 0 && (
        <div className="flex justify-between mt-4 pt-3 border-t border-black/5">
          {weather.daily.time.slice(0, 5).map((t, i) => {
            const dd = describeWeather(weather.daily.weather_code[i]);
            return (
              <div key={t} className="flex flex-col items-center gap-0.5">
                <span className="text-[11px] text-gray-400">{i === 0 ? 'Today' : weekday(t)}</span>
                <span className="text-lg">{dd.icon}</span>
                <span className="text-[11px] font-medium">{Math.round(weather.daily.temperature_2m_max[i])}°</span>
                <span className="text-[10px] text-gray-400">{Math.round(weather.daily.temperature_2m_min[i])}°</span>
                {weather.daily.precipitation_probability_max[i] != null && (
                  <span className="text-[9px] text-sky-500">{weather.daily.precipitation_probability_max[i]}%</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
