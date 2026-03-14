import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Star, 
  Download, 
  ChevronLeft, 
  ShieldCheck, 
  Info, 
  MessageSquare, 
  Share2,
  Calendar,
  HardDrive,
  Code,
  X,
  Copy,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AppRecord, Review } from '../types';
import { supabase } from '../lib/supabase';
import { downloadFileReliably } from '../lib/fileUtils';
import { AppCard } from '../components/AppCard';
import { ModernDialog } from '../components/ModernDialog';

export const AppDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [app, setApp] = useState<AppRecord | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [relatedApps, setRelatedApps] = useState<AppRecord[]>([]);
  const [showThanksDialog, setShowThanksDialog] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');

  useEffect(() => {
    fetchAppDetails();

    // Set up real-time subscriptions
    const appChannel = supabase
      .channel(`app-detail-${id}`)
      .on('postgres_changes', { event: '*', table: 'apps', schema: 'public', filter: `id=eq.${id}` }, () => {
        fetchAppDetails();
      })
      .subscribe();

    const reviewsChannel = supabase
      .channel(`app-reviews-${id}`)
      .on('postgres_changes', { event: '*', table: 'reviews', schema: 'public', filter: `app_id=eq.${id}` }, () => {
        fetchAppDetails(); // Refetching everything for simplicity
      })
      .subscribe();

    return () => {
      supabase.removeChannel(appChannel);
      supabase.removeChannel(reviewsChannel);
    };
  }, [id]);

  useEffect(() => {
    if (!loading && app && location.hash === '#download') {
      // Small delay to ensure layout is stable
      const timer = setTimeout(() => {
        const element = document.getElementById('download');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Add a more prominent highlight effect
          element.classList.add('ring-offset-4', 'ring-4', 'ring-brand-500', 'scale-105');
          setTimeout(() => {
            element.classList.remove('ring-offset-4', 'ring-4', 'ring-brand-500', 'scale-105');
          }, 2000);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading, app, location.hash]);

  const fetchAppDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('apps')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setApp(data);

      // Fetch reviews
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*')
        .eq('app_id', id)
        .order('created_at', { ascending: false });
      
      setReviews(reviewsData || []);

      // Fetch related apps
      const { data: relatedData } = await supabase
        .from('apps')
        .select('*')
        .eq('category', data.category)
        .eq('status', 'published')
        .neq('id', id)
        .limit(6);
      
      setRelatedApps(relatedData || []);
    } catch (error) {
      console.error('Error fetching app details:', error);
      setApp(null);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    setIsShareModalOpen(true);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: app?.name,
          text: `Check out ${app?.name} on XUBILASS APP HUB!`,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    }
  };

  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'completed'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleDownload = async () => {
    if (!app || downloadStatus !== 'idle') return;
    
    setDownloadStatus('downloading');
    setDownloadProgress(0);

    // Increment download count in Supabase via RPC to bypass RLS and ensure atomicity
    try {
      const { error: rpcError } = await supabase.rpc('increment_download_count', { 
        target_app_id: app.id 
      });
      
      if (rpcError) {
        // Fallback to direct update if RPC fails (might happen if function not created yet)
        console.warn('RPC failed, falling back to direct update:', rpcError);
        await supabase
          .from('apps')
          .update({ downloads: (app.downloads || 0) + 1 })
          .eq('id', app.id);
      }
      
      setApp({ ...app, downloads: (app.downloads || 0) + 1 });
      
      // Trigger reliable download
      const filename = `${app.name.replace(/\s+/g, '_')}_v${app.version}.apk`;
      await downloadFileReliably(app.apk_url, filename, (progress) => {
        setDownloadProgress(progress);
      });

      // Complete the animation
      setDownloadProgress(100);
      setTimeout(() => {
        setDownloadStatus('completed');
        setTimeout(() => setDownloadStatus('idle'), 3000);
      }, 500);

    } catch (err) {
      console.error('Error updating downloads:', err);
      setDownloadStatus('idle');
      // Fallback to simple link if fetch fails
      window.open(app.apk_url, '_blank');
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app) return;
    
    setSubmittingReview(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userName = session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Anonymous';

      const { error } = await supabase
        .from('reviews')
        .insert([{
          app_id: app.id,
          user_name: userName,
          rating: newReview.rating,
          comment: newReview.comment
        }]);

      if (error) throw error;

      // Update local reviews state
      const newReviewObj: Review = {
        id: Math.random().toString(),
        app_id: app.id,
        user_name: userName,
        rating: newReview.rating,
        comment: newReview.comment,
        created_at: new Date().toISOString()
      };
      
      const updatedReviews = [newReviewObj, ...reviews];
      setReviews(updatedReviews);
      
      // Calculate new average rating locally for immediate feedback
      const totalRating = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
      const newAverage = totalRating / updatedReviews.length;
      
      setApp({
        ...app,
        rating: newAverage
      });

      setNewReview({ rating: 5, comment: '' });
      
      // Fetch fresh app details to get the new average rating calculated by the DB trigger
      // This ensures we are synced with the server
      setTimeout(() => fetchAppDetails(), 1000);
      
      setDialogMessage('Your review has been posted successfully. Thank you for your feedback!');
      setShowThanksDialog(true);
    } catch (err: any) {
      console.error('Error submitting review:', err);
      setDialogMessage(`Error: ${err.message}`);
      setShowThanksDialog(true);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6 pt-24 md:pt-32">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            <div className="lg:col-span-2">
              <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start mb-8 md:mb-12">
                <div className="w-28 h-28 sm:w-32 sm:h-32 md:w-48 md:h-48 rounded-full bg-neutral-200 animate-pulse" />
                <div className="flex-1 space-y-4 w-full">
                  <div className="h-10 bg-neutral-200 rounded-xl w-3/4 animate-pulse mx-auto md:mx-0" />
                  <div className="h-6 bg-neutral-200 rounded-lg w-1/4 animate-pulse mx-auto md:mx-0" />
                  <div className="flex justify-center md:justify-start gap-4">
                    <div className="h-12 bg-neutral-200 rounded-xl w-20 animate-pulse" />
                    <div className="h-12 bg-neutral-200 rounded-xl w-20 animate-pulse" />
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="h-40 bg-neutral-200 rounded-3xl animate-pulse" />
                <div className="h-64 bg-neutral-200 rounded-3xl animate-pulse" />
              </div>
            </div>
            <div className="space-y-6">
              <div className="h-64 bg-neutral-200 rounded-3xl animate-pulse" />
              <div className="h-32 bg-neutral-200 rounded-3xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!app) return <div className="min-h-screen flex items-center justify-center">App not found</div>;

  return (
    <div className="min-h-screen pb-20">
      {/* Floating Back Button */}
      <div className="fixed top-6 left-6 z-[100]">
        <Link 
          to="/" 
          className="flex items-center justify-center w-12 h-12 bg-neutral-900/80 backdrop-blur-md text-white rounded-full shadow-xl border border-white/10 hover:bg-neutral-900 transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </Link>
      </div>

      {/* Floating Share Button */}
      <div className="fixed top-6 right-6 z-[100]">
        <button 
          onClick={handleShare}
          className="flex items-center justify-center w-12 h-12 bg-neutral-900/80 backdrop-blur-md text-white rounded-full shadow-xl border border-white/10 hover:bg-neutral-900 transition-all"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-24 md:pt-32">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Left Column: App Info */}
          <div className="lg:col-span-2">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start mb-8 md:mb-12">
              <div className="relative shrink-0">
                {/* Progress Ring around Icon */}
                {downloadStatus !== 'idle' && (
                  <div className="absolute -inset-3 md:-inset-4 z-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="46"
                        className="stroke-neutral-100 fill-none"
                        strokeWidth="3"
                      />
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="46"
                        className="stroke-brand-500 fill-none"
                        strokeWidth="3"
                        strokeDasharray="289"
                        initial={{ strokeDashoffset: 289 }}
                        animate={{ strokeDashoffset: 289 - (289 * downloadProgress) / 100 }}
                        transition={{ duration: 0.3 }}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                )}
                <div className="w-28 h-28 sm:w-32 sm:h-32 md:w-48 md:h-48 rounded-full bg-neutral-100 flex items-center justify-center shadow-2xl border-4 border-white relative z-10 overflow-hidden">
                  <motion.img
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    src={app.icon_url}
                    alt={app.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
              <div className="flex-1 text-center md:text-left w-full">
                <h1 className="text-2xl sm:text-3xl md:text-5xl font-display font-bold mb-2 break-words">{app.name}</h1>
                <p className="text-brand-600 font-medium text-base md:text-lg mb-4">{app.developer}</p>
                <div className="flex flex-wrap justify-center md:justify-start gap-3 sm:gap-4 md:gap-6 mb-6 md:mb-8">
                  <div className="flex flex-col items-center md:items-start">
                    <span className="text-[10px] md:text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-main)', opacity: 0.5 }}>Rating</span>
                    <div className="flex items-center font-bold text-sm sm:text-base md:text-lg">
                      {(app.rating || 0).toFixed(1)} <Star className="w-3.5 h-3.5 md:w-4 md:h-4 fill-amber-500 text-amber-500 ml-1" />
                    </div>
                  </div>
                  <div className="flex flex-col items-center md:items-start border-l border-neutral-200 pl-3 sm:pl-4 md:pl-6">
                    <span className="text-[10px] md:text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-main)', opacity: 0.5 }}>Downloads</span>
                    <span className="font-bold text-sm sm:text-base md:text-lg">{app.downloads.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-center md:items-start border-l border-neutral-200 pl-3 sm:pl-4 md:pl-6">
                    <span className="text-[10px] md:text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-main)', opacity: 0.5 }}>Size</span>
                    <span className="font-bold text-sm sm:text-base md:text-lg">{app.size}</span>
                  </div>
                </div>
                <motion.button 
                  id="download"
                  onClick={handleDownload}
                  disabled={downloadStatus !== 'idle'}
                  whileHover={downloadStatus === 'idle' ? { 
                    scale: 1.02,
                    boxShadow: "0 20px 25px -5px rgb(34 197 94 / 0.2), 0 8px 10px -6px rgb(34 197 94 / 0.2)"
                  } : {}}
                  whileTap={downloadStatus === 'idle' ? { scale: 0.98 } : {}}
                  className={`w-full md:w-auto px-8 md:px-12 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-base md:text-lg shadow-lg transition-all flex items-center justify-center relative overflow-hidden group ${
                    downloadStatus === 'completed' ? 'bg-green-500 text-white shadow-green-500/20' : 
                    downloadStatus === 'downloading' ? 'bg-neutral-100 text-neutral-400 cursor-default' :
                    'bg-brand-500 text-white shadow-brand-500/20'
                  }`}
                >
                  {/* Shimmer Effect on Hover */}
                  {downloadStatus === 'idle' && (
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
                  )}

                  <AnimatePresence mode="wait">
                    {downloadStatus === 'idle' && (
                      <motion.div
                        key="idle"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center"
                      >
                        <Download className="w-5 h-5 md:w-6 md:h-6 mr-2 group-hover:bounce" />
                        Download APK
                      </motion.div>
                    )}
                    {downloadStatus === 'downloading' && (
                      <motion.div
                        key="downloading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-3"
                      >
                        <div className="relative w-6 h-6 md:w-8 md:h-8">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 32 32">
                            <circle
                              cx="16"
                              cy="16"
                              r="14"
                              className="stroke-neutral-200 fill-none"
                              strokeWidth="3"
                            />
                            <motion.circle
                              cx="16"
                              cy="16"
                              r="14"
                              className="stroke-brand-500 fill-none"
                              strokeWidth="3"
                              strokeDasharray="88"
                              initial={{ strokeDashoffset: 88 }}
                              animate={{ strokeDashoffset: 88 - (88 * downloadProgress) / 100 }}
                              transition={{ duration: 0.3 }}
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                        <span className="text-neutral-600 font-mono">
                          {downloadProgress}%
                        </span>
                      </motion.div>
                    )}
                    {downloadStatus === 'completed' && (
                      <motion.div
                        key="completed"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="flex items-center"
                      >
                        <Check className="w-5 h-5 md:w-6 md:h-6 mr-2" />
                        Ready to Install
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </div>

            {/* Screenshots */}
            {app.screenshots && app.screenshots.length > 0 && (
              <section className="mb-10 md:mb-12">
                <h2 className="text-lg md:text-xl font-display font-bold mb-4 md:mb-6">Screenshots</h2>
                <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                  {app.screenshots.map((src, idx) => (
                    <motion.img
                      key={idx}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      src={src}
                      alt={`Screenshot ${idx + 1}`}
                      onClick={() => setSelectedScreenshot(src)}
                      className="h-56 sm:h-64 md:h-96 rounded-xl md:rounded-2xl shadow-md object-cover flex-shrink-0 cursor-pointer"
                      referrerPolicy="no-referrer"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Description */}
            <section className="mb-10 md:mb-12">
              <h2 className="text-lg md:text-xl font-display font-bold mb-3 md:mb-4">About this app</h2>
              <div 
                className={`text-sm md:text-base leading-relaxed whitespace-pre-wrap transition-all duration-300 ${!isDescriptionExpanded ? 'line-clamp-1' : ''}`}
                style={{ color: 'var(--text-main)', opacity: 0.8 }}
              >
                {app.description}
              </div>
              {app.description && app.description.length > 100 && (
                <button 
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  className="mt-2 text-brand-600 text-sm font-bold flex items-center gap-1 hover:underline"
                >
                  {isDescriptionExpanded ? (
                    <>Show Less <ChevronUp className="w-4 h-4" /></>
                  ) : (
                    <>View More <ChevronDown className="w-4 h-4" /></>
                  )}
                </button>
              )}
            </section>

            {/* Reviews */}
            <section className="mb-10 lg:mb-0">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h2 className="text-lg md:text-xl font-display font-bold">Ratings & Reviews</h2>
              </div>

              {/* Rating Summary Block */}
              <div 
                className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 p-6 md:p-8 rounded-3xl border shadow-sm transition-colors duration-300"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
              >
                <div className="flex flex-col items-center justify-center text-center md:border-r border-neutral-100 md:pr-8" style={{ borderColor: 'var(--card-border)' }}>
                  <div className="text-5xl md:text-6xl font-display font-bold mb-2" style={{ color: 'var(--text-main)' }}>
                    {(app.rating || 0).toFixed(1)}
                  </div>
                  <div className="flex text-amber-500 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className={`w-5 h-5 ${star <= Math.round(app.rating || 0) ? 'fill-current' : 'text-neutral-200'}`} 
                      />
                    ))}
                  </div>
                  <div className="text-sm text-neutral-500 font-medium">
                    {reviews.length} Ratings
                  </div>
                </div>
                
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviews.filter(r => r.rating === star).length;
                    const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-3">
                        <span className="text-xs font-bold w-3">{star}</span>
                        <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            className="h-full bg-amber-500 rounded-full"
                          />
                        </div>
                        <span className="text-[10px] text-neutral-400 w-8 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add Review Form */}
              <div 
                className="mb-8 p-6 rounded-2xl border shadow-sm transition-colors duration-300"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
              >
                <h3 className="font-bold mb-4" style={{ color: 'var(--text-main)' }}>Write a Review</h3>
                <form onSubmit={submitReview} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm opacity-60" style={{ color: 'var(--text-main)' }}>Rating:</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewReview({ ...newReview, rating: star })}
                          className="focus:outline-none"
                        >
                          <Star 
                            className={`w-6 h-6 ${star <= newReview.rating ? 'fill-amber-500 text-amber-500' : 'text-neutral-200 dark:text-neutral-700'}`} 
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    required
                    placeholder="Share your thoughts about this app..."
                    className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none min-h-[100px] transition-colors duration-300"
                    style={{ 
                      backgroundColor: 'rgba(var(--bg-main-rgb), 0.5)', 
                      borderColor: 'var(--card-border)',
                      color: 'var(--text-main)'
                    }}
                    value={newReview.comment}
                    onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                  />
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-8 py-2 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-50"
                  >
                    {submittingReview ? 'Submitting...' : 'Post Review'}
                  </button>
                </form>
              </div>

              <div className="space-y-4 md:space-y-6">
                {reviews.length > 0 ? (
                  reviews.map(review => (
                    <div key={review.id} className="p-4 md:p-6 rounded-xl md:rounded-2xl border transition-colors duration-300" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-sm md:text-base">{review.user_name}</span>
                        <div className="flex text-amber-500">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`w-2.5 h-2.5 md:w-3 md:h-3 ${i < review.rating ? 'fill-current' : 'text-neutral-200'}`} />
                          ))}
                        </div>
                      </div>
                      <p 
                        className="text-xs md:text-sm"
                        style={{ color: 'var(--text-main)', opacity: 0.7 }}
                      >
                        {review.comment}
                      </p>
                    </div>
                  ))
                ) : (
                  <div 
                    className="p-6 md:p-8 rounded-xl md:rounded-2xl border border-dashed text-center text-sm md:text-base transition-colors duration-300"
                    style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--card-border)', color: 'var(--text-main)', opacity: 0.6 }}
                  >
                    No reviews yet. Be the first to review!
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Sidebar Info */}
          <div className="space-y-6 md:space-y-8">
            <div className="p-5 md:p-6 rounded-2xl md:rounded-3xl border shadow-sm transition-colors duration-300" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <h3 className="font-display font-bold mb-4 md:mb-6 flex items-center text-base md:text-lg">
                <Info className="w-4 h-4 md:w-5 md:h-5 mr-2" style={{ color: 'var(--text-main)', opacity: 0.4 }} />
                Information
              </h3>
              <div className="space-y-1">
                <div className="flex justify-between items-center py-3 border-b border-neutral-100 dark:border-white/5">
                  <span className="text-xs md:text-sm flex items-center" style={{ color: 'var(--text-main)', opacity: 0.6 }}>
                    <Code className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2" /> Developer
                  </span>
                  <span className="font-medium text-xs md:text-sm">{app.developer}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-neutral-100 dark:border-white/5">
                  <span className="text-xs md:text-sm flex items-center" style={{ color: 'var(--text-main)', opacity: 0.6 }}>
                    <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2" /> Updated
                  </span>
                  <span className="font-medium text-xs md:text-sm">{new Date(app.updated_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-neutral-100 dark:border-white/5">
                  <span className="text-xs md:text-sm flex items-center" style={{ color: 'var(--text-main)', opacity: 0.6 }}>
                    <HardDrive className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2" /> Version
                  </span>
                  <span className="font-medium text-xs md:text-sm">{app.version}</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-xs md:text-sm flex items-center" style={{ color: 'var(--text-main)', opacity: 0.6 }}>
                    <ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2" /> Safety
                  </span>
                  <span className="text-brand-600 font-medium text-xs md:text-sm">Verified</span>
                </div>
              </div>
            </div>

            <div 
              className="p-5 md:p-6 rounded-2xl md:rounded-3xl border transition-colors duration-300"
              style={{ backgroundColor: 'rgba(var(--bg-main-rgb), 0.5)', borderColor: 'var(--card-border)' }}
            >
              <h3 className="font-display font-bold mb-2 text-base md:text-lg">Developer Support</h3>
              <p className="text-xs md:text-sm mb-4 opacity-70">Have issues with this app? Contact the developer directly.</p>
              <a 
                href={app.support_contact ? (app.support_contact.includes('@') ? `mailto:${app.support_contact}` : app.support_contact) : `mailto:support@${app.developer.toLowerCase().replace(/\s+/g, '')}.com?subject=Support for ${app.name}`}
                target={app.support_contact && !app.support_contact.includes('@') ? "_blank" : undefined}
                rel={app.support_contact && !app.support_contact.includes('@') ? "noopener noreferrer" : undefined}
                className="w-full py-3 rounded-xl font-semibold border transition-colors flex items-center justify-center text-sm md:text-base"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Contact Support
              </a>
            </div>
          </div>
        </div>

        {/* Related Apps Section */}
        {relatedApps.length > 0 && (
          <section className="mt-20 pt-20 border-t border-neutral-100">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-display font-bold">You might also like</h2>
              <Link to="/" className="text-brand-600 font-bold text-sm hover:underline">View All</Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4">
              {relatedApps.map(relatedApp => (
                <AppCard key={relatedApp.id} app={relatedApp} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Share Modal */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl transition-colors duration-300"
              style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-main)' }}
            >
              <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                <h3 className="text-xl font-display font-bold">Share App</h3>
                <button 
                  onClick={() => setIsShareModalOpen(false)}
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-400" />
                </button>
              </div>
              
              <div 
                className="p-8 flex flex-col items-center text-center transition-colors duration-300"
                style={{ background: 'var(--card-bg)', color: 'var(--text-main)' }}
              >
                <div className="bg-neutral-50 p-6 rounded-3xl mb-6 border border-neutral-100">
                  <QRCodeSVG 
                    value={window.location.href} 
                    size={180}
                    level="H"
                    includeMargin={false}
                    imageSettings={{
                      src: app?.icon_url || '',
                      x: undefined,
                      y: undefined,
                      height: 40,
                      width: 40,
                      excavate: true,
                    }}
                  />
                </div>
                
                <h4 className="text-lg font-bold text-neutral-900 mb-1">{app?.name}</h4>
                <p className="text-sm text-neutral-500 mb-6">Scan this QR code to download directly on your device</p>
                
                <div className="w-full space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-neutral-50 rounded-2xl border border-neutral-200">
                    <input 
                      type="text" 
                      readOnly 
                      value={window.location.href}
                      className="flex-1 bg-transparent text-xs text-neutral-600 outline-none truncate"
                    />
                    <button 
                      onClick={copyToClipboard}
                      className="p-2 hover:bg-neutral-200 rounded-xl transition-colors shrink-0"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-neutral-400" />}
                    </button>
                  </div>
                  
                  {navigator.share && (
                    <button 
                      onClick={handleNativeShare}
                      className="w-full py-3 bg-neutral-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all"
                    >
                      <Share2 className="w-4 h-4" />
                      More Options
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Screenshot Lightbox */}
      <AnimatePresence>
        {selectedScreenshot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-12 bg-black/90 backdrop-blur-md"
            onClick={() => setSelectedScreenshot(null)}
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
              onClick={() => setSelectedScreenshot(null)}
            >
              <X className="w-6 h-6" />
            </motion.button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={selectedScreenshot}
              alt="Screenshot Full"
              className="max-w-full max-h-full rounded-2xl md:rounded-3xl shadow-2xl object-contain"
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ModernDialog
        isOpen={showThanksDialog}
        onClose={() => setShowThanksDialog(false)}
        title={dialogMessage.includes('Error') ? 'Oops!' : 'Thank You!'}
        message={dialogMessage}
        type={dialogMessage.includes('Error') ? 'error' : 'success'}
        confirmText="Close"
        showCancel={false}
      />
    </div>
  );
};
