'use client';

/**
 * A plain photo upload of a real ID document — school ID, college/university ID, citizenship certificate or
 * national ID card. The photo can come from the camera or the gallery (the native file picker offers both on
 * phones); nothing forces a live camera session. The server decides the verification id and where it is stored.
 */

import { useRef, useState } from 'react';
import { Book, CheckCircle, CreditCard, FileText, GraduationCap, Lock, RotateCcw, Upload } from 'lucide-react';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export const DOCUMENT_TYPES = [
  { id: 'COLLEGE_ID', label: 'College / University ID', Icon: GraduationCap },
  { id: 'SCHOOL_ID', label: 'School ID', Icon: Book },
  { id: 'CITIZENSHIP', label: 'Citizenship certificate', Icon: FileText },
  { id: 'NATIONAL_ID', label: 'National ID card', Icon: CreditCard },
] as const;
export type DocumentTypeId = (typeof DOCUMENT_TYPES)[number]['id'];

interface Props {
  /** Called with the server-issued verification id once the document is stored. */
  onComplete: (verificationId: string, documentType: DocumentTypeId) => void;
  initialDocumentType?: DocumentTypeId | null;
  /** Set when a document was already uploaded (the user navigated back to this step). */
  uploaded?: boolean;
}

export default function DocumentUpload({ onComplete, initialDocumentType, uploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  const [docType, setDocType] = useState<DocumentTypeId | null>(initialDocumentType ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedType, setSavedType] = useState<DocumentTypeId | null>(uploaded ? initialDocumentType ?? null : null);

  const clearFile = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setFile(null);
    setPreviewUrl(null);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // same file can be picked again after an error
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setError('Please choose a JPG, PNG or WebP photo.'); return; }
    setError(null);
    clearFile();
    setFile(f);
    const url = URL.createObjectURL(f);
    previewRef.current = url;
    setPreviewUrl(url);
  };

  const upload = async () => {
    if (!docType || !file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('document_type', docType);
      fd.append('photo', file);
      const res = await fetch('/api/identity-verification', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Upload failed. Please try again.'); return; }
      clearFile();
      setSavedType(docType);
      onComplete(json.verification_id, docType);
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  if (savedType) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100"><CheckCircle className="h-7 w-7 text-green-600" /></div>
        <div>
          <p className="font-semibold text-gray-900">Document uploaded</p>
          <p className="mt-1 text-sm text-gray-500">{DOCUMENT_TYPES.find((d) => d.id === savedType)?.label}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setDocType(savedType); setSavedType(null); }}><RotateCcw className="h-4 w-4" /> Upload a different photo</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Which document are you uploading?</p>
        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Document type">
          {DOCUMENT_TYPES.map(({ id, label, Icon }) => (
            <button
              key={id} type="button" role="radio" aria-checked={docType === id} onClick={() => setDocType(id)}
              className={cn('flex items-center gap-2.5 rounded-xl border-2 p-3 text-left transition-colors', docType === id ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300')}
            >
              <Icon className={cn('h-5 w-5 shrink-0', docType === id ? 'text-green-600' : 'text-gray-400')} />
              <span className="text-sm font-semibold text-ink">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        {/* No `capture` attribute: on phones the native picker offers both "Camera" and "Photos" */}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} />
        {previewUrl ? (
          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Your document" className="max-h-72 w-full object-contain" />
            <button type="button" onClick={() => inputRef.current?.click()} className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-ink shadow">Change photo</button>
          </div>
        ) : (
          <button
            type="button" onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/60 p-8 text-gray-400 transition-colors hover:border-green-400 hover:bg-green-50/50 hover:text-green-600"
          >
            <Upload className="h-7 w-7" />
            <span className="text-sm font-semibold">Choose a photo</span>
            <span className="text-xs">Take a new photo or pick one from your gallery</span>
          </button>
        )}
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Button onClick={upload} disabled={!docType || !file} loading={uploading} fullWidth size="lg">Upload document</Button>

      <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-700">
        <p className="flex items-start gap-2"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Your document photo is stored in a private, access-controlled location and seen only by our verification team.</p>
      </div>
    </div>
  );
}
