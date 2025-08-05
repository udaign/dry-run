
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
const WALLPAPER_PIXEL_GAP_MULTIPLIER = 0.0423936;
const WALLPAPER_RESOLUTION_MULTIPLIER = 71.8848;

const WALLPAPER_INITIAL_STATE: WallpaperState = {
    resolution: DEFAULT_SLIDER_VALUE,
    pixelGap: DEFAULT_SLIDER_VALUE,
    background: 'black' as WallpaperBgKey,
    cropOffsetX: 0.5,
    cropOffsetY: 0.5,
    isMonochrome: false,
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
  const [wallpaperType, setWallpaperType] = useState<'phone' | 'desktop'>(isMobile ? 'phone' : 'desktop');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullScreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const fullScreenContainerRef = useRef<HTMLDivElement>(null);
  const [isPrefsOpen, setIsPrefsOpen] = useState(false);
  const [isFullScreenControlsOpen, setIsFullScreenControlsOpen] = useState(false);

  useEffect(() => { setLiveWallpaperSettings(wallpaperSettings); }, [wallpaperSettings]);

  const liveWallpaperState = liveWallpaperSettings[wallpaperType];
  const { resolution, pixelGap, background, cropOffsetX, cropOffsetY, isMonochrome } = liveWallpaperState;
  
  useEffect(() => {
    const handleFullScreenChange = () => {
        if (!document.fullscreenElement) {
            setIsFullScreenPreview(false);
            setIsFullScreenControlsOpen(false); // Close controls on exit
        }
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const requestFullScreen = useCallback(() => {
    if (fullScreenContainerRef.current) {
      fullScreenContainerRef.current.requestFullscreen()
        .catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    }
  }, []);
  
  const enterFullScreen = () => {
      setIsFullScreenPreview(true);
  };
  
  useEffect(() => {
    if (isFullScreenPreview) {
      // The request must be called in a user-initiated event handler.
      // We set state and then call it, but it's better to call it directly.
      // The button onClick will call `enterFullScreen`, which sets state.
      // A useEffect watching that state is a good place to trigger the API.
      requestFullScreen();
    }
  }, [isFullScreenPreview, requestFullScreen]);

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

  const handleResetCurrentWallpaper = useCallback(() => {
    setWallpaperSettings(currentSettings => {
      const { cropOffsetX, cropOffsetY } = currentSettings[wallpaperType];
      return {
        ...currentSettings,
        [wallpaperType]: {
          ...DUAL_WALLPAPER_INITIAL_STATE[wallpaperType],
          cropOffsetX,
          cropOffsetY,
        }
      };
    });
  }, [wallpaperType, setWallpaperSettings]);

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
                const r = data[i], g = data[i+1], b = data[i+2];
                if (isMonochrome) {
                    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                    ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                } else {
                    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                }
                const drawX = x * (pxRenderW + calculatedWallpaperPixelGap);
                const drawY = y * (pxRenderH + calculatedWallpaperPixelGap);
                
                const radius = Math.min(pxRenderW, pxRenderH) / 2;
                if (radius > 0) {
                    ctx.beginPath();
                    const centerX = drawX + pxRenderW / 2;
                    const centerY = drawY + pxRenderH / 2;
                    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }
      }
  }, [image, wallpaperGridWidth, wallpaperGridHeight, calculatedWallpaperPixelGap, background, currentWallpaperWidth, currentWallpaperHeight, cropOffsetX, cropOffsetY, isFullScreenPreview, isMonochrome]);
  
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
      
      const activeCanvas = isFullScreenPreview ? fullScreenCanvasRef.current : canvasRef.current;

      if (activeCanvas) {
          const rect = activeCanvas.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
              const scaleX = currentWallpaperWidth / rect.width;
              const scaleY = currentWallpaperHeight / rect.height;
              deltaX *= scaleX;
              deltaY *= scaleY;
          }
      }
      
      const imgAspect = image.width / image.height;
      const canvasAspect = currentWallpaperWidth / currentWallpaperHeight;
      
      let panRangeX = 0, panRangeY = 0;
      if (imgAspect > canvasAspect) { panRangeX = (currentWallpaperHeight * imgAspect) - currentWallpaperWidth; }
      else if (imgAspect < canvasAspect) { panRangeY = (currentWallpaperWidth / imgAspect) - currentWallpaperHeight; }
      
      let newOffsetX = panRangeX > 0 ? dragState.current.initialOffsetX - (deltaX / panRangeX) : dragState.current.initialOffsetX;
      let newOffsetY = panRangeY > 0 ? dragState.current.initialOffsetY - (deltaY / panRangeY) : dragState.current.initialOffsetY;
      
      setLiveWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], cropOffsetX: Math.max(0, Math.min(1, newOffsetX)), cropOffsetY: Math.max(0, Math.min(1, newOffsetY)) } }));
  }, [image, currentWallpaperWidth, currentWallpaperHeight, wallpaperType, isFullScreenPreview]);

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
      <div className={`rounded-lg transition-all duration-300 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <button
          onClick={() => setIsPrefsOpen(!isPrefsOpen)}
          className="w-full flex justify-between items-center p-4"
          aria-expanded={isPrefsOpen}
          aria-controls="wallpaper-prefs-content"
        >
          <span className={`font-semibold ${theme === 'dark' ? 'text-nothing-light' : 'text-day-text'}`}>Wallpaper Preferences</span>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-300 ${isPrefsOpen ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <div
          id="wallpaper-prefs-content"
          className={`overflow-hidden transition-all duration-300 ease-in-out ${isPrefsOpen ? 'max-h-96' : 'max-h-0'}`}
        >
          <div className="px-4 pb-4 pt-0 space-y-2">
            <WallpaperTypeSelector selected={wallpaperType} onSelect={setWallpaperType} theme={theme} />
            <ColorSelector options={WALLPAPER_BG_OPTIONS} selected={liveWallpaperState.background} onSelect={(key) => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], background: key as WallpaperBgKey } }))} theme={theme} />
          </div>
        </div>
      </div>
      <UndoRedoControls onUndo={undoWallpaper} onRedo={redoWallpaper} canUndo={canUndoWallpaper} canRedo={canRedoWallpaper} theme={theme} />
      
      <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <EnhancedSlider 
            theme={theme}
            isMobile={isMobile}
            label="Resolution" 
            value={resolution} 
            onChange={v => setLiveWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], resolution: v } }))} 
            onChangeCommitted={v => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], resolution: v } }))}
            onReset={() => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], resolution: DEFAULT_SLIDER_VALUE } }))}
            disabled={isLoading} 
        />
        <EnhancedSlider 
            theme={theme}
            isMobile={isMobile}
            label="Pixel Gap" 
            value={pixelGap} 
            onChange={v => setLiveWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], pixelGap: v } }))}
            onChangeCommitted={v => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], pixelGap: v } }))} 
            onReset={() => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], pixelGap: DEFAULT_SLIDER_VALUE } }))}
            disabled={isLoading} 
        />
      </div>

      <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
          <label htmlFor="monochrome-toggle" className="text-sm">Monochrome</label>
          <button id="monochrome-toggle" role="switch" aria-checked={isMonochrome} onClick={() => setWallpaperSettings(s => ({...s, [wallpaperType]: { ...s[wallpaperType], isMonochrome: !s[wallpaperType].isMonochrome }}))} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isMonochrome ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isMonochrome ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>
      
      <div className="pt-2">
        <button onClick={handleResetCurrentWallpaper} disabled={isLoading} className={`w-full border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Restore wallpaper settings to their default values"> Restore Defaults </button>
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
                onClick={enterFullScreen}
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
                onClick={(e) => {
                    if (e.target === e.currentTarget && !dragState.current.hasMoved) {
                        if (isFullScreenControlsOpen) {
                            setIsFullScreenControlsOpen(false);
                        } else {
                            exitFullScreen();
                        }
                    }
                }}
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
                
                {!isMobile && (
                  <div className="fixed bottom-4 left-4 z-[51] w-80">
                    {isFullScreenControlsOpen ? (
                      <div className={`w-full ${theme === 'dark' ? 'bg-nothing-dark/80' : 'bg-day-bg/90 border border-gray-300/50'} backdrop-blur-sm rounded-lg p-4 max-h-[calc(100vh-5rem)] flex flex-col space-y-4 shadow-2xl`}>
                        <div className="flex justify-between items-center flex-shrink-0">
                          <h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-day-text'}`}>Controls</h3>
                          <button onClick={() => setIsFullScreenControlsOpen(false)} className={`p-1 ${theme === 'dark' ? 'text-white hover:bg-white/20' : 'text-day-text hover:bg-black/10'} rounded-full transition-colors`} aria-label="Collapse controls">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><polyline points="6 9 12 15 18 9"></polyline></svg>
                          </button>
                        </div>

                        <div className="overflow-y-auto space-y-4 pr-2 -mr-2">
                           <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'} space-y-3`}>
                              <WallpaperTypeSelector selected={wallpaperType} onSelect={setWallpaperType} theme={theme} />
                              <ColorSelector options={WALLPAPER_BG_OPTIONS} selected={liveWallpaperState.background} onSelect={(key) => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], background: key as WallpaperBgKey } }))} theme={theme} />
                          </div>
                          <UndoRedoControls onUndo={undoWallpaper} onRedo={redoWallpaper} canUndo={canUndoWallpaper} canRedo={canRedoWallpaper} theme={theme} />
                          <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'} space-y-4`}>
                              <EnhancedSlider 
                                  theme={theme}
                                  isMobile={isMobile}
                                  label="Resolution" 
                                  value={resolution} 
                                  onChange={v => setLiveWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], resolution: v } }))} 
                                  onChangeCommitted={v => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], resolution: v } }))}
                                  onReset={() => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], resolution: DEFAULT_SLIDER_VALUE } }))}
                                  disabled={isLoading} 
                              />
                              <EnhancedSlider 
                                  theme={theme}
                                  isMobile={isMobile}
                                  label="Pixel Gap" 
                                  value={pixelGap} 
                                  onChange={v => setLiveWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], pixelGap: v } }))}
                                  onChangeCommitted={v => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], pixelGap: v } }))} 
                                  onReset={() => setWallpaperSettings(s => ({ ...s, [wallpaperType]: { ...s[wallpaperType], pixelGap: DEFAULT_SLIDER_VALUE } }))}
                                  disabled={isLoading} 
                              />
                          </div>
                           <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-black/40' : 'bg-white/60'}`}>
                            <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
                                <label htmlFor="monochrome-toggle-fs" className="text-sm">Monochrome</label>
                                <button id="monochrome-toggle-fs" role="switch" aria-checked={isMonochrome} onClick={() => setWallpaperSettings(s => ({...s, [wallpaperType]: { ...s[wallpaperType], isMonochrome: !s[wallpaperType].isMonochrome }}))} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isMonochrome ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
                                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isMonochrome ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <button onClick={handleResetCurrentWallpaper} disabled={isLoading} className={`w-full font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border border-gray-600 text-gray-300 hover:bg-gray-700' : 'border border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Restore wallpaper settings to their default values"> Restore Defaults </button>
                            <button
                                onClick={handleDownload}
                                disabled={isLoading || isDownloading}
                                className={`w-full font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`}
                                aria-label="Download the current wallpaper"
                            >
                                Download
                            </button>
                          </div>
                        </div>

                      </div>
                    ) : (
                      <button onClick={() => setIsFullScreenControlsOpen(true)} className={`w-full ${theme === 'dark' ? 'bg-nothing-dark/80 text-white hover:bg-nothing-dark' : 'bg-day-bg/90 text-day-text hover:bg-day-gray-light border border-gray-300/50'} backdrop-blur-sm font-semibold py-3 px-4 rounded-lg flex items-center justify-between shadow-lg transition-colors`} aria-label="Expand controls">
                        <span>Controls</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><polyline points="18 15 12 9 6 15"></polyline></svg>
                      </button>
                    )}
                  </div>
                )}

                <button
                    onClick={exitFullScreen}
                    className="fixed bottom-3 right-3 z-50 p-2 rounded-full transition-colors duration-300 text-nothing-light bg-black/50 hover:bg-black/80"
                    aria-label="Exit full-screen preview"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
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
