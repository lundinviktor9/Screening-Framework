import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown, Calculator, Trash2, Download, Search, Loader2, Pencil } from 'lucide-react';

import { type DealRecord, useDealStore } from '../../store/useDealStore';
import { UK_MARKETS } from '../../data/ukMarkets';
import { cn } from '@/lib/utils';
import { API_BASE } from '@/config/api';
import { toast } from '@/components/ui/sonner';
import { confirmDialog } from '@/components/ui/confirm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const marketName = (id?: string) => UK_MARKETS.find((m) => m.id === id)?.name || id || '—';
const fmtCurrency = (v: any) => {
  const n = Number(v);
  if (v == null || v === '' || isNaN(n)) return '—';
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}m`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}k`;
  return `£${n}`;
};
const fmtPct = (v: any) => {
  const n = Number(v);
  return v == null || v === '' || isNaN(n) ? '—' : `${n.toFixed(2)}%`;
};
const str = (v: any) => (v == null || v === '' ? '—' : String(v));

/** Click-to-edit text cell rendered as a popover with an input. */
function EditTextCell({
  value,
  display,
  onSave,
  numeric,
}: {
  value: any;
  display: string;
  onSave: (v: string) => void;
  numeric?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(value == null ? '' : String(value)); }}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="group flex w-full items-center justify-between gap-1 rounded px-1 py-0.5 text-left hover:bg-muted"
        >
          <span className="truncate">{display}</span>
          <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56" onClick={(e) => e.stopPropagation()}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
            setOpen(false);
          }}
          className="flex flex-col gap-2"
        >
          <Input
            autoFocus
            type={numeric ? 'number' : 'text'}
            step="any"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  deals: DealRecord[];
}

