-- ════════════════════════════════════════════════════════════════════
--  APPLI LBG — Écurie la Barthe Grande
--  Schéma Supabase : à coller dans Supabase › SQL Editor › Run (peut être relancé sans risque)
-- ════════════════════════════════════════════════════════════════════

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;  -- codes PIN (déjà actif sur Supabase)

-- ─────────────────────────── TABLES ───────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  email text,
  role text not null default 'nouveau' check (role in ('admin','proprietaire','dp','nouveau','archive')),
  claim_failures int not null default 0,   -- essais de code PIN ratés
  login text unique,                       -- prénom de connexion normalisé (ex. « alice.d »)
  login_label text,                        -- prénom de connexion tel qu'affiché (ex. « Alice D »)
  archived_at timestamptz,
  phone text,
  color text,
  licence_ffe text,
  licence_year int,
  created_at timestamptz default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  full_name text not null,
  login text unique,                   -- prénom de connexion normalisé (ex. « chloe », « alice.d »)
  login_label text,                    -- tel qu'affiché (ex. « Chloé », « Alice D »)
  failures int not null default 0,     -- codes faux tapés avec ce prénom (blocage à 8)
  role text not null check (role in ('admin','proprietaire','dp')),
  horse_ids uuid[] default '{}',       -- chevaux dont la personne est propriétaire (ou montés, pour un DP/TP)
  rider_kind text default 'DP',
  ride_ids uuid[] default '{}',        -- chevaux montés en DP/TP (en plus de ses propres chevaux)
  series_ids uuid[] default '{}',      -- cours réguliers auxquels l'inscrire automatiquement
  phone text,                          -- téléphone pré-rempli (modifiable dans « Mon profil »)
  used_by uuid references public.profiles on delete set null,
  used_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

create table if not exists public.horses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references public.profiles on delete set null,
  owner_label text default '',
  sex text, birth_date date, breed text, robe text, height int,
  sire text, ueln text, transponder text,
  pension text default 'base',
  arrival_date date, origin text, departure_date date, destination text,
  photo text,
  ration_morning text, ration_evening text, supplements text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.horse_riders (
  id uuid primary key default gen_random_uuid(),
  horse_id uuid not null references public.horses on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  kind text default 'DP' check (kind in ('DP','TP')),
  days text default '',
  unique (horse_id, profile_id)
);

create table if not exists public.health_events (
  id uuid primary key default gen_random_uuid(),
  horse_id uuid not null references public.horses on delete cascade,
  type text not null,
  date date not null,
  "time" time,                          -- heure du RDV
  status text not null default 'fait' check (status in ('fait','prevu')),
  practitioner text default '', product text default '', lot text default '', notes text default '',
  next_due date,
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);
create index if not exists health_events_horse on public.health_events (horse_id, date);
create index if not exists health_events_date on public.health_events (date);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'cours',
  title text not null,
  date date not null,
  start_time time, end_time time,
  location text default '', description text default '',
  capacity int,
  open boolean default true,         -- balade : false = « je préfère être seule »
  series_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);
create index if not exists events_date on public.events (date);

create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  horse_id uuid references public.horses on delete set null,
  status text default 'inscrit' check (status in ('inscrit','absent','attente')),
  bring text default '',          -- animations : ce que j'apporte
  group_label text default '',    -- stages : groupe de passage
  slot_time time,                 -- stages : heure du groupe
  class_name text default '',     -- concours : épreuve
  bib text default '',            -- concours : dossard
  class_time time,                -- concours : heure de passage
  result text default '',         -- concours : classement
  note text default '',
  created_at timestamptz default now(),
  unique (event_id, profile_id)
);

create table if not exists public.presences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles on delete cascade,
  horse_id uuid references public.horses on delete set null,
  date date not null,
  "time" time,
  kind text default 'monte' check (kind in ('monte','soin','passage','absent')),
  note text default '',
  created_at timestamptz default now()
);
create index if not exists presences_date on public.presences (date);

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles on delete set null,
  title text not null, description text default '',
  category text default 'animation',
  status text default 'nouvelle',
  event_id uuid references public.events on delete set null,
  created_at timestamptz default now()
);
create table if not exists public.suggestion_votes (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.suggestions on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  unique (suggestion_id, profile_id)
);

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

