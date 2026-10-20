

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { PRESETS } from './presets';
import { editStill as remoteStillEdit } from '../clients/image-edit';
import { editStill as remotePaletteEdit, pollAsyncResult as remotePalettePoll } from '../clients/palette';
import type { RenderResult, Preset,AssetRecord } from './domain';
import PresetGallery from '../ui/preset-gallery';
import ResultViewer from '../ui/result-viewer';
import ProgressHint from '../ui/progress-hint';
import FailureNotice from '../ui/error-banner';
import MaskCanvas from '../ui/mask-canvas';
// Fix: Removed unused and non-existent 'fileToDataUrl' import.
import { dataUrlToBinary, applySteganogram, loadImage, scaleToReference, saveStill,originUrlToDataUrl } from '../toolkit/image-ops';
import { assetsClient } from '../clients/assets';
import PreviewOverlay from '../ui/preview-modal';
import DualUploader from '../ui/dual-upload';
import GalleryPanel from '../ui/gallery-panel';
import SignInCard from '../ui/sign-in-card';
import ConfirmOverlay from '../ui/confirm-dialog';
import LocaleToggle from '../ui/locale-toggle';
import MotionStudio from '../ui/motion-studio';
import ThemeToggle from '../ui/theme-toggle';
import AssetLibraryPanel from '../ui/asset-library-panel';
import UploadShell from '../ui/upload-shell';
import CreditLedgerModal from '../ui/credit-ledger-modal';
import { creditClient } from '../clients/credits';

import { PRISM_API_BASE_URL, signInRequest, bearerStore } from '../platform/api';
import { useTranslation } from '../i18n/provider';

type ActiveTool = 'mask' | 'none';

