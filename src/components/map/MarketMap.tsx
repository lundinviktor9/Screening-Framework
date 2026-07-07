import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { confirmDialog } from '@/components/ui/confirm';
import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Circle, GeoJSON, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import type { ScoredMarket, Pillar } from '../../types';
import type { PortfolioAsset } from '../../store/marketStore';
import { MARKET_CENTROIDS } from '../../data/marketCentroids';
import { PILLARS } from '../../data/metrics';

export type MapOverlay = 'total' | Pillar;

export interface POI {
  name: string;
  coord: [number, number];
  detail: string;
}
export interface POIData {
  ports: POI[];
  airports: POI[];
  motorway_junctions: POI[];
}

export interface POIVisibility {
  ports: boolean;
  airports: boolean;
  junctions: boolean;
  motorways: boolean;
}

export interface MicroLocation {
  name: string;
  rent_psf: number;
  region: string;          // Newmark region
  our_region: string;      // normalised to our markets.json region
  market_id: string | null;
  coord: [number, number];
  page: number;
}

/** Newmark regional data, keyed by Newmark region name. Optional per-field. */
export interface NewmarkRegionData {
  equivalentYield?: number;   // %
  allGradesErv?: number;      // £psf
  vacancy?: number;           // %
  reversion?: number;         // %
  rentalGrowthForecast?: number; // % pa
  primeRentRange?: [number, number];
}

