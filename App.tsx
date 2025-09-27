
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { usePfpPanel } from './Pfp';
import { useWallpaperPanel } from './Wallpaper';
import { usePhotoWidgetPanel } from './PhotoWidget';
import { useValueAliasingPanel } from './ValueAliasing';
import { Theme, Tab } from './types';
import { trackEvent } from './analytics';
import { ToastNotification, SharePopup } from './components';

const TABS: Tab[] = ['valueAliasing', 'pfp', 'wallpaper', 'photoWidget'];
const TAB_LABELS: Record<Tab, string> = {
  wallpaper: 'Matrix Wallpaper',
  pfp: 'Glyph Mirror',
  photoWidget: 'Photo Widget',
  valueAliasing: 'Value Aliasing',
};
const TAB_ABBREVIATIONS: Record<Tab, string> = {
  wallpaper: 'MW',
  pfp: 'GM',
  photoWidget: 'PW',
  valueAliasing: 'VA',
};
const NOTHING_COMMUNITY_SHARE_LINK = "https://nothing.community/d/38047-introducing-matrices-a-handy-utility-to-create-matrix-styled-imagery";
const APP_URL = "https://udaign.github.io/matrices/";

const App: React.FC = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [theme, setTheme] = useState<Theme>(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const [activeTab, setActiveTab] = useState<Tab>('valueAliasing');
  const [downloadCount, setDownloadCount] = useState(0);
  const [showShareToast, setShowShareToast] = useState(false);
  const [hasShownShareToastInSession, setHasShownShareToastInSession] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [easterEggPrimed, setEasterEggPrimed] = useState(false);
  const [isEasterEggPermanentlyUnlocked, setIsEasterEggPermanentlyUnlocked] = useState(false);
  const [isEasterEggHintVisible, setIsEasterEggHintVisible] = useState(false);
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [shareVariant, setShareVariant] = useState<'default' | 'special'>('default');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const activeTabIndex = TABS.indexOf(activeTab);
  const longPressTimer = useRef<number | null>(null);
  const longPressActivated = useRef(false);
  const installTriggeredByApp = useRef(false);

  // Special theme toast state
  const [hasDownloadedSpecialTheme, setHasDownloadedSpecialTheme] = useState(false);
  const [showSpecialShareToast, setShowSpecialShareToast] = useState(false);
  const [justUnlockedSpecialTheme, setJustUnlockedSpecialTheme] = useState(false);

  const pfpFileInputRef = useRef<HTMLInputElement>(null);
  const wallpaperFileInputRef = useRef<HTMLInputElement>(null);
  const photoWidgetFileInputRef = useRef<HTMLInputElement>(null);
  const valueAliasingFileInputRef = useRef<HTMLInputElement>(null);

  const linkClasses = theme === 'dark' ? 'font-medium text-nothing-light hover:text-white underline' : 'font-medium text-day-text hover:text-black underline';
  
  const mobileUnderlineStyle = useMemo(() => {
    const inactiveTabWidth = 50 / 3;
    const left = activeTabIndex * inactiveTabWidth;
    return {
      width: '50%',
      left: `${left}%`,
    };
  }, [activeTabIndex]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      trackEvent('pwa_install_available');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);
  
  useEffect(() => {
    const handler = (e: Event) => {
      const source = installTriggeredByApp.current ? 'app_button' : 'browser_ui';
      trackEvent('pwa_install_success', { source });
      
      // Hide the app install button.
      setInstallPrompt(null);
      // Reset the ref.
      installTriggeredByApp.current = false;
    };
    window.addEventListener('appinstalled', handler);
    return () => {
      window.removeEventListener('appinstalled', handler);
    };
  }, []);

  const handleInstallClick = () => {
    if (!installPrompt) return;

    trackEvent('pwa_install_prompt_click');
    installTriggeredByApp.current = true;

    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult: { outcome: 'accepted' | 'dismissed' }) => {
      if (choiceResult.outcome === 'accepted') {
        trackEvent('pwa_install_accepted');
      } else {
        trackEvent('pwa_install_dismissed');
        // If dismissed, reset the flag so a future browser-UI install isn't misattributed
        installTriggeredByApp.current = false;
      }
      // The prompt can't be used again, so clear it.
      setInstallPrompt(null);
    });
  };

  const unlockButtonAction = (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveTab('valueAliasing');
    valueAliasingPanel.activateEasterEgg();
    setEasterEggPrimed(false);
    trackEvent('easter_egg_unlocked');
  };

  const handleShare = async (variant: 'default' | 'special' = 'default') => {
    trackEvent('share_initiated', { variant, source: imageSrc ? 'with_image' : 'no_image' });

    const blob = imageSrc && activePanel.getCanvasBlob ? await activePanel.getCanvasBlob() : null;

    // --- Web Share API with Image ---
    if (navigator.share && blob) {
      try {
        const file = new File([blob], 'matrices-creation.png', { type: 'image/png' });
        const text = variant === 'special'
          ? "Have you unlocked the secret theme in Matrices Value Aliasing yet? 🗝️ On desktop, type 'feelingnothing' code word. On mobile, hold the celestial body until you are blessed! https://udaign.github.io/matrices/"
          : `Created with Matrices. Link: ${APP_URL}`;
        
        const shareData = {
          files: [file],
          title: 'Matrices for Nothing Community',
          text,
          url: APP_URL,
        };
        if (navigator.canShare && navigator.canShare(shareData)) {
          await navigator.share(shareData);
          trackEvent('share_success_webshare_api', { method: 'image', variant });
          return;
        }
      } catch (error) {
        console.warn('Web Share API with image failed, falling back.', error);
        trackEvent('share_error_webshare_api', { method: 'image', error: (error as Error).message, variant });
      }
    }

    // --- Web Share API Text-Only Fallback ---
    if (navigator.share) {
      try {
        const text = variant === 'special'
            ? "Have you unlocked the secret theme in Matrices Value Aliasing yet? 🗝️ On desktop, type 'feelingnothing' code word. On mobile, hold the celestial body until you are blessed! https://udaign.github.io/matrices/"
            : `Create your own Nothing style dot-matrix imagery with Matrices: ${APP_URL}`;

        await navigator.share({
          title: 'Matrices for Nothing Community',
          text,
          url: APP_URL,
        });
        trackEvent('share_success_webshare_api', { method: 'text', variant });
        return;
      } catch (error) {
        console.warn('Web Share API text-only failed, falling back to popup.', error);
        trackEvent('share_error_webshare_api', { method: 'text', error: (error as Error).message, variant });
      }
    }
    
    // --- Custom Popup Fallback ---
    setShareVariant(variant);
    setShowSharePopup(true);
    trackEvent('share_popup_opened', { variant });
  };
  
  const triggerShareToast = useCallback((showSpecificToast?: () => void, isSpecial: boolean = false) => {
    // Special toast logic: show only on the session where the theme was first unlocked.
    if (isSpecial && justUnlockedSpecialTheme && !hasDownloadedSpecialTheme) {
        setShowSpecialShareToast(true);
        setHasDownloadedSpecialTheme(true);
        // If this would have been the trigger for the normal toast, mark it as "shown" to prevent it appearing later.
        if (downloadCount + 1 === 2 && !hasShownShareToastInSession) {
            setHasShownShareToastInSession(true);
        }
        return; // Prioritize special toast
    }

    // Normal toast logic
    if (hasShownShareToastInSession) {
        return;
    }
    const newCount = downloadCount + 1;
    setDownloadCount(newCount);
    if (newCount === 2) {
      if (showSpecificToast) {
        showSpecificToast();
      } else {
        setShowShareToast(true);
      }
      setHasShownShareToastInSession(true);
    }
  }, [downloadCount, hasShownShareToastInSession, justUnlockedSpecialTheme, hasDownloadedSpecialTheme]);

  const markEasterEggAsUnlocked = useCallback(() => {
    try {
      localStorage.setItem('easterEggUnlocked', 'true');
      setIsEasterEggPermanentlyUnlocked(true);
    } catch (error) {
      console.error("Failed to save easter egg state to localStorage:", error);
    }
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem('easterEggUnlocked') === 'true') {
        setIsEasterEggPermanentlyUnlocked(true);
      }
    } catch (error) {
      console.error("Failed to read easter egg state from localStorage:", error);
    }
  }, []);

  const handleThemeTogglePress = useCallback((vaImageSrc: string | null) => {
    longPressActivated.current = false;
    if (isMobile && !isEasterEggPermanentlyUnlocked && !easterEggPrimed && activeTab === 'valueAliasing' && !!vaImageSrc) {
        longPressTimer.current = window.setTimeout(() => {
            setEasterEggPrimed(true);
            trackEvent('easter_egg_primed', { method: 'long_press' });
            longPressActivated.current = true;
        }, 4800);
    }
  }, [isMobile, isEasterEggPermanentlyUnlocked, easterEggPrimed, activeTab]);

  const handleThemeToggleRelease = useCallback(() => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  }, []);

  const footerLinks = (
    <div className={`text-sm ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'} opacity-80 space-y-1`}>
      <p>
        Made with 🤍❤️🖤 for Nothing Community.
      </p>
      <p>
        <a href="https://nothing.community/d/38047-introducing-matrices-a-handy-utility-to-create-matrix-styled-imagery" target="_blank" rel="noopener noreferrer" className={linkClasses} onClick={() => trackEvent('discussion_visit')}>
          {isEasterEggHintVisible && !isMobile ? 'Feeling Nothing' : 'Feedback & feature requests'}
        </a>
        <span className="mx-2">|</span>
        <a href="mailto:udaybhaskar2283@gmail.com" className={linkClasses} onClick={() => trackEvent('email_click')}>
          Email
        </a>
        <span className="mx-2">|</span>
        <a href="https://nothing.community/u/Udaign" target="_blank" rel="noopener noreferrer" className={linkClasses} onClick={() => trackEvent('community_profile_visit')}>
          © Uday
        </a>
      </p>
    </div>
  );
  
  const commonProps = { 
    theme, 
    isMobile, 
    footerLinks, 
    triggerShareToast, 
    handleShare,
    showSharePopup,
    setShowSharePopup,
    communityLink: NOTHING_COMMUNITY_SHARE_LINK,
    appUrl: APP_URL,
    shareVariant,
  };
  
  const pfpPanel = usePfpPanel(commonProps);
  const wallpaperPanel = useWallpaperPanel(commonProps);
  const photoWidgetPanel = usePhotoWidgetPanel(commonProps);
  const valueAliasingPanel = useValueAliasingPanel({ 
    ...commonProps, 
    easterEggPrimed, 
    setEasterEggPrimed, 
    isEasterEggPermanentlyUnlocked, 
    markEasterEggAsUnlocked,
    setJustUnlockedSpecialTheme,
  });
  
  const panels = {
    pfp: pfpPanel,
    wallpaper: wallpaperPanel,
    photoWidget: photoWidgetPanel,
    valueAliasing: valueAliasingPanel,
  };

  const activePanel = panels[activeTab];
  const imageSrc = activePanel.imageSrc;
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if an input, textarea, or select element is focused.
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      const isUndo = e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z';
      const isRedo = (e.ctrlKey && e.key.toLowerCase() === 'y') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z');

      if (isUndo || isRedo) {
        const currentPanel = panels[activeTab];
        if (!currentPanel.imageSrc) return;

        e.preventDefault();

        if (isUndo && currentPanel.canUndo) {
          currentPanel.undo();
          trackEvent(`${activeTab}_undo`, { method: 'keyboard_shortcut' });
        } else if (isRedo && currentPanel.canRedo) {
          currentPanel.redo();
          trackEvent(`${activeTab}_redo`, { method: 'keyboard_shortcut' });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, panels]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      // Ignore if an input, textarea, or select element is focused.
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            trackEvent('paste_image', { feature: activeTab });
            
            switch (activeTab) {
              case 'pfp':
                panels.pfp.handleFileSelect(file, 'paste');
                break;
              case 'wallpaper':
                panels.wallpaper.handleFileSelect(file, 'paste');
                break;
              case 'photoWidget':
                panels.photoWidget.handleFileSelect(file, 'paste');
                break;
              case 'valueAliasing':
                panels.valueAliasing.handleFileSelect(file, 'paste');
                break;
            }
            break; // Only handle the first image
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [activeTab, panels]);

  useEffect(() => {
    const shouldShowHint =
      !easterEggPrimed &&
      !valueAliasingPanel.isEasterEggActive &&
      !isEasterEggPermanentlyUnlocked &&
      activeTab === 'valueAliasing' &&
      !!valueAliasingPanel.imageSrc;

    if (shouldShowHint !== isEasterEggHintVisible) {
      setIsEasterEggHintVisible(shouldShowHint);
    }
  }, [
    easterEggPrimed,
    valueAliasingPanel.isEasterEggActive,
    isEasterEggPermanentlyUnlocked,
    activeTab,
    valueAliasingPanel.imageSrc,
    isEasterEggHintVisible,
  ]);

  useEffect(() => {
    // Stop listening for the easter egg if it's already primed or fully active.
    if (easterEggPrimed || valueAliasingPanel.isEasterEggActive || isEasterEggPermanentlyUnlocked) return;
  
    const targetSequence = 'feelingnothing';
    const handler = (e: KeyboardEvent) => {
      // The easter egg can only be unlocked when the code word is typed while an image is present in the value aliasing tab.
      if (activeTab !== 'valueAliasing' || !valueAliasingPanel.imageSrc) {
        // If user navigates away or there's no image, reset sequence.
        if (userInput) setUserInput('');
        return;
      }

      // Ignore control keys, function keys, etc.
      if (e.key.length > 1 || e.metaKey || e.ctrlKey || e.altKey) {
        if (userInput) setUserInput('');
        return;
      }
  
      const newSequence = (userInput + e.key.toLowerCase());
  
      if (targetSequence.startsWith(newSequence)) {
        setUserInput(newSequence);
        if (newSequence === targetSequence) {
          setEasterEggPrimed(true);
          trackEvent('easter_egg_primed', { method: 'keyboard' });
          setUserInput(''); // Reset after success
        }
      } else {
        // If the sequence is broken, start over with the current key if it's the first in the sequence
        const currentKey = e.key.toLowerCase();
        setUserInput(targetSequence.startsWith(currentKey) ? currentKey : '');
      }
    };
  
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [userInput, easterEggPrimed, activeTab, valueAliasingPanel.isEasterEggActive, valueAliasingPanel.imageSrc, isEasterEggPermanentlyUnlocked]);

  const handlePfpFileSelect = (file: File) => {
      pfpPanel.handleFileSelect(file, 'click');
      if (pfpFileInputRef.current) pfpFileInputRef.current.value = '';
  };
  const handleWallpaperFileSelect = (file: File) => {
      wallpaperPanel.handleFileSelect(file, 'click');
      if (wallpaperFileInputRef.current) wallpaperFileInputRef.current.value = '';
  };
  const handlePhotoWidgetFileSelect = (file: File) => {
      photoWidgetPanel.handleFileSelect(file, 'click');
      if (photoWidgetFileInputRef.current) photoWidgetFileInputRef.current.value = '';
  };
  const handleValueAliasingFileSelect = (file: File) => {
      valueAliasingPanel.handleFileSelect(file, 'click');
      if (valueAliasingFileInputRef.current) valueAliasingFileInputRef.current.value = '';
  };

  useEffect(() => {
    const handleResize = () => {
        setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const initialTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    trackEvent('initial_theme_detected', { theme: initialTheme });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.body.className = theme === 'light' ? 'bg-day-bg' : 'bg-nothing-dark';
  }, [theme]);
  
  const handleThemeToggle = () => {
    if (longPressActivated.current) {
        longPressActivated.current = false;
        return;
    }
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    trackEvent('theme_change', { theme: newTheme });
    setTheme(newTheme);
  };
  
  const handleTabChange = (tab: Tab) => {
    trackEvent('select_tab', { tab_name: tab });
    setActiveTab(tab);
  };

  const tabDescriptions = {
    valueAliasing: <>Create value-aliased imagery. <strong className={`font-bold ${theme === 'dark' ? 'text-nothing-light' : 'text-black'}`}>Drag to crop</strong> into desired area.</>,
    pfp: <>Create glyph mirror styled profile pictures. <strong className={`font-bold ${theme === 'dark' ? 'text-nothing-light' : 'text-black'}`}>Drag to crop</strong> into desired area.</>,
    wallpaper: <>Create matrix styled wallpapers. <strong className={`font-bold ${theme === 'dark' ? 'text-nothing-light' : 'text-black'}`}>Drag to crop</strong> into desired area.</>,
    photoWidget: "Create matrix styled photo widgets.",
  };
    
  const previewContainerPadding = useMemo(() => {
    if ((activeTab === 'wallpaper' && panels.wallpaper.imageSrc && panels.wallpaper.wallpaperType === 'phone') || (activeTab === 'valueAliasing' && panels.valueAliasing.imageSrc && panels.valueAliasing.valueAliasingType === 'phone')) {
        return isMobile ? 'py-8 px-6' : 'p-6';
    }
    return 'p-4 sm:p-6';
  }, [activeTab, panels.wallpaper, panels.valueAliasing, isMobile]);
  
  const shareButtonClasses = `flex items-center p-2 md:px-3 transition-colors duration-300 rounded-md text-sm font-semibold ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'} ${easterEggPrimed ? 'easter-egg-glow' : ''}`;

  return (
    <>
      <input type="file" ref={pfpFileInputRef} onChange={(e) => e.target.files?.[0] && handlePfpFileSelect(e.target.files[0])} className="hidden" accept="image/*" />
      <input type="file" ref={wallpaperFileInputRef} onChange={(e) => e.target.files?.[0] && handleWallpaperFileSelect(e.target.files[0])} className="hidden" accept="image/*" />
      <input type="file" ref={photoWidgetFileInputRef} onChange={(e) => e.target.files?.[0] && handlePhotoWidgetFileSelect(e.target.files[0])} className="hidden" accept="image/png" />
      <input type="file" ref={valueAliasingFileInputRef} onChange={(e) => e.target.files?.[0] && handleValueAliasingFileSelect(e.target.files[0])} className="hidden" accept="image/*" />

      <div className={`min-h-[100dvh] md:h-screen w-full flex flex-col font-sans ${theme === 'dark' ? 'text-nothing-light bg-nothing-dark' : 'text-day-text bg-day-bg'} select-none`}>
        <header className={`flex-shrink-0 sticky top-0 z-30 flex justify-between items-center p-4 border-b ${theme === 'dark' ? 'bg-nothing-dark border-nothing-gray-dark' : 'bg-day-bg border-gray-300'}`}>
          <h1 className="text-2xl sm:text-3xl font-normal page-title">MATRICES FOR NOTHING COMMUNITY</h1>
          <div className="flex items-center space-x-2">
            {(() => {
              if (easterEggPrimed) {
                return (
                  <button onClick={unlockButtonAction} className={shareButtonClasses} aria-label="Unlock Secret Theme">
                    <span className="hidden md:inline">Unlock Secret</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 md:ml-2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </button>
                );
              }

              if (isMobile && installPrompt) {
                return (
                  <button onClick={handleInstallClick} className={`p-2 transition-colors duration-300 rounded-md ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`} aria-label="Install app">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                  </button>
                );
              } else {
                return (
                  <button onClick={() => {
                    trackEvent('community_thread_header_click');
                    window.open(NOTHING_COMMUNITY_SHARE_LINK, '_blank', 'noopener,noreferrer');
                  }} className={shareButtonClasses} aria-label="Visit Community Thread">
                    <span className="hidden md:inline">Community Thread</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 md:ml-2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                  </button>
                );
              }
            })()}

            <button 
              onClick={handleThemeToggle}
              onMouseDown={() => handleThemeTogglePress(panels.valueAliasing.imageSrc)}
              onMouseUp={handleThemeToggleRelease}
              onMouseLeave={handleThemeToggleRelease}
              onTouchStart={() => handleThemeTogglePress(panels.valueAliasing.imageSrc)}
              onTouchEnd={handleThemeToggleRelease}
              className={`p-2 transition-colors duration-300 rounded-md ${theme === 'dark' ? 'text-nothing-light bg-nothing-gray-dark hover:bg-nothing-gray-light hover:text-nothing-dark' : 'text-day-text bg-day-gray-light hover:bg-day-gray-dark hover:text-day-bg'}`} 
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-sun h-6 w-6"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-moon h-6 w-6"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              )}
            </button>
          </div>
        </header>

        <div className="block md:hidden pt-4 sm:pt-6">
          <div className="flex flex-col space-y-4">
            <div className={`relative flex w-full border-b ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`
                      text-center py-3 text-base transition-[flex,color,font-weight] duration-500 ease-in-out focus:outline-none focus:ring-0
                      ${isActive
                        ? (theme === 'dark' ? 'text-nothing-light font-bold' : 'text-day-text font-bold')
                        : (theme === 'dark' ? 'text-nothing-gray-light hover:text-nothing-light font-normal' : 'text-day-gray-dark hover:text-day-text font-normal')}
                    `}
                    style={{ flex: isActive ? '0 0 50%' : '1 1 0' }}
                    aria-pressed={isActive}
                  >
                    <span className={`truncate px-2 ${!isActive ? 'page-title text-xl' : ''}`}>
                      {isActive ? TAB_LABELS[tab] : TAB_ABBREVIATIONS[tab]}
                    </span>
                  </button>
                );
              })}
              <div
                className={`absolute bottom-[-1px] h-1 ${theme === 'dark' ? 'bg-white' : 'bg-black'} transition-[left] duration-500 ease-in-out`}
                style={mobileUnderlineStyle}
                aria-hidden="true"
              />
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
          </div>

          <div className="md:w-2/3 w-full flex flex-col">
            <div className="hidden md:block flex-shrink-0 py-4 sm:py-6 md:py-8 md:pb-4">
              <div className="flex flex-col space-y-4">
                <div className="relative flex border-b dark:border-nothing-gray-dark border-gray-300">
                  {TABS.map((tab, i) => (
                    <button key={tab} onClick={() => handleTabChange(tab)} className={`w-1/4 py-3 text-lg transition-colors duration-300 focus:outline-none ${activeTab === tab ? (theme === 'dark' ? 'text-nothing-light font-extrabold' : 'text-day-text font-extrabold') : (theme === 'dark' ? 'text-nothing-gray-light hover:text-nothing-light font-semibold' : 'text-day-gray-dark hover:text-day-text font-semibold')}`} aria-pressed={activeTab === tab}>
                      {TAB_LABELS[tab]}
                    </button>
                  ))}
                  <div className={`absolute bottom-[-1px] h-1 ${theme === 'dark' ? 'bg-white' : 'bg-black'} transition-[left] duration-300 ease-in-out`} style={{ width: '25%', left: `${activeTabIndex * 25}%` }} aria-hidden="true" />
                </div>
                <p className={`text-center w-full text-sm leading-normal transition-opacity duration-300 ${theme === 'dark' ? 'text-nothing-gray-light' : 'text-day-gray-dark'}`}>{tabDescriptions[activeTab]}</p>
                <hr className={`mt-2 ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`} />
              </div>
            </div>
            
            <div className="flex-grow md:overflow-y-auto md:relative md:overflow-hidden">
              <div className="hidden md:flex md:absolute md:top-0 md:left-0 md:w-full md:h-full transition-transform duration-300 ease-in-out" style={{ transform: `translateX(-${activeTabIndex * 100}%)` }}>
                {TABS.map(tab => (
                  <div key={tab} className="w-full flex-shrink-0 h-full overflow-y-auto">{panels[tab].controlsPanel}</div>
                ))}
              </div>
              <div className="block md:hidden">{activePanel.controlsPanel}</div>
              {!isMobile && (
                <>
                  <ToastNotification
                    show={showShareToast}
                    onClose={() => setShowShareToast(false)}
                    onShare={handleShare}
                    theme={theme}
                    isMobile={isMobile}
                    imageRendered={!!imageSrc}
                  />
                  <ToastNotification
                    show={showSpecialShareToast}
                    onClose={() => setShowSpecialShareToast(false)}
                    onShare={() => handleShare('special')}
                    theme={theme}
                    isMobile={isMobile}
                    imageRendered={!!imageSrc}
                    variant="special"
                  />
                </>
              )}
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

        <div className={`block md:hidden ${imageSrc ? 'sticky bottom-0' : ''} z-20 w-full ${theme === 'dark' ? 'bg-nothing-dark' : 'bg-day-bg'}`}>
            {imageSrc ? (
              <div className={`flex border-t ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`}>
                <div className={`w-1/2 border-r ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`}>
                  <button onClick={() => {
                    if (activeTab === 'pfp') pfpFileInputRef.current?.click();
                    if (activeTab === 'wallpaper') wallpaperFileInputRef.current?.click();
                    if (activeTab === 'photoWidget') photoWidgetFileInputRef.current?.click();
                    if (activeTab === 'valueAliasing') valueAliasingFileInputRef.current?.click();
                  }} disabled={activePanel.isLoading} className={`w-full h-full p-4 text-center text-lg font-bold transition-all duration-300 disabled:opacity-50 ${theme === 'dark' ? 'bg-nothing-dark text-nothing-light hover:bg-nothing-gray-dark' : 'bg-day-bg text-day-text hover:bg-day-gray-light'}`}>Replace Image</button>
                </div>
                <div className="w-1/2">
                  {activePanel.downloadButton}
                </div>
              </div>
            ) : (
              <footer className={`text-center tracking-wide p-4 border-t ${theme === 'dark' ? 'border-nothing-gray-dark' : 'border-gray-300'}`}>
                {footerLinks}
              </footer>
            )}
        </div>
        
        {isMobile && (
          <>
            <ToastNotification
              show={showShareToast}
              onClose={() => setShowShareToast(false)}
              onShare={handleShare}
              theme={theme}
              isMobile={isMobile}
              imageRendered={!!imageSrc}
            />
            <ToastNotification
              show={showSpecialShareToast}
              onClose={() => setShowSpecialShareToast(false)}
              onShare={() => handleShare('special')}
              theme={theme}
              isMobile={isMobile}
              imageRendered={!!imageSrc}
              variant="special"
            />
          </>
        )}
        
        <SharePopup 
            show={showSharePopup}
            onClose={() => setShowSharePopup(false)}
            theme={theme}
            communityLink={NOTHING_COMMUNITY_SHARE_LINK}
            appUrl={APP_URL}
            variant={shareVariant}
        />
      </div>
    </>
  );
};

export default App;
