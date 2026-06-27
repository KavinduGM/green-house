// WMO weather interpretation codes → friendly label + emoji.
// https://open-meteo.com/en/docs (weather_code)
export function describeWeather(code: number, isDay = 1): { label: string; icon: string } {
  const day = isDay !== 0;
  const map: Record<number, { label: string; icon: string }> = {
    0: { label: 'Clear', icon: day ? '☀️' : '🌙' },
    1: { label: 'Mainly clear', icon: day ? '🌤️' : '🌙' },
    2: { label: 'Partly cloudy', icon: day ? '⛅' : '☁️' },
    3: { label: 'Overcast', icon: '☁️' },
    45: { label: 'Fog', icon: '🌫️' },
    48: { label: 'Rime fog', icon: '🌫️' },
    51: { label: 'Light drizzle', icon: '🌦️' },
    53: { label: 'Drizzle', icon: '🌦️' },
    55: { label: 'Heavy drizzle', icon: '🌧️' },
    61: { label: 'Light rain', icon: '🌦️' },
    63: { label: 'Rain', icon: '🌧️' },
    65: { label: 'Heavy rain', icon: '🌧️' },
    66: { label: 'Freezing rain', icon: '🌧️' },
    67: { label: 'Freezing rain', icon: '🌧️' },
    71: { label: 'Light snow', icon: '🌨️' },
    73: { label: 'Snow', icon: '🌨️' },
    75: { label: 'Heavy snow', icon: '❄️' },
    77: { label: 'Snow grains', icon: '🌨️' },
    80: { label: 'Light showers', icon: '🌦️' },
    81: { label: 'Showers', icon: '🌧️' },
    82: { label: 'Heavy showers', icon: '⛈️' },
    85: { label: 'Snow showers', icon: '🌨️' },
    86: { label: 'Snow showers', icon: '❄️' },
    95: { label: 'Thunderstorm', icon: '⛈️' },
    96: { label: 'Storm + hail', icon: '⛈️' },
    99: { label: 'Storm + hail', icon: '⛈️' },
  };
  return map[code] ?? { label: '—', icon: '🌡️' };
}

export const weekday = (iso: string) =>
  new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'short' });
