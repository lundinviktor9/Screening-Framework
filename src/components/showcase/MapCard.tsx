import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapCardProps {
  location?: { address?: string; postcode?: string; lat?: number; lng?: number } | null;
  onLocationChange?: (lat: number, lng: number) => void;
}

const MAPBOX_TOKEN = (process.env.MAPBOX_TOKEN as string) || '';

export function MapCard({ location, onLocationChange }: MapCardProps) {
  if (!location?.lat || !location?.lng) {
    return (
      <div className="h-64 bg-brand-cardBg rounded-lg flex items-center justify-center">
        <span className="text-sm text-gray-600">Location TBC</span>
      </div>
    );
  }

  if (!MAPBOX_TOKEN) {
    return (
      <div className="h-64 bg-brand-cardBg rounded-lg flex items-center justify-center">
        <span className="text-sm text-gray-600">Map TBC (no Mapbox token)</span>
      </div>
    );
  }

  return (
    <div className="h-64 rounded-lg border border-gray-200 overflow-hidden">
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ latitude: location.lat, longitude: location.lng, zoom: 14 }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        scrollZoom={false}
        style={{ width: '100%', height: '100%' }}
      >
        <Marker
          latitude={location.lat}
          longitude={location.lng}
          color="#7D5A7D"
          draggable={!!onLocationChange}
          onDragEnd={(e) => onLocationChange?.(e.lngLat.lat, e.lngLat.lng)}
        />
      </Map>
    </div>
  );
}
