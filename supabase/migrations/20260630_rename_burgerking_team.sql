update public.teams
set name = 'BURGER KING'
where slug = 'bk'
   or name = 'BURGERKING';

update public.matches
set
  team_a_name = case when team_a_name = 'BURGERKING' then 'BURGER KING' else team_a_name end,
  team_b_name = case when team_b_name = 'BURGERKING' then 'BURGER KING' else team_b_name end
where team_a_name = 'BURGERKING'
   or team_b_name = 'BURGERKING';

update public.tournament_predictions
set champion_team = 'BURGER KING'
where champion_team = 'BURGERKING';

update public.tournament_results
set champion_team = 'BURGER KING'
where champion_team = 'BURGERKING';
