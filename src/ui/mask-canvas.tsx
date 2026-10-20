import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from '../i18n/provider';

interface MaskCanvasProps {
  onImageSelect: (file: File, dataUrl: string) => void;
  initialImageUrl: string | null;
  onMaskChange: (dataUrl: string | null) => void;
  onClearImage: () => void;
  isMaskToolActive: boolean;
  uploadDescription?: string;
}

const MaskCanvas: React.FC<MaskCanvasProps> = ({ onImageSelect, initialImageUrl, onMaskChange, onClearImage, isMaskToolActive, uploadDescription }) => {
  const { t } = useTranslation();
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [brushSize, setBrushSize] = useState(20);
  const [history, setHistory] = useState<ImageData[]>([]);

  const [isDragging, setIsDragging] = useState(false); // For file drop

  const getCanvasContexts = useCallback(() => {
    const imageCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const imageCtx = imageCanvas?.getContext('2d');
    const maskCtx = maskCanvas?.getContext('2d');
    return { imageCanvas, maskCanvas, imageCtx, maskCtx };
  }, []);

  const draw = useCallback(() => {
    const { imageCtx, imageCanvas, maskCanvas } = getCanvasContexts();
    const container = containerRef.current;

    if (!imageCtx || !imageCanvas || !image || !container) return;

    const contRatio = container.clientWidth / container.clientHeight;
    const imgRatio = image.width / image.height;

    let displayW, displayH, displayX, displayY;
    if (contRatio > imgRatio) {
        displayH = container.clientHeight;
        displayW = displayH * imgRatio;
    } else {
        displayW = container.clientWidth;
        displayH = displayW / imgRatio;
    }
    displayX = (container.clientWidth - displayW) / 2;
    displayY = (container.clientHeight - displayH) / 2;

    [imageCanvas, maskCanvas].forEach(canvas => {
        if(canvas) {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        }
    });

    imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    imageCtx.drawImage(image, displayX, displayY, displayW, displayH);

  }, [image, getCanvasContexts]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        setImage(img);
        setHistory([]);
        const { maskCtx, maskCanvas } = getCanvasContexts();
        if (maskCtx && maskCanvas) {
            maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
            onMaskChange(null);
        }
    };
    if (initialImageUrl) {
        img.src = initialImageUrl;
    } else {
        setImage(null);
    }
  }, [initialImageUrl, getCanvasContexts, onMaskChange]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw, image]);

  const startDrawing = (e: React.MouseEvent) => {
    if (!isMaskToolActive) return;
    const { maskCtx } = getCanvasContexts();
    if (!maskCtx) return;

    setIsDrawing(true);
    const rect = maskCanvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setLastPos({ x, y });

    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'round';
    maskCtx.strokeStyle = 'rgba(255,0,0,0.55)';
    maskCtx.lineWidth = brushSize;
  };

  const drawLine = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const { maskCtx } = getCanvasContexts();
    if (!maskCtx || !lastPos) return;
    const rect = maskCanvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    maskCtx.beginPath();
    maskCtx.moveTo(lastPos.x, lastPos.y);
    maskCtx.lineTo(x, y);
    maskCtx.stroke();

    setLastPos({ x, y });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setLastPos(null);
    onMaskChange(maskCanvasRef.current?.toDataURL() ?? null);
  };

  const handleFile = useCallback((file: File) => {
     const reader = new FileReader();
      reader.onload = (e) => { onImageSelect(file, e.target?.result as string); };
      reader.readAsDataURL(file);
  }, [onImageSelect]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) handleFile(event.target.files[0]);
  };
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); setIsDragging(false);
    if (event.dataTransfer.files?.[0]) handleFile(event.dataTransfer.files[0]);
  }, [handleFile]);
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };

  return (
    <div className="flex flex-col gap-4">
        <div
            ref={containerRef}
            onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
            className={`relative w-full aspect-square bg-[var(--bg-secondary)] rounded-lg flex items-center justify-center transition-colors duration-200 select-none ${
            isDragging ? 'outline-dashed outline-2 outline-[var(--accent-primary)] bg-[rgba(249,115,22,0.1)]' : ''
            } ${initialImageUrl ? 'p-0' : 'p-4 border-2 border-dashed border-[var(--border-primary)]'}`}
        >
            {!initialImageUrl ? (
                <label htmlFor="file-upload" className="flex flex-col items-center justify-center text-[var(--text-tertiary)] cursor-pointer w-full h-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.158 0h.008v.008h-.008V8.25z" /></svg>
                    <p className="mb-2 text-sm"><span className="font-semibold text-[var(--text-secondary)]">{t('maskEditor.upload')}</span></p>
                    {uploadDescription ? (
                      <p className="text-xs">{uploadDescription}</p>
                    ) : (
                      <p className="text-xs">{t('maskEditor.dragAndDrop')}</p>
                    )}
                    <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                </label>
            ) : (
                <>
                    <button onClick={onClearImage} className="absolute top-2 right-2 z-30 p-1 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-red-600 transition-colors" aria-label="Remove image"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                    <canvas ref={imageCanvasRef} className="absolute top-0 left-0" style={{ zIndex: 1 }} />
                    <canvas ref={maskCanvasRef} className="absolute top-0 left-0" style={{ zIndex: 3, touchAction: 'none', cursor: isMaskToolActive ? 'crosshair' : 'default' }} onMouseDown={startDrawing} onMouseMove={drawLine} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} />
                </>
            )}
        </div>

        {/*笔刷大小*/}
        {/*{initialImageUrl && (*/}
        {/*  <div className="flex items-center gap-4">*/}
        {/*    <label className="text-sm font-semibold text-[var(--text-secondary)]" htmlFor="brush-size">{t('maskEditor.brushSize')}</label>*/}
        {/*    <input id="brush-size" type="range" min={5} max={100} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="flex-1" />*/}
        {/*  </div>*/}
        {/*)}*/}
    </div>
  );
}

export default MaskCanvas;
