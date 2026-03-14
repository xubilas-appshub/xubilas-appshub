import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  AlertTriangle, 
  X,
  Lock,
  UserX,
  Clock,
  ShieldAlert
} from 'lucide-react';

export type DialogType = 'error' | 'success' | 'info' | 'warning' | 'auth-error' | 'unregistered' | 'blocked' | 'pending' | 'danger';

interface ModernDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

export const ModernDialog: React.FC<ModernDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  showCancel = true,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-12 h-12 text-emerald-500" />;
      case 'error':
      case 'auth-error':
      case 'danger':
        return <AlertCircle className="w-12 h-12 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-12 h-12 text-amber-500" />;
      case 'unregistered':
        return <UserX className="w-12 h-12 text-neutral-400" />;
      case 'blocked':
        return <ShieldAlert className="w-12 h-12 text-red-600" />;
      case 'pending':
        return <Clock className="w-12 h-12 text-blue-500" />;
      default:
        return <Info className="w-12 h-12 text-blue-500" />;
    }
  };

  const getAccentColor = () => {
    switch (type) {
      case 'success': return 'bg-emerald-500';
      case 'error':
      case 'auth-error':
      case 'blocked':
      case 'danger': return 'bg-red-500';
      case 'warning': return 'bg-amber-500';
      case 'pending': return 'bg-blue-500';
      default: return 'bg-brand-500';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ 
              opacity: 0, 
              scale: 0.9, 
              y: 20,
              transition: { duration: 0.2, ease: 'easeIn' }
            }}
            className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] bg-white shadow-2xl transition-colors duration-300 dark:bg-neutral-900"
            style={{ 
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-main)',
              borderColor: 'var(--card-border)',
              borderWidth: '1px'
            }}
          >
            {/* Top Accent Bar */}
            <div className={`h-2 w-full ${getAccentColor()}`} />
            
            <div className="p-8">
              <div className="mb-6 flex justify-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                >
                  {getIcon()}
                </motion.div>
              </div>
              
              <div className="text-center">
                <h3 className="mb-2 font-display text-2xl font-bold">{title}</h3>
                <p className="text-sm opacity-70 leading-relaxed">
                  {message}
                </p>
              </div>
              
              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={() => {
                    if (onConfirm) onConfirm();
                    else onClose();
                  }}
                  className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${getAccentColor()}`}
                >
                  {confirmText}
                </button>
                
                {showCancel && (
                  <button
                    onClick={onClose}
                    className="w-full py-4 rounded-2xl font-bold opacity-60 hover:opacity-100 transition-all"
                  >
                    {cancelText}
                  </button>
                )}
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5 opacity-40" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
