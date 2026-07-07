/**
 * Top-right layer control panel for the Map page.
 * Toggles: regional zones with yield colouring, market score dots, MLI rents.
 * Also shows a yield-gradient legend when regional zones are active.
 */

export interface LayerVisibility {
  regionalZones: boolean;
  marketDots: boolean;
  microLocations: boolean;
  choropleth: boolean;       // existing LAD choropleth (kept for backwards compat)
}

interface Props {
  layers: LayerVisibility;
  onChange: (next: LayerVisibility) => void;
  regionalZonesAvailable: boolean;
  microLocationsCount: number;
  marketCount: number;
}

export default function LayerControl({
  layers, onChange, regionalZonesAvailable, microLocationsCount, marketCount,
}: Props) {
  function toggle(key: keyof LayerVisibility) {
    onChange({ ...layers, [key]: !layers[key] });
  }

  return (
    <div
      className="absolute top-3 right-3 z-[1000] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
      style={{ minWidth: 260 }}
    >
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Layers</div>
      </div>

      <div className="p-2 space-y-1">
        <LayerRow
          label="Regional zones"
          hint="Coloured by Newmark equivalent yield"
          active={layers.regionalZones}
          disabled={!regionalZonesAvailable}
          onToggle={() => toggle('regionalZones')}
        />
        <LayerRow
          label={`Market score dots`}
          hint={`${marketCount} markets, total-score coloured`}
          active={layers.marketDots}
          onToggle={() => toggle('marketDots')}
        />
        <LayerRow
          label="MLI rent locations"
          hint={`${microLocationsCount} Newmark locations — zoom in to reveal`}
          active={layers.microLocations}
          disabled={microLocationsCount === 0}
          onToggle={() => toggle('microLocations')}
        />
        <LayerRow
          label="Local authority scores"
          hint="Each council area coloured by its market's score"
          active={layers.choropleth}
          onToggle={() => toggle('choropleth')}
        />
      </div>

      {/* Yield gradient legend */}
      {layers.regionalZones && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 bg-gray-50/50">
          <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500 mb-1">
            Equivalent yield (Newmark Q3 2025)
          </div>
          <div className="h-3 rounded"
               style={{
                 background: 'linear-gradient(90deg, #0c4a6e 0%, #0891b2 35%, #14b8a6 70%, #86efac 100%)',
               }} />
          <div className="flex justify-between text-[9px] text-gray-500 mt-0.5 font-mono">
            <span>4.5%</span><span>5.3%</span><span>6.1%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function LayerRow({
  label, hint, active, disabled, onToggle,
}: { label: string; hint?: string; active: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : active
            ? 'bg-purple-50'
            : 'hover:bg-gray-50'
      }`}
    >
      <span
        className="w-8 h-4 rounded-full relative flex-shrink-0 transition-colors"
        style={{ background: active ? '#3B1F6B' : '#d1d5db' }}
      >
        <span
          className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all"
          style={{ left: active ? '18px' : '2px' }}
        />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-800">{label}</div>
        {hint && <div className="text-[10px] text-gray-500 truncate">{hint}</div>}
      </div>
    </button>
  );
}
