import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Download, ChevronLeft, ChevronRight, TrendingUp, Award } from 'lucide-react';
import { AppRecord } from '../types';
import { Link } from 'react-router-dom';

interface AppSliderProps {
  apps: AppRecord[];
  title: string;
  icon: React.ReactNode;
}

export const AppSlider: React.FC<AppSliderProps> = ({ apps, title, icon }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % apps.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + apps.length) % apps.length);
  };

  useEffect(() => {
    if (!isHovered && apps.length > 0) {
      timerRef.current = setInterval(nextSlide, 5000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered, apps.length]);

  if (apps.length === 0) return null;

  return (
    <div 
      className="relative w-full overflow-hidden rounded-[2.5rem] p-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-between mb-6 px-4">
        <h2 className="text-2xl font-display font-bold flex items-center" style={{ color: 'var(--text-main)' }}>
          <span className="p-2 bg-brand-500/10 rounded-xl mr-3">
            {icon}
          </span>
          {title}
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={prevSlide}
            className="p-2 rounded-full bg-neutral-500/20 hover:bg-neutral-500/40 border border-neutral-500/30 transition-all shadow-md backdrop-blur-sm"
            style={{ color: 'var(--text-main)' }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={nextSlide}
            className="p-2 rounded-full bg-neutral-500/20 hover:bg-neutral-500/40 border border-neutral-500/30 transition-all shadow-md backdrop-blur-sm"
            style={{ color: 'var(--text-main)' }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative h-[450px] sm:h-[400px] md:h-[450px] lg:h-[500px] w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <Link to={`/app/${apps[currentIndex].id}#download`} className="block h-full w-full group">
              <div className="relative h-full w-full rounded-[2rem] overflow-hidden shadow-2xl border border-white/10">
                {/* Background Image with Blur */}
                <div className="absolute inset-0">
                  <img 
                    src={apps[currentIndex].screenshots?.[0] || apps[currentIndex].icon_url} 
                    alt="" 
                    className="w-full h-full object-cover blur-sm brightness-50 scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                </div>

                {/* Content Overlay */}
                <div className="absolute inset-0 p-6 md:p-12 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="w-24 h-24 sm:w-32 sm:h-32 md:w-48 md:h-48 shrink-0 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white/20"
                  >
                    <img 
                      src={apps[currentIndex].icon_url} 
                      alt={apps[currentIndex].name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </motion.div>

                  <div className="flex-1 text-center md:text-left">
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-3 mb-3 md:mb-4">
                        <span className="px-2 md:px-3 py-1 bg-brand-500 text-white text-[9px] md:text-[10px] font-bold rounded-full uppercase tracking-wider">
                          {apps[currentIndex].category}
                        </span>
                        <div className="flex items-center gap-1 text-amber-500 font-bold bg-black/40 backdrop-blur-md px-2 md:px-3 py-1 rounded-full text-xs md:text-sm">
                          <Star className="w-3 h-3 md:w-4 md:h-4 fill-current" />
                          {apps[currentIndex].rating.toFixed(1)}
                        </div>
                        <div className="flex items-center gap-1 text-blue-400 font-bold bg-black/40 backdrop-blur-md px-2 md:px-3 py-1 rounded-full text-xs md:text-sm">
                          <Download className="w-3 h-3 md:w-4 md:h-4" />
                          {apps[currentIndex].downloads.toLocaleString()}
                        </div>
                      </div>
                      <h3 className="text-2xl sm:text-3xl md:text-5xl font-display font-bold text-white mb-2 md:mb-4 group-hover:text-brand-500 transition-colors line-clamp-1 md:line-clamp-none">
                        {apps[currentIndex].name}
                      </h3>
                      <p className="text-neutral-300 text-xs sm:text-sm md:text-lg max-w-2xl line-clamp-3 md:line-clamp-2 mb-4 md:mb-6">
                        {apps[currentIndex].description}
                      </p>
                      <div className="flex items-center justify-center md:justify-start gap-4">
                        <span className="text-neutral-400 text-[10px] md:text-sm font-medium">
                          Developed by <span className="text-white font-bold">{apps[currentIndex].developer}</span>
                        </span>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        </AnimatePresence>

        {/* Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {apps.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.preventDefault();
                setCurrentIndex(idx);
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'w-8 bg-brand-500' : 'w-2 bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
