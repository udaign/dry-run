
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useHistory } from './hooks';
import { getTimestamp } from './utils';
import { WallpaperState, WallpaperBgKey, WALLPAPER_BG_OPTIONS, Theme } from './types';
import { Dropzone, EnhancedSlider, UndoRedoControls, ColorSelector, WallpaperTypeSelector } from './components';

const DEFAULT_SLIDER_VALUE = 50;
const WALLPAPER_PHONE_WIDTH = 1260;
const WALLPAPER_PHONE_HEIGHT = 2800;
const WALLPAPER_DESKTOP_WIDTH = 3840;
const WALLPAPER_DESKTOP_HEIGHT = 2160;
const WALLPAPER_PIXEL_GAP_MULTIPLIER = 0.08832;
const WALLPAPER_RESOLUTION_MULTIPLIER = 56.16;

const WALLPAPER_INITIAL_STATE: WallpaperState = {
    resolution: DEFAULT_SLIDER_VALUE,
    pixelGap: DEFAULT_SLIDER_VALUE,
    isCircular: true,
    background: 'black' as WallpaperBgKey,
    cropOffsetX: 0.5,
    cropOffsetY: 0.5,
};

type WallpaperSettingsContainer = {
    phone: WallpaperState;
    desktop: WallpaperState;
};

const DUAL_WALLPAPER_INITIAL_STATE: WallpaperSettingsContainer = {
    phone: { ...WALLPAPER_INITIAL_STATE },
    desktop: { ...WALLPAPER_INITIAL_STATE },
};


