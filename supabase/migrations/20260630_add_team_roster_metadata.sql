alter table public.teams
add column if not exists sort_order integer not null default 999;

alter table public.players
add column if not exists playtime text not null default '';

alter table public.players
add column if not exists fav_weapon text not null default '';

alter table public.players
add column if not exists roster_order integer not null default 999;

update public.players
set active = false;

insert into public.teams (slug, name, subtitle, logo_url, sort_order)
values
  ('dd', 'DDTEAM', '', '', 1),
  ('off9', 'OFF9', '', '', 2),
  ('k7', 'K7', '', '', 3),
  ('altz', 'ALTZ', '', '', 4),
  ('kpm', 'KPM', '', '', 5),
  ('bk', 'BURGERKING', '', '', 6)
on conflict (slug) do update
set
  name = excluded.name,
  subtitle = excluded.subtitle,
  logo_url = excluded.logo_url,
  sort_order = excluded.sort_order;

with team_map as (
  select id, slug
  from public.teams
  where slug in ('dd', 'off9', 'k7', 'altz', 'kpm', 'bk')
)
insert into public.players (slug, display_name, team_id, roster_order, active)
values
  ('takumi', 'Takumi', (select id from team_map where slug = 'dd'), 1, true),
  ('s1mp1k', 's1mp1k', (select id from team_map where slug = 'dd'), 2, true),
  ('igrok6574', 'igrok6574', (select id from team_map where slug = 'dd'), 3, true),
  ('kstr', 'KSTR', (select id from team_map where slug = 'dd'), 4, true),

  ('crazy_crib', 'crazy_crib', (select id from team_map where slug = 'off9'), 1, true),
  ('loss', 'loss', (select id from team_map where slug = 'off9'), 2, true),
  ('zero', 'Zero', (select id from team_map where slug = 'off9'), 3, true),
  ('deadseeker7249', 'deadseeker7249', (select id from team_map where slug = 'off9'), 4, true),

  ('krikkk', 'KriKkK', (select id from team_map where slug = 'k7'), 1, true),
  ('lam4uk', 'lam4uk', (select id from team_map where slug = 'k7'), 2, true),
  ('zuub', 'ZuuB', (select id from team_map where slug = 'k7'), 3, true),
  ('strew', 'strew', (select id from team_map where slug = 'k7'), 4, true),

  ('11mn0td', '11mn0td', (select id from team_map where slug = 'altz'), 1, true),
  ('plague', 'plague', (select id from team_map where slug = 'altz'), 2, true),
  ('febet', 'FEBET', (select id from team_map where slug = 'altz'), 3, true),
  ('blessed', 'Blessed', (select id from team_map where slug = 'altz'), 4, true),

  ('klat4er', 'Klat4er', (select id from team_map where slug = 'kpm'), 1, true),
  ('sanoko', 'sanoko', (select id from team_map where slug = 'kpm'), 2, true),
  ('penne', 'Penne', (select id from team_map where slug = 'kpm'), 3, true),
  ('z3rtty', 'z3rtty', (select id from team_map where slug = 'kpm'), 4, true),

  ('minor', 'minor-', (select id from team_map where slug = 'bk'), 1, true),
  ('han4k', 'han4k', (select id from team_map where slug = 'bk'), 2, true),
  ('win_dizel', 'WIN_Dizel', (select id from team_map where slug = 'bk'), 3, true),
  ('ds_swanson', 'ds_swanson', (select id from team_map where slug = 'bk'), 4, true)
on conflict (slug) do update
set
  display_name = excluded.display_name,
  team_id = excluded.team_id,
  roster_order = excluded.roster_order,
  active = excluded.active;
