-- EduXPert — Supabase schema (SupabaseDriver, src/server/storage/supabase.ts)
-- Idempotent: safe to run repeatedly against the same project.
-- Mirrors LocalDriver's layout (src/server/storage/local.ts) onto Postgres + Storage.
-- Written but not exercised tonight: STORAGE_DRIVER stays "local" (MEGAPROMPT §5, §8).

create extension if not exists pgcrypto;

-- One row per uploaded PDF / pasted text / topic.
create table if not exists sources (
  id text primary key,
  kind text not null check (kind in ('pdf', 'text', 'topic')),
  title text not null,
  filename text,
  page_count integer not null default 0,
  byte_length integer not null default 0,
  blob_path text,
  topic text,
  created_at timestamptz not null default now()
);

-- Per-page extracted text for a source (unpdf output). One row per (source, page).
create table if not exists pages (
  source_id text not null,
  page integer not null,
  text text not null default '',
  low_text boolean not null default false,
  primary key (source_id, page)
);

-- The Curriculum agent's KnowledgeMap for a source, after quote verification. One per source.
create table if not exists knowledge_maps (
  source_id text primary key,
  km jsonb not null,
  updated_at timestamptz not null default now()
);

-- The intake screen's answers for a source (confidence, goal, minutes, genre, pre-check). Latest wins.
create table if not exists intakes (
  source_id text primary key,
  intake jsonb not null,
  updated_at timestamptz not null default now()
);

-- The Matcher's per-concept picks + wishlist for a source.
create table if not exists matches (
  source_id text primary key,
  matches jsonb not null,
  updated_at timestamptz not null default now()
);

-- Generated GameSpecs.
create table if not exists games (
  id text primary key,
  source_id text not null,
  job_id text,
  spec jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists games_source_id_idx on games(source_id);
create index if not exists games_created_at_idx on games(created_at desc);

-- Generation jobs (S6-S9 run), one per generateGame() call.
create table if not exists jobs (
  id text primary key,
  source_id text not null,
  status text not null check (status in ('queued', 'running', 'done', 'failed')),
  game_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_source_id_idx on jobs(source_id);

-- Progress events for a job's SSE stream (src/pipeline/events.ts persists here best-effort).
create table if not exists events (
  id bigint generated always as identity primary key,
  job_id text not null,
  agent text not null,
  status text not null check (status in ('start', 'repair', 'done', 'fallback', 'failed')),
  ms integer,
  note text,
  at timestamptz not null default now()
);
create index if not exists events_job_id_idx on events(job_id, at);

-- Player telemetry per game (used for mastery + debrief).
create table if not exists telemetry (
  id bigint generated always as identity primary key,
  game_id text not null,
  encounter_id text not null,
  concept_ids jsonb not null,
  teaching_mechanic_id text not null,
  attempt integer not null,
  correct boolean not null,
  hints_used integer not null,
  ms integer not null,
  at timestamptz not null default now()
);
create index if not exists telemetry_game_id_idx on telemetry(game_id, at);

-- No foreign keys anywhere, like LocalDriver: the upload route writes pages before their source row, events can
-- precede their job, and the showcase games are fixtures with no games row. Existing projects: drop the old ones.
alter table pages drop constraint if exists pages_source_id_fkey;
alter table knowledge_maps drop constraint if exists knowledge_maps_source_id_fkey;
alter table intakes drop constraint if exists intakes_source_id_fkey;
alter table matches drop constraint if exists matches_source_id_fkey;
alter table games drop constraint if exists games_source_id_fkey;
alter table jobs drop constraint if exists jobs_source_id_fkey;
alter table events drop constraint if exists events_job_id_fkey;
alter table telemetry drop constraint if exists telemetry_game_id_fkey;

-- Row level security on every table with no policies: the public anon key can read or write nothing through the
-- API. The server uses the secret (service role) key, which bypasses RLS.
alter table sources enable row level security;
alter table pages enable row level security;
alter table knowledge_maps enable row level security;
alter table intakes enable row level security;
alter table matches enable row level security;
alter table games enable row level security;
alter table jobs enable row level security;
alter table events enable row level security;
alter table telemetry enable row level security;

-- Storage buckets: "sources" for uploaded PDFs, "audio" for generated narration/music (public read).
insert into storage.buckets (id, name, public)
values ('sources', 'sources', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do update set public = true;
