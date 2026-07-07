import { useState, useEffect } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { type DealRecord } from '../../store/useDealStore';
import { useMarketStore } from '../../store/marketStore';

interface DealMapProps {
  deals: DealRecord[];
  selectedDeal: DealRecord | null;
}

interface MapMarker {
  deal: DealRecord;
  lat: number;
  lng: number;
}

export function DealMap({ deals, selectedDeal }: DealMapProps) {
  const [popupDeal, setPopupDeal] = useState<DealRecord | null>(null);
  const [latitude, setLatitude] = useState(54);
  const [longitude, setLongitude] = useState(-2);
  const [zoom, setZoom] = useState(5);
  const markets = useMarketStore(s => s.markets);

  // Centre map on selected deal when it changes
  useEffect(() => {
    if (!selectedDeal?.market_ids.length) return;
    const market = markets.find(m => m.id === selectedDeal.market_ids[0]);
    if (!market) return;
    setLatitude(market.lat);
    setLongitude(market.lng);
    setZoom(10);
  }, [selectedDeal, markets]);

  // Get coordinates for deals
  const markers: MapMarker[] = deals
    .map(deal => {
      if (!deal.market_ids.length) return null;

      // Get first market's coordinates
      const market = markets.find(m => m.id === deal.market_ids[0]);
      if (!market) return null;

      return {
        deal,
        lat: market.lat,
        lng: market.lng
      };
    })
    .filter((m): m is MapMarker => m !== null);

  const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;

  // Pin colour by deal status (brand semantic palette).
  const statusColor = (deal: DealRecord) =>
    deal.status === 'reviewed' ? '#1B8A5A' : deal.status === 'failed' ? '#C53030' : '#7D5A7D';

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <div className="text-center">
          <p className="font-medium text-foreground">Mapbox token not configured</p>
          <p className="mt-1 text-xs text-muted-foreground">Set MAPBOX_TOKEN in .env (injected via webpack DefinePlugin)</p>
        </div>
      </div>
    );
  }

  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      latitude={latitude}
      longitude={longitude}
      zoom={zoom}
      onMove={e => {
        setLatitude(e.viewState.latitude);
        setLongitude(e.viewState.longitude);
        setZoom(e.viewState.zoom);
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/light-v11"
    >
      {markers.map(marker => {
        const isSelected = selectedDeal?.deal_id === marker.deal.deal_id;
        const color = statusColor(marker.deal);

        return (
          <Marker
            key={marker.deal.deal_id}
            latitude={marker.lat}
            longitude={marker.lng}
            onClick={() => setPopupDeal(marker.deal)}
          >
            <div
              className={`h-6 w-6 cursor-pointer rounded-full border-2 border-white shadow-md transition-transform ${
                isSelected ? 'scale-125' : 'hover:scale-110'
              }`}
              style={{
                backgroundColor: color,
                opacity: isSelected ? 1 : 0.9,
                boxShadow: isSelected ? `0 0 0 3px ${color}55` : undefined,
              }}
              title={marker.deal.extracted_fields?.['Project Name']}
            />
          </Marker>
        );
      })}

      {popupDeal && (
        <Popup
          latitude={
            markers.find(m => m.deal.deal_id === popupDeal.deal_id)?.lat ?? 54
          }
          longitude={
            markers.find(m => m.deal.deal_id === popupDeal.deal_id)?.lng ?? -2
          }
          onClose={() => setPopupDeal(null)}
          closeButton
          closeOnClick={false}
        >
          <div className="p-1">
            <div className="text-sm font-semibold text-foreground">
              {popupDeal.extracted_fields?.['Project Name'] || 'Untitled deal'}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>NIY {popupDeal.extracted_fields?.Yield != null ? Number(popupDeal.extracted_fields.Yield).toFixed(2) + '%' : '—'}</span>
              <span>RY {popupDeal.extracted_fields?.Yield2 != null ? Number(popupDeal.extracted_fields.Yield2).toFixed(2) + '%' : '—'}</span>
              <span className="capitalize">{popupDeal.status}</span>
            </div>
          </div>
        </Popup>
      )}
    </Map>
  );
}
