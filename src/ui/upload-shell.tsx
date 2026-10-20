import React, { useCallback, useState } from 'react';

interface UploadShellProps {
  onUpload: (file: File, imageUrl: string) => void;
  onClose: () => void;
  uploadRecords: any[];
  onShowConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const UploadShell: React.FC<UploadShellProps> = ({ onUpload, onClose }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setPreview(url);
      setFile(f);
    };
    reader.readAsDataURL(f);
  }, []);

  const handleUpload = () => {
    if (file && preview) {
      onUpload(file, preview);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg p-4 w-full max-w-md">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Upload Image</h3>
          <button onClick={onClose} className="p-1 rounded text-[var(--text-secondary)] hover:bg-[rgba(107,114,128,0.2)]">✕</button>
        </div>
        <input type="file" accept="image/*" onChange={handleFileChange} className="w-full text-sm mb-3" />
        {preview && (
          <img src={preview} alt="preview" className="w-full rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)] mb-3" />
        )}
        <button onClick={handleUpload} disabled={!file || !preview} className="w-full py-2 rounded bg-orange-600/80 hover:bg-orange-600 text-black font-semibold disabled:opacity-50">Upload</button>
      </div>
    </div>
  );
};

export default UploadShell;