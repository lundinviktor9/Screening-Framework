import type { RAG } from '../../types';

const STYLES: Record<RAG, string> = {
  Green: 'bg-green-100 text-green-800 border-green-200',
  Amber: 'bg-amber-100 text-amber-800 border-amber-200',
  Red:   'bg-red-100 text-red-800 border-red-200',
};

export default function RAGBadge({ rag }: { rag: RAG }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${STYLES[rag]}`}>
      {rag}
    </span>
  );
}
