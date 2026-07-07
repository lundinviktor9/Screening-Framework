import { API_BASE } from '@/config/api';

interface PhotoCardProps {
  images?: { file: string; selected: boolean }[] | null;
  onSelectImage?: (file: string) => void;
}

export function PhotoCard({ images, onSelectImage }: PhotoCardProps) {
  const selectedImage = images?.find((img) => img.selected);

  if (!images || images.length === 0) {
    return (
      <div className="h-64 bg-brand-cardBg rounded-lg flex items-center justify-center">
        <span className="text-sm text-gray-600">No photos</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="h-64 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
        {selectedImage ? (
          <img
            src={`${API_BASE}/${selectedImage.file}`}
            alt="Asset"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="text-sm text-gray-600">No image selected</span>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2">
          {images.map((img) => (
            <button
              key={img.file}
              onClick={() => onSelectImage?.(img.file)}
              className={`text-xs px-2 py-1 rounded border ${
                img.selected
                  ? 'bg-brand-purple text-white border-brand-purple'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              Photo
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
