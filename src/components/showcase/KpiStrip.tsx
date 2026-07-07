import { EditableField } from './EditableField';

interface KpiStripProps {
  kpis: Record<string, any> | null | undefined;
  onEdit: (key: string, value: any) => void;
  readOnly?: boolean;
}

const KPI_LABELS: Record<string, string> = {
  tenure: 'Tenure',
  units: 'Units',
  lettable_area_sqft: 'Area (sqft)',
  occupancy_pct: 'Occupancy %',
  passing_rent_psf: 'Passing Rent (psf)',
  capital_value_psf: 'Cap Value (psf)',
  niy_pct: 'NIY %',
  ry_pct: 'RY %',
};

export function KpiStrip({ kpis, onEdit, readOnly = false }: KpiStripProps) {
  const kpiKeys = Object.keys(KPI_LABELS);
  const cells = kpiKeys.map((key) => ({
    key,
    label: KPI_LABELS[key],
    value: kpis?.[key],
  }));

  return (
    <div className="grid grid-cols-2 gap-4">
      {cells.map(({ key, label, value }) => (
        <div key={key} className="rounded-lg bg-muted/60 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 text-sm font-semibold text-primary">
            <EditableField
              value={value}
              readOnly={readOnly}
              onChange={(v) => onEdit(key, v)}
              type={key.includes('area') || key.includes('rent') || key.includes('value') ? 'number' : 'text'}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
