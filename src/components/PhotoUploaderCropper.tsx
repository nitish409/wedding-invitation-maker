'use client';

import React, { useState } from 'react';
import { PhotoSlotConfig } from '@/types/wedding';
import {
  Upload,
  ZoomIn,
  Move,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface PhotoUploaderCropperProps {
  label: string;
  subtitle: string;
  slot: PhotoSlotConfig;
  archFrame?: boolean;
  onChange: (updated: PhotoSlotConfig) => void;
}

export const PhotoUploaderCropper: React.FC<PhotoUploaderCropperProps> = ({
  label,
  subtitle,
  slot,
  archFrame = false,
  onChange,
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compressPhotoForUpload = (file: File): Promise<File> => {
    if (typeof window === 'undefined' || file.size <= 350 * 1024) {
      return Promise.resolve(file);
    }
    return new Promise((resolve) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        const maxDim = 1080;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const safeName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
            resolve(new File([blob], safeName, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.84
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        resolve(file);
      };
      img.src = objUrl;
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const processedFile = await compressPhotoForUpload(file);
      const formData = new FormData();
      formData.append('file', processedFile);
      formData.append('type', 'photo');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const rawText = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        if (res.status === 413 || rawText.includes('Request Entity Too Large')) {
          throw new Error('Photo file is too large for upload. Please choose a smaller image.');
        }
        throw new Error(rawText.slice(0, 120) || 'Failed to upload photo');
      }

      if (!res.ok) {
        throw new Error(String(data.error || 'Failed to upload photo'));
      }

      onChange({
        ...slot,
        url: String(data.url || ''),
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="rounded-2xl bg-white p-4 sm:p-5 border border-[#D4AF37]/40 shadow-sm flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-lg text-[#5C0A1B] font-royal">{label}</h4>
          <p className="text-xs text-[#5C0A1B]/70">{subtitle}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Ready
        </span>
      </div>

      {/* Live Framed Preview */}
      <div className="flex flex-col sm:flex-row items-center gap-5 bg-[#FDF6EC] p-4 rounded-xl border border-[#D4AF37]/30">
        <div
          className="relative overflow-hidden bg-[#2A0810] border-4 border-[#D4AF37] shadow-md shrink-0"
          style={{
            width: 128,
            height: archFrame ? 150 : 128,
            borderRadius: archFrame ? '64px 64px 14px 14px' : '50%',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slot.url}
            alt={label}
            className="w-full h-full object-cover transition-transform duration-75"
            style={{
              transform: `scale(${slot.zoom || 1}) translate(${(slot.offsetX || 0) * 0.5}%, ${
                (slot.offsetY || 0) * 0.5
              }%)`,
              maskImage: slot.removeBg
                ? 'radial-gradient(circle at center, black 55%, transparent 92%)'
                : undefined,
              WebkitMaskImage: slot.removeBg
                ? 'radial-gradient(circle at center, black 55%, transparent 92%)'
                : undefined,
            }}
          />
        </div>

        {/* Upload Button + Adjustments */}
        <div className="flex-1 w-full space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#5C0A1B] hover:bg-[#82142B] text-[#FFFDF9] text-xs font-semibold transition shadow-sm">
              <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{uploading ? 'Uploading...' : 'Upload JPG / PNG / WebP'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() =>
                onChange({
                  ...slot,
                  zoom: 1,
                  offsetX: 0,
                  offsetY: 0,
                  removeBg: false,
                })
              }
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white hover:bg-amber-50 text-[#5C0A1B] border border-[#D4AF37]/40 text-xs font-medium transition"
              title="Reset framing"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Zoom Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-medium text-[#5C0A1B]/80">
              <span className="flex items-center gap-1">
                <ZoomIn className="w-3 h-3 text-[#D4AF37]" /> Zoom / Crop Scale
              </span>
              <span>{Math.round((slot.zoom || 1) * 100)}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={2.4}
              step={0.05}
              value={slot.zoom || 1}
              onChange={(e) =>
                onChange({ ...slot, zoom: parseFloat(e.target.value) })
              }
              className="w-full accent-[#5C0A1B] h-1.5 bg-amber-200 rounded-lg cursor-pointer"
            />
          </div>

          {/* Pan X & Y Sliders */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-[11px] font-medium text-[#5C0A1B]/80">
                <span className="flex items-center gap-1">
                  <Move className="w-3 h-3 text-[#D4AF37]" /> Horizontal Pan
                </span>
                <span>{slot.offsetX || 0}%</span>
              </div>
              <input
                type="range"
                min={-60}
                max={60}
                step={2}
                value={slot.offsetX || 0}
                onChange={(e) =>
                  onChange({ ...slot, offsetX: parseInt(e.target.value, 10) })
                }
                className="w-full accent-[#5C0A1B] h-1.5 bg-amber-200 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-medium text-[#5C0A1B]/80">
                <span className="flex items-center gap-1">
                  <Move className="w-3 h-3 text-[#D4AF37]" /> Vertical Pan
                </span>
                <span>{slot.offsetY || 0}%</span>
              </div>
              <input
                type="range"
                min={-60}
                max={60}
                step={2}
                value={slot.offsetY || 0}
                onChange={(e) =>
                  onChange({ ...slot, offsetY: parseInt(e.target.value, 10) })
                }
                className="w-full accent-[#5C0A1B] h-1.5 bg-amber-200 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Optional Studio Halo / Background Softening */}
          <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={Boolean(slot.removeBg)}
              onChange={(e) =>
                onChange({ ...slot, removeBg: e.target.checked })
              }
              className="rounded border-[#D4AF37] text-[#5C0A1B] focus:ring-[#5C0A1B]"
            />
            <span className="text-xs font-medium text-[#5C0A1B] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              Apply Studio Portrait Cutout Halo (Soft Background Mask)
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
