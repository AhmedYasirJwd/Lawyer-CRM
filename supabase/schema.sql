-- LexCase — Supabase schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run).
-- Safe to re-run: every statement is guarded so it won't error on a second run.

-- ------------------------------------------------------------------ tables --

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_number text not null,
  title text not null,
  court text not null,
  filing_date date not null,
  case_type text not null default 'Civil Suit',
  counsel_for text not null default '',
  stage text not null default 'Filed',
  status text not null default 'Active',
  priority text not null default 'Medium',
  notes text,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  position int not null default 0,
  -- Which side of the case this party is on. Multiple rows can share a
  -- side (e.g. two co-plaintiffs), so the app groups by this rather than
  -- by row position — position is still used to order people within a side.
  side smallint not null default 1,
  name text not null,
  role text not null,
  phone text,
  cnic text,
  address text,
  relation_type text, -- 'Son of' | 'Wife of' | 'Daughter of'
  relation_name text
);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null,
  date date not null,
  description text not null default '',
  type text not null default 'other',
  created_at timestamptz not null default now()
);

create table if not exists public.hearings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  date timestamptz not null,
  purpose text not null,
  court text not null,
  counsel_for text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  title text not null,
  due_date date,
  status text not null default 'Pending',
  priority text,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  name text not null,
  size bigint not null default 0,
  mime_type text not null default 'application/octet-stream',
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists cases_user_id_idx on public.cases (user_id);
create index if not exists parties_case_id_idx on public.parties (case_id);
create index if not exists timeline_events_case_id_idx on public.timeline_events (case_id);
create index if not exists hearings_case_id_idx on public.hearings (case_id);
create index if not exists hearings_user_id_idx on public.hearings (user_id);
create index if not exists tasks_case_id_idx on public.tasks (case_id);
create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists documents_case_id_idx on public.documents (case_id);

-- --------------------------------------------------------------------- RLS --
-- Every table: a signed-in user may only see/change rows where user_id = their
-- own auth.uid(). This is enforced in Postgres itself, not just the app, so it
-- holds even if a request is crafted by hand from the browser.

alter table public.cases enable row level security;
alter table public.parties enable row level security;
alter table public.timeline_events enable row level security;
alter table public.hearings enable row level security;
alter table public.tasks enable row level security;
alter table public.documents enable row level security;

drop policy if exists "own cases" on public.cases;
create policy "own cases" on public.cases for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own parties" on public.parties;
create policy "own parties" on public.parties for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own timeline_events" on public.timeline_events;
create policy "own timeline_events" on public.timeline_events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own hearings" on public.hearings;
create policy "own hearings" on public.hearings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own tasks" on public.tasks;
create policy "own tasks" on public.tasks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own documents" on public.documents;
create policy "own documents" on public.documents for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------- storage --
-- Private bucket for uploaded case documents. Objects are stored at
-- user/{user_id}/case/{case_id}/{filename}, and the policies below only allow
-- a user to touch objects under their own user/{their_uid}/ prefix.

insert into storage.buckets (id, name, public)
  values ('case-documents', 'case-documents', false)
  on conflict (id) do nothing;

drop policy if exists "own storage objects select" on storage.objects;
create policy "own storage objects select" on storage.objects for select
  using (
    bucket_id = 'case-documents'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "own storage objects insert" on storage.objects;
create policy "own storage objects insert" on storage.objects for insert
  with check (
    bucket_id = 'case-documents'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "own storage objects delete" on storage.objects;
create policy "own storage objects delete" on storage.objects for delete
  using (
    bucket_id = 'case-documents'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ------------------------------------------------------------ notifications --
-- Push subscriptions: one row per browser/device the user has turned
-- notifications on for. This is the standard Web Push shape — endpoint plus
-- the two encryption keys the browser returns from PushManager.subscribe().
-- Written/deleted by the signed-in user themselves (src/app/api/push/subscribe),
-- read by the notifications cron using the service-role key (bypasses RLS,
-- since that job has to look across every user, not just one signed-in visitor).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own push_subscriptions" on public.push_subscriptions;
create policy "own push_subscriptions" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reminder tracking: which reminders have already gone out for a given
-- hearing/task, so the notifications cron (runs every few minutes) never
-- sends the same reminder twice. Null = not sent yet.
alter table public.hearings add column if not exists reminder_24h_sent_at timestamptz;
alter table public.hearings add column if not exists reminder_1h_sent_at timestamptz;
alter table public.tasks add column if not exists reminder_sent_at timestamptz;

-- Party detail fields: CNIC, address, and S/O-W/O-D/O parentage, plus the
-- "side" grouping that lets more than one party sit on the same side of a
-- case (e.g. two co-plaintiffs). The old "email" column is left in place
-- (unused by the app now) rather than dropped, so existing data isn't lost.
alter table public.parties add column if not exists side smallint not null default 1;
alter table public.parties add column if not exists cnic text;
alter table public.parties add column if not exists address text;
alter table public.parties add column if not exists relation_type text;
alter table public.parties add column if not exists relation_name text;

-- ---------------------------------------------------------------- profiles --
-- One row per lawyer: the CNIC + advocate code CFMS (court case-flow system)
-- lookups need. Created by the signUp action, editable from Settings. Not in
-- auth user_metadata on purpose — metadata is embedded in every session JWT.
-- A CNIC can belong to only one account, so nobody can register someone
-- else's CNIC to pull their cause list.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cnic text not null,
  advocate_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_cnic_key on public.profiles (cnic);

alter table public.profiles enable row level security;

drop policy if exists "own profiles" on public.profiles;
create policy "own profiles" on public.profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