create table if not exists public.conversations (   -- messages privés (direct) et groupes
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'group' check (kind in ('direct','group')),
  title text default '',
  created_by uuid references public.profiles on delete set null default auth.uid(),
  created_at timestamptz default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, profile_id)
);
create index if not exists conv_members_profile on public.conversation_members (profile_id);
create table if not exists public.messages (          -- effacés automatiquement après 30 jours
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  author_id uuid references public.profiles on delete set null default auth.uid(),
  body text not null check (char_length(body) between 1 and 2000),
  mentions uuid[] default '{}',
  created_at timestamptz default now()
);
create index if not exists messages_conv on public.messages (conversation_id, created_at);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  kind text default 'annonce' check (kind in ('annonce','notice')),
  title text not null, body text default '',
  pinned boolean default false,
  author_id uuid default auth.uid(),
  created_at timestamptz default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null, category text default 'autre',
  phone text default '', email text default '', note text default ''
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  horse_id uuid references public.horses on delete cascade,
  kind text default 'contrat',          -- contrat, avenant, ordonnance, assurance, autre
  title text not null,
  file_path text,                       -- chemin dans le stockage privé "documents"
  file_name text,
  needs_acceptance boolean default false,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles on delete set null,
  accepted_name text,
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

create table if not exists public.settings (
  id text primary key,
  data jsonb default '{}'::jsonb
);

-- ─────────────────────────── FONCTIONS D'ACCÈS ───────────────────────────
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin','proprietaire','dp'));
$$;
create or replace function public.can_manage_horse(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from horses where id = h and owner_id = auth.uid());
$$;
create or replace function public.can_see_horse(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage_horse(h) or exists (select 1 from horse_riders where horse_id = h and profile_id = auth.uid());
$$;

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
  delete from event_messages where created_at < now() - interval '30 days';
  delete from messages where created_at < now() - interval '30 days';
$$;
create or replace function public.is_conv_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_members where conversation_id = c and profile_id = auth.uid());
$$;
-- Conversation privée à deux : retrouve ou crée
create or replace function public.get_or_create_direct(p_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if not public.is_member() then raise exception 'Accès refusé'; end if;
  if p_other = me or not exists (select 1 from profiles where id = p_other and role in ('admin','proprietaire','dp')) then raise exception 'Destinataire introuvable'; end if;
  select c.id into cid from conversations c
    join conversation_members a on a.conversation_id = c.id and a.profile_id = me
    join conversation_members b on b.conversation_id = c.id and b.profile_id = p_other
   where c.kind = 'direct' limit 1;
  if cid is null then
    insert into conversations (kind, created_by) values ('direct', me) returning id into cid;
    insert into conversation_members (conversation_id, profile_id, last_read_at) values (cid, me, now()), (cid, p_other, null);
  end if;
  return cid;
end $$;
-- Groupe créé par un cavalier
create or replace function public.create_group(p_title text, p_members uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if not public.is_member() then raise exception 'Accès refusé'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Donne un nom au groupe'; end if;
  insert into conversations (kind, title, created_by) values ('group', left(trim(p_title), 60), me) returning id into cid;
  insert into conversation_members (conversation_id, profile_id, last_read_at)
  select cid, x, case when x = me then now() end
    from (select distinct unnest(array_append(p_members, me)) x) t
   where exists (select 1 from profiles where id = x and role in ('admin','proprietaire','dp'));
  return cid;
end $$;
grant execute on function public.get_or_create_direct(uuid) to authenticated;
grant execute on function public.create_group(text, uuid[]) to authenticated;
grant execute on function public.purge_old_chats() to authenticated;

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'nouveau')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Personne ne peut changer son propre rôle ni son compteur d'essais (sauf admin ou via le code PIN)
create or replace function public.protect_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('lbg.claiming', true), '') = '1' then return new; end if;
  if public.is_admin() then
    if new.role is distinct from old.role then
      new.claim_failures := 0;
      new.archived_at := case when new.role = 'archive' then now() else null end;
    end if;
    return new;
  end if;
  if new.role is distinct from old.role then raise exception 'Changement de rôle non autorisé'; end if;
  new.claim_failures := old.claim_failures;
  new.archived_at := old.archived_at;
  return new;
end $$;
drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles for each row execute function public.protect_role();

