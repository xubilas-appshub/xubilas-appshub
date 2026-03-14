# Supabase Setup Guide

To fix the connection issues and ensure your apps and admins show up correctly, please follow these steps to set up your Supabase database.

## 1. Run the SQL Setup Script

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. Click on **SQL Editor** in the left sidebar.
4. Click **New Query**.
5. Copy and paste the following SQL script and click **Run**.

```sql
-- 1. Create Admins Table
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'editor',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Developers Table
CREATE TABLE IF NOT EXISTS public.developers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    company TEXT,
    bio TEXT,
    avatar_url TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create Apps Table
CREATE TABLE IF NOT EXISTS public.apps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    developer_id UUID REFERENCES public.developers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    icon_url TEXT,
    apk_url TEXT,
    version TEXT,
    status TEXT DEFAULT 'pending',
    downloads INTEGER DEFAULT 0,
    screenshots TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'main',
    store_name TEXT DEFAULT 'XUBILASS APP HUB',
    contact_email TEXT,
    maintenance_mode BOOLEAN DEFAULT false,
    allow_user_uploads BOOLEAN DEFAULT true,
    store_logo_url TEXT,
    primary_color TEXT DEFAULT '#22c55e',
    announcement_text TEXT,
    footer_text TEXT,
    auth_methods JSONB DEFAULT '{"email_password": true, "google": true, "biometric": false}',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies

-- Admins Table: Non-recursive policies
CREATE POLICY "Admins can view all admin records" ON public.admins FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can update their own record" ON public.admins FOR UPDATE USING (auth.uid() = user_id);
-- Note: Deleting/Creating admins should ideally be done via service_role (backend) to avoid recursion

-- Developers Table: Admins can manage, developers can see themselves
CREATE POLICY "Admins can manage developers" ON public.developers FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())
);
CREATE POLICY "Developers can read their own profile" ON public.developers FOR SELECT USING (auth.uid() = user_id);

-- Apps Table: Admins can manage, everyone can see published
CREATE POLICY "Admins can manage apps" ON public.apps FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())
);
CREATE POLICY "Anyone can read published apps" ON public.apps FOR SELECT USING (status = 'published');

-- Settings Table: Admins can manage, everyone can read
CREATE POLICY "Admins can manage settings" ON public.settings FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())
);
CREATE POLICY "Anyone can read settings" ON public.settings FOR SELECT USING (true);

-- 7. Insert Default Settings
INSERT INTO public.settings (id, store_name) VALUES ('main', 'XUBILASS APP HUB') ON CONFLICT (id) DO NOTHING;
```

## 2. Create Storage Buckets

1. Go to **Storage** in the left sidebar.
2. Click **New Bucket**.
3. Create a bucket named `icons` and make it **Public**.
4. Create a bucket named `apks` and make it **Public**.
5. Create a bucket named `screenshots` and make it **Public**.

## 3. Update Environment Variables

Ensure you have set these variables in your environment (or `.env` file):

- `VITE_SUPABASE_URL`: Your Supabase Project URL.
- `VITE_SUPABASE_ANON_KEY`: Your Supabase `anon` `public` key.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase `service_role` key (Required for the backend to create users).

---
**Need help?** If you still see errors, check the browser console (F12) for specific error messages.
