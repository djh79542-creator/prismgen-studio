import React from 'react';
import { assetsClient } from '../clients/assets';

interface AssetRecord {
  id: string;
  filename: string;
  url: string; // server relative url like /public/<user>/uploads/<file>
  size: number;
  uploadTime: string;
  type: string;
  dimensions?: { width: number; height: number };
}

interface AssetLibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  uploadRecords: AssetRecord[];
  onUseImage: (imageUrl: string) => void;
  onDownload: (url: string, fileName: string) => void;
  onDeleteImage: (recordId: string) => void;
  onClearAll: () => void;
  onShowConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const AssetLibraryPanel: React.FC<AssetLibraryPanelProps> = ({
  isOpen,
  onClose,
  uploadRecords,
  onUseImage,
  onDownload,
  onDeleteImage,
  onClearAll,
  onShowConfirm,
}) => {
  return (
    <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-[var(--bg-card)] border-l border-[var(--border-primary)] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out z-40 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="p-4 border-b border-[var(--border-primary)] flex justify-between items-center">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Upload Records</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onShowConfirm('清空上传记录', '确定要清空所有上传记录吗？此操作无法撤销。', onClearAll)}
            className="py-1 px-2 text-xs rounded bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)] text-[var(--text-primary)]"
          >
            Clear All
          </button>
          <button onClick={onClose} className="p-1 rounded text-[var(--text-secondary)] hover:bg-[rgba(107,114,128,0.2)]">✕</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 grid grid-cols-2 gap-3">
        {uploadRecords.length === 0 ? (
          <div className="col-span-2 text-center text-[var(--text-secondary)]">No uploads yet</div>
        ) : (
          uploadRecords.map((r) => {
            const fullUrl = assetsClient.getFileUrl ? assetsClient.getFileUrl(r.url) : r.url;
            return (
              <div key={r.id} className="rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2 flex flex-col gap-2">
                <div className="text-xs text-[var(--text-secondary)] truncate">{r.filename}</div>
                <img src={fullUrl} alt={r.filename} className="w-full aspect-square object-contain rounded bg-[var(--bg-secondary)]" />
                <div className="grid grid-cols-2 gap-1">
                  <button onClick={() => onUseImage(fullUrl)} className="text-xs py-1 px-2 rounded bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)] text-[var(--text-primary)]">Use</button>
                  <button onClick={() => onDownload(fullUrl, r.filename)} className="text-xs py-1 px-2 rounded bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)] text-[var(--text-primary)]">Download</button>
                  <button onClick={() => onDeleteImage(r.id)} className="text-xs py-1 px-2 rounded bg-red-600/20 hover:bg-red-600/30 text-red-200 col-span-2">Delete</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AssetLibraryPanel;