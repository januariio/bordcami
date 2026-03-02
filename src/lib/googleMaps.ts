const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

export interface PlaceSuggestion {
  description: string;
  placeId: string;
}

export async function autocompleteCities(input: string): Promise<PlaceSuggestion[]> {
  if (!API_KEY || input.length < 2) return [];

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ['br'],
      languageCode: 'pt-BR',
      includedPrimaryTypes: ['locality'],
    }),
  });

  if (!res.ok) return [];
  const data = await res.json();

  return (data.suggestions ?? [])
    .filter((s: any) => s.placePrediction)
    .map((s: any) => ({
      description: s.placePrediction.text.text as string,
      placeId: s.placePrediction.placeId as string,
    }));
}

export interface PlaceLocation {
  lat: number;
  lng: number;
}

export async function getPlaceLocation(placeId: string): Promise<PlaceLocation | null> {
  if (!API_KEY) return null;

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'location',
    },
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data.location) return null;
  return { lat: data.location.latitude, lng: data.location.longitude };
}

export interface DistanceResult {
  distanceKm: number;
  durationText: string;
}

export async function getDistance(originPlaceId: string, destPlaceId: string): Promise<DistanceResult> {
  if (!API_KEY) throw new Error('API key ausente');

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
    },
    body: JSON.stringify({
      origin: { placeId: originPlaceId },
      destination: { placeId: destPlaceId },
      travelMode: 'DRIVE',
    }),
  });

  if (!res.ok) throw new Error('Routes API falhou');
  const data = await res.json();

  const route = data.routes?.[0];
  if (!route) throw new Error('Rota não encontrada');

  const distanceKm = Math.round(route.distanceMeters / 1000);
  const totalSeconds = parseInt(route.duration?.replace('s', '') ?? '0', 10);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const durationText = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;

  return { distanceKm, durationText };
}

export interface GasStation {
  name: string;
  address: string;
  rating?: number;
  placeId: string;
  fuelPrices?: { type: string; price: string }[];
}

export async function findGasStations(lat: number, lng: number, radius = 15000): Promise<GasStation[]> {
  if (!API_KEY) return [];

  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.id,places.fuelOptions,places.location',
    },
    body: JSON.stringify({
      includedTypes: ['gas_station'],
      maxResultCount: 10,
      languageCode: 'pt-BR',
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius,
        },
      },
    }),
  });

  if (!res.ok) return [];
  const data = await res.json();

  return (data.places ?? []).map((p: any) => {
    const fuelPrices: { type: string; price: string }[] = [];
    if (p.fuelOptions?.fuelPrices) {
      for (const fp of p.fuelOptions.fuelPrices) {
        if (fp.type?.toLowerCase().includes('diesel') || fp.type === 'DIESEL') {
          const price = fp.price?.units
            ? `R$ ${fp.price.units},${String(fp.price.nanos ?? 0).slice(0, 2).padEnd(2, '0')}`
            : '';
          fuelPrices.push({ type: fp.type, price });
        }
      }
    }
    return {
      name: p.displayName?.text ?? 'Posto',
      address: p.formattedAddress ?? '',
      rating: p.rating,
      placeId: p.id ?? '',
      fuelPrices: fuelPrices.length > 0 ? fuelPrices : undefined,
    };
  });
}