-- Connexion « prénom + code PIN » : à la 1re connexion, vérifie le code avant de créer le compte.
-- Renvoie 'ok', 'inconnu' (prénom ou code faux, sans dire lequel) ou 'bloque' (8 erreurs).
create or replace function public.check_first_login(p_login text, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare inv invitations;
begin
  select * into inv from invitations
   where login = lower(trim(p_login)) and used_by is null and created_at > now() - interval '30 days';
  if not found then return 'inconnu'; end if;
  if inv.failures >= 8 then return 'bloque'; end if;
  if inv.code <> upper(regexp_replace(p_code, '\s', '', 'g')) then
    update invitations set failures = failures + 1 where id = inv.id;
    return case when inv.failures + 1 >= 8 then 'bloque' else 'inconnu' end;
  end if;
  return 'ok';
end $$;
grant execute on function public.check_first_login(text, text) to anon, authenticated;

-- Relie le compte (créé avec le prénom + code PIN) à l'écurie : rôle, chevaux, DP/TP, cours.
-- Renvoie 'ok', 'invalide:<essais restants>' ou 'bloque' (5 essais maximum par compte).
drop function if exists public.check_invitation(text);
drop function if exists public.claim_invitation(text, text, text);
create or replace function public.claim_invitation(p_code text, p_full_name text default null, p_phone text default null)
returns text language plpgsql security definer set search_path = public as $$
declare inv invitations; uid uuid := auth.uid(); fails int; ok boolean; my_login text;
begin
  if uid is null then raise exception 'Connecte-toi d''abord'; end if;
  select claim_failures into fails from profiles where id = uid;
  if coalesce(fails, 0) >= 5 then return 'bloque'; end if;
  select split_part(email, '@', 1) into my_login from auth.users where id = uid;
  select * into inv from invitations
   where code = upper(trim(p_code)) and used_by is null and created_at > now() - interval '30 days'
     and (login is null or login = my_login) for update;
  ok := found;
  perform set_config('lbg.claiming', '1', true);
  if not ok then
    update profiles set claim_failures = claim_failures + 1 where id = uid returning claim_failures into fails;
    return case when fails >= 5 then 'bloque' else 'invalide:' || (5 - fails) end;
  end if;
  update profiles set role = inv.role, claim_failures = 0,
         full_name = inv.full_name,
         login = coalesce(inv.login, my_login), login_label = coalesce(inv.login_label, inv.full_name),
         phone = coalesce(nullif(trim(p_phone), ''), inv.phone, phone),
         email = null
   where id = uid;
  if inv.role = 'dp' then
    insert into horse_riders (horse_id, profile_id, kind)
    select h, uid, coalesce(inv.rider_kind, 'DP') from unnest(inv.horse_ids) h
    on conflict do nothing;
  else  -- propriétaire ou admin : devient propriétaire de ses chevaux
    update horses set owner_id = uid where id = any(inv.horse_ids);
  end if;
  insert into horse_riders (horse_id, profile_id, kind)
  select h, uid, coalesce(inv.rider_kind, 'DP') from unnest(coalesce(inv.ride_ids, '{}')) h
  on conflict do nothing;
  -- inscription automatique aux cours réguliers prévus
  insert into event_participants (event_id, profile_id, status)
  select e.id, uid, 'inscrit' from events e
   where e.series_id = any(coalesce(inv.series_ids, '{}')) and e.date >= current_date
  on conflict do nothing;
  update invitations set used_by = uid, used_at = now() where id = inv.id;
  return 'ok';
end $$;
-- Code PIN oublié : l'admin en génère un nouveau (l'ancien ne marche plus)
create or replace function public.admin_reset_pin(p_profile uuid)
returns text language plpgsql security definer set search_path = public as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text := ''; b bytea := extensions.gen_random_bytes(6); i int;
begin
  if not public.is_admin() then raise exception 'Réservé à l''admin'; end if;
  for i in 0..5 loop c := c || substr(a, 1 + (get_byte(b, i) % length(a)), 1); end loop;
  update auth.users set encrypted_password = extensions.crypt(c, extensions.gen_salt('bf')), updated_at = now() where id = p_profile;
  if not found then raise exception 'Ce membre n''a pas encore de compte : renvoie-lui son code PIN d''origine (onglet Codes PIN).'; end if;
  return c;
end $$;
revoke execute on function public.admin_reset_pin(uuid) from public, anon;
grant execute on function public.admin_reset_pin(uuid) to authenticated;
revoke execute on function public.claim_invitation(text, text, text) from public, anon;
grant execute on function public.claim_invitation(text, text, text) to authenticated;

