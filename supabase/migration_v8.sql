-- ════════════════════════════════════════════════════════════════════
--  Mise à jour v8 — UNIQUEMENT si la base était déjà installée avant le 09/11/2026 (21h)
--  Connexion par prénom + code PIN (sans e-mail ni mot de passe).
--  ⚠️ Après cette mise à jour, relance le nouveau seed_lbg.sql SEULEMENT sur une base vide.
-- ════════════════════════════════════════════════════════════════════
create extension if not exists pgcrypto with schema extensions;
alter table public.profiles add column if not exists login text unique;
alter table public.profiles add column if not exists login_label text;
alter table public.invitations add column if not exists login text unique;
alter table public.invitations add column if not exists login_label text;
alter table public.invitations add column if not exists failures int not null default 0;

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
