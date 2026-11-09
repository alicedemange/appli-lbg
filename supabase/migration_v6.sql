-- Mise à jour v6 — UNIQUEMENT si la base était déjà installée avant l'import des vraies données (10/11/2026)
-- Codes PIN plus complets : téléphone pré-rempli, chevaux montés, cours réguliers.
alter table public.invitations add column if not exists ride_ids uuid[] default '{}';
alter table public.invitations add column if not exists series_ids uuid[] default '{}';
alter table public.invitations add column if not exists phone text;

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
         phone = coalesce(nullif(trim(p_phone), ''), inv.phone, phone),
         email = (select email from auth.users where id = uid)
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
revoke execute on function public.claim_invitation(text, text, text) from public, anon;
grant execute on function public.claim_invitation(text, text, text) to authenticated;

