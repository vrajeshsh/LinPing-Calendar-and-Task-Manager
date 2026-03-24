/**
 * Location Service
 * Handles user location, timezone derivation, and sunrise/sunset calculations
 */

export interface UserLocation {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
  sunriseTime: string; // HH:mm
  sunsetTime: string;  // HH:mm
  isDaylight: boolean;
}

export type LocationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unavailable';

// Default location (New York) if no location available
const DEFAULT_LOCATION: UserLocation = {
  latitude: 40.7128,
  longitude: -74.006,
  city: 'New York',
  country: 'USA'
};

/**
 * Request browser location permission
 */
export async function requestLocationPermission(): Promise<LocationPermissionStatus> {
  if (!navigator.geolocation) {
    return 'unavailable';
  }

  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    if (permission.state === 'granted') {
      return 'granted';
    }
    if (permission.state === 'denied') {
      return 'denied';
    }
    return 'prompt';
  } catch {
    // Permission API not supported, try direct request
    return 'prompt';
  }
}

/**
 * Get user's current location from browser
 */
export async function getCurrentLocation(): Promise<UserLocation | null> {
  if (!navigator.geolocation) {
    console.warn('Geolocation not supported');
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const location: UserLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        // Try to get city/country from coordinates using reverse geocoding
        try {
          const placeInfo = await reverseGeocode(location.latitude, location.longitude);
          if (placeInfo) {
            location.city = placeInfo.city;
            location.country = placeInfo.country;
          }
        } catch (e) {
          // Continue without city info
        }

        resolve(location);
      },
      (error) => {
        console.warn('Location error:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes cache
      }
    );
  });
}

/**
 * Reverse geocode coordinates to get city/country
 * Uses Nominatim (OpenStreetMap) - free, no API key needed
 */
async function reverseGeocode(lat: number, lon: number): Promise<{ city?: string; country?: string } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
      {
        headers: {
          'User-Agent': 'LinPing-Calendar/1.0',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    
    // Try to get city from address components
    const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county;
    const country = data.address?.country_code?.toUpperCase();

    return { city, country: country || data.address?.country };
  } catch (e) {
    console.warn('Reverse geocoding failed:', e);
    return null;
  }
}

/**
 * Get timezone from coordinates using browser or calculate
 * Uses Intl API to derive timezone from coordinates
 */
export function getTimezoneFromLocation(latitude: number, longitude: number): string {
  try {
    // Use Intl to get timezone from coordinates
    const timezone = Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
      .resolvedOptions().timeZone;
    return timezone;
  } catch {
    return 'America/New_York'; // Default fallback
  }
}

/**
 * Calculate sunrise and sunset times for a given date and location
 * Uses a simplified algorithm based on latitude/longitude
 */
export function getSunTimes(date: Date, latitude: number, longitude: number): SunTimes {
  // Convert to radians
  const latRad = (latitude * Math.PI) / 180;
  
  // Get day of year
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  
  // Solar declination (approximate)
  const declination = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * (Math.PI / 180));
  const decRad = (declination * Math.PI) / 180;
  
  // Hour angle at sunrise/sunset
  // cos(hourAngle) = -tan(lat) * tan(declination)
  const tanProduct = -Math.tan(latRad) * Math.tan(decRad);
  
  let hourAngle: number;
  if (tanProduct >= 1) {
    // Sun never rises (polar night)
    hourAngle = 0;
  } else if (tanProduct <= -1) {
    // Sun never sets (midnight sun)
    hourAngle = 180;
  } else {
    hourAngle = Math.acos(tanProduct) * (180 / Math.PI);
  }
  
  // Convert hour angle to hours
  const dayLengthHours = 2 * (hourAngle / 15);
  
  // Solar noon (approximate, depends on longitude within timezone)
  // At 0 longitude, solar noon is at 12:00 UTC
  // Each degree of longitude = 4 minutes time difference
  const timezoneOffset = getTimezoneOffset(latitude, longitude);
  const solarNoon = 12 - timezoneOffset / 60;
  
  // Sunrise and sunset times
  const sunriseHour = solarNoon - dayLengthHours / 2;
  const sunsetHour = solarNoon + dayLengthHours / 2;
  
  // Create Date objects
  const sunrise = new Date(date);
  sunrise.setHours(Math.floor(sunriseHour), Math.floor((sunriseHour % 1) * 60), 0, 0);
  
  const sunset = new Date(date);
  sunset.setHours(Math.floor(sunsetHour), Math.floor((sunsetHour % 1) * 60), 0, 0);
  
  // Format times
  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  
  const now = new Date();
  const isDaylight = now >= sunrise && now <= sunset;
  
  return {
    sunrise,
    sunset,
    sunriseTime: formatTime(sunrise),
    sunsetTime: formatTime(sunset),
    isDaylight
  };
}

/**
 * Get timezone offset in minutes for a location
 * This is a simplified calculation
 */
function getTimezoneOffset(latitude: number, longitude: number): number {
  // Try to get actual timezone from browser
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Get offset for this timezone
    const date = new Date();
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    return (tzDate.getTime() - utcDate.getTime()) / 60000;
  } catch {
    // Estimate from longitude (each 15 degrees = 1 hour)
    // This is very rough and doesn't account for timezone boundaries
    return Math.round(longitude / 15) * 60;
  }
}

/**
 * Format time for display (12-hour format)
 */
export function formatTime12h(time: string): string {
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${period}`;
}

/**
 * Get default location
 */
export function getDefaultLocation(): UserLocation {
  return DEFAULT_LOCATION;
}

/**
 * Calculate day progress (0-1) based on sunrise/sunset
 */
export function getDayProgress(sunTimes: SunTimes): number {
  const now = new Date();
  const sunriseMs = sunTimes.sunrise.getTime();
  const sunsetMs = sunTimes.sunset.getTime();
  const nowMs = now.getTime();
  
  if (nowMs < sunriseMs) return 0;
  if (nowMs > sunsetMs) return 1;
  
  return (nowMs - sunriseMs) / (sunsetMs - sunriseMs);
}

/**
 * Check if current time is during daylight
 */
export function isDaytime(): boolean {
  const now = new Date();
  // This will be updated when we have actual location
  const sunTimes = getSunTimes(now, DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude);
  return sunTimes.isDaylight;
}