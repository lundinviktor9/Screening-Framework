import type { ScoredMarket } from '../../types';
import type { PortfolioAsset } from '../../store/marketStore';
import { confirmDialog } from '@/components/ui/confirm';

interface Props {
  assets: PortfolioAsset[];
  markets: ScoredMarket[];
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function PortfolioPanel({ assets, markets, onDelete, onClose }: Props) {
  // Group assets by linked market; compute coverage stats
  const totalSqft = assets.reduce((s, a) => s + (a.sizeSqft ?? 0), 0);
  const marketsCovered = new Set(assets.map(a => a.marketId).filter(Boolean)).size;
  const avgScore = assets.length > 0
    ? assets
        .map(a => markets.find(m => m.market.id === a.marketId)?.totalScore ?? 0)
        .filter(s => s > 0)
        .reduce((acc, s, _, arr) => acc + s / arr.length, 0)
    : 0;

  const sorted = [...assets].sort((a, b) => {
    const aScore = markets.find(m => m.market.id === a.marketId)?.totalScore ?? 0;
    const bScore = markets.find(m => m.market.id === b.marketId)?.totalScore ?? 0;
    return bScore - aScore;
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-gray-100">
        <div>
          <h2 className="text-base font-bold text-gray-900 leading-snug">Portfolio</h2>
          <span className="text-xs text-gray-500">
            {assets.length} asset{assets.length === 1 ? '' : 's'} · {marketsCovered} market{marketsCovered === 1 ? '' : 's'} covered
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none mt-0.5 ml-3 flex-shrink-0"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Aggregate stats */}
      {assets.length > 0 && (
        <div className="px-5 py-3 grid grid-cols-2 gap-2 border-b border-gray-100">
          <Stat label="Total size" value={totalSqft > 0 ? `${(totalSqft / 1_000_000).toFixed(2)}M sqft` : '—'} />
          <Stat
            label="Avg. market score"
            value={avgScore > 0 ? avgScore.toFixed(1) : '—'}
            colour={avgScore >= 80 ? '#15803d' : avgScore >= 60 ? '#b45309' : '#b91c1c'}
          />
        </div>
      )}

      {/* Asset list */}
      <div className="flex-1 overflow-auto">
        {assets.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            <div className="text-3xl mb-2">◆</div>
            <p className="font-medium">No assets yet</p>
            <p className="text-xs mt-1">Click "+ Add asset" on the toolbar, then click the map to place one.</p>
          </div>
        ) : (
          sorted.map(asset => {
            const market = markets.find(m => m.market.id === asset.marketId);
            const tierColour = market
              ? market.totalScore >= 80 ? '#15803d' : market.totalScore >= 60 ? '#b45309' : '#b91c1c'
              : '#9ca3af';
            return (
              <div key={asset.id} className="px-5 py-3 border-b border-gray-50 hover:bg-purple-50/30 group">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-700 text-sm">◆</span>
                      <span className="font-semibold text-gray-900 text-sm truncate">{asset.name}</span>
                    </div>
                    {asset.assetType && (
                      <div className="text-[11px] text-gray-500 ml-5">{asset.assetType}</div>
                    )}
                  </div>
                  <button
                    onClick={async () => { if (await confirmDialog({ title: `Remove ${asset.name}?`, confirmText: 'Remove', destructive: true })) onDelete(asset.id); }}
                    className="text-[10px] text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
                <div className="ml-5 flex items-center gap-3 text-[11px]">
                  {asset.sizeSqft && (
                    <span className="text-gray-500 font-mono tabular-nums">
                      {asset.sizeSqft.toLocaleString('en-GB')} sqft
                    </span>
                  )}
                  {market && (
                    <span className="flex items-center gap-1">
                      <span className="text-gray-400">in</span>
                      <span className="font-medium text-gray-700">{market.market.name}</span>
                      <span className="font-bold tabular-nums" style={{ color: tierColour }}>
                        ({market.totalScore.toFixed(1)})
                      </span>
                    </span>
                  )}
                </div>
                <div className="ml-5 text-[10px] text-gray-400 font-mono mt-0.5">
                  {asset.lat.toFixed(4)}, {asset.lng.toFixed(4)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Help footer */}
      <div className="px-5 py-3 border-t border-gray-100 text-[10px] text-gray-400 leading-relaxed">
        Assets are auto-linked to the nearest market by distance. An upcoming IM upload feature will
        extract asset details from investment memoranda automatically.
      </div>
    </div>
  );
}

function Stat({ label, value, colour }: { label: string; value: string; colour?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm font-bold tabular-nums" style={{ color: colour ?? '#1f2937' }}>{value}</div>
    </div>
  );
}
