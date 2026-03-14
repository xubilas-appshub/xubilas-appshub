import React from 'react';
import { motion } from 'framer-motion';
import { Star, Download, ExternalLink } from 'lucide-react';
import { AppRecord } from '../types';
import { Link } from 'react-router-dom';

interface AppCardProps {
  app: AppRecord;
}

export const AppCard: React.FC<AppCardProps> = ({ app }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      className="group relative transition-all duration-300"
    >
      <Link to={`/app/${app.id}#download`} className="block">
        <div className="aspect-square rounded-2xl md:rounded-[1.5rem] overflow-hidden bg-neutral-500/10 mb-2 shadow-sm group-hover:shadow-xl transition-all duration-300 border border-white/5">
          <img
            src={app.icon_url || `https://picsum.photos/seed/${app.id}/400/400`}
            alt={app.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="px-1">
          <h3 className="font-display font-bold text-[11px] md:text-sm truncate leading-tight mb-0.5" style={{ color: 'var(--text-main)' }}>
            {app.name}
          </h3>
          <div className="flex items-center justify-between">
            <p className="text-[9px] md:text-[10px] opacity-50 truncate flex-1" style={{ color: 'var(--text-main)' }}>
              {app.category}
            </p>
            <div className="flex items-center text-amber-500 text-[9px] md:text-[10px] font-bold ml-1">
              <Star className="w-2 h-2 md:w-2.5 md:h-2.5 fill-current mr-0.5" />
              {(app.rating || 0).toFixed(1)}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};
