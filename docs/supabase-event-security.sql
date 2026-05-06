do $$
begin
  create type public.octodive_score_status as enum (
    'valid',
    'suspicious',
    'disqualified',
    'deleted'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.octodash_scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null check (char_length(player_name) between 1 and 32),
  score integer not null check (score >= 0),
  pearls integer not null default 0 check (pearls >= 0),
  elapsed_ms integer not null default 0 check (elapsed_ms >= 0),
  score_status public.octodive_score_status not null default 'valid',
  event_id text not null default 'kariyer-in-2026-05-07',
  masked_ip text not null default 'unknown',
  user_agent text not null default '',
  client_id text not null default '',
  run_id text not null default '',
  admin_action text,
  admin_action_reason text,
  admin_action_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.octodash_scores
  add column if not exists elapsed_ms integer not null default 0 check (elapsed_ms >= 0),
  add column if not exists score_status public.octodive_score_status not null default 'valid',
  add column if not exists event_id text not null default 'kariyer-in-2026-05-07',
  add column if not exists masked_ip text not null default 'unknown',
  add column if not exists user_agent text not null default '',
  add column if not exists client_id text not null default '',
  add column if not exists run_id text not null default '',
  add column if not exists admin_action text,
  add column if not exists admin_action_reason text,
  add column if not exists admin_action_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.octodash_scores
  drop constraint if exists octodash_scores_player_name_check;

alter table public.octodash_scores
  add constraint octodash_scores_player_name_check
  check (char_length(player_name) between 1 and 32);

create index if not exists octodash_scores_event_valid_idx
  on public.octodash_scores (event_id, score_status, score desc, created_at asc);

create index if not exists octodash_scores_event_client_idx
  on public.octodash_scores (event_id, client_id);

create index if not exists octodash_scores_created_at_idx
  on public.octodash_scores (created_at desc);

alter table public.octodash_scores enable row level security;

drop policy if exists "Anyone can read Octodive scores" on public.octodash_scores;
drop policy if exists "Anyone can submit Octodive scores" on public.octodash_scores;

create policy "Public can read valid Octodive scores"
  on public.octodash_scores
  for select
  using (score_status = 'valid');

-- No anon insert/update/delete policy is created.
-- Vercel Functions use SUPABASE_SERVICE_ROLE_KEY server-side for score writes and admin actions.
