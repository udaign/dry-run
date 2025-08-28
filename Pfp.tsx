
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useHistory } from './hooks';
import { getTimestamp } from './utils';
import { PfpState, RawPixel, Theme } from './types';
import { Dropzone, EnhancedSlider, UndoRedoControls } from './components';
import { trackEvent } from './analytics';

const CANVAS_SIZE = 1176;
const PADDING = 50;
const DEFAULT_SLIDER_VALUE = 50;
const NOTHING_DARK_COLOR = '#000000';

const PFP_INITIAL_STATE: PfpState = {
    resolution: DEFAULT_SLIDER_VALUE,
    exposure: DEFAULT_SLIDER_VALUE,
    contrast: DEFAULT_SLIDER_VALUE,
    pixelGap: DEFAULT_SLIDER_VALUE,
    isCircular: false,
    isTransparent: false,
    isAntiAliased: false,
    isGlowEnabled: false,
    glowIntensity: DEFAULT_SLIDER_VALUE,
    cropOffsetX: 0.5,
    cropOffsetY: 0.5,
};

const drawPfpMatrix = (ctx: CanvasRenderingContext2D, options: {
    width: number;
    height: number;
    isTransparent: boolean;
    gridColors: (string | null)[][];
    matrixMask: number[][];
    diameter: number;
    calculatedPixelGap: number;
    isCircular: boolean;
    padding: number;
    isGlowEnabled: boolean;
    glowIntensity: number;
}) => {
    const { width, height, isTransparent: transparent, gridColors: colors, matrixMask: mask, diameter: diam, calculatedPixelGap: gap, isCircular: circular, padding, isGlowEnabled, glowIntensity } = options;

    if (transparent) {
        ctx.clearRect(0, 0, width, height);
    } else {
        ctx.fillStyle = NOTHING_DARK_COLOR;
        ctx.fillRect(0, 0, width, height);
    }

    const drawableArea = width - padding * 2;
    if (drawableArea <= 0) return;

    const totalGapSize = (diam - 1) * gap;
    const totalPixelSize = drawableArea - totalGapSize;
    const pixelRenderSize = totalPixelSize / diam;

    if (pixelRenderSize <= 0) return;
    
    colors.forEach((row, y) => {
        row.forEach((color, x) => {
            const coverage = mask[y]?.[x] ?? 0;
            if (color && coverage > 0) {
                const drawX = padding + x * (pixelRenderSize + gap);
                const drawY = padding + y * (pixelRenderSize + gap);
                
                const finalPixelSize = pixelRenderSize * Math.pow(coverage, 0.35);
                const offset = (pixelRenderSize - finalPixelSize) / 2;
                
                // 1. Draw base pixel
                ctx.fillStyle = color;
                if (circular) {
                    ctx.beginPath();
                    ctx.arc(drawX + pixelRenderSize / 2, drawY + pixelRenderSize / 2, finalPixelSize / 2, 0, 2 * Math.PI);
                    ctx.fill();
                } else {
                    ctx.fillRect(drawX + offset, drawY + offset, finalPixelSize, finalPixelSize);
                }

                // 2. Draw glow on top
                if (isGlowEnabled && glowIntensity > 0) {
                    const brightness = parseInt(color.substring(4, color.indexOf(',')));
                    if (brightness > 30) {
                        ctx.save();
                        ctx.globalCompositeOperation = 'lighter';
                        const glowStrength = glowIntensity / 100;

                        const glowSize = finalPixelSize * (1 + glowStrength * 1.5);
                        const glowOffset = (pixelRenderSize - glowSize) / 2;
                        const glowOpacity = Math.pow(brightness / 255, 2) * glowStrength * 0.5;
                        ctx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, ${glowOpacity})`;

                        if (circular) {
                            ctx.beginPath();
                            ctx.arc(drawX + pixelRenderSize / 2, drawY + pixelRenderSize / 2, glowSize / 2, 0, 2 * Math.PI);
                            ctx.fill();
                        } else {
                            ctx.fillRect(drawX + glowOffset, drawY + glowOffset, glowSize, glowSize);
                        }
                        
                        ctx.restore();
                    }
                }
            }
        });
    });
};

export const usePfpPanel = ({ theme, isMobile, footerLinks, triggerShareToast }: { theme: Theme, isMobile: boolean, footerLinks: React.ReactNode, triggerShareToast: (showSpecificToast?: () => void) => void }) => {
  const { state: pfpState, setState: setPfpState, undo: undoPfp, redo: redoPfp, reset: resetPfp, canUndo: canUndoPfp, canRedo: canRedoPfp } = useHistory(PFP_INITIAL_STATE);
  const [livePfpState, setLivePfpState] = useState(pfpState);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [uploadTimestamp, setUploadTimestamp] = useState<number | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [rawPixelGrid, setRawPixelGrid] = useState<(RawPixel | null)[][]>([]);

  const { resolution, exposure, contrast, pixelGap, isCircular, isTransparent, isAntiAliased, isGlowEnabled, glowIntensity, cropOffsetX, cropOffsetY } = livePfpState;

  useEffect(() => { setLivePfpState(pfpState); }, [pfpState]);
  
  useEffect(() => {
    if (!imageSrc) { setImage(null); return; }
    setIsLoading(true);
    const img = new Image();
    img.onload = () => { setImage(img); setIsLoading(false); };
    img.onerror = () => { setImageSrc(null); setImage(null); setIsLoading(false); };
    img.src = imageSrc;
  }, [imageSrc]);

  const diameter = useMemo(() => Math.floor((0.32 * resolution + 9) / 2) * 2 + 1, [resolution]);
  const radius = useMemo(() => diameter / 2, [diameter]);
  const center = useMemo(() => radius - 0.5, [radius]);
  
  const pfpCropIsNeeded = useMemo(() => image ? Math.abs((image.width / image.height) - 1) > 0.01 : false, [image]);

  const calculatedExposure = useMemo(() => (exposure - 50) * 2, [exposure]);
  const calculatedContrast = useMemo(() => contrast <= 50 ? contrast / 50 : 1 + ((contrast - 50) / 50) * 2, [contrast]);
  const calculatedPixelGap = useMemo(() => (pixelGap / 100) * 27.6, [pixelGap]);

  const matrixMask = useMemo(() => {
    const mask: number[][] = Array(diameter).fill(0).map(() => Array(diameter).fill(0));
    const isOriginalPixel = (x: number, y: number) => Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2)) <= radius;
    if (!isAntiAliased) {
      for (let y = 0; y < diameter; y++) for (let x = 0; x < diameter; x++) mask[y][x] = isOriginalPixel(x, y) ? 1 : 0;
      return mask;
    }
    const ssFactor = 5, subPixelStep = 1 / ssFactor, totalSubPixels = ssFactor * ssFactor;
    for (let y = 0; y < diameter; y++) {
      for (let x = 0; x < diameter; x++) {
        if (isOriginalPixel(x, y)) { mask[y][x] = 1; } 
        else if (Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2)) < radius + 1.5) {
          let pointsInside = 0;
          for (let subY = 0; subY < ssFactor; subY++) {
            for (let subX = 0; subX < ssFactor; subX++) {
              const currentX = (x - 0.5 + subPixelStep * (subX + 0.5)) - center;
              const currentY = (y - 0.5 + subPixelStep * (subY + 0.5)) - center;
              if (Math.sqrt(currentX * currentX + currentY * currentY) <= radius) pointsInside++;
            }
          }
          if (pointsInside > 0) mask[y][x] = pointsInside / totalSubPixels;
        }
      }
    }
    return mask;
  }, [diameter, center, radius, isAntiAliased]);

  const generateDefaultGridData = useCallback(() => matrixMask.map(row => row.map(coverage => (coverage > 0 ? 107 : null))), [matrixMask]);

  useEffect(() => {
    const regenerateGrid = () => {
      if (image) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = diameter; tempCanvas.height = diameter;
        const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        
        const imgAspect = image.width / image.height;
        let sx = 0, sy = 0, sWidth = image.width, sHeight = image.height;
        if (imgAspect > 1) { // Landscape
            sWidth = image.height;
            sx = (image.width - sWidth) * cropOffsetX;
        } else if (imgAspect < 1) { // Portrait
            sHeight = image.width;
            sy = (image.height - sHeight) * cropOffsetY;
        }
        ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, diameter, diameter);

        const data = ctx.getImageData(0, 0, diameter, diameter).data;
        const newGrid = Array.from({ length: diameter }, (_, y) => Array.from({ length: diameter }, (_, x) => {
            if (matrixMask[y]?.[x] > 0) {
                const i = (y * diameter + x) * 4;
                return Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
            }
            return null;
        }));
        setRawPixelGrid(newGrid);
      } else {
        setRawPixelGrid(generateDefaultGridData());
      }
    };
    regenerateGrid();
  }, [diameter, matrixMask, image, cropOffsetX, cropOffsetY, generateDefaultGridData]);

  const gridColors = useMemo(() => rawPixelGrid.map(row => row.map(pixel => {
    if (pixel === null) return null;
    const val = typeof pixel === 'number' ? pixel : (pixel.r * 0.299 + pixel.g * 0.587 + pixel.b * 0.114);
    let adjusted = imageSrc ? ((val / 255.0 - 0.5) * calculatedContrast + 0.5) * 255.0 + calculatedExposure : val;
    const finalGray = Math.round(Math.max(0, Math.min(255, adjusted)));
    return `rgb(${finalGray}, ${finalGray}, ${finalGray})`;
  })), [rawPixelGrid, calculatedExposure, calculatedContrast, imageSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !gridColors || gridColors.length !== diameter || matrixMask.length !== diameter) return;
    
    // Draw main canvas
    drawPfpMatrix(ctx, { 
      width: CANVAS_SIZE, 
      height: CANVAS_SIZE, 
      isTransparent, 
      gridColors, 
      matrixMask, 
      diameter, 
      calculatedPixelGap, 
      isCircular,
      padding: PADDING,
      isGlowEnabled,
      glowIntensity,
    });
    
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) return;
    const previewCtx = previewCanvas.getContext('2d');
    if (!previewCtx) return;

    // Prepare preview canvas background
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    if (isTransparent) {
        previewCtx.fillStyle = theme === 'dark' ? '#14151f' : '#efefef';
        previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    }

    // Set up circular clipping mask
    previewCtx.save();
    previewCtx.beginPath();
    previewCtx.arc(previewCanvas.width / 2, previewCanvas.height / 2, previewCanvas.width / 2, 0, Math.PI * 2);
    previewCtx.clip();
    
    // Calculate scaled parameters for preview
    const scaleFactor = previewCanvas.width / CANVAS_SIZE;
    const previewPadding = PADDING * scaleFactor;
    const previewPixelGap = calculatedPixelGap * scaleFactor;
    
    // Draw matrix directly into the clipped circle, avoiding browser scaling artifacts
    drawPfpMatrix(previewCtx, {
      width: previewCanvas.width,
      height: previewCanvas.height,
      isTransparent,
      gridColors, 
      matrixMask, 
      diameter, 
      calculatedPixelGap: previewPixelGap,
      isCircular,
      padding: previewPadding,
      isGlowEnabled,
      glowIntensity,
    });
    
    previewCtx.restore();
  }, [gridColors, calculatedPixelGap, diameter, isCircular, matrixMask, isTransparent, theme, isGlowEnabled, glowIntensity]);

  const handleFileSelect = (file: File) => {
    setIsLoading(true);
    trackEvent('upload_image', { feature: 'pfp' });
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageSrc(e.target?.result as string);
      setUploadTimestamp(Date.now());
      resetPfp();
    };
    reader.readAsDataURL(file);
  };
  
  const handleDownload = () => {
    if (isDownloading) return;
    setIsDownloading(true);

    const eventParams: Record<string, string | number | boolean | undefined> = {
      feature: 'pfp',
      setting_resolution: livePfpState.resolution,
      setting_exposure: livePfpState.exposure,
      setting_contrast: livePfpState.contrast,
      setting_pixel_gap: livePfpState.pixelGap,
      setting_is_circular: livePfpState.isCircular,
      setting_is_transparent: livePfpState.isTransparent,
      setting_is_anti_aliased: livePfpState.isAntiAliased,
      setting_is_glow_enabled: livePfpState.isGlowEnabled,
      setting_glow_intensity: livePfpState.glowIntensity,
    };

    if (uploadTimestamp) {
      const durationInSeconds = Math.round((Date.now() - uploadTimestamp) / 1000);
      eventParams.duration_seconds = durationInSeconds;
    }
    
    trackEvent('download', eventParams);

    setTimeout(() => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = CANVAS_SIZE; canvas.height = CANVAS_SIZE;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Failed to get canvas context for download.');
            }
            drawPfpMatrix(ctx, {
              width: CANVAS_SIZE,
              height: CANVAS_SIZE,
              isTransparent: livePfpState.isTransparent,
              gridColors,
              matrixMask,
              diameter,
              calculatedPixelGap,
              isCircular: livePfpState.isCircular,
              padding: PADDING,
              isGlowEnabled: livePfpState.isGlowEnabled,
              glowIntensity: livePfpState.glowIntensity,
            });
            
            canvas.toBlob((blob) => {
                try {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.download = `matrices-glyphmirror-${getTimestamp()}.png`;
                        link.href = url;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        triggerShareToast();
                    }
                } finally {
                    setIsDownloading(false);
                }
            }, 'image/png');
        } catch(e) {
            console.error("Error preparing PFP for download:", e);
            setIsDownloading(false);
        }
    }, 50);
  };

  const dragState = useRef({ isDragging: false, startX: 0, startY: 0, initialOffsetX: 0.5, initialOffsetY: 0.5, hasMoved: false });
  
  const handlePfpDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
      if (!pfpCropIsNeeded) return;
      e.preventDefault();
      dragState.current.isDragging = true;
      dragState.current.hasMoved = false;
      const point = 'touches' in e ? e.touches[0] : e;
      dragState.current.startX = point.clientX;
      dragState.current.startY = point.clientY;
      dragState.current.initialOffsetX = livePfpState.cropOffsetX;
      dragState.current.initialOffsetY = livePfpState.cropOffsetY;
      document.body.style.cursor = 'grabbing';
  }, [pfpCropIsNeeded, livePfpState.cropOffsetX, livePfpState.cropOffsetY]);

  const handlePfpDragMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (!dragState.current.isDragging || !image) return;
      dragState.current.hasMoved = true;
      const point = 'touches' in e ? e.touches[0] : e;
      let deltaX = point.clientX - dragState.current.startX;
      let deltaY = point.clientY - dragState.current.startY;
      
      const activeCanvas = canvasRef.current;
      if (!activeCanvas) return;

      const rect = activeCanvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      
      const imgAspect = image.width / image.height;
      let newOffsetX = dragState.current.initialOffsetX;
      let newOffsetY = dragState.current.initialOffsetY;
      
      if (imgAspect > 1) { // Landscape
          const sWidth = image.height;
          const panRange = image.width - sWidth;
          if (panRange > 0) {
              const dragFraction = deltaX / rect.width;
              newOffsetX = dragState.current.initialOffsetX - (dragFraction * (sWidth / panRange));
          }
      } else if (imgAspect < 1) { // Portrait
          const sHeight = image.width;
          const panRange = image.height - sHeight;
          if (panRange > 0) {
              const dragFraction = deltaY / rect.height;
              newOffsetY = dragState.current.initialOffsetY - (dragFraction * (sHeight / panRange));
          }
      }
      
      setLivePfpState(s => ({ ...s, cropOffsetX: Math.max(0, Math.min(1, newOffsetX)), cropOffsetY: Math.max(0, Math.min(1, newOffsetY)) }));
  }, [image]);

  const handlePfpDragEnd = useCallback(() => {
      if (dragState.current.isDragging) {
          dragState.current.isDragging = false;
          if (dragState.current.hasMoved) {
            trackEvent('pfp_crop');
          }
          const { cropOffsetX: liveCropOffsetX, cropOffsetY: liveCropOffsetY } = livePfpState;
          setPfpState(s => ({ ...s, cropOffsetX: liveCropOffsetX, cropOffsetY: liveCropOffsetY }));
          document.body.style.cursor = 'default';
      }
  }, [livePfpState, setPfpState]);

  const handleResetPfp = useCallback(() => {
    trackEvent('pfp_reset_defaults');
    setPfpState(currentState => ({
      ...PFP_INITIAL_STATE,
      cropOffsetX: currentState.cropOffsetX,
      cropOffsetY: currentState.cropOffsetY,
    }));
  }, [setPfpState]);

  useEffect(() => {
      const onMove = (e: MouseEvent | TouchEvent) => handlePfpDragMove(e);
      const onEnd = () => handlePfpDragEnd();
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
          document.removeEventListener('touchcancel', onEnd);
      }
  }, [handlePfpDragMove, handlePfpDragEnd]);
  
  const activePixelCount = useMemo(() => {
    const total = matrixMask.flat().reduce((sum, v) => sum + v, 0);
    return isAntiAliased ? total.toFixed(2) : total;
  }, [matrixMask, isAntiAliased]);

  const controlsPanel = imageSrc ? (
    <div className="max-w-md mx-auto w-full flex flex-col space-y-4 px-6 sm:px-6 md:px-8 pt-6 md:pt-3 pb-8 sm:pb-6 md:pb-8">
        <UndoRedoControls onUndo={() => { undoPfp(); trackEvent('pfp_undo'); }} onRedo={() => { redoPfp(); trackEvent('pfp_redo'); }} canUndo={canUndoPfp} canRedo={canRedoPfp} theme={theme} />
        
        <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
          <EnhancedSlider theme={theme} isMobile={isMobile} label="Exposure" value={exposure} onChange={v => setLivePfpState(s => ({...s, exposure: v}))} onChangeCommitted={v => { setPfpState(s => ({...s, exposure: v})); trackEvent('pfp_slider_change', { slider_name: 'exposure', value: v }); }} onReset={() => setPfpState(s => ({...s, exposure: DEFAULT_SLIDER_VALUE}))} disabled={!imageSrc || isLoading} />
          <EnhancedSlider theme={theme} isMobile={isMobile} label="Contrast" value={contrast} onChange={v => setLivePfpState(s => ({...s, contrast: v}))} onChangeCommitted={v => { setPfpState(s => ({...s, contrast: v})); trackEvent('pfp_slider_change', { slider_name: 'contrast', value: v }); }} onReset={() => setPfpState(s => ({...s, contrast: DEFAULT_SLIDER_VALUE}))} disabled={!imageSrc || isLoading} />
          <EnhancedSlider theme={theme} isMobile={isMobile} label="Resolution" value={resolution} onChange={v => setLivePfpState(s => ({...s, resolution: v}))} onChangeCommitted={v => { setPfpState(s => ({...s, resolution: v})); trackEvent('pfp_slider_change', { slider_name: 'resolution', value: v }); }} onReset={() => setPfpState(s => ({...s, resolution: DEFAULT_SLIDER_VALUE}))} disabled={isLoading} />
          <EnhancedSlider theme={theme} isMobile={isMobile} label="Pixel Gap" value={pixelGap} onChange={v => setLivePfpState(s => ({...s, pixelGap: v}))} onChangeCommitted={v => { setPfpState(s => ({...s, pixelGap: v})); trackEvent('pfp_slider_change', { slider_name: 'pixel_gap', value: v }); }} onReset={() => setPfpState(s => ({...s, pixelGap: DEFAULT_SLIDER_VALUE}))} disabled={isLoading} />
        </div>

        <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
            <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                <label htmlFor="glow-toggle" className="text-sm">Glow Effect</label>
                <button id="glow-toggle" role="switch" aria-checked={isGlowEnabled} onClick={() => { setPfpState(s => ({...s, isGlowEnabled: !s.isGlowEnabled})); trackEvent('pfp_toggle_change', { setting: 'glow_effect', enabled: !pfpState.isGlowEnabled }); }} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isGlowEnabled ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`} >
                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isGlowEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isGlowEnabled ? 'max-h-48 opacity-100 pt-4' : 'max-h-0 opacity-0'}`}>
                <EnhancedSlider 
                    theme={theme} 
                    isMobile={isMobile} 
                    label="Glow Intensity" 
                    value={glowIntensity} 
                    onChange={v => setLivePfpState(s => ({...s, glowIntensity: v}))} 
                    onChangeCommitted={v => { setPfpState(s => ({...s, glowIntensity: v})); trackEvent('pfp_slider_change', { slider_name: 'glow_intensity', value: v }); }} 
                    onReset={() => setPfpState(s => ({...s, glowIntensity: DEFAULT_SLIDER_VALUE}))} 
                    disabled={isLoading || !isGlowEnabled} 
                />
            </div>
        </div>
        
        <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
            <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                <label htmlFor="circular-toggle" className="text-sm">Circular Pixels</label>
                <button id="circular-toggle" role="switch" aria-checked={isCircular} onClick={() => { setPfpState(s => ({...s, isCircular: !s.isCircular})); trackEvent('pfp_toggle_change', { setting: 'circular_pixels', enabled: !pfpState.isCircular }); }} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isCircular ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`} >
                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isCircular ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                <label htmlFor="aa-toggle" className="text-sm">Anti-aliasing</label>
                <button id="aa-toggle" role="switch" aria-checked={isAntiAliased} onClick={() => {
                    setPfpState(s => ({ ...s, isAntiAliased: !s.isAntiAliased, }));
                    trackEvent('pfp_toggle_change', { setting: 'anti_aliasing', enabled: !pfpState.isAntiAliased });
                }} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} disabled:opacity-50 ${isAntiAliased ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isAntiAliased ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
            
            <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                <label htmlFor="transparent-toggle" className="text-sm">Transparent Output</label>
                <button id="transparent-toggle" role="switch" aria-checked={isTransparent} onClick={() => { setPfpState(s => ({...s, isTransparent: !s.isTransparent})); trackEvent('pfp_toggle_change', { setting: 'transparent_output', enabled: !pfpState.isTransparent }); }} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isTransparent ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`} >
                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isTransparent ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>

        <div className="pt-2">
            <button onClick={handleResetPfp} disabled={isLoading} className={`w-full border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Reset all controls to their default values"> Reset Controls </button>
        </div>
        <div className="block md:hidden pt-8">
            <footer className="text-center tracking-wide">{footerLinks}</footer>
        </div>
    </div>
  ) : null;

  const previewPanel = !imageSrc ? (
    <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} theme={theme} context="pfp" />
  ) : (
    <div className="w-full max-w-md mx-auto">
      <header className="text-center mb-4">
        <p className={`${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'} text-sm md:text-base`}>
          Diameter: <span className={`font-semibold ${theme === 'dark' ? 'text-nothing-light' : 'text-day-text'}`}>{diameter}px</span> | Pixels: <span className={`font-semibold ${theme === 'dark' ? 'text-nothing-light' : 'text-day-text'}`}>{activePixelCount}</span>
        </p>
      </header>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="w-full h-auto rounded-lg"
        aria-label="Pixel Matrix Canvas"
        onMouseDown={handlePfpDragStart}
        onTouchStart={handlePfpDragStart}
        style={{
            cursor: pfpCropIsNeeded ? 'grab' : 'default',
            touchAction: pfpCropIsNeeded ? 'none' : 'auto'
        }}
      />
      <div className="flex flex-col items-center my-6">
          <p className={`text-sm ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'} mb-2 text-center`}>Profile Picture Preview</p>
          <canvas ref={previewCanvasRef} width={75} height={75} className={`rounded-full`} aria-label="Profile Picture Preview" />
      </div>
    </div>
  );

  const downloadButton = <button onClick={handleDownload} disabled={isLoading || isDownloading} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`} aria-label="Download the current image"> Download </button>;

  const replaceButton = <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} compact={true} theme={theme}/>;

  return { previewPanel, controlsPanel, imageSrc, isLoading, handleFileSelect, handleDownload, downloadButton, replaceButton };
};
