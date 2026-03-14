import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Clock,
  Search,
  LogOut,
  Package,
  ShieldCheck,
  History,
  RotateCcw,
  Menu,
  X,
  AlertCircle,
  User,
  Upload,
  Key,
  Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppRecord, AppVersion, Developer, Notification } from '../types';
import { supabase, syncToGoogleSheet } from '../lib/supabase';
import { resizeImage, compressFile } from '../lib/fileUtils';
import { ModernDialog, DialogType } from '../components/ModernDialog';
import { LoadingOverlay } from '../components/LoadingOverlay';

export const DeveloperDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'my-apps' | 'pending-edits' | 'profile'>('dashboard');
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Partial<AppRecord> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Screenshot state
  const [existingScreenshots, setExistingScreenshots] = useState<string[]>([]);
  const [newScreenshotFiles, setNewScreenshotFiles] = useState<File[]>([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);
  const [iconPreview, setIconPreview] = useState<string | null>(null);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Confirmation Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: DialogType;
    confirmText?: string;
    showCancel?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info',
    showCancel: true
  });

  const [viewRejectionReason, setViewRejectionReason] = useState<{ isOpen: boolean; reason: string; appName: string; version: string }>({
    isOpen: false,
    reason: '',
    appName: '',
    version: ''
  });

  const navigate = useNavigate();

  const showDialog = (title: string, message: string, type: DialogType = 'info', onConfirm: () => void = () => {}, showCancel: boolean = false, confirmText: string = 'Got it') => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
      showCancel,
      confirmText
    });
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }
      fetchDeveloperProfile(session.user.id);
    };
    
    checkAuth();
  }, []);

  useEffect(() => {
    let appsChannel: any;
    let notificationsChannel: any;

    const setupSubscriptions = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      appsChannel = supabase
        .channel('dev-apps-changes')
        .on('postgres_changes', { event: '*', table: 'apps', schema: 'public' }, () => {
          if (developer?.id) {
            fetchApps(developer.id);
          }
        })
        .subscribe();

      notificationsChannel = supabase
        .channel('dev-notifications-changes')
        .on('postgres_changes', { event: '*', table: 'notifications', schema: 'public', filter: `user_id=eq.${session.user.id}` }, () => {
          fetchNotifications(session.user.id);
        })
        .subscribe();
    };

    setupSubscriptions();

    return () => {
      if (appsChannel) supabase.removeChannel(appsChannel);
      if (notificationsChannel) supabase.removeChannel(notificationsChannel);
    };
  }, [developer?.id]);

  const fetchDeveloperProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('developers')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      setDeveloper(data);
      fetchApps(data.id);
      fetchNotifications(userId);
    } catch (err) {
      console.error('Error fetching developer profile:', err);
      setLoading(false);
    }
  };

  const fetchNotifications = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data && data.length > 0) {
        setNotifications(data);
        // Show the first notification as a dialog
        const first = data[0];
        showDialog(
          first.title,
          first.message,
          first.type as DialogType,
          async () => {
            // Mark as read
            await supabase
              .from('notifications')
              .update({ is_read: true })
              .eq('id', first.id);
            // Remove from local state
            setNotifications(prev => prev.filter(n => n.id !== first.id));
          },
          false,
          'Dismiss'
        );
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchApps = async (developerId: string) => {
    try {
      const { data, error } = await supabase
        .from('apps')
        .select('*')
        .eq('developer_id', developerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApps(data || []);
    } catch (error) {
      console.error('Error fetching apps:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    showDialog(
      'Discard Changes',
      'Are you sure you want to close this window? Any unsaved changes will be lost.',
      'warning',
      () => {
        setIsModalOpen(false);
        setEditingApp(null);
        // Cleanup previews
        screenshotPreviews.forEach(url => URL.revokeObjectURL(url));
        if (iconPreview && iconPreview.startsWith('blob:')) URL.revokeObjectURL(iconPreview);
        setExistingScreenshots([]);
        setNewScreenshotFiles([]);
        setScreenshotPreviews([]);
        setIconPreview(null);
      },
      true,
      'Discard Changes'
    );
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showDialog('File Too Large', 'The icon file size must be less than 2MB.', 'warning');
        e.target.value = '';
        return;
      }
      if (iconPreview && iconPreview.startsWith('blob:')) URL.revokeObjectURL(iconPreview);
      setIconPreview(URL.createObjectURL(file));
    }
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setNewScreenshotFiles(prev => [...prev, ...files]);
    
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setScreenshotPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeExistingScreenshot = (url: string) => {
    setExistingScreenshots(prev => prev.filter(s => s !== url));
  };

  const removeNewScreenshot = (index: number) => {
    URL.revokeObjectURL(screenshotPreviews[index]);
    setNewScreenshotFiles(prev => prev.filter((_, i) => i !== index));
    setScreenshotPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!developer) return;
    
    const form = e.currentTarget;
    
    showDialog(
      editingApp ? 'Save Changes' : 'Submit Application',
      editingApp 
        ? 'Are you sure you want to save the changes to this application?' 
        : 'Are you sure you want to submit this application for review? It will need admin approval before publishing.',
      'info',
      async () => {
        setUploading(true);
        
        const formData = new FormData(form);
        const iconFile = (form.elements.namedItem('icon_file') as HTMLInputElement).files?.[0];
        const apkFile = (form.elements.namedItem('apk_file') as HTMLInputElement).files?.[0];

        try {
          const appName = formData.get('name') as string;
          const appVersion = formData.get('version') as string;
          const slug = appName.toLowerCase().replace(/[^a-z0-9]/g, '-');

          let icon_url = formData.get('icon_url') as string;
          let apk_url = formData.get('apk_url') as string;
          let fileSize = editingApp?.size || '0 MB';

          if (iconFile) {
            // Auto-resize icon before upload
            const resizedIconBlob = await resizeImage(iconFile, 512);
            const resizedIconFile = new File([resizedIconBlob], iconFile.name, { type: resizedIconBlob.type });
            icon_url = await uploadFile(resizedIconFile, 'icons', `${slug}-icon`);
          }
          if (apkFile) {
            apk_url = await uploadFile(apkFile, 'apks', `${slug}-v${appVersion.replace(/\./g, '-')}`);
            fileSize = formatBytes(apkFile.size);
          }

          // Upload new screenshots
          const uploadedScreenshots = await Promise.all(
            newScreenshotFiles.map(file => uploadFile(file, 'screenshots'))
          );

          const finalScreenshots = [...existingScreenshots, ...uploadedScreenshots];

          const appData = {
            name: appName,
            developer: developer.name,
            developer_id: developer.id,
            description: formData.get('description') as string,
            category: formData.get('category') as string,
            version: appVersion,
            size: fileSize,
            icon_url,
            apk_url,
            screenshots: finalScreenshots,
            support_contact: formData.get('support_contact') as string,
            updated_at: new Date().toISOString(),
          };

          const releaseNotes = formData.get('release_notes') as string;
          let appId = editingApp?.id;

          if (appId) {
            // Update app using pending_update to keep current version live while review happens
            const { error } = await supabase
              .from('apps')
              .update({ 
                pending_update: { 
                  ...appData, 
                  release_notes: releaseNotes || 'Update submission' 
                } 
              })
              .eq('id', appId);
            if (error) throw error;
            showDialog('Success', 'Update submitted for review. The current version will remain live until the update is approved.', 'success');
          } else {
            // New app
            const { data, error } = await supabase
              .from('apps')
              .insert([{ ...appData, status: 'pending', downloads: 0, rating: 0 }])
              .select();
            
            if (error) throw error;
            appId = data[0].id;
            showDialog('Success', 'New application submitted for review.', 'success');
          }

          // Save to version history
          await supabase.from('app_versions').insert([{
            app_id: appId,
            version: appData.version,
            release_notes: releaseNotes || 'Initial submission',
            apk_url: appData.apk_url
          }]);

          // Sync to Google Sheets
          await syncToGoogleSheet({ 
            ...appData, 
            action: editingApp ? 'update' : 'create',
            source: 'developer_portal'
          });

          await fetchApps(developer.id);
          setIsModalOpen(false);
          setEditingApp(null);
          // Cleanup previews
          screenshotPreviews.forEach(url => URL.revokeObjectURL(url));
          if (iconPreview && iconPreview.startsWith('blob:')) URL.revokeObjectURL(iconPreview);
          setExistingScreenshots([]);
          setNewScreenshotFiles([]);
          setScreenshotPreviews([]);
          setIconPreview(null);
          showDialog('Success', 'Your application has been submitted successfully and is now pending review by our administrators.', 'success');
        } catch (error: any) {
          console.error('Error saving app:', error);
          showDialog('Error', `Error saving app: ${error.message || 'Unknown error'}`, 'error');
        } finally {
          setUploading(false);
        }
      },
      true,
      editingApp ? 'Save Changes' : 'Submit Now'
    );
  };

  const uploadFile = async (file: File, path: string, customName?: string) => {
    // Determine file type for compression
    let fileType: 'logo' | 'screenshot' | 'apk' = 'apk';
    if (path.includes('icons')) fileType = 'logo';
    else if (path.includes('screenshots')) fileType = 'screenshot';

    // Apply extreme compression
    const processedFile = await compressFile(file, fileType);
    
    const fileExt = file.name.split('.').pop();
    // Use webp extension if it was an image (since compressFile converts to webp)
    const finalExt = (fileType === 'logo' || fileType === 'screenshot') ? 'webp' : fileExt;
    
    // Sanitize custom name for filename use
    const sanitizedName = customName 
      ? customName.toLowerCase().replace(/[^a-z0-9]/g, '-') 
      : Math.random().toString(36).substring(7);
    
    const fileName = `${sanitizedName}-${Date.now()}.${finalExt}`;
    const filePath = `${path}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('apps')
      .upload(filePath, processedFile, { 
        upsert: true,
        contentType: fileType === 'apk' ? 'application/vnd.android.package-archive' : undefined
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('apps')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleLogout = async () => {
    showDialog(
      'Sign Out',
      'Are you sure you want to sign out of the developer portal?',
      'info',
      async () => {
        await supabase.auth.signOut();
        navigate('/');
      },
      true,
      'Sign Out'
    );
  };

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!developer) return;

    const formData = new FormData(e.currentTarget);
    const updatedData = {
      name: formData.get('name') as string,
      company: formData.get('company') as string,
      bio: formData.get('bio') as string,
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('developers')
        .update(updatedData)
        .eq('id', developer.id);

      if (error) throw error;
      setDeveloper({ ...developer, ...updatedData });
      showDialog('Success', 'Profile updated successfully!', 'success');
    } catch (err: any) {
      showDialog('Error', `Error updating profile: ${err.message}`, 'error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.message });
    } finally {
      setPasswordLoading(false);
    }
  };

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-neutral-500 font-medium">Loading Developer Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col md:flex-row">

      {/* Mobile Header */}
      <div className="md:hidden bg-neutral-900 text-white p-4 flex items-center justify-between sticky top-0 z-[60]">
        <div className="flex items-center gap-2 text-brand-500 font-display font-bold text-lg">
          <Package className="w-6 h-6" />
          Dev Portal
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[50] md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-neutral-900 text-white transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Package className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">Dev Portal</span>
          </div>

          <nav className="space-y-2 flex-1 pt-20 md:pt-0">
            <button 
              onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
            >
              <LayoutDashboard className="w-5 h-5" />
              Dashboard
            </button>
            <button 
              onClick={() => { setActiveTab('my-apps'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'my-apps' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
            >
              <Package className="w-5 h-5" />
              My Applications
            </button>
            <button 
              onClick={() => { setActiveTab('pending-edits'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${activeTab === 'pending-edits' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5" />
                Pending Edits
              </div>
              {apps.filter(a => a.pending_update).length > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {apps.filter(a => a.pending_update).length}
                </span>
              )}
            </button>
            <button 
              onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
            >
              <User className="w-5 h-5" />
              My Profile
            </button>
          </nav>

          <div className="pt-6 border-t border-white/10">
            <div className="flex items-center gap-3 px-4 py-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center overflow-hidden">
                {developer?.avatar_url ? (
                  <img src={developer.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-neutral-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{developer?.name}</div>
                <div className="text-[10px] text-neutral-500 truncate uppercase tracking-wider font-bold">Developer</div>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto">
            <header className="mb-10">
              <h1 className="text-3xl font-display font-bold" style={{ color: 'var(--text-main)' }}>Welcome back, {developer?.name}</h1>
              <p style={{ color: 'var(--text-main)', opacity: 0.6 }}>Here's what's happening with your applications.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              <div className="p-6 rounded-3xl border border-[var(--card-border)] shadow-sm" style={{ background: 'var(--card-bg)' }}>
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                  <Package className="w-6 h-6" />
                </div>
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-main)', opacity: 0.6 }}>Total Apps</div>
                <div className="text-3xl font-bold" style={{ color: 'var(--text-main)' }}>{apps.length}</div>
              </div>
              <div className="p-6 rounded-3xl border border-[var(--card-border)] shadow-sm" style={{ background: 'var(--card-bg)' }}>
                <div className="w-12 h-12 bg-green-50 dark:bg-green-500/10 text-green-600 rounded-2xl flex items-center justify-center mb-4">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-main)', opacity: 0.6 }}>Published</div>
                <div className="text-3xl font-bold text-green-600">{apps.filter(a => a.status === 'published').length}</div>
              </div>
              <div className="p-6 rounded-3xl border border-[var(--card-border)] shadow-sm" style={{ background: 'var(--card-bg)' }}>
                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-main)', opacity: 0.6 }}>Pending Review</div>
                <div className="text-3xl font-bold text-amber-600">{apps.filter(a => a.status === 'pending').length}</div>
              </div>
              <div className="p-6 rounded-3xl border border-[var(--card-border)] shadow-sm" style={{ background: 'var(--card-bg)' }}>
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                  <Edit className="w-6 h-6" />
                </div>
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-main)', opacity: 0.6 }}>Pending Edits</div>
                <div className="text-3xl font-bold text-indigo-600">{apps.filter(a => a.pending_update).length}</div>
              </div>
              <div className="p-6 rounded-3xl border border-[var(--card-border)] shadow-sm" style={{ background: 'var(--card-bg)' }}>
                <div className="w-12 h-12 bg-purple-50 dark:bg-purple-500/10 text-purple-600 rounded-2xl flex items-center justify-center mb-4">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-main)', opacity: 0.6 }}>Total Downloads</div>
                <div className="text-3xl font-bold" style={{ color: 'var(--text-main)' }}>{apps.reduce((acc, curr) => acc + (curr.downloads || 0), 0).toLocaleString()}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="p-8 rounded-3xl border border-[var(--card-border)] shadow-sm" style={{ background: 'var(--card-bg)' }}>
                <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--text-main)' }}>Recent Activity</h3>
                <div className="space-y-6">
                  {apps.slice(0, 5).map(app => (
                    <div key={app.id} className="flex items-center gap-4">
                      <img src={app.icon_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                      <div className="flex-1">
                        <div className="font-bold" style={{ color: 'var(--text-main)' }}>{app.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-main)', opacity: 0.6 }}>Updated {new Date(app.updated_at).toLocaleDateString()}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          app.status === 'published' ? 'bg-green-100 text-green-700' :
                          app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {app.status}
                        </div>
                        {app.rejected_version && (
                          <button
                            onClick={() => setViewRejectionReason({
                              isOpen: true,
                              reason: app.rejection_reason || 'No reason provided',
                              appName: app.name,
                              version: app.rejected_version || ''
                            })}
                            className="text-[9px] font-bold text-red-600 uppercase hover:underline"
                          >
                            v{app.rejected_version} Rejected
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {apps.length === 0 && <p className="italic text-center py-10" style={{ color: 'var(--text-main)', opacity: 0.5 }}>No applications yet.</p>}
                </div>
              </div>

              <div className="bg-neutral-900 p-8 rounded-3xl text-white shadow-xl shadow-neutral-900/20 flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl font-display font-bold mb-2">Grow your audience</h3>
                  <p className="text-neutral-400 mb-8">Publish high-quality applications to reach more users on XUBILASS APP HUB.</p>
                </div>
                <button 
                  onClick={() => { setEditingApp(null); setIsModalOpen(true); }}
                  className="w-full py-4 bg-brand-500 text-white rounded-2xl font-bold hover:bg-brand-600 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Submit New Application
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'my-apps' && (
          <>
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
              <div>
                <h1 className="text-3xl font-display font-bold text-neutral-900">My Applications</h1>
                <p className="text-neutral-500">Manage and track your app submissions.</p>
              </div>
              <button 
                onClick={() => { 
                  setEditingApp(null); 
                  setExistingScreenshots([]);
                  setNewScreenshotFiles([]);
                  setScreenshotPreviews([]);
                  setIsModalOpen(true); 
                }}
                className="px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-neutral-900/10"
              >
                <Plus className="w-5 h-5" />
                Submit New App
              </button>
            </header>

            <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-neutral-100 bg-neutral-50/50">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
                  <input 
                    type="text" 
                    placeholder="Search my apps..." 
                    className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[800px] md:min-w-0">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wider font-bold">
                      <th className="px-6 py-4">Application</th>
                      <th className="px-6 py-4 hidden md:table-cell">Category</th>
                      <th className="px-6 py-4 hidden sm:table-cell">Version</th>
                      <th className="px-6 py-4 hidden md:table-cell">Rating</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 hidden lg:table-cell">Stats</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredApps.length > 0 ? (
                      filteredApps.map(app => (
                        <tr key={app.id} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <img src={app.icon_url} alt="" className="w-10 h-10 rounded-lg object-cover shadow-sm" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <div className="font-bold text-neutral-900">{app.name}</div>
                                  {app.pending_update && (
                                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[8px] font-bold rounded uppercase flex items-center gap-1">
                                      <Edit className="w-2 h-2" />
                                      Pending Edit
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-neutral-400 md:hidden">v{app.version} • {app.category}</div>
                                <div className="text-xs text-neutral-400 hidden md:block">ID: {app.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell">
                            <span className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded-md text-[10px] font-bold uppercase tracking-wider">
                              {app.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-600 hidden sm:table-cell">v{app.version}</td>
                          <td className="px-6 py-4 hidden md:table-cell">
                            <div className="flex items-center gap-1 text-sm font-bold text-amber-600">
                              <Star className="w-3.5 h-3.5 fill-current" />
                              {(app.rating || 0).toFixed(1)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => {
                                  if (app.status === 'rejected') {
                                    setViewRejectionReason({
                                      isOpen: true,
                                      reason: app.rejection_reason || 'No reason provided',
                                      appName: app.name,
                                      version: app.version
                                    });
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit ${
                                  app.status === 'published' ? 'bg-green-100 text-green-700' : 
                                  app.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                                  'bg-red-100 text-red-700 hover:bg-red-200 transition-colors cursor-pointer'
                                }`}
                                disabled={app.status !== 'rejected'}
                              >
                                {app.status}
                              </button>
                              
                              {app.rejected_version && (
                                <button
                                  onClick={() => setViewRejectionReason({
                                    isOpen: true,
                                    reason: app.rejection_reason || 'No reason provided',
                                    appName: app.name,
                                    version: app.rejected_version || ''
                                  })}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 w-fit hover:bg-red-200 transition-colors"
                                >
                                  <XCircle className="w-3 h-3" />
                                  Rejected v{app.rejected_version}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 hidden lg:table-cell">
                            <div className="flex items-center gap-3 text-xs text-neutral-500">
                              <div className="flex items-center gap-1">
                                <Upload className="w-3 h-3" /> {app.downloads}
                              </div>
                              <div className="flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> {app.rating}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => { 
                                  setEditingApp(app); 
                                  setExistingScreenshots(app.screenshots || []);
                                  setIsModalOpen(true); 
                                }}
                                className="p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 rounded-lg transition-all"
                                title="Edit App"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">No applications found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'pending-edits' && (
          <>
            <header className="mb-10">
              <h1 className="text-3xl font-display font-bold text-neutral-900">Pending Edits</h1>
              <p className="text-neutral-500">Applications with updates currently under review.</p>
            </header>

            <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wider font-bold">
                      <th className="px-6 py-4">Application</th>
                      <th className="px-6 py-4">Current Version</th>
                      <th className="px-6 py-4">Pending Version</th>
                      <th className="px-6 py-4">Submitted At</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {apps.filter(a => a.pending_update).length > 0 ? (
                      apps.filter(a => a.pending_update).map(app => (
                        <tr key={app.id} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <img src={app.icon_url} alt="" className="w-10 h-10 rounded-lg object-cover shadow-sm" />
                              <div className="font-bold text-neutral-900">{app.name}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-600">v{app.version}</td>
                          <td className="px-6 py-4 text-sm text-indigo-600 font-bold">v{app.pending_update.version}</td>
                          <td className="px-6 py-4 text-sm text-neutral-500">
                            {app.pending_update.updated_at ? new Date(app.pending_update.updated_at).toLocaleDateString() : 'Recently'}
                          </td>
                          <td className="px-6 py-4 text-right">
                             <button 
                                onClick={() => { 
                                  setEditingApp(app); 
                                  setExistingScreenshots(app.screenshots || []);
                                  setIsModalOpen(true); 
                                }}
                                className="px-4 py-2 bg-neutral-100 text-neutral-600 rounded-lg text-xs font-bold hover:bg-neutral-200 transition-all"
                              >
                                View/Edit
                              </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">No pending edits found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'profile' && (
          <div className="max-w-4xl mx-auto">
            <header className="mb-10">
              <h1 className="text-3xl font-display font-bold text-neutral-900">Developer Profile</h1>
              <p className="text-neutral-500">Manage your public profile and account settings.</p>
            </header>

            <div className="space-y-8">
              <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <User className="w-5 h-5 text-brand-500" />
                  Profile Information
                </h3>
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="w-32 h-32 rounded-3xl bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0 relative group">
                    {developer?.avatar_url ? (
                      <img src={developer.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-12 h-12 text-neutral-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-6 w-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-neutral-700">Full Name</label>
                        <input type="text" readOnly className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-500 cursor-not-allowed" value={developer?.name} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-neutral-700">Email Address</label>
                        <input type="email" readOnly className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-500 cursor-not-allowed" value={developer?.email} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-neutral-700">Company / Studio</label>
                      <input type="text" readOnly className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-500 cursor-not-allowed" value={developer?.company || 'Not specified'} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-neutral-700">Bio</label>
                      <textarea readOnly rows={4} className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-500 cursor-not-allowed" value={developer?.bio || 'No bio provided.'}></textarea>
                    </div>
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800 text-sm flex gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p>Profile editing is currently restricted to administrators. Please contact support if you need to update your information.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-brand-500" />
                  Security & Password
                </h3>
                <form onSubmit={handleResetPassword} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-neutral-700">New Password</label>
                      <input 
                        type="password" 
                        required 
                        placeholder="Min 6 characters"
                        className="w-full px-4 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-neutral-700">Confirm Password</label>
                      <input 
                        type="password" 
                        required 
                        placeholder="Repeat new password"
                        className="w-full px-4 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  {passwordMessage && (
                    <div className={`p-4 rounded-xl text-sm font-medium ${passwordMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {passwordMessage.text}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button 
                      type="submit" 
                      disabled={passwordLoading}
                      className="px-8 py-2 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-all disabled:opacity-50"
                    >
                      {passwordLoading ? 'Updating...' : 'Change Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="p-8 text-center">
              <div className={`w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center ${
                confirmDialog.type === 'danger' ? 'bg-red-50 text-red-500' : 
                confirmDialog.type === 'warning' ? 'bg-amber-50 text-amber-500' : 
                'bg-blue-50 text-blue-500'
              }`}>
                {confirmDialog.type === 'danger' ? <Trash2 className="w-8 h-8" /> : 
                 confirmDialog.type === 'warning' ? <AlertCircle className="w-8 h-8" /> : 
                 <ShieldCheck className="w-8 h-8" />}
              </div>
              <h3 className="text-2xl font-display font-bold text-neutral-900 mb-2">{confirmDialog.title}</h3>
              <p className="text-neutral-500 leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="p-6 bg-neutral-50 flex gap-3">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-3 bg-white border border-neutral-200 text-neutral-600 rounded-xl font-bold hover:bg-neutral-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`flex-1 py-3 text-white rounded-xl font-bold transition-all shadow-lg ${
                  confirmDialog.type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 
                  confirmDialog.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 
                  'bg-neutral-900 hover:bg-neutral-800 shadow-neutral-900/20'
                }`}
              >
                {confirmDialog.confirmText || 'Confirm'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal for Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-neutral-200 flex justify-between items-center">
              <h2 className="text-2xl font-display font-bold">
                {editingApp ? 'Edit Application' : 'Submit New Application'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-neutral-100 rounded-full">
                <XCircle className="w-6 h-6 text-neutral-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-neutral-700">App Name</label>
                  <input name="name" type="text" required className="w-full px-4 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20" defaultValue={editingApp?.name} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-neutral-700">Category</label>
                  <select name="category" className="w-full px-4 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20" defaultValue={editingApp?.category || 'Tools'}>
                    <option>Games</option>
                    <option>Productivity</option>
                    <option>Social</option>
                    <option>Tools</option>
                    <option>Education</option>
                    <option>Finance</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-neutral-700">Description</label>
                <textarea name="description" required rows={4} className="w-full px-4 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20" defaultValue={editingApp?.description}></textarea>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-neutral-700">Release Notes</label>
                <textarea name="release_notes" placeholder="What's new in this version?" rows={2} className="w-full px-4 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20"></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-neutral-700">Version</label>
                  <input name="version" type="text" required placeholder="e.g. 1.0.0" className="w-full px-4 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20" defaultValue={editingApp?.version} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-neutral-700">Support Contact (Email or URL)</label>
                <input name="support_contact" type="text" placeholder="e.g. support@example.com or https://support.example.com" className="w-full px-4 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20" defaultValue={editingApp?.support_contact} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-neutral-700 flex items-center justify-between">
                    App Icon
                    <span className="text-[10px] text-neutral-400 font-normal">GIF, PNG, JPEG (Max 2MB)</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-neutral-100 border-2 border-dashed border-neutral-200 flex items-center justify-center overflow-hidden shrink-0">
                      {iconPreview || editingApp?.icon_url ? (
                        <img src={iconPreview || editingApp?.icon_url} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Upload className="w-6 h-6 text-neutral-300" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input 
                        name="icon_file" 
                        type="file" 
                        accept="image/png,image/jpeg,image/gif" 
                        onChange={handleIconChange}
                        className="w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" 
                      />
                      <input 
                        name="icon_url" 
                        type="url" 
                        placeholder="Or provide URL" 
                        className="w-full px-4 py-2 border border-neutral-200 rounded-xl text-xs" 
                        defaultValue={editingApp?.icon_url}
                        onChange={(e) => setIconPreview(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-neutral-700">APK File</label>
                  <input name="apk_file" type="file" accept=".apk" className="w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
                  <input name="apk_url" type="url" placeholder="Or provide URL" className="w-full px-4 py-2 border border-neutral-200 rounded-xl text-xs" defaultValue={editingApp?.apk_url} />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-neutral-700">Screenshots</label>
                <div className="flex flex-wrap gap-3 mb-2">
                  {/* Existing Screenshots */}
                  {existingScreenshots.map((url, idx) => (
                    <div key={`existing-${idx}`} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-neutral-200">
                      <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button 
                        type="button"
                        onClick={() => removeExistingScreenshot(url)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  
                  {/* New Previews */}
                  {screenshotPreviews.map((url, idx) => (
                    <div key={`new-${idx}`} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-brand-200">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute top-1 left-1 px-1 bg-brand-500 text-white text-[8px] font-bold rounded uppercase">New</div>
                      <button 
                        type="button"
                        onClick={() => removeNewScreenshot(idx)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  <label className="w-24 h-24 rounded-xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 hover:bg-brand-50 transition-all">
                    <Plus className="w-6 h-6 text-neutral-400" />
                    <span className="text-[10px] font-bold text-neutral-400 uppercase mt-1">Add</span>
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleScreenshotChange}
                    />
                  </label>
                </div>
                <p className="text-[10px] text-neutral-400 italic">Upload up to 5 screenshots showing your app in action.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={handleCloseModal} className="px-6 py-2 text-neutral-600 font-semibold">Cancel</button>
                <button type="submit" disabled={uploading} className="px-8 py-2 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-all disabled:opacity-50">
                  {uploading ? 'Uploading...' : (editingApp ? 'Save Changes' : 'Submit for Review')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* View Rejection Reason Modal */}
      <AnimatePresence>
        {viewRejectionReason.isOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-6">
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-2xl font-display font-bold text-neutral-900 mb-2">Rejection Details</h3>
                <p className="text-sm text-neutral-500 mb-4 uppercase tracking-wider font-semibold">
                  {viewRejectionReason.appName} - v{viewRejectionReason.version}
                </p>
                
                <div className="p-6 bg-red-50 border border-red-100 rounded-2xl mb-8">
                  <p className="text-red-900 leading-relaxed italic">
                    "{viewRejectionReason.reason}"
                  </p>
                </div>

                <button
                  onClick={() => setViewRejectionReason({ ...viewRejectionReason, isOpen: false })}
                  className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ModernDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        onConfirm={confirmDialog.onConfirm}
        showCancel={confirmDialog.showCancel}
        confirmText={confirmDialog.confirmText}
      />

      <LoadingOverlay isLoading={uploading} message="Uploading Application..." />
    </div>
  );
};
