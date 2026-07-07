import { useNavigate, useParams } from 'react-router-dom';
import { useMarketStore, generateId } from '../store/marketStore';
import type { MarketInput } from '../types';
import MarketForm from '../components/market/MarketForm';
import { toast } from '@/components/ui/sonner';

export default function AddMarketPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();

  const markets = useMarketStore(s => s.markets);
  const addMarketAction = useMarketStore(s => s.addMarket);
  const updateMarketAction = useMarketStore(s => s.updateMarket);

  const existing = id ? markets.find(m => m.id === id) : undefined;

  function handleSave(data: Omit<MarketInput, 'id' | 'createdAt'> & { id?: string }) {
    if (existing) {
      updateMarketAction({ ...existing, ...data, updatedAt: new Date().toISOString() });
      toast.success(`Updated ${data.name || existing.name}`);
    } else {
      const market: MarketInput = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addMarketAction(market);
      toast.success(`Added ${data.name || 'market'}`);
    }
    navigate('/rankings');
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          {existing ? `Edit: ${existing.name}` : 'Add New Market'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter values for all 60 metrics. Leave blank if data is unavailable — those metrics score 0.
        </p>
      </div>

      <MarketForm
        initial={existing}
        onSave={handleSave}
        onCancel={() => navigate('/rankings')}
      />
    </div>
  );
}
