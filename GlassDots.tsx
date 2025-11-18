import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useHistory, useImageHandler } from './hooks';
import { getTimestamp } from './utils';
import { GlassDotsState, Theme, GlassDotsSettingsContainer, GlassDotsPrintState } from './types';
import { Dropzone, EnhancedSlider, UndoRedoControls, SegmentedControl, ToastNotification, SharePopup } from './components';
import { trackEvent } from './analytics';

const DEFAULT_SLIDER_VALUE = 50;
const GLASSDOTS_PHONE_WIDTH = 1260;
const GLASSDOTS_PHONE_HEIGHT = 2800;
const GLASSDOTS_DESKTOP_WIDTH = 3840;
const GLASSDOTS_DESKTOP_HEIGHT = 2160;
const PRINT_DPI = 300;

const PRINT_SIZES: Record<string, { label: string, w: number, h: number, group: string, isRatio?: boolean }> = {
    // US Standard
    'us_8x10': { label: '8 x 10 in', w: 8, h: 10, group: 'US Standard' },
    'us_8.5x11': { label: '8.5 x 11 in', w: 8.5, h: 11, group: 'US Standard' },
    'us_11x14': { label: '11 x 14 in', w: 11, h: 14, group: 'US Standard' },
    'us_11x17': { label: '11 x 17 in', w: 11, h: 17, group: 'US Standard' },
    'us_12x16': { label: '12 x 16 in', w: 12, h: 16, group: 'US Standard' },
    'us_12x18': { label: '12 x 18 in', w: 12, h: 18, group: 'US Standard' },
    'us_16x20': { label: '16 x 20 in', w: 16, h: 20, group: 'US Standard' },
    'us_18x24': { label: '18 x 24 in', w: 18, h: 24, group: 'US Standard' },
    'us_20x30': { label: '20 x 30 in', w: 20, h: 30, group: 'US Standard' },
    'us_24x36': { label: '24 x 36 in', w: 24, h: 36, group: 'US Standard' },
    'us_27x40': { label: '27 x 40 in', w: 27, h: 40, group: 'US Standard' },
    'us_36x48': { label: '36 x 48 in', w: 36, h: 48, group: 'US Standard' },
    // ISO
    'iso_a5': { label: 'A5', w: 5.83, h: 8.27, group: 'ISO' },
    'iso_a4': { label: 'A4', w: 8.27, h: 11.69, group: 'ISO' },
    'iso_a3': { label: 'A3', w: 11.69, h: 16.54, group: 'ISO' },
    'iso_a2': { label: 'A2', w: 16.54, h: 23.39, group: 'ISO' },
    'iso_a1': { label: 'A1', w: 23.39, h: 33.11, group: 'ISO' },
    'iso_a0': { label: 'A0', w: 33.11, h: 46.81, group: 'ISO' },
    // Ratio (base size of 12 inches for the smaller side)
    'original': { label: 'Original Ratio', w: 1, h: 1, group: 'Ratio', isRatio: true },
    'ratio_1:1': { label: '1:1', w: 12, h: 12, group: 'Ratio', isRatio: true },
    'ratio_5:4': { label: '5:4', w: 15, h: 12, group: 'Ratio', isRatio: true },
    'ratio_4:3': { label: '4:3', w: 16, h: 12, group: 'Ratio', isRatio: true },
    'ratio_3:2': { label: '3:2', w: 18, h: 12, group: 'Ratio', isRatio: true },
    'ratio_16:9': { label: '16:9', w: 21.33, h: 12, group: 'Ratio', isRatio: true },
    'ratio_1.85:1': { label: '1.85:1', w: 22.2, h: 12, group: 'Ratio', isRatio: true },
    'ratio_2:1': { label: '2:1', w: 24, h: 12, group: 'Ratio', isRatio: true },
    'ratio_2.35:1': { label: '2.35:1', w: 28.2, h: 12, group: 'Ratio', isRatio: true },
    'ratio_21:9': { label: '21:9', w: 28, h: 12, group: 'Ratio', isRatio: true },
    'ratio_3:1': { label: '3:1', w: 36, h: 12, group: 'Ratio', isRatio: true },
};
const PRINT_SIZE_GROUPS = ['US Standard', 'ISO', 'Ratio'];


const GLASSDOTS_INITIAL_STATE: GlassDotsState = {
    resolution: DEFAULT_SLIDER_VALUE,
    pixelGap: DEFAULT_SLIDER_VALUE,
    blurAmount: 50,
    isMonochrome: false,
    cropOffsetX: 0.5,
    cropOffsetY: 0.5,
    isGrainEnabled: true,
    grainAmount: DEFAULT_SLIDER_VALUE,
    grainSize: 0,
    ior: 25,
    similaritySensitivity: 50,
    isBackgroundBlurEnabled: false,
    lowerLimit: 0,
    isMarkerEnabled: false,
};

const PRINT_INITIAL_STATE: GlassDotsPrintState = {
    ...GLASSDOTS_INITIAL_STATE,
    size: 'original',
    orientation: 'portrait',
};

const FULL_GLASSDOTS_INITIAL_STATE: GlassDotsSettingsContainer = {
    outputType: 'wallpaper',
    wallpaper: {
        phone: { ...GLASSDOTS_INITIAL_STATE },
        desktop: { ...GLASSDOTS_INITIAL_STATE },
    },
    print: PRINT_INITIAL_STATE,
};

const colorDistance = (
    c1: { r: number, g: number, b: number } | null,
    c2: { r: number, g: number, b: number } | null
): number => {
    if (!c1 || !c2) return Infinity;
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
};

