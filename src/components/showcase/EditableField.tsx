import { useState } from 'react';

interface EditableFieldProps {
  value: any;
  onChange: (value: any) => void;
  type?: 'text' | 'number';
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
}

export function EditableField({
  value,
  onChange,
  type = 'text',
  className = '',
  placeholder,
  readOnly = false
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(String(value || ''));

  if (readOnly) {
    return (
      <div className={`px-2 py-1 ${className}`}>
        {value || <span className="text-muted-foreground">{placeholder || '—'}</span>}
      </div>
    );
  }

  const handleSave = () => {
    const newValue = type === 'number' ? (tempValue ? Number(tempValue) : null) : tempValue || null;
    onChange(newValue);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setEditing(false);
  };

  return editing ? (
    <input
      autoFocus
      type={type}
      value={tempValue}
      onChange={(e) => setTempValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={`px-2 py-1 border border-blue-400 rounded ${className}`}
    />
  ) : (
    <div
      onClick={() => {
        setTempValue(String(value || ''));
        setEditing(true);
      }}
      className={`cursor-pointer hover:bg-gray-50 px-2 py-1 rounded ${className}`}
    >
      {value || <span className="text-gray-400">{placeholder || '—'}</span>}
    </div>
  );
}
