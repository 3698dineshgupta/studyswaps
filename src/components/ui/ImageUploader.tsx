'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  label?: string;
  hint?: string;
  className?: string;
  existingImages?: string[];
  onRemoveExisting?: (url: string) => void;
}

export default function ImageUploader({
  onFilesChange,
  maxFiles = 5,
  maxSizeMB = 5,
  accept = 'image/jpeg,image/png,image/webp',
  label = 'Upload Images',
  hint,
  className,
  existingImages = [],
  onRemoveExisting,
}: ImageUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (newFiles: File[]): File[] => {
    const valid: File[] = [];
    for (const f of newFiles) {
      if (f.size > maxSizeMB * 1024 * 1024) {
        setError(`${f.name} exceeds ${maxSizeMB}MB`);
        continue;
      }
      valid.push(f);
    }
    return valid;
  };

  const addFiles = useCallback((newFiles: File[]) => {
    setError('');
    const validated = validate(newFiles);
    const combined = [...files, ...validated].slice(0, maxFiles - existingImages.length);
    setFiles(combined);
    onFilesChange(combined);
    const newPreviews = combined.map(f => URL.createObjectURL(f));
    setPreviews(prev => { prev.forEach(URL.revokeObjectURL); return newPreviews; });
  }, [files, maxFiles, existingImages.length, onFilesChange]);

  const removeFile = (idx: number) => {
    const updated = files.filter((_, i) => i !== idx);
    setFiles(updated);
    onFilesChange(updated);
    URL.revokeObjectURL(previews[idx]);
    setPreviews(updated.map(f => URL.createObjectURL(f)));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const totalCount = existingImages.length + files.length;
  const canAdd = totalCount < maxFiles;

  return (
    <div className={cn('space-y-3', className)}>
      {label && <p className="text-sm font-medium text-gray-700">{label}</p>}

      <div className="flex flex-wrap gap-3">
        {existingImages.map((url) => (
          <div key={url} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 group">
            <img src={url} alt="" className="w-full h-full object-cover" />
            {onRemoveExisting && (
              <button onClick={() => onRemoveExisting(url)}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <X className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        ))}

        {previews.map((src, idx) => (
          <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 group">
            <img src={src} alt="" className="w-full h-full object-cover" />
            <button onClick={() => removeFile(idx)}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        ))}

        {canAdd && (
          <button type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'w-24 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all',
              dragging ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400 hover:bg-green-50'
            )}>
            <Upload className="w-5 h-5 text-gray-400" />
            <span className="text-xs text-gray-400">Add photo</span>
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" multiple accept={accept} className="hidden"
        onChange={(e) => addFiles(Array.from(e.target.files || []))} />

      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      <p className="text-xs text-gray-400">{totalCount}/{maxFiles} photos · Max {maxSizeMB}MB each</p>
    </div>
  );
}
