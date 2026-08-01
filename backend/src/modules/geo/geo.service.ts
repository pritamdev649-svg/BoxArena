import { env } from '../../shared/config/env.js';

interface AutocompletePrediction {
  description: string;
  placeId: string;
}

interface ReverseGeocodeResult {
  formattedAddress: string;
  areaName: string;
  lat: number;
  lng: number;
}

const LUCKNOW_AREAS = [
  { name: 'Gomti Nagar', lat: 26.8467, lng: 80.9462 },
  { name: 'Aliganj', lat: 26.8894, lng: 80.9397 },
  { name: 'Hazratganj', lat: 26.8504, lng: 80.9495 },
  { name: 'Indiranagar', lat: 26.8836, lng: 80.9856 },
  { name: 'Chowk', lat: 26.8687, lng: 80.9026 },
  { name: 'Mahanagar', lat: 26.8778, lng: 80.9525 },
  { name: 'Jankipuram', lat: 26.9158, lng: 80.9472 },
  { name: 'Aashiana', lat: 26.7909, lng: 80.9168 },
];

export async function autocomplete(input: string): Promise<AutocompletePrediction[]> {
  const apiKey = env.GOOGLE_MAPS_SERVER_API_KEY;

  if (!apiKey) {
    // Fallback Mock data for Lucknow
    const query = input.toLowerCase();
    const matches = LUCKNOW_AREAS.filter((a) => a.name.toLowerCase().includes(query));
    
    const results = matches.length > 0 ? matches : LUCKNOW_AREAS;
    return results.map((a) => ({
      description: `${a.name}, Lucknow, Uttar Pradesh, India`,
      placeId: `mock_place_${a.name.toLowerCase().replace(/\s+/g, '_')}`,
    }));
  }

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
    input
  )}&key=${apiKey}&components=country:in`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google Maps API error: ${res.statusText}`);
    const data = await res.json() as any;
    
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API returned status: ${data.status}`);
    }

    const predictions = data.predictions || [];
    return predictions.map((p: any) => ({
      description: String(p.description),
      placeId: String(p.place_id),
    }));
  } catch (err) {
    // Graceful fallback to mock data on network/API failure
    const query = input.toLowerCase();
    const matches = LUCKNOW_AREAS.filter((a) => a.name.toLowerCase().includes(query));
    const results = matches.length > 0 ? matches : LUCKNOW_AREAS;
    return results.map((a) => ({
      description: `${a.name}, Lucknow, Uttar Pradesh, India`,
      placeId: `mock_place_${a.name.toLowerCase().replace(/\s+/g, '_')}`,
    }));
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const apiKey = env.GOOGLE_MAPS_SERVER_API_KEY;

  if (!apiKey) {
    // Find closest area
    let closest = LUCKNOW_AREAS[0]!;
    let minDist = Infinity;
    for (const area of LUCKNOW_AREAS) {
      const dist = Math.sqrt((area.lat - lat) ** 2 + (area.lng - lng) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closest = area;
      }
    }
    return {
      formattedAddress: `${closest.name}, Lucknow, Uttar Pradesh, India`,
      areaName: closest.name,
      lat,
      lng,
    };
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google Maps API error: ${res.statusText}`);
    const data = await res.json() as any;

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Geocoding API returned status: ${data.status}`);
    }

    const results = data.results || [];
    if (results.length === 0) {
      return {
        formattedAddress: 'Unknown Location',
        areaName: 'Unknown',
        lat,
        lng,
      };
    }

    const topResult = results[0];
    // Find sublocality, locality, or neighborhood for areaName
    let areaName = 'Lucknow';
    for (const component of topResult.address_components || []) {
      const types = component.types || [];
      if (
        types.includes('sublocality_level_1') ||
        types.includes('sublocality') ||
        types.includes('neighborhood')
      ) {
        areaName = String(component.long_name);
        break;
      }
    }

    return {
      formattedAddress: String(topResult.formatted_address),
      areaName,
      lat,
      lng,
    };
  } catch (err) {
    // Graceful fallback to closest mock area
    let closest = LUCKNOW_AREAS[0]!;
    let minDist = Infinity;
    for (const area of LUCKNOW_AREAS) {
      const dist = Math.sqrt((area.lat - lat) ** 2 + (area.lng - lng) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closest = area;
      }
    }
    return {
      formattedAddress: `${closest.name}, Lucknow, Uttar Pradesh, India`,
      areaName: closest.name,
      lat,
      lng,
    };
  }
}
