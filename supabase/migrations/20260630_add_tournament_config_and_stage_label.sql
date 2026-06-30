alter table public.matches
add column if not exists stage_label text not null default '';

update public.matches
set stage_label = case stage_number
  when 1 then 'Round 1'
  when 2 then 'Round 2'
  when 3 then 'Round 3'
  when 4 then 'Round 4'
  when 5 then 'Round 5'
  else concat('Round ', stage_number)
end
where coalesce(stage_label, '') = '';

create table if not exists public.tournament_settings (
  tournament_key text primary key default 'default',
  predictions_open boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.tournament_settings (tournament_key, predictions_open)
values ('default', false)
on conflict (tournament_key) do nothing;

alter table public.tournament_settings enable row level security;
