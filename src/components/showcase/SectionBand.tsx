interface SectionBandProps {
  title: string;
  children?: React.ReactNode;
}

export function SectionBand({ title, children }: SectionBandProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="bg-primary px-4 py-2 text-[13px] font-semibold uppercase tracking-wide text-primary-foreground">
        {title}
      </div>
      {children && <div className="p-4">{children}</div>}
    </div>
  );
}