const drawGlassDots = (ctx: CanvasRenderingContext2D, options: {
    canvasWidth: number;
    canvasHeight: number;
    sourceBleedCanvas: HTMLCanvasElement;
    blurBleedCanvas: HTMLCanvasElement;
    finalBgCanvas: HTMLCanvasElement;
    bleedX: number;
    bleedY: number;
    settings: GlassDotsState;
}) => {
    const { canvasWidth, canvasHeight, sourceBleedCanvas, blurBleedCanvas, finalBgCanvas, bleedX, bleedY, settings } = options;
    const { resolution, pixelGap, ior, similaritySensitivity, isGrainEnabled, grainAmount, grainSize, lowerLimit, isMarkerEnabled, isBackgroundBlurEnabled } = settings;

    // 1. Downsample image to grid for blob detection
    const gridWidth = Math.floor(10 + (resolution / 100) * 100);
    const gridHeight = Math.round(gridWidth * (canvasHeight / canvasWidth));
    if (gridWidth <= 0 || gridHeight <= 0) {
        ctx.drawImage(finalBgCanvas, 0, 0); // Draw background if grid is invalid
        return;
    };
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = gridWidth;
    tempCanvas.height = gridHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;

    // We draw from sourceBleedCanvas (which has monochrome filter applied if needed)
    tempCtx.drawImage(sourceBleedCanvas, 0, 0, sourceBleedCanvas.width, sourceBleedCanvas.height, 0, 0, gridWidth, gridHeight);
    const imageData = tempCtx.getImageData(0, 0, gridWidth, gridHeight).data;

    const colorGrid: ({ r: number; g: number; b: number; } | null)[][] = Array.from({ length: gridHeight }, (_, y) =>
        Array.from({ length: gridWidth }, (_, x) => {
            const i = (y * gridWidth + x) * 4;
            return { r: imageData[i], g: imageData[i + 1], b: imageData[i + 2] };
        })
    );
    
    // 2. Blob detection
    const visited = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(false));
    const blobs: { x: number, y: number, size: number }[] = [];
    const similarityThreshold = (similaritySensitivity / 100) * 160;

    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (visited[y][x]) continue;

            const anchorColor = colorGrid[y][x];
            let currentSize = 1;

            while (true) {
                const nextSize = currentSize + 1;
                if (y + nextSize > gridHeight || x + nextSize > gridWidth) break;

                let canExpand = true;
                // Check new column on the right
                for (let i = 0; i < nextSize; i++) {
                    if (visited[y + i][x + currentSize] || colorDistance(anchorColor, colorGrid[y + i][x + currentSize]) > similarityThreshold) {
                        canExpand = false;
                        break;
                    }
                }
                if (!canExpand) break;

                // Check new row on the bottom
                for (let i = 0; i < currentSize; i++) {
                    if (visited[y + currentSize][x + i] || colorDistance(anchorColor, colorGrid[y + currentSize][x + i]) > similarityThreshold) {
                        canExpand = false;
                        break;
                    }
                }

                if (canExpand) {
                    currentSize = nextSize;
                } else {
                    break;
                }
            }

            blobs.push({ x, y, size: currentSize });
            for (let j = 0; j < currentSize; j++) {
                for (let i = 0; i < currentSize; i++) {
                    visited[y + j][x + i] = true;
                }
            }
        }
    }
    
    // 3. Identify top blobs for markers before any filtering
    const sortedAllBlobs = [...blobs].sort((a, b) => b.size - a.size);
    const top4PercentIndex = Math.ceil(sortedAllBlobs.length * 0.04);
    const topBlobsForMarkers = new Set(sortedAllBlobs.slice(0, top4PercentIndex));

    // 4. Draw final image with blobs
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(finalBgCanvas, 0, 0);

    const refractScale = 1 + (ior / 100) * 0.4;
    
    const cellWidth = canvasWidth / gridWidth;
    const cellHeight = canvasHeight / gridHeight;
    const recalibratedPixelGap = pixelGap * 16 / 100;
    const effectiveGapPercent = (recalibratedPixelGap / 100);
    const gapX = cellWidth * effectiveGapPercent;
    const gapY = cellHeight * effectiveGapPercent;
    
    const maskItems: { centerX: number, centerY: number, radius: number }[] = [];
    
    const maxBlobSize = blobs.reduce((max, b) => Math.max(max, b.size), 1);
    const sizeThreshold = (lowerLimit / 100) * maxBlobSize;
    const filteredBlobs = blobs.filter(b => b.size >= sizeThreshold);

    const drawableBlobs = filteredBlobs.map(blob => {
        const { x, y, size } = blob;
        const blobPixelWidth = cellWidth * size;
        const blobPixelHeight = cellHeight * size;
        const centerX = x * cellWidth + blobPixelWidth / 2;
        const centerY = y * cellHeight + blobPixelHeight / 2;
        const dotWidth = blobPixelWidth - gapX;
        const dotHeight = blobPixelHeight - gapY;
        const radius = Math.min(dotWidth, dotHeight) / 2;
        return { centerX, centerY, radius, size, originalBlob: blob };
    }).filter(b => b.radius > 0.1);

    for (const blob of drawableBlobs) {
        const { centerX, centerY, radius } = blob;
        maskItems.push({ centerX, centerY, radius });

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.clip();
        
        const refractedW = radius * 2 * refractScale;
        const refractedH = radius * 2 * refractScale;
        
        const sourceX = (centerX + bleedX) - refractedW / 2;
        const sourceY = (centerY + bleedY) - refractedH / 2;

        ctx.drawImage(blurBleedCanvas, sourceX, sourceY, refractedW, refractedH, centerX - radius, centerY - radius, radius * 2, radius * 2);
        ctx.restore();
    }

    // 5. Draw plus signs on largest dots
    if (isMarkerEnabled && topBlobsForMarkers.size > 0) {
        const tempImageCtx = sourceBleedCanvas.getContext('2d', { willReadFrequently: true });
        if (tempImageCtx) {
            ctx.save();
            ctx.globalCompositeOperation = 'overlay';

            for (const blob of drawableBlobs) {
                if (topBlobsForMarkers.has(blob.originalBlob)) {
                    const { centerX, centerY, radius } = blob;
                    const sampleX = Math.round(centerX + bleedX);
                    const sampleY = Math.round(centerY + bleedY);
                    const pixelData = tempImageCtx.getImageData(sampleX, sampleY, 1, 1).data;
                    const brightness = 0.299 * pixelData[0] + 0.587 * pixelData[1] + 0.114 * pixelData[2];
                    ctx.strokeStyle = brightness > 128 ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
                    
                    const hardcodedPlusSignSize = 50;
                    const hardcodedPlusSignStroke = 36;
                    const stroke = (hardcodedPlusSignStroke / 100) * (radius * 0.05) + 1;
                    ctx.lineWidth = Math.max(1, stroke);
                    
                    const size = (hardcodedPlusSignSize / 100) * radius * 0.5;
                    
                    ctx.beginPath();
                    ctx.moveTo(centerX - size, centerY);
                    ctx.lineTo(centerX + size, centerY);
                    ctx.moveTo(centerX, centerY - size);
                    ctx.lineTo(centerX, centerY + size);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
    }


    // 6. Add grain if enabled
    if (isGrainEnabled && grainAmount > 0 && (maskItems.length > 0 || isBackgroundBlurEnabled)) {
        const grainCanvas = document.createElement('canvas');
        grainCanvas.width = canvasWidth;
        grainCanvas.height = canvasHeight;
        const grainCtx = grainCanvas.getContext('2d');
        if (grainCtx) {
            const recalibratedGrainSize = grainSize * 18 / 100;
            const scale = 1 + (recalibratedGrainSize / 100) * 7;
            const noiseW = Math.ceil(canvasWidth / scale);
            const noiseH = Math.ceil(canvasHeight / scale);
            const noiseCanvas = document.createElement('canvas');
            noiseCanvas.width = noiseW;
            noiseCanvas.height = noiseH;
            const noiseCtx = noiseCanvas.getContext('2d');
            if (noiseCtx) {
                const imageData = noiseCtx.createImageData(noiseW, noiseH);
                const data = imageData.data;
                const contrastFactor = 128 + (DEFAULT_SLIDER_VALUE / 100) * 127;
                for (let i = 0; i < data.length; i += 4) {
                    const val = 128 + (Math.random() - 0.5) * contrastFactor;
                    data[i] = data[i + 1] = data[i + 2] = val;
                    data[i + 3] = 255;
                }
                noiseCtx.putImageData(imageData, 0, 0);
                grainCtx.imageSmoothingEnabled = false;
                grainCtx.drawImage(noiseCanvas, 0, 0, noiseW, noiseH, 0, 0, canvasWidth, canvasHeight);
                
                if (!isBackgroundBlurEnabled) {
                    const dotsMaskCanvas = document.createElement('canvas');
                    dotsMaskCanvas.width = canvasWidth;
                    dotsMaskCanvas.height = canvasHeight;
                    const maskCtx = dotsMaskCanvas.getContext('2d');
                    if (maskCtx) {
                        maskCtx.fillStyle = 'white';
                        maskCtx.beginPath();
                        for (const item of maskItems) {
                            maskCtx.moveTo(item.centerX + item.radius, item.centerY);
                            maskCtx.arc(item.centerX, item.centerY, item.radius, 0, 2 * Math.PI);
                        }
                        maskCtx.fill();
                        grainCtx.globalCompositeOperation = 'destination-in';
                        grainCtx.drawImage(dotsMaskCanvas, 0, 0);
                    }
                }

                ctx.save();
                const recalibratedGrainAmount = grainAmount * 35 / 100;
                ctx.globalAlpha = recalibratedGrainAmount / 100;
                ctx.globalCompositeOperation = 'overlay';
                ctx.drawImage(grainCanvas, 0, 0);
                ctx.restore();
            }
        }
    }
};

export const useGlassDotsPanel = ({
  theme,
  isMobile,
  footerLinks,
  triggerShareToast,
  handleShare,
  showSharePopup,
  setShowSharePopup,
  communityLink,
  appUrl,
  shareVariant,
}: {
  theme: Theme;
  isMobile: boolean;
  footerLinks: React.ReactNode;
  triggerShareToast: (showSpecificToast?: () => void, isSpecial?: boolean) => void;
  handleShare: (variant?: 'default' | 'special') => Promise<void>;
  showSharePopup: boolean;
  setShowSharePopup: React.Dispatch<React.SetStateAction<boolean>>;
  communityLink: string;
  appUrl: string;
  shareVariant: 'default' | 'special';
}) => {
  const { 
    state: glassDotsSettings, 
    setState: setGlassDotsSettings, 
    undo: undoGlassDots, 
    redo: redoGlassDots, 
    resetHistory: resetGlassDotsHistoryStack,
    canUndo: canUndoGlassDots, 
    canRedo: canRedoGlassDots 
  } = useHistory(FULL_GLASSDOTS_INITIAL_STATE);
  
  const [liveGlassDotsSettings, setLiveGlassDotsSettings] = useState(glassDotsSettings);
  const [wallpaperType, setWallpaperType] = useState<'phone' | 'desktop'>(isMobile ? 'phone' : 'desktop');
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  const [showFsToast, setShowFsToast] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullScreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const fullScreenContainerRef = useRef<HTMLDivElement>(null);
  const fullScreenFileInputRef = useRef<HTMLInputElement>(null);
  const [isFullScreenControlsOpen, setIsFullScreenControlsOpen] = useState(false);
  
  const { outputType } = liveGlassDotsSettings;

  const liveActiveState = useMemo(() => {
      const { wallpaper, print } = liveGlassDotsSettings;
      return outputType === 'wallpaper' ? wallpaper[wallpaperType] : print;
  }, [liveGlassDotsSettings, outputType, wallpaperType]);

  const {
    imageSrc,
    image,
    isLoading,
    isDownloading,
    handleFileSelect,
    handleDownload: baseHandleDownload,
    clearImage
  } = useImageHandler({
    featureName: 'glass_dots',
    onFileSelectCallback: () => {},
    triggerShareToast: triggerShareToast
  });
  
  useEffect(() => {
    if (image) {
        const newOrientation = image.width >= image.height ? 'landscape' : 'portrait';
        const newInitialState = JSON.parse(JSON.stringify(FULL_GLASSDOTS_INITIAL_STATE));
        newInitialState.print.size = 'original';
        newInitialState.print.orientation = newOrientation;
        resetGlassDotsHistoryStack(newInitialState);
    } else {
        resetGlassDotsHistoryStack(FULL_GLASSDOTS_INITIAL_STATE);
    }
  }, [image, resetGlassDotsHistoryStack]);

  useEffect(() => { setLiveGlassDotsSettings(glassDotsSettings); }, [glassDotsSettings]);
  
  const handleResetCurrent = useCallback(() => {
    trackEvent('glass_dots_reset_defaults', { output_mode: outputType === 'wallpaper' ? wallpaperType : 'print' });
    setGlassDotsSettings(s => {
        const resetStateForMode = (state: GlassDotsState | GlassDotsPrintState, initial: GlassDotsState | GlassDotsPrintState) => {
            const { cropOffsetX, cropOffsetY } = state;
            const printSpecifics = 'size' in state ? { size: state.size, orientation: state.orientation } : {};
            return { ...initial, cropOffsetX, cropOffsetY, ...printSpecifics };
        };

        if (s.outputType === 'wallpaper') {
            return { ...s, wallpaper: {
                ...s.wallpaper,
                [wallpaperType]: resetStateForMode(s.wallpaper[wallpaperType], FULL_GLASSDOTS_INITIAL_STATE.wallpaper[wallpaperType]) as GlassDotsState
            }};
        }
        return { ...s, print: resetStateForMode(s.print, FULL_GLASSDOTS_INITIAL_STATE.print) as GlassDotsPrintState };
    });
  }, [wallpaperType, setGlassDotsSettings, outputType]);

  useEffect(() => {
    const handleFullScreenChange = () => {
        if (!document.fullscreenElement) {
            setIsFullScreenPreview(false);
            setIsFullScreenControlsOpen(false);
        }
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const enterFullScreen = () => {
      trackEvent('glass_dots_fullscreen_enter');
      flushSync(() => setIsFullScreenPreview(true));
      fullScreenContainerRef.current?.requestFullscreen().catch(() => setIsFullScreenPreview(false));
  };
  
  const exitFullScreen = useCallback(() => {
      trackEvent('glass_dots_fullscreen_exit');
      if (document.fullscreenElement) document.exitFullscreen();
      else setIsFullScreenPreview(false);
  }, []);

  const [fullCanvasWidth, fullCanvasHeight] = useMemo(() => {
      if (outputType === 'print') {
          const printState = liveActiveState as GlassDotsPrintState;
          const sizeInfo = PRINT_SIZES[printState.size];
          if (!sizeInfo) return [GLASSDOTS_DESKTOP_WIDTH, GLASSDOTS_DESKTOP_HEIGHT];
          let w, h;
          if (printState.size === 'original') {
              if (!image) return [3600, 3600];
              const baseSize = 12 * PRINT_DPI;
              const imgAspect = image.width / image.height;
              if (imgAspect >= 1) { w = baseSize; h = Math.round(baseSize / imgAspect); }
              else { h = baseSize; w = Math.round(baseSize * imgAspect); }
          } else {
              w = sizeInfo.w * PRINT_DPI; h = sizeInfo.h * PRINT_DPI;
          }
          return printState.orientation === 'landscape' ? [Math.max(w, h), Math.min(w, h)] : [Math.min(w, h), Math.max(w, h)];
      }
      return wallpaperType === 'desktop' ? [GLASSDOTS_DESKTOP_WIDTH, GLASSDOTS_DESKTOP_HEIGHT] : [GLASSDOTS_PHONE_WIDTH, GLASSDOTS_PHONE_HEIGHT];
  }, [outputType, wallpaperType, liveActiveState, image]);
  
  const [previewCanvasWidth, previewCanvasHeight] = useMemo(() => {
    if (outputType === 'wallpaper') return [fullCanvasWidth, fullCanvasHeight];
    const aspectRatio = fullCanvasWidth / fullCanvasHeight;
    const MAX_PREVIEW_DIMENSION = 1500;
    if (fullCanvasWidth >= fullCanvasHeight) return [MAX_PREVIEW_DIMENSION, Math.round(MAX_PREVIEW_DIMENSION / aspectRatio)];
    return [Math.round(MAX_PREVIEW_DIMENSION * aspectRatio), MAX_PREVIEW_DIMENSION];
  }, [outputType, fullCanvasWidth, fullCanvasHeight]);

  const glassDotsCropIsNeeded = useMemo(() => image ? Math.abs((image.width / image.height) - (fullCanvasWidth / fullCanvasHeight)) > 0.01 : false, [image, fullCanvasWidth, fullCanvasHeight]);

  useEffect(() => {
    if (!image) return;
    const canvas = isFullScreenPreview ? fullScreenCanvasRef.current : canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // --- START: New bleed and oversized canvas logic ---
    const { resolution, ior, cropOffsetX, cropOffsetY, isMonochrome, blurAmount, isBackgroundBlurEnabled } = liveActiveState;

    // 1. Calculate required bleed based on IOR and a safe assumption of max blob size
    const gridWidth = Math.floor(10 + (resolution / 100) * 100);
    const maxBlobSizeFactor = 0.5; // Assume a blob can be up to 50% of the grid width
    const maxBlobPixelWidth = (previewCanvasWidth / gridWidth) * (gridWidth * maxBlobSizeFactor);
    const refractScale = 1 + (ior / 100) * 0.4;
    const scaleFactor = refractScale - 1;
    const bleed = (maxBlobPixelWidth / 2) * scaleFactor;

    const bleedX = bleed;
    const bleedY = bleed * (previewCanvasHeight / previewCanvasWidth);

    const bleedCanvasWidth = previewCanvasWidth + 2 * bleedX;
    const bleedCanvasHeight = previewCanvasHeight + 2 * bleedY;
    
    // 2. Prepare oversized source canvas
    const sourceBleedCanvas = document.createElement('canvas');
    sourceBleedCanvas.width = bleedCanvasWidth;
    sourceBleedCanvas.height = bleedCanvasHeight;
    const sourceBleedCtx = sourceBleedCanvas.getContext('2d', { willReadFrequently: true });
    if (!sourceBleedCtx) return;

    if (isMonochrome) sourceBleedCtx.filter = 'grayscale(100%)';
    
    const imgAspect = image.width / image.height;
    const bleedCanvasAspect = bleedCanvasWidth / bleedCanvasHeight;
    let sx = 0, sy = 0, sWidth = image.width, sHeight = image.height;

    if (imgAspect > bleedCanvasAspect) {
        sHeight = image.height;
        sWidth = sHeight * bleedCanvasAspect;
        sx = (image.width - sWidth) * cropOffsetX;
    } else {
        sWidth = image.width;
        sHeight = sWidth / bleedCanvasAspect;
        sy = (image.height - sHeight) * cropOffsetY;
    }
    sourceBleedCtx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, bleedCanvasWidth, bleedCanvasHeight);

    // 3. Prepare oversized blurred canvas
    const blurBleedCanvas = document.createElement('canvas');
    blurBleedCanvas.width = bleedCanvasWidth;
    blurBleedCanvas.height = bleedCanvasHeight;
    const blurBleedCtx = blurBleedCanvas.getContext('2d');
    if (!blurBleedCtx) return;

    const effectiveBlurAmount = 12 + (blurAmount * 0.88);
    const blurPx = (effectiveBlurAmount / 100) * Math.max(bleedCanvasWidth, bleedCanvasHeight) * 0.02;
    if (blurPx > 0) {
      blurBleedCtx.filter = `blur(${blurPx}px)`;
    }
    blurBleedCtx.drawImage(sourceBleedCanvas, 0, 0);

    // 4. Prepare final background canvas
    const finalBgCanvas = document.createElement('canvas');
    finalBgCanvas.width = previewCanvasWidth;
    finalBgCanvas.height = previewCanvasHeight;
    const finalBgCtx = finalBgCanvas.getContext('2d');
    if (!finalBgCtx) return;

    if (isBackgroundBlurEnabled) {
        // This is a simplified version of the old distortion logic, applied to the oversized canvas
        // A more complex implementation would be needed for a perfect 1:1 match
        const distortedCtx = blurBleedCtx; // Use the blurred canvas for a distorted effect
        finalBgCtx.drawImage(distortedCtx.canvas, bleedX, bleedY, previewCanvasWidth, previewCanvasHeight, 0, 0, previewCanvasWidth, previewCanvasHeight);
    } else {
        finalBgCtx.drawImage(sourceBleedCanvas, bleedX, bleedY, previewCanvasWidth, previewCanvasHeight, 0, 0, previewCanvasWidth, previewCanvasHeight);
    }
    // --- END: New bleed and oversized canvas logic ---

    drawGlassDots(ctx, { 
        canvasWidth: previewCanvasWidth, 
        canvasHeight: previewCanvasHeight, 
        sourceBleedCanvas,
        blurBleedCanvas,
        finalBgCanvas,
        bleedX,
        bleedY,
        settings: liveActiveState 
    });
  }, [image, isFullScreenPreview, previewCanvasWidth, previewCanvasHeight, liveActiveState]);
  
  const getCanvasBlob = useCallback(async (options: { highQuality?: boolean } = {}): Promise<Blob | null> => {
    const { highQuality = false } = options;
    if (!image) return null;
    
    const targetWidth = highQuality ? fullCanvasWidth : previewCanvasWidth;
    const targetHeight = highQuality ? fullCanvasHeight : previewCanvasHeight;

    return new Promise((resolve) => {
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = targetWidth;
        offscreenCanvas.height = targetHeight;
        const ctx = offscreenCanvas.getContext('2d');
        if (!ctx) return resolve(null);

        const settingsToDraw = outputType === 'print' ? glassDotsSettings.print : glassDotsSettings.wallpaper[wallpaperType];
        
        // --- Re-run the full pipeline for high quality export ---
        const { resolution, ior, cropOffsetX, cropOffsetY, isMonochrome, blurAmount, isBackgroundBlurEnabled } = settingsToDraw;
        const gridWidth = Math.floor(10 + (resolution / 100) * 100);
        const maxBlobSizeFactor = 0.5;
        const maxBlobPixelWidth = (targetWidth / gridWidth) * (gridWidth * maxBlobSizeFactor);
        const refractScale = 1 + (ior / 100) * 0.4;
        const scaleFactor = refractScale - 1;
        const bleed = (maxBlobPixelWidth / 2) * scaleFactor;
        const bleedX = bleed;
        const bleedY = bleed * (targetHeight / targetWidth);
        const bleedCanvasWidth = targetWidth + 2 * bleedX;
        const bleedCanvasHeight = targetHeight + 2 * bleedY;
        
        const sourceBleedCanvas = document.createElement('canvas');
        sourceBleedCanvas.width = bleedCanvasWidth;
        sourceBleedCanvas.height = bleedCanvasHeight;
        const sourceBleedCtx = sourceBleedCanvas.getContext('2d', { willReadFrequently: true });
        if (!sourceBleedCtx) return resolve(null);
        if (isMonochrome) sourceBleedCtx.filter = 'grayscale(100%)';
        const imgAspect = image.width / image.height, bleedCanvasAspect = bleedCanvasWidth / bleedCanvasHeight;
        let sx = 0, sy = 0, sWidth = image.width, sHeight = image.height;
        if (imgAspect > bleedCanvasAspect) { sHeight = image.height; sWidth = sHeight * bleedCanvasAspect; sx = (image.width - sWidth) * cropOffsetX; }
        else { sWidth = image.width; sHeight = sWidth / bleedCanvasAspect; sy = (image.height - sHeight) * cropOffsetY; }
        sourceBleedCtx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, bleedCanvasWidth, bleedCanvasHeight);

        const blurBleedCanvas = document.createElement('canvas');
        blurBleedCanvas.width = bleedCanvasWidth;
        blurBleedCanvas.height = bleedCanvasHeight;
        const blurBleedCtx = blurBleedCanvas.getContext('2d');
        if (!blurBleedCtx) return resolve(null);
        const effectiveBlurAmount = 12 + (blurAmount * 0.88);
        const blurPx = (effectiveBlurAmount / 100) * Math.max(bleedCanvasWidth, bleedCanvasHeight) * 0.02;
        if (blurPx > 0) blurBleedCtx.filter = `blur(${blurPx}px)`;
        blurBleedCtx.drawImage(sourceBleedCanvas, 0, 0);

        const finalBgCanvas = document.createElement('canvas');
        finalBgCanvas.width = targetWidth;
        finalBgCanvas.height = targetHeight;
        const finalBgCtx = finalBgCanvas.getContext('2d');
        if (!finalBgCtx) return resolve(null);
        if (isBackgroundBlurEnabled) { finalBgCtx.drawImage(blurBleedCtx.canvas, bleedX, bleedY, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight); }
        else { finalBgCtx.drawImage(sourceBleedCanvas, bleedX, bleedY, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight); }
        // --- End re-run ---

        drawGlassDots(ctx, { 
            canvasWidth: targetWidth, 
            canvasHeight: targetHeight, 
            sourceBleedCanvas, blurBleedCanvas, finalBgCanvas, bleedX, bleedY,
            settings: settingsToDraw
        });
        offscreenCanvas.toBlob(blob => resolve(blob), 'image/png');
    });
  }, [image, fullCanvasWidth, fullCanvasHeight, previewCanvasWidth, previewCanvasHeight, glassDotsSettings, wallpaperType, outputType]);

  const handleDownload = () => {
    const analyticsParams: Record<string, any> = { feature: 'glass_dots', output_type: outputType, ...liveActiveState };
    const onSuccess = () => triggerShareToast(isFullScreenPreview ? () => setShowFsToast(true) : undefined);
    
    let filename: string;
    if (outputType === 'print') {
        const { size, orientation } = glassDotsSettings.print;
        filename = `matrices-glassdots-print-${size}-${orientation}`;
    } else {
        filename = `matrices-glassdots-${wallpaperType}`;
    }

    baseHandleDownload(() => getCanvasBlob({ highQuality: true }), filename, analyticsParams, onSuccess);
  };
  
  const handleFullScreenReplace = (file: File) => handleFileSelect(file, 'click');
  const handleFullScreenReplaceClick = () => fullScreenFileInputRef.current?.click();
  const handleFullScreenFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) handleFullScreenReplace(e.target.files[0]);
      if (e.target) e.target.value = '';
  };

  const dragState = useRef({ isDragging: false, startX: 0, startY: 0, initialOffsetX: 0.5, initialOffsetY: 0.5, hasMoved: false });
  
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
      if (!glassDotsCropIsNeeded) return;
      e.preventDefault();
      Object.assign(dragState.current, { isDragging: true, hasMoved: false, initialOffsetX: liveActiveState.cropOffsetX, initialOffsetY: liveActiveState.cropOffsetY });
      const point = 'touches' in e ? e.touches[0] : e;
      dragState.current.startX = point.clientX;
      dragState.current.startY = point.clientY;
      document.body.style.cursor = 'grabbing';
  }, [glassDotsCropIsNeeded, liveActiveState]);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (!dragState.current.isDragging || !image) return;
      dragState.current.hasMoved = true;
      const point = 'touches' in e ? e.touches[0] : e;
      const deltaX = point.clientX - dragState.current.startX;
      const deltaY = point.clientY - dragState.current.startY;
      
      const activeCanvas = isFullScreenPreview ? fullScreenCanvasRef.current : canvasRef.current;
      if (!activeCanvas) return;

      const rect = activeCanvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const imgAspect = image.width / image.height;
      const canvasAspect = fullCanvasWidth / fullCanvasHeight;

      let sWidth, sHeight;
      if (imgAspect > canvasAspect) {
          sHeight = image.height;
          sWidth = sHeight * canvasAspect;
      } else {
          sWidth = image.width;
          sHeight = sWidth / canvasAspect;
      }

      const panRangePxX = image.width - sWidth;
      const panRangePxY = image.height - sHeight;

      let newOffsetX = dragState.current.initialOffsetX;
      if (panRangePxX > 0) {
          const dragFractionX = deltaX / rect.width;
          newOffsetX -= (dragFractionX * sWidth) / panRangePxX;
      }

      let newOffsetY = dragState.current.initialOffsetY;
      if (panRangePxY > 0) {
          const dragFractionY = deltaY / rect.height;
          newOffsetY -= (dragFractionY * sHeight) / panRangePxY;
      }

      const newCropState = {
          cropOffsetX: Math.max(0, Math.min(1, newOffsetX)),
          cropOffsetY: Math.max(0, Math.min(1, newOffsetY)),
      };

      setLiveGlassDotsSettings(s => {
          if (s.outputType === 'wallpaper') return { ...s, wallpaper: { ...s.wallpaper, [wallpaperType]: { ...s.wallpaper[wallpaperType], ...newCropState }}};
          return { ...s, print: { ...s.print, ...newCropState }};
      });
  }, [image, fullCanvasWidth, fullCanvasHeight, wallpaperType, isFullScreenPreview]);

  const handleDragEnd = useCallback(() => {
      if (dragState.current.isDragging) {
          dragState.current.isDragging = false;
          if (dragState.current.hasMoved) trackEvent('glass_dots_crop', { wallpaper_type: outputType === 'wallpaper' ? wallpaperType : 'print' });
          const { cropOffsetX: liveCropOffsetX, cropOffsetY: liveCropOffsetY } = liveActiveState;
          setGlassDotsSettings(s => {
            if (s.outputType === 'wallpaper') return { ...s, wallpaper: { ...s.wallpaper, [wallpaperType]: { ...s.wallpaper[wallpaperType], cropOffsetX: liveCropOffsetX, cropOffsetY: liveCropOffsetY }}};
            return { ...s, print: { ...s.print, cropOffsetX: liveCropOffsetX, cropOffsetY: liveCropOffsetY }};
          });
          document.body.style.cursor = 'default';
      }
  }, [liveActiveState, wallpaperType, setGlassDotsSettings, outputType]);

  useEffect(() => {
      const onMove = (e: MouseEvent | TouchEvent) => handleDragMove(e);
      const onEnd = () => handleDragEnd();
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove);
      document.addEventListener('touchend', onEnd);
      document.addEventListener('touchcancel', onEnd);
      return () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onEnd);
          document.removeEventListener('touchmove', onMove);
          document.removeEventListener('touchend', onEnd);
      }
  }, [handleDragMove, handleDragEnd]);
  
  const updateLiveSetting = (key: keyof GlassDotsState, value: any) => {
    setLiveGlassDotsSettings(s => {
        if (s.outputType === 'wallpaper') return { ...s, wallpaper: { ...s.wallpaper, [wallpaperType]: { ...s.wallpaper[wallpaperType], [key]: value }}};
        return { ...s, print: { ...s.print, [key]: value }};
    });
  };

  const commitSetting = useCallback((key: keyof GlassDotsState, value: any) => {
    setGlassDotsSettings(s => {
        if (s.outputType === 'wallpaper') {
            return { ...s, wallpaper: { ...s.wallpaper, [wallpaperType]: { ...s.wallpaper[wallpaperType], [key]: value }}};
        }
        return { ...s, print: { ...s.print, [key]: value }};
    });
    trackEvent('glass_dots_slider_change', { slider_name: key, value, output_mode: outputType === 'wallpaper' ? wallpaperType : 'print' });
  }, [setGlassDotsSettings, outputType, wallpaperType]);

  const handleOutputTypeSelect = (type: 'wallpaper' | 'print') => {
    trackEvent('glass_dots_output_type_select', { type });
    setGlassDotsSettings(s => ({ ...s, outputType: type }));
  };
  
  const wallpaperTypeOptions = [ { key: 'phone', label: 'Phone' }, { key: 'desktop', label: 'Desktop' } ];
  const outputTypeOptions = [ { key: 'wallpaper', label: 'Wallpaper' }, { key: 'print', label: 'Print' } ];
  const orientationOptions = [ { key: 'landscape', label: 'Landscape' }, { key: 'portrait', label: 'Portrait' } ];

  const AllControls = ({ isFullScreen = false }: { isFullScreen?: boolean }) => (
    <>
      <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
        <SegmentedControl options={outputTypeOptions} selected={outputType} onSelect={(key) => handleOutputTypeSelect(key as 'wallpaper' | 'print')} theme={theme} />
        {outputType === 'wallpaper' ? (
            <SegmentedControl options={wallpaperTypeOptions} selected={wallpaperType} onSelect={(key) => setWallpaperType(key as 'phone' | 'desktop')} theme={theme} />
        ) : (
          <div className="space-y-4">
              <div>
                  <label htmlFor={`print-size-select-${isFullScreen}`} className={`block text-sm mb-2 ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>Print Size</label>
                  <select
                      id={`print-size-select-${isFullScreen}`} value={(liveActiveState as GlassDotsPrintState).size}
                      onChange={(e) => commitSetting('size' as any, e.target.value)}
                      className={`w-full p-2 rounded-md border text-sm ${theme === 'dark' ? 'bg-nothing-gray-dark border-nothing-gray-dark text-nothing-light' : 'bg-day-gray-light border-gray-300 text-day-text'}`}
                  >
                      {PRINT_SIZE_GROUPS.map(group => (
                          <optgroup label={group} key={group}>
                              {Object.entries(PRINT_SIZES).filter(([, val]) => val.group === group).map(([key, val]) => (
                                  <option key={key} value={key}>{val.label}</option>
                              ))}
                          </optgroup>
                      ))}
                  </select>
              </div>
              <SegmentedControl options={orientationOptions} selected={(liveActiveState as GlassDotsPrintState).orientation} onSelect={(key) => commitSetting('orientation' as any, key)} theme={theme} />
          </div>
        )}
      </div>
      <UndoRedoControls onUndo={() => { undoGlassDots(); trackEvent('glass_dots_undo'); }} onRedo={() => { redoGlassDots(); trackEvent('glass_dots_redo'); }} canUndo={canUndoGlassDots} canRedo={canRedoGlassDots} theme={theme} />
      <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
        <EnhancedSlider theme={theme} isMobile={isMobile} label="Resolution" value={liveActiveState.resolution} onChange={v => updateLiveSetting('resolution', v)} onChangeCommitted={v => commitSetting('resolution', v)} onReset={() => commitSetting('resolution', DEFAULT_SLIDER_VALUE)} disabled={isLoading} />
        <EnhancedSlider theme={theme} isMobile={isMobile} label="Pixel Gap" value={liveActiveState.pixelGap} onChange={v => updateLiveSetting('pixelGap', v)} onChangeCommitted={v => commitSetting('pixelGap', v)} onReset={() => commitSetting('pixelGap', 50)} disabled={isLoading} />
        <EnhancedSlider theme={theme} isMobile={isMobile} label="Lower Limit" value={liveActiveState.lowerLimit} onChange={v => updateLiveSetting('lowerLimit', v)} onChangeCommitted={v => commitSetting('lowerLimit', v)} onReset={() => commitSetting('lowerLimit', 0)} disabled={isLoading} />
        <EnhancedSlider theme={theme} isMobile={isMobile} label="Size Variance" value={liveActiveState.similaritySensitivity} onChange={v => updateLiveSetting('similaritySensitivity', v)} onChangeCommitted={v => commitSetting('similaritySensitivity', v)} onReset={() => commitSetting('similaritySensitivity', 50)} disabled={isLoading} />
      </div>

      <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
        <EnhancedSlider theme={theme} isMobile={isMobile} label="Glass Blur Amount" value={liveActiveState.blurAmount} onChange={v => updateLiveSetting('blurAmount', v)} onChangeCommitted={v => commitSetting('blurAmount', v)} onReset={() => commitSetting('blurAmount', 50)} disabled={isLoading} />
        <EnhancedSlider theme={theme} isMobile={isMobile} label="Index of Refraction" value={liveActiveState.ior} onChange={v => updateLiveSetting('ior', v)} onChangeCommitted={v => commitSetting('ior', v)} onReset={() => commitSetting('ior', 25)} disabled={isLoading} />
      </div>
      
      <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
        <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}><label htmlFor={`grain-toggle-${isFullScreen}`} className="text-sm">Grain</label><button id={`grain-toggle-${isFullScreen}`} role="switch" aria-checked={liveActiveState.isGrainEnabled} onClick={() => commitSetting('isGrainEnabled', !liveActiveState.isGrainEnabled)} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${liveActiveState.isGrainEnabled ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}><span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${liveActiveState.isGrainEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
         <div className={`transition-all duration-300 ease-in-out overflow-hidden ${liveActiveState.isGrainEnabled ? 'max-h-96 opacity-100 pt-4 space-y-4' : 'max-h-0 opacity-0'}`}>
            <EnhancedSlider theme={theme} isMobile={isMobile} label="Grain Size" value={liveActiveState.grainSize} onChange={v => updateLiveSetting('grainSize', v)} onChangeCommitted={v => commitSetting('grainSize', v)} onReset={() => commitSetting('grainSize', 0)} disabled={isLoading} />
            <EnhancedSlider theme={theme} isMobile={isMobile} label="Grain Amount" value={liveActiveState.grainAmount} onChange={v => updateLiveSetting('grainAmount', v)} onChangeCommitted={v => commitSetting('grainAmount', v)} onReset={() => commitSetting('grainAmount', DEFAULT_SLIDER_VALUE)} disabled={isLoading} />
        </div>
      </div>

      <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
        <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}><label htmlFor={`marker-toggle-${isFullScreen}`} className="text-sm">Markers</label><button id={`marker-toggle-${isFullScreen}`} role="switch" aria-checked={liveActiveState.isMarkerEnabled} onClick={() => commitSetting('isMarkerEnabled', !liveActiveState.isMarkerEnabled)} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${liveActiveState.isMarkerEnabled ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}><span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${liveActiveState.isMarkerEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
        <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}><label htmlFor={`bg-blur-toggle-${isFullScreen}`} className="text-sm">Background Blur</label><button id={`bg-blur-toggle-${isFullScreen}`} role="switch" aria-checked={liveActiveState.isBackgroundBlurEnabled} onClick={() => commitSetting('isBackgroundBlurEnabled', !liveActiveState.isBackgroundBlurEnabled)} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${liveActiveState.isBackgroundBlurEnabled ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}><span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${liveActiveState.isBackgroundBlurEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
        <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}><label htmlFor={`mono-toggle-${isFullScreen}`} className="text-sm">Monochrome</label><button id={`mono-toggle-${isFullScreen}`} role="switch" aria-checked={liveActiveState.isMonochrome} onClick={() => commitSetting('isMonochrome', !liveActiveState.isMonochrome)} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${liveActiveState.isMonochrome ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}><span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${liveActiveState.isMonochrome ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
      </div>
    </>
  );

  const controlsPanel = imageSrc ? (
     <div className="max-w-md mx-auto w-full flex flex-col space-y-4 px-6 sm:px-6 md:px-8 pt-6 md:pt-3 pb-8 sm:pb-6 md:pb-8">
      <AllControls />
      <div className="pt-2 flex space-x-2">
        <button onClick={clearImage} disabled={isLoading} className={`w-1/2 border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Clear the current image">Clear Image</button>
        <button onClick={handleResetCurrent} disabled={isLoading} className={`w-1/2 border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Reset controls to their default values">Reset Controls</button>
      </div>
      <div className="block md:hidden pt-8"><footer className="text-center tracking-wide">{footerLinks}</footer></div>
    </div>
  ) : null;
  
  const previewPanel = !imageSrc ? (
    <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} theme={theme} context="glassDots"/>
  ) : (
    <>
        <input type="file" ref={fullScreenFileInputRef} onChange={handleFullScreenFileInputChange} className="hidden" accept="image/*"/>
        <div className="relative flex items-center justify-center w-full h-full">
            <canvas ref={canvasRef} width={previewCanvasWidth} height={previewCanvasHeight} className={`border-2 rounded-lg ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'} ${outputType === 'wallpaper' && wallpaperType === 'phone' ? (isMobile ? 'w-4/5 h-auto' : 'max-h-full w-auto') : 'max-w-full max-h-full'}`} aria-label="Glass Dots Canvas" onMouseDown={handleDragStart} onTouchStart={handleDragStart} style={{ cursor: glassDotsCropIsNeeded ? 'grab' : 'default', touchAction: glassDotsCropIsNeeded ? 'none' : 'auto' }}/>
            <div className="absolute bottom-3 right-3 z-10 flex items-center space-x-2">
                <button onClick={() => handleShare()} className={`p-2 rounded-md transition-colors duration-300 ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`} aria-label="Share this creation"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 8.81C7.5 8.31 6.79 8 6 8c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z"/></svg></button>
                <button onClick={enterFullScreen} className={`p-2 rounded-md transition-colors duration-300 ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`} aria-label="Enter full-screen preview"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg></button>
            </div>
        </div>
        {isFullScreenPreview && createPortal(<div ref={fullScreenContainerRef} className="fixed inset-0 bg-black z-50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget && !dragState.current.hasMoved) { if (isFullScreenControlsOpen) setIsFullScreenControlsOpen(false); else exitFullScreen(); }}}>
            <canvas ref={fullScreenCanvasRef} width={previewCanvasWidth} height={previewCanvasHeight} className="max-w-full max-h-full" aria-label="Full-screen Canvas Preview" onMouseDown={handleDragStart} onTouchStart={handleDragStart} style={{ cursor: glassDotsCropIsNeeded ? 'grab' : 'default', touchAction: glassDotsCropIsNeeded ? 'none' : 'auto' }}/>
            {glassDotsCropIsNeeded && <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-2 py-1 rounded-md text-sm ${theme === 'dark' ? 'bg-nothing-dark/90 text-nothing-light' : 'bg-day-gray-light/90 text-day-text'} backdrop-blur-sm pointer-events-none`}>ⓘ Drag to Crop</div>}
            {!isMobile && <div className="fixed bottom-4 left-4 z-[51] w-80 flex flex-col items-start space-y-2">
                {isFullScreenControlsOpen ? <div className={`w-full ${theme === 'dark' ? 'bg-nothing-dark/80' : 'bg-day-bg/90 border border-gray-300/50'} backdrop-blur-sm rounded-lg p-4 max-h-[calc(100vh-10rem)] flex flex-col space-y-4 shadow-2xl`}>
                    <div className="flex justify-between items-center flex-shrink-0"><h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-day-text'}`}>Controls</h3><button onClick={() => setIsFullScreenControlsOpen(false)} className={`p-2 ${theme === 'dark' ? 'text-white hover:bg-white/20' : 'text-day-text hover:bg-black/10'} rounded-full transition-colors`} aria-label="Collapse controls"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg></button></div>
                    <div className="overflow-y-auto space-y-4 pr-2 -mr-2">
                        <AllControls isFullScreen />
                         <div>
                            <button onClick={handleResetCurrent} disabled={isLoading} className={`w-full font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border border-gray-600 text-gray-300 hover:bg-gray-700' : 'border border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Reset controls to their default values">
                                Reset Controls
                            </button>
                        </div>
                    </div>
                </div> : <button onClick={() => setIsFullScreenControlsOpen(true)} className={`w-full ${theme === 'dark' ? 'bg-nothing-dark/80 text-white hover:bg-nothing-dark' : 'bg-day-bg/90 text-day-text hover:bg-day-gray-light border border-gray-300/50'} backdrop-blur-sm font-semibold py-3 px-4 rounded-lg flex items-center justify-between shadow-lg transition-colors`} aria-label="Expand controls"><span>Controls</span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"/></svg></button>}
                <div className={`w-full ${theme === 'dark' ? 'bg-nothing-dark/80' : 'bg-day-bg/90 border border-gray-300/50'} backdrop-blur-sm rounded-lg p-2 flex flex-col items-stretch space-y-2 shadow-lg`}>
                    <button onClick={handleFullScreenReplaceClick} disabled={isLoading} className={`w-full font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border border-gray-600 text-gray-300 hover:bg-gray-700' : 'border border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Replace image">Replace Image</button>
                    <button onClick={handleDownload} disabled={isLoading || isDownloading} className={`w-full font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`} aria-label="Download image">{isDownloading ? 'Generating...' : 'Download'}</button>
                </div>
            </div>}
            <div className="fixed bottom-8 right-8 z-50 flex items-center space-x-2">
                <button onClick={() => handleShare()} className={`p-2 rounded-md transition-colors duration-300 ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`} aria-label="Share creation"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 8.81C7.5 8.31 6.79 8 6 8c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3z"/></svg></button>
                <button onClick={exitFullScreen} className={`p-2 rounded-md transition-colors duration-300 ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`} aria-label="Exit full-screen"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg></button>
            </div>
            <ToastNotification show={showFsToast} onClose={() => setShowFsToast(false)} onShare={() => {}} theme={theme} isMobile={false} imageRendered={!!imageSrc} className="z-[60] !bottom-24"/>
            <SharePopup show={showSharePopup} onClose={() => setShowSharePopup(false)} theme={theme} communityLink={communityLink} appUrl={appUrl} variant={shareVariant}/>
        </div>, document.body)}
    </>
  );

  const downloadButton = <button onClick={handleDownload} disabled={isLoading || isDownloading} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`} aria-label="Download image">{isDownloading ? 'Generating...' : 'Download'}</button>;
  const replaceButton = <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} compact={true} theme={theme}/>;

  return { previewPanel, controlsPanel, imageSrc, isLoading, handleFileSelect, downloadButton, replaceButton, glassDotsWallpaperType: wallpaperType, getCanvasBlob, undo: undoGlassDots, redo: redoGlassDots, canUndo: canUndoGlassDots, canRedo: canRedoGlassDots };
};