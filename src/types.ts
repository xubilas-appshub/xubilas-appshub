export interface AppRecord {
  id: string;
  name: string;
  description: string;
  category: string;
  icon_url: string;
  apk_url: string;
  screenshots: string[];
  rating: number;
  downloads: number;
  developer: string;
  version: string;
  size: string;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'published' | 'rejected';
  rejection_reason?: string | null;
  rejected_version?: string | null;
  developer_id?: string;
  support_contact?: string;
  pending_update?: {
    name?: string;
    description?: string;
    category?: string;
    version?: string;
    size?: string;
    icon_url?: string;
    apk_url?: string;
    screenshots?: string[];
    release_notes?: string;
    support_contact?: string;
  } | null;
}

export interface Developer {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  company?: string;
  bio?: string;
  avatar_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface AppVersion {
  id: string;
  app_id: string;
  version: string;
  release_notes: string;
  apk_url: string;
  created_at: string;
}

export interface Review {
  id: string;
  app_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface StoreSettings {
  id: string;
  store_name: string;
  contact_email: string;
  maintenance_mode: boolean;
  store_logo_url?: string;
  primary_color?: string;
  announcement_text?: string;
  footer_text?: string;
  allow_user_uploads: boolean;
  auth_methods?: {
    email_password: boolean;
    google_oauth: boolean;
    biometric: boolean;
    custom_auth?: {
      name: string;
      enabled: boolean;
      config?: any;
    }[];
  };
  updated_at?: string;
}

export interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error' | 'alert';
  is_read: boolean;
  is_sticky?: boolean;
  created_at: string;
}

export interface Admin {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'editor';
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}
