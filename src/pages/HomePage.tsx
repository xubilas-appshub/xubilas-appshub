import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Rocket, TrendingUp, ShieldCheck, Settings, Bell, Package, Star, Award } from 'lucide-react';
import { AppCard } from '../components/AppCard';
import { AppSlider } from '../components/AppSlider';
import { DigitalNotification, NotificationData } from '../components/DigitalNotification';
import { AppRecord, StoreSettings } from '../types';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

export const HomePage: React.FC = () => {
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [dbError, setDbError] = useState<string | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [suggestions, setSuggestions] = useState<AppRecord[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeNotification, setActiveNotification] = useState<NotificationData | null>(null);
  const seenNotificationIds = useRef<Set<string>>(new Set());

  const categories = ['All', 'Games', 'Productivity', 'Social', 'Tools', 'Education', 'Finance'];

  useEffect(() => {
    fetchApps();
    fetchSettings();
    fetchPersistedNotifications();

    // Set up real-time subscriptions
    const appsChannel = supabase
      .channel('home-apps-changes')
      .on('postgres_changes', { event: '*', table: 'apps', schema: 'public', filter: 'status=eq.published' }, () => {
        fetchApps();
      })
      .subscribe();

    const settingsChannel = supabase
      .channel('home-settings-changes')
      .on('postgres_changes', { event: '*', table: 'settings', schema: 'public', filter: 'id=eq.main' }, () => {
        fetchSettings();
      })
      .subscribe();

    // Set up global notification listener (Realtime Broadcast)
    const notificationChannel = supabase
      .channel('global-notifications')
      .on('broadcast', { event: 'new-notification' }, ({ payload }) => {
        console.log('Received broadcast notification:', payload);
        if (!seenNotificationIds.current.has(payload.id)) {
          seenNotificationIds.current.add(payload.id);
          setActiveNotification(payload);
        }
      })
      .subscribe();

    // Set up global notification listener (Database Persistence)
    const dbNotificationChannel = supabase
      .channel('db-notifications')
      .on('postgres_changes', { event: 'INSERT', table: 'notifications', schema: 'public' }, (payload) => {
        const newNotif = payload.new;
        // Global notifications have user_id = null
        if (!newNotif.user_id && !seenNotificationIds.current.has(newNotif.id)) {
          console.log('Received DB notification:', newNotif);
          seenNotificationIds.current.add(newNotif.id);
          setActiveNotification({
            id: newNotif.id,
            title: newNotif.title,
            message: newNotif.message,
            type: (newNotif.type === 'alert' ? 'alert' : (newNotif.type === 'warning' ? 'warning' : (newNotif.type === 'success' ? 'success' : 'info'))),
            timestamp: new Date(newNotif.created_at).getTime()
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(appsChannel);
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(notificationChannel);
      supabase.removeChannel(dbNotificationChannel);
    };
  }, []);

  useEffect(() => {
    if (settings?.primary_color) {
      document.documentElement.style.setProperty('--color-brand-500', settings.primary_color);
    }
  }, [settings]);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('settings').select('*').eq('id', 'main').single();
      if (data) setSettings(data);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const fetchPersistedNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .is('user_id', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const latest = data[0];
        // Only show if it's recent (within last 1 hour) or sticky (within last 24 hours) and not seen
        const createdAt = new Date(latest.created_at).getTime();
        const now = Date.now();
        const maxAge = latest.is_sticky ? 86400000 : 3600000; // 24h for sticky, 1h for normal
        
        if (now - createdAt < maxAge && !seenNotificationIds.current.has(latest.id)) {
          seenNotificationIds.current.add(latest.id);
          setActiveNotification({
            id: latest.id,
            title: latest.title,
            message: latest.message,
            type: (latest.type === 'alert' ? 'alert' : (latest.type === 'warning' ? 'warning' : (latest.type === 'success' ? 'success' : 'info'))),
            timestamp: createdAt
          });
        }
      }
    } catch (err) {
      console.error('Error fetching persisted notifications:', err);
    }
  };

  const fetchApps = async () => {
    try {
      const { data, error } = await supabase
        .from('apps')
        .select('*')
        .eq('status', 'published')
        .order('downloads', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST205' || error.message.includes('relation "apps" does not exist')) {
          setDbError('Database table "apps" not found. Please follow the instructions in SUPABASE_SETUP.md to set up your database.');
        } else if (error.message.includes('Failed to fetch')) {
          setDbError('Could not connect to Supabase. Please check your internet connection and ensure your VITE_SUPABASE_URL is correct.');
        }
        throw error;
      }
      setApps(data || []);
    } catch (error) {
      console.error('Error fetching apps:', error);
      setApps([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredApps = apps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         app.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || app.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const topDownloadedApps = [...apps]
    .sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
    .slice(0, 10);

  const featuredApps = topDownloadedApps;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim().length > 0) {
      const matches = apps.filter(app => 
        app.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5); // Limit to 5 suggestions
      setSuggestions(matches);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  if (settings?.maintenance_mode) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <Settings className="w-10 h-10 text-amber-500 animate-[spin_10s_linear_infinite]" />
          </motion.div>
          <h1 className="text-3xl font-display font-bold text-white mb-4">Under Maintenance</h1>
          <p className="text-neutral-400 mb-8">
            {settings.store_name} is currently undergoing scheduled maintenance. We'll be back shortly!
          </p>
          <div className="text-sm text-neutral-500">
            Contact: {settings.contact_email}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <AnimatePresence>
        {activeNotification && (
          <DigitalNotification 
            notification={activeNotification} 
            onClose={() => setActiveNotification(null)} 
          />
        )}
      </AnimatePresence>

      {settings?.announcement_text && (
        <div className="bg-brand-500 text-white py-2 px-6 text-center text-sm font-bold flex items-center justify-center gap-2">
          <Bell className="w-4 h-4" />
          {settings.announcement_text}
        </div>
      )}

      {/* Hero Banner */}
      <section 
        className="relative pt-8 pb-20 overflow-hidden transition-colors duration-300"
        style={{ background: 'var(--hero-bg)' }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-500/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
          <div className="flex flex-col md:flex-row items-start gap-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="shrink-0"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 bg-neutral-800 rounded-2xl flex items-center justify-center overflow-hidden border border-white/10 shadow-2xl">
                {settings?.store_logo_url ? (
                  <img src={settings.store_logo_url} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-8 h-8 text-brand-500" />
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex-1"
            >
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-white mb-3 leading-[1.1] tracking-tight">
                Discover the <span className="text-brand-500">Next<br className="hidden md:block" /> Gen</span> of Apps
              </h1>
              <p className="text-neutral-400 text-base md:text-lg max-w-xl mb-4 leading-relaxed">
                {settings?.store_name || 'APPS HUB'} is the premier destination for high-quality, verified applications.
              </p>
              
              <button 
                onClick={() => document.getElementById('apps-grid')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-full font-bold text-base shadow-lg shadow-brand-500/20 transition-all flex items-center gap-3 group"
              >
                <Rocket className="w-4 h-4 group-hover:translate-y-[-2px] group-hover:translate-x-[2px] transition-transform" />
                Explore Apps
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Search and Filter */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 -mt-12 relative z-20">
        <div 
          className="rounded-[2.5rem] shadow-2xl p-3 md:p-4 border transition-colors duration-300"
          style={{ backgroundColor: 'var(--search-bg)', borderColor: 'var(--card-border)' }}
        >
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search apps, games, developers..."
                className="w-full pl-14 pr-6 py-4 bg-neutral-50 border-none rounded-2xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all text-lg"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchQuery.trim().length > 0 && setShowSuggestions(true)}
              />
              
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <>
                    <div 
                      className="fixed inset-0 z-[40]" 
                      onClick={() => setShowSuggestions(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-neutral-100 overflow-hidden z-[50]"
                    >
                      <div className="p-2">
                        {suggestions.map(app => (
                          <Link
                            key={app.id}
                            to={`/app/${app.id}#download`}
                            className="flex items-center gap-3 p-3 hover:bg-neutral-50 rounded-xl transition-colors group"
                            onClick={() => setShowSuggestions(false)}
                          >
                            <img 
                              src={app.icon_url} 
                              alt="" 
                              className="w-10 h-10 rounded-lg object-cover shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-neutral-900 truncate group-hover:text-brand-600 transition-colors">
                                {app.name}
                              </div>
                              <div className="text-xs text-neutral-400 truncate">
                                {app.category} • {app.developer}
                              </div>
                            </div>
                            <div className="flex items-center text-amber-500 text-[10px] font-bold">
                              <Star className="w-3 h-3 fill-current mr-1" />
                              {app.rating.toFixed(1)}
                            </div>
                          </Link>
                        ))}
                      </div>
                      <div className="bg-neutral-50 p-2 text-center">
                        <button 
                          onClick={() => {
                            setShowSuggestions(false);
                            document.getElementById('apps-grid')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 hover:text-brand-600 transition-colors"
                        >
                          See all results for "{searchQuery}"
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 w-full lg:w-auto scrollbar-hide px-2">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                    selectedCategory === category
                      ? 'bg-neutral-900 text-white shadow-xl'
                      : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Slider */}
      {!loading && apps.length > 0 && selectedCategory === 'All' && !searchQuery && (
        <section className="max-w-7xl mx-auto px-4 md:px-6 mt-20">
          <AppSlider 
            apps={featuredApps} 
            title="Top 10 Most Downloaded" 
            icon={<TrendingUp className="w-6 h-6 text-brand-500" />}
          />
        </section>
      )}

      {/* Main Content */}
      <main id="apps-grid" className="max-w-7xl mx-auto px-4 md:px-6 mt-12">
        {dbError && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-800">
            <ShieldCheck className="w-6 h-6 shrink-0 text-amber-500" />
            <div>
              <p className="font-bold">Database Setup Required</p>
              <p className="text-sm opacity-90">{dbError}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-display font-bold flex items-center" style={{ color: 'var(--text-main)' }}>
            <TrendingUp className="w-6 h-6 mr-2 text-brand-500" />
            {selectedCategory === 'All' ? 'Featured Apps' : `${selectedCategory} Apps`}
          </h2>
          <div className="flex items-center text-sm opacity-50" style={{ color: 'var(--text-main)' }}>
            <ShieldCheck className="w-4 h-4 mr-1 text-blue-500" />
            All apps are verified
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4">
            {[...Array(16)].map((_, i) => (
              <div key={i} className="animate-pulse bg-neutral-200 rounded-2xl aspect-square"></div>
            ))}
          </div>
        ) : filteredApps.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4">
            {filteredApps.map(app => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        ) : (
          <div 
            className="text-center py-20 rounded-3xl border border-dashed transition-colors duration-300"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--card-border)' }}
          >
            <p className="text-neutral-500 text-lg">No apps found matching your criteria.</p>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t mt-20 text-center transition-colors duration-300" style={{ borderColor: 'var(--card-border)' }}>
        <p className="text-sm opacity-50" style={{ color: 'var(--text-main)' }}>
          {settings?.footer_text || `© ${new Date().getFullYear()} ${settings?.store_name || 'APPS HUB'}`}
        </p>
      </footer>
    </div>
  );
};
