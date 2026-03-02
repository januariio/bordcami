import { Loader } from '@googlemaps/js-api-loader';

let loaderInstance: Loader | null = null;

function getLoader(): Loader {
  if (!loaderInstance) {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
    if (!key) throw new Error('VITE_GOOGLE_MAPS_API_KEY não definida');
    loaderInstance = new Loader({ apiKey: key, libraries: ['places'], language: 'pt-BR', region: 'BR' });
  }
  return loaderInstance;
}

export async function loadPlaces(): Promise<typeof google.maps.places> {
  const loader = getLoader();
  return loader.importLibrary('places');
}

export async function loadCore(): Promise<typeof google.maps> {
  const loader = getLoader();
  await loader.importLibrary('core');
  return google.maps;
}

export interface DistanceResult {
  distanceKm: number;
  durationText: string;
}

export async function getDistance(originPlaceId: string, destPlaceId: string): Promise<DistanceResult> {
  await loadCore();
  return new Promise((resolve, reject) => {
    const service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      {
        origins: [{ placeId: originPlaceId }],
        destinations: [{ placeId: destPlaceId }],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
      },
      (response, status) => {
        if (status !== 'OK' || !response) {
          reject(new Error(`Distance Matrix falhou: ${status}`));
          return;
        }
        const element = response.rows[0]?.elements[0];
        if (!element || element.status !== 'OK') {
          reject(new Error('Rota não encontrada'));
          return;
        }
        resolve({
          distanceKm: Math.round(element.distance.value / 1000),
          durationText: element.duration.text,
        });
      },
    );
  });
}

export interface GasStation {
  name: string;
  address: string;
  rating?: number;
  placeId: string;
  location: { lat: number; lng: number };
}

export async function findGasStations(lat: number, lng: number, radius = 15000): Promise<GasStation[]> {
  await loadCore();
  await loadPlaces();

  const container = document.createElement('div');
  const service = new google.maps.places.PlacesService(container);

  return new Promise((resolve, reject) => {
    service.nearbySearch(
      {
        location: new google.maps.LatLng(lat, lng),
        radius,
        type: 'gas_station',
        keyword: 'diesel',
      },
      (results, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
          resolve([]);
          return;
        }
        const stations: GasStation[] = results
          .slice(0, 10)
          .map(r => ({
            name: r.name ?? 'Posto',
            address: r.vicinity ?? '',
            rating: r.rating,
            placeId: r.place_id ?? '',
            location: {
              lat: r.geometry?.location?.lat() ?? lat,
              lng: r.geometry?.location?.lng() ?? lng,
            },
          }));
        resolve(stations);
      },
    );
  });
}