export function DealDataTable({ deals }: Props) {
  const navigate = useNavigate();
  const patchDeal = useDealStore((s) => s.patchDeal);
  const deleteDeal = useDealStore((s) => s.deleteDeal);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [exporting, setExporting] = useState(false);

  const setField = (deal: DealRecord, key: string, value: any) =>
    patchDeal(deal.deal_id, { extracted_fields: { [key]: value } }).catch((err) =>
      toast.error('Save failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    );

  async function handleDelete(deal: DealRecord) {
    const ok = await confirmDialog({
      title: 'Delete this deal?',
      description: 'This removes the deal and its extracted data. This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDeal(deal.deal_id);
    } catch (err) {
      toast.error('Delete failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  const columns = useMemo<ColumnDef<DealRecord>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllRowsSelected()
                ? true
                : table.getIsSomeRowsSelected()
                ? 'indeterminate'
                : false
            }
            onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
      },
      {
        id: 'asset',
        accessorFn: (d) => d.extracted_fields?.['Project Name'] || '',
        header: 'Asset',
        cell: ({ row }) => {
          const d = row.original;
          const v = d.extracted_fields?.['Project Name'];
          return (
            <EditTextCell
              value={v}
              display={str(v)}
              onSave={(val) => setField(d, 'Project Name', val)}
            />
          );
        },
      },
      {
        id: 'market',
        accessorFn: (d) => marketName(d.market_ids?.[0]),
        header: 'Market',
        cell: ({ row }) => {
          const d = row.original;
          return (
            <Select
              value={d.market_ids?.[0] || ''}
              onValueChange={(val) =>
                patchDeal(d.deal_id, { market_ids: val ? [val] : [] }).catch((err) =>
                  toast.error('Save failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
                )
              }
            >
              <SelectTrigger
                onClick={(e) => e.stopPropagation()}
                className="h-7 border-transparent bg-transparent px-1 hover:bg-muted"
              >
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {UK_MARKETS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        id: 'age',
        accessorFn: (d) => d.extracted_fields?.['Year Built'] || '',
        header: 'Age',
        cell: ({ row }) => {
          const d = row.original;
          const v = d.extracted_fields?.['Year Built'];
          return <EditTextCell value={v} display={str(v)} onSave={(val) => setField(d, 'Year Built', val)} />;
        },
      },
      {
        id: 'tenants',
        accessorFn: (d) => Number(d.extracted_fields?.['Number of Tenants']) || 0,
        header: 'Tenants',
        cell: ({ row }) => {
          const d = row.original;
          const v = d.extracted_fields?.['Number of Tenants'];
          return (
            <EditTextCell
              numeric
              value={v}
              display={str(v)}
              onSave={(val) => setField(d, 'Number of Tenants', val === '' ? null : Number(val))}
            />
          );
        },
      },
      {
        id: 'occupancy',
        accessorFn: (d) => d.extracted_fields?.['Economic occupancy rate, %'] || '',
        header: 'Occupancy',
        cell: ({ row }) => {
          const d = row.original;
          const v = d.extracted_fields?.['Economic occupancy rate, %'];
          return <EditTextCell value={v} display={str(v)} onSave={(val) => setField(d, 'Economic occupancy rate, %', val)} />;
        },
      },
      {
        id: 'price',
        accessorFn: (d) => Number(d.extracted_fields?.['Deal value, CCY']) || 0,
        header: 'Quoting Price',
        cell: ({ row }) => {
          const d = row.original;
          const v = d.extracted_fields?.['Deal value, CCY'];
          return (
            <EditTextCell
              numeric
              value={v}
              display={fmtCurrency(v)}
              onSave={(val) => setField(d, 'Deal value, CCY', val === '' ? null : Number(val))}
            />
          );
        },
      },
      {
        id: 'niy',
        accessorFn: (d) => Number(d.extracted_fields?.['Yield']) || 0,
        header: 'NIY',
        cell: ({ row }) => {
          const d = row.original;
          const v = d.extracted_fields?.['Yield'];
          return (
            <EditTextCell
              numeric
              value={v}
              display={fmtPct(v)}
              onSave={(val) => setField(d, 'Yield', val === '' ? null : Number(val))}
            />
          );
        },
      },
      {
        id: 'ry',
        accessorFn: (d) => Number(d.extracted_fields?.['Yield2']) || 0,
        header: 'RY',
        cell: ({ row }) => {
          const d = row.original;
          const v = d.extracted_fields?.['Yield2'];
          return (
            <EditTextCell
              numeric
              value={v}
              display={fmtPct(v)}
              onSave={(val) => setField(d, 'Yield2', val === '' ? null : Number(val))}
            />
          );
        },
      },
      {
        id: 'onoff',
        accessorFn: (d) => d.extracted_fields?.['Market Status'] || '',
        header: 'On / Off',
        cell: ({ row }) => {
          const d = row.original;
          const status = d.extracted_fields?.['Market Status'] || 'On-market';
          const on = status === 'On-market';
          return (
            <Select value={status} onValueChange={(val) => setField(d, 'Market Status', val)}>
              <SelectTrigger
                onClick={(e) => e.stopPropagation()}
                className="h-7 w-[72px] border-transparent bg-transparent px-1 hover:bg-muted [&>svg]:opacity-40"
              >
                <Badge variant={on ? 'success' : 'secondary'}>{on ? 'On' : 'Off'}</Badge>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="On-market">On-market</SelectItem>
                <SelectItem value="Off-market">Off-market</SelectItem>
              </SelectContent>
            </Select>
          );
        },
      },
      {
        id: 'status',
        accessorFn: (d) => d.status,
        header: 'Status',
        cell: ({ row }) => {
          const s = row.original.status;
          const variant = s === 'reviewed' ? 'success' : s === 'failed' ? 'danger' : 'secondary';
          return <Badge variant={variant as any}>{s}</Badge>;
        },
      },
      {
        id: 'comment',
        accessorFn: (d) => d.extracted_fields?.['Comment'] || '',
        header: 'Comment',
        cell: ({ row }) => {
          const d = row.original;
          const v = d.extracted_fields?.['Comment'];
          return (
            <div className="max-w-[220px]">
              <EditTextCell value={v} display={str(v)} onSave={(val) => setField(d, 'Comment', val)} />
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const d = row.original;
          return (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="icon"
                variant="ghost"
                title="Underwrite"
                onClick={() => navigate(`/underwrite?deal=${d.deal_id}`)}
              >
                <Calculator className="text-muted-foreground" />
              </Button>
              <Button size="icon" variant="ghost" title="Delete" onClick={() => handleDelete(d)}>
                <Trash2 className="text-danger" />
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const table = useReactTable({
    data: deals,
    columns,
    state: { sorting, rowSelection, globalFilter },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (d) => d.deal_id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  async function exportDeck() {
    if (!selectedIds.length) return;
    setExporting(true);
    try {
      const r = await fetch(`${API_BASE}/export/deck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_ids: selectedIds, include_pipeline_summary: true }),
      });
      if (!r.ok) throw new Error(`Server responded ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Brunswick_Pipeline.pptx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported deck — ${selectedIds.length} deal${selectedIds.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error('Export failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b p-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search deals…"
            className="h-9 pl-8"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {selectedIds.length > 0 && (
            <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
          )}
          <Button onClick={exportDeck} disabled={!selectedIds.length || exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            Export deck (.pptx)
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-accent/60 backdrop-blur">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead key={header.id} className="whitespace-nowrap text-xs uppercase tracking-wide">
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? 'selected' : undefined}
                className="cursor-pointer"
                onClick={() => navigate(`/pipeline/${row.original.deal_id}`)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
