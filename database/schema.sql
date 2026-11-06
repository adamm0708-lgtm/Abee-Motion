create extension if not exists pgcrypto;

create table if not exists public.templates (
  id text primary key,
  name text not null,
  category text not null,
  description text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  template_id text references public.templates(id) on delete set null,
  duration integer not null default 15 check (duration between 5 and 180),
  ratio text not null default '9:16' check (ratio in ('9:16','16:9','1:1')),
  status text not null default 'draft' check (status in ('draft','queued','rendering','completed','failed')),
  timeline jsonb not null default '{"scenes":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  asset_type text not null check (asset_type in ('image','audio','video','font','other')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.renders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  output_url text,
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists projects_updated_at_idx on public.projects(updated_at desc);
create index if not exists assets_project_id_idx on public.assets(project_id);
create index if not exists renders_project_id_idx on public.renders(project_id);

insert into public.templates (id, name, category, description, config)
values
('cinematic-opener','Cinematic Opener','Cinematic','Opening dramatis dengan judul besar.','{"duration":10,"ratio":"9:16"}'),
('kinetic-type','Kinetic Typography','Typography','Teks dinamis dengan gerakan cepat.','{"duration":15,"ratio":"9:16"}'),
('product-promo','Product Promo','Produk','Showcase produk dengan komposisi premium.','{"duration":20,"ratio":"9:16"}'),
('explainer','Explainer','Edukasi','Penjelasan visual yang rapi dan mudah diikuti.','{"duration":30,"ratio":"16:9"}'),
('cartoon-motion','Cartoon Motion','Kartun','Gerakan ilustrasi ceria untuk konten edukasi.','{"duration":20,"ratio":"9:16"}')
on conflict (id) do nothing;