-- Le propriétaire « signe » (lit et accepte) un document, avec horodatage
create or replace function public.accept_document(p_id uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare d documents;
begin
  select * into d from documents where id = p_id;
  if not found or d.horse_id is null or not public.can_manage_horse(d.horse_id) then raise exception 'Document introuvable'; end if;
  if d.accepted_at is not null then raise exception 'Déjà accepté'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Indique ton nom'; end if;
  update documents set accepted_at = now(), accepted_by = auth.uid(), accepted_name = trim(p_name) where id = p_id;
end $$;
grant execute on function public.accept_document(uuid, text) to authenticated;

-- ─────────────────────────── SÉCURITÉ (RLS) ───────────────────────────
alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.horses enable row level security;
alter table public.horse_riders enable row level security;
alter table public.health_events enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.presences enable row level security;
alter table public.suggestions enable row level security;
alter table public.suggestion_votes enable row level security;
alter table public.posts enable row level security;
alter table public.contacts enable row level security;
alter table public.settings enable row level security;
alter table public.documents enable row level security;
alter table public.event_messages enable row level security;
alter table public.chat_reads enable row level security;
alter table public.event_links enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- Profils : visibles par les membres (annuaire), modifiables par soi-même ou l'admin
drop policy if exists profiles_sel on public.profiles;
create policy profiles_sel on public.profiles for select to authenticated using (public.is_member() or id = auth.uid());
drop policy if exists profiles_upd on public.profiles;
create policy profiles_upd on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_del on public.profiles;
create policy profiles_del on public.profiles for delete to authenticated using (public.is_admin());

-- Codes d'accès : admin uniquement
drop policy if exists inv_all on public.invitations;
create policy inv_all on public.invitations for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Chevaux : tout le monde voit la liste ; le propriétaire et l'admin modifient
drop policy if exists horses_sel on public.horses;
create policy horses_sel on public.horses for select to authenticated using (public.is_member());
drop policy if exists horses_ins on public.horses;
create policy horses_ins on public.horses for insert to authenticated with check (public.is_admin() or (public.is_member() and owner_id = auth.uid()));
drop policy if exists horses_upd on public.horses;
create policy horses_upd on public.horses for update to authenticated using (public.can_manage_horse(id));
drop policy if exists horses_del on public.horses;
create policy horses_del on public.horses for delete to authenticated using (public.is_admin());

drop policy if exists riders_sel on public.horse_riders;
create policy riders_sel on public.horse_riders for select to authenticated using (public.is_member());
drop policy if exists riders_ins on public.horse_riders;
create policy riders_ins on public.horse_riders for insert to authenticated with check (public.can_manage_horse(horse_id));
drop policy if exists riders_upd on public.horse_riders;
create policy riders_upd on public.horse_riders for update to authenticated using (public.can_manage_horse(horse_id));
drop policy if exists riders_del on public.horse_riders;
create policy riders_del on public.horse_riders for delete to authenticated using (public.can_manage_horse(horse_id));

-- Carnet de santé : admin, propriétaire et DP/TP du cheval uniquement
drop policy if exists health_sel on public.health_events;
create policy health_sel on public.health_events for select to authenticated using (public.can_see_horse(horse_id));
-- les vaccins (et leurs rappels) ne sont saisis / modifiés que par l'admin
drop policy if exists health_ins on public.health_events;
create policy health_ins on public.health_events for insert to authenticated with check (public.can_see_horse(horse_id) and (type <> 'vaccin' or public.is_admin()));
drop policy if exists health_upd on public.health_events;
create policy health_upd on public.health_events for update to authenticated using (public.can_see_horse(horse_id) and (type <> 'vaccin' or public.is_admin())) with check (type <> 'vaccin' or public.is_admin());
drop policy if exists health_del on public.health_events;
create policy health_del on public.health_events for delete to authenticated using ((public.can_manage_horse(horse_id) or created_by = auth.uid()) and (type <> 'vaccin' or public.is_admin()));

-- Planning : lisible par tous les membres, événements créés par l'admin
drop policy if exists events_sel on public.events;
create policy events_sel on public.events for select to authenticated using (public.is_member());
-- les cavaliers peuvent proposer leurs propres balades (type « sortie »)
drop policy if exists events_ins on public.events;
create policy events_ins on public.events for insert to authenticated with check (public.is_admin() or (public.is_member() and type = 'sortie' and created_by = auth.uid()));
drop policy if exists events_upd on public.events;
create policy events_upd on public.events for update to authenticated using (public.is_admin() or created_by = auth.uid()) with check (public.is_admin() or (type = 'sortie' and created_by = auth.uid()));
drop policy if exists events_del on public.events;
create policy events_del on public.events for delete to authenticated using (public.is_admin() or created_by = auth.uid());

-- Inscriptions : chacun gère la sienne, l'admin gère tout
drop policy if exists parts_sel on public.event_participants;
create policy parts_sel on public.event_participants for select to authenticated using (public.is_member());
drop policy if exists parts_ins on public.event_participants;
create policy parts_ins on public.event_participants for insert to authenticated with check (public.is_admin() or (public.is_member() and profile_id = auth.uid() and public.event_joinable(event_id)));
drop policy if exists parts_upd on public.event_participants;
create policy parts_upd on public.event_participants for update to authenticated using (public.is_admin() or profile_id = auth.uid());
drop policy if exists parts_del on public.event_participants;
create policy parts_del on public.event_participants for delete to authenticated using (public.is_admin() or profile_id = auth.uid());

drop policy if exists pres_sel on public.presences;
create policy pres_sel on public.presences for select to authenticated using (public.is_member());
drop policy if exists pres_ins on public.presences;
create policy pres_ins on public.presences for insert to authenticated with check (public.is_admin() or (public.is_member() and profile_id = auth.uid()));
drop policy if exists pres_upd on public.presences;
create policy pres_upd on public.presences for update to authenticated using (public.is_admin() or profile_id = auth.uid());
drop policy if exists pres_del on public.presences;
create policy pres_del on public.presences for delete to authenticated using (public.is_admin() or profile_id = auth.uid());

-- Boîte à idées
drop policy if exists sugg_sel on public.suggestions;
create policy sugg_sel on public.suggestions for select to authenticated using (public.is_member());
drop policy if exists sugg_ins on public.suggestions;
create policy sugg_ins on public.suggestions for insert to authenticated with check (public.is_member() and author_id = auth.uid());
drop policy if exists sugg_upd on public.suggestions;
create policy sugg_upd on public.suggestions for update to authenticated using (public.is_admin() or author_id = auth.uid());
drop policy if exists sugg_del on public.suggestions;
create policy sugg_del on public.suggestions for delete to authenticated using (public.is_admin() or author_id = auth.uid());
drop policy if exists votes_sel on public.suggestion_votes;
create policy votes_sel on public.suggestion_votes for select to authenticated using (public.is_member());
drop policy if exists votes_ins on public.suggestion_votes;
create policy votes_ins on public.suggestion_votes for insert to authenticated with check (public.is_member() and profile_id = auth.uid());
drop policy if exists votes_del on public.suggestion_votes;
create policy votes_del on public.suggestion_votes for delete to authenticated using (profile_id = auth.uid());

-- Annonces, modes d'emploi, contacts pros : lecture membres, écriture admin
drop policy if exists posts_sel on public.posts;
create policy posts_sel on public.posts for select to authenticated using (public.is_member());
drop policy if exists posts_w on public.posts;
create policy posts_w on public.posts for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists contacts_sel on public.contacts;
create policy contacts_sel on public.contacts for select to authenticated using (public.is_member());
drop policy if exists contacts_w on public.contacts;
create policy contacts_w on public.contacts for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Contrats et documents : admin + propriétaire du cheval (pas les DP/TP)
drop policy if exists docs_sel on public.documents;
create policy docs_sel on public.documents for select to authenticated using (public.is_admin() or (horse_id is not null and public.can_manage_horse(horse_id)));
drop policy if exists docs_ins on public.documents;
create policy docs_ins on public.documents for insert to authenticated with check (public.is_admin() or (horse_id is not null and public.can_manage_horse(horse_id) and needs_acceptance = false));
drop policy if exists docs_upd on public.documents;
create policy docs_upd on public.documents for update to authenticated using (public.is_admin());
drop policy if exists docs_del on public.documents;
create policy docs_del on public.documents for delete to authenticated using (public.is_admin() or (created_by = auth.uid() and accepted_at is null));

-- Discussions : seulement les inscrits de l'événement (+ l'admin, + les personnes @mentionnées pour leur invitation)
drop policy if exists msg_sel on public.event_messages;
create policy msg_sel on public.event_messages for select to authenticated using (public.is_admin() or public.in_event(event_id) or auth.uid() = any(mentions));
drop policy if exists msg_ins on public.event_messages;
create policy msg_ins on public.event_messages for insert to authenticated with check (public.is_member() and author_id = auth.uid() and (public.in_event(event_id) or public.is_admin()) and public.chat_open(event_id));
drop policy if exists msg_del on public.event_messages;
create policy msg_del on public.event_messages for delete to authenticated using (public.is_admin() or author_id = auth.uid());
drop policy if exists reads_all on public.chat_reads;
create policy reads_all on public.chat_reads for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
-- Liens photos : visibles par tous les membres, gardés après l'événement
drop policy if exists links_sel on public.event_links;
create policy links_sel on public.event_links for select to authenticated using (public.is_member());
drop policy if exists links_ins on public.event_links;
create policy links_ins on public.event_links for insert to authenticated with check (public.is_member() and author_id = auth.uid());
drop policy if exists links_del on public.event_links;
create policy links_del on public.event_links for delete to authenticated using (public.is_admin() or author_id = auth.uid());

