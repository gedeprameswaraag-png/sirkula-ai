-- ============================================================================
-- SIRKULAAI - COMPLETE DATABASE SCHEMA (SUPABASE POSTGRESQL)
-- ============================================================================

-- Aktifkan ekstensi UUID jika belum aktif
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PROFILES (Warga, Sukarelawan, Admin, Super Admin)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT NOT NULL,
  age INTEGER,
  phone TEXT,
  medical_history TEXT DEFAULT 'Tidak ada',
  role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'volunteer', 'admin', 'super_admin')),
  volunteer_status TEXT NOT NULL DEFAULT 'none' CHECK (volunteer_status IN ('none', 'pending', 'verified', 'rejected')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  completed_tasks_count INTEGER NOT NULL DEFAULT 0,
  experience_points INTEGER NOT NULL DEFAULT 0,
  volunteer_level TEXT NOT NULL DEFAULT 'Pemula',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. HOTSPOTS (Titik Lokasi Penumpukan Sampah Hasil Gabungan Laporan)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hotspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address_label TEXT,
  waste_category TEXT DEFAULT 'campuran',
  priority_level TEXT NOT NULL DEFAULT 'medium' CHECK (priority_level IN ('low', 'medium', 'high', 'critical')),
  priority_score NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  estimated_weight_kg NUMERIC(8,2) NOT NULL DEFAULT 0,
  reports_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. REPORTS (Laporan Warga / Guest + Hasil Analisis Gemini Vision)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  hotspot_id UUID REFERENCES public.hotspots(id) ON DELETE SET NULL,
  reporter_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  photo_path TEXT NOT NULL,
  ai_is_valid_waste BOOLEAN DEFAULT true,
  ai_waste_types JSONB DEFAULT '[]'::jsonb,
  ai_severity TEXT DEFAULT 'medium',
  ai_estimated_weight_kg NUMERIC(8,2) DEFAULT 0,
  ai_summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. VOLUNTEER GROUPS & MEMBERS (Grup Kolaborasi Sukarelawan)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.volunteer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.volunteer_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.volunteer_groups(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_in_group TEXT NOT NULL DEFAULT 'member' CHECK (role_in_group IN ('leader', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, volunteer_id)
);

-- ----------------------------------------------------------------------------
-- 5. CLEANUP TASKS (Klaim & Bukti Penyelesaian Pembersihan Lapangan)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cleanup_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotspot_id UUID NOT NULL REFERENCES public.hotspots(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.volunteer_groups(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'approved', 'rejected')),
  proof_photo_path TEXT,
  actual_weight_kg NUMERIC(8,2) DEFAULT 0,
  completion_notes TEXT,
  xp_awarded INTEGER DEFAULT 0,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6. KOMUNITAS: OBROLAN GRUP, PESAN LANGSUNG (DM) & UNDANGAN GRUP
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.volunteer_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  hotspot_id UUID REFERENCES public.hotspots(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  hotspot_id UUID REFERENCES public.hotspots(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.volunteer_groups(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, invitee_id)
);

-- ----------------------------------------------------------------------------
-- 7. AUDIT LOGS (Pencatatan Aktivitas Sistem)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 8. INDEX PERFORMA QUERY
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_role_xp ON public.profiles(role, experience_points DESC);
CREATE INDEX IF NOT EXISTS idx_hotspots_status_prio ON public.hotspots(status, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_hotspots_coords ON public.hotspots(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_reports_hotspot ON public.reports(hotspot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_hotspot_status ON public.cleanup_tasks(hotspot_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_volunteer ON public.cleanup_tasks(volunteer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_members_vol ON public.volunteer_group_members(volunteer_id, group_id);
CREATE INDEX IF NOT EXISTS idx_group_msg_group ON public.group_messages(group_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_dm_users ON public.direct_messages(sender_id, receiver_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_group_inv_invitee ON public.group_invitations(invitee_id, status);

-- ----------------------------------------------------------------------------
-- 9. HAK AKSES & KEAMANAN TABEL (BACKEND EXPRESS DENGAN SUPABASE ADMIN)
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotspots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleanup_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;