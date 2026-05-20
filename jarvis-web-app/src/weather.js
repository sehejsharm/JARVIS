// Weather for Udaipur, Rajasthan via Open-Meteo (free, no API key required).

const UDAIPUR = { lat: 24.5854, lon: 73.7125, name: "Udaipur, Rajasthan" };

// WMO weather interpretation codes -> human readable.
const WEATHER_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Moderate snowfall",
  75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function describe(code) {
  return WEATHER_CODES[code] ?? "Unknown conditions";
}

export async function getWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${UDAIPUR.lat}&longitude=${UDAIPUR.lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
    `&timezone=Asia%2FKolkata&forecast_days=1`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
    const data = await res.json();

    const c = data.current ?? {};
    const d = data.daily ?? {};

    return {
      location: UDAIPUR.name,
      current: {
        temperature: c.temperature_2m,
        feelsLike: c.apparent_temperature,
        humidity: c.relative_humidity_2m,
        windSpeed: c.wind_speed_10m,
        conditions: describe(c.weather_code),
      },
      forecast: {
        high: d.temperature_2m_max?.[0],
        low: d.temperature_2m_min?.[0],
        precipitationChance: d.precipitation_probability_max?.[0],
        conditions: describe(d.weather_code?.[0]),
        sunrise: d.sunrise?.[0]?.split("T")[1],
        sunset: d.sunset?.[0]?.split("T")[1],
      },
      ok: true,
    };
  } catch (err) {
    return { location: UDAIPUR.name, ok: false, error: err.message };
  }
}
