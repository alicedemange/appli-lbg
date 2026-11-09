-- Mise à jour v3 — UNIQUEMENT si tu avais déjà lancé schema.sql avant le 9/11/2026 :
-- ajoute l'heure des RDV soins (maréchal, véto, dentiste…).
alter table public.health_events add column if not exists "time" time;
