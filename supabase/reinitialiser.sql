-- ════════════════════════════════════════════════════════════════════
--  ⚠️ REMISE À ZÉRO de l'appli LBG dans Supabase
--  Efface TOUTES les données de l'appli et TOUS les comptes, sans supprimer le projet
--  (l'adresse et la clé restent les mêmes : config.js ne change pas).
--  Ensuite, lance schema.sql puis seed_lbg.sql.
-- ════════════════════════════════════════════════════════════════════

-- 1. Règles d'accès aux fichiers (photos, documents)
drop policy if exists photos_sel on storage.objects;
drop policy if exists photos_ins on storage.objects;
drop policy if exists photos_upd on storage.objects;
drop policy if exists documents_sel on storage.objects;
drop policy if exists documents_ins on storage.objects;
drop policy if exists documents_del on storage.objects;

-- 2. Tables de l'appli
drop table if exists
  public.messages, public.conversation_members, public.conversations,
  public.event_links, public.chat_reads, public.event_messages,
  public.documents, public.suggestion_votes, public.suggestions,
  public.presences, public.event_participants, public.events,
  public.health_events, public.horse_riders, public.horses,
  public.invitations, public.posts, public.contacts, public.settings,
  public.profiles
cascade;

-- 3. Fonctions de l'appli
drop trigger if exists on_auth_user_created on auth.users;
do $$ declare r record; begin
  for r in select p.oid::regprocedure as f from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname in (
      'is_admin','is_member','can_manage_horse','can_see_horse','event_joinable','in_event','chat_open',
      'purge_old_chats','is_conv_member','get_or_create_direct','create_group','handle_new_user','protect_role',
      'check_first_login','check_invitation','claim_invitation','admin_reset_pin','accept_document')
  loop execute 'drop function if exists ' || r.f || ' cascade'; end loop;
end $$;

-- 4. Comptes créés pendant les essais
delete from auth.users;

-- C'est propre : lance maintenant schema.sql, puis seed_lbg.sql.
