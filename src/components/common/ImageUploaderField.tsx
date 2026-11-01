import React, { useRef, useState } from 'react';
import { Upload, Trash2, FileText } from 'lucide-react';
import { uploadMediaAsset, extractApiErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ResilientImage } from './ResilientImage';

interface ImageUploaderFieldProps {
  label: string;
  value: string;
  onChange: (newUrl: string) => void;
  acceptPdf?: boolean;
  helperText?: string;
}

export const ImageUploaderField: React.FC<ImageUploaderFieldProps> = ({
  label,
  value,
  onChange,
  acceptPdf = false,
  helperText,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const { showToast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploaded = await uploadMediaAsset(file);
      onChange(uploaded.url);
      showToast(`Uploaded ${uploaded.originalName}`, 'success');
    } catch (err) {
      showToast(extractApiErrorMessage(err, 'File upload failed.'), 'error');
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const isPdf = value.toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-[#E2E8F0]">{label}</label>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {value && (
          <div className="w-20 h-16 rounded-xl overflow-hidden border border-[#8B19FF]/35 bg-[#05081D] shrink-0 flex items-center justify-center">
            {isPdf ? (
              <div className="flex flex-col items-center text-[#00D9FF] text-[10px] gap-1">
                <FileText className="w-5 h-5" />
                <span>PDF</span>
              </div>
            ) : (
              <ResilientImage src={value} alt={label} className="w-full h-full object-cover" />
            )}
          </div>
        )}

        <div className="flex-1 w-full space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={acceptPdf ? 'Paste URL or upload PDF/image...' : 'Paste image URL or upload...'}
              aria-label={label}
              className="flex-1 rounded-xl bg-[#05081D] border border-white/15 px-3.5 py-2 text-xs text-[#F5F5FF] placeholder:text-[#B5BCD9]/50 focus:outline-none focus:border-[#8B19FF]"
            />
            <input
              ref={inputRef}
              type="file"
              accept={acceptPdf ? '.jpg,.jpeg,.png,.webp,.pdf' : '.jpg,.jpeg,.png,.webp'}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-[#8B19FF]/85 hover:bg-[#8B19FF] transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? 'Uploading...' : 'Upload'}</span>
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                aria-label={`Clear ${label}`}
                className="p-2 rounded-xl text-rose-400 bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {helperText && <p className="text-[11px] text-[#B5BCD9]/75">{helperText}</p>}
        </div>
      </div>
    </div>
  );
};
