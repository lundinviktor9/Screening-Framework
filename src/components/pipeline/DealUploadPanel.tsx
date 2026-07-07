import { useState, useRef } from 'react';
import { UploadCloud, Loader2, FolderInput } from 'lucide-react';
import { API_BASE } from '@/config/api';

import { useDealStore } from '../../store/useDealStore';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function DealUploadPanel() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [processingInbox, setProcessingInbox] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addDeal = useDealStore((s) => s.addDeal);
  const fetchDeals = useDealStore((s) => s.fetchDeals);

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    files.forEach((file) => setProgress((p) => ({ ...p, [file.name]: 40 })));

    try {
      const response = await fetch(`${API_BASE}/ingest`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`Server responded ${response.status}`);
      const deals = await response.json();
      deals.forEach((deal: any) => {
        if (deal.deal_id) addDeal(deal);
      });
      await fetchDeals();
      const rows = Array.isArray(deals) ? deals : [];
      const ok = rows.filter((d: any) => d.status !== 'failed');
      const failed = rows.filter((d: any) => d.status === 'failed');
      if (ok.length)
        toast.success(`Extraction complete — ${ok.length} deal${ok.length === 1 ? '' : 's'} added`);
      failed.forEach((d: any) =>
        toast.error(
          `${d.source_filename || 'PDF'} failed: ${(d.extraction_errors || []).join('; ') || 'unknown error'}`,
          { duration: 10000 }
        )
      );
    } catch (err) {
      toast.error('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
      setProgress({});
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === 'application/pdf' || f.name.endsWith('.pdf')
    );
    if (files.length) uploadFiles(files);
    else toast.error('Drop one or more PDF files');
  }

  async function processInbox() {
    setProcessingInbox(true);
    try {
      const r = await fetch(`${API_BASE}/ingest-folder?folder_path=deals_inbox`, {
        method: 'POST',
      });
      if (!r.ok) throw new Error(`Server responded ${r.status}`);
      const deals = await r.json();
      deals.forEach((d: any) => d.deal_id && addDeal(d));
      await fetchDeals();
      toast.success(`Inbox processed — ${deals.length} deal${deals.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error('Batch ingest failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessingInbox(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
      <input
        ref={fileInputRef}
        id="deal-pdf-upload"
        type="file"
        multiple
        accept=".pdf"
        onChange={(e) => e.target.files && uploadFiles(Array.from(e.target.files))}
        className="sr-only"
      />
      <label
        htmlFor="deal-pdf-upload"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-card px-6 py-7 text-center transition-colors',
          dragging ? 'border-primary bg-accent/40' : 'border-border hover:border-primary/60'
        )}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : (
          <UploadCloud className="h-6 w-6 text-primary" />
        )}
        <div className="text-sm font-medium text-foreground">
          {uploading ? 'Extracting…' : 'Drag IM PDFs here, or click to browse'}
        </div>
        <div className="text-xs text-muted-foreground">
          PDFs are extracted via Claude, matched to a market, and scored.
        </div>
        {uploading && Object.keys(progress).length > 0 && (
          <div className="mt-2 w-full max-w-sm space-y-1.5">
            {Object.entries(progress).map(([name, pct]) => (
              <div key={name} className="text-left text-[11px] text-muted-foreground">
                <div className="mb-0.5 flex justify-between gap-2">
                  <span className="truncate">{name}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </label>

      <Button
        variant="outline"
        onClick={processInbox}
        disabled={processingInbox}
        className="sm:self-center"
      >
        {processingInbox ? <Loader2 className="animate-spin" /> : <FolderInput />}
        Process inbox
      </Button>
    </div>
  );
}
