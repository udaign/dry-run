
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useHistory } from './hooks';
import { getTimestamp } from './utils';
import { PhotoWidgetState, PhotoWidgetColorMatrix, Theme, PhotoWidgetOutputMode } from './types';
import { Dropzone, EnhancedSlider, UndoRedoControls, OutputModeSelector } from './components';

const PHOTO_WIDGET_BASE_SIZE = 1176;
const PADDING = 50;
const DEFAULT_SLIDER_VALUE = 50;

const PHOTO_WIDGET_INITIAL_STATE: PhotoWidgetState = {
    resolution: DEFAULT_SLIDER_VALUE,
    pixelGap: 0,
    isCircular: true,
    isAntiAliased: false,
};

const drawPhotoWidgetMatrix = (ctx: CanvasRenderingContext2D, options: {
    width: number;
    height: number;
    outputMode: PhotoWidgetOutputMode;
    matrix: PhotoWidgetColorMatrix;
    pixelGap: number;
    isCircular: boolean;
    isAntiAliased: boolean;
}) => {
    const { width, height, outputMode, matrix, pixelGap, isCircular, isAntiAliased } = options;
    
    switch (outputMode) {
        case 'transparent':
            ctx.clearRect(0, 0, width, height);
            break;
        case 'dark':
            ctx.fillStyle = '#212121';
            ctx.fillRect(0, 0, width, height);
            break;
        case 'light':
            ctx.fillStyle = '#f1f0f1';
            ctx.fillRect(0, 0, width, height);
            break;
    }

    if (!matrix || matrix.length === 0 || matrix[0].length === 0) return;
    const gridHeight = matrix.length, gridWidth = matrix[0].length;
    const drawableWidth = width - PADDING * 2, drawableHeight = height - PADDING * 2;
    const matrixAspect = gridWidth / gridHeight;
    
    let renderAreaWidth, renderAreaHeight;
    if ((drawableWidth / matrixAspect) <= drawableHeight) {
        renderAreaWidth = drawableWidth;
        renderAreaHeight = drawableWidth / matrixAspect;
    } else {
        renderAreaHeight = drawableHeight;
        renderAreaWidth = drawableHeight * matrixAspect;
    }

    const offsetX = PADDING + (drawableWidth - renderAreaWidth) / 2;
    const offsetY = PADDING + (drawableHeight - renderAreaHeight) / 2;

    const cellWidth = renderAreaWidth / gridWidth, cellHeight = renderAreaHeight / gridHeight;
    const gapRatio = (((0.28 * pixelGap) / 100) * 0.2765);
    const pixelWidth = cellWidth * (1 - gapRatio), pixelHeight = cellHeight * (1 - gapRatio);
    
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const pixel = matrix[y][x];
            if (pixel) {
                const coverage = pixel.a / 255;
                let finalPixelWidth = pixelWidth, finalPixelHeight = pixelHeight;
                if (isAntiAliased) {
                    const sizeMultiplier = Math.sqrt(coverage);
                    finalPixelWidth *= sizeMultiplier;
                    finalPixelHeight *= sizeMultiplier;
                }
                ctx.fillStyle = `rgb(${pixel.r}, ${pixel.g}, ${pixel.b})`;
                const cellX = offsetX + x * cellWidth, cellY = offsetY + y * cellHeight;
                if (isCircular) {
                    const radius = Math.min(finalPixelWidth, finalPixelHeight) / 2;
                    if (radius > 0.1) {
                        ctx.beginPath();
                        ctx.arc(cellX + cellWidth / 2, cellY + cellHeight / 2, radius, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                } else {
                    if (finalPixelWidth > 0.1 && finalPixelHeight > 0.1) {
                        const rectX = cellX + (cellWidth - finalPixelWidth) / 2, rectY = cellY + (cellHeight - finalPixelHeight) / 2;
                        ctx.fillRect(rectX, rectY, finalPixelWidth, finalPixelHeight);
                    }
                }
            }
        }
    }
};

