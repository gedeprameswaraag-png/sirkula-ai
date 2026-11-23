-- ============================================================
-- SirkulaAI - Skema Supabase PostgreSQL
-- ------------------------------------------------------------
-- Disusun ulang dari query yang dipakai backend (profiles, hotspots,
-- reports, report_images, cleanup_tasks, volunteer_groups, dst).
-- Semua memakai "if not exists", jadi aman dijalankan di database yang sudah
-- berisi tabel, tetapi TIDAK mengubah kolom yang sudah ada. Cocokkan dulu
-- dengan tabel di Supabase Anda sebelum menjalankan.
--
-- Bucket Storage (private) yang dibutuhkan: report-photos, cleanup-evidences
-- ============================================================
create extension if not exists "pgcrypto";

-- ---------- PROFILES (1:1 dengan auth.users) ----------
create table if not exists profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text,
  full_name             text not null,
  phone                 text,
  age                   integer,
  medical_history       text,
  health_declaration    boolean not null default false,
  role                  text not null default 'user'
                        check (role in ('user','volunteer','admin','super_admin')),
  volunteer_status      text
                        check (volunteer_status in ('unverified','pending_verification','verified','rejected')),
  volunteer_level       text default 'Pemula',
  experience_points     integer not null default 0,
  completed_tasks_count integer not null default 0,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now()
);
create index if not exists idx_profiles_role on profiles(role);

-- ---------- HOTSPOTS ----------
create table if not exists hotspots (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  latitude         double precision not null,
  longitude        double precision not null,
  severity         text not null,
  priority_level   text check (priority_level in ('ringan','sedang','parah')),
  priority_score   double precision,
  primary_category text,
  status           text not null default 'open'
                   check (status in ('open','in_progress','resolved')),
  last_verified_at timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists idx_hotspots_status on hotspots(status);

-- ---------- REPORTS ----------
create table if not exists reports (
  id                   uuid primary key default gen_random_uuid(),
  reporter_id          uuid references profiles(id) on delete set null,  -- null = guest
  hotspot_id           uuid references hotspots(id) on delete set null,
  latitude             double precision not null,
  longitude            double precision not null,
  gps_accuracy_m       double precision,
  location_captured_at timestamptz,
  description          text,
  severity_level       text,
  impact_score         double precision,
  status               text not null default 'analysis_completed'
                       check (status in ('analysis_completed','needs_review','verified','rejected')),
  created_at           timestamptz not null default now()
);
create index if not exists idx_reports_status   on reports(status);
create index if not exists idx_reports_reporter on reports(reporter_id);
create index if not exists idx_reports_created  on reports(created_at desc);

create table if not exists report_images (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references reports(id) on delete cascade,
  storage_path text not null,
  mime_type    text,
  size_bytes   integer,
  captured_at  timestamptz
);
create index if not exists idx_report_images_report on report_images(report_id);

-- ---------- RELAWAN: GRUP & TUGAS ----------
create table if not exists volunteer_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text default '',
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists volunteer_group_members (
  group_id      uuid not null references volunteer_groups(id) on delete cascade,
  volunteer_id  uuid not null references profiles(id) on delete cascade,
  role_in_group text not null default 'member' check (role_in_group in ('leader','member')),
  joined_at     timestamptz not null default now(),
  primary key (group_id, volunteer_id)
);

create table if not exists cleanup_tasks (
  id                uuid primary key default gen_random_uuid(),
  hotspot_id        uuid references hotspots(id) on delete cascade,
  volunteer_id      uuid references profiles(id) on delete set null,
  group_id          uuid references volunteer_groups(id) on delete set null,
  status            text not null default 'in_progress'
                    check (status in ('in_progress','submitted','approved')),
  proof_photo_path  text,
  actual_weight_kg  double precision,
  completion_notes  text,
  admin_review_notes text,
  xp_awarded        integer,
  completed_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists idx_tasks_volunteer on cleanup_tasks(volunteer_id);
create index if not exists idx_tasks_hotspot   on cleanup_tasks(hotspot_id);
-- Satu titik hanya boleh punya satu tugas aktif (mencegah dua relawan mengambil titik yang sama)
create unique index if not exists uq_tasks_one_active_per_hotspot
  on cleanup_tasks(hotspot_id) where status in ('in_progress','submitted');

-- ---------- AUDIT ----------
create table if not exists activity_logs (
  id           bigserial primary key,
  actor_id     uuid references profiles(id) on delete set null,
  entity_type  text,
  entity_id    text,
  action       text not null,
  details_json jsonb default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists idx_activity_created on activity_logs(created_at desc);

-- ---------- RLS ----------
-- Backend memakai service role (melewati RLS). RLS diaktifkan tanpa policy agar
-- anon key tidak bisa membaca/menulis tabel secara langsung.
alter table profiles                enable row level security;
alter table hotspots                enable row level security;
alter table reports                 enable row level security;
alter table report_images           enable row level security;
alter table volunteer_groups        enable row level security;
alter table volunteer_group_members enable row level security;
alter table cleanup_tasks           enable row level security;
alter table activity_logs           enable row level security;
