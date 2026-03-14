import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Info, AlertTriangle, CheckCircle, Zap } from 'lucide-react';

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  timestamp: number;
}

interface DigitalNotificationProps {
  notification: NotificationData;
  onClose: () => void;
}

export const DigitalNotification: React.FC<DigitalNotificationProps> = ({ notification, onClose }) => {
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!isHovered) {
      const timer = setTimeout(() => {
        onClose();
      }, 8000); // Auto close after 8 seconds if not hovered
      return () => clearTimeout(timer);
    }
  }, [isHovered, onClose]);

  const getIcon = () => {
    switch (notification.type) {
      case 'warning': return <AlertTriangle className="w-6 h-6 text-amber-400" />;
      case 'success': return <CheckCircle className="w-6 h-6 text-emerald-400" />;
      case 'alert': return <Zap className="w-6 h-6 text-brand-500" />;
      default: return <Info className="w-6 h-6 text-blue-400" />;
    }
  };

  const getGlowColor = () => {
    switch (notification.type) {
      case 'warning': return 'shadow-amber-500/20 border-amber-500/30';
      case 'success': return 'shadow-emerald-500/20 border-emerald-500/30';
      case 'alert': return 'shadow-brand-500/20 border-brand-500/30';
      default: return 'shadow-blue-500/20 border-blue-500/30';
    }
  };

  return (
    <div className="fixed top-24 right-4 md:right-8 z-[100] w-[calc(100%-2rem)] max-w-md pointer-events-none">
      <motion.div
        initial={{ opacity: 0, x: 50, scale: 0.9, rotateY: 20 }}
        animate={{ 
          opacity: 1, 
          x: 0, 
          scale: 1, 
          rotateY: 0,
          y: isHovered ? -5 : 0
        }}
        transition={{ 
          type: 'spring', 
          stiffness: 400, 
          damping: 30 
        }}
        exit={{ 
          opacity: 0, 
          x: 20, 
          scale: 0.95, 
          transition: { duration: 0.3, ease: 'easeIn' } 
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          pointer-events-auto relative overflow-hidden
          bg-neutral-900/90 backdrop-blur-xl border ${getGlowColor()}
          rounded-3xl p-6 shadow-2xl transition-all duration-300
        `}
        style={{
          transformStyle: 'preserve-3d',
          perspective: '1000px'
        }}
      >
        {/* Digital Grid Background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
        
        {/* Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
          <div className="w-full h-[2px] bg-white/20 animate-scanline"></div>
        </div>

        <div className="relative flex gap-4">
          <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 shadow-inner`}>
            {getIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-white font-display font-bold text-lg truncate">
                {notification.title}
              </h4>
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-1.5 rounded-xl transition-colors text-neutral-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed mb-3">
              {notification.message}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
                System Broadcast // {new Date(notification.timestamp).toLocaleTimeString()}
              </span>
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-brand-500 animate-pulse"></div>
                <div className="w-1 h-1 rounded-full bg-brand-500 animate-pulse delay-75"></div>
                <div className="w-1 h-1 rounded-full bg-brand-500 animate-pulse delay-150"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Hover Glow Effect */}
        <motion.div 
          className="absolute -inset-1 bg-gradient-to-r from-brand-500/0 via-brand-500/10 to-brand-500/0 opacity-0 group-hover:opacity-100 transition-opacity"
          animate={{ x: isHovered ? ['-100%', '100%'] : '0%' }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>
    </div>
  );
};