export const usePhotoWidgetPanel = ({ theme, isMobile, footerLinks }: { theme: Theme, isMobile: boolean, footerLinks: React.ReactNode }) => {
  const { state: photoWidgetState, setState: setPhotoWidgetState, undo: undoPhotoWidget, redo: redoPhotoWidget, reset: resetPhotoWidget, canUndo: canUndoPhotoWidget, canRedo: canRedoPhotoWidget } = useHistory(PHOTO_WIDGET_INITIAL_STATE);
  const [livePhotoWidgetState, setLivePhotoWidgetState] = useState(photoWidgetState);
  const [outputMode, setOutputMode] = useState<PhotoWidgetOutputMode>('transparent');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [colorMatrix, setColorMatrix] = useState<PhotoWidgetColorMatrix | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPrefsOpen, setIsPrefsOpen] = useState(false);
  
  const { resolution, pixelGap, isCircular, isAntiAliased } = livePhotoWidgetState;
  
  const canvasWidth = useMemo(() => PHOTO_WIDGET_BASE_SIZE, []);
  const canvasHeight = useMemo(() => PHOTO_WIDGET_BASE_SIZE, []);

  useEffect(() => { setLivePhotoWidgetState(photoWidgetState); }, [photoWidgetState]);

  useEffect(() => {
    if (!imageSrc) { setImage(null); return; }
    setIsLoading(true);
    const img = new Image();
    img.onload = () => { setImage(img); setIsLoading(false); };
    img.onerror = () => { setImageSrc(null); setImage(null); setIsLoading(false); };
    img.src = imageSrc;
  }, [imageSrc]);

  const handleFileSelect = (file: File) => {
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
        setImageSrc(e.target?.result as string);
        resetPhotoWidget();
        setOutputMode('transparent');
        setIsLoading(false);
    };
    reader.readAsDataURL(file);
  };
  
  useEffect(() => {
    if (!image) { setColorMatrix(null); return; }
    const resValue = 20 + Math.floor(((resolution * 0.6592) / 100) * 130);
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;
    const gridWidth = resValue, gridHeight = Math.round(gridWidth * (image.height / image.width));
    tempCanvas.width = gridWidth; tempCanvas.height = gridHeight;
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(image, 0, 0, gridWidth, gridHeight);
    const imageData = tempCtx.getImageData(0, 0, gridWidth, gridHeight).data;

    const fullMatrix: PhotoWidgetColorMatrix = Array.from({ length: gridHeight }, (_, y) => 
        Array.from({ length: gridWidth }, (_, x) => {
            const i = (y * gridWidth + x) * 4;
            if (imageData[i+3] <= 10) { return null; }

            const r = imageData[i], g = imageData[i+1], b = imageData[i+2];

            return { 
                r: Math.round(Math.max(0, Math.min(255, r))), 
                g: Math.round(Math.max(0, Math.min(255, g))), 
                b: Math.round(Math.max(0, Math.min(255, b))), 
                a: imageData[i+3] 
            };
        })
    );
    
    let minX = gridWidth, minY = gridHeight, maxX = -1, maxY = -1;
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (fullMatrix[y][x]) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX !== -1) {
        const contentWidth = maxX - minX + 1;
        const contentHeight = maxY - minY + 1;
        const croppedMatrix = Array.from({ length: contentHeight }, (_, y) =>
            Array.from({ length: contentWidth }, (_, x) => {
                return fullMatrix[y + minY][x + minX];
            })
        );
        setColorMatrix(croppedMatrix);
    } else {
        setColorMatrix(null);
    }
  }, [image, resolution]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !colorMatrix) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawPhotoWidgetMatrix(ctx, { width: canvasWidth, height: canvasHeight, outputMode, matrix: colorMatrix, pixelGap, isCircular, isAntiAliased });
  }, [colorMatrix, pixelGap, isCircular, isAntiAliased, outputMode, canvasWidth, canvasHeight]);

  const handleDownload = () => {
    if (isDownloading || !colorMatrix) return;
    setIsDownloading(true);

    setTimeout(() => {
        try {
            const downloadWidth = PHOTO_WIDGET_BASE_SIZE;
            const downloadHeight = PHOTO_WIDGET_BASE_SIZE;
            const canvas = document.createElement('canvas');
            canvas.width = downloadWidth;
            canvas.height = downloadHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Failed to get canvas context for download.');
            }
            drawPhotoWidgetMatrix(ctx, { ...photoWidgetState, outputMode, width: downloadWidth, height: downloadHeight, matrix: colorMatrix });
            canvas.toBlob((blob) => {
                try {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.download = `matrices-photowidget-${getTimestamp()}.png`;
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
        } catch (e) {
            console.error("Error preparing photo widget for download:", e);
            setIsDownloading(false);
        }
    }, 50);
  };
  
  const handleReset = () => {
    resetPhotoWidget();
    setOutputMode('transparent');
  };

  const controlsPanel = imageSrc ? (
    <div className="max-w-md mx-auto w-full flex flex-col space-y-4 px-6 sm:px-6 md:px-8 pt-6 md:pt-3 pb-8 sm:pb-6 md:pb-8">
      <div className={`rounded-lg transition-all duration-300 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <button
          onClick={() => setIsPrefsOpen(!isPrefsOpen)}
          className="w-full flex justify-between items-center p-4"
          aria-expanded={isPrefsOpen}
          aria-controls="widget-prefs-content"
        >
          <span className={`font-semibold ${theme === 'dark' ? 'text-nothing-light' : 'text-day-text'}`}>Widget Preferences</span>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-300 ${isPrefsOpen ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <div
          id="widget-prefs-content"
          className={`overflow-hidden transition-all duration-300 ease-in-out ${isPrefsOpen ? 'max-h-96' : 'max-h-0'}`}
        >
          <div className="px-4 pb-4 pt-0 space-y-3">
            <OutputModeSelector
              selected={outputMode}
              onSelect={setOutputMode}
              theme={theme}
            />
          </div>
        </div>
      </div>

      <UndoRedoControls onUndo={undoPhotoWidget} onRedo={redoPhotoWidget} canUndo={canUndoPhotoWidget} canRedo={canRedoPhotoWidget} theme={theme} />
        
      <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <EnhancedSlider theme={theme} isMobile={isMobile} label="Resolution" value={resolution} onChange={v => setLivePhotoWidgetState(s => ({...s, resolution: v}))} onChangeCommitted={v => setPhotoWidgetState(s => ({...s, resolution: v}))} onReset={() => setPhotoWidgetState(s => ({...s, resolution: DEFAULT_SLIDER_VALUE}))} disabled={isLoading} />
        <EnhancedSlider theme={theme} isMobile={isMobile} label="Pixel Gap" value={pixelGap} onChange={v => setLivePhotoWidgetState(s => ({...s, pixelGap: v}))} onChangeCommitted={v => setPhotoWidgetState(s => ({...s, pixelGap: v}))} onReset={() => setPhotoWidgetState(s => ({...s, pixelGap: 0}))} disabled={isLoading} />
      </div>
        
      <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-nothing-darker' : 'bg-white border border-gray-300'}`}>
        <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
          <label htmlFor="pw-circular-toggle" className="text-sm">Circular Pixels</label>
          <button id="pw-circular-toggle" role="switch" aria-checked={isCircular} onClick={() => setPhotoWidgetState(s => ({...s, isCircular: !s.isCircular}))} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} ${isCircular ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isCircular ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <div className={`flex items-center justify-between ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>
          <label htmlFor="pw-aa-toggle" className="text-sm">Anti-aliasing</label>
          <button id="pw-aa-toggle" role="switch" aria-checked={isAntiAliased} onClick={() => {
              setPhotoWidgetState(s => ({
                  ...s,
                  isAntiAliased: !s.isAntiAliased,
              }));
          }} disabled={isLoading} className={`relative inline-flex items-center h-6 w-11 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-full ${theme === 'dark' ? 'focus:ring-offset-nothing-dark' : 'focus:ring-offset-day-bg'} disabled:opacity-50 ${isAntiAliased ? 'bg-nothing-red' : (theme === 'dark' ? 'bg-nothing-gray-dark' : 'bg-day-gray-light')}`}>
            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ${isAntiAliased ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>
        
      <div className="pt-2">
        <button onClick={handleReset} disabled={isLoading} className={`w-full border font-semibold py-2 px-4 transition-all duration-300 disabled:opacity-50 rounded-md ${theme === 'dark' ? 'border-gray-700 text-nothing-gray-light hover:bg-gray-800' : 'border-gray-300 text-day-gray-dark hover:bg-gray-200'}`} aria-label="Restore photo widget settings to their default values"> Restore Defaults </button>
      </div>
      <div className="block md:hidden pt-8">
          <footer className="text-center tracking-wide">{footerLinks}</footer>
      </div>
    </div>
  ) : null;
  
  const previewPanel = !imageSrc ? (
    <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} theme={theme} accept="image/png" />
  ) : (
    <div className="w-full max-w-2xl mx-auto flex items-center justify-center">
        <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="max-w-full max-h-full h-auto w-auto rounded-lg"
            aria-label="Photo Widget Matrix Canvas"
            style={{aspectRatio: `${canvasWidth} / ${canvasHeight}`}}
        />
    </div>
  );

  const downloadButton = <button onClick={handleDownload} disabled={isLoading || isDownloading || !colorMatrix} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'dark' ? 'bg-nothing-red text-nothing-light hover:bg-opacity-80' : 'bg-day-accent text-white hover:bg-opacity-80'}`} aria-label="Download the current widget"> Download </button>;
  
  const replaceButton = <Dropzone onFileSelect={handleFileSelect} isLoading={isLoading} compact={true} theme={theme} accept="image/png" />;

  return { previewPanel, controlsPanel, imageSrc, isLoading, handleFileSelect, handleDownload, downloadButton, replaceButton };
};
