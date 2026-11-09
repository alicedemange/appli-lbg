-- ════════════════════════════════════════════════════════════════════
--  Mise à jour v5 — UNIQUEMENT si tu avais déjà installé la base avant le 9/11/2026 (soir)
--  Messagerie : messages privés, groupes, effacement après 30 jours.
-- ════════════════════════════════════════════════════════════════════
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
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- Messages privés et groupes : uniquement les membres de la conversation (pas même l'admin)
create policy conv_sel on public.conversations for select to authenticated using (public.is_conv_member(id));
create policy conv_upd on public.conversations for update to authenticated using (created_by = auth.uid() and kind = 'group');
create policy conv_del on public.conversations for delete to authenticated using (created_by = auth.uid() and kind = 'group');
create policy cm_sel on public.conversation_members for select to authenticated using (public.is_conv_member(conversation_id));
create policy cm_ins on public.conversation_members for insert to authenticated with check (public.is_member() and public.is_conv_member(conversation_id)
  and exists (select 1 from conversations c where c.id = conversation_id and c.kind = 'group')
  and exists (select 1 from profiles p where p.id = profile_id and p.role in ('admin','proprietaire','dp')));
create policy cm_upd on public.conversation_members for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy cm_del on public.conversation_members for delete to authenticated using (profile_id = auth.uid()
  or exists (select 1 from conversations c where c.id = conversation_id and c.created_by = auth.uid() and c.kind = 'group'));
create policy dm_sel on public.messages for select to authenticated using (public.is_conv_member(conversation_id));
create policy dm_ins on public.messages for insert to authenticated with check (public.is_member() and author_id = auth.uid() and public.is_conv_member(conversation_id));
create policy dm_del on public.messages for delete to authenticated using (author_id = auth.uid());

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  end if;
end $$;