-- Messages privés et groupes : uniquement les membres de la conversation (pas même l'admin)
drop policy if exists conv_sel on public.conversations;
create policy conv_sel on public.conversations for select to authenticated using (public.is_conv_member(id));
drop policy if exists conv_upd on public.conversations;
create policy conv_upd on public.conversations for update to authenticated using (created_by = auth.uid() and kind = 'group');
drop policy if exists conv_del on public.conversations;
create policy conv_del on public.conversations for delete to authenticated using (created_by = auth.uid() and kind = 'group');
drop policy if exists cm_sel on public.conversation_members;
create policy cm_sel on public.conversation_members for select to authenticated using (public.is_conv_member(conversation_id));
drop policy if exists cm_ins on public.conversation_members;
create policy cm_ins on public.conversation_members for insert to authenticated with check (public.is_member() and public.is_conv_member(conversation_id)
  and exists (select 1 from conversations c where c.id = conversation_id and c.kind = 'group')
  and exists (select 1 from profiles p where p.id = profile_id and p.role in ('admin','proprietaire','dp')));
drop policy if exists cm_upd on public.conversation_members;
create policy cm_upd on public.conversation_members for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists cm_del on public.conversation_members;
create policy cm_del on public.conversation_members for delete to authenticated using (profile_id = auth.uid()
  or exists (select 1 from conversations c where c.id = conversation_id and c.created_by = auth.uid() and c.kind = 'group'));
drop policy if exists dm_sel on public.messages;
create policy dm_sel on public.messages for select to authenticated using (public.is_conv_member(conversation_id));
drop policy if exists dm_ins on public.messages;
create policy dm_ins on public.messages for insert to authenticated with check (public.is_member() and author_id = auth.uid() and public.is_conv_member(conversation_id));
drop policy if exists dm_del on public.messages;
create policy dm_del on public.messages for delete to authenticated using (author_id = auth.uid());

-- Paramètres du registre d'élevage : admin
drop policy if exists settings_all on public.settings;
create policy settings_all on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────── PHOTOS DES CHEVAUX ───────────────────────────
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;
drop policy if exists photos_sel on storage.objects;
create policy photos_sel on storage.objects for select using (bucket_id = 'photos');
drop policy if exists photos_ins on storage.objects;
create policy photos_ins on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_member());
drop policy if exists photos_upd on storage.objects;
create policy photos_upd on storage.objects for update to authenticated using (bucket_id = 'photos' and public.is_member());

-- ─────────────────────────── DOCUMENTS PRIVÉS (contrats…) ───────────────────────────
-- Rangement : documents/<id du cheval>/<fichier>. Jamais public : liens temporaires uniquement.
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
drop policy if exists documents_sel on storage.objects;
create policy documents_sel on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (public.is_admin() or public.can_manage_horse(((storage.foldername(name))[1])::uuid)));
drop policy if exists documents_ins on storage.objects;
create policy documents_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (public.is_admin() or public.can_manage_horse(((storage.foldername(name))[1])::uuid)));
drop policy if exists documents_del on storage.objects;
create policy documents_del on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_admin());

-- ─────────────────────────── TEMPS RÉEL & NETTOYAGE ───────────────────────────
-- Messages instantanés dans les discussions
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.event_messages; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  end if;
end $$;
-- Effacement automatique chaque nuit (03h15) : discussions d'événements 2 jours après, tous les messages après 30 jours.
-- (Si pg_cron n'est pas disponible, l'appli fait aussi le ménage à chaque connexion.)
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('lbg-purge-chats', '15 3 * * *', 'select public.purge_old_chats()');
exception when others then raise notice 'pg_cron indisponible : %', sqlerrm;
end $$;
