alter table public.matches
add column if not exists modal_data jsonb not null default '{}'::jsonb;
