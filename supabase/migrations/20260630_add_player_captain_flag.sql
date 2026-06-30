alter table public.players
add column if not exists is_captain boolean not null default false;
