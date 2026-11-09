-- ════════════════════════════════════════════════════════════════════
--  Mise à jour v4 — UNIQUEMENT si tu avais déjà installé la base avant le 9/11/2026 (soir)
--  Balades proposées par les cavaliers, discussions, liens photos.
-- ════════════════════════════════════════════════════════════════════
alter table public.events add column if not exists open boolean default true;

create table if not exists public.event_messages (   -- discussion d'un événement (effacée 2 j après)
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  author_id uuid references public.profiles on delete set null default auth.uid(),
  body text not null check (char_length(body) between 1 and 2000),
  mentions uuid[] default '{}',
  created_at timestamptz default now()
);
create index if not exists event_messages_ev on public.event_messages (event_id, created_at);

create table if not exists public.chat_reads (       -- dernier message lu (pastilles « non lus »)
  event_id uuid not null references public.events on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  last_read_at timestamptz default now(),
  primary key (event_id, profile_id)
);

create table if not exists public.event_links (      -- liens photos / vidéos (WeTransfer, Google Photos…), conservés
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  author_id uuid references public.profiles on delete set null default auth.uid(),
  url text not null check (url ~* '^https?://'),
  label text default '',
  created_at timestamptz default now()
);

-- Balades / discussions
create or replace function public.event_joinable(ev uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events where id = ev and (coalesce(open, true) or created_by = auth.uid()));
$$;
create or replace function public.in_event(ev uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from event_participants where event_id = ev and profile_id = auth.uid())
      or exists (select 1 from events where id = ev and created_by = auth.uid());
$$;
create or replace function public.chat_open(ev uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events where id = ev and date >= current_date - 2);
$$;
-- Efface les discussions 2 jours après l'événement (appelée par l'appli et par la tâche planifiée)
create or replace function public.purge_old_chats() returns void
language sql security definer set search_path = public as $$
  delete from event_messages m using events e where m.event_id = e.id and e.date < current_date - 2;
  delete from chat_reads r using events e where r.event_id = e.id and e.date < current_date - 2;
$$;
grant execute on function public.purge_old_chats() to authenticated;

alter table public.event_messages enable row level security;
alter table public.chat_reads enable row level security;
alter table public.event_links enable row level security;

drop policy if exists events_ins on public.events;
drop policy if exists events_upd on public.events;
drop policy if exists events_del on public.events;
drop policy if exists parts_ins on public.event_participants;
-- les cavaliers peuvent proposer leurs propres balades (type « sortie »)
create policy events_ins on public.events for insert to authenticated with check (public.is_admin() or (public.is_member() and type = 'sortie' and created_by = auth.uid()));
create policy events_upd on public.events for update to authenticated using (public.is_admin() or created_by = auth.uid()) with check (public.is_admin() or (type = 'sortie' and created_by = auth.uid()));
create policy events_del on public.events for delete to authenticated using (public.is_admin() or created_by = auth.uid());
create policy parts_ins on public.event_participants for insert to authenticated with check (public.is_admin() or (public.is_member() and profile_id = auth.uid() and public.event_joinable(event_id)));

-- Discussions : seulement les inscrits de l'événement (+ l'admin, + les personnes @mentionnées pour leur invitation)
create policy msg_sel on public.event_messages for select to authenticated using (public.is_admin() or public.in_event(event_id) or auth.uid() = any(mentions));
create policy msg_ins on public.event_messages for insert to authenticated with check (public.is_member() and author_id = auth.uid() and (public.in_event(event_id) or public.is_admin()) and public.chat_open(event_id));
create policy msg_del on public.event_messages for delete to authenticated using (public.is_admin() or author_id = auth.uid());
create policy reads_all on public.chat_reads for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
-- Liens photos : visibles par tous les membres, gardés après l'événement
create policy links_sel on public.event_links for select to authenticated using (public.is_member());
create policy links_ins on public.event_links for insert to authenticated with check (public.is_member() and author_id = auth.uid());
create policy links_del on public.event_links for delete to authenticated using (public.is_admin() or author_id = auth.uid());

-- ─────────────────────────── TEMPS RÉEL & NETTOYAGE ───────────────────────────
-- Messages instantanés dans les discussions
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.event_messages;
  end if;
exception when duplicate_object then null; end $$;
-- Effacement automatique chaque nuit (03h15) des discussions terminées depuis 2 jours.
-- (Si pg_cron n'est pas disponible, l'appli fait aussi le ménage à chaque connexion.)
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('lbg-purge-chats', '15 3 * * *', 'select public.purge_old_chats()');
exception when others then raise notice 'pg_cron indisponible : %', sqlerrm;
end $$;
