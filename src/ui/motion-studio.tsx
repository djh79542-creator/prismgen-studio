import React, { useState, useRef } from 'react';
import { useTranslation } from '../i18n/provider';
import SingleUploader from './single-upload';
import FailureNotice from './error-banner';
import { requestMotionJob, pollMotionJob } from '../clients/motion';
import { creditClient } from '../clients/credits';

interface Props {
  primaryImageUrl: string | null;
  onPrimarySelect: (file: File, dataUrl: string) => Promise<void> | void;
  onClearPrimary: () => void;
  onVideoGenerated: (videoUrl: string) => void;
  setLoading: (loading: boolean) => void;
  setLoadingMessage: (msgKey: string) => void;
  setError: (msg: string | null) => void;
  setBalance?: (balance: number) => void;
}

const ActionButton: React.FC<{ onClick: () => void; children: React.ReactNode; isPrimary?: boolean; disabled?: boolean; className?: string; style?: React.CSSProperties }> = ({ onClick, children, isPrimary, disabled, className, style }) => (
  <button
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      style={style}
      className={`flex-1 py-2 px-4 font-semibold rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center gap-2 ${
          isPrimary 
          ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-on-accent)] shadow-[var(--accent-shadow)] hover:from-[var(--accent-primary-hover)] hover:to-[var(--accent-secondary-hover)]' 
          : 'bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)] text-[var(--text-primary)]'
      } ${className}`}
  >
      {children}
  </button>
);
const MotionStudio: React.FC<Props> = ({
  primaryImageUrl,
  onPrimarySelect,
  onClearPrimary,
  onVideoGenerated,
  setLoading,
  setLoadingMessage,
  setError,
  setBalance,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<5 | 10>(5);
  const [generationId, setGenerationId] = useState<string | null>(null);
  // 防抖：防止快速点击导致重复扣分
  const isGuardRef = useRef<boolean>(false);
  const [isGuard, setIsGuard] = useState<boolean>(false);
  const isGenerateDisabled = isLoading || isGuard;


const handleGenerate = async () => {
  if (!primaryImageUrl) {
    setError(t('failure.unified'));
    return;
  }
  // 扣除视频生成额度：5s=4分，10s=8分；失败返还
  const cost = duration === 5 ? 4 : 8;
  // 防抖：立即设置防抖标记，避免重复扣分
  if (isGuardRef.current) {
    return;
  }
  isGuardRef.current = true;
  setIsGuard(true);
  // 在扣分流程中也展示生成中的 UI（按钮与结果缓冲）
  setError(null);
  setLoading(true);
  setIsLoading(true);
  setLoadingMessage('shell.loading.videoInit');
  try {
    const spendRes = await creditClient.consume(3, cost);
    if (!spendRes.success) {
      const msg = spendRes.code === 'INSUFFICIENT_CREDITS' ? '额度不足，无法生成，请先充值。' : (spendRes.error || '扣除失败');
      setError(msg);
      isGuardRef.current = false;
      setIsGuard(false);
      // 扣分失败，恢复 UI 状态
      setLoading(false);
      setIsLoading(false);
      setLoadingMessage('');
      return;
    }
    if (typeof spendRes.balance === 'number') {
      setBalance && setBalance(spendRes.balance);
    }
  } catch (e) {
    setError('扣除额度失败，请稍后重试');
    isGuardRef.current = false;
    setIsGuard(false);
    // 扣分异常，恢复 UI 状态
    setLoading(false);
    setIsLoading(false);
    setLoadingMessage('');
    return;
  }
  // 进入视频生成初始化（已在上方设置 loading），继续保持加载态
  try {
    const promptToUse = (prompt && prompt.trim().length > 0) ? prompt.trim() : t('motion.promptExample');
    const idResp = await requestMotionJob(primaryImageUrl, promptToUse, duration);
    setGenerationId(idResp.task_id);
    setLoadingMessage('shell.loading.videoPolling');
      // Poll every 10s until completed or 8 minutes timeout
      const start = Date.now();
      const timeoutMs = 5 * 60 * 1000;
      const poll = async () => {
        try {
          const status = await pollMotionJob(idResp.task_id);
          if (status.videoUrl) {
            setLoadingMessage('shell.loading.videoFetching');
            onVideoGenerated(status.videoUrl);
            setLoading(false);
            setIsLoading(false);
            // 清除防抖标记（成功生成）
            isGuardRef.current = false;
            setIsGuard(false);
            return;
          }
          // 超时结束
          if (Date.now() - start > timeoutMs) {
            setLoading(false);
            setIsLoading(false);
            setError(t('failure.unified'));
            try {
              const refundRes = await creditClient.restore(cost);
              if (refundRes.success && typeof refundRes.balance === 'number') {
                setBalance && setBalance(refundRes.balance);
              }
            } catch {}
            // 清除防抖标记
            isGuardRef.current = false;
            setIsGuard(false);
            return;
          }
          setTimeout(poll, 10000);
        } catch (e) {
          // 轮询过程中发生错误：停止加载、展示统一错误、返还额度、清除防抖
          setLoading(false);
          setIsLoading(false);
          setError(t('failure.unified'));
          try {
            const refundRes = await creditClient.restore(cost);
            if (refundRes.success && typeof refundRes.balance === 'number') {
              setBalance && setBalance(refundRes.balance);
            }
          } catch {}
          isGuardRef.current = false;
          setIsGuard(false);
        }
      };
    setTimeout(poll, 10000);
  } catch (e) {
    setLoading(false);
    setIsLoading(false);
    setError(t('failure.unified'));
    try {
      const refundRes = await creditClient.restore(cost);
      if (refundRes.success && typeof refundRes.balance === 'number') {
        setBalance && setBalance(refundRes.balance);
      }
    } catch {}
    // 清除防抖标记
    isGuardRef.current = false;
    setIsGuard(false);
  }
  // 成功情况下在视频生成完成时清除防抖标记
  // 注意：在 status.videoUrl 分支中已 return，故此处通过 onVideoGenerated 完成后清理
};


  return (
    <div>
      <div className="mb-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('motion.promptPlaceholder')}
          rows={3}
          className="w-full mt-2 p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] transition-colors placeholder-[var(--text-tertiary)] text-[var(--text-primary)]"
        />
      </div>

      <div className="mb-4">
        <div className="text-[var(--text-secondary)] mb-2">{t('motion.duration')}</div>
        <div className="flex gap-2">
          {[5, 10].map((d) => (
            <button
              key={d}
              className={`px-4 py-2 rounded-md border transition-colors duration-200 ${
                duration === d
                  ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-on-accent)] shadow-[var(--accent-shadow)] hover:from-[var(--accent-primary-hover)] hover:to-[var(--accent-secondary-hover)]'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[rgba(107,114,128,0.2)]'
              }`}
              onClick={() => setDuration(d as 5 | 10)}
            >
              {d}s
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="text-[var(--text-secondary)] mb-2">{t('motion.referenceImage')}</div>
        <SingleUploader onImageSelect={onPrimarySelect} initialImageUrl={primaryImageUrl} onClearImage={onClearPrimary} />
      </div>

      {primaryImageUrl ? (
        <ActionButton
          onClick={handleGenerate}
          disabled={isGenerateDisabled}
          isPrimary={!!primaryImageUrl && !isGenerateDisabled}
          className="w-full mt-6 py-3 px-4 border border-[var(--border-primary)] rounded-lg shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
          style={!primaryImageUrl || isGenerateDisabled ? { backgroundColor: 'var(--bg-card)' } : undefined}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-[var(--accent-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{t('shell.generating')}</span>
            </>
          ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0  18" fill="currentColor">
                  <path
                      d="M11.3 1.046a1 1 0 00-1.6 0L5.05 6.667a1 1 0 00.8 1.6H9l-2.3 6.287a1 1 0 001.6 1.085l6.652-8.2a1 1 0 00-.8-1.6H11l.3-4.793z"/>
                </svg>
                <span>{duration === 5 ? 4 : 8}</span>
                <span className="ml-2 font-bold">{t('shell.generateVideo')}</span>
              </>
          )}
        </ActionButton>
      ) : (
          <div
              className="w-full mt-6 py-3 px-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg flex items-center justify-center gap-2 text-[var(--text-secondary)]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0  18" fill="currentColor">
              <path
                  d="M11.3 1.046a1 1 0 00-1.6 0L5.05 6.667a1 1 0 00.8 1.6H9l-2.3 6.287a1 1 0 001.6 1.085l6.652-8.2a1 1 0 00-.8-1.6H11l.3-4.793z"/>
            </svg>
            <span>{duration === 5 ? 4 : 8}</span>
            <span className="ml-2 text-[var(--text-tertiary)] font-bold">{t('shell.generateVideo')}</span>
        </div>
      )}
    </div>
  );
};

export default MotionStudio;
