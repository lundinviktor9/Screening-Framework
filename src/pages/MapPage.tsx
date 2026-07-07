import { useState, useMemo, useEffect } from 'react';
import { useMarketStore } from '../store/marketStore';
import { toast } from '@/components/ui/sonner';
import MarketMap from '../components/map/MarketMap';
import type { MapOverlay, POIData, POIVisibility, NewmarkRegionData, MicroLocation } from '../components/map/MarketMap';
import MarketProfilePanel from '../components/map/MarketProfilePanel';
import PortfolioPanel from '../components/map/PortfolioPanel';
import LayerControl, { type LayerVisibility } from '../components/map/LayerControl';
import RegionDetailPanel, { type RegionSummary } from '../components/map/RegionDetailPanel';
import { PILLARS, METRICS } from '../data/metrics';
import { MARKET_CENTROIDS } from '../data/marketCentroids';

export default function MapPage() {
  const markets = useMarketStore(s => s.markets);
  const getScoredMarkets = useMarketStore(s => s.getScoredMarkets);
  const _tick = useMarketStore(s => s._lastTick);
  const portfolioAssets = useMarketStore(s => s.portfolioAssets);
  const addPortfolioAsset = useMarketStore(s => s.addPortfolioAsset);
  const deletePortfolioAsset = useMarketStore(s => s.deletePortfolioAsset);

  const ranked = useMemo(() => getScoredMarkets(), [markets, _tick]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [region, setRegion] = useState('All regions');
  const [overlay, setOverlay] = useState<MapOverlay>('total');
  const [drawMode, setDrawMode] = useState(false);
  const [radiusTool, setRadiusTool] = useState<{ lat: number; lng: number; radiusKm: number } | null>(null);

  // New layer state
  const [layers, setLayers] = useState<LayerVisibility>({
    regionalZones: true,       // 3A: default ON
    marketDots: false,         // 3A: default OFF
    microLocations: false,     // 3A: default OFF
    choropleth: false,
  });
  const [poiData, setPoiData] = useState<POIData | null>(null);
  const [motorwayGeoJson, setMotorwayGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [ladBoundaries, setLadBoundaries] = useState<GeoJSON.FeatureCollection | null>(null);
  const [marketToLads, setMarketToLads] = useState<Record<string, string[]>>({});
  const [loadingLads, setLoadingLads] = useState(false);
  const [poiVis, setPoiVis] = useState<POIVisibility>({
    ports: false, airports: false, junctions: false, motorways: false,
  });

  // Newmark regional zone state
  const [regionsGeoJson, setRegionsGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [regionMapping, setRegionMapping] = useState<{
    ons_to_newmark: Record<string, string>;
    ons_name_to_newmark: Record<string, string>;
  } | null>(null);
  const [microLocations, setMicroLocations] = useState<MicroLocation[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Portfolio state
  const [placeAssetMode, setPlaceAssetMode] = useState(false);
  const [pendingAssetCoord, setPendingAssetCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [showPortfolioPanel, setShowPortfolioPanel] = useState(false);

  // Load static support files at mount
  useEffect(() => {
    fetch('/data/poi.json')
      .then(r => r.ok ? r.json() : null)
      .then(j => j && setPoiData({ ports: j.ports, airports: j.airports, motorway_junctions: j.motorway_junctions }))
      .catch(() => {});
    fetch('/data/motorway_network.geojson')
      .then(r => r.ok ? r.json() : null)
      .then(j => j && setMotorwayGeoJson(j))
      .catch(() => {});
    fetch('/data/market_lads.json')
      .then(r => r.ok ? r.json() : null)
      .then(j => j && setMarketToLads(j))
      .catch(() => {});
    fetch('/data/uk_regions.geojson')
      .then(r => r.ok ? r.json() : null)
      .then(j => j && setRegionsGeoJson(j))
      .catch(() => {});
    fetch('/data/newmark_region_mapping.json')
      .then(r => r.ok ? r.json() : null)
      .then(j => j && setRegionMapping({
        ons_to_newmark: j.ons_to_newmark ?? {},
        ons_name_to_newmark: j.ons_name_to_newmark ?? {},
      }))
      .catch(() => {});
    fetch('/data/newmark_locations.json')
      .then(r => r.ok ? r.json() : null)
      .then(j => j?.locations && setMicroLocations(j.locations))
      .catch(() => {});
  }, []);

  // Lazy-load LAD boundaries only when choropleth is first enabled (big file)
  useEffect(() => {
    if (!layers.choropleth || ladBoundaries || loadingLads) return;
    setLoadingLads(true);
    fetch('/data/uk_lads.geojson')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j) setLadBoundaries(j);
        else setLayers(l => ({ ...l, choropleth: false }));
      })
      .catch(() => setLayers(l => ({ ...l, choropleth: false })))
      .finally(() => setLoadingLads(false));
  }, [layers.choropleth, ladBoundaries, loadingLads]);

  const regions = ['All regions', ...Array.from(new Set(ranked.map(m => m.market.region))).sort()];
  const filtered = region === 'All regions' ? ranked : ranked.filter(m => m.market.region === region);
  const selectedMarket = ranked.find(m => m.market.id === selectedId) ?? null;

  const tierCounts = {
    t1: filtered.filter(m => m.totalScore >= 80).length,
    t2: filtered.filter(m => m.totalScore >= 60 && m.totalScore < 80).length,
    t3: filtered.filter(m => m.totalScore < 60).length,
  };

  // Derive Newmark regional data by pulling one market per region and reading
  // its M41/M65/M67/M68/M69/M72 values (they cascade identically within a region).
  const newmarkRegionData = useMemo((): Record<string, NewmarkRegionData> => {
    const out: Record<string, NewmarkRegionData> = {};
    // Our region name → Newmark region name
    const ourToNewmark: Record<string, string> = {
      'London':              'Greater London',
      'South East':          'South East',
      'East of England':     'East of England',
      'South West':          'South West',
      'Wales':               'Wales',
      'East Midlands':       'East Midlands',
      'West Midlands':       'West Midlands',
      'Yorkshire & Humber':  'Yorks and Humber',
      'North West':          'North West',
      'North East':          'North East',
      'Scotland':            'Scotland',
    };
    const seen = new Set<string>();
    for (const sm of ranked) {
      const nm = ourToNewmark[sm.market.region];
      if (!nm || seen.has(nm)) continue;
      seen.add(nm);
      const v = sm.market.values;
      out[nm] = {
        equivalentYield:     v[65] ?? undefined,
        allGradesErv:        v[41] ?? undefined,
        vacancy:             v[69] ?? undefined,
        reversion:           v[67] ?? undefined,
        rentalGrowthForecast: v[68] ?? undefined,
      };
    }
    // Add prime rent range per region from named locations
    for (const loc of microLocations) {
      const nm = loc.region;
      const cur = out[nm] ?? (out[nm] = {});
      if (cur.primeRentRange) {
        cur.primeRentRange = [Math.min(cur.primeRentRange[0], loc.rent_psf), Math.max(cur.primeRentRange[1], loc.rent_psf)];
      } else {
        cur.primeRentRange = [loc.rent_psf, loc.rent_psf];
      }
    }
    // Also populate Inner London from its micro-locations (Park Royal etc.) + use Greater London yields
    if (out['Greater London']) {
      const inner = microLocations.filter(l => l.region === 'Inner London');
      if (inner.length > 0) {
        out['Inner London'] = {
          ...out['Greater London'],
          primeRentRange: [Math.min(...inner.map(l => l.rent_psf)), Math.max(...inner.map(l => l.rent_psf))],
        };
      }
    }
    return out;
  }, [ranked, microLocations]);

  // UK average forecast = mean of regional forecasts (for chart 4 reference line)
  const ukAvgGrowth = useMemo(() => {
    const values = Object.values(newmarkRegionData)
      .map(d => d.rentalGrowthForecast)
      .filter((x): x is number => typeof x === 'number');
    return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 3.0;
  }, [newmarkRegionData]);

  // Build the region summary passed to the panel when a zone is clicked
  const regionSummary: RegionSummary | null = useMemo(() => {
    if (!selectedRegion) return null;
    const data = newmarkRegionData[selectedRegion];
    if (!data) return null;
    // Pipeline stats: per-region data not extracted in detail, use UK defaults
    const pipelineUkShare: Record<string, number> = {
      'North West': 3.9, 'South East': 1.3, 'Yorks and Humber': 1.1,
      'West Midlands': 1.1, 'East of England': 0.9, 'Greater London': 0.9,
      'Inner London': 0.9, 'South West': 0.7, 'North East': 0.5,
      'East Midlands': 0.4, 'Wales': 0.2, 'Scotland': 0.1,
    };
    const pipelineMsqft = pipelineUkShare[selectedRegion];
    return {
      name: selectedRegion,
      equivalentYield: data.equivalentYield,
      vacancyRate: data.vacancy,
      allGradesErv: data.allGradesErv,
      reversionPct: data.reversion,
      rentalGrowthForecast: data.rentalGrowthForecast,
      ukAvgGrowth,
      primeRentRange: data.primeRentRange,
      pipelineTotalSqft: pipelineMsqft !== undefined ? pipelineMsqft * 1_000_000 : undefined,
      pipelineAppliedPct: 21,
      pipelineConsentedPct: 50,
      pipelineUnderConstructionPct: 29,
      monthsOfSupply: 3.1,
      // Unit size distribution (Inner/Greater London stored; others omitted)
      unitSizeA: selectedRegion === 'Greater London' ? { micro: 9,  smallBox: 50, midBox: 41 } :
                 selectedRegion === 'Inner London'   ? { micro: 11, smallBox: 54, midBox: 34 } :
                 undefined,
      unitSizeALabel: selectedRegion,
    };
  }, [selectedRegion, newmarkRegionData, ukAvgGrowth]);

  // Markets inside radius tool
  const marketsInRadius = useMemo(() => {
    if (!radiusTool) return [];
    return ranked
      .map(sm => {
        const c = MARKET_CENTROIDS[sm.market.id];
        if (!c) return null;
        const d = haversineKm(c[0], c[1], radiusTool.lat, radiusTool.lng);
        return d <= radiusTool.radiusKm ? { sm, dist: d } : null;
      })
      .filter((x): x is { sm: typeof ranked[0]; dist: number } => x !== null)
      .sort((a, b) => a.dist - b.dist);
  }, [ranked, radiusTool]);

  const overlayOptions: { key: MapOverlay; label: string; colour: string }[] = [
    { key: 'total', label: 'Total', colour: '#3B1F6B' },
    ...PILLARS.map(p => ({ key: p.name as MapOverlay, label: p.name.split(' ')[0], colour: p.colour })),
  ];

  // Handle portfolio asset placement
  function handlePlaceAsset(lat: number, lng: number) {
    setPendingAssetCoord({ lat, lng });
    setPlaceAssetMode(false);
  }

  function confirmAssetPlacement(name: string, assetType: string, sizeSqft?: number) {
    if (!pendingAssetCoord) return;
    // Auto-link to nearest market
    let nearestId: string | undefined;
    let nearestDist = Infinity;
    for (const sm of ranked) {
      const c = MARKET_CENTROIDS[sm.market.id];
      if (!c) continue;
      const d = haversineKm(c[0], c[1], pendingAssetCoord.lat, pendingAssetCoord.lng);
      if (d < nearestDist) { nearestDist = d; nearestId = sm.market.id; }
    }
    addPortfolioAsset({
      name,
      lat: pendingAssetCoord.lat,
      lng: pendingAssetCoord.lng,
      marketId: nearestId,
      assetType: assetType || undefined,
      sizeSqft,
    });
    setPendingAssetCoord(null);
  }

  const sidePanelVisible = selectedMarket || (radiusTool && marketsInRadius.length > 0) || showPortfolioPanel;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-4 border-b bg-card px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold leading-tight text-foreground">Map</h1>
          <p className="text-xs text-muted-foreground">{ranked.length} markets · click markers or choropleth areas</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Tier 1', count: tierCounts.t1, tone: 'text-success' },
            { label: 'Tier 2', count: tierCounts.t2, tone: 'text-warning' },
            { label: 'Tier 3', count: tierCounts.t3, tone: 'text-danger' },
          ].map(t => (
            <div key={t.label} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-xs">
              <span className={`text-sm font-bold ${t.tone}`}>{t.count}</span>
              <span className="font-medium text-foreground">{t.label}</span>
            </div>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="whitespace-nowrap text-xs font-medium text-muted-foreground">Region:</label>
          <select
            value={region}
            onChange={e => { setRegion(e.target.value); setSelectedId(null); }}
            className="rounded-lg border bg-background px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
            style={{ minWidth: 160 }}
          >
            {regions.map(r => (
              <option key={r} value={r}>
                {r === 'All regions' ? `All regions (${ranked.length})` : `${r} (${ranked.filter(m => m.market.region === r).length})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Layer controls bar */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b bg-muted/30 px-6 py-2">
        {/* Overlay toggle */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Colour by:</span>
          <div className="flex gap-1">
            {overlayOptions.map(o => (
              <button
                key={o.key}
                onClick={() => setOverlay(o.key)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  overlay === o.key ? 'text-white' : 'border bg-card text-foreground hover:border-primary/40'
                }`}
                style={overlay === o.key ? { background: o.colour } : {}}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-5 w-px bg-border" />
        {loadingLads && <span className="text-[10px] text-muted-foreground">loading boundaries…</span>}

        {/* POI toggles */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">POI:</span>
          <POIToggle label="⚓ Ports" active={poiVis.ports} onClick={() => setPoiVis(v => ({ ...v, ports: !v.ports }))} disabled={!poiData} />
          <POIToggle label="✈ Airports" active={poiVis.airports} onClick={() => setPoiVis(v => ({ ...v, airports: !v.airports }))} disabled={!poiData} />
          <POIToggle label="⬢ Junctions" active={poiVis.junctions} onClick={() => setPoiVis(v => ({ ...v, junctions: !v.junctions }))} disabled={!poiData} />
          <POIToggle label="━ Motorways" active={poiVis.motorways} onClick={() => setPoiVis(v => ({ ...v, motorways: !v.motorways }))} disabled={!motorwayGeoJson} title={motorwayGeoJson ? '' : 'Run scrapers/poi_scraper.py to enable'} />
        </div>

        <div className="h-5 w-px bg-border" />

        {/* Radius tool */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Radius:</span>
          <button
            onClick={() => { setDrawMode(m => !m); setPlaceAssetMode(false); }}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              drawMode ? 'border-transparent bg-primary text-primary-foreground' : 'bg-card text-foreground hover:border-primary/40'
            }`}
          >
            {drawMode ? 'Click map…' : radiusTool ? 'Move' : 'Draw'}
          </button>
          {radiusTool && (
            <>
              <input
                type="range" min={10} max={150} step={5}
                value={radiusTool.radiusKm}
                onChange={e => setRadiusTool({ ...radiusTool, radiusKm: Number(e.target.value) })}
                className="h-1.5 w-24 accent-[hsl(var(--primary))]"
              />
              <span className="w-12 text-[11px] font-semibold tabular-nums text-foreground">{radiusTool.radiusKm} km</span>
              <button
                onClick={() => { setRadiusTool(null); setDrawMode(false); }}
                className="rounded-lg border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-danger/40 hover:text-danger"
              >
                Clear
              </button>
            </>
          )}
        </div>

        <div className="h-5 w-px bg-border" />

        {/* Portfolio */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Portfolio:</span>
          <button
            onClick={() => { setPlaceAssetMode(m => !m); setDrawMode(false); }}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              placeAssetMode ? 'border-transparent bg-primary text-primary-foreground' : 'bg-card text-foreground hover:border-primary/40'
            }`}
            title="Click the map to place an asset"
          >
            {placeAssetMode ? 'Click map to place…' : '+ Add asset'}
          </button>
          <button
            onClick={() => { setShowPortfolioPanel(p => !p); setSelectedId(null); }}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              showPortfolioPanel ? 'border-primary/30 bg-accent text-accent-foreground' : 'bg-card text-foreground hover:border-primary/40'
            }`}
          >
            {portfolioAssets.length} asset{portfolioAssets.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>

      {/* Map + panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          {ranked.length > 0 && (
            <MarketMap
              markets={filtered}
              selectedId={selectedId}
              onSelect={id => setSelectedId(prev => prev === id ? null : id)}
              overlay={overlay}
              radiusTool={radiusTool}
              onRadiusToolChange={c => { setRadiusTool(c); setDrawMode(false); }}
              drawMode={drawMode}
              choropleth={layers.choropleth}
              ladBoundaries={ladBoundaries}
              marketToLads={marketToLads}
              poiData={poiData}
              motorwayGeoJson={motorwayGeoJson}
              poiVisibility={poiVis}
              portfolioAssets={portfolioAssets}
              onDeletePortfolioAsset={deletePortfolioAsset}
              placeAssetMode={placeAssetMode}
              onPlaceAsset={handlePlaceAsset}
              regionalZonesVisible={layers.regionalZones}
              regionsGeoJson={regionsGeoJson}
              regionCodeToNewmark={regionMapping?.ons_to_newmark ?? {}}
              regionNameToNewmark={regionMapping?.ons_name_to_newmark ?? {}}
              newmarkRegionData={newmarkRegionData}
              onRegionClick={(nm) => { setSelectedRegion(nm); setSelectedId(null); }}
              microLocationsVisible={layers.microLocations}
              microLocations={microLocations}
              marketDotsVisible={layers.marketDots}
            />
          )}

          {/* Layer control (top-right) */}
          {ranked.length > 0 && (
            <LayerControl
              layers={layers}
              onChange={setLayers}
              regionalZonesAvailable={!!regionsGeoJson}
              microLocationsCount={microLocations.length}
              marketCount={ranked.length}
            />
          )}

          {/* Region detail panel (opens on regional zone click) */}
          {regionSummary && (
            <RegionDetailPanel
              summary={regionSummary}
              onClose={() => setSelectedRegion(null)}
            />
          )}

          {/* LAD choropleth legend (only when LAD layer active) */}
          {layers.choropleth && ladBoundaries && (
            <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-md border border-gray-200 px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Total score</div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-40 rounded"
                     style={{ background: 'linear-gradient(90deg, #b91c1c 0%, #f59e0b 50%, #15803d 100%)' }} />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 mt-0.5 font-mono">
                <span>0</span><span>50</span><span>100</span>
              </div>
            </div>
          )}

          {/* Pending asset placement dialog */}
          {pendingAssetCoord && (
            <PendingAssetDialog
              coord={pendingAssetCoord}
              onConfirm={confirmAssetPlacement}
              onCancel={() => setPendingAssetCoord(null)}
            />
          )}
        </div>

        {/* Right side: radius list / portfolio panel / profile panel */}
        {sidePanelVisible && (
          <div className="flex-shrink-0 border-l border-gray-200 bg-white overflow-hidden" style={{ width: 360 }}>
            {showPortfolioPanel && !selectedMarket ? (
              <PortfolioPanel
                assets={portfolioAssets}
                markets={ranked}
                onDelete={deletePortfolioAsset}
                onClose={() => setShowPortfolioPanel(false)}
              />
            ) : radiusTool && marketsInRadius.length > 0 && !selectedMarket ? (
              <RadiusResultsPanel
                radiusKm={radiusTool.radiusKm}
                results={marketsInRadius}
                onSelect={id => setSelectedId(id)}
              />
            ) : selectedMarket ? (
              <MarketProfilePanel
                market={selectedMarket}
                totalCount={ranked.length}
                onClose={() => setSelectedId(null)}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function POIToggle({
  label, active, onClick, disabled, title,
}: { label: string; active: boolean; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors border ${
        disabled
          ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
          : active
            ? 'bg-purple-100 text-purple-700 border-purple-200'
            : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
      }`}
    >
      {label}
    </button>
  );
}

function RadiusResultsPanel({
  radiusKm, results, onSelect,
}: { radiusKm: number; results: { sm: any; dist: number }[]; onSelect: (id: string) => void }) {
  return (
    <>
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="text-sm font-semibold text-gray-800">Inside {radiusKm} km radius</div>
        <div className="text-xs text-gray-400">{results.length} markets · sorted by distance</div>
      </div>
      <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
        {results.map(({ sm, dist }) => {
          const tierColor = sm.totalScore >= 80 ? '#15803d' : sm.totalScore >= 60 ? '#b45309' : '#b91c1c';
          return (
            <button
              key={sm.market.id}
              onClick={() => onSelect(sm.market.id)}
              className="w-full px-4 py-2.5 border-b border-gray-50 hover:bg-purple-50 text-left flex items-center gap-3"
            >
              <span className="font-mono text-[10px] text-gray-400 w-6">#{sm.rank}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-xs truncate">{sm.market.name}</div>
                <div className="text-[10px] text-gray-400">{dist.toFixed(1)} km · {sm.market.region}</div>
              </div>
              <span className="font-bold text-sm tabular-nums" style={{ color: tierColor }}>
                {sm.totalScore.toFixed(0)}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function PendingAssetDialog({
  coord, onConfirm, onCancel,
}: { coord: { lat: number; lng: number }; onConfirm: (name: string, type: string, size?: number) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState('');
  const [size, setSize] = useState('');

  return (
    <div
      className="absolute inset-0 z-[1001] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-2xl p-6 w-[360px]"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-bold text-gray-900 mb-1">New portfolio asset</h3>
        <p className="text-xs text-gray-500 mb-4 font-mono">
          {coord.lat.toFixed(4)}, {coord.lng.toFixed(4)}
        </p>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Asset name *</label>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Widnes DC2"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-purple-400"
        />

        <label className="block text-xs font-semibold text-gray-600 mb-1">Asset type</label>
        <select
          value={assetType}
          onChange={e => setAssetType(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-purple-400"
        >
          <option value="">— select —</option>
          <option>Single-let warehouse</option>
          <option>Multi-let industrial estate</option>
          <option>Logistics park</option>
          <option>Urban logistics / last-mile</option>
          <option>Development site</option>
          <option>Other</option>
        </select>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Size (sqft, optional)</label>
        <input
          type="number"
          value={size}
          onChange={e => setSize(e.target.value)}
          placeholder="e.g. 250000"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-purple-400"
        />

        <div className="flex gap-2">
          <button
            onClick={() => {
              if (!name.trim()) { toast.error('Asset name is required'); return; }
              onConfirm(name.trim(), assetType, size ? Number(size) : undefined);
            }}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#3B1F6B' }}
          >
            Place asset
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
