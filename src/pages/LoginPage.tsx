import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Lock, Mail, ArrowRight, ArrowLeft, ShieldCheck, AlertCircle, Fingerprint, Chrome, User, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, syncToGoogleSheet } from '../lib/supabase';
import { base64ToBuffer, generateRandomChallenge } from '../lib/webauthn';
import { StoreSettings } from '../types';
import { ModernDialog, DialogType } from '../components/ModernDialog';
import { LoadingOverlay } from '../components/LoadingOverlay';

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') as 'admin' | 'developer' || 'admin';
  const [role, setRole] = useState<'admin' | 'developer'>(initialRole);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [failedAttemptsMap, setFailedAttemptsMap] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('nexus_failed_attempts_map');
    return saved ? JSON.parse(saved) : {};
  });
  const [lockoutMap, setLockoutMap] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('nexus_lockout_map');
    return saved ? JSON.parse(saved) : {};
  });
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: DialogType;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);

  // 3D Tilt Effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  useEffect(() => {
    localStorage.setItem('nexus_failed_attempts_map', JSON.stringify(failedAttemptsMap));
  }, [failedAttemptsMap]);

  useEffect(() => {
    localStorage.setItem('nexus_lockout_map', JSON.stringify(lockoutMap));
  }, [lockoutMap]);

  const showDialog = (title: string, message: string, type: DialogType = 'info') => {
    setDialog(prev => ({ ...prev, isOpen: true, title, message, type }));
  };

  useEffect(() => {
    // Check if biometric auth is supported
    if (window.PublicKeyCredential) {
      setIsBiometricSupported(true);
    }
    fetchSettings();

    // Check for recovery flow in URL hash
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setIsUpdateMode(true);
      showDialog('Security Verification', 'Recovery link verified. Please enter your new secure password below.', 'success');
    }
  }, []);

  useEffect(() => {
    // Check for session after Google redirect
    const handleAuthCallback = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && searchParams.get('auth_callback')) {
        const user = session.user;
        const targetRole = searchParams.get('role') as 'admin' | 'developer';
        const authMode = searchParams.get('mode') as 'login' | 'signup';

        try {
          // Check if user is a developer
          const { data: devData, error: devError } = await supabase
            .from('developers')
            .select('id, status')
            .eq('user_id', user.id)
            .single();

          if (devError && devError.code === 'PGRST205') {
            throw new Error('Database table "developers" not found. Please contact the administrator to run the SQL setup script.');
          }

          // Check if user is an admin
          const { data: adminData, error: adminError } = await supabase
            .from('admins')
            .select('id, status')
            .eq('user_id', user.id)
            .single();

          if (adminError && adminError.code === 'PGRST205') {
            throw new Error('Database table "admins" not found. Please contact the administrator to run the SQL setup script.');
          }

          if (targetRole === 'developer') {
            if (adminData) {
              showDialog('Unauthorized', 'Admin accounts are not authorized to access the Developer Portal.', 'blocked');
              await supabase.auth.signOut();
              return;
            }

            if (!devData) {
              // Create developer record for new Google signup
              const { error: devError } = await supabase.from('developers').insert([{
                user_id: user.id,
                name: user.user_metadata.full_name || user.email?.split('@')[0],
                email: user.email,
                status: 'pending'
              }]);

              if (devError) console.error('Error creating developer record:', devError);

              // Sync to Google Sheets
              await syncToGoogleSheet({
                type: 'developer_signup',
                email: user.email,
                name: user.user_metadata.full_name || user.email?.split('@')[0],
                status: 'pending',
                source: 'google_oauth'
              });

              showDialog('Registration Pending', 'Your developer account has been created. Please wait for administrator approval.', 'pending');
            } else if (devData.status !== 'approved') {
              showDialog('Account Pending', `Your account is ${devData.status}. Please wait for administrator approval.`, 'pending');
              await supabase.auth.signOut();
              return;
            } else {
              await syncToGoogleSheet({ type: 'login', email: user.email, role: 'developer', source: 'google_oauth' });
              navigate('/developer');
            }
          } else {
            // Admin role check
            if (devData) {
              showDialog('Unauthorized', 'Developer accounts are not authorized to access the Admin Portal.', 'blocked');
              await supabase.auth.signOut();
              return;
            }

            if (!adminData) {
              // Check if this is a super admin
              const superAdmins = ['nexus.apphub@gmail.com', 'mrdarpon@gmail.com'];
              if (superAdmins.includes(user.email || '')) {
                const { error: adminError } = await supabase.from('admins').insert([{
                  user_id: user.id,
                  name: user.user_metadata.full_name || (user.email === 'mrdarpon@gmail.com' ? 'Darpon Admin' : 'Super Admin'),
                  email: user.email,
                  role: 'super_admin',
                  status: 'active'
                }]);
                if (adminError) console.error('Error creating super admin:', adminError);
              } else if (authMode === 'signup') {
                // Allow signup via Google for admins, but they stay inactive
                const { error: adminError } = await supabase.from('admins').insert([{
                  user_id: user.id,
                  name: user.user_metadata.full_name || user.email?.split('@')[0],
                  email: user.email,
                  role: 'editor',
                  status: 'inactive'
                }]);

                if (adminError) console.error('Error creating admin record:', adminError);

                showDialog('Admin Pending', 'Your admin account has been created and is pending approval. Please contact the super administrator.', 'pending');
                await supabase.auth.signOut();
                return;
              } else {
                // Reject Google login if not already registered as admin
                showDialog('Not Registered', 'This account is not registered as an administrator. Only pre-registered admins can login via Google.', 'unregistered');
                await supabase.auth.signOut();
                return;
              }
            } else if (adminData.status !== 'active') {
              showDialog('Account Inactive', `Your admin account is ${adminData.status}. Please contact the super administrator.`, 'blocked');
              await supabase.auth.signOut();
              return;
            }

            await syncToGoogleSheet({ type: 'login', email: user.email, role: 'admin', source: 'google_oauth' });
            navigate('/admin');
          }
        } catch (err: any) {
          console.error('Auth callback error:', err);
          showDialog('Auth Error', err.message || 'Failed to process login.', 'error');
        }
      }
    };

    handleAuthCallback();
  }, [searchParams]);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('settings').select('*').eq('id', 'main').single();
      if (data) setSettings(data);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login?role=${role}&auth_callback=true&mode=${mode}`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      showDialog('Google Login Failed', err.message || 'Google login failed. Please ensure Google OAuth is enabled in your Supabase dashboard.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    try {
      const storedCredJson = localStorage.getItem('nexus_biometric_cred');
      
      if (!storedCredJson) {
        throw new Error('No biometric enrollment found. Please sign in with password first to enroll.');
      }

      const storedCred = JSON.parse(storedCredJson);
      const challenge = generateRandomChallenge();

      const options: PublicKeyCredentialRequestOptions = {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [{
          id: base64ToBuffer(storedCred.credentialId),
          type: "public-key",
        }],
        userVerification: "required",
        timeout: 60000,
      };

      const assertion = (await navigator.credentials.get({
        publicKey: options,
      })) as PublicKeyCredential;

      if (!assertion) throw new Error('Biometric verification failed');

      localStorage.setItem('nexus_demo_session', 'true');
      if (role === 'developer') {
        navigate('/developer');
      } else {
        navigate('/admin');
      }
    } catch (err: any) {
      console.error('Biometric login error:', err);
      if (err.name === 'NotAllowedError') {
        showDialog('Cancelled', 'Biometric verification cancelled.', 'info');
      } else {
        showDialog('Biometric Error', err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    showDialog(
      'Official Security Notice', 
      'If you have forgotten your password, please contact our administrative team at nexus.apphub@gmail.com. To proceed with a password reset, you are required to provide necessary identification documents for verification. Our security team will review your request and assist you with the recovery process.', 
      'blocked'
    );
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showDialog('Invalid Password', 'Password must be at least 6 characters long.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      showDialog('Password Updated', 'Your password has been successfully reset. You can now log in with your new credentials.', 'success');
      setIsUpdateMode(false);
      setNewPassword('');
    } catch (err: any) {
      console.error('Update password error:', err);
      showDialog('Update Failed', err.message || 'Failed to update password. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for lockout for this specific email
    const userLockoutUntil = lockoutMap[email];
    if (userLockoutUntil && Date.now() < userLockoutUntil) {
      const remainingMinutes = Math.ceil((userLockoutUntil - Date.now()) / (60 * 1000));
      showDialog(
        'Access Temporarily Blocked',
        `Too many failed attempts for this email. For security reasons, access for ${email} has been temporarily suspended. Please try again in ${remainingMinutes} minutes.`,
        'blocked'
      );
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        try {
          // Use the appropriate signup endpoint or fallback
          const endpoint = role === 'admin' ? '/api/auth/admin-signup' : '/api/auth/developer-signup';
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
          });

          const contentType = response.headers.get("content-type");
          if (response.ok && contentType && contentType.includes("application/json")) {
            const result = await response.json();
            setLoading(false);
            showDialog('Thanks for your application!', 'Your developer account request has been submitted. Please email our admin portal at nexus.apphub@gmail.com for requesting your account approval.', 'success');
            setMode('login');
            return;
          } else {
            // Fallback for static hosting
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email,
              password,
              options: { data: { full_name: name } }
            });

            if (signUpError) throw signUpError;

            if (signUpData.user) {
              if (role === 'developer') {
                await supabase.from('developers').insert([{
                  user_id: signUpData.user.id,
                  name,
                  email,
                  status: 'pending'
                }]);
              } else {
                // Admin signup
                const superAdmins = ['nexus.apphub@gmail.com', 'mrdarpon@gmail.com'];
                const isSuperAdmin = superAdmins.includes(email);
                
                await supabase.from('admins').insert([{
                  user_id: signUpData.user.id,
                  name,
                  email,
                  role: isSuperAdmin ? 'super_admin' : 'editor',
                  status: isSuperAdmin ? 'active' : 'inactive'
                }]);
              }
              
              await syncToGoogleSheet({
                type: `${role}_signup`,
                email,
                name,
                status: role === 'admin' ? 'inactive' : 'pending',
                source: 'client_fallback'
              });

              setLoading(false);
              showDialog('Thanks for your application!', 'Your developer account request has been submitted. Please email our admin portal at nexus.apphub@gmail.com for requesting your account approval.', 'success');
              setMode('login');
              return;
            }
          }
        } catch (fetchError) {
          console.error('API Signup failed, trying client-side fallback:', fetchError);
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } }
          });
          if (signUpError) throw signUpError;
          if (signUpData.user) {
            if (role === 'developer') {
              await supabase.from('developers').insert([{
                user_id: signUpData.user.id,
                name,
                email,
                status: 'pending'
              }]);
            } else {
              // Admin signup
              const superAdmins = ['nexus.apphub@gmail.com', 'mrdarpon@gmail.com'];
              const isSuperAdmin = superAdmins.includes(email);

              await supabase.from('admins').insert([{
                user_id: signUpData.user.id,
                name,
                email,
                role: isSuperAdmin ? 'super_admin' : 'editor',
                status: isSuperAdmin ? 'active' : 'inactive'
              }]);
            }
            await syncToGoogleSheet({
              type: `${role}_signup`,
              email,
              name,
              status: role === 'admin' ? 'inactive' : 'pending',
              source: 'client_fallback'
            });
            setLoading(false);
            showDialog('Thanks for your application!', 'Your developer account request has been submitted. Please email our admin portal at nexus.apphub@gmail.com for requesting your account approval.', 'success');
            setMode('login');
            return;
          }
        }
      } else {
        const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          if (authError.message === 'Invalid login credentials') {
            const currentAttempts = failedAttemptsMap[email] || 0;
            const newAttempts = currentAttempts + 1;
            
            setFailedAttemptsMap(prev => ({ ...prev, [email]: newAttempts }));
            
            if (newAttempts >= 6) {
              const lockoutTime = Date.now() + 30 * 60 * 1000;
              setLockoutMap(prev => ({ ...prev, [email]: lockoutTime }));
              setFailedAttemptsMap(prev => ({ ...prev, [email]: 0 }));
              showDialog(
                'Security Lockout',
                `Maximum login attempts exceeded for ${email}. Access for this email has been suspended for 30 minutes for security purposes.`,
                'blocked'
              );
            } else if (newAttempts >= 3) {
              showDialog(
                'Official Security Notice', 
                'If you have forgotten your password, please contact our administrative team at nexus.apphub@gmail.com. To proceed with a password reset, you are required to provide necessary identification documents for verification. Our security team will review your request and assist you with the recovery process.', 
                'blocked'
              );
            } else {
              showDialog('Authentication Failed', `Invalid email or password. Please verify your credentials and try again. (Attempt ${newAttempts}/6 for this email)`, 'auth-error');
            }
            return;
          }
          if (authError.message === 'Email not confirmed') {
            showDialog('Email Not Confirmed', 'Your email address has not been confirmed yet. Please check your inbox for a confirmation link.', 'warning');
            return;
          }
          throw authError;
        }

        const user = signInData.user;

        if (role === 'developer') {
          // Check if user is an admin trying to login as developer
          const { data: adminCheck } = await supabase.from('admins').select('id').eq('user_id', user.id).single();
          if (adminCheck) {
            showDialog('Unauthorized', 'Admin accounts are not authorized to access the Developer Portal.', 'blocked');
            await supabase.auth.signOut();
            return;
          }

          const { data: devData, error: devError } = await supabase
            .from('developers')
            .select('id, status')
            .eq('user_id', user.id)
            .single();
          
          if (devError || !devData) {
            // Try to link by email if user_id is missing
            const { data: devByEmail } = await supabase
              .from('developers')
              .select('id, status')
              .eq('email', email)
              .single();
            
            if (devByEmail) {
              if (devByEmail.status !== 'approved') {
                showDialog('Account Pending', `Your account is ${devByEmail.status}. Please wait for administrator approval.`, 'pending');
                await supabase.auth.signOut();
                return;
              }
              await supabase.from('developers').update({ user_id: user.id }).eq('id', devByEmail.id);
              navigate('/developer');
              return;
            }
            
            showDialog('Not Registered', 'This account is not registered as a developer profile. Please contact the administrator.', 'unregistered');
            await supabase.auth.signOut();
            return;
          }

          if (devData.status !== 'approved') {
            showDialog('Account Pending', `Your account is ${devData.status}. Please wait for administrator approval.`, 'pending');
            await supabase.auth.signOut();
            return;
          }

          await syncToGoogleSheet({ type: 'login', email, role: 'developer' });
          localStorage.removeItem('nexus_demo_session');
          navigate('/developer');
        } else {
          // Admin check - prevent developers from accessing admin portal
          const { data: devData } = await supabase
            .from('developers')
            .select('id')
            .eq('user_id', user.id)
            .single();
          
          if (devData) {
            showDialog('Unauthorized', 'Developer accounts are not authorized to access the Admin Portal.', 'blocked');
            await supabase.auth.signOut();
            return;
          }

          // Check if user is in admins table
          const { data: adminData, error: adminError } = await supabase
            .from('admins')
            .select('id, status')
            .eq('user_id', user.id)
            .single();

          if (adminError || !adminData) {
            // Special case for super admin emails if not in table yet
            const superAdmins = ['nexus.apphub@gmail.com', 'mrdarpon@gmail.com'];
            if (superAdmins.includes(email)) {
              await supabase.from('admins').insert([{
                user_id: user.id,
                name: email === 'mrdarpon@gmail.com' ? 'Darpon Admin' : 'Super Admin',
                email: email,
                role: 'super_admin',
                status: 'active'
              }]);
            } else {
              showDialog('Unauthorized', 'This account is not authorized to access the Admin Portal.', 'blocked');
              await supabase.auth.signOut();
              return;
            }
          } else if (adminData.status !== 'active') {
            const superAdmins = ['nexus.apphub@gmail.com', 'mrdarpon@gmail.com'];
            if (superAdmins.includes(email)) {
              // Auto-activate super admin if they were inactive
              await supabase.from('admins').update({ status: 'active' }).eq('id', adminData.id);
            } else {
              showDialog('Account Inactive', `Your admin account is ${adminData.status}. Please contact the super administrator.`, 'blocked');
              await supabase.auth.signOut();
              return;
            }
          }

          await syncToGoogleSheet({ type: 'login', email, role: 'admin' });
          navigate('/admin');
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      showDialog('Authentication Failed', err.message || 'Authentication failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center px-6 relative overflow-hidden transition-colors duration-300">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-brand-500/10 blur-[150px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, var(--text-main) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      {/* Back Button */}
      <motion.button 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 md:top-10 md:left-10 flex items-center gap-3 text-neutral-500 hover:text-brand-500 transition-all group z-30"
        title="Back to Home"
      >
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-brand-500 group-hover:border-brand-500 group-hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all duration-500">
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </div>
      </motion.button>

      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md relative z-20"
      >
        {/* Floating Animation Wrapper */}
        <motion.div
          animate={{
            y: [0, -10, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative"
        >
          {/* Card Glow Background */}
          <div className="absolute -inset-1 bg-gradient-to-r from-brand-500/20 to-blue-500/20 rounded-[2.5rem] blur-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>

          <div className="bg-[var(--card-bg)] backdrop-blur-2xl p-8 md:p-10 rounded-[2.5rem] border border-[var(--card-border)] shadow-[0_20px_50px_rgba(0,0,0,0.2)] relative overflow-hidden group transition-colors duration-300">
            {/* Digital Scanline Effect */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>

            <div className="text-center mb-10 relative">
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-brand-500 to-brand-600 rounded-3xl mb-6 shadow-[0_10px_30px_rgba(34,197,94,0.4)] relative group"
              >
                <ShieldCheck className="w-10 h-10 text-white" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-400 rounded-full border-2 border-[var(--card-bg)] animate-ping"></div>
              </motion.div>
              
              <h1 className="text-4xl font-display font-black text-[var(--text-main)] mb-3 tracking-tight">
                {role === 'admin' ? 'Admin Login' : 'Developer Login'}
              </h1>
              <div className="flex items-center justify-center gap-2 text-[var(--text-main)] opacity-60">
                <Sparkles className="w-4 h-4 text-brand-500" />
                <p className="text-sm font-medium uppercase tracking-[0.2em]">
                  {role === 'admin' ? 'Secure Access' : 'Developer Hub'}
                </p>
              </div>
            </div>

            {/* Role Switcher - Modern Digital Style */}
            <div className="flex p-1.5 bg-neutral-100 dark:bg-white/5 rounded-2xl mb-10 border border-[var(--card-border)] relative">
              <div 
                className={`absolute inset-y-1.5 w-[calc(50%-6px)] bg-brand-500 rounded-xl transition-all duration-500 ease-out shadow-[0_0_20px_rgba(34,197,94,0.3)] ${role === 'developer' ? 'translate-x-[calc(100%+6px)]' : 'translate-x-0'}`}
              />
              <button 
                onClick={() => setRole('admin')}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest relative z-10 transition-colors duration-300 ${role === 'admin' ? 'text-white' : ''}`}
                style={role !== 'admin' ? { color: 'var(--text-main)', opacity: 0.8 } : {}}
              >
                Admin
              </button>
              <button 
                onClick={() => setRole('developer')}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest relative z-10 transition-colors duration-300 ${role === 'developer' ? 'text-white' : ''}`}
                style={role !== 'developer' ? { color: 'var(--text-main)', opacity: 0.8 } : {}}
              >
                Developer
              </button>
            </div>

            {settings?.auth_methods?.email_password !== false && (
              <form onSubmit={isUpdateMode ? handleUpdatePassword : handleAuth} className="space-y-6">
                {isUpdateMode ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1" style={{ color: 'var(--text-main)', opacity: 0.7 }}>New Password</label>
                      <div className="relative group/input">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-600 group-focus-within/input:text-brand-500 transition-colors w-5 h-5" />
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          className="w-full pl-12 pr-12 py-4 bg-neutral-50 dark:bg-white/5 border border-[var(--card-border)] rounded-2xl text-[var(--text-main)] placeholder:text-neutral-400 dark:placeholder:text-neutral-700 focus:outline-none focus:border-brand-500/50 focus:ring-4 focus:ring-brand-500/10 transition-all font-medium"
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          style={{ color: 'var(--text-main)' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-600 hover:text-[var(--text-main)] transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={loading}
                      className="w-full py-5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-[0_10px_30px_rgba(34,197,94,0.3)] transition-all flex items-center justify-center group relative overflow-hidden"
                    >
                      <span className="relative z-10">{loading ? 'Updating...' : 'Update Password'}</span>
                      {!loading && <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform relative z-10" />}
                    </motion.button>
                    <button
                      type="button"
                      onClick={() => setIsUpdateMode(false)}
                      className="w-full text-xs font-bold text-neutral-500 hover:text-brand-500 transition-colors uppercase tracking-widest"
                    >
                      Back to Login
                    </button>
                  </div>
                ) : (
                  <>
                    {mode === 'signup' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1" style={{ color: 'var(--text-main)', opacity: 0.7 }}>Full Name</label>
                        <div className="relative group/input">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-600 group-focus-within/input:text-brand-500 transition-colors w-5 h-5" />
                          <input
                            type="text"
                            required
                            className="w-full pl-12 pr-4 py-4 bg-neutral-50 dark:bg-white/5 border border-[var(--card-border)] rounded-2xl text-[var(--text-main)] placeholder:text-neutral-400 dark:placeholder:text-neutral-700 focus:outline-none focus:border-brand-500/50 focus:ring-4 focus:ring-brand-500/10 transition-all font-medium"
                            placeholder="Enter your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{ color: 'var(--text-main)' }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1" style={{ color: 'var(--text-main)', opacity: 0.7 }}>Email Address</label>
                      <div className="relative group/input">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-600 group-focus-within/input:text-brand-500 transition-colors w-5 h-5" />
                        <input
                          type="email"
                          required
                          className="w-full pl-12 pr-4 py-4 bg-neutral-50 dark:bg-white/5 border border-[var(--card-border)] rounded-2xl text-[var(--text-main)] placeholder:text-neutral-400 dark:placeholder:text-neutral-700 focus:outline-none focus:border-brand-500/50 focus:ring-4 focus:ring-brand-500/10 transition-all font-medium"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          style={{ color: 'var(--text-main)' }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1" style={{ color: 'var(--text-main)', opacity: 0.7 }}>Password</label>
                      <div className="relative group/input">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-600 group-focus-within/input:text-brand-500 transition-colors w-5 h-5" />
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          className="w-full pl-12 pr-12 py-4 bg-neutral-50 dark:bg-white/5 border border-[var(--card-border)] rounded-2xl text-[var(--text-main)] placeholder:text-neutral-400 dark:placeholder:text-neutral-700 focus:outline-none focus:border-brand-500/50 focus:ring-4 focus:ring-brand-500/10 transition-all font-medium"
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          style={{ color: 'var(--text-main)' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-600 hover:text-[var(--text-main)] transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-500 hover:text-brand-600 transition-colors"
                        >
                          FORGOT PASSWORD?
                        </button>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={loading}
                      className="w-full py-5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-[0_10px_30px_rgba(34,197,94,0.3)] transition-all flex items-center justify-center group relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none"></div>
                      <span className="relative z-10">
                        {loading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
                      </span>
                      {!loading && <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform relative z-10" />}
                    </motion.button>
                  </>
                )}
              </form>
            )}

            <div className="mt-8 text-center">
              <button 
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-xs font-bold transition-colors uppercase tracking-widest"
                style={{ color: 'var(--text-main)', opacity: 0.7 }}
              >
                {mode === 'login' ? "New here? Create an account" : "Already have an account? Sign in"}
              </button>
            </div>

            {(settings?.auth_methods?.google_oauth !== false || settings?.auth_methods?.biometric !== false) && (
              <div className="mt-10 space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--card-border)]"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-[0.3em]">
                    <span className="relative z-10 bg-[var(--card-bg)] px-4 font-black transition-colors duration-300" style={{ color: 'var(--text-main)', opacity: 0.5 }}>Or continue with</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {settings?.auth_methods?.google_oauth !== false && (
                    <button
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="flex items-center justify-center gap-3 py-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-[var(--card-border)] rounded-2xl text-xs font-black uppercase tracking-widest transition-all group"
                      style={{ color: 'var(--text-main)' }}
                    >
                      <Chrome className="w-4 h-4 group-hover:text-blue-500 transition-colors" />
                      Google
                    </button>
                  )}
                  {settings?.auth_methods?.biometric !== false && (
                    <button
                      onClick={handleBiometricLogin}
                      disabled={loading || !isBiometricSupported}
                      className="flex items-center justify-center gap-3 py-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-[var(--card-border)] rounded-2xl text-xs font-black uppercase tracking-widest transition-all group disabled:opacity-30"
                      style={{ color: 'var(--text-main)' }}
                    >
                      <Fingerprint className="w-4 h-4 group-hover:text-brand-500 transition-colors" />
                      Bio
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="mt-10 pt-8 border-t border-[var(--card-border)] text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed" style={{ color: 'var(--text-main)', opacity: 0.6 }}>
                Lost access? <button 
                  onClick={() => showDialog(
                    'Security Notice', 
                    'Contact nexus.apphub@gmail.com for identity verification and credential recovery.', 
                    'info'
                  )}
                  className="text-brand-500 hover:text-brand-400 transition-colors"
                >
                  Request Reset
                </button>
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <LoadingOverlay isLoading={loading} message={mode === 'login' ? 'Authenticating...' : 'Creating Account...'} />

      <ModernDialog
        isOpen={dialog.isOpen}
        onClose={() => setDialog(prev => ({ ...prev, isOpen: false }))}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        showCancel={false}
        confirmText="Got it"
      />
    </div>
  );
};
