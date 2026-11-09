-- ════════════════════════════════════════════════════════════════════
--  Mise à jour v2 — UNIQUEMENT si tu avais déjà lancé l'ancien schema.sql
--  (contrats, archives, code PIN limité à 5 essais). Sinon, lance juste schema.sql.
-- ════════════════════════════════════════════════════════════════════
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','proprietaire','dp','nouveau','archive'));
alter table public.profiles add column if not exists claim_failures int not null default 0;
alter table public.profiles add column if not exists archived_at timestamptz;

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

alter table public.documents enable row level security;

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

-- Utiliser son code PIN d'accès : donne le rôle + relie les chevaux.
-- Renvoie 'ok', 'invalide:<essais restants>' ou 'bloque' (5 essais maximum par compte).
drop function if exists public.check_invitation(text);
drop function if exists public.claim_invitation(text, text, text);
create or replace function public.claim_invitation(p_code text, p_full_name text default null, p_phone text default null)
returns text language plpgsql security definer set search_path = public as $$
declare inv invitations; uid uuid := auth.uid(); fails int; ok boolean;
begin
  if uid is null then raise exception 'Connecte-toi d''abord'; end if;
  select claim_failures into fails from profiles where id = uid;
  if coalesce(fails, 0) >= 5 then return 'bloque'; end if;
  select * into inv from invitations
   where code = upper(trim(p_code)) and used_by is null and created_at > now() - interval '30 days' for update;
  ok := found;
  perform set_config('lbg.claiming', '1', true);
  if not ok then
    update profiles set claim_failures = claim_failures + 1 where id = uid returning claim_failures into fails;
    return case when fails >= 5 then 'bloque' else 'invalide:' || (5 - fails) end;
  end if;
  update profiles set role = inv.role, claim_failures = 0,
         full_name = coalesce(nullif(trim(p_full_name), ''), inv.full_name),
         phone = coalesce(nullif(trim(p_phone), ''), phone),
         email = (select email from auth.users where id = uid)
   where id = uid;
  if inv.role = 'proprietaire' then
    update horses set owner_id = uid where id = any(inv.horse_ids);
  elsif inv.role = 'dp' then
    insert into horse_riders (horse_id, profile_id, kind)
    select h, uid, coalesce(inv.rider_kind, 'DP') from unnest(inv.horse_ids) h
    on conflict do nothing;
  end if;
  update invitations set used_by = uid, used_at = now() where id = inv.id;
  return 'ok';
end $$;
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

-- Contrats et documents : admin + propriétaire du cheval (pas les DP/TP)
create policy docs_sel on public.documents for select to authenticated using (public.is_admin() or (horse_id is not null and public.can_manage_horse(horse_id)));
create policy docs_ins on public.documents for insert to authenticated with check (public.is_admin() or (horse_id is not null and public.can_manage_horse(horse_id) and needs_acceptance = false));
create policy docs_upd on public.documents for update to authenticated using (public.is_admin());
create policy docs_del on public.documents for delete to authenticated using (public.is_admin() or (created_by = auth.uid() and accepted_at is null));

-- ─────────────────────────── DOCUMENTS PRIVÉS (contrats…) ───────────────────────────
-- Rangement : documents/<id du cheval>/<fichier>. Jamais public : liens temporaires uniquement.
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
create policy documents_sel on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (public.is_admin() or public.can_manage_horse(((storage.foldername(name))[1])::uuid)));
create policy documents_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (public.is_admin() or public.can_manage_horse(((storage.foldername(name))[1])::uuid)));
create policy documents_del on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_admin());
