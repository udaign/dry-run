
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { usePfpPanel } from './Pfp';
import { useWallpaperPanel } from './Wallpaper';
import { usePhotoWidgetPanel } from './PhotoWidget';
import { Theme, Tab } from './types';

const TABS: Tab[] = ['pfp', 'wallpaper', 'photoWidget'];

const App: React.FC = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [theme, setTheme] = useState<Theme>(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const [activeTab, setActiveTab] = useState<Tab>('pfp');
  const activeTabIndex = TABS.indexOf(activeTab);

  const pfpFileInputRef = useRef<HTMLInputElement>(null);
  const wallpaperFileInputRef = useRef<HTMLInputElement>(null);
  const photoWidgetFileInputRef = useRef<HTMLInputElement>(null);

  const linkClasses = theme === 'dark' ? 'font-medium text-nothing-light hover:text-white underline' : 'font-medium text-day-text hover:text-black underline';
  
  const footerLinks = (
    <div className={`text-sm ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'} opacity-80`}>
        <p>Made with 🤍❤️🖤 for <a href="https://nothing.community/" target="_blank" rel="noopener noreferrer" className={linkClasses}>Nothing Community</a> by <a href="https://nothing.community/u/Udaign" target="_blank" rel="noopener noreferrer" className={linkClasses}>Uday</a>.</p>
        <p>For feedback and feature requests, join the <a href="https://nothing.community/d/38047-introducing-matrices-a-handy-utility-to-create-matrix-styled-imagery" target="_blank" rel="noopener noreferrer" className={linkClasses}>discussion</a>. For contact, <a href="mailto:udaybhaskar2283@gmail.com" className={linkClasses}>email me</a>.</p>
    </div>
  );
  
  const commonProps = { theme, isMobile, footerLinks };
  const pfpPanel = usePfpPanel(commonProps);
  const wallpaperPanel = useWallpaperPanel(commonProps);
  const photoWidgetPanel = usePhotoWidgetPanel(commonProps);
  
  const panels = {
    pfp: pfpPanel,
    wallpaper: wallpaperPanel,
    photoWidget: photoWidgetPanel,
  };

  const activePanel = panels[activeTab];
  const imageSrc = activePanel.imageSrc;

  const handlePfpFileSelect = (file: File) => {
      pfpPanel.handleFileSelect(file);
      if (pfpFileInputRef.current) pfpFileInputRef.current.value = '';
  };
  const handleWallpaperFileSelect = (file: File) => {
      wallpaperPanel.handleFileSelect(file);
      if (wallpaperFileInputRef.current) wallpaperFileInputRef.current.value = '';
  };
  const handlePhotoWidgetFileSelect = (file: File) => {
      photoWidgetPanel.handleFileSelect(file);
      if (photoWidgetFileInputRef.current) photoWidgetFileInputRef.current.value = '';
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.body.className = theme === 'light' ? 'bg-day-bg' : 'bg-nothing-dark';
  }, [theme]);
  
  useEffect(() => {
    const generateFaviconSvg = (color: string) => {
        const svgString = `<svg width="25" height="25" viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg"><g fill="${color}">${Array.from({ length: 100 }, (_, i) => `<circle cx="${1.25 + (i % 10) * 2.5}" cy="${1.25 + Math.floor(i / 10) * 2.5}" r="1"/>`).join('')}</g></svg>`;
        return `data:image/svg+xml;base64,${btoa(svgString)}`;
    };
    const color = theme === 'dark' ? '#FFFFFF' : '#000000';
    const faviconUrl = generateFaviconSvg(color);
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = faviconUrl;
  }, [theme]);

  const tabDescriptions = {
    pfp: "Create glyph mirror styled profile pictures.",
    wallpaper: <>Create matrix styled wallpapers. <strong className={`font-bold ${theme === 'dark' ? 'text-nothing-light' : 'text-black'}`}>Drag to crop</strong> into desired area.</>,
    photoWidget: "Create matrix style photo widgets.",
  };
    
  const previewContainerPadding = useMemo(() => {
    if (activeTab === 'wallpaper' && panels.wallpaper.wallpaperType === 'phone') {
        return isMobile ? 'py-8 px-6' : 'p-6';
    }
    return 'p-4 sm:p-6';
  }, [activeTab, panels.wallpaper.wallpaperType, isMobile]);

  return (
    <>
      <input type="file" ref={pfpFileInputRef} onChange={(e) => e.target.files?.[0] && handlePfpFileSelect(e.target.files[0])} className="hidden" accept="image/*" />
      <input type="file" ref={wallpaperFileInputRef} onChange={(e) => e.target.files?.[0] && handleWallpaperFileSelect(e.target.files[0])} className="hidden" accept="image/*" />
      <input type="file" ref={photoWidgetFileInputRef} onChange={(e) => e.target.files?.[0] && handlePhotoWidgetFileSelect(e.target.files[0])} className="hidden" accept="image/png" />

      <div className={`min-h-screen md:h-screen w-full flex flex-col font-sans ${theme === 'dark' ? 'text-nothing-light bg-nothing-dark' : 'text-day-text bg-day-bg'} select-none`}>
        <header className={`flex-shrink-0 sticky top-0 z-30 flex justify-between items-center p-4 border-b ${theme === 'dark' ? 'bg-nothing-dark border-nothing-gray-dark' : 'bg-day-bg border-gray-300'}`}>
          <h1 className="text-xl sm:text-2xl font-bold">MATRICES FOR NOTHING COMMUNITY</h1>
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className={`p-2 transition-colors duration-300 rounded-md ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-sun h-6 w-6"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-moon h-6 w-6"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            )}
          </button>
        </header>

        <div className="block md:hidden pt-4 sm:pt-6">
          <div className="flex flex-col space-y-4">
            <div className={`relative flex border-b ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`}>
              {TABS.map((tab, i) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`w-1/3 py-3 text-base transition-colors duration-300 focus:outline-none ${activeTab === tab ? (theme === 'dark' ? 'text-nothing-light font-bold' : 'text-day-text font-bold') : (theme === 'dark' ? 'text-nothing-gray-light hover:text-nothing-light font-semibold' : 'text-day-gray-dark hover:text-day-text font-semibold')}`} aria-pressed={activeTab === tab}>
                  {tab === 'pfp' ? 'Glyph Mirror' : tab === 'wallpaper' ? 'Wallpaper' : 'Photo Widget'}
                </button>
              ))}
              <div className={`absolute bottom-[-1px] h-[1.5px] ${theme === 'dark' ? 'bg-white' : 'bg-black'} transition-all duration-300 ease-in-out`} style={{ width: '33.33%', left: `${activeTabIndex * 33.33}%` }} aria-hidden="true" />
            </div>
            <p className={`text-center w-full text-sm leading-normal transition-opacity duration-300 px-4 sm:px-6 ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>{tabDescriptions[activeTab]}</p>
            <hr className={`mt-4 ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`} />
          </div>
        </div>

        <main className="flex-grow w-full flex flex-col md:flex-row min-h-0 md:pt-0 md:overflow-hidden">
          <div className={`md:w-1/3 w-full flex flex-col ${!imageSrc ? 'flex-grow md:flex-grow-0' : ''} border-b md:border-b-0 md:border-r ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'} md:overflow-y-auto`}>
            <div className={`flex-grow ${previewContainerPadding} ${!imageSrc ? 'min-h-[50vh] md:min-h-0' : 'min-h-0'} flex flex-col items-center justify-center`}>
              {Object.entries(panels).map(([key, panel]) => (
                <div key={key} className={`w-full h-full flex-grow flex flex-col items-center justify-center ${activeTab === key ? 'flex' : 'hidden'}`}>
                  {panel.previewPanel}
                </div>
              ))}
            </div>
            {!imageSrc && <footer className="block md:hidden text-center tracking-wide p-4">{footerLinks}</footer>}
          </div>

          <div className="md:w-2/3 w-full flex flex-col">
            <div className="hidden md:block flex-shrink-0 py-4 sm:py-6 md:py-8 md:pb-4">
              <div className="flex flex-col space-y-4">
                <div className="relative flex border-b dark:border-nothing-gray-dark border-gray-300">
                  {TABS.map((tab, i) => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`w-1/3 py-3 text-lg transition-colors duration-300 focus:outline-none ${activeTab === tab ? (theme === 'dark' ? 'text-nothing-light font-extrabold' : 'text-day-text font-extrabold') : (theme === 'dark' ? 'text-nothing-gray-light hover:text-nothing-light font-semibold' : 'text-day-gray-dark hover:text-day-text font-semibold')}`} aria-pressed={activeTab === tab}>
                      {tab === 'pfp' ? 'Glyph Mirror' : tab === 'wallpaper' ? 'Wallpaper' : 'Photo Widget'}
                    </button>
                  ))}
                  <div className={`absolute bottom-[-1px] h-1 ${theme === 'dark' ? 'bg-white' : 'bg-black'} transition-all duration-300 ease-in-out`} style={{ width: '33.33%', left: `${activeTabIndex * 33.33}%` }} aria-hidden="true" />
                </div>
                <p className={`text-center w-full text-sm leading-normal transition-opacity duration-300 ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>{tabDescriptions[activeTab]}</p>
                <hr className={`mt-2 ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`} />
              </div>
            </div>
            
            <div className="flex-grow md:overflow-y-auto md:relative md:overflow-hidden">
              <div className="hidden md:flex md:absolute md:top-0 md:left-0 md:w-full md:h-full transition-transform duration-300 ease-in-out" style={{ transform: `translateX(-${activeTabIndex * 100}%)` }}>
                {Object.entries(panels).map(([key, panel]) => (
                  <div key={key} className="w-full flex-shrink-0 h-full overflow-y-auto">{panel.controlsPanel}</div>
                ))}
              </div>
              <div className="block md:hidden">{activePanel.controlsPanel}</div>
            </div>
          </div>
        </main>

        {imageSrc &&
          <div className={`flex-shrink-0 hidden md:flex flex-col md:flex-row border-t ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`}>
            <div className={`md:w-1/3 w-full p-4 border-b md:border-b-0 md:border-r ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`}>
              {activePanel.replaceButton}
            </div>
            <div className="md:w-2/3 w-full flex">
              {activePanel.downloadButton}
            </div>
          </div>
        }

        <footer className={`hidden md:block flex-shrink-0 text-center p-4 border-t ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'} tracking-wide`}>
          {footerLinks}
        </footer>

        <div className={`block md:hidden sticky bottom-0 z-20 w-full ${theme === 'dark' ? 'bg-nothing-dark' : 'bg-day-bg'}`}>
            {imageSrc && (
              <div className={`flex border-t ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`}>
                <div className={`w-1/2 border-r ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`}>
                  <button onClick={() => {
                    if (activeTab === 'pfp') pfpFileInputRef.current?.click();
                    if (activeTab === 'wallpaper') wallpaperFileInputRef.current?.click();
                    if (activeTab === 'photoWidget') photoWidgetFileInputRef.current?.click();
                  }} disabled={activePanel.isLoading} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 ${theme === 'dark' ? 'bg-nothing-dark text-nothing-light hover:bg-nothing-gray-dark' : 'bg-day-bg text-day-text hover:bg-day-gray-light'}`}>Replace Image</button>
                </div>
                <div className="w-1/2">
                  {activePanel.downloadButton}
                </div>
              </div>
            )}
        </div>
      </div>
    </>
  );
};

export default App;
