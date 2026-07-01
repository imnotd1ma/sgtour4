do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matches'
      and column_name = 'stage_number'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matches'
      and column_name = 'round_number'
  ) then
    alter table public.matches rename column stage_number to round_number;
  end if;
end
$$;

alter table public.matches
drop column if exists stage_label;
