import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, ChevronDown, Shield, UserCircle, Sun, Moon, Cloud } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

type Theme = 'light' | 'dark' | 'grey';

export const PortalButton: React.FC = () => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('app-theme') as Theme;
    return saved || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const toggleTheme = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTheme((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'grey';
      return 'light';
    });
  };

  const isPortal = location.pathname.startsWith('/admin') || location.pathname.startsWith('/developer');

  if (isPortal) {
    return null;
  }

  if (!isHomePage) {
    return (
      <div className="fixed top-6 right-20 z-[100]">
        <button 
          onClick={toggleTheme}
          className="flex items-center justify-center w-12 h-12 bg-neutral-900/80 backdrop-blur-md text-white rounded-full hover:bg-neutral-900 transition-all shadow-xl border border-white/10 group"
          title={`Switch Theme (Current: ${theme})`}
        >
          {theme === 'light' && <Sun className="w-5 h-5 text-amber-500 group-hover:rotate-45 transition-transform" />}
          {theme === 'dark' && <Moon className="w-5 h-5 text-indigo-400 group-hover:-rotate-12 transition-transform" />}
          {theme === 'grey' && <Cloud className="w-5 h-5 text-neutral-400 group-hover:scale-110 transition-transform" />}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-6 right-6 z-[100]">
      <div className="relative">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-5 py-3 bg-neutral-900/80 backdrop-blur-md text-white rounded-full text-sm font-bold hover:bg-neutral-900 transition-all shadow-xl border border-white/10"
        >
          <LayoutDashboard className="w-4 h-4 text-brand-500" />
          <span>Portal</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <div 
                className="fixed inset-0 z-[-1]" 
                onClick={() => setIsOpen(false)}
              />
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 top-full mt-3 w-64 rounded-2xl shadow-2xl border overflow-hidden z-[110] transition-colors duration-300"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
              >
                <div className="p-2">
                  <Link 
                    to="/login?role=admin"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ color: 'var(--text-main)' }}
                  >
                    <Shield className="w-4 h-4 text-brand-500" />
                    Admin Portal
                  </Link>
                  <Link 
                    to="/login?role=developer"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ color: 'var(--text-main)' }}
                  >
                    <UserCircle className="w-4 h-4 text-blue-500" />
                    Developer Portal
                  </Link>
                </div>

                <div className="p-2 border-t" style={{ borderColor: 'var(--card-border)' }}>
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ color: 'var(--text-main)' }}
                  >
                    <div className="flex items-center gap-3">
                      {theme === 'light' && <Sun className="w-4 h-4 text-amber-500" />}
                      {theme === 'dark' && <Moon className="w-4 h-4 text-indigo-400" />}
                      {theme === 'grey' && <Cloud className="w-4 h-4 text-neutral-400" />}
                      <span>Theme</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider opacity-50">{theme}</span>
                  </button>
                </div>

                <div className="p-3 border-t transition-colors duration-300" style={{ backgroundColor: 'rgba(var(--bg-main-rgb), 0.1)', borderColor: 'var(--card-border)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-center opacity-40" style={{ color: 'var(--text-main)' }}>
                    Management Access Only
                  </p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

