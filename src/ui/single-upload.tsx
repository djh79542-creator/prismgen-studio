import React, { useState, useCallback } from 'react';
import { useTranslation } from '../i18n/provider';

interface Props {
  onImageSelect: (file: File, dataUrl: string) => void | Promise<void>;
  initialImageUrl: string | null;
  onClearImage: () => void;
}

const SingleUploader: React.FC<Props> = ({ onImageSelect, initialImageUrl, onClearImage }) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await onImageSelect(file, dataUrl);
    };
    reader.readAsDataURL(file);
  }, [onImageSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`relative w-full aspect-square bg-[var(--bg-secondary)] rounded-lg flex items-center justify-center transition-colors duration-200 select-none ${
        isDragging ? 'outline-dashed outline-2 outline-[var(--accent-primary)] bg-[rgba(249,115,22,0.1)]' : ''
      } ${initialImageUrl ? 'p-0' : 'p-4 border-2 border-dashed border-[var(--border-primary)]'}`}
    >
      {!initialImageUrl ? (
        <label className="flex flex-col items-center justify-center text-[var(--text-tertiary)] cursor-pointer w-full h-full text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0L21.75 15.75M3.75 19.5h16.5a1.5 1.5 0 001.5-1.5V6A1.5 1.5 0 0020.25 4.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z"/></svg>
          <p className="mb-1 text-xs font-semibold text-[var(--text-secondary)]">{t('maskEditor.upload')}</p>
          <p className="text-xs">{t('motion.referenceImage')}</p>
          <input type="file" className="hidden" onChange={handleChange} accept="image/*" />
        </label>
      ) : (
        <>
          <img src={initialImageUrl} alt="reference" className="w-full h-full object-contain rounded-lg" />
          <button onClick={onClearImage} className="absolute top-2 right-2 z-10 p-1 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-red-600 transition-colors" aria-label="Remove image">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
          </button>
        </>
      )}
    </div>
  );
};

export default SingleUploader;