export const useWallpaperPanel = ({ theme, isMobile, footerLinks }: { theme: Theme, isMobile: boolean, footerLinks: React.ReactNode }) => {
  const { 
    state: wallpaperSettings, 
    setState: setWallpaperSettings, 
    undo: undoWallpaper, 
    redo: redoWallpaper, 
    reset: resetWallpaperHistory, 
    canUndo: canUndoWallpaper, 
    canRedo: canRedoWallpaper 
  } = useHistory(DUAL_WALLPAPER_INITIAL_STATE);
  
  const [liveWallpaperSettings, setLiveWallpaperSettings] = useState(wallpaperSettings);
  const [wallpaperType, setWallpaperType] = useState<'phone' | 'desktop'>('phone');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullScreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const fullScreenContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => { setLiveWallpaperSettings(wallpaperSettings); }, [wallpaperSettings]);

  const liveWallpaperState = liveWallpaperSettings[wallpaperType];
  const { resolution, pixelGap, isCircular, background, cropOffsetX, cropOffsetY } = liveWallpaperState;
  
  useEffect(() => {
    const handleFullScreenChange = () => {
        if (!document.fullscreenElement) {
            setIsFullScreenPreview(false);
        }
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  useEffect(() => {
      if (isFullScreenPreview && fullScreenContainerRef.current) {
          fullScreenContainerRef.current.requestFullscreen()
              .catch(err => {
                  console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
              });
      }
  }, [isFullScreenPreview]);

  const exitFullScreen = useCallback(() => {
      if (document.fullscreenElement) {
          document.exitFullscreen();
      } else {
          setIsFullScreenPreview(false);
      }
  }, []);

  useEffect(() => {
    if (!imageSrc) { setImage(null); return; }
    setIsLoading(true);
    const img = new Image();
    img.onload = () => { setImage(img); setIsLoading(false); };
    img.onerror = () => { setImageSrc(null); setImage(null); setIsLoading(false); };
    img.src = imageSrc;
  }, [imageSrc]);

  const [currentWallpaperWidth, currentWallpaperHeight] = useMemo(() => wallpaperType === 'desktop' ? [WALLPAPER_DESKTOP_WIDTH, WALLPAPER_DESKTOP_HEIGHT] : [WALLPAPER_PHONE_WIDTH, WALLPAPER_PHONE_HEIGHT], [wallpaperType]);

  const wallpaperGridWidth = useMemo(() => Math.floor(10 + ((wallpaperType === 'desktop' ? resolution * 4 : resolution) / 100) * WALLPAPER_RESOLUTION_MULTIPLIER), [resolution, wallpaperType]);
  const wallpaperGridHeight = useMemo(() => Math.round(wallpaperGridWidth * (currentWallpaperHeight / currentWallpaperWidth)), [wallpaperGridWidth, currentWallpaperWidth, currentWallpaperHeight]);
  const calculatedWallpaperPixelGap = useMemo(() => pixelGap * WALLPAPER_PIXEL_GAP_MULTIPLIER, [pixelGap]);
  const wallpaperCropIsNeeded = useMemo(() => image ? Math.abs((image.width / image.height) - (currentWallpaperWidth / currentWallpaperHeight)) > 0.01 : false, [image, currentWallpaperWidth, currentWallpaperHeight]);

  useEffect(() => {
    const canvases = [canvasRef.current];
    if (isFullScreenPreview) {
        canvases.push(fullScreenCanvasRef.current);
    }

    for (const canvas of canvases) {
        if (!canvas) continue;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = WALLPAPER_BG_OPTIONS[background]?.color || '#000000';
        ctx.fillRect(0, 0, currentWallpaperWidth, currentWallpaperHeight);
        if (!image) return;
        const imgAspect = image.width / image.height, canvasAspect = currentWallpaperWidth / currentWallpaperHeight;
        let sx = 0, sy = 0, sWidth = image.width, sHeight = image.height;
        if (imgAspect > canvasAspect) { sWidth = image.height * canvasAspect; sx = (image.width - sWidth) * cropOffsetX; }
        else if (imgAspect < canvasAspect) { sHeight = image.width / canvasAspect; sy = (image.height - sHeight) * cropOffsetY; }
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = wallpaperGridWidth; tempCanvas.height = wallpaperGridHeight;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        if (!tempCtx) return;
        tempCtx.imageSmoothingEnabled = false;
        tempCtx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, wallpaperGridWidth, wallpaperGridHeight);
        const data = tempCtx.getImageData(0, 0, wallpaperGridWidth, wallpaperGridHeight).data;
        const totalGapW = (wallpaperGridWidth - 1) * calculatedWallpaperPixelGap;
        const totalGapH = (wallpaperGridHeight - 1) * calculatedWallpaperPixelGap;
        const pxRenderW = (currentWallpaperWidth - totalGapW) / wallpaperGridWidth;
        const pxRenderH = (currentWallpaperHeight - totalGapH) / wallpaperGridHeight;
        for (let y = 0; y < wallpaperGridHeight; y++) {
            for (let x = 0; x < wallpaperGridWidth; x++) {
                const i = (y * wallpaperGridWidth + x) * 4;
                ctx.fillStyle = `rgb(${data[i]}, ${data[i+1]}, ${data[i+2]})`;
                const drawX = x * (pxRenderW + calculatedWallpaperPixelGap), drawY = y * (pxRenderH + calculatedWallpaperPixelGap);
                if (isCircular) {
                    ctx.beginPath();
                    ctx.arc(drawX + pxRenderW / 2, drawY + pxRenderH / 2, Math.min(pxRenderW, pxRenderH) / 2, 0, 2 * Math.PI);
                    ctx.fill();
                } else {
                    ctx.fillRect(drawX, drawY, pxRenderW, pxRenderH);
                }
            }
        }
      }
  }, [image, wallpaperGridWidth, wallpaperGridHeight, calculatedWallpaperPixelGap, isCircular, background, currentWallpaperWidth, currentWallpaperHeight, cropOffsetX, cropOffsetY, isFullScreenPreview]);
  
  const handleFileSelect = (file: File) => {
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageSrc(e.target?.result as string);
      resetWallpaperHistory();
      setIsLoading(false);
    };
    reader.readAsDataURL(file);
  };
  
  const handleDownload = () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setTimeout(() => {
        try {
            const canvas = canvasRef.current;
            if (!canvas) {
                throw new Error('Wallpaper canvas not found for download.');
            }
            canvas.toBlob((blob) => {
                try {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.download = `matrices-wallpaper-${getTimestamp()}.png`;
                        link.href = url;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                    }
                } finally {
                    setIsDownloading(false);
                }
            }, 'image/png');
        } catch(e) {
            console.error("Error preparing wallpaper for download:", e);
            setIsDownloading(false);
        }
    }, 50);
  };

  const dragState = useRef({ isDragging: false, startX: 0, startY: 0, initialOffsetX: 0.5, initialOffsetY: 0.5, hasMoved: false });
  
  const handleWallpaperDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
      if (!wallpaperCropIsNeeded) return;
      
      e.preventDefault();

      dragState.current.isDragging = true;
      dragState.current.hasMoved = false;
      
      const point = 'touches' in e ? e.touches[0] : e;
      dragState.current.startX = point.clientX;
      dragState.current.startY = point.clientY;
      dragState.current.initialOffsetX = liveWallpaperSettings[wallpaperType].cropOffsetX;
      dragState.current.initialOffsetY = liveWallpaperSettings[wallpaperType].cropOffsetY;
      
      document.body.style.cursor = 'grabbing';
  }, [wallpaperCropIsNeeded, liveWallpaperSettings, wallpaperType]);

  const handleWallpaperDragMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (!dragState.current.isDragging || !image) return;
      
      dragState.current.hasMoved = true;

      const point = 'touches' in e ? e.touches[0] : e;
      
      let deltaX = point.clientX - dragState.current.startX;
      let deltaY = point.clientY - dragState.current.startY;

      if (wallpaperType === 'desktop') {
          const sensitivityMultiplier = isMobile ? 4.0 : 2.5;
          deltaX *= sensitivityMultiplier;
          deltaY *= sensitivityMultiplier;
      }
      
      const imgAspect = image.width / image.height;
      const canvasAspect = currentWallpaperWidth / currentWallpaperHeight;
      
      let panRangeX = 0, panRangeY = 0;
      if (imgAspect > canvasAspect) { panRangeX = (currentWallpaperHeight * imgAspect) - currentWallpaperWidth; }
      else if (imgAspect < canvasAspect) { panRangeY = (currentWallpaperWidth / imgAspect) - currentWallpaperHeight; }
      
      let newOffsetX = panRangeX > 0 ? dragState.current.initialOffsetX - (deltaX / panRangeX) : dragState.current.initialOffsetX;
      let newOffsetY = panRangeY > 0 ? dragState.current.initialOffsetY - (deltaY / panRangeY) : dragState.current.initialOffsetY;
      
      setLiveWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], cropOffsetX: Math.max(0, Math.min(1, newOffsetX)), cropOffsetY: Math.max(0, Math.min(1, newOffsetY)) } }));
  }, [image, currentWallpaperWidth, currentWallpaperHeight, wallpaperType, isMobile]);

  const handleWallpaperDragEnd = useCallback(() => {
      if (dragState.current.isDragging) {
          dragState.current.isDragging = false;
          
          const { cropOffsetX: liveCropOffsetX, cropOffsetY: liveCropOffsetY } = liveWallpaperSettings[wallpaperType];
          setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], cropOffsetX: liveCropOffsetX, cropOffsetY: liveCropOffsetY } }));
          
          document.body.style.cursor = 'default';
      }
  }, [liveWallpaperSettings, wallpaperType, setWallpaperSettings]);

  useEffect(() => {
      const onMove = (e: MouseEvent | TouchEvent) => handleWallpaperDragMove(e);
      const onEnd = () => handleWallpaperDragEnd();

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
  }, [handleWallpaperDragMove, handleWallpaperDragEnd]);

  const controlsPanel = imageSrc ? (
     <div className="max-w-md mx-auto w-full flex flex-col space-y-4 px-6 sm:px-6 md:px-8 pt-6 md:pt-3 pb-8 sm:pb-6 md:pb-8">
      <div className="pb-4">
          <WallpaperTypeSelector selected={wallpaperType} onSelect={setWallpaperType} theme={theme} />
      </div>
      <UndoRedoControls onUndo={undoWallpaper} onRedo={redoWallpaper} canUndo={canUndoWallpaper} canRedo={canRedoWallpaper} theme={theme} />
      <EnhancedSlider 
          theme={theme} 
          label="Resolution" 
          value={resolution} 
          onChange={v => setLiveWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], resolution: v } }))} 
          onChangeCommitted={v => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], resolution: v } }))}
          onReset={() => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], resolution: DEFAULT_SLIDER_VALUE } }))}
          disabled={isLoading} 
      />
      <EnhancedSlider 
          theme={theme} 
          label="Pixel Gap" 
          value={pixelGap} 
          onChange={v => setLiveWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], pixelGap: v } }))}
          onChangeCommitted={v => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], pixelGap: v } }))} 
          onReset={() => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], pixelGap: DEFAULT_SLIDER_VALUE } }))}
          disabled={isLoading} 
      />
      
      <div className={`border-t ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'} mt-6 pt-4`}>
          <button onClick={() => setShowAdvanced(!showAdvanced)} className={`w-full flex justify-between items-center ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'} py-1 focus:outline-none`} aria-expanded={showAdvanced} aria-controls="wallpaper-advanced-options-panel">
              <span className="text-sm font-medium">More Controls</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 transform transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
          </button>
          <div id="wallpaper-advanced-options-panel" className={`overflow-hidden transition-all duration-500 ease-in-out ${showAdvanced ? 'max-h-96 pt-4' : 'max-h-0'}`}>
              <div className="space-y-4">
                  <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                      <label htmlFor="wallpaper-circular-toggle" className="text-sm">Circular Pixels</label>
                      <button id="wallpaper-circular-toggle" role="switch" aria-checked={isCircular} onClick={() => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], isCircular: !s[wallpaperType].isCircular } }))} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} disabled:opacity-50 ${isCircular ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                          <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isCircular ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                  </div>
                  <ColorSelector label="Background Color" options={WALLPAPER_BG_OPTIONS} selected={liveWallpaperState.background} onSelect={(key) => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], background: key as WallpaperBgKey } }))} theme={theme} />
              </div>
          </div>
      </div>
      <div className="pt-6">
        <button onClick={() => resetWallpaperHistory()} disabled={isLoading} className={`w-full border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Restore wallpaper settings to their default values"> Restore Defaults </button>
      </div>
      <div className="block md:hidden pt-8"><footer className="text-center tracking-wide">{footerLinks}</footer></div>
    </div>
  ) : null;
  
  const previewPanel = !imageSrc ? (
    <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} theme={theme}/>
  ) : (
    <>
        <div className="relative flex items-center justify-center w-full h-full">
            <canvas 
                ref={canvasRef} 
                width={currentWallpaperWidth} 
                height={currentWallpaperHeight} 
                className={`border-2 rounded-lg ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'} ${wallpaperType === 'phone' ? (isMobile ? 'w-4/5 h-auto' : 'max-h-full w-auto') : 'max-w-full max-h-full'}`} 
                aria-label="Wallpaper Canvas" 
                onMouseDown={handleWallpaperDragStart}
                onTouchStart={handleWallpaperDragStart}
                style={{
                    cursor: wallpaperCropIsNeeded ? 'grab' : 'default',
                    touchAction: wallpaperCropIsNeeded ? 'none' : 'auto'
                }}
            />
            <button
                onClick={() => setIsFullScreenPreview(true)}
                className={`absolute bottom-3 right-3 z-10 p-2 rounded-md transition-colors duration-300 ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`}
                aria-label="Enter full-screen preview"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
            </button>
        </div>
        {isFullScreenPreview && createPortal(
            <div
                ref={fullScreenContainerRef}
                className="fixed inset-0 bg-black z-50 flex items-center justify-center"
                onMouseDown={(e) => {
                    if (e.target === e.currentTarget) {
                        dragState.current.hasMoved = false;
                    }
                }}
                onClick={(e) => { if (e.target === e.currentTarget && !dragState.current.hasMoved) exitFullScreen(); }}
            >
                <canvas
                    ref={fullScreenCanvasRef}
                    width={currentWallpaperWidth}
                    height={currentWallpaperHeight}
                    className="max-w-full max-h-full"
                    aria-label="Full-screen Wallpaper Canvas Preview"
                    onMouseDown={handleWallpaperDragStart}
                    onTouchStart={handleWallpaperDragStart}
                    style={{
                        cursor: wallpaperCropIsNeeded ? 'grab' : 'default',
                        touchAction: wallpaperCropIsNeeded ? 'none' : 'auto'
                    }}
                />
                <button
                    onClick={exitFullScreen}
                    className="fixed bottom-3 right-3 z-50 p-2 rounded-md transition-colors duration-300 text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark"
                    aria-label="Exit full-screen preview"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                      <polyline points="4 14 10 14 10 20"></polyline>
                      <polyline points="20 10 14 10 14 4"></polyline>
                      <line x1="14" y1="10" x2="21" y2="3"></line>
                      <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                </button>
            </div>,
            document.body
        )}
    </>
  );

  const downloadButton = <button onClick={handleDownload} disabled={isLoading || isDownloading} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`} aria-label="Download the current wallpaper"> Download </button>;

  const replaceButton = <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} compact={true} theme={theme}/>;

  return { previewPanel, controlsPanel, imageSrc, isLoading, handleFileSelect, handleDownload, downloadButton, replaceButton, wallpaperType };
};