interface Props {
  markets: ScoredMarket[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  overlay: MapOverlay;
  radiusTool?: { lat: number; lng: number; radiusKm: number } | null;
  onRadiusToolChange?: (circle: { lat: number; lng: number; radiusKm: number } | null) => void;
  drawMode?: boolean;
  // LAD choropleth
  choropleth?: boolean;
  ladBoundaries?: GeoJSON.FeatureCollection | null;
  marketToLads?: Record<string, string[]>; // marketId → [lad_codes]
  // POI + portfolio
  poiData?: POIData | null;
  motorwayGeoJson?: GeoJSON.FeatureCollection | null;
  poiVisibility?: POIVisibility;
  portfolioAssets?: PortfolioAsset[];
  onDeletePortfolioAsset?: (id: string) => void;
  placeAssetMode?: boolean;
  onPlaceAsset?: (lat: number, lng: number) => void;
  // Newmark regional zones
  regionalZonesVisible?: boolean;
  regionsGeoJson?: GeoJSON.FeatureCollection | null;
  regionsPropCode?: string;            // field name on features for region code (e.g. "region_code")
  regionsPropName?: string;            // field name for region display name
  regionCodeToNewmark?: Record<string, string>; // mapping ONS code → Newmark region name
  regionNameToNewmark?: Record<string, string>; // mapping ONS name → Newmark region name
  newmarkRegionData?: Record<string, NewmarkRegionData>; // keyed by Newmark region name
  onRegionClick?: (newmarkRegion: string) => void;
  // Micro-locations
  microLocationsVisible?: boolean;
  microLocations?: MicroLocation[];
  // Market dots toggle (3A — was always-on, now layer-controlled)
  marketDotsVisible?: boolean;
}

// ── Colour scales ─────────────────────────────────────────────────────────────

function totalTierStroke(score: number): string {
  if (score >= 80) return '#15803d';
  if (score >= 60) return '#b45309';
  return '#b91c1c';
}
function totalTierFill(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

/** Continuous red→amber→green gradient for choropleth (total score 0–100) */
function scoreToGradient(score: number): string {
  const t = Math.max(0, Math.min(1, score / 100));
  if (t < 0.5) {
    // red (#b91c1c) → amber (#f59e0b)
    const r = 185 + (245 - 185) * (t * 2);
    const g = 28 + (158 - 28) * (t * 2);
    const b = 28 + (11 - 28) * (t * 2);
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  } else {
    // amber (#f59e0b) → green (#15803d)
    const u = (t - 0.5) * 2;
    const r = 245 + (21 - 245) * u;
    const g = 158 + (128 - 158) * u;
    const b = 11 + (61 - 11) * u;
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }
}

function pillarGradientStroke(score: number, count: number): string {
  if (count === 0) return '#9ca3af';
  const t = Math.min(1, Math.max(0, score / 5));
  if (t >= 0.7) return '#15803d';
  if (t >= 0.5) return '#b45309';
  return '#b91c1c';
}
function pillarGradientFill(score: number, count: number): string {
  if (count === 0) return '#d1d5db';
  const t = Math.min(1, Math.max(0, score / 5));
  if (t >= 0.7) return '#22c55e';
  if (t >= 0.5) return '#f59e0b';
  return '#ef4444';
}

/**
 * Map equivalent yield (%) to the dark-navy → teal → light-green gradient
 * used for Newmark regional zones. Yields typically range 4.5% to 6.5%.
 */
function yieldToColour(yieldPct: number | undefined): string {
  if (yieldPct === undefined || yieldPct === null || !Number.isFinite(yieldPct)) {
    return '#e5e7eb'; // grey for no-data regions
  }
  // Map 4.5 (dark navy) → 5.3 (teal) → 6.1+ (light green)
  const t = Math.max(0, Math.min(1, (yieldPct - 4.5) / 1.6));
  if (t < 0.35) {
    // dark navy → teal
    const u = t / 0.35;
    const r = 12 + (8 - 12) * u;
    const g = 74 + (145 - 74) * u;
    const b = 110 + (178 - 110) * u;
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  } else if (t < 0.7) {
    // teal → light green
    const u = (t - 0.35) / 0.35;
    const r = 8 + (20 - 8) * u;
    const g = 145 + (184 - 145) * u;
    const b = 178 + (166 - 178) * u;
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  } else {
    // light green saturation
    const u = (t - 0.7) / 0.3;
    const r = 20 + (134 - 20) * u;
    const g = 184 + (239 - 184) * u;
    const b = 166 + (172 - 166) * u;
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }
}

function getMarkerColours(sm: ScoredMarket, overlay: MapOverlay): {
  stroke: string; fill: string; opacity: number;
} {
  if (overlay === 'total') {
    return {
      stroke: totalTierStroke(sm.totalScore),
      fill: totalTierFill(sm.totalScore),
      opacity: 0.75,
    };
  }
  const ps = sm.pillarScores[overlay];
  const score = ps?.score ?? 0;
  const count = ps?.scoredCount ?? 0;
  return {
    stroke: pillarGradientStroke(score, count),
    fill: pillarGradientFill(score, count),
    opacity: count === 0 ? 0.35 : 0.75,
  };
}

// ── Click-to-place helper components ──────────────────────────────────────────

function ClickToPlace({
  active, onPlace,
}: { active: boolean; onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      if (!active) return;
      onPlace(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function CursorManager({ cursor }: { cursor: string }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = cursor;
  }, [map, cursor]);
  return null;
}

/**
 * Zoom-gated micro-location layer. Shows named Newmark rent pills only when
 * zoomed in enough that they won't overlap. At low zoom (<= 7) the layer
 * is hidden entirely; regional zone centroid labels carry the summary.
 */
function MicroLocationLayer({ locations }: { locations: MicroLocation[] }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const handler = () => setZoom(map.getZoom());
    map.on('zoomend', handler);
    return () => { map.off('zoomend', handler); };
  }, [map]);

  // Hide entirely at overview zoom (<=7). User zooms in to reveal.
  if (zoom < 8) return null;

  return (
    <>
      {locations.map((loc) => {
        const pillIcon = L.divIcon({
          className: 'mloc-pill-wrap',
          html: `
            <div class="mloc-pill">
              <span class="mloc-pill-dot"></span>
              <span class="mloc-pill-value">£${loc.rent_psf.toFixed(2)}</span>
            </div>
          `,
          iconSize: [1, 1],
          iconAnchor: [0, 0],
        });
        return (
          <Marker
            key={`mloc-${loc.name}`}
            position={loc.coord}
            icon={pillIcon}
            title={`${loc.name} — £${loc.rent_psf.toFixed(2)} psf (Newmark Q3 2025)`}
          />
        );
      })}
    </>
  );
}

// ── Custom POI icons ──────────────────────────────────────────────────────────

function makeIcon(emoji: string, bg: string): L.DivIcon {
  return L.divIcon({
    className: 'poi-marker',
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 1px 3px rgba(0,0,0,0.3);border:1.5px solid white;">${emoji}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function makePortfolioIcon(): L.DivIcon {
  return L.divIcon({
    className: 'portfolio-marker',
    html: `<div style="width:18px;height:18px;background:#3B1F6B;transform:rotate(45deg);box-shadow:0 2px 4px rgba(59,31,107,0.5);border:2px solid white;"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const ICON_PORT = makeIcon('⚓', '#0891b2');
const ICON_AIRPORT = makeIcon('✈', '#1d4ed8');
const ICON_JUNCTION = makeIcon('⬢', '#ea580c');
const ICON_PORTFOLIO = makePortfolioIcon();

// ── Main component ────────────────────────────────────────────────────────────

export default function MarketMap({
  markets, selectedId, onSelect, overlay,
  radiusTool, onRadiusToolChange, drawMode,
  choropleth = false,
  poiData = null,
  motorwayGeoJson = null,
  poiVisibility = { ports: false, airports: false, junctions: false, motorways: false },
  portfolioAssets = [],
  onDeletePortfolioAsset,
  placeAssetMode = false,
  onPlaceAsset,
  ladBoundaries = null,
  marketToLads = {},
  regionalZonesVisible = false,
  regionsGeoJson = null,
  regionsPropCode = 'region_code',
  regionsPropName = 'region_name',
  regionCodeToNewmark = {},
  regionNameToNewmark = {},
  newmarkRegionData = {},
  onRegionClick,
  microLocationsVisible = false,
  microLocations = [],
  marketDotsVisible = true,
}: Props) {
  const [_placed, setPlacedMode] = useState(drawMode ?? false);
  if (drawMode !== undefined && drawMode !== _placed) setPlacedMode(drawMode);

  // Map cursor follows mode
  const cursor = placeAssetMode ? 'copy' : drawMode ? 'crosshair' : '';

  // Build lookup: LAD code → market score (for choropleth)
  const ladToScore = useMemo(() => {
    const m: Record<string, { score: number; marketId: string; marketName: string }> = {};
    for (const sm of markets) {
      const codes = marketToLads[sm.market.id] ?? [];
      for (const c of codes) {
        m[c] = { score: sm.totalScore, marketId: sm.market.id, marketName: sm.market.name };
      }
    }
    return m;
  }, [markets, marketToLads]);

  return (
    <MapContainer
      center={[54.5, -3.0]}
      zoom={6}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <CursorManager cursor={cursor} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a> · ONS LAD · OSRM'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />

      {/* ── Newmark regional zones (coloured by equivalent yield) ───── */}
      {regionalZonesVisible && regionsGeoJson && (
        <GeoJSON
          key={`newmark-zones-${Object.keys(newmarkRegionData).length}`}
          data={regionsGeoJson}
          style={(feature) => {
            const props = feature?.properties ?? {};
            const code = props[regionsPropCode];
            const name = props[regionsPropName];
            const newmarkRegion = (code && regionCodeToNewmark[code])
              || (name && regionNameToNewmark[name])
              || name;
            const data = newmarkRegion ? newmarkRegionData[newmarkRegion] : undefined;
            return {
              color: 'white',
              weight: 1.5,
              fillColor: yieldToColour(data?.equivalentYield),
              fillOpacity: data?.equivalentYield !== undefined ? 0.55 : 0.15,
            };
          }}
          onEachFeature={(feature, layer) => {
            const props = feature.properties ?? {};
            const code = props[regionsPropCode];
            const name = props[regionsPropName];
            const newmarkRegion = (code && regionCodeToNewmark[code])
              || (name && regionNameToNewmark[name])
              || name;
            const data = newmarkRegion ? newmarkRegionData[newmarkRegion] : undefined;
            if (data) {
              // Permanent centred label: "£8.45 / £13.50" style
              const ervStr   = data.allGradesErv   !== undefined ? `£${data.allGradesErv.toFixed(2)}` : '—';
              const primeMax = data.primeRentRange ? Math.max(...data.primeRentRange) : undefined;
              const primeStr = primeMax !== undefined ? `£${primeMax.toFixed(2)}` : '—';
              const labelHtml = `
                <div style="text-align:center;line-height:1.15;">
                  <div style="font-weight:700;font-size:10px;color:#1e3a8a;letter-spacing:0.3px;text-transform:uppercase;">${newmarkRegion}</div>
                  <div style="font-weight:700;font-size:13px;color:#111;font-variant-numeric:tabular-nums;">
                    ${ervStr}<span style="color:#888;"> / </span><span style="color:#1d4ed8;">${primeStr}</span>
                  </div>
                </div>
              `;
              layer.bindTooltip(labelHtml, {
                permanent: true,
                direction: 'center',
                className: 'region-label-tooltip',
                opacity: 0.95,
              });
              if (onRegionClick && newmarkRegion) {
                layer.on('click', () => onRegionClick(newmarkRegion));
              }
            } else {
              layer.bindTooltip(`<em style="font-size:10px;color:#999">${name ?? ''} (no Newmark data)</em>`, {
                permanent: false,
                direction: 'center',
              });
            }
          }}
        />
      )}

      {/* ── Choropleth (LAD polygons coloured by market score) ───────── */}
      {choropleth && ladBoundaries && (
        <GeoJSON
          key={`choropleth-${markets.length}-${Object.keys(marketToLads).length}`}
          data={ladBoundaries}
          style={(feature) => {
            const code = feature?.properties?.lad_code;
            const info = code ? ladToScore[code] : undefined;
            if (!info) {
              return { color: '#d1d5db', weight: 0.3, fillColor: '#f3f4f6', fillOpacity: 0.15 };
            }
            return {
              color: 'white',
              weight: 0.5,
              fillColor: scoreToGradient(info.score),
              fillOpacity: 0.65,
            };
          }}
          onEachFeature={(feature, layer) => {
            const code = feature.properties?.lad_code;
            const name = feature.properties?.lad_name;
            const info = code ? ladToScore[code] : undefined;
            if (info) {
              layer.bindTooltip(
                `<strong>${info.marketName}</strong><br/><span style="font-size:10px;color:#666">${name} (${code})</span><br/>Score: <strong>${info.score.toFixed(1)}</strong>`,
                { sticky: true },
              );
              layer.on('click', () => onSelect(info.marketId));
            } else if (name) {
              layer.bindTooltip(`${name} (${code})<br/><em style="font-size:10px;color:#999">No market mapped</em>`);
            }
          }}
        />
      )}

      {/* ── Motorway network (scraped GeoJSON) ───────────────────────── */}
      {poiVisibility.motorways && motorwayGeoJson && (
        <GeoJSON
          key="motorways"
          data={motorwayGeoJson}
          style={{ color: '#1d4ed8', weight: 2, opacity: 0.7 }}
          onEachFeature={(feature, layer) => {
            const ref = feature.properties?.ref ?? 'Motorway';
            layer.bindTooltip(ref, { sticky: true });
          }}
        />
      )}

      {/* ── Radius tool circle ───────────────────────────────────────── */}
      {radiusTool && (
        <Circle
          center={[radiusTool.lat, radiusTool.lng]}
          radius={radiusTool.radiusKm * 1000}
          pathOptions={{
            color: '#3B1F6B', fillColor: '#a78bfa', fillOpacity: 0.12, weight: 2, dashArray: '4 4',
          }}
        />
      )}

      {/* ── Click handlers (radius tool + portfolio placement) ───────── */}
      <ClickToPlace
        active={!!drawMode}
        onPlace={(lat, lng) => {
          onRadiusToolChange?.({ lat, lng, radiusKm: radiusTool?.radiusKm ?? 50 });
        }}
      />
      <ClickToPlace
        active={!!placeAssetMode}
        onPlace={(lat, lng) => onPlaceAsset?.(lat, lng)}
      />

      {/* ── Market score dots ─────────────────────────────────────── */}
      {marketDotsVisible && markets.map((sm) => {
        const coords = MARKET_CENTROIDS[sm.market.id];
        if (!coords) return null;

        const isSelected = sm.market.id === selectedId;
        const { stroke, fill, opacity } = getMarkerColours(sm, overlay);

        let inRadius = false;
        if (radiusTool) {
          const d = haversineKm(coords[0], coords[1], radiusTool.lat, radiusTool.lng);
          inRadius = d <= radiusTool.radiusKm;
        }
        const emphasise = isSelected || inRadius;

        return (
          <CircleMarker
            key={sm.market.id}
            center={coords}
            radius={isSelected ? 12 : inRadius ? 10 : choropleth ? 6 : 8}
            pathOptions={{
              color: isSelected ? '#3B1F6B' : stroke,
              fillColor: fill,
              fillOpacity: emphasise ? 0.95 : opacity,
              weight: isSelected ? 3 : inRadius ? 2.5 : 1.5,
            }}
            eventHandlers={{ click: () => onSelect(sm.market.id) }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
              <span className="font-semibold">{sm.market.name}</span>
              <br />
              {overlay === 'total' ? (
                <>Total: <strong>{sm.totalScore}</strong></>
              ) : (
                <>
                  {overlay}: <strong>
                    {(sm.pillarScores[overlay]?.scoredCount ?? 0) > 0
                      ? (sm.pillarScores[overlay]?.score ?? 0).toFixed(2)
                      : 'no data'}
                  </strong>
                </>
              )}
              &nbsp;·&nbsp; Rank #{sm.rank}
              <br />
              {sm.market.region}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {/* ── Micro-location rent pills (Newmark named locations) ────── */}
      {microLocationsVisible && (
        <MicroLocationLayer locations={microLocations} />
      )}

      {/* ── POI layers ────────────────────────────────────────────── */}
      {poiData && poiVisibility.ports && poiData.ports.map(p => (
        <Marker key={`port-${p.name}`} position={p.coord} icon={ICON_PORT}>
          <Tooltip direction="top">
            <strong>⚓ {p.name}</strong><br />
            <span style={{ fontSize: 10, color: '#666' }}>{p.detail}</span>
          </Tooltip>
        </Marker>
      ))}
      {poiData && poiVisibility.airports && poiData.airports.map(p => (
        <Marker key={`airport-${p.name}`} position={p.coord} icon={ICON_AIRPORT}>
          <Tooltip direction="top">
            <strong>✈ {p.name}</strong><br />
            <span style={{ fontSize: 10, color: '#666' }}>{p.detail}</span>
          </Tooltip>
        </Marker>
      ))}
      {poiData && poiVisibility.junctions && poiData.motorway_junctions.map(p => (
        <Marker key={`junction-${p.name}`} position={p.coord} icon={ICON_JUNCTION}>
          <Tooltip direction="top">
            <strong>⬢ {p.name}</strong><br />
            <span style={{ fontSize: 10, color: '#666' }}>{p.detail}</span>
          </Tooltip>
        </Marker>
      ))}

      {/* ── Portfolio assets ──────────────────────────────────────── */}
      {portfolioAssets.map(asset => {
        const near = asset.marketId
          ? markets.find(m => m.market.id === asset.marketId)
          : null;
        return (
          <Marker key={asset.id} position={[asset.lat, asset.lng]} icon={ICON_PORTFOLIO}>
            <Tooltip direction="top" offset={[0, -8]}>
              <strong style={{ color: '#3B1F6B' }}>◆ {asset.name}</strong>
              {asset.assetType && <><br /><span style={{ fontSize: 10 }}>{asset.assetType}</span></>}
              {asset.sizeSqft && <><br /><span style={{ fontSize: 10 }}>{asset.sizeSqft.toLocaleString('en-GB')} sqft</span></>}
              {near && (
                <>
                  <br />
                  <span style={{ fontSize: 10, color: '#666' }}>
                    Nearest market: {near.market.name} (score {near.totalScore.toFixed(1)})
                  </span>
                </>
              )}
              {onDeletePortfolioAsset && (
                <>
                  <br />
                  <button
                    onClick={async (e) => { e.stopPropagation(); if (await confirmDialog({ title: `Remove ${asset.name}?`, confirmText: 'Remove', destructive: true })) onDeletePortfolioAsset(asset.id); }}
                    style={{ fontSize: 10, color: '#dc2626', marginTop: 4, cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
                  >
                    Remove asset
                  </button>
                </>
              )}
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

// ── Local Haversine (km) ──────────────────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export { PILLARS };
