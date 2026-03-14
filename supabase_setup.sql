-- Supabase Database Schema Setup
-- Run this in your Supabase SQL Editor

-- 1. Admins Table
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'editor', -- 'super_admin', 'editor'
    status TEXT DEFAULT 'inactive', -- 'active', 'inactive'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Developers Table
CREATE TABLE IF NOT EXISTS public.developers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    company TEXT,
    bio TEXT,
    avatar_url TEXT,
    status TEXT DEFAULT 'pending', -- 'approved', 'pending', 'rejected'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Apps Table
CREATE TABLE IF NOT EXISTS public.apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    icon_url TEXT,
    apk_url TEXT,
    screenshots TEXT[] DEFAULT '{}',
    rating FLOAT DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    developer TEXT,
    developer_id UUID REFERENCES public.developers(id) ON DELETE SET NULL,
    version TEXT,
    size TEXT,
    support_contact TEXT,
    pending_update JSONB DEFAULT NULL,
    rejection_reason TEXT,
    rejected_version TEXT,
    status TEXT DEFAULT 'pending', -- 'published', 'pending', 'rejected'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. App Versions Table
CREATE TABLE IF NOT EXISTS public.app_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID REFERENCES public.apps(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    release_notes TEXT,
    apk_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'main',
    store_name TEXT DEFAULT 'APPS HUB',
    contact_email TEXT,
    maintenance_mode BOOLEAN DEFAULT false,
    allow_user_uploads BOOLEAN DEFAULT true,
    store_logo_url TEXT,
    primary_color TEXT DEFAULT '#22c55e',
    announcement_text TEXT,
    footer_text TEXT,
    auth_methods JSONB DEFAULT '{"email_password": true, "google_oauth": true, "biometric": true, "custom_auth": []}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Admin Biometrics Table
CREATE TABLE IF NOT EXISTS public.admin_biometrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Reviews Table
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID REFERENCES public.apps(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Functions & Triggers for Automatic Updates

-- Function to update app rating average
CREATE OR REPLACE FUNCTION public.update_app_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.apps
    SET rating = (
        SELECT COALESCE(AVG(rating), 0)
        FROM public.reviews
        WHERE app_id = COALESCE(NEW.app_id, OLD.app_id)
    )
    WHERE id = COALESCE(NEW.app_id, OLD.app_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for reviews
DROP TRIGGER IF EXISTS on_review_change ON public.reviews;
CREATE TRIGGER on_review_change
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_app_rating();

-- Function to increment download count safely
CREATE OR REPLACE FUNCTION public.increment_download_count(target_app_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.apps
    SET downloads = downloads + 1
    WHERE id = target_app_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security (RLS)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_biometrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Create basic policies (Adjust these based on your security needs)
CREATE POLICY "Public apps are viewable by everyone" ON public.apps
    FOR SELECT USING (status = 'published');

CREATE POLICY "Admins can manage everything" ON public.apps
    USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Reviews are viewable by everyone" ON public.reviews
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert reviews" ON public.reviews
    FOR INSERT WITH CHECK (true);

-- 9. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- 'success', 'info', 'warning', 'error', 'alert'
    is_sticky BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Insert default settings
INSERT INTO public.settings (id, store_name) 
VALUES ('main', 'APPS HUB')
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view global notifications" ON public.notifications;
CREATE POLICY "Anyone can view global notifications" ON public.notifications
    FOR SELECT USING (user_id IS NULL);

DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
CREATE POLICY "Admins can view all notifications" ON public.notifications
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND status = 'active'));

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications" ON public.notifications
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND status = 'active'));

DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;
CREATE POLICY "Admins can delete notifications" ON public.notifications
    FOR DELETE USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND status = 'active'));
