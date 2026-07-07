import { create } from 'zustand';
import { API_BASE } from '@/config/api';

export interface DealRecord {
  deal_id: string;
  status: 'extracted' | 'reviewed' | 'failed';
  source_filename: string;
  pdf_hash: string;
  extracted_fields: Record<string, any>;
  market_ids: string[];
  market_match_confidence: number;
  microlocation_fit_score: number;
  microlocation_narrative: string;
  extraction_errors?: string[];
  underwrite?: {
    status?: string;
    returns?: Record<string, number> | null;
    checks?: { pass: boolean; anchor_tieout_ok: boolean; workbook_error_cells: number } | null;
    display_returns?: boolean;
    [k: string]: any;
  } | null;
  showcase?: {
    headline?: string | null;
    kpis?: {
      tenure?: string;
      units?: number;
      lettable_area_sqft?: number;
      occupancy_pct?: number;
      passing_rent_psf?: number;
      capital_value_psf?: number;
      niy_pct?: number;
      ry_pct?: number;
      purchase_price?: number;
    } | null;
    rationale_bullets?: { label: string; text: string }[];
    business_plan_bullets?: string[];
    images?: { file: string; selected: boolean }[];
    location?: { address?: string; postcode?: string; lat?: number; lng?: number } | null;
    provenance?: { generated_from: string; generated_at: string; edited_by_analyst: boolean };
  } | null;
  created_at?: string;
  updated_at?: string;
}

export interface DealStore {
  deals: DealRecord[];
  loading: boolean;
  error: string | null;

  // Fetch deals from server
  fetchDeals: () => Promise<void>;

  // Add/update deals
  addDeal: (deal: DealRecord) => void;
  updateDeal: (dealId: string, updates: Partial<DealRecord>) => void;
  patchDeal: (dealId: string, updates: Partial<DealRecord>) => Promise<void>;
  createDeal: (name?: string) => Promise<DealRecord>;
  deleteDeal: (dealId: string) => Promise<void>;

  // Market override
  overrideMarket: (dealId: string, marketIds: string[]) => Promise<void>;

  // Showcase patch
  patchShowcase: (dealId: string, updates: Partial<DealRecord['showcase']>) => Promise<void>;

  // Filters
  setFilters: (filters: DealFilters) => void;
  filters: DealFilters;

  // Sorted/filtered deals
  getFilteredDeals: () => DealRecord[];
}

export interface DealFilters {
  search?: string;
  markets?: string[];
  minFitScore?: number;
  maxFitScore?: number;
  status?: ('extracted' | 'reviewed' | 'failed')[];
  minNIY?: number;
  maxNIY?: number;
  minWAULT?: number;
  maxWAULT?: number;
}

export const useDealStore = create<DealStore>((set, get) => ({
  deals: [],
  loading: false,
  error: null,
  filters: {},

  fetchDeals: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/deals`);
      if (!response.ok) throw new Error('Failed to fetch deals');
      const deals = await response.json();
      set({ deals });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      set({ loading: false });
    }
  },

  addDeal: (deal) => {
    set(state => ({
      deals: [...state.deals, deal]
    }));
  },

  updateDeal: (dealId, updates) => {
    set(state => ({
      deals: state.deals.map(d => {
        if (d.deal_id !== dealId) return d;
        // Deep merge for extracted_fields
        if (updates.extracted_fields) {
          return {
            ...d,
            ...updates,
            extracted_fields: { ...d.extracted_fields, ...updates.extracted_fields }
          };
        }
        return { ...d, ...updates };
      })
    }));
  },

  // Optimistically apply an edit locally, then persist it to the server so it
  // survives a page refresh (the pipeline re-fetches deals on mount). On failure
  // the local change is rolled back to the last server truth and the error surfaces.
  patchDeal: async (dealId, updates) => {
    const prev = get().deals.find((d) => d.deal_id === dealId);
    get().updateDeal(dealId, updates);
    try {
      const response = await fetch(`${API_BASE}/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error(`Failed to save (server responded ${response.status})`);
      const saved = await response.json();
      // Replace with the server's canonical record (authoritative merge).
      set((state) => ({
        deals: state.deals.map((d) => (d.deal_id === dealId ? saved : d)),
      }));
    } catch (err) {
      if (prev) {
        set((state) => ({
          deals: state.deals.map((d) => (d.deal_id === dealId ? prev : d)),
        }));
      }
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
      throw err;
    }
  },

  createDeal: async (name) => {
    const response = await fetch(`${API_BASE}/deals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || null }),
    });
    if (!response.ok) throw new Error(`Failed to create deal (server responded ${response.status})`);
    const deal: DealRecord = await response.json();
    get().addDeal(deal);
    return deal;
  },

  deleteDeal: async (dealId) => {
    try {
      const response = await fetch(`${API_BASE}/deals/${dealId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete deal');
      set(state => ({
        deals: state.deals.filter(d => d.deal_id !== dealId)
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
      throw err;
    }
  },

  overrideMarket: async (dealId, marketIds) => {
    try {
      const response = await fetch(`${API_BASE}/deals/${dealId}/market-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market_ids: marketIds })
      });
      if (!response.ok) throw new Error('Failed to override market');
      const updated = await response.json();
      get().updateDeal(dealId, updated);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
      throw err;
    }
  },

  patchShowcase: async (dealId, updates) => {
    try {
      const response = await fetch(`${API_BASE}/deals/${dealId}/showcase`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update showcase');
      const showcase = await response.json();
      get().updateDeal(dealId, { showcase });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
      throw err;
    }
  },

  setFilters: (filters) => {
    set({ filters });
  },

  getFilteredDeals: () => {
    const { deals, filters } = get();

    return deals.filter(deal => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!deal.source_filename.toLowerCase().includes(s) &&
            !deal.microlocation_narrative.toLowerCase().includes(s)) {
          return false;
        }
      }

      if (filters.markets && filters.markets.length > 0) {
        if (!deal.market_ids.some(m => filters.markets!.includes(m))) {
          return false;
        }
      }

      if (filters.minFitScore !== undefined && deal.microlocation_fit_score < filters.minFitScore) {
        return false;
      }

      if (filters.maxFitScore !== undefined && deal.microlocation_fit_score > filters.maxFitScore) {
        return false;
      }

      if (filters.status && filters.status.length > 0 && !filters.status.includes(deal.status)) {
        return false;
      }

      const niy = deal.extracted_fields?.Yield;
      if (filters.minNIY !== undefined && niy && niy < filters.minNIY) {
        return false;
      }
      if (filters.maxNIY !== undefined && niy && niy > filters.maxNIY) {
        return false;
      }

      const wault = deal.extracted_fields?.['WAULT, years'];
      if (filters.minWAULT !== undefined && wault && wault < filters.minWAULT) {
        return false;
      }
      if (filters.maxWAULT !== undefined && wault && wault > filters.maxWAULT) {
        return false;
      }

      return true;
    });
  }
}));
