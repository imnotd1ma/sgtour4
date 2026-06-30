create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  discord_user_id text not null unique,
  username text not null,
  display_name text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  logo_url text not null default '',
  subtitle text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null unique,
  team_id uuid references public.teams(id) on delete set null,
  image_url text not null default '',
  role text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matches (
  id text primary key,
  title text not null,
  sort_order integer not null unique,
  stage_number smallint not null check (stage_number >= 1),
  status text not null default 'upcoming' check (status in ('upcoming', 'scheduled', 'active', 'completed')),
  format text not null default 'BO3' check (format in ('BO1', 'BO3')),
  team_a_name text not null,
  team_b_name text not null,
  score_options text[] not null default array['2:0', '2:1']::text[],
  scheduled_at timestamptz,
  result_winner text,
  result_score text,
  result_best_player text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.match_scoring_rules (
  rule_key text primary key check (rule_key in ('winner', 'exact_score', 'best_player')),
  points integer not null check (points >= 0)
);

create table public.match_predictions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id text not null references public.matches(id) on delete cascade,
  winner text not null,
  score text not null,
  best_player text not null,
  submitted_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create table public.tournament_scoring_rules (
  field text primary key check (
    field in (
      'champion_team',
      'mvp_player',
      'best_kd_player',
      'worst_kd_player',
      'frag_leader',
      'assist_leader',
      'most_frequent_map',
      'most_infrequent_map'
    )
  ),
  points integer not null check (points >= 0)
);

create table public.tournament_results (
  tournament_key text primary key default 'default',
  champion_team text,
  mvp_player text,
  best_kd_player text,
  worst_kd_player text,
  frag_leader text,
  assist_leader text,
  most_frequent_map text,
  most_infrequent_map text,
  updated_at timestamptz not null default now()
);

create table public.tournament_predictions (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  champion_team text not null,
  mvp_player text not null,
  best_kd_player text not null,
  worst_kd_player text not null,
  frag_leader text not null,
  assist_leader text not null,
  most_frequent_map text not null,
  most_infrequent_map text not null,
  submitted_at timestamptz not null default now()
);

create table public.player_ratings (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  rating_round smallint not null check (rating_round between 1 and 5),
  match_id text references public.matches(id) on delete set null,
  rating numeric(6, 2) not null,
  rated_at timestamptz not null default now(),
  unique (player_id, rating_round)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger teams_set_updated_at
before update on public.teams
for each row
execute function public.set_updated_at();

create trigger players_set_updated_at
before update on public.players
for each row
execute function public.set_updated_at();

create trigger matches_set_updated_at
before update on public.matches
for each row
execute function public.set_updated_at();

insert into public.match_scoring_rules (rule_key, points)
values
  ('winner', 2),
  ('exact_score', 2),
  ('best_player', 1);

insert into public.tournament_scoring_rules (field, points)
values
  ('champion_team', 8),
  ('mvp_player', 5),
  ('best_kd_player', 3),
  ('worst_kd_player', 2),
  ('frag_leader', 3),
  ('assist_leader', 2),
  ('most_frequent_map', 3),
  ('most_infrequent_map', 2);

insert into public.tournament_results (tournament_key)
values ('default');

insert into public.teams (slug, name)
values
  ('pv', 'PEPEVISION'),
  ('loss', 'LOSSTEAM'),
  ('cz9', 'CZ9'),
  ('zbc', 'ZBc'),
  ('dq', 'DQTEAM'),
  ('amk', 'AMK'),
  ('klb', 'KLB'),
  ('egz', 'EGZ');

with team_map as (
  select slug, id
  from public.teams
)
insert into public.players (slug, display_name, team_id)
values
  ('imnotdima', 'ImNotDima', (select id from team_map where slug = 'pv')),
  ('s1mp1k', 's1mp1k', (select id from team_map where slug = 'amk')),
  ('ds_swanson', 'ds_swanson', null),
  ('zero', 'Zero', (select id from team_map where slug = 'egz')),
  ('loss', 'Loss', (select id from team_map where slug = 'loss')),
  ('han4k', 'han4k', (select id from team_map where slug = 'amk')),
  ('win_dizel', 'WIN_Dizel', (select id from team_map where slug = 'loss')),
  ('krikkk', 'KriKkK', (select id from team_map where slug = 'dq')),
  ('crazy_crib', 'Crazy_crib', (select id from team_map where slug = 'cz9')),
  ('mexa', 'Mexa', (select id from team_map where slug = 'cz9')),
  ('egor_t', 'Egor T.', (select id from team_map where slug = 'egz')),
  ('lam4uk', 'lam4uk', (select id from team_map where slug = 'pv')),
  ('semen', 'semen', null),
  ('klat4er', 'Klat4er', (select id from team_map where slug = 'klb')),
  ('strew', 'strew', null),
  ('igrok6574', 'igrok6574', (select id from team_map where slug = 'dq')),
  ('quzzix', 'Quzzix', null),
  ('dev1n', 'Dev1n', null),
  ('little', 'Little', null),
  ('davidosik', 'Davidosik', null),
  ('azbuca', 'azbuca', null),
  ('mamont_pirce', 'mamont_pirce', null),
  ('patoshka', 'Patoshka', null),
  ('megaglist', 'Megaglist', null),
  ('takumi', 'Takumi', (select id from team_map where slug = 'zbc')),
  ('pasha', 'Pasha', (select id from team_map where slug = 'zbc')),
  ('bulava', 'Bulava', (select id from team_map where slug = 'klb'));

insert into public.matches (
  id,
  title,
  sort_order,
  stage_number,
  status,
  format,
  team_a_name,
  team_b_name
)
values
  ('pv-loss', 'PEPEVISION vs LOSSTEAM', 1, 1, 'upcoming', 'BO3', 'PEPEVISION', 'LOSSTEAM'),
  ('cz9-zbc', 'CZ9 vs ZBc', 2, 1, 'upcoming', 'BO3', 'CZ9', 'ZBc'),
  ('dq-amk', 'DQTEAM vs AMK', 3, 1, 'upcoming', 'BO3', 'DQTEAM', 'AMK'),
  ('loss-zbc', 'LOSSTEAM vs ZBc', 4, 2, 'upcoming', 'BO3', 'LOSSTEAM', 'ZBc'),
  ('pv-dq', 'PEPEVISION vs DQTEAM', 5, 2, 'upcoming', 'BO3', 'PEPEVISION', 'DQTEAM'),
  ('cz9-amk', 'CZ9 vs AMK', 6, 2, 'upcoming', 'BO3', 'CZ9', 'AMK'),
  ('loss-cz9', 'LOSSTEAM vs CZ9', 7, 3, 'upcoming', 'BO3', 'LOSSTEAM', 'CZ9'),
  ('pv-amk', 'PEPEVISION vs AMK', 8, 3, 'upcoming', 'BO3', 'PEPEVISION', 'AMK'),
  ('zbc-dq', 'ZBc vs DQTEAM', 9, 3, 'upcoming', 'BO3', 'ZBc', 'DQTEAM'),
  ('loss-dq', 'LOSSTEAM vs DQTEAM', 10, 4, 'upcoming', 'BO3', 'LOSSTEAM', 'DQTEAM'),
  ('pv-cz9', 'PEPEVISION vs CZ9', 11, 4, 'upcoming', 'BO3', 'PEPEVISION', 'CZ9'),
  ('zbc-amk', 'ZBc vs AMK', 12, 4, 'upcoming', 'BO3', 'ZBc', 'AMK'),
  ('loss-amk', 'LOSSTEAM vs AMK', 13, 5, 'upcoming', 'BO3', 'LOSSTEAM', 'AMK'),
  ('pv-zbc', 'PEPEVISION vs ZBc', 14, 5, 'upcoming', 'BO3', 'PEPEVISION', 'ZBc'),
  ('cz9-dq', 'CZ9 vs DQTEAM', 15, 5, 'upcoming', 'BO3', 'CZ9', 'DQTEAM');

create or replace view public.v_match_prediction_feed as
select
  mp.id,
  p.discord_user_id as user_id,
  p.username,
  p.display_name as name,
  p.avatar_url,
  mp.match_id,
  m.title as match_title,
  mp.winner,
  mp.score,
  mp.best_player as best,
  mp.submitted_at,
  m.sort_order
from public.match_predictions mp
join public.profiles p on p.id = mp.user_id
join public.matches m on m.id = mp.match_id;

create or replace view public.v_tournament_prediction_feed as
select
  tp.id,
  p.discord_user_id as user_id,
  p.username,
  p.display_name as name,
  p.avatar_url,
  tp.champion_team,
  tp.mvp_player,
  tp.best_kd_player,
  tp.worst_kd_player,
  tp.frag_leader,
  tp.assist_leader,
  tp.most_frequent_map,
  tp.most_infrequent_map,
  tp.submitted_at
from public.tournament_predictions tp
join public.profiles p on p.id = tp.user_id;

create or replace view public.v_player_rating_summary as
select
  pl.display_name as player,
  round(avg(pr.rating)::numeric, 2) as average_rating,
  max(pr.rating) filter (where pr.rating_round = 1) as match1,
  max(pr.rating) filter (where pr.rating_round = 2) as match2,
  max(pr.rating) filter (where pr.rating_round = 3) as match3,
  max(pr.rating) filter (where pr.rating_round = 4) as match4,
  max(pr.rating) filter (where pr.rating_round = 5) as match5
from public.players pl
left join public.player_ratings pr on pr.player_id = pl.id
group by pl.display_name;

create or replace view public.v_tournament_results_status as
select
  tr.tournament_key,
  tr.champion_team,
  tr.mvp_player,
  tr.best_kd_player,
  tr.worst_kd_player,
  tr.frag_leader,
  tr.assist_leader,
  tr.most_frequent_map,
  tr.most_infrequent_map,
  (
    tr.champion_team is not null
    and tr.mvp_player is not null
    and tr.best_kd_player is not null
    and tr.worst_kd_player is not null
    and tr.frag_leader is not null
    and tr.assist_leader is not null
    and tr.most_frequent_map is not null
    and tr.most_infrequent_map is not null
  ) as results_available,
  (
    select coalesce(sum(points), 0)
    from public.tournament_scoring_rules
  ) as max_points,
  tr.updated_at
from public.tournament_results tr
where tr.tournament_key = 'default';

create or replace view public.v_match_leaderboard as
with scored as (
  select
    p.discord_user_id as user_id,
    coalesce(nullif(p.username, ''), nullif(p.display_name, ''), 'Unknown') as username,
    p.avatar_url,
    sum(
      case
        when lower(btrim(mp.winner)) = lower(btrim(m.result_winner))
          then coalesce((select points from public.match_scoring_rules where rule_key = 'winner'), 0)
        else 0
      end
      +
      case
        when m.format = 'BO3'
          and m.result_score is not null
          and lower(btrim(mp.score)) = lower(btrim(m.result_score))
          then coalesce((select points from public.match_scoring_rules where rule_key = 'exact_score'), 0)
        else 0
      end
      +
      case
        when lower(btrim(mp.best_player)) = lower(btrim(m.result_best_player))
          then coalesce((select points from public.match_scoring_rules where rule_key = 'best_player'), 0)
        else 0
      end
    ) as points
  from public.match_predictions mp
  join public.profiles p on p.id = mp.user_id
  join public.matches m on m.id = mp.match_id
  where m.result_winner is not null
    and m.result_best_player is not null
    and (m.format = 'BO1' or m.result_score is not null)
  group by p.discord_user_id, p.username, p.display_name, p.avatar_url
)
select
  row_number() over (order by scored.points desc, scored.username asc) as place,
  scored.username,
  scored.user_id,
  scored.avatar_url,
  scored.points
from scored;

create or replace view public.v_tournament_scores as
select
  p.discord_user_id as user_id,
  coalesce(nullif(p.username, ''), nullif(p.display_name, ''), 'Unknown') as username,
  p.display_name as name,
  p.avatar_url,
  trs.results_available,
  case
    when trs.results_available then
      (case when lower(btrim(tp.champion_team)) = lower(btrim(trs.champion_team)) then (select points from public.tournament_scoring_rules where field = 'champion_team') else 0 end) +
      (case when lower(btrim(tp.mvp_player)) = lower(btrim(trs.mvp_player)) then (select points from public.tournament_scoring_rules where field = 'mvp_player') else 0 end) +
      (case when lower(btrim(tp.best_kd_player)) = lower(btrim(trs.best_kd_player)) then (select points from public.tournament_scoring_rules where field = 'best_kd_player') else 0 end) +
      (case when lower(btrim(tp.worst_kd_player)) = lower(btrim(trs.worst_kd_player)) then (select points from public.tournament_scoring_rules where field = 'worst_kd_player') else 0 end) +
      (case when lower(btrim(tp.frag_leader)) = lower(btrim(trs.frag_leader)) then (select points from public.tournament_scoring_rules where field = 'frag_leader') else 0 end) +
      (case when lower(btrim(tp.assist_leader)) = lower(btrim(trs.assist_leader)) then (select points from public.tournament_scoring_rules where field = 'assist_leader') else 0 end) +
      (case when lower(btrim(tp.most_frequent_map)) = lower(btrim(trs.most_frequent_map)) then (select points from public.tournament_scoring_rules where field = 'most_frequent_map') else 0 end) +
      (case when lower(btrim(tp.most_infrequent_map)) = lower(btrim(trs.most_infrequent_map)) then (select points from public.tournament_scoring_rules where field = 'most_infrequent_map') else 0 end)
    else 0
  end as total_points
from public.tournament_predictions tp
join public.profiles p on p.id = tp.user_id
cross join public.v_tournament_results_status trs;

create or replace view public.v_combined_leaderboard as
with user_pool as (
  select
    ml.user_id,
    ml.username,
    ml.avatar_url
  from public.v_match_leaderboard ml
  union
  select
    ts.user_id,
    ts.username,
    ts.avatar_url
  from public.v_tournament_scores ts
),
scored as (
  select
    up.user_id,
    up.username,
    up.avatar_url,
    coalesce(ml.points, 0) as match_points,
    case
      when trs.results_available then coalesce(ts.total_points, 0)
      else 0
    end as tournament_points
  from user_pool up
  left join public.v_match_leaderboard ml on ml.user_id = up.user_id
  left join public.v_tournament_scores ts on ts.user_id = up.user_id
  cross join public.v_tournament_results_status trs
)
select
  row_number() over (
    order by
      (scored.match_points + scored.tournament_points) desc,
      scored.match_points desc,
      scored.username asc
  ) as place,
  scored.user_id,
  scored.username,
  scored.avatar_url,
  scored.match_points,
  scored.tournament_points,
  scored.match_points + scored.tournament_points as total_points
from scored;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.match_predictions enable row level security;
alter table public.match_scoring_rules enable row level security;
alter table public.tournament_scoring_rules enable row level security;
alter table public.tournament_results enable row level security;
alter table public.tournament_predictions enable row level security;
alter table public.player_ratings enable row level security;
