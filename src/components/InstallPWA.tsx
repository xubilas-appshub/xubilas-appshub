import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const InstallPWA: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.5, y: 100 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.5, y: 100 }}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[500]"
      >
        <motion.button
          onClick={handleInstallClick}
          whileHover={{ 
            scale: 1.1,
            boxShadow: "0 20px 25px -5px rgb(34 197 94 / 0.4), 0 8px 10px -6px rgb(34 197 94 / 0.4)"
          }}
          whileTap={{ scale: 0.9 }}
          className="flex items-center gap-3 bg-brand-500 text-white px-8 py-4 rounded-full font-bold shadow-2xl shadow-brand-500/30 transition-all group relative overflow-hidden"
        >
          {/* Shimmer Effect */}
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />
          
          <div className="relative flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full group-hover:rotate-12 transition-transform">
              <Download className="w-5 h-5" />
            </div>
            <span className="text-sm md:text-base whitespace-nowrap">Install APPS HUB</span>
          </div>
          
          {/* Close button inside or next to it? User asked for a button. 
              I'll add a small close button to hide it if they really don't want it. */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsVisible(false);
            }}
            className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-4 h-4 opacity-60 hover:opacity-100" />
          </button>
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
};
