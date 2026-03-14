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
  BarChart3,
  Settings,
  Package,
  ShieldCheck,
  History,
  RotateCcw,
  Menu,
  X,
  Eye,
  AlertCircle,
  Fingerprint,
  Palette,
  Bell,
  Users,
  UserPlus,
  User,
  Key,
  Mail,
  Upload,
  Star,
  Zap,
  Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppRecord, AppVersion, StoreSettings, Developer, Admin } from '../types';
import { supabase, supabaseAdmin, syncToGoogleSheet } from '../lib/supabase';
import { bufferToBase64, generateRandomChallenge } from '../lib/webauthn';
import { resizeImage, compressFile } from '../lib/fileUtils';
import { ModernDialog, DialogType } from '../components/ModernDialog';
import { LoadingOverlay } from '../components/LoadingOverlay';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'review' | 'settings' | 'developers' | 'admins' | 'account' | 'notifications'>('dashboard');
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'success' | 'alert',
    is_sticky: false
  });
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDevModalOpen, setIsDevModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Partial<AppRecord> | null>(null);
  const [editingDev, setEditingDev] = useState<Partial<Developer> | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<Partial<Admin> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dbError, setDbError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetTargetType, setResetTargetType] = useState<'developer' | 'admin'>('developer');
  const [resetPassword, setResetPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [globalNotifications, setGlobalNotifications] = useState<Notification[]>([]);
  const [rejectionModal, setRejectionModal] = useState<{ isOpen: boolean; appId: string; appName: string; version: string }>({
    isOpen: false,
    appId: '',
    appName: '',
    version: ''
  });
  const [rejectionReason, setRejectionReason] = useState('');
  const [viewRejectionReason, setViewRejectionReason] = useState<{ isOpen: boolean; reason: string; appName: string; version: string }>({
    isOpen: false,
    reason: '',
    appName: '',
    version: ''
  });
  const [resetSuccessTarget, setResetSuccessTarget] = useState<{ name: string; email: string } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Screenshot state
  const [existingScreenshots, setExistingScreenshots] = useState<string[]>([]);
  const [newScreenshotFiles, setNewScreenshotFiles] = useState<File[]>([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [devAvatarPreview, setDevAvatarPreview] = useState<string | null>(null);
  
  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  
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
  
  // History state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedAppForHistory, setSelectedAppForHistory] = useState<AppRecord | null>(null);
  const [appVersions, setAppVersions] = useState<AppVersion[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Compare state
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [comparingApp, setComparingApp] = useState<AppRecord | null>(null);
  
  // Settings state
  const [settings, setSettings] = useState<StoreSettings>({
    id: 'main',
    store_name: 'APPS HUB',
    contact_email: 'admin@xubilass.com',
    maintenance_mode: false,
    allow_user_uploads: true,
    store_logo_url: '',
    primary_color: '#22c55e',
    announcement_text: '',
    footer_text: '© 2024 APPS HUB',
    auth_methods: {
      email_password: true,
      google_oauth: true,
      biometric: true,
      custom_auth: []
    }
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
      const isDemoSession = localStorage.getItem('nexus_demo_session') === 'true';
      
      console.log('Auth check:', { hasSession: !!session, isDemoSession });

      if (!session && !isDemoSession) {
        navigate('/login');
        return;
      }

      if (session?.user) {
        const { data: adminData } = await supabase
          .from('admins')
          .select('*')
          .eq('user_id', session.user.id)
          .single();
        
        if (adminData) {
          setCurrentAdmin(adminData);
        } else if (!isDemoSession) {
          navigate('/login');
        }
      } else if (isDemoSession) {
        setCurrentAdmin({
          id: 'demo',
          user_id: 'demo',
          name: 'Demo Admin',
          email: 'admin@demo.com',
          role: 'super_admin',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    };
    
    checkAuth();
    checkApiStatus();
    fetchApps();
    fetchSettings();
    fetchDevelopers();
    fetchAdmins();
    fetchGlobalNotifications();

    // Set up real-time subscriptions
    const appsChannel = supabase
      .channel('admin-apps-changes')
      .on('postgres_changes', { event: '*', table: 'apps', schema: 'public' }, () => {
        fetchApps();
      })
      .subscribe();

    const devsChannel = supabase
      .channel('admin-devs-changes')
      .on('postgres_changes', { event: '*', table: 'developers', schema: 'public' }, () => {
        fetchDevelopers();
      })
      .subscribe();

    const adminsChannel = supabase
      .channel('admin-admins-changes')
      .on('postgres_changes', { event: '*', table: 'admins', schema: 'public' }, () => {
        fetchAdmins();
      })
      .subscribe();

    const settingsChannel = supabase
      .channel('admin-settings-changes')
      .on('postgres_changes', { event: '*', table: 'settings', schema: 'public', filter: 'id=eq.main' }, () => {
        fetchSettings();
      })
      .subscribe();

    const notificationsChannel = supabase
      .channel('admin-notifications-changes')
      .on('postgres_changes', { event: '*', table: 'notifications', schema: 'public' }, () => {
        fetchGlobalNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(appsChannel);
      supabase.removeChannel(devsChannel);
      supabase.removeChannel(adminsChannel);
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, []);

  useEffect(() => {
    if (currentAdmin && currentAdmin.role === 'editor') {
      if (activeTab === 'admins' || activeTab === 'settings') {
        setActiveTab('dashboard');
      }
    }
  }, [currentAdmin, activeTab]);

  const checkApiStatus = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        setApiStatus('online');
      } else {
        setApiStatus('offline');
      }
    } catch (err) {
      console.warn('Backend API is offline or unreachable:', err);
      setApiStatus('offline');
    }
  };

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        if (error.code === 'PGRST205' || error.message.includes('relation "admins" does not exist')) {
          setDbError('Database table "admins" not found. Please follow the instructions in SUPABASE_SETUP.md to set up your database.');
        } else if (error.message.includes('Failed to fetch')) {
          setDbError('Could not connect to Supabase. Please check your internet connection and ensure your VITE_SUPABASE_URL is correct.');
        }
        throw error;
      }
      setAdmins(data || []);
    } catch (err) {
      console.error('Error fetching admins:', err);
    }
  };

  const fetchDevelopers = async () => {
    try {
      const { data, error } = await supabase
        .from('developers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        if (error.code === 'PGRST205') {
          setDbError('Database table "developers" not found. Please run the SQL setup script.');
        }
        throw error;
      }
      setDevelopers(data || []);
    } catch (err) {
      console.error('Error fetching developers:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('settings').select('*').eq('id', 'main').single();
      if (data) {
        setSettings(prev => ({
          ...prev,
          ...data
        }));
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const fetchGlobalNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .is('user_id', null)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        if (error.code === 'PGRST204' || error.message.includes('relation "notifications" does not exist')) {
          setDbError('Database table "notifications" not found. Please run the SQL setup script to enable broadcast history.');
        }
        throw error;
      }
      setGlobalNotifications(data || []);
    } catch (err) {
      console.error('Error fetching global notifications:', err);
    }
  };

  const handleToggleSetting = async (key: keyof StoreSettings, value: any) => {
    if (currentAdmin?.role !== 'super_admin') {
      showDialog('Access Denied', 'Only super admins can modify store settings.', 'warning');
      return;
    }
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);
    
    try {
      // Create a payload with only the basic columns first to avoid schema cache errors
      // if the user hasn't run the SQL migration yet.
      const payload: any = { 
        id: 'main',
        store_name: updatedSettings.store_name,
        contact_email: updatedSettings.contact_email,
        maintenance_mode: updatedSettings.maintenance_mode,
        updated_at: new Date().toISOString()
      };

      // Only add extended columns if they are likely to exist or if we want to try
      if (updatedSettings.allow_user_uploads !== undefined) payload.allow_user_uploads = updatedSettings.allow_user_uploads;
      if (updatedSettings.auth_methods) payload.auth_methods = updatedSettings.auth_methods;
      if (updatedSettings.store_logo_url !== undefined) payload.store_logo_url = updatedSettings.store_logo_url;
      if (updatedSettings.primary_color) payload.primary_color = updatedSettings.primary_color;
      if (updatedSettings.announcement_text !== undefined) payload.announcement_text = updatedSettings.announcement_text;
      if (updatedSettings.footer_text !== undefined) payload.footer_text = updatedSettings.footer_text;

      const { error } = await supabase.from('settings').upsert(payload);
      
      if (error) {
        // If it's a column missing error, try saving without the extended columns
        if (error.code === 'PGRST204') {
          console.warn('Some columns missing in DB, saving basic settings only.');
          const basicPayload = {
            id: 'main',
            store_name: updatedSettings.store_name,
            contact_email: updatedSettings.contact_email,
            maintenance_mode: updatedSettings.maintenance_mode,
            updated_at: new Date().toISOString()
          };
          await supabase.from('settings').upsert(basicPayload);
        } else {
          throw error;
        }
      }
    } catch (err) {
      console.error(`Error updating ${key}:`, err);
      fetchSettings(); // Revert by refetching
      showDialog('Update Failed', `Failed to update ${key}. Please check your database schema.`, 'error');
    }
  };

  const handleSaveSettings = async () => {
    if (currentAdmin?.role !== 'super_admin') {
      showDialog('Access Denied', 'Only super admins can modify store settings.', 'warning');
      return;
    }
    showDialog(
      'Save Settings',
      'Are you sure you want to save these global store settings?',
      'info',
      async () => {
        setLoading(true);
        try {
          const payload: any = { 
            id: 'main', 
            ...settings,
            updated_at: new Date().toISOString()
          };

          const { error } = await supabase.from('settings').upsert(payload);
          
          if (error) {
            if (error.code === 'PGRST204') {
              showDialog('Schema Mismatch', 'Database schema mismatch. Please run the provided SQL script in your Supabase dashboard to add missing columns.', 'warning');
              // Fallback to basic save
              const basicPayload = {
                id: 'main',
                store_name: settings.store_name,
                contact_email: settings.contact_email,
                maintenance_mode: settings.maintenance_mode,
                updated_at: new Date().toISOString()
              };
              await supabase.from('settings').upsert(basicPayload);
            } else {
              throw error;
            }
          } else {
            showDialog('Success', 'Settings saved successfully!', 'success');
          }
        } catch (err) {
          console.error('Error saving settings:', err);
          showDialog('Error', 'Failed to save settings.', 'error');
        } finally {
          setLoading(false);
        }
      },
      true,
      'Save Changes'
    );
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showDialog('Error', 'Passwords do not match!', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showDialog('Error', 'Password must be at least 6 characters long.', 'error');
      return;
    }

    showDialog(
      'Update Password',
      'Are you sure you want to change your administrative password? You will need to use the new password for your next login.',
      'warning',
      async () => {
        setPasswordLoading(true);
        try {
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) throw error;
          showDialog('Success', 'Password updated successfully!', 'success');
          setNewPassword('');
          setConfirmPassword('');
        } catch (err: any) {
          console.error('Error updating password:', err);
          showDialog('Error', 'Failed to update password: ' + err.message, 'error');
        } finally {
          setPasswordLoading(false);
        }
      },
      true,
      'Update Password'
    );
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (currentAdmin?.role !== 'super_admin') {
      showDialog('Access Denied', 'Only super admins can modify store settings.', 'warning');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    try {
      const url = await uploadFile(file, 'store');
      setSettings(prev => ({ ...prev, store_logo_url: url }));
    } catch (err) {
      console.error('Error uploading logo:', err);
      showDialog('Upload Failed', 'Failed to upload logo.', 'error');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleAddCustomAuth = () => {
    if (currentAdmin?.role !== 'super_admin') {
      showDialog('Access Denied', 'Only super admins can manage authentication settings.', 'warning');
      return;
    }
    const name = prompt('Enter custom auth provider name (e.g. GitHub, Discord):');
    if (!name) return;
    
    const newCustomAuth = [
      ...(settings.auth_methods?.custom_auth || []),
      { name, enabled: true, config: {} }
    ];
    
    handleToggleSetting('auth_methods', {
      ...settings.auth_methods,
      custom_auth: newCustomAuth
    });
  };

  const handleToggleCustomAuth = (index: number) => {
    if (currentAdmin?.role !== 'super_admin') {
      showDialog('Access Denied', 'Only super admins can manage authentication settings.', 'warning');
      return;
    }
    const customAuth = [...(settings.auth_methods?.custom_auth || [])];
    customAuth[index].enabled = !customAuth[index].enabled;
    
    handleToggleSetting('auth_methods', {
      ...settings.auth_methods,
      custom_auth: customAuth
    });
  };

  const handleRemoveCustomAuth = (index: number) => {
    if (currentAdmin?.role !== 'super_admin') {
      showDialog('Access Denied', 'Only super admins can manage authentication settings.', 'warning');
      return;
    }
    showDialog(
      'Remove Auth Provider',
      `Are you sure you want to remove the "${settings.auth_methods?.custom_auth?.[index].name}" authentication provider?`,
      'danger',
      () => {
        const customAuth = [...(settings.auth_methods?.custom_auth || [])];
        customAuth.splice(index, 1);
        
        handleToggleSetting('auth_methods', {
          ...settings.auth_methods,
          custom_auth: customAuth
        });
      },
      true,
      'Remove Provider'
    );
  };

  const handleBiometricEnrollment = async () => {
    if (!window.PublicKeyCredential) {
      showDialog('Not Supported', 'Biometric authentication is not supported on this device/browser.', 'info');
      return;
    }

    try {
      let user;
      const { data: authData } = await supabase.auth.getUser();
      user = authData.user;

      // Support demo session if real user is not found
      if (!user && localStorage.getItem('nexus_demo_session') === 'true') {
        user = { id: 'demo-user-id', email: 'nexus.apphub@gmail.com' };
      }

      if (!user) throw new Error('User not authenticated. Please log in first.');

      const challenge = generateRandomChallenge();
      const userId = new TextEncoder().encode(user.id);

      const options: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: "XUBILASS APP HUB",
          id: window.location.hostname,
        },
        user: {
          id: userId,
          name: user.email || "Admin",
          displayName: user.email || "Admin",
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
        attestation: "none",
      };

      const credential = (await navigator.credentials.create({
        publicKey: options,
      })) as PublicKeyCredential;

      if (!credential) throw new Error('Credential creation failed');

      const response = credential.response as AuthenticatorAttestationResponse;
      
      // Store the credential info
      // In a real app, you'd send this to your server to verify and store
      const credentialData = {
        credentialId: bufferToBase64(credential.rawId),
        publicKey: bufferToBase64(response.getPublicKey()),
        userId: user.id
      };

      // For this demo, we'll store it in localStorage to simulate a database
      // But we'll also try to save it to Supabase if the table exists
      localStorage.setItem('nexus_biometric_cred', JSON.stringify(credentialData));
      
      try {
        await supabase.from('admin_biometrics').insert([{
          user_id: user.id,
          credential_id: credentialData.credentialId,
          public_key: credentialData.publicKey
        }]);
      } catch (e) {
        console.warn('Could not save to Supabase table, falling back to local storage only');
      }

      showDialog('Enrollment Successful', 'Biometric enrollment successful! You can now log in using your fingerprint/face ID.', 'success');
    } catch (err: any) {
      console.error('Biometric enrollment error:', err);
      if (err.name === 'NotAllowedError') {
        showDialog('Enrollment Cancelled', 'Enrollment cancelled or timed out.', 'info');
      } else {
        showDialog('Enrollment Failed', 'Enrollment failed: ' + err.message, 'error');
      }
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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

  const fetchHistory = async (app: AppRecord) => {
    setHistoryLoading(true);
    setSelectedAppForHistory(app);
    setIsHistoryModalOpen(true);
    try {
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .eq('app_id', app.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAppVersions(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRollback = async (version: AppVersion) => {
    if (!selectedAppForHistory) return;
    
    showDialog(
      'Rollback Version',
      `Are you sure you want to rollback ${selectedAppForHistory.name} to version ${version.version}? This will immediately update the live version for all users.`,
      'warning',
      async () => {
        setLoading(true);
        try {
          const { error } = await supabase
            .from('apps')
            .update({
              version: version.version,
              apk_url: version.apk_url,
              updated_at: new Date().toISOString()
            })
            .eq('id', selectedAppForHistory.id);

          if (error) throw error;
          
          showDialog('Success', 'Rollback successful!', 'success');
          await fetchApps();
          setIsHistoryModalOpen(false);
        } catch (err) {
          console.error('Error rolling back:', err);
          showDialog('Error', 'Rollback failed.', 'error');
        } finally {
          setLoading(false);
        }
      },
      true,
      'Confirm Rollback'
    );
  };

  const fetchApps = async () => {
    try {
      const { data, error } = await supabase
        .from('apps')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST205') {
          setDbError('Database table "apps" not found. Please run the SQL setup script.');
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

   const handleStatusChange = async (id: string, newStatus: AppRecord['status']) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;

    showDialog(
      newStatus === 'published' ? 'Approve Application' : 'Reject Application',
      `Are you sure you want to ${newStatus === 'published' ? 'approve' : 'reject'} "${app.name}"?`,
      newStatus === 'published' ? 'info' : 'warning',
      async () => {
        if (newStatus === 'rejected') {
          setRejectionModal({
            isOpen: true,
            appId: id,
            appName: app.name,
            version: app.pending_update?.version || app.version
          });
          return;
        }
        await processStatusChange(id, newStatus);
      },
      true,
      newStatus === 'published' ? 'Approve' : 'Reject'
    );
  };

  const processStatusChange = async (id: string, newStatus: AppRecord['status'], reason?: string) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;

    try {
      setUploading(true);
      let updateData: any = { status: newStatus, updated_at: new Date().toISOString() };
      
      if (newStatus === 'published' && app.pending_update) {
        // Merge pending update into main record, excluding release_notes which isn't a column in 'apps'
        const { release_notes, ...updateFields } = app.pending_update as any;
        updateData = {
          ...updateData,
          ...updateFields,
          pending_update: null,
          rejection_reason: null, // Clear rejection reason if approved
          rejected_version: null
        };
      } else if (newStatus === 'rejected') {
        // Store rejection info
        updateData = {
          ...updateData,
          rejection_reason: reason || 'No reason provided',
          rejected_version: app.pending_update?.version || app.version,
          pending_update: null,
          // If it was already published, keep it published but mark the rejection
          status: app.status === 'published' ? 'published' : 'rejected'
        };
      }

      const { error } = await supabase
        .from('apps')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      
      // Update local state
      setApps(apps.map(a => a.id === id ? { ...a, ...updateData } : a));
      
      // Sync to Google Sheets
      const updatedApp = apps.find(a => a.id === id);
      if (updatedApp) {
        await syncToGoogleSheet({ ...updatedApp, ...updateData, action: 'status_update' });
      }

      // Send notification to developer
      if (app.developer_id) {
        const { data: devData } = await supabase
          .from('developers')
          .select('user_id')
          .eq('id', app.developer_id)
          .single();

        if (devData?.user_id) {
          const isUpdate = !!app.pending_update;
          const title = newStatus === 'published' 
            ? (isUpdate ? 'Update Approved' : 'Application Approved')
            : (isUpdate ? 'Update Rejected' : 'Application Rejected');
          
          const message = newStatus === 'published'
            ? `Your ${isUpdate ? 'update for' : 'application'} "${app.name}" has been approved and is now live.`
            : `Your ${isUpdate ? 'update for' : 'application'} "${app.name}" has been rejected. Reason: ${reason || 'No reason provided'}`;

          await supabase.from('notifications').insert([{
            user_id: devData.user_id,
            title,
            message,
            type: newStatus === 'published' ? 'success' : 'error',
            is_read: false
          }]);
        }
      }

      showDialog('Success', `App ${newStatus} successfully!`, 'success');
    } catch (error) {
      console.error('Error updating status:', error);
      showDialog('Error', 'Failed to update status.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const appToDelete = apps.find(a => a.id === id);
    showDialog(
      'Delete Application',
      `Are you sure you want to permanently delete "${appToDelete?.name || 'this app'}"? This action cannot be undone and all associated files will remain in storage unless manually cleaned.`,
      'danger',
      async () => {
        try {
          const { error } = await supabase.from('apps').delete().eq('id', id);
          if (error) throw error;
          setApps(apps.filter(app => app.id !== id));
          showDialog('Success', 'App deleted successfully.', 'success');
        } catch (error) {
          console.error('Error deleting app:', error);
          showDialog('Error', 'Failed to delete app.', 'error');
        }
      },
      true,
      'Delete Permanently'
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    
    showDialog(
      editingApp ? 'Save Changes' : 'Submit Application',
      editingApp 
        ? 'Are you sure you want to save the changes to this application?' 
        : 'Are you sure you want to submit this application for review?',
      'info',
      async () => {
        setUploading(true);
        
        const formData = new FormData(form);
        const iconFile = (form.elements.namedItem('icon_file') as HTMLInputElement).files?.[0];
        const apkFile = (form.elements.namedItem('apk_file') as HTMLInputElement).files?.[0];

        try {
          if (localStorage.getItem('nexus_demo_session') === 'true') {
            showDialog('Demo Mode Warning', 'You are in demo mode. Your changes will be saved to the database, but you might not be able to see them until you log in with a real account.', 'warning');
          }

          const appName = formData.get('name') as string;
          const appVersion = formData.get('version') as string;
          const slug = appName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

          let icon_url = (formData.get('icon_url') as string) || editingApp?.icon_url || '';
          let apk_url = (formData.get('apk_url') as string) || editingApp?.apk_url || '';
          let fileSize = editingApp?.size || '0 MB';

          if (iconFile && iconFile.size > 0) {
            // Auto-resize icon before upload
            const resizedIconBlob = await resizeImage(iconFile, 512);
            const resizedIconFile = new File([resizedIconBlob], iconFile.name, { type: resizedIconBlob.type });
            icon_url = await uploadFile(resizedIconFile, 'icons', `${slug}-icon`);
          }
          
          if (apkFile && apkFile.size > 0) {
            apk_url = await uploadFile(apkFile, 'apks', `${slug}-v${appVersion.replace(/\./g, '-')}`);
            fileSize = formatBytes(apkFile.size);
          }

          // Upload new screenshots
          const uploadedScreenshots = await Promise.all(
            newScreenshotFiles.map(file => uploadFile(file, 'screenshots'))
          );

          const finalScreenshots = [...existingScreenshots, ...uploadedScreenshots];

          const developerId = formData.get('developer_id') as string;
          const selectedDev = developers.find(d => d.id === developerId);

          const appData = {
            name: formData.get('name') as string,
            developer: selectedDev ? selectedDev.name : (formData.get('developer') || 'System'),
            developer_id: developerId || null,
            description: formData.get('description') as string,
            category: formData.get('category') as string,
            version: formData.get('version') as string,
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
                  release_notes: releaseNotes || 'Admin update' 
                } 
              })
              .eq('id', appId);
            if (error) throw error;
            showDialog('Success', 'Changes saved as a pending update. Please approve it in the Review tab to make it live.', 'success');
          } else {
            // Let Supabase generate UUID to avoid "invalid input syntax for type uuid"
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
            release_notes: releaseNotes || 'Initial release',
            apk_url: appData.apk_url
          }]);
          
          await fetchApps();
          setIsModalOpen(false);
          setEditingApp(null);
          // Cleanup previews
          screenshotPreviews.forEach(url => URL.revokeObjectURL(url));
          if (iconPreview && iconPreview.startsWith('blob:')) URL.revokeObjectURL(iconPreview);
          setExistingScreenshots([]);
          setNewScreenshotFiles([]);
          setScreenshotPreviews([]);
          setIconPreview(null);
          showDialog('Success', editingApp ? 'Application updated successfully!' : 'Application uploaded successfully!', 'success');
          
          await syncToGoogleSheet({ ...appData, action: editingApp ? 'update' : 'create' });
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

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notificationForm.title || !notificationForm.message) {
      showDialog('Error', 'Please fill in both title and message.', 'error');
      return;
    }

    if (currentAdmin?.role !== 'super_admin') {
      showDialog('Access Denied', 'Only super admins can send global notifications.', 'warning');
      return;
    }

    setIsSendingNotification(true);
    try {
      const notificationData = {
        id: Math.random().toString(36).substring(7),
        ...notificationForm,
        timestamp: Date.now()
      };

      // 1. Persist in Database (Global notification has user_id = null)
      const { error: dbError } = await supabase.from('notifications').insert([{
        title: notificationForm.title,
        message: notificationForm.message,
        type: notificationForm.type,
        is_sticky: notificationForm.is_sticky,
        user_id: null, // Global
        is_read: false
      }]);

      if (dbError) {
        console.warn('Failed to persist notification in DB, but will still broadcast:', dbError);
      } else {
        fetchGlobalNotifications();
      }

      // 2. Use Supabase Realtime Broadcast for immediate in-app delivery
      try {
        await new Promise<void>((resolve, reject) => {
          const channel = supabase.channel('global-notifications');
          channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              try {
                await channel.send({
                  type: 'broadcast',
                  event: 'new-notification',
                  payload: {
                    ...notificationData,
                    is_sticky: notificationForm.is_sticky
                  },
                });
                supabase.removeChannel(channel);
                resolve();
              } catch (err) {
                supabase.removeChannel(channel);
                reject(err);
              }
            }
          });
        });
      } catch (broadcastErr) {
        console.warn('Realtime broadcast failed:', broadcastErr);
      }

      // 3. Send push notification to all subscribed devices via OneSignal
      try {
        const pushRes = await fetch('/.netlify/functions/send-push-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: notificationForm.title,
            message: notificationForm.message,
          })
        });
        if (!pushRes.ok) {
          const pushData = await pushRes.json();
          console.warn('Push notification API returned non-OK:', pushData);
        }
      } catch (pushErr) {
        console.warn('Push notification delivery failed:', pushErr);
      }

      showDialog('Success', 'Global notification sent and persisted successfully!', 'success');
      setNotificationForm({ title: '', message: '', type: 'info', is_sticky: false });
    } catch (err: any) {
      console.error('Error sending notification:', err);
      showDialog('Error', 'Failed to send notification: ' + err.message, 'error');
    } finally {
      setIsSendingNotification(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    showDialog(
      'Delete Notification',
      'Are you sure you want to delete this notification from the history? This action cannot be undone.',
      'warning',
      async () => {
        try {
          const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id);

          if (error) throw error;

          showDialog('Success', 'Notification deleted successfully.', 'success');
          fetchGlobalNotifications();
        } catch (err: any) {
          console.error('Error deleting notification:', err);
          showDialog('Error', 'Failed to delete notification: ' + err.message, 'error');
        }
      },
      true,
      'Delete'
    );
  };

  const handleLogout = async () => {
    showDialog(
      'Sign Out',
      'Are you sure you want to sign out of the admin portal?',
      'info',
      async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('nexus_demo_session');
        navigate('/');
      },
      true,
      'Sign Out'
    );
  };

  const handleSaveDeveloper = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const createAuth = formData.get('create_auth') === 'on';
    let password = formData.get('password') as string;
    
    if (!password && createAuth) {
      password = '123456';
    }
    
    const devData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      company: formData.get('company') as string,
      bio: formData.get('bio') as string,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingDev?.id) {
        const { error } = await supabase
          .from('developers')
          .update(devData)
          .eq('id', editingDev.id);
        if (error) throw error;
      } else if (createAuth) {
        // Create auth user using Admin client (Frontend-only)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: devData.email,
          password: password,
          email_confirm: true,
          user_metadata: { full_name: devData.name }
        });

        if (authError) throw authError;

        const { error: devError } = await supabase
          .from('developers')
          .insert([{ 
            ...devData, 
            user_id: authData.user.id,
            status: 'approved', 
            created_at: new Date().toISOString() 
          }]);
        
        if (devError) {
          // Cleanup auth user if table insert fails
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          throw devError;
        }

        // Sync to Google Sheets
        await syncToGoogleSheet({
          type: 'developer_create',
          ...devData,
          password,
          status: 'approved',
          admin_action: true
        });
      } else {
        const { error } = await supabase
          .from('developers')
          .insert([{ ...devData, created_at: new Date().toISOString() }]);
        if (error) throw error;
      }
      
      await fetchDevelopers();
      setIsDevModalOpen(false);
      setEditingDev(null);
      if (!createAuth) showDialog('Success', 'Developer profile saved successfully!', 'success');
    } catch (err: any) {
      console.error('Error saving developer:', err);
      showDialog('Error', 'Error saving developer: ' + err.message, 'error');
    }
  };

  const handleSaveAdmin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (currentAdmin?.role !== 'super_admin') {
      showDialog('Access Denied', 'Only super admins can manage other administrators.', 'warning');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const createAuth = formData.get('create_auth') === 'on';
    let password = formData.get('password') as string;
    
    if (!password && createAuth) {
      password = '123456';
    }
    
    const adminData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      role: formData.get('role') as 'super_admin' | 'editor',
      updated_at: new Date().toISOString(),
    };

    try {
      if (localStorage.getItem('nexus_demo_session') === 'true') {
        showDialog('Demo Mode Warning', 'You are in demo mode. Your changes will be saved to the database, but you might not be able to see them until you log in with a real account.', 'warning');
      }

      if (editingAdmin?.id) {
        const { error } = await supabase
          .from('admins')
          .update(adminData)
          .eq('id', editingAdmin.id);
        if (error) throw error;
      } else if (createAuth) {
        // Create auth user using Admin client (Frontend-only)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: adminData.email,
          password: password,
          email_confirm: true,
          user_metadata: { full_name: adminData.name }
        });

        if (authError) throw authError;

        const { error: adminError } = await supabase
          .from('admins')
          .insert([{ 
            ...adminData, 
            user_id: authData.user.id,
            status: 'active', 
            created_at: new Date().toISOString() 
          }]);
        
        if (adminError) {
          // Cleanup auth user if table insert fails
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          throw adminError;
        }

        // Sync to Google Sheets
        await syncToGoogleSheet({
          type: 'admin_create',
          ...adminData,
          password,
          status: 'active',
          admin_action: true
        });
      } else {
        const { error } = await supabase
          .from('admins')
          .insert([{ ...adminData, status: 'active', created_at: new Date().toISOString() }]);
        if (error) throw error;
      }
      
      await fetchAdmins();
      setIsAdminModalOpen(false);
      setEditingAdmin(null);
      if (!createAuth) showDialog('Success', 'Admin profile saved successfully!', 'success');
    } catch (err: any) {
      console.error('Error saving admin:', err);
      showDialog('Error', 'Error saving admin: ' + err.message, 'error');
    }
  };

  const handleUpdateAdminStatus = async (id: string, newStatus: 'active' | 'inactive') => {
    if (currentAdmin?.role !== 'super_admin') {
      showDialog('Access Denied', 'Only super admins can manage other administrators.', 'warning');
      return;
    }
    try {
      const { error } = await supabase
        .from('admins')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;

      // Sync to Google Sheets
      const admin = admins.find(a => a.id === id);
      await syncToGoogleSheet({
        type: 'admin_status_update',
        email: admin?.email,
        status: newStatus,
        admin_action: true
      });

      setAdmins(admins.map(admin => admin.id === id ? { ...admin, status: newStatus } : admin));
      showDialog('Success', `Admin ${newStatus} successfully!`, 'success');
    } catch (error: any) {
      console.error('Error updating admin status:', error);
      showDialog('Error', error.message, 'error');
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    if (currentAdmin?.role !== 'super_admin') {
      showDialog('Access Denied', 'Only super admins can manage other administrators.', 'warning');
      return;
    }
    const admin = admins.find(a => a.id === id);
    if (admin?.role === 'super_admin') {
      showDialog('Action Denied', 'Super admins cannot be deleted.', 'warning');
      return;
    }

    showDialog(
      'Delete Admin',
      `Are you sure you want to delete "${admin?.name}"? This will also delete their authentication account.`,
      'danger',
      async () => {
        try {
          // 1. Delete from admins table
          const { error: deleteError } = await supabase
            .from('admins')
            .delete()
            .eq('id', id);

          if (deleteError) throw deleteError;

          // 2. Delete from auth if user_id exists using Admin client (Frontend-only)
          if (admin?.user_id) {
            await supabaseAdmin.auth.admin.deleteUser(admin.user_id);
          }
          
          setAdmins(admins.filter(a => a.id !== id));
          showDialog('Success', 'Admin deleted successfully.', 'success');
        } catch (err: any) {
          console.error('Error deleting admin:', err);
          showDialog('Error', 'Failed to delete admin: ' + err.message, 'error');
        }
      },
      true,
      'Delete Admin'
    );
  };

  const handleUpdateDeveloperStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('developers')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;

      // Sync to Google Sheets
      const dev = developers.find(d => d.id === id);
      await syncToGoogleSheet({
        type: 'status_update',
        email: dev?.email,
        status: newStatus,
        admin_action: true
      });

      setDevelopers(developers.map(dev => dev.id === id ? { ...dev, status: newStatus } : dev));
      showDialog('Success', `Developer ${newStatus} successfully!`, 'success');
    } catch (error: any) {
      console.error('Error updating developer status:', error);
      showDialog('Error', error.message, 'error');
    }
  };

  const handleDeleteDeveloper = async (id: string) => {
    const dev = developers.find(d => d.id === id);
    showDialog(
      'Delete Developer',
      `Are you sure you want to delete "${dev?.name}"? This will also delete their authentication account.`,
      'danger',
      async () => {
        try {
          // 1. Delete from developers table
          const { error: deleteError } = await supabase
            .from('developers')
            .delete()
            .eq('id', id);

          if (deleteError) throw deleteError;

          // 2. Delete from auth if user_id exists using Admin client (Frontend-only)
          if (dev?.user_id) {
            await supabaseAdmin.auth.admin.deleteUser(dev.user_id);
          }
          
          setDevelopers(developers.filter(d => d.id !== id));
          showDialog('Success', 'Developer deleted successfully.', 'success');
        } catch (err: any) {
          console.error('Error deleting developer:', err);
          showDialog('Error', 'Failed to delete developer: ' + err.message, 'error');
        }
      },
      true,
      'Delete Developer'
    );
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetId || !resetPassword) return;
    
    setIsResetting(true);
    try {
      // 1. Get the target's user_id
      const target = resetTargetType === 'developer' 
        ? developers.find(d => d.id === resetTargetId)
        : admins.find(a => a.id === resetTargetId);

      if (!target?.user_id) {
        throw new Error("User not found or has no linked auth account.");
      }

      // 2. Update the password in Supabase Auth using the Admin client (Frontend-only)
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(target.user_id, {
        password: resetPassword
      });

      if (authError) throw authError;
      
      // 3. Sync to Google Sheets
      await syncToGoogleSheet({
        type: resetTargetType === 'developer' ? 'password_reset' : 'admin_password_reset',
        id: resetTargetId,
        email: target.email,
        name: target.name,
        password: resetPassword,
        admin_action: true
      });
      
      showDialog('Success', 'Password reset successfully!', 'success');
      setIsResetPasswordModalOpen(false);
      setResetPassword('');
      setResetTargetId(null);
    } catch (err: any) {
      console.error('Error resetting password:', err);
      showDialog('Error', 'Error resetting password: ' + err.message, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!resetTargetId) return;
    
    const target = resetTargetType === 'developer' 
      ? developers.find(d => d.id === resetTargetId)
      : admins.find(a => a.id === resetTargetId);
      
    if (!target?.user_id) return;

    setIsResetting(true);
    try {
      // Update the password in Supabase Auth using the Admin client (Frontend-only)
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(target.user_id, {
        password: '123456'
      });

      if (authError) throw authError;
      
      // Sync to Google Sheets
      await syncToGoogleSheet({
        type: resetTargetType === 'developer' ? 'password_reset_default' : 'admin_password_reset_default',
        id: resetTargetId, 
        email: target.email,
        name: target.name,
        password: '123456',
        admin_action: true
      });
      
      showDialog('Success', `Password has been reset to '123456'. An email notification has been triggered for ${target.email}.`, 'success');
      setResetSuccessTarget({ name: target.name, email: target.email });
    } catch (err: any) {
      console.error('Error resetting to default:', err);
      showDialog('Error', 'Error resetting password: ' + err.message, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSendManualResetEmail = (target: { name: string; email: string }) => {
    const subject = encodeURIComponent('Your Password has been Reset - Nexus App Hub');
    const body = encodeURIComponent(`Hello ${target.name},\n\nYour password for Nexus App Hub has been reset to the default: 123456\n\nPlease login and change your password in your account settings immediately.\n\nBest regards,\nNexus Admin Team`);
    window.open(`mailto:${target.email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleSendResetEmail = async () => {
    if (!resetTargetId) return;
    
    const target = resetTargetType === 'developer' 
      ? developers.find(d => d.id === resetTargetId)
      : admins.find(a => a.id === resetTargetId);
      
    if (!target?.email) {
      showDialog('Error', 'Could not find email for this account.', 'error');
      return;
    }

    setIsResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(target.email, {
        redirectTo: `${window.location.origin}/admin`,
      });
      
      if (error) throw error;
      
      showDialog('Email Sent', `A password reset link has been sent to ${target.email}. They can use that link to set a new password.`, 'success');
      setIsResetPasswordModalOpen(false);
      setResetTargetId(null);
    } catch (err: any) {
      console.error('Error sending reset email:', err);
      showDialog('Error', 'Failed to send reset email: ' + err.message, 'error');
    } finally {
      setIsResetting(false);
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

  const handleDevAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (devAvatarPreview && devAvatarPreview.startsWith('blob:')) URL.revokeObjectURL(devAvatarPreview);
      setDevAvatarPreview(URL.createObjectURL(file));
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

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.developer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col md:flex-row">
      {/* Loading Overlay */}
      {uploading && (
        <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md text-white">
          <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-6 shadow-2xl shadow-brand-500/20"></div>
          <div className="text-center">
            <h3 className="text-2xl font-display font-bold mb-2">Processing Application</h3>
            <p className="text-neutral-300 animate-pulse">Please wait while we update the store...</p>
          </div>
        </div>
      )}

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl p-8 text-center"
            >
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-2xl font-display font-bold text-neutral-900 mb-2">Success!</h3>
              <p className="text-neutral-500 mb-8 leading-relaxed">
                {successMessage}
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg"
              >
                Continue
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Header */}
      <div className="md:hidden bg-neutral-900 text-white p-4 flex items-center justify-between sticky top-0 z-[60]">
        <div className="flex items-center gap-2 text-brand-500 font-display font-bold text-lg">
          <Package className="w-6 h-6" />
          XUBILASS Admin
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
        fixed inset-y-0 left-0 w-64 bg-neutral-900 text-white flex flex-col z-[55] transition-transform duration-300 md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-neutral-800 hidden md:block">
          <div className="flex items-center gap-2 text-brand-500 font-display font-bold text-xl">
            <Package className="w-8 h-8" />
            XUBILASS Admin
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2 pt-20 md:pt-4">
          <button 
            onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'dashboard' ? 'bg-brand-500 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>
          <button 
            onClick={() => { setActiveTab('review'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'review' ? 'bg-brand-500 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5" />
              App Review
            </div>
            {apps.filter(a => a.status === 'pending' || a.pending_update).length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'review' ? 'bg-white text-brand-600' : 'bg-brand-500 text-white'
              }`}>
                {apps.filter(a => a.status === 'pending' || a.pending_update).length}
              </span>
            )}
          </button>
          <button 
            onClick={() => { setActiveTab('developers'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'developers' ? 'bg-brand-500 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5" />
              Developers
            </div>
            {developers.filter(d => d.status === 'pending').length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'developers' ? 'bg-white text-brand-600' : 'bg-brand-500 text-white'
              }`}>
                {developers.filter(d => d.status === 'pending').length}
              </span>
            )}
          </button>
          <button 
            onClick={() => { setActiveTab('account'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'account' ? 'bg-brand-500 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
            }`}
          >
            <User className="w-5 h-5" />
            Account
          </button>
          {currentAdmin?.role === 'super_admin' && (
            <button 
              onClick={() => { setActiveTab('notifications'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                activeTab === 'notifications' ? 'bg-brand-500 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              <Bell className="w-5 h-5" />
              Notifications
            </button>
          )}
          {currentAdmin?.role === 'super_admin' && (
            <button 
              onClick={() => { setActiveTab('admins'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                activeTab === 'admins' ? 'bg-brand-500 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
              Admins
            </button>
          )}
          {currentAdmin?.role === 'super_admin' && (
            <button 
              onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                activeTab === 'settings' ? 'bg-brand-500 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              <Settings className="w-5 h-5" />
              Settings
            </button>
          )}
        </nav>
        <div className="p-4 border-t border-neutral-800">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl font-medium transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {dbError && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-800">
            <ShieldCheck className="w-6 h-6 shrink-0 text-amber-500" />
            <div>
              <p className="font-bold">Database Setup Required</p>
              <p className="text-sm opacity-90">{dbError}</p>
            </div>
          </div>
        )}

        {apiStatus === 'offline' && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800">
            <AlertCircle className="w-6 h-6 shrink-0 text-red-500" />
            <div>
              <p className="font-bold">Backend API Offline</p>
              <p className="text-sm opacity-90">
                The administrative backend server is unreachable. Features like password resets and developer account creation will not work. 
                If you are on Netlify, ensure your backend is deployed to a platform that supports Node.js (e.g., Render, Railway, or Heroku).
              </p>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="max-w-4xl mx-auto">
            <header className="mb-8">
              <h1 className="text-3xl font-display font-bold text-neutral-900">Global Notifications</h1>
              <p className="text-neutral-500">Send real-time digital push notifications to all active users.</p>
            </header>

            <div className="bg-white rounded-[2.5rem] border border-neutral-200 shadow-xl overflow-hidden">
              <div className="p-8 md:p-12">
                <form onSubmit={handleSendNotification} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Notification Title</label>
                      <input 
                        type="text"
                        value={notificationForm.title}
                        onChange={(e) => setNotificationForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g. System Maintenance"
                        className="w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Notification Type</label>
                      <select 
                        value={notificationForm.type}
                        onChange={(e) => setNotificationForm(prev => ({ ...prev, type: e.target.value as any }))}
                        className="w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all appearance-none"
                      >
                        <option value="info">Information (Blue)</option>
                        <option value="success">Success (Green)</option>
                        <option value="warning">Warning (Amber)</option>
                        <option value="alert">Critical Alert (Red/Brand)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700 ml-1">Message Content</label>
                    <textarea 
                      value={notificationForm.message}
                      onChange={(e) => setNotificationForm(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Enter the message you want to broadcast to all users..."
                      rows={4}
                      className="w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all resize-none"
                    />
                  </div>

                  <label className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-100 cursor-pointer hover:bg-neutral-100 transition-colors">
                    <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={notificationForm.is_sticky}
                        onChange={(e) => setNotificationForm(prev => ({ ...prev, is_sticky: e.target.checked }))}
                      />
                      <span
                        className={`${
                          notificationForm.is_sticky ? 'bg-brand-500' : 'bg-neutral-200'
                        } pointer-events-none inline-block h-6 w-11 rounded-full transition-colors duration-200 ease-in-out`}
                      />
                      <span
                        className={`${
                          notificationForm.is_sticky ? 'translate-x-6' : 'translate-x-1'
                        } pointer-events-none absolute left-0 inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out`}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-neutral-900">Sticky Announcement</p>
                      <p className="text-xs text-neutral-500">Show to new visitors for 24 hours instead of just 1 hour.</p>
                    </div>
                  </label>

                  <div className="pt-4">
                    <button 
                      type="submit"
                      disabled={isSendingNotification}
                      className="w-full py-5 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {isSendingNotification ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <Zap className="w-5 h-5 text-brand-500" />
                      )}
                      Broadcast & Persist Notification
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-neutral-50 p-8 border-t border-neutral-100">
                <div className="flex items-start gap-4 text-neutral-500 text-sm">
                  <Info className="w-5 h-5 shrink-0 text-brand-500" />
                  <div>
                    <p className="font-bold text-neutral-700 mb-1">How it works</p>
                    <p>This will send a real-time broadcast to all active users and persist the message in the database. New users or those who reload the page will see the most recent announcement (up to 1 hour for normal, or 24 hours for sticky announcements).</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Notification History */}
            <div className="mt-12">
              <h2 className="text-xl font-display font-bold text-neutral-900 mb-6 flex items-center gap-2">
                <History className="w-5 h-5 text-neutral-400" />
                Broadcast History
              </h2>
              
              <div className="space-y-4">
                {globalNotifications.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center text-neutral-500">
                    No broadcast history found.
                  </div>
                ) : (
                  globalNotifications.map((notif) => (
                    <div key={notif.id} className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm flex items-start gap-4">
                      <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                        notif.type === 'success' ? 'bg-emerald-50 text-emerald-500' :
                        notif.type === 'warning' ? 'bg-amber-50 text-amber-500' :
                        notif.type === 'alert' ? 'bg-brand-50 text-brand-500' :
                        'bg-blue-50 text-blue-500'
                      }`}>
                        {notif.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
                         notif.type === 'warning' ? <AlertCircle className="w-5 h-5" /> :
                         notif.type === 'alert' ? <Zap className="w-5 h-5" /> :
                         <Info className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-neutral-900 truncate">{notif.title}</h3>
                            {notif.is_sticky && (
                              <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[10px] font-bold rounded-full uppercase tracking-wider">Sticky</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-neutral-400 font-mono">
                              {new Date(notif.created_at).toLocaleString()}
                            </span>
                            <button 
                              onClick={() => handleDeleteNotification(notif.id)}
                              className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete notification"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-neutral-600 text-sm line-clamp-2">{notif.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <>
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h1 className="text-2xl md:text-3xl font-display font-bold text-neutral-900">App Management</h1>
                <p className="text-neutral-500 text-sm md:text-base">Manage, review, and publish applications.</p>
              </div>
              <button 
                onClick={() => { 
                  setEditingApp(null); 
                  setExistingScreenshots([]);
                  setNewScreenshotFiles([]);
                  setScreenshotPreviews([]);
                  setIsModalOpen(true); 
                }}
                className="w-full md:w-auto px-6 py-3 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Upload New App
              </button>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
              <div className="p-4 md:p-6 rounded-2xl border border-[var(--card-border)] shadow-sm" style={{ background: 'var(--card-bg)' }}>
                <div className="text-neutral-500 text-xs md:text-sm font-medium mb-1">Total Apps</div>
                <div className="text-xl md:text-3xl font-bold" style={{ color: 'var(--text-main)' }}>{apps.length}</div>
              </div>
              <div 
                onClick={() => setActiveTab('review')}
                className="p-4 md:p-6 rounded-2xl border border-[var(--card-border)] shadow-sm cursor-pointer hover:border-amber-300 transition-colors"
                style={{ background: 'var(--card-bg)' }}
              >
                <div className="text-neutral-500 text-xs md:text-sm font-medium mb-1">Pending</div>
                <div className="text-xl md:text-3xl font-bold text-amber-500">
                  {apps.filter(a => a.status === 'pending').length}
                </div>
              </div>
              <div className="p-4 md:p-6 rounded-2xl border border-[var(--card-border)] shadow-sm" style={{ background: 'var(--card-bg)' }}>
                <div className="text-neutral-500 text-xs md:text-sm font-medium mb-1">Published</div>
                <div className="text-xl md:text-3xl font-bold text-brand-500">
                  {apps.filter(a => a.status === 'published').length}
                </div>
              </div>
              <div className="p-4 md:p-6 rounded-2xl border border-[var(--card-border)] shadow-sm" style={{ background: 'var(--card-bg)' }}>
                <div className="text-neutral-500 text-xs md:text-sm font-medium mb-1">Downloads</div>
                <div className="text-xl md:text-3xl font-bold" style={{ color: 'var(--text-main)' }}>
                  {apps.reduce((acc, curr) => acc + curr.downloads, 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="p-4 rounded-2xl border border-[var(--card-border)] shadow-sm mb-6 flex items-center gap-4" style={{ background: 'var(--card-bg)' }}>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Search apps..."
                  className="w-full pl-10 pr-4 py-2 bg-neutral-50 dark:bg-white/5 border border-[var(--card-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-sm"
                  style={{ color: 'var(--text-main)' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* App Table */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px] md:min-w-0">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">App</th>
                      <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell">Category</th>
                      <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell">Rating</th>
                      <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell">Downloads</th>
                      <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden lg:table-cell">Updated</th>
                      <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-neutral-500 italic">Loading applications...</td>
                      </tr>
                    ) : filteredApps.length > 0 ? (
                      filteredApps.map(app => (
                        <tr key={app.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <img 
                                src={app.icon_url} 
                                alt="" 
                                className="w-10 h-10 rounded-lg object-cover" 
                                referrerPolicy="no-referrer"
                              />
                              <div>
                                <div className="font-semibold text-neutral-900 text-sm">{app.name}</div>
                                <div className="text-xs text-neutral-500">{app.developer}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell">
                            <span className="text-sm text-neutral-600">{app.category}</span>
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
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium w-fit ${
                                  app.status === 'published' ? 'bg-green-100 text-green-700' :
                                  app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700 hover:bg-red-200 transition-colors cursor-pointer'
                                }`}
                                disabled={app.status !== 'rejected'}
                              >
                                {app.status === 'published' ? <CheckCircle className="w-3 h-3" /> :
                                 app.status === 'pending' ? <Clock className="w-3 h-3" /> :
                                 <XCircle className="w-3 h-3" />}
                                {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                                {app.status === 'published' && <span className="ml-1 opacity-70">v{app.version}</span>}
                              </button>
                              
                              {app.rejected_version && (
                                <button
                                  onClick={() => setViewRejectionReason({
                                    isOpen: true,
                                    reason: app.rejection_reason || 'No reason provided',
                                    appName: app.name,
                                    version: app.rejected_version || ''
                                  })}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium bg-red-100 text-red-700 w-fit hover:bg-red-200 transition-colors"
                                >
                                  <XCircle className="w-3 h-3" />
                                  Rejected v{app.rejected_version}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-600 hidden md:table-cell">
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-amber-500 fill-current" />
                              {(app.rating || 0).toFixed(1)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-600 hidden md:table-cell">
                            {app.downloads.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-600 hidden lg:table-cell">
                            {new Date(app.updated_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1 md:gap-2">
                              {(app.status === 'pending' || app.pending_update) && (
                                <>
                                  <button 
                                    onClick={() => handleStatusChange(app.id, 'published')}
                                    className="p-1.5 md:p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                    title={app.pending_update ? "Approve Update" : "Approve & Publish"}
                                  >
                                    <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                                  </button>
                                  <button 
                                    onClick={() => handleStatusChange(app.id, 'rejected')}
                                    className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title={app.pending_update ? "Reject Update" : "Reject Application"}
                                  >
                                    <XCircle className="w-4 h-4 md:w-5 md:h-5" />
                                  </button>
                                </>
                              )}
                              <button 
                                onClick={() => fetchHistory(app)}
                                className="p-1.5 md:p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 rounded-lg transition-colors"
                                title="Version History"
                              >
                                <History className="w-4 h-4 md:w-5 md:h-5" />
                              </button>
                              <button 
                                onClick={() => { 
                                  setEditingApp(app); 
                                  setExistingScreenshots(app.screenshots || []);
                                  setIsModalOpen(true); 
                                }}
                                className="p-1.5 md:p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 rounded-lg transition-colors"
                              >
                                <Edit className="w-4 h-4 md:w-5 md:h-5" />
                              </button>
                              <button 
                                onClick={() => handleDelete(app.id)}
                                className="p-1.5 md:p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
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

        {activeTab === 'review' && (
          <>
            <header className="mb-8">
              <h1 className="text-3xl font-display font-bold text-neutral-900">App Review Queue</h1>
              <p className="text-neutral-500">Review and approve pending application submissions.</p>
            </header>

            <div className="grid grid-cols-1 gap-6">
              {apps.filter(a => a.status === 'pending' || a.pending_update).length > 0 ? (
                apps.filter(a => a.status === 'pending' || a.pending_update).map(app => (
                  <motion.div 
                    key={app.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center"
                  >
                    <img 
                      src={app.pending_update?.icon_url || app.icon_url} 
                      alt="" 
                      className="w-20 h-20 rounded-2xl object-cover shadow-md" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-bold text-neutral-900">{app.pending_update?.name || app.name}</h3>
                        {app.status === 'pending' ? (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold uppercase tracking-wider">New App</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider">Update Pending</span>
                        )}
                      </div>
                      <p className="text-neutral-500 text-sm mb-3 line-clamp-2">{app.pending_update?.description || app.description}</p>
                      <div className="flex flex-wrap gap-4 text-xs font-medium" style={{ color: 'var(--text-main)', opacity: 0.5 }}>
                        <div className="flex items-center gap-1">
                          <Package className="w-4 h-4" />
                          {app.pending_update?.category || app.category}
                        </div>
                        <div className="flex items-center gap-1">
                          <ShieldCheck className="w-4 h-4" />
                          v{app.pending_update?.version || app.version}
                        </div>
                        {app.pending_update && (
                          <div className="flex items-center gap-1 text-blue-600 font-bold">
                            <Clock className="w-4 h-4" />
                            Current: v{app.version}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 w-full md:w-auto md:justify-end">
                      <button 
                        onClick={() => handleStatusChange(app.id, 'published')}
                        className="flex-1 md:flex-none px-6 py-3 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5" />
                        {app.pending_update ? 'Approve Update' : 'Approve'}
                      </button>
                      <button 
                        onClick={() => handleStatusChange(app.id, 'rejected')}
                        className="flex-1 md:flex-none px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-5 h-5" />
                        {app.pending_update ? 'Reject Update' : 'Reject'}
                      </button>
                      <button 
                        onClick={() => fetchHistory(app)}
                        className="flex-1 md:flex-none px-6 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
                        title="Version History"
                      >
                        <History className="w-5 h-5" />
                        History
                      </button>
                      {app.pending_update && (
                        <button 
                          onClick={() => { 
                            setComparingApp(app); 
                            setIsCompareModalOpen(true); 
                          }}
                          className="flex-1 md:flex-none px-6 py-3 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-all flex items-center justify-center gap-2"
                        >
                          <Eye className="w-5 h-5" />
                          View Changes
                        </button>
                      )}
                      <button 
                        onClick={() => { 
                          setEditingApp(app); 
                          setExistingScreenshots(app.screenshots || []);
                          setIsModalOpen(true); 
                        }}
                        className="flex-1 md:flex-none px-6 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
                      >
                        <Edit className="w-5 h-5" />
                        Review Details
                      </button>
                      <button 
                        onClick={() => handleDelete(app.id)}
                        className="p-3 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="bg-white p-12 rounded-3xl border border-dashed border-neutral-300 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-full mb-4">
                    <CheckCircle className="w-8 h-8 text-neutral-400" />
                  </div>
                  <h3 className="text-xl font-bold text-neutral-900 mb-1">Queue Clear!</h3>
                  <p className="text-neutral-500">There are no pending applications to review at this time.</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'developers' && (
          <div className="max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
              <div>
                <h1 className="text-3xl font-display font-bold text-neutral-900">Developer Management</h1>
                <p className="text-neutral-500">Add and manage developer profiles.</p>
              </div>
              <button 
                onClick={() => { setEditingDev(null); setIsDevModalOpen(true); }}
                className="px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-neutral-900/10"
              >
                <UserPlus className="w-5 h-5" />
                Add Developer
              </button>
            </header>

            <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3 text-blue-800">
              <AlertCircle className="w-5 h-5 shrink-0 text-blue-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold">How do developers get their password?</p>
                <p className="opacity-90">After you add a developer here, they must go to the <b>Developer Portal</b> and click <b>"Sign Up"</b> using the same email address. They will set their own password during registration.</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wider font-bold">
                      <th className="px-6 py-4">Developer</th>
                      <th className="px-6 py-4">Company</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Apps</th>
                      <th className="px-6 py-4">Joined</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {developers.length > 0 ? (
                      developers.map(dev => (
                        <tr key={dev.id} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden border border-neutral-200">
                                {dev.avatar_url ? <img src={dev.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-neutral-400" />}
                              </div>
                              <div>
                                <div className="font-bold text-neutral-900">{dev.name}</div>
                                <div className="text-xs text-neutral-400">{dev.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-600">{dev.company || 'Independent'}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                              dev.status === 'approved' ? 'bg-green-50 text-green-700' :
                              dev.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                              'bg-red-50 text-red-700'
                            }`}>
                              {dev.status || 'approved'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-brand-50 text-brand-700 rounded-md text-xs font-bold">
                              {apps.filter(a => a.developer_id === dev.id).length} Apps
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-500">
                            {new Date(dev.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {dev.status === 'pending' && (
                                <>
                                  <button 
                                    onClick={() => handleUpdateDeveloperStatus(dev.id, 'approved')}
                                    title="Approve"
                                    className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-all"
                                  >
                                    <CheckCircle className="w-5 h-5" />
                                  </button>
                                  <button 
                                    onClick={() => handleUpdateDeveloperStatus(dev.id, 'rejected')}
                                    title="Reject"
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  >
                                    <XCircle className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                              <button 
                                onClick={() => { 
                                  setResetTargetId(dev.id); 
                                  setResetTargetType('developer');
                                  setIsResetPasswordModalOpen(true); 
                                }}
                                title="Reset Password"
                                className="p-2 text-neutral-400 hover:bg-brand-50 hover:text-brand-600 rounded-lg transition-all"
                              >
                                <Key className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => { setEditingDev(dev); setIsDevModalOpen(true); }}
                                className="p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 rounded-lg transition-all"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteDeveloper(dev.id)}
                                className="p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">No developers found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admins' && (
          <div className="max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
              <div>
                <h1 className="text-3xl font-display font-bold text-neutral-900">Admin Management</h1>
                <p className="text-neutral-500">Manage store administrators and their roles.</p>
              </div>
              <button 
                onClick={() => { setEditingAdmin(null); setIsAdminModalOpen(true); }}
                className="px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-neutral-900/10"
              >
                <UserPlus className="w-5 h-5" />
                Add Admin
              </button>
            </header>

            {localStorage.getItem('nexus_demo_session') === 'true' && (
              <div className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-3xl flex items-start gap-4 text-amber-900 shadow-sm">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg mb-1">Demo Session Active</p>
                  <p className="opacity-90 mb-4">You are currently using a demo bypass. Real database data (apps, admins, developers) is <b>hidden</b> because you are not logged into a real Supabase account.</p>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={handleLogout}
                      className="px-4 py-2 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition-all"
                    >
                      Logout & Sign In for Real
                    </button>
                    <button 
                      onClick={() => {
                        fetchAdmins();
                        fetchApps();
                        fetchDevelopers();
                      }}
                      className="px-4 py-2 bg-white border border-amber-200 text-amber-700 rounded-xl font-bold text-sm hover:bg-amber-100 transition-all"
                    >
                      Retry Fetching Data
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wider font-bold">
                      <th className="px-6 py-4">Admin</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Joined</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {admins.length > 0 ? (
                      admins.map(admin => (
                        <tr key={admin.id} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden border border-neutral-200">
                                <User className="w-5 h-5 text-neutral-400" />
                              </div>
                              <div>
                                <div className="font-bold text-neutral-900">{admin.name}</div>
                                <div className="text-xs text-neutral-400">{admin.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                              admin.role === 'super_admin' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                            }`}>
                              {admin.role === 'super_admin' ? 'Super Admin' : 'Editor'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                              admin.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {admin.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-500">
                            {new Date(admin.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {admin.status === 'inactive' && (
                                <button 
                                  onClick={() => handleUpdateAdminStatus(admin.id, 'active')}
                                  title="Approve"
                                  className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-all"
                                >
                                  <CheckCircle className="w-5 h-5" />
                                </button>
                              )}
                              {admin.role !== 'super_admin' && (
                                <>
                                  <button 
                                    onClick={() => { 
                                      setResetTargetId(admin.id); 
                                      setResetTargetType('admin');
                                      setIsResetPasswordModalOpen(true); 
                                    }}
                                    title="Reset Password"
                                    className="p-2 text-neutral-400 hover:bg-brand-50 hover:text-brand-600 rounded-lg transition-all"
                                  >
                                    <Key className="w-5 h-5" />
                                  </button>
                                  <button 
                                    onClick={() => { setEditingAdmin(admin); setIsAdminModalOpen(true); }}
                                    className="p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 rounded-lg transition-all"
                                  >
                                    <Edit className="w-5 h-5" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteAdmin(admin.id)}
                                    className="p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">No admins found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto">
            <header className="mb-8">
              <h1 className="text-3xl font-display font-bold text-neutral-900">Store Settings</h1>
              <p className="text-neutral-500">Configure your app store's global appearance and behavior.</p>
            </header>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {/* General Settings */}
                <section className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Settings className="w-5 h-5 text-brand-500" />
                    General Information
                  </h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-neutral-700">Store Name</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20"
                          value={settings.store_name}
                          onChange={(e) => setSettings({...settings, store_name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-neutral-700">Contact Email</label>
                        <input 
                          type="email" 
                          className="w-full px-4 py-3 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20"
                          value={settings.contact_email}
                          onChange={(e) => setSettings({...settings, contact_email: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700">Announcement Text</label>
                      <div className="relative">
                        <Bell className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input 
                          type="text" 
                          placeholder="Display a message at the top of the store"
                          className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20"
                          value={settings.announcement_text || ''}
                          onChange={(e) => setSettings({...settings, announcement_text: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700">Footer Text</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-3 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20"
                        value={settings.footer_text || ''}
                        onChange={(e) => setSettings({...settings, footer_text: e.target.value})}
                      />
                    </div>
                  </div>
                </section>

                {/* Appearance Settings */}
                <section className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Palette className="w-5 h-5 text-brand-500" />
                    Appearance
                  </h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700">Store Logo</label>
                      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                        <div className="w-24 h-24 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0 relative group">
                          {settings.store_logo_url ? (
                            <img src={settings.store_logo_url} alt="Logo" className="w-full h-full object-contain" />
                          ) : (
                            <Package className="w-10 h-10 text-neutral-300" />
                          )}
                          {logoUploading && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-3 w-full">
                          <div className="flex gap-2">
                            <label className="flex-1">
                              <div className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer text-center">
                                {logoUploading ? 'Uploading...' : 'Upload Logo'}
                              </div>
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleLogoUpload}
                                disabled={logoUploading}
                              />
                            </label>
                            {settings.store_logo_url && (
                              <button 
                                type="button"
                                onClick={() => setSettings({...settings, store_logo_url: ''})}
                                className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-sm font-semibold transition-colors"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="relative">
                            <input 
                              type="url" 
                              placeholder="Or provide image URL"
                              className="w-full px-4 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 text-xs"
                              value={settings.store_logo_url || ''}
                              onChange={(e) => setSettings({...settings, store_logo_url: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-neutral-700">Primary Brand Color</label>
                      <div className="flex gap-4 items-center">
                        <input 
                          type="color" 
                          className="w-16 h-12 p-1 bg-white border border-neutral-200 rounded-xl cursor-pointer"
                          value={settings.primary_color || '#22c55e'}
                          onChange={(e) => setSettings({...settings, primary_color: e.target.value})}
                        />
                        <input 
                          type="text" 
                          className="flex-1 px-4 py-3 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 font-mono"
                          value={settings.primary_color || '#22c55e'}
                          onChange={(e) => setSettings({...settings, primary_color: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <button 
                  type="button" 
                  onClick={handleSaveSettings}
                  disabled={loading}
                  className="w-full py-4 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-50 shadow-lg shadow-neutral-900/10"
                >
                  {loading ? 'Saving...' : 'Save All Settings'}
                </button>
              </div>

              <div className="space-y-6">
                {/* Status & Controls */}
                <section className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
                  <h2 className="text-xl font-bold">Store Status</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                      <div>
                        <div className="font-semibold text-neutral-900">Maintenance Mode</div>
                        <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">
                          {settings.maintenance_mode ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleToggleSetting('maintenance_mode', !settings.maintenance_mode)}
                        className={`w-12 h-6 rounded-full transition-all relative ${settings.maintenance_mode ? 'bg-amber-500' : 'bg-neutral-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.maintenance_mode ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                      <div>
                        <div className="font-semibold text-neutral-900">User Uploads</div>
                        <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">
                          {settings.allow_user_uploads ? 'Enabled' : 'Disabled'}
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleToggleSetting('allow_user_uploads', !settings.allow_user_uploads)}
                        className={`w-12 h-6 rounded-full transition-all relative ${settings.allow_user_uploads ? 'bg-brand-500' : 'bg-neutral-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.allow_user_uploads ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                  </div>
                </section>

                {/* Authentication Settings */}
                <section className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-brand-500" />
                      Authentication Methods
                    </h2>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                      <div>
                        <div className="font-semibold text-neutral-900">Email & Password</div>
                        <div className="text-xs text-neutral-500">Standard Supabase Auth</div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleToggleSetting('auth_methods', { ...settings.auth_methods, email_password: !settings.auth_methods?.email_password })}
                        className={`w-12 h-6 rounded-full transition-all relative ${settings.auth_methods?.email_password ? 'bg-brand-500' : 'bg-neutral-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.auth_methods?.email_password ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                      <div>
                        <div className="font-semibold text-neutral-900">Google OAuth</div>
                        <div className="text-xs text-neutral-500">Supabase Google Provider</div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleToggleSetting('auth_methods', { ...settings.auth_methods, google_oauth: !settings.auth_methods?.google_oauth })}
                        className={`w-12 h-6 rounded-full transition-all relative ${settings.auth_methods?.google_oauth ? 'bg-brand-500' : 'bg-neutral-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.auth_methods?.google_oauth ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                      <div>
                        <div className="font-semibold text-neutral-900">Biometric Login</div>
                        <div className="text-xs text-neutral-500">Fingerprint / Face ID</div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleToggleSetting('auth_methods', { ...settings.auth_methods, biometric: !settings.auth_methods?.biometric })}
                        className={`w-12 h-6 rounded-full transition-all relative ${settings.auth_methods?.biometric ? 'bg-brand-500' : 'bg-neutral-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.auth_methods?.biometric ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>

                    {/* Custom Auth Providers */}
                    <div className="pt-4 border-t border-neutral-100">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Custom Providers</h3>
                        <button 
                          type="button"
                          onClick={handleAddCustomAuth}
                          className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add Provider
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        {settings.auth_methods?.custom_auth?.map((auth, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white border border-neutral-200 rounded-xl">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                                <ShieldCheck className="w-4 h-4 text-neutral-400" />
                              </div>
                              <span className="font-semibold text-sm">{auth.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <button 
                                type="button"
                                onClick={() => handleToggleCustomAuth(idx)}
                                className={`w-10 h-5 rounded-full transition-all relative ${auth.enabled ? 'bg-brand-500' : 'bg-neutral-300'}`}
                              >
                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${auth.enabled ? 'left-5.5' : 'left-0.5'}`}></div>
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleRemoveCustomAuth(idx)}
                                className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {(!settings.auth_methods?.custom_auth || settings.auth_methods.custom_auth.length === 0) && (
                          <p className="text-xs text-neutral-400 italic text-center py-2">No custom providers added.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Security Section moved to Account tab */}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'account' && (
          <div className="max-w-4xl mx-auto">
            <header className="mb-8">
              <h1 className="text-3xl font-display font-bold text-neutral-900">Account Settings</h1>
              <p className="text-neutral-500">Manage your personal security and authentication settings.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <section className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center">
                      <User className="w-8 h-8 text-neutral-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{currentAdmin?.name}</h2>
                      <p className="text-sm text-neutral-500">{currentAdmin?.email}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        currentAdmin?.role === 'super_admin' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {currentAdmin?.role === 'super_admin' ? 'Super Admin' : 'Editor'}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-brand-500" />
                    Security
                  </h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                      <div>
                        <div className="font-semibold text-neutral-900">Biometric Auth</div>
                        <div className="text-xs text-neutral-500">Enable fingerprint/face ID for this device.</div>
                      </div>
                      <button 
                        type="button"
                        onClick={handleBiometricEnrollment}
                        className="p-2 bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-100 transition-all border border-brand-100"
                      >
                        <Fingerprint className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="pt-4 border-t border-neutral-100">
                      <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-4">Change Password</h3>
                      <form onSubmit={handleChangePassword} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-neutral-500">New Password</label>
                          <input 
                            type="password" 
                            required
                            className="w-full px-4 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 text-sm text-neutral-900"
                            placeholder="At least 6 characters"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-neutral-500">Confirm Password</label>
                          <input 
                            type="password" 
                            required
                            className="w-full px-4 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 text-sm text-neutral-900"
                            placeholder="Repeat new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                          />
                        </div>
                        <button 
                          type="submit"
                          disabled={passwordLoading}
                          className="w-full py-2 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-neutral-800 transition-all disabled:opacity-50"
                        >
                          {passwordLoading ? 'Updating...' : 'Update Password'}
                        </button>
                      </form>
                    </div>
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
                  <h3 className="text-lg font-bold mb-4">Session Information</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-neutral-50">
                      <span className="text-neutral-500">Role</span>
                      <span className="font-medium capitalize">{currentAdmin?.role.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-neutral-50">
                      <span className="text-neutral-500">Status</span>
                      <span className="text-green-600 font-medium capitalize">{currentAdmin?.status}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-neutral-50">
                      <span className="text-neutral-500">Member Since</span>
                      <span className="font-medium">{currentAdmin && new Date(currentAdmin.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </section>
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
                {editingApp ? 'Edit Application' : 'Upload New Application'}
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
                  <label className="text-sm font-semibold text-neutral-700">Developer</label>
                  <select 
                    name="developer_id" 
                    className="w-full px-4 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-500/20"
                    defaultValue={editingApp?.developer_id}
                  >
                    <option value="">Independent / System</option>
                    {developers.map(dev => (
                      <option key={dev.id} value={dev.id}>{dev.name}</option>
                    ))}
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
                        <img 
                          src={iconPreview || editingApp?.icon_url} 
                          alt="Preview" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Palette className="w-6 h-6 text-neutral-300" />
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

      {/* Modal for Version History */}
      {isHistoryModalOpen && selectedAppForHistory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
              <div className="flex items-center gap-4">
                <img src={selectedAppForHistory.icon_url} alt="" className="w-12 h-12 rounded-xl object-cover" referrerPolicy="no-referrer" />
                <div>
                  <h2 className="text-2xl font-display font-bold">{selectedAppForHistory.name}</h2>
                  <p className="text-sm text-neutral-500">Version History</p>
                </div>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-neutral-200 rounded-full transition-colors">
                <XCircle className="w-6 h-6 text-neutral-400" />
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {historyLoading ? (
                <div className="py-12 text-center text-neutral-500 italic">Loading history...</div>
              ) : appVersions.length > 0 ? (
                <div className="space-y-6">
                  {appVersions.map((version, index) => (
                    <div key={version.id} className="relative pl-8 border-l-2 border-neutral-100 pb-6 last:pb-0">
                      <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${index === 0 ? 'bg-brand-500' : 'bg-neutral-300'}`}></div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-lg font-bold text-neutral-900">v{version.version}</span>
                          {index === 0 && <span className="ml-2 px-2 py-0.5 bg-brand-100 text-brand-700 text-[10px] font-bold rounded-full uppercase">Current</span>}
                          <div className="text-xs text-neutral-400 mt-0.5">{new Date(version.created_at).toLocaleString()}</div>
                        </div>
                        <div className="flex gap-2">
                          <a 
                            href={version.apk_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-lg text-xs font-semibold hover:bg-neutral-200 transition-colors"
                          >
                            Download APK
                          </a>
                          {index !== 0 && (
                            <button 
                              onClick={() => handleRollback(version)}
                              className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-200 transition-colors flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Rollback
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                        <p className="text-sm text-neutral-600 whitespace-pre-wrap">{version.release_notes || 'No release notes provided.'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-neutral-500">No version history found for this app.</div>
              )}
            </div>
            
            <div className="p-6 border-t border-neutral-200 bg-neutral-50 flex justify-end">
              <button 
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-8 py-2 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-all"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal for Developer Add/Edit */}
      {isDevModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl"
          >
            <div className="p-8 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
              <div>
                <h2 className="text-2xl font-display font-bold text-neutral-900">
                  {editingDev ? 'Edit Developer' : 'Add New Developer'}
                </h2>
                <p className="text-sm text-neutral-500">
                  {editingDev ? 'Update developer profile and permissions.' : 'Create a new developer account for the store.'}
                </p>
              </div>
              <button onClick={() => { setIsDevModalOpen(false); setEditingDev(null); setDevAvatarPreview(null); }} className="p-2 hover:bg-neutral-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>
            <form onSubmit={handleSaveDeveloper} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-32 h-32 rounded-full bg-neutral-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center relative group">
                      {devAvatarPreview || editingDev?.avatar_url ? (
                        <img 
                          src={devAvatarPreview || editingDev?.avatar_url} 
                          alt="Avatar" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                      <User className="w-12 h-12 text-neutral-300" />
                    )}
                    <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Upload className="w-6 h-6 text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleDevAvatarChange} />
                    </label>
                  </div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Developer Avatar</span>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Full Name</label>
                      <input name="name" type="text" required placeholder="e.g. John Doe" className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all text-neutral-900" defaultValue={editingDev?.name} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Email Address</label>
                      <input name="email" type="email" required placeholder="john@example.com" className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all text-neutral-900" defaultValue={editingDev?.email} />
                    </div>
                  </div>
                </div>
              </div>
              
              {!editingDev && (
                <div className="p-6 bg-brand-50 rounded-3xl border border-brand-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-bold text-brand-900">Create Auth Account</label>
                      <p className="text-xs text-brand-700">Automatically create a login account for this developer.</p>
                    </div>
                    <input name="create_auth" type="checkbox" className="w-6 h-6 accent-brand-500 rounded-lg" defaultChecked />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-900 uppercase tracking-wider">Set Initial Password</label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400" />
                      <input name="password" type="password" placeholder="Min 6 characters" className="w-full pl-11 pr-4 py-3 bg-white border border-brand-200 rounded-2xl text-sm focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all" />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Company / Studio</label>
                  <input name="company" type="text" placeholder="Optional" className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all text-neutral-900" defaultValue={editingDev?.company} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Role / Title</label>
                  <input name="role" type="text" placeholder="e.g. Lead Developer" className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all text-neutral-900" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Developer Bio</label>
                <textarea name="bio" rows={3} placeholder="Tell us about this developer..." className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all resize-none text-neutral-900" defaultValue={editingDev?.bio}></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button type="button" onClick={() => { setIsDevModalOpen(false); setEditingDev(null); setDevAvatarPreview(null); }} className="px-8 py-3 text-neutral-500 font-bold hover:text-neutral-700 transition-colors">Cancel</button>
                <button type="submit" className="px-10 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-900/10 active:scale-95">
                  {editingDev ? 'Save Changes' : 'Create Developer'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetPasswordModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-neutral-200"
          >
            <div className="p-6 md:p-8 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
              <div>
                <h2 className="text-2xl md:text-3xl font-display font-bold text-neutral-900">Reset Password</h2>
                <p className="text-sm text-neutral-500 mt-1">
                  Manage access for <strong>{
                    resetTargetType === 'developer' 
                      ? developers.find(d => d.id === resetTargetId)?.name 
                      : admins.find(a => a.id === resetTargetId)?.name
                  }</strong>
                </p>
              </div>
              <button onClick={() => { setIsResetPasswordModalOpen(false); setResetTargetId(null); setResetSuccessTarget(null); }} className="p-2 hover:bg-neutral-200 rounded-full transition-colors">
                <XCircle className="w-7 h-7 text-neutral-400" />
              </button>
            </div>
            
            <div className="p-6 md:p-8 space-y-6 max-h-[85vh] overflow-y-auto">
              {resetSuccessTarget && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-500 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-emerald-900">Password Reset Successful!</h3>
                      <p className="text-sm text-emerald-700 mt-1">
                        The password is now <span className="font-mono font-bold bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-900">123456</span>. 
                        If the automatic notification failed, you can send it manually.
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleSendManualResetEmail(resetSuccessTarget)}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                  >
                    <Mail className="w-4 h-4" />
                    Send Notification Email Manually
                  </button>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: Magic Link */}
                <div className="group p-5 bg-indigo-50/50 rounded-3xl border border-indigo-100 hover:border-indigo-300 transition-all flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-indigo-900">Send Magic Link</h3>
                      <p className="text-xs text-indigo-700 leading-relaxed mt-1">
                        Sends a secure reset link directly to their inbox. Best for production environments.
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={handleSendResetEmail}
                    disabled={isResetting}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md shadow-indigo-600/10 active:scale-[0.98]"
                  >
                    {isResetting ? 'Sending...' : 'Send Magic Link'}
                  </button>
                </div>

                {/* Option 2: Default Password */}
                <div className="group p-5 bg-amber-50/50 rounded-3xl border border-amber-100 hover:border-amber-300 transition-all flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform">
                      <RotateCcw className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-amber-900">Reset to Default</h3>
                      <p className="text-xs text-amber-700 leading-relaxed mt-1">
                        Instantly sets password to <span className="font-mono font-bold">123456</span>. Quickest for testing.
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={handleResetToDefault}
                    disabled={isResetting}
                    className="w-full py-3 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-all disabled:opacity-50 shadow-md shadow-amber-600/10 active:scale-[0.98]"
                  >
                    {isResetting ? 'Resetting...' : 'Reset to 123456'}
                  </button>
                </div>
              </div>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-200"></div></div>
                <div className="relative flex justify-center text-xs uppercase font-bold tracking-widest"><span className="bg-white px-4 text-neutral-400">Or Set Manually</span></div>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4 bg-neutral-50 p-6 rounded-3xl border border-neutral-100">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">New Secure Password</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input 
                      type="password" 
                      required 
                      minLength={6}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-neutral-200 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all text-neutral-900" 
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="Enter at least 6 characters"
                    />
                  </div>
                  <p className="text-[10px] text-neutral-400 italic mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Manual reset uses administrative privileges.
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => { setIsResetPasswordModalOpen(false); setResetTargetId(null); setResetSuccessTarget(null); }} 
                    className="w-full sm:w-auto px-8 py-3 text-neutral-500 font-bold hover:text-neutral-700 transition-colors"
                  >
                    {resetSuccessTarget ? 'Close' : 'Cancel'}
                  </button>
                  <button 
                    type="submit" 
                    disabled={isResetting}
                    className="w-full sm:w-auto px-10 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-50 shadow-xl shadow-neutral-900/10 active:scale-[0.98]"
                  >
                    {isResetting ? 'Processing...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal for Admin Add/Edit */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl"
          >
            <div className="p-8 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
              <div>
                <h2 className="text-2xl font-display font-bold text-neutral-900">
                  {editingAdmin ? 'Edit Admin' : 'Add New Admin'}
                </h2>
                <p className="text-sm text-neutral-500">
                  {editingAdmin ? 'Update admin profile and permissions.' : 'Create a new administrator account for the store.'}
                </p>
              </div>
              <button onClick={() => { setIsAdminModalOpen(false); setEditingAdmin(null); }} className="p-2 hover:bg-neutral-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>
            <form onSubmit={handleSaveAdmin} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Full Name</label>
                  <input name="name" type="text" required placeholder="e.g. John Doe" className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all text-neutral-900" defaultValue={editingAdmin?.name} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Email Address</label>
                  <input name="email" type="email" required placeholder="john@example.com" className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all text-neutral-900" defaultValue={editingAdmin?.email} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Role</label>
                <select name="role" className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all text-neutral-900" defaultValue={editingAdmin?.role || 'editor'}>
                  <option value="editor">Editor</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              
              {!editingAdmin && (
                <div className="p-6 bg-brand-50 rounded-3xl border border-brand-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-bold text-brand-900">Create Auth Account</label>
                      <p className="text-xs text-brand-700">Automatically create a login account for this admin.</p>
                    </div>
                    <input name="create_auth" type="checkbox" className="w-6 h-6 accent-brand-500 rounded-lg" defaultChecked />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-900 uppercase tracking-wider">Set Initial Password</label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400" />
                      <input name="password" type="password" placeholder="Min 6 characters (Default: 123456)" className="w-full pl-11 pr-4 py-3 bg-white border border-brand-200 rounded-2xl text-sm focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all text-neutral-900" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6">
                <button type="button" onClick={() => { setIsAdminModalOpen(false); setEditingAdmin(null); }} className="px-8 py-3 text-neutral-500 font-bold hover:text-neutral-700 transition-colors">Cancel</button>
                <button type="submit" className="px-10 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-900/10 active:scale-95">
                  {editingAdmin ? 'Save Changes' : 'Create Admin'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Compare Changes Modal */}
      {isCompareModalOpen && comparingApp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="p-8 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
              <div>
                <h2 className="text-2xl font-display font-bold text-neutral-900">Compare Changes</h2>
                <p className="text-sm text-neutral-500">Review the differences between the live version and the pending update.</p>
              </div>
              <button onClick={() => { setIsCompareModalOpen(false); setComparingApp(null); }} className="p-2 hover:bg-neutral-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Current Version */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-neutral-100">
                    <div className="px-3 py-1 bg-neutral-100 text-neutral-600 rounded-full text-[10px] font-bold uppercase tracking-wider">Current Live Version</div>
                    <span className="text-sm font-bold text-neutral-900">v{comparingApp.version}</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <img src={comparingApp.icon_url} alt="" className="w-16 h-16 rounded-2xl object-cover shadow-sm" referrerPolicy="no-referrer" />
                      <div>
                        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">App Name</div>
                        <div className="font-bold text-neutral-900">{comparingApp.name}</div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Description</div>
                      <p className="text-sm text-neutral-600 leading-relaxed">{comparingApp.description}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Category</div>
                        <div className="text-sm text-neutral-900">{comparingApp.category}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Size</div>
                        <div className="text-sm text-neutral-900">{comparingApp.size}</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Screenshots</div>
                      <div className="flex flex-wrap gap-2">
                        {comparingApp.screenshots?.map((url, i) => (
                          <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-neutral-100" referrerPolicy="no-referrer" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pending Update */}
                <div className="space-y-6 bg-indigo-50/30 p-6 rounded-[2rem] border border-indigo-100/50">
                  <div className="flex items-center gap-3 pb-4 border-b border-indigo-100">
                    <div className="px-3 py-1 bg-indigo-500 text-white rounded-full text-[10px] font-bold uppercase tracking-wider">Pending Update</div>
                    <span className="text-sm font-bold text-indigo-600">v{comparingApp.pending_update?.version}</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <img src={comparingApp.pending_update?.icon_url || comparingApp.icon_url} alt="" className={`w-16 h-16 rounded-2xl object-cover shadow-sm ${comparingApp.pending_update?.icon_url && comparingApp.pending_update.icon_url !== comparingApp.icon_url ? 'ring-2 ring-indigo-500' : ''}`} referrerPolicy="no-referrer" />
                      <div>
                        <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">App Name</div>
                        <div className={`font-bold ${comparingApp.pending_update?.name !== comparingApp.name ? 'text-indigo-600' : 'text-neutral-900'}`}>
                          {comparingApp.pending_update?.name || comparingApp.name}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Description</div>
                      <p className={`text-sm leading-relaxed ${comparingApp.pending_update?.description !== comparingApp.description ? 'text-indigo-600 font-medium' : 'text-neutral-600'}`}>
                        {comparingApp.pending_update?.description || comparingApp.description}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Category</div>
                        <div className={`text-sm ${comparingApp.pending_update?.category !== comparingApp.category ? 'text-indigo-600 font-bold' : 'text-neutral-900'}`}>
                          {comparingApp.pending_update?.category || comparingApp.category}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Size</div>
                        <div className={`text-sm ${comparingApp.pending_update?.size !== comparingApp.size ? 'text-indigo-600 font-bold' : 'text-neutral-900'}`}>
                          {comparingApp.pending_update?.size || comparingApp.size}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Screenshots</div>
                      <div className="flex flex-wrap gap-2">
                        {(comparingApp.pending_update?.screenshots || comparingApp.screenshots)?.map((url, i) => {
                          const isNew = comparingApp.pending_update?.screenshots && !comparingApp.screenshots?.includes(url);
                          return (
                            <div key={i} className="relative">
                              <img src={url} alt="" className={`w-16 h-16 rounded-lg object-cover border ${isNew ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-neutral-100'}`} referrerPolicy="no-referrer" />
                              {isNew && <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white"></div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {comparingApp.pending_update?.release_notes && (
                      <div className="mt-4 p-4 bg-white rounded-2xl border border-indigo-100">
                        <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Release Notes</div>
                        <p className="text-sm text-neutral-700 italic">"{comparingApp.pending_update.release_notes}"</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex justify-end gap-3">
              <button 
                onClick={() => { setIsCompareModalOpen(false); setComparingApp(null); }}
                className="px-8 py-3 text-neutral-500 font-bold hover:text-neutral-700 transition-colors"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  handleStatusChange(comparingApp.id, 'rejected');
                  setIsCompareModalOpen(false);
                  setComparingApp(null);
                }}
                className="px-8 py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                Reject Update
              </button>
              <button 
                onClick={() => {
                  handleStatusChange(comparingApp.id, 'published');
                  setIsCompareModalOpen(false);
                  setComparingApp(null);
                }}
                className="px-10 py-3 bg-brand-500 text-white rounded-2xl font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20"
              >
                Approve & Publish
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      <AnimatePresence>
        {rejectionModal.isOpen && (
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
                <h3 className="text-2xl font-display font-bold text-neutral-900 mb-2">Reject Application</h3>
                <p className="text-neutral-500 mb-6">
                  Please provide a reason for rejecting <span className="font-semibold text-neutral-900">"{rejectionModal.appName}"</span> (v{rejectionModal.version}).
                </p>
                
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  className="w-full h-32 p-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all resize-none mb-6"
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setRejectionModal({ ...rejectionModal, isOpen: false });
                      setRejectionReason('');
                    }}
                    className="flex-1 py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      await processStatusChange(rejectionModal.appId, 'rejected', rejectionReason);
                      setRejectionModal({ ...rejectionModal, isOpen: false });
                      setRejectionReason('');
                    }}
                    disabled={!rejectionReason.trim()}
                    className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reject App
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      <LoadingOverlay isLoading={loading} message="Processing..." />
    </div>
  );
};
