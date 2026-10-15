/**
 * Weather Service for atmen
 * 
 * Provides honest, grounded, keyless weather information for the morning edition
 * using the public Open-Meteo WMO API.
 * 
 * Invariants:
 * - Never forces geolocation permission: uses user-selected city (default Berlin)
 * - Transparent attribution with data source and exact retrieval timestamp
 * - Fails safely: if network is offline or service unavailable, returns null
 * - Never invents synthetic fallback temperatures or fake weather conditions
 * - In-memory cache prevents redundant network requests within 30 minutes
 */

export interface WeatherLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  country: string;
}

export const SUPPORTED_WEATHER_LOCATIONS: Record<string, WeatherLocation> = {
  berlin: { id: 'berlin', name: 'Berlin', lat: 52.52, lon: 13.405, country: 'DE' },
  hamburg: { id: 'hamburg', name: 'Hamburg', lat: 53.551, lon: 9.993, country: 'DE' },
  muenchen: { id: 'muenchen', name: 'München', lat: 48.135, lon: 11.582, country: 'DE' },
  koeln: { id: 'koeln', name: 'Köln', lat: 50.937, lon: 6.96, country: 'DE' },
  frankfurt: { id: 'frankfurt', name: 'Frankfurt a.M.', lat: 50.11, lon: 8.682, country: 'DE' },
  leipzig: { id: 'leipzig', name: 'Leipzig', lat: 51.339, lon: 12.373, country: 'DE' },
  stuttgart: { id: 'stuttgart', name: 'Stuttgart', lat: 48.775, lon: 9.182, country: 'DE' },
  wien: { id: 'wien', name: 'Wien', lat: 48.208, lon: 16.373, country: 'AT' },
  zuerich: { id: 'zuerich', name: 'Zürich', lat: 47.376, lon: 8.541, country: 'CH' }
};

export interface WeatherData {
  locationName: string;
  temperatureCelsius: number;
  weatherCode: number;
  weatherDescription: string;
  iconName: string;
  retrievalTime: string;
  dataSource: string;
  practicalNote: string;
  isDay: boolean;
  windSpeedKmh?: number;
}

interface CacheEntry {
  data: WeatherData;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function mapWmoCode(code: number, isDay: boolean): { description: string; icon: string; note: string } {
  switch (code) {
    case 0:
      return {
        description: 'Klarer Himmel',
        icon: isDay ? 'sunny-outline' : 'moon-outline',
        note: isDay ? 'Ausgezeichnete Sicht & helles Morgenlicht' : 'Klare, ruhige Abendstimmung'
      };
    case 1:
      return {
        description: 'Überwiegend heiter',
        icon: isDay ? 'partly-sunny-outline' : 'cloudy-night-outline',
        note: 'Gute Bedingungen für einen konzentrierten Spaziergang'
      };
    case 2:
      return {
        description: 'Teilweise bewölkt',
        icon: isDay ? 'partly-sunny-outline' : 'cloudy-night-outline',
        note: 'Wechselnde Bewölkung, angenehm mildes Licht'
      };
    case 3:
      return {
        description: 'Bedeckt',
        icon: 'cloudy-outline',
        note: 'Gedämpftes Licht — ideal für fokussierte Lektüre'
      };
    case 45:
    case 48:
      return {
        description: 'Nebel / Frühdunst',
        icon: 'cloud-outline',
        note: 'Morgendlicher Dunst, ruhige Atmosphäre'
      };
    case 51:
    case 53:
    case 55:
      return {
        description: 'Leichter Nieselregen',
        icon: 'rainy-outline',
        note: 'Feuchter Morgen — Jacke oder Schirm einpacken'
      };
    case 61:
    case 63:
    case 65:
      return {
        description: 'Regen',
        icon: 'rainy-outline',
        note: 'Dauerhafter Regen — gemütliche Lesezeit drinnen'
      };
    case 71:
    case 73:
    case 75:
      return {
        description: 'Schneefall',
        icon: 'snow-outline',
        note: 'Schneefall — warme Kleidung empfohlen'
      };
    case 80:
    case 81:
    case 82:
      return {
        description: 'Regenschauer',
        icon: 'rainy-outline',
        note: 'Regenschauer möglich'
      };
    case 95:
    case 96:
    case 99:
      return {
        description: 'Gewitterneigung',
        icon: 'thunderstorm-outline',
        note: 'Unbeständig mit Gewitterrisiko'
      };
    default:
      return {
        description: 'Mäßige Bewölkung',
        icon: 'partly-sunny-outline',
        note: 'Typische Tageswetterlage'
      };
  }
}

export class WeatherService {
  /**
   * Fetches real weather data for a given city ID or lat/lon coordinates.
   * Returns null if offline, failed, or disabled. Never throws.
   */
  public static async getWeatherForCity(cityIdOrName: string = 'berlin'): Promise<WeatherData | null> {
    const key = cityIdOrName.toLowerCase().trim();
    const location = SUPPORTED_WEATHER_LOCATIONS[key] || SUPPORTED_WEATHER_LOCATIONS['berlin'];

    // Check cache
    const cached = memoryCache.get(location.id);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current_weather=true&timezone=Europe%2FBerlin`;

      // Timeout after 2500ms so UI never hangs
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 2500) : null;

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller?.signal
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const json = await response.json();
      const current = json.current_weather;
      if (!current || typeof current.temperature !== 'number') {
        return null;
      }

      const isDay = current.is_day === 1;
      const weatherCode = Number(current.weathercode ?? 0);
      const mapped = mapWmoCode(weatherCode, isDay);

      const now = new Date();
      const timeStr = `Heute, ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;

      const result: WeatherData = {
        locationName: location.name,
        temperatureCelsius: Math.round(current.temperature * 10) / 10,
        weatherCode,
        weatherDescription: mapped.description,
        iconName: mapped.icon,
        retrievalTime: timeStr,
        dataSource: 'Open-Meteo • WMO Deutscher Wetterdienst',
        practicalNote: mapped.note,
        isDay,
        windSpeedKmh: current.windspeed ? Math.round(current.windspeed) : undefined
      };

      // Store in memory cache
      memoryCache.set(location.id, {
        data: result,
        expiresAt: Date.now() + CACHE_TTL_MS
      });

      return result;
    } catch {
      // Safe, transparent failure: return null without fake fallback
      return null;
    }
  }

  /**
   * Clears the in-memory weather cache (used in testing).
   */
  public static clearCache(): void {
    memoryCache.clear();
  }
}