const Studio: React.FC = () => {
  const { t } = useTranslation();
  const [presets, setPresets] = useState<Preset[]>(() => {
    try {
      const savedOrder = localStorage.getItem('prism.presetOrder');
      if (savedOrder) {
        const orderedTitles = JSON.parse(savedOrder) as string[];
        const transformationMap = new Map(PRESETS.map(t => [t.titleKey, t]));

        const orderedPresets = orderedTitles
          .map(title => transformationMap.get(title))
          .filter((t): t is Preset => !!t);

        const savedTitlesSet = new Set(orderedTitles);
        const newPresets = PRESETS.filter(t => !savedTitlesSet.has(t.titleKey));

        return [...orderedPresets, ...newPresets];
      }
    } catch (e) {
      console.error("Failed to load or parse transformation order from localStorage", e);
    }
    return PRESETS;
  });

  const [activePreset, setSelectedPreset] = useState<Preset | null>(null);
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(null);
  const [primaryFile, setPrimaryFile] = useState<File | null>(null);
  const [secondaryImageUrl, setSecondaryImageUrl] = useState<string | null>(null);
  const [secondaryFile, setSecondaryFile] = useState<File | null>(null);
  const [generatedContent, setRenderResult] = useState<RenderResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [activeTool, setActiveTool] = useState<ActiveTool>('none');
  const [history, setHistory] = useState<RenderResult[]>([]);
  const [isGalleryPanelOpen, setIsGalleryPanelOpen] = useState<boolean>(false);
  const [uploadRecords, setAssetRecords] = useState<AssetRecord[]>([]);
  const [isAssetLibraryPanelOpen, setIsAssetLibraryPanelOpen] = useState(false);
  const [isAdminUnlockPanelOpen, setIsAdminUnlockPanelOpen] = useState(false);
  const [isUploadShellOpen, setIsUploadShellOpen] = useState(() => {
    // Check URL parameter for isShowUpload
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('isShowUpload') === 'true';
    }
    return false;
  });
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  // 防抖：防止快速点击导致重复扣分
  const [isGenerateGuard, setIsGenerateGuard] = useState<boolean>(false);
  const generateGuardRef = useRef<boolean>(false);
  // 局部重新生成时，仅标记目标框的加载状态
  const [regeneratingTarget, setRegeneratingTarget] = useState<'primary' | 'secondary' | null>(null);

  const [isConfirmOverlayOpen, setIsConfirmOverlayOpen] = useState<boolean>(false);
  const [confirmDialogConfig, setConfirmOverlayConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // 额度相关状态
  const [creditBalance, setCreditBalance] = useState<number>();
  const [isPointsModalOpen, setIsPointsModalOpen] = useState<boolean>(false);
  const [creditEntries, setCreditEntries] = useState<any[]>([]);

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

  // 登录相关状态
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    // 检查localStorage中是否有登录状态和有效的token
    if (typeof window !== 'undefined') {
      const hasLoginState = localStorage.getItem('prism.session.active') === 'true';
      const hasValidToken = bearerStore.hasToken();
      return hasLoginState && hasValidToken;
    }
    return false;
  });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoginLoading, setIsLoginLoading] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('prism.session.account');
    }
    return null;
  });



  useEffect(() => {
    try {
      const orderToSave = presets.map(t => t.title);
      localStorage.setItem('prism.presetOrder', JSON.stringify(orderToSave));
    } catch (e) {
      console.error("Failed to save transformation order to localStorage", e);
    }
  }, [presets]);

  // Function to refresh upload records
  const refreshAssetRecords = useCallback(async () => {
    // Only make API call if user is logged in and has valid token
    if (!isLoggedIn || !bearerStore.hasToken()) {
      return;
    }

    try {
      const response = await assetsClient.getUploadedFiles();
      setAssetRecords(response.files);
    } catch (error) {
      console.error('Failed to load uploaded files:', error);
    }
  }, [isLoggedIn]);

  // Function to load history files
  const loadHistoryFiles = useCallback(async () => {
    // Only make API call if user is logged in and has valid token
    if (!isLoggedIn || !bearerStore.hasToken()) {
      return;
    }

    try {
      const result = await assetsClient.getHistoryFiles();
      if (result.success && result.files) {
        const historyItems: RenderResult[] = result.files.map(file => ({
          imageUrl: file.imageUrl, // 已经是完整路径，不需要拼接
          text: `Saved from history - ${file.filename}`,
          id: file.id,
          type: file.type,
          timestamp: file.timestamp,
          filename: file.filename
        }));
        setHistory(prev => {
          // Merge with existing history, avoiding duplicates
          const existingIds = new Set(prev.map((item: any) => item.id));
          const newItems = historyItems.filter((item: any) => !existingIds.has(item.id));
          return [...newItems, ...prev];
        });
      }
    } catch (error) {
      console.error('Failed to load history files:', error);
    }
  }, [isLoggedIn]);

  // 登录验证函数
  const handleLogin = useCallback(async (username: string, password: string) => {
    setIsLoginLoading(true);
    setLoginError(null);

    try {
      const result = await signInRequest(username, password);

      if (result.success && result.token) {
        setIsLoggedIn(true);
        setCurrentUser(result.user.username);
        localStorage.setItem('prism.session.active', 'true');
        localStorage.setItem('prism.session.account', result.user.username);
        setLoginError(null);
      } else {
        setLoginError('登录失败，请重试');
      }
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : '登录失败，请重试');
    } finally {
      setIsLoginLoading(false);
    }
  }, []);

  // 登出函数
  const handleLogout = useCallback(() => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    localStorage.removeItem('prism.session.active');
    localStorage.removeItem('prism.session.account');
    bearerStore.removeToken(); // 清除JWT token

    // 清理用户数据缓存
    setHistory([]);
    setAssetRecords([]);
    setCreditBalance();
    setCreditEntries([]);

    // 刷新当前页面
    window.location.reload();
  }, []);

  // Load uploaded files and history on component mount (only when logged in and token exists)
  useEffect(() => {
    if (isLoggedIn && bearerStore.hasToken()) {
      refreshAssetRecords();
      loadHistoryFiles();
      // 获取额度余额
      creditClient.getBalance().then(res => {
        if (res.success && typeof res.balance === 'number') {
          setCreditBalance(res.balance);
        }
      }).catch(() => {});
    }
  }, [isLoggedIn, refreshAssetRecords, loadHistoryFiles]);


  // Listen for token expiration events
  useEffect(() => {
    const handleTokenExpired = () => {
      console.log('Token expired, logging out user');
      setIsLoggedIn(false);
      setCurrentUser(null);
      setLoginError('登录已过期，请重新登录');

      // 清理用户数据缓存
      setHistory([]);
      setAssetRecords([]);
    };

    // 添加事件监听器
    window.addEventListener('prism:session-expired', handleTokenExpired);

    // 清理函数
    return () => {
      window.removeEventListener('prism:session-expired', handleTokenExpired);
    };
  }, []);

  // Polling effect for upload records when panel is open (only when logged in)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isAssetLibraryPanelOpen && isLoggedIn) {
      // Start polling every 3 seconds
      interval = setInterval(() => {
        refreshAssetRecords();
      }, 3000);
      setPollingInterval(interval);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
      setPollingInterval(null);
    };
  }, [isAssetLibraryPanelOpen, isLoggedIn, refreshAssetRecords]);

  // Cleanup polling interval on component unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  const addAssetRecord = useCallback(async (file: File, imageUrl: string) => {
    try {
      // Upload file to server
      const uploadResult = await assetsClient.uploadFile(file);

      if (uploadResult.success && uploadResult.file) {
        const newRecord: AssetRecord = {
          id: uploadResult.file.id,
          filename: uploadResult.file.filename,
          url: uploadResult.file.url,
          size: uploadResult.file.size,
          uploadTime: uploadResult.file.uploadTime,
          type: uploadResult.file.type
        };

        // Get image dimensions if possible
        const img = new Image();
        img.onload = () => {
          newRecord.dimensions = {
            width: img.width,
            height: img.height
          };
          setAssetRecords(prev => [newRecord, ...prev]);
        };
        img.onerror = () => {
          // Add record without dimensions if image load fails
          setAssetRecords(prev => [newRecord, ...prev]);
        };
        img.src = assetsClient.getFileUrl(uploadResult.file.url);
      } else {
        console.error('Upload failed:', uploadResult.error);
        // Fallback to local record if upload fails
        const fallbackRecord: AssetRecord = {
          id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          filename: file.name,
          url: imageUrl,
          size: file.size,
          uploadTime: new Date().toISOString(),
          type: file.type.split('/')[1] || 'unknown'
        };
        setAssetRecords(prev => [fallbackRecord, ...prev]);
      }
    } catch (error) {
      console.error('Upload error:', error);
      // Fallback to local record if upload fails
      const fallbackRecord: AssetRecord = {
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        filename: file.name,
        url: imageUrl,
        size: file.size,
        uploadTime: new Date().toISOString(),
        type: file.type.split('/')[1] || 'unknown'
      };
      setAssetRecords(prev => [fallbackRecord, ...prev]);
    }
  }, []);

  const handleSelectPreset = (transformation: Preset) => {
    setSelectedPreset(transformation);
    setRenderResult(null);
    setError(null);
    if (transformation.prompt !== 'CUSTOM') {
      setCustomPrompt('');
    }
  };

  const handlePrimaryImageSelect = useCallback(async (file: File, dataUrl: string) => {
    setPrimaryFile(file);
    setPrimaryImageUrl(dataUrl);
    setRenderResult(null);
    setError(null);
    setMaskDataUrl(null);
    setActiveTool('none');
    await addAssetRecord(file, dataUrl);
  }, [addAssetRecord]);

  const handleSecondaryImageSelect = useCallback(async (file: File, dataUrl: string) => {
    setSecondaryFile(file);
    setSecondaryImageUrl(dataUrl);
    setRenderResult(null);
    setError(null);
    await addAssetRecord(file, dataUrl);
  }, [addAssetRecord]);

  const handleClearPrimaryImage = () => {
    setPrimaryImageUrl(null);
    setPrimaryFile(null);
    setRenderResult(null);
    setError(null);
    setMaskDataUrl(null);
    setActiveTool('none');
  };

  const handleClearSecondaryImage = () => {
    setSecondaryImageUrl(null);
    setSecondaryFile(null);
  };

  const handleGenerate = useCallback(async () => {
    if (!activePreset) {
        setError(t('shell.error.uploadAndSelect'));
        return;
    }

    // 图片校验：在“自定义提示词”模块允许纯文字生成，其他非 promptOnly 仍需校验图片
    const imageRequired = !activePreset.promptOnly && activePreset.key !== 'freeform';
    if (imageRequired) {
        if (!primaryImageUrl) {
            setError(t('shell.error.uploadAndSelect'));
            return;
        }
        if (activePreset.isMultiImage && !activePreset.isSecondaryOptional && !secondaryImageUrl) {
            setError(t('shell.error.uploadBoth'));
            return;
        }
    }

    const promptToUse = activePreset.prompt === 'CUSTOM' ? customPrompt : activePreset.prompt;
    if (!promptToUse.trim()) {
        setError(t('shell.error.enterPrompt'));
        return;
    }

    // 扣除额度：单模型预扣1分；双模型/两步流程预扣2分，按成功个数结算返还
    // 防抖：立即设置防抖标记，避免重复扣分
    if (generateGuardRef.current) {
      return;
    }
    generateGuardRef.current = true;
    setIsGenerateGuard(true);
    // 在扣分流程中也展示生成中的 UI（按钮与结果缓冲）
    setIsLoading(true);
    setError(null);
    setRenderResult(null);
    setLoadingMessage('shell.loading.default');
    try {
      const initialCharge = (activePreset.isDoubleModel || activePreset.isTwoStep) ? 2 : 1;
      const spendRes = await creditClient.consume(2, initialCharge);
      if (!spendRes.success) {
        const msg = spendRes.code === 'INSUFFICIENT_CREDITS' ? '额度不足，无法生成，请先充值。' : (spendRes.error || '扣除失败');
        setError(msg);
        // 扣分失败，恢复 UI 状态
        setIsLoading(false);
        setLoadingMessage('');
        generateGuardRef.current = false;
        setIsGenerateGuard(false);
        return;
      }
      if (typeof spendRes.balance === 'number') {
        setCreditBalance(spendRes.balance);
      }
    } catch (e) {
      setError('扣除额度失败，请稍后重试');
      // 扣分异常，恢复 UI 状态
      setIsLoading(false);
      setLoadingMessage('');
      generateGuardRef.current = false;
      setIsGenerateGuard(false);
      return;
    }

    // 进入真实生成流程，保持加载状态；具体步骤中会更新 loadingMessage
    setLoadingMessage('');

    let successCount = 0;
    try {
        // For promptOnly mode, we don't have image data
        const primaryMimeType = primaryImageUrl ? primaryImageUrl.split(';')[0].split(':')[1] ?? 'image/png' : null;
        const primaryBase64 = primaryImageUrl ? primaryImageUrl.split(',')[1] : null;
        const maskBase64 = maskDataUrl ? maskDataUrl.split(',')[1] : null;

        if (activePreset.isTwoStep) {
            // Step 1: Generate line art (using only the primary image)
            setLoadingMessage('shell.loading.step1');
            const stepOneResult = await remoteStillEdit(
                primaryBase64,
                primaryMimeType,
                promptToUse, // First prompt
                null, // No mask for step 1
                null  // No secondary image for step 1
            );

            if (!stepOneResult.imageUrl) {
                throw new Error("Step 1 (line art) failed to generate an image.");
            }

            // Step 2: Color the line art using the palette
            setLoadingMessage('shell.loading.step2');
            const stepOneImageBase64 = stepOneResult.imageUrl.split(',')[1];
            const stepOneImageMimeType = stepOneResult.imageUrl.split(';')[0].split(':')[1] ?? 'image/png';

            let secondaryImagePayload = null;
            if (activePreset.isMultiImage && secondaryImageUrl && primaryImageUrl) {
                // Load primary image to get its dimensions
                const primaryImage = await loadImage(primaryImageUrl);
                // Resize color palette to match primary image's aspect ratio
                const resizedSecondaryImageUrl = await scaleToReference(secondaryImageUrl, primaryImage);

                const secondaryMimeType = resizedSecondaryImageUrl.split(';')[0].split(':')[1] ?? 'image/png';
                const secondaryBase64 = resizedSecondaryImageUrl.split(',')[1];
                secondaryImagePayload = { base64: secondaryBase64, mimeType: secondaryMimeType };
            }

            const stepTwoResult = await remotePaletteEdit(
                stepOneImageBase64,
                stepOneImageMimeType,
                activePreset.stepTwoPrompt!, // Second prompt
                null, // No mask for step 2
                // secondaryImagePayload // Use the RESIZED color palette here
            );

            if (stepTwoResult.imageUrl) {
                stepTwoResult.imageUrl = await applySteganogram(stepTwoResult.imageUrl, "PrismGen 影像工坊");
            }

            const finalResult = {
                imageUrl: stepTwoResult.imageUrl,
                text: stepTwoResult.text,
                secondaryImageUrl: stepOneResult.imageUrl, // Store intermediate result
            };
            setRenderResult(finalResult);
            successCount = (stepOneResult.imageUrl ? 1 : 0) + (stepTwoResult.imageUrl ? 1 : 0);
            setHistory(prev => [finalResult, ...prev]);

        } else { // Single-step generation
             let secondaryImagePayload = null;
            if (activePreset.isMultiImage && secondaryImageUrl) {
                const secondaryMimeType = secondaryImageUrl.split(';')[0].split(':')[1] ?? 'image/png';
                const secondaryBase64 = secondaryImageUrl.split(',')[1];
                secondaryImagePayload = { base64: secondaryBase64, mimeType: secondaryMimeType };
            }
            setLoadingMessage('shell.loading.default');
            // If this transformation expects dual-model output, call Palette and ModelHub
            if (activePreset.isDoubleModel) {
                setLoadingMessage('shell.loading.default');
                const palettePromise = remotePaletteEdit(
                    primaryBase64,
                    primaryMimeType,
                    promptToUse,
                    secondaryImagePayload || undefined
                );
                const stillPromise = remoteStillEdit(
                    primaryBase64,
                    primaryMimeType,
                    promptToUse,
                    maskBase64,
                    secondaryImagePayload || undefined
                );

                const [paletteRes, stillRes] = await Promise.allSettled([palettePromise, stillPromise]);
                const paletteImageUrl = paletteRes.status === 'fulfilled' ? paletteRes.value.imageUrl : null;
                const stillImageUrl = stillRes.status === 'fulfilled' ? stillRes.value.imageUrl : null;

                const finalPrimaryUrl = paletteImageUrl ? await applySteganogram(paletteImageUrl, "PrismGen 影像工坊") : null;
                const finalSecondaryUrl = stillImageUrl ? await applySteganogram(stillImageUrl, "PrismGen 影像工坊") : null;

                const combinedResult: RenderResult = {
                    imageUrl: finalPrimaryUrl,
                    secondaryImageUrl: finalSecondaryUrl,
                    text: null,
                    primaryLabel: '图1 · 色板重绘',
                    secondaryLabel: '图2 · 快绘模型'
                };
                setRenderResult(combinedResult);
                successCount = (finalPrimaryUrl ? 1 : 0) + (finalSecondaryUrl ? 1 : 0);
                setHistory(prev => [combinedResult, ...prev]);
            } else {
            const result = await remoteStillEdit(
                primaryBase64,
                primaryMimeType,
                promptToUse,
                maskBase64,
                secondaryImagePayload
            );

            if (result.imageUrl) {
                result.imageUrl = await applySteganogram(result.imageUrl, "PrismGen 影像工坊");
            }

            setRenderResult(result);
            successCount = result.imageUrl ? 1 : 0;
            setHistory(prev => [result, ...prev]);
            }
        }
    } catch (err) {
      console.error(err);
      setError(t('failure.unified'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
      try {
        const initialCharge = (activePreset.isDoubleModel || activePreset.isTwoStep) ? 2 : 1;
        const refundAmount = Math.max(0, initialCharge - successCount);
        if (refundAmount > 0) {
          const refundRes = await creditClient.restore(refundAmount);
          if (refundRes.success && typeof refundRes.balance === 'number') {
            setCreditBalance(refundRes.balance);
          }
        }
      } catch {}
      // 清除防抖标记
      generateGuardRef.current = false;
      setIsGenerateGuard(false);
    }
  }, [primaryImageUrl, secondaryImageUrl, activePreset, maskDataUrl, customPrompt, presets]);

  // 仅重新生成失败的模型：target 为 'primary'（最终图/色板引擎）或 'secondary'（另一模型/ModelHub 或两步的线稿）
  const handleRegenerate = useCallback(async (target: 'primary' | 'secondary') => {
    if (!generatedContent) return;
    if (!activePreset) return;

    // 防抖：避免并发重复触发
    if (generateGuardRef.current) {
      return;
    }
    generateGuardRef.current = true;
    setIsGenerateGuard(true);

    try {
      // 单次局部重试仅按 1 分计费
      const spendRes = await creditClient.consume(2, 1);
      if (!spendRes.success) {
        const msg = spendRes.code === 'INSUFFICIENT_CREDITS' ? '额度不足，无法生成，请先充值。' : (spendRes.error || '扣除失败');
        setError(msg);
        return;
      }
      if (typeof spendRes.balance === 'number') {
        setCreditBalance(spendRes.balance);
      }
    } catch (e) {
      setError('扣除额度失败，请稍后重试');
      return;
    } finally {
      // 若下面逻辑抛错，会在 finally 的第二段再清除 guard
    }

    // 局部加载：不触发全局 loading，只标记目标框
    setError(null);
    setRegeneratingTarget(target);

    let successCount = 0;
    try {
      const primaryMimeType = primaryImageUrl ? primaryImageUrl.split(';')[0].split(':')[1] ?? 'image/png' : null;
      const primaryBase64 = primaryImageUrl ? primaryImageUrl.split(',')[1] : null;
      const maskBase64 = maskDataUrl ? maskDataUrl.split(',')[1] : null;

      let secondaryImagePayload: { base64: string; mimeType: string } | null = null;
      if (activePreset.isMultiImage && secondaryImageUrl) {
        const secondaryMimeType = secondaryImageUrl.split(';')[0].split(':')[1] ?? 'image/png';
        const secondaryBase64 = secondaryImageUrl.split(',')[1];
        secondaryImagePayload = { base64: secondaryBase64, mimeType: secondaryMimeType };
      }

      if (activePreset.isDoubleModel) {
        if (target === 'primary') {
          // 仅重新生成色板引擎（主图）
          const paletteRes = await remotePaletteEdit(
            primaryBase64,
            primaryMimeType,
            activePreset.prompt === 'CUSTOM' ? customPrompt : activePreset.prompt,
            secondaryImagePayload || undefined
          );
          const finalPrimaryUrl = paletteRes.imageUrl ? await applySteganogram(paletteRes.imageUrl, "PrismGen 影像工坊") : null;
          setRenderResult(prev => ({
            imageUrl: finalPrimaryUrl,
            secondaryImageUrl: prev?.secondaryImageUrl ?? null,
            text: prev?.text ?? null,
            primaryLabel: prev?.primaryLabel ?? '图1 · 色板重绘',
            secondaryLabel: prev?.secondaryLabel ?? '图2 · 快绘模型'
          } as any));
          successCount = finalPrimaryUrl ? 1 : 0;
        } else {
          // 仅重新生成 ModelHub（副图）
          const stillRes = await remoteStillEdit(
            primaryBase64,
            primaryMimeType,
            activePreset.prompt === 'CUSTOM' ? customPrompt : activePreset.prompt,
            maskBase64,
            secondaryImagePayload || undefined
          );
          const finalSecondaryUrl = stillRes.imageUrl ? await applySteganogram(stillRes.imageUrl, "PrismGen 影像工坊") : null;
          setRenderResult(prev => ({
            imageUrl: prev?.imageUrl ?? null,
            secondaryImageUrl: finalSecondaryUrl,
            text: prev?.text ?? null,
            primaryLabel: prev?.primaryLabel ?? '图1 · 色板重绘',
            secondaryLabel: prev?.secondaryLabel ?? '图2 · 快绘模型'
          } as any));
          successCount = finalSecondaryUrl ? 1 : 0;
        }
      } else if (activePreset.isTwoStep) {
        // 两步流程：secondary 表示线稿，primary 表示上色
        if (target === 'secondary') {
          const stepOneRes = await remoteStillEdit(
            primaryBase64,
            primaryMimeType,
            activePreset.prompt === 'CUSTOM' ? customPrompt : activePreset.prompt,
            null,
            null
          );
          const lineArtUrl = stepOneRes.imageUrl || null;
          setRenderResult(prev => ({
            imageUrl: prev?.imageUrl ?? null,
            secondaryImageUrl: lineArtUrl,
            text: prev?.text ?? null
          } as any));
          successCount = lineArtUrl ? 1 : 0;
        } else {
          // 重新生成最终图：基于现有线稿（secondaryImageUrl）
          const lineArtDataUrl = generatedContent.secondaryImageUrl || null;
          if (!lineArtDataUrl) {
            throw new Error('缺少线稿，无法重新生成最终图');
          }
          const stepOneImageBase64 = lineArtDataUrl.split(',')[1];
          const stepOneImageMimeType = lineArtDataUrl.split(';')[0].split(':')[1] ?? 'image/png';
          const stepTwoRes = await remotePaletteEdit(
            stepOneImageBase64,
            stepOneImageMimeType,
            activePreset.stepTwoPrompt!,
            null
          );
          const finalUrl = stepTwoRes.imageUrl ? await applySteganogram(stepTwoRes.imageUrl, "PrismGen 影像工坊") : null;
          setRenderResult(prev => ({
            imageUrl: finalUrl,
            secondaryImageUrl: prev?.secondaryImageUrl ?? null,
            text: prev?.text ?? null
          } as any));
          successCount = finalUrl ? 1 : 0;
        }
      } else {
        // 单模型：按目标等同于重新生成当前结果
        const res = await remoteStillEdit(
          primaryBase64,
          primaryMimeType,
          activePreset.prompt === 'CUSTOM' ? customPrompt : activePreset.prompt,
          maskBase64,
          secondaryImagePayload || undefined
        );
        const finalUrl = res.imageUrl ? await applySteganogram(res.imageUrl, "PrismGen 影像工坊") : null;
        setRenderResult(prev => ({
          imageUrl: finalUrl,
          secondaryImageUrl: null,
          text: res.text ?? prev?.text ?? null
        } as any));
        successCount = finalUrl ? 1 : 0;
      }
    } catch (err) {
      console.error(err);
      setError(t('failure.unified'));
    } finally {
      try {
        const refundAmount = Math.max(0, 1 - successCount);
        if (refundAmount > 0) {
          const refundRes = await creditClient.restore(refundAmount);
          if (refundRes.success && typeof refundRes.balance === 'number') {
            setCreditBalance(refundRes.balance);
          }
        }
      } catch {}
      setRegeneratingTarget(null);
      generateGuardRef.current = false;
      setIsGenerateGuard(false);
    }
  }, [generatedContent, activePreset, primaryImageUrl, secondaryImageUrl, maskDataUrl, customPrompt]);


  const handleUseImageAsInput = useCallback(async (imageUrl: string) => {
    if (!imageUrl) return;

    try {
      let dataUrl = imageUrl;

      // Check if the imageUrl is a server URL (starts with http) and convert to data URL
      if (imageUrl.startsWith('http')) {
        dataUrl = await originUrlToDataUrl(imageUrl);
      }

      const newFile = await dataUrlToBinary(dataUrl, `edited-${Date.now()}.png`);
      setPrimaryFile(newFile);
      setPrimaryImageUrl(dataUrl);
      setRenderResult(null);
      setError(null);
      setMaskDataUrl(null);
      setActiveTool('none');
      setSecondaryFile(null);
      setSecondaryImageUrl(null);
    } catch (err) {
      console.error("Failed to use image as input:", err);
      setError("Could not use the generated image as a new input.");
    }
  }, []);

  const toggleGalleryPanel = () => setIsGalleryPanelOpen(prev => !prev);

  const handleUseHistoryImageAsInput = (imageUrl: string) => {
      handleUseImageAsInput(imageUrl);
      setIsGalleryPanelOpen(false);
  };

  const handleDownloadFromHistory = async (imageUrl: string, fileName: string) => {
    try {
      // Check if the URL is a data URL
      if (imageUrl.startsWith('data:')) {
        saveStill(imageUrl, fileName);
      } else {
        // For server URLs, convert to data URL first to ensure download works
        const dataUrl = await originUrlToDataUrl(imageUrl);
        saveStill(dataUrl, fileName);
      }
    } catch (error) {
      console.error('Failed to download image:', error);
      // Fallback to direct download
      saveStill(imageUrl, fileName);
    }
  };

  const handleDeleteHistoryItem = async (index: number) => {
    try {
      const item = history[index];
      if (item && item.filename) {
        // Use the actual filename from the history item
        const filename = item.filename;

        // Delete from server (history directory)
        const result = await assetsClient.deleteFile(filename, 'outputs');
        if (result.success) {
          // Remove from state only if server deletion was successful
          setHistory(prev => prev.filter((_, i) => i !== index));
        } else {
          setError(result.error || 'Failed to delete history item.');
        }
      } else {
        // If no filename, just remove from state (for items not saved to server)
        setHistory(prev => prev.filter((_, i) => i !== index));
      }
    } catch (error) {
      console.error('Failed to delete history item:', error);
      setError('Failed to delete the history item. Please try again.');
    }
  };

  const handleClearHistory = async () => {
    try {
      // Delete all history items from server
      const deletePromises = history
        .filter(item => item.filename) // Only delete items that have a filename (saved to server)
        .map(item => assetsClient.deleteFile(item.filename!, 'outputs'));

      if (deletePromises.length > 0) {
        const results = await Promise.all(deletePromises);
        const failedDeletes = results.filter(result => !result.success);

        if (failedDeletes.length > 0) {
          setError(`Failed to delete ${failedDeletes.length} history item(s) from server.`);
        }
      }

      // Clear from state regardless of server deletion results
      setHistory([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
      setError('Failed to clear history. Please try again.');
      // Still clear from state even if server deletion failed
      setHistory([]);
    }
  };

  const toggleAssetLibraryPanel = async () => {
    const newState = !isAssetLibraryPanelOpen;
    setIsAssetLibraryPanelOpen(newState);

    // Refresh records when opening the panel
    if (newState) {
      await refreshAssetRecords();
    }
  };

  const toggleUploadShell = () => {
    setIsUploadShellOpen(!isUploadShellOpen);
  };

  const openPointsModal = async () => {
    try {
      setIsPointsModalOpen(true);
      const [balanceRes, txRes] = await Promise.all([
        creditClient.getBalance(),
        creditClient.listEntries()
      ]);
      if (balanceRes.success && typeof balanceRes.balance === 'number') {
        setCreditBalance(balanceRes.balance);
      }
      if (txRes.success && Array.isArray(txRes.list)) {
        setCreditEntries(txRes.list);
      }
    } catch (err) {
      console.error('Failed to load credit balance:', err);
      // 保持弹窗打开，让用户看到当前余额（可能为0）与“暂无记录”
    }
  };
  const closePointsModal = () => setIsPointsModalOpen(false);

  const handleUseAssetRecordImageAsInput = async (imageUrl: string) => {
    try {
      // Convert server URL to data URL first
      const dataUrl = await originUrlToDataUrl(imageUrl);
      handleUseImageAsInput(dataUrl);
      setIsAssetLibraryPanelOpen(false);
    } catch (error) {
      console.error('Failed to load image from upload record:', error);
      setError('Failed to load the selected image. Please try again.');
    }
  };

  const handleDeleteAssetRecord = async (recordId: string) => {
    try {
      // Find the record to get the filename
      const record = uploadRecords.find(r => r.id === recordId);
      if (!record) {
        setError('Record not found.');
        return;
      }

      // Delete from server
      const result = await assetsClient.deleteFile(record.filename);
      if (result.success) {
        // Refresh the upload records list
        await refreshAssetRecords();
      } else {
        setError(result.error || 'Failed to delete image.');
      }
    } catch (error) {
      console.error('Failed to delete upload record:', error);
      setError('Failed to delete the image. Please try again.');
    }
  };

  const handleClearAllAssetRecords = async () => {
    setConfirmOverlayConfig({
      title: '清空上传记录',
      message: '确定要清空所有上传记录吗？此操作无法撤销。',
      onConfirm: async () => {
        try {
          // Delete all records one by one
          const deletePromises = uploadRecords.map(record =>
            assetsClient.deleteFile(record.filename)
          );

          const results = await Promise.all(deletePromises);
          const failedDeletes = results.filter(result => !result.success);

          if (failedDeletes.length > 0) {
            setError(`Failed to delete ${failedDeletes.length} image(s).`);
          }

          // Refresh the upload records list
          await refreshAssetRecords();
        } catch (error) {
          console.error('Failed to clear all upload records:', error);
          setError('Failed to clear all images. Please try again.');
        }
      }
    });
    setIsConfirmOverlayOpen(true);
  };

  const handleStoreToHistory = useCallback((content: RenderResult) => {
    const historyItem = {
      ...content,
      id: Date.now().toString(),
      type: 'generated' as const,
      timestamp: Date.now(),
      filename: `generated_${Date.now()}.png`
    };
    setHistory(prev => [historyItem, ...prev]);

    // Save to localStorage
    const updatedHistory = [historyItem, ...history];
    localStorage.setItem('prism.gallery', JSON.stringify(updatedHistory));
  }, [history]);

  const handleDownloadFromAssetRecord = (imageUrl: string, fileName: string) => {
      saveStill(imageUrl, fileName);
  };



  const handleBackToSelection = () => {
    setSelectedPreset(null);
  };

  const handleResetApp = () => {
    setSelectedPreset(null);
    setPrimaryImageUrl(null);
    setPrimaryFile(null);
    setSecondaryImageUrl(null);
    setSecondaryFile(null);
    setRenderResult(null);
    setError(null);
    setIsLoading(false);
    setMaskDataUrl(null);
    setCustomPrompt('');
    setActiveTool('none');
    // Don't clear history on reset
  };

  const handleOpenPreview = (url: string) => setPreviewImageUrl(url);
  const handleClosePreview = () => setPreviewImageUrl(null);

  const toggleMaskTool = () => {
    setActiveTool(current => (current === 'mask' ? 'none' : 'mask'));
  };

  const isCustomPromptEmpty = activePreset?.prompt === 'CUSTOM' && !customPrompt.trim();
  const isSingleImageReady = !activePreset?.isMultiImage && !!primaryImageUrl;
  const isMultiImageReady = activePreset?.isMultiImage && !!primaryImageUrl && (activePreset?.isSecondaryOptional ? true : !!secondaryImageUrl);
  // 在“自定义提示词”模块，允许纯文字生成（即使未设置 promptOnly）
  const treatAsPromptOnly = !!activePreset && (activePreset.promptOnly || activePreset.key === 'freeform');
  const isPromptOnlyReady = treatAsPromptOnly && (activePreset.prompt !== 'CUSTOM' || customPrompt.trim());
  const isGenerateDisabled = isLoading || isGenerateGuard || isCustomPromptEmpty || (!isSingleImageReady && !isMultiImageReady && !isPromptOnlyReady);


  // 如果未登录，显示登录界面
  if (!isLoggedIn) {
    return (
      <SignInCard
        onLogin={handleLogin}
        error={loginError}
        isLoading={isLoginLoading}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans relative">
      <header className="bg-[var(--bg-card-alpha)] backdrop-blur-lg sticky top-0 z-20 p-4 border-b border-[var(--border-primary)]">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] cursor-pointer truncate" onClick={handleResetApp}>
            <span className="hidden sm:inline">{t('shell.title')}</span>
            <span className="sm:hidden">PrismGen</span>
          </h1>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {/* 额度余额按钮 */}
            <button
              onClick={openPointsModal}
              className="flex items-center gap-2 py-2 px-3 text-sm font-semibold text-[var(--text-primary)] bg-[rgba(234,88,12,0.15)] rounded-md hover:bg-[rgba(234,88,12,0.25)] transition-colors duration-200"
              aria-label="Show credits"
              title="额度"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11.3 1.046a1 1 0 00-1.6 0L5.05 6.667a1 1 0 00.8 1.6H9l-2.3 6.287a1 1 0 001.6 1.085l6.652-8.2a1 1 0 00-.8-1.6H11l.3-4.793z" />
              </svg>
              <span>{creditBalance}</span>
            </button>
            {/* 用户信息和登出按钮 */}
            {currentUser && (
              <div className="flex items-center gap-2 mr-4">
                <span className="text-sm text-gray-400">欢迎, {currentUser}</span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 py-1 px-2 text-xs font-medium text-gray-500 rounded hover:bg-gray-100 transition-colors duration-200"
                  title="登出"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                  登出
                </button>
              </div>
            )}
            <button
              onClick={toggleGalleryPanel}
              className="flex items-center gap-2 py-2 px-3 text-sm font-semibold text-[var(--text-primary)] bg-[rgba(107,114,128,0.2)] rounded-md hover:bg-[rgba(107,114,128,0.4)] transition-colors duration-200"
              aria-label="Toggle generation history"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span>{t('shell.logButton')}</span>
            </button>
            <ThemeToggle />
            <LocaleToggle />
          </div>


          {/* Mobile Navigation - Icon Only */}
          <div className="flex md:hidden items-center gap-1">
            <button
              onClick={openPointsModal}
              className="p-2 text-gray-200 bg-orange-600/80 rounded-md hover:bg-orange-600 transition-colors duration-200"
              aria-label="Show credits"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11.3 1.046a1 1 0 00-1.6 0L5.05 6.667a1 1 0 00.8 1.6H9l-2.3 6.287a1 1 0 001.6 1.085l6.652-8.2a1 1 0 00-.8-1.6H11l.3-4.793z" />
              </svg>
            </button>
            <button
              onClick={toggleGalleryPanel}
              className="p-2 text-gray-200 bg-gray-800/50 rounded-md hover:bg-gray-700/50 transition-colors duration-200"
              aria-label="Toggle generation history"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </button>
            <button
               onClick={toggleAssetLibraryPanel}
               className="p-2 text-gray-200 bg-gray-800/50 rounded-md hover:bg-gray-700/50 transition-colors duration-200"
               aria-label="Toggle upload records"
             >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                 <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
               </svg>
             </button>
             <button
               onClick={toggleUploadShell}
               className="p-2 text-gray-200 bg-orange-600/80 rounded-md hover:bg-orange-600 transition-colors duration-200"
               aria-label="Open upload page"
             >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                 <polyline points="7,10 12,5 17,10" />
                 <line x1="12" y1="5" x2="12" y2="15" />
               </svg>
             </button>

             <ThemeToggle />
             <LocaleToggle />
          </div>
        </div>
      </header>

      <main>
        {!activePreset ? (
          <PresetGallery
            presets={presets}
            onSelect={handleSelectPreset}
            hasPreviousResult={!!primaryImageUrl}
            onOrderChange={setPresets}
          />
        ) : (
          //   创作界面
          <div className="container mx-auto p-4 md:p-8 animate-fade-in">
            <div className="mb-8">
              <button
                onClick={handleBackToSelection}
                className="flex items-center gap-2 text-[var(--accent-primary)] transition-colors duration-200 py-2 px-4 rounded-xl"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {t('shell.chooseAnotherEffect')}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Input Column */}
              <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] shadow-lg">
                <div>
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold mb-1 text-[var(--accent-primary)] flex items-center gap-3">
                      <span className="text-3xl">{activePreset.emoji}</span>
                      {t(activePreset.titleKey)}
                    </h2>
                    {activePreset.isVideo ? null : activePreset.prompt === 'CUSTOM' ? (
                        <textarea
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            placeholder="e.g., 'make the sky a vibrant sunset' or 'add a small red boat on the water'"
                            rows={3}
                            className="w-full mt-2 p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] transition-colors placeholder-[var(--text-tertiary)] text-[var(--text-primary)]"
                        />
                    ) : (
                       <p className="text-[var(--text-secondary)]">{activePreset.descriptionKey ? t(activePreset.descriptionKey) : ''}</p>
                    )}
                  </div>

                  {activePreset.isVideo ? (
                    <MotionStudio
                      primaryImageUrl={primaryImageUrl}
                      onPrimarySelect={handlePrimaryImageSelect}
                      onClearPrimary={handleClearPrimaryImage}
                      onVideoGenerated={(url: string) => {
                        const result = { imageUrl: null, text: null, videoUrl: url };
                        setRenderResult(result);
                        setHistory(prev => [result, ...prev]);
                      }}
                      setLoading={setIsLoading}
                      setLoadingMessage={setLoadingMessage}
                      setError={(msg) => setError(msg || undefined)}
                      setBalance={(b) => setCreditBalance(b)}
                    />
                  ) : (
                    !activePreset.promptOnly && (
                      activePreset.isMultiImage ? (
                        <DualUploader
                          onPrimarySelect={handlePrimaryImageSelect}
                          onSecondarySelect={handleSecondaryImageSelect}
                          primaryImageUrl={primaryImageUrl}
                          secondaryImageUrl={secondaryImageUrl}
                          onClearPrimary={handleClearPrimaryImage}
                          onClearSecondary={handleClearSecondaryImage}
                          primaryTitle={activePreset.primaryUploaderTitle}
                          primaryDescription={activePreset.primaryUploaderDescription}
                          secondaryTitle={activePreset.secondaryUploaderTitle}
                          secondaryDescription={activePreset.secondaryUploaderDescription}
                        />
                      ) : (
                        <MaskCanvas
                          onImageSelect={handlePrimaryImageSelect}
                          initialImageUrl={primaryImageUrl}
                          onMaskChange={setMaskDataUrl}
                          onClearImage={handleClearPrimaryImage}
                          isMaskToolActive={activeTool === 'mask'}
                          uploadDescription={activePreset.singleUploaderDescription ? t(activePreset.singleUploaderDescription) : undefined}
                        />
                      )
                    )
                  )}
                  {/*绘制蒙版*/}
                  {/*{primaryImageUrl && !activePreset.isMultiImage && !activePreset.promptOnly && (*/}
                  {/*  <div className="mt-4">*/}
                  {/*      <button*/}
                  {/*          onClick={toggleMaskTool}*/}
                  {/*          className={`w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold rounded-md transition-colors duration-200 ${*/}
                  {/*              activeTool === 'mask' ? 'bg-gradient-to-r from-orange-500 to-yellow-400 text-black' : 'bg-gray-100 hover:bg-gray-200'*/}
                  {/*          }`}*/}
                  {/*      >*/}
                  {/*          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>*/}
                  {/*          <span>{t('maskEditor.drawMask')}</span>*/}
                  {/*      </button>*/}
                  {/*  </div>*/}
                  {/*)}*/}

                   {activePreset.isVideo ? null : (
                   <ActionButton
                    onClick={handleGenerate}
                    disabled={isGenerateDisabled}
                    isPrimary={(treatAsPromptOnly || !!primaryImageUrl) && !isGenerateDisabled}
                    className={`w-full mt-6 py-3 px-4 border border-[var(--border-primary)] rounded-lg shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 ${((!primaryImageUrl && !treatAsPromptOnly) || isGenerateDisabled) ? 'text-[var(--text-secondary)] hover:border-[var(--accent-primary)] bg-[var(--bg-card)]' : ''}`}
                    style={((!primaryImageUrl && !treatAsPromptOnly) || isGenerateDisabled) ? { backgroundColor: 'var(--bg-card)' } : undefined}
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
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0  18"
                             fill="currentColor">
                          <path d="M11.3 1.046a1 1 0 00-1.6 0L5.05 6.667a1 1 0 00.8 1.6H9l-2.3 6.287a1 1 0 001.6 1.085l6.652-8.2a1 1 0 00-.8-1.6H11l.3-4.793z"/>
                        </svg>
                        <span>1</span>
                        <span className='ml-2'>{t('shell.generateImage')}</span>
                      </>
                    )}
                   </ActionButton>
                   )}
                </div>
              </div>

              {/* Output Column */}
              <div
                  className="flex flex-col p-4 sm:p-6 bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] shadow-lg">
                <h2 className="text-xl font-semibold mb-4 text-[var(--accent-primary)] self-start">{t('shell.result')}</h2>
                {isLoading && <div className="flex-grow flex items-center justify-center"><ProgressHint message={loadingMessage} /></div>}
                {error && <div className="flex-grow flex items-center justify-center w-full"><FailureNotice message={error} /></div>}
                {!isLoading && !error && generatedContent && (
                    <ResultViewer
                        content={generatedContent}
                        onUseImageAsInput={handleUseImageAsInput}
                        onImageClick={handleOpenPreview}
                        originalImageUrl={primaryImageUrl}
                        onStoreToHistory={handleStoreToHistory}
                        onRegenerate={handleRegenerate}
                        regeneratingTarget={regeneratingTarget}
                    />
                )}
                {!isLoading && !error && !generatedContent && (
                  <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-500">
                    {activePreset?.isVideo ? (
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M46 14L32 24L46 34V14Z" stroke="#6B7280" stroke-width="4" stroke-linecap="round"
                                stroke-linejoin="round"/>
                          <path
                              d="M28 10H6C3.79086 10 2 11.7909 2 14V34C2 36.2091 3.79086 38 6 38H28C30.2091 38 32 36.2091 32 34V14C32 11.7909 30.2091 10 28 10Z"
                              stroke="#6B7280" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>

                    ) : (
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M2 26L11.172 16.828C11.9221 16.0781 12.9393 15.6569 14 15.6569C15.0607 15.6569 16.0779 16.0781 16.828 16.828L26 26M22 22L25.172 18.828C25.9221 18.0781 26.9393 17.6569 28 17.6569C29.0607 17.6569 30.0779 18.0781 30.828 18.828L34 22M22 10H22.02M6 34H30C31.0609 34 32.0783 33.5786 32.8284 32.8284C33.5786 32.0783 34 31.0609 34 30V6C34 4.93913 33.5786 3.92172 32.8284 3.17157C32.0783 2.42143 31.0609 2 30 2H6C4.93913 2 3.92172 2.42143 3.17157 3.17157C2.42143 3.92172 2 4.93913 2 6V30C2 31.0609 2.42143 32.0783 3.17157 32.8284C3.92172 33.5786 4.93913 34 6 34Z" stroke="#6B7280" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
                    )}
                    <p className="mt-2 text-[var(--text-secondary)]">{activePreset?.isVideo ? t('motion.resultPlaceholder') : t('shell.yourImageWillAppear')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      <PreviewOverlay imageUrl={previewImageUrl} onClose={handleClosePreview}/>
      <CreditLedgerModal
        isOpen={isPointsModalOpen}
        onClose={closePointsModal}
        balance={creditBalance}
        entries={creditEntries}
      />
      <GalleryPanel
          isOpen={isGalleryPanelOpen}
        onClose={toggleGalleryPanel}
        history={history}
        onUseImage={handleUseHistoryImageAsInput}
        onDownload={handleDownloadFromHistory}
        onDeleteItem={handleDeleteHistoryItem}
        onClearHistory={handleClearHistory}
        onShowConfirm={(title, message, onConfirm) => {
          setConfirmOverlayConfig({ title, message, onConfirm });
          setIsConfirmOverlayOpen(true);
        }}
      />
      <AssetLibraryPanel
         isOpen={isAssetLibraryPanelOpen}
         onClose={toggleAssetLibraryPanel}
         uploadRecords={uploadRecords}
         onUseImage={handleUseAssetRecordImageAsInput}
         onDownload={handleDownloadFromAssetRecord}
         onDeleteImage={handleDeleteAssetRecord}
         onClearAll={handleClearAllAssetRecords}
         onShowConfirm={(title, message, onConfirm) => {
           setConfirmOverlayConfig({ title, message, onConfirm });
           setIsConfirmOverlayOpen(true);
         }}
       />
       {isUploadShellOpen && (
         <UploadShell
           onUpload={addAssetRecord}
           onClose={toggleUploadShell}
           uploadRecords={uploadRecords}
           onShowConfirm={(title, message, onConfirm) => {
             setConfirmOverlayConfig({ title, message, onConfirm });
             setIsConfirmOverlayOpen(true);
           }}
         />
       )}


       {/* Confirm Dialog */}
       <ConfirmOverlay
         isOpen={isConfirmOverlayOpen}
         title={confirmDialogConfig?.title || ''}
         message={confirmDialogConfig?.message || ''}
         onConfirm={() => {
           confirmDialogConfig?.onConfirm();
           setIsConfirmOverlayOpen(false);
           setConfirmOverlayConfig(null);
         }}
         onCancel={() => {
           setIsConfirmOverlayOpen(false);
           setConfirmOverlayConfig(null);
         }}
       />
    </div>
  );
};

// Add fade-in animation for view transitions
const style = document.createElement('style');
style.innerHTML = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 0.4s ease-out forwards;
  }
  @keyframes fadeInFast {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .animate-fade-in-fast {
    animation: fadeInFast 0.2s ease-out forwards;
  }
`;
document.head.appendChild(style);


export default Studio;
