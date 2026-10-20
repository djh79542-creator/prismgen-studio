import React, { useMemo } from 'react';
import { useTranslation } from '../i18n/provider';

interface CreditLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  entries: Array<{
    id: number;
    kind: string; // 0:充值 1:扣除 2:静帧生成 3:动态生成 4:返还
    delta: number;
    balanceBefore: number;
    balanceAfter: number;
    createdAt?: string;
  }>;
}

const Tabs = [
  { key: 'all', label: '全部' },
  { key: 'spend', label: '消费' },
  { key: 'gain', label: '获得' },
] as const;

type TabKey = typeof Tabs[number]['key'];

export const CreditLedgerModal: React.FC<CreditLedgerModalProps> = ({ isOpen, onClose, balance, entries }) => {
  const [activeTab, setActiveTab] = React.useState<TabKey>('all');
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [pageSize, setPageSize] = React.useState<number>(10);

  const safeEntries = Array.isArray(entries) ? entries : [];

  const SPEND_KINDS = new Set(['1', '2', '3']);
  const GAIN_KINDS = new Set(['0', '4']);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return safeEntries;
    return safeEntries.filter(item =>
      activeTab === 'spend' ? SPEND_KINDS.has(String(item.kind)) : GAIN_KINDS.has(String(item.kind))
    );
  }, [safeEntries, activeTab]);

  React.useEffect(() => {
    // 切换标签或数据变化时重置到第一页
    setCurrentPage(1);
  }, [activeTab, filtered.length]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((filtered?.length || 0) / pageSize));
  }, [filtered, pageSize]);

  const pageData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return (filtered || []).slice(start, end);
  }, [filtered, currentPage, pageSize]);

  if (!isOpen) return null;

  const formatDelta = (kind: string, delta: number) => `${SPEND_KINDS.has(kind) ? '-' : '+'}${delta}`;

  const kindLabel = (kind: string) => {
    switch (kind) {
      case '0': return t('credits.panel.labels.recharge');
      case '1': return t('credits.panel.labels.deduction');
      case '2': return t('credits.panel.labels.imageGen');
      case '3': return t('credits.panel.labels.videoGen');
      case '4': return t('credits.panel.labels.refund');
      default: return t('credits.panel.labels.changeDefault');
    }
  };

  const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4" onClick={onClose}>
      <div
          className="w-full max-w-2xl bg-[var(--bg-card)] text-[var(--text-primary)] rounded-xl shadow-xl border border-[var(--border-primary)]"
          onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <h2 className="text-xl font-bold text-[var(--accent-primary)]">{t('credits.panel.title')}</h2>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-[rgba(107,114,128,0.2)]"
                  aria-label={t('credits.panel.closeAriaLabel')}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"/>
            </svg>
          </button>
        </div>
        <div className="px-6 py-3 text-sm text-[var(--text-secondary)]">{t('credits.panel.remaining')} <span
            className="font-semibold text-[var(--accent-primary)]">{balance}</span></div>
        <div className="px-6">
          <div className="w-full mb-4">
            <div className="w-full p-1 bg-[var(--bg-secondary)] rounded-lg flex items-stretch gap-0">
              {Tabs.map((tab, i) => (
                  <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex-1 min-w-0 text-center px-5 py-2 text-sm font-semibold rounded-md ${i > 0 ? 'border-l border-[var(--border-primary)]' : ''} ${activeTab === tab.key ? 'text-[var(--accent-primary)] bg-[var(--bg-card)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                  >
                    {t(
                        tab.key === 'all' ? 'credits.panel.tabs.all' :
                            tab.key === 'spend' ? 'credits.panel.tabs.spend' :
                                'credits.panel.tabs.gain'
                    )}
                  </button>
              ))}
            </div>
          </div>
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2">
            {(!filtered || filtered.length === 0) ? (
                <div className="text-[var(--text-secondary)]">{t('credits.panel.empty')}</div>
            ) : pageData.map(item => (
                <div key={item.id}
                     className="flex items-start justify-between py-3 border-b border-[var(--border-primary)]">
                  <div>
                    <div className="text-sm font-semibold">{kindLabel(String(item.kind))}</div>
                    {item.createdAt && (
                        <div className="text-xs text-[var(--text-tertiary)] mt-1">
                          {formatDateTime(item.createdAt)}
                        </div>
                    )}
                  </div>
                  <div
                      className={`text-sm font-semibold ${SPEND_KINDS.has(String(item.kind)) ? 'text-gray-600' : 'text-[var(--accent-primary)]'}`}>{formatDelta(String(item.kind), item.delta)}</div>
                </div>
            ))}
          </div>
          {/* 分页栏 */}
          {filtered && filtered.length > 0 && (
              <div className="mt-4 flex items-center justify-between gap-3 text-sm w-full flex-nowrap overflow-x-auto">

                <div className="flex flex-col gap-3 flex-nowrap">
                  <div className="flex items-center gap-2 flex-nowrap">
                    <button
                        aria-label={t('credits.pager.firstAria')}
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-2 py-1 border border-[var(--border-primary)] rounded-md disabled:opacity-50"
                    >
                      ««
                    </button>
                    <button
                        aria-label={t('credits.pager.prevAria')}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2 py-1 border border-[var(--border-primary)] rounded-md disabled:opacity-50"
                    >
                      «
                    </button>
                    {/* 窗口式分页：保留首尾，当前页±2，其他省略号 */}
                    {(() => {
                      const window = 1;
                      const start = Math.max(2, currentPage - window);
                      const end = Math.min(totalPages - 1, currentPage + window);
                      const items: (number | 'ellipsis-left' | 'ellipsis-right')[] = [1];
                      if (start > 2) items.push('ellipsis-left');
                      for (let p = start; p <= end; p++) items.push(p);
                      if (end < totalPages - 1) items.push('ellipsis-right');
                      if (totalPages > 1) items.push(totalPages);

                      return items.map((it, idx) => {
                        if (typeof it === 'number') {
                          const isActive = it === currentPage;
                          return (
                              <button
                                  key={`p-${it}`}
                                  onClick={() => setCurrentPage(it)}
                                  className={`min-w-[2rem] px-2 py-1 border rounded-md flex-shrink-0 ${isActive ? 'bg-[#FF96AC] text-white border-[#FF96AC]' : 'border-[var(--border-primary)] text-[var(--text-primary)] bg-[var(--bg-card)]'}`}
                              >
                                {it}
                              </button>
                          );
                        }
                        return (
                            <span key={`e-${idx}`} className="px-2 py-1 text-[var(--text-secondary)]">…</span>
                        );
                      });
                    })()}
                    {/* 跳转至某一页 */}
                    <span className="text-[var(--text-secondary)] ml-2">跳至</span>
                    <input
                        type="number"
                        min={1}
                        max={totalPages}
                        placeholder={String(currentPage)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const v = Number((e.target as HTMLInputElement).value);
                            if (!Number.isNaN(v)) {
                              const clamped = Math.max(1, Math.min(totalPages, Math.floor(v)));
                              setCurrentPage(clamped);
                            }
                          }
                        }}
                        className="w-14 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-md px-2 py-1 text-[var(--text-primary)]"
                    />
                    <span className="text-[var(--text-secondary)]">页</span>
                    <button
                        aria-label={t('credits.pager.nextAria')}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 border border-[var(--border-primary)] rounded-md disabled:opacity-50"
                    >
                      »
                    </button>
                    <button
                        aria-label={t('credits.pager.lastAria')}
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 border border-[var(--border-primary)] rounded-md disabled:opacity-50"
                    >
                      »»
                    </button>
                  </div>

                </div>
              </div>
          )}
        </div>
        <div className="text-[var(--text-secondary)] flex ml-7 mr-8 mt-3 mb-3 text-xs">
          {t('credits.pager.totalPrefix')} {filtered.length} {t('credits.pager.totalSuffix')}
          <div className="ml-5 mt-[-1px]">
            <label className="text-[var(--text-secondary)]">
              {t('credits.pager.perPage')}
            </label>
            <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-md px-2  text-[var(--text-primary)]"
            >
              {[10, 20, 50].map(size => (
                  <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditLedgerModal;
