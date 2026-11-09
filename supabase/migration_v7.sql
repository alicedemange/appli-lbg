-- Mise à jour v7 — UNIQUEMENT si la base était déjà installée avant le 09/11/2026 (20h)
-- Les vaccins ne peuvent être saisis / modifiés / supprimés que par l'admin.
drop policy if exists health_sel on public.health_events;
drop policy if exists health_ins on public.health_events;
drop policy if exists health_upd on public.health_events;
drop policy if exists health_del on public.health_events;
create policy health_sel on public.health_events for select to authenticated using (public.can_see_horse(horse_id));
-- les vaccins (et leurs rappels) ne sont saisis / modifiés que par l'admin
create policy health_ins on public.health_events for insert to authenticated with check (public.can_see_horse(horse_id) and (type <> 'vaccin' or public.is_admin()));
create policy health_upd on public.health_events for update to authenticated using (public.can_see_horse(horse_id) and (type <> 'vaccin' or public.is_admin())) with check (type <> 'vaccin' or public.is_admin());
create policy health_del on public.health_events for delete to authenticated using ((public.can_manage_horse(horse_id) or created_by = auth.uid()) and (type <> 'vaccin' or public.is_admin()));

