# Supabase Migration

Этот проект можно перевести на Supabase полностью, без `appscript.gs`, сохранив текущий frontend-контракт с `mode=...`.

## Что уже подготовлено

- Схема базы и сиды: [supabase/migrations/20260630_initial_schema.sql](/C:/Users/dmitr/vscode_repos/sgtour4/supabase/migrations/20260630_initial_schema.sql)
- Edge Function-замена для Apps Script: [supabase/functions/api/index.ts](/C:/Users/dmitr/vscode_repos/sgtour4/supabase/functions/api/index.ts)

## Что заменяет Supabase

- `submit_prediction`
- `submit_tournament_prediction`
- `submit_player_ratings`
- `leaderboard`
- `predictions`
- `my_predictions`
- `tournament_predictions`
- `my_tournament_predictions`
- `matches`
- `ratings`
- `tournament_scoring`
- `tournament_results`
- `combined_leaderboard`

## Структура данных

- `profiles`: Discord-пользователи сайта
- `teams`: команды турнира
- `players`: игроки
- `matches`: матчи и результаты
- `match_predictions`: обычные предикты
- `tournament_predictions`: турнирные предикты
- `tournament_settings`: настройки турнирных предиктов, включая open/close
- `player_ratings`: оценки игроков по раундам
- `match_scoring_rules`: очки за обычные предикты
- `tournament_scoring_rules`: очки за турнирные предикты
- `tournament_results`: финальные результаты турнира

## Что станет источником истины

- Матчи и статусы живут в `matches`
- Текст для match pill берётся из `matches.modal_data` по карте матча
- Результаты матчей живут в `matches.result_*`
- Лидерборды считаются из `view`, а не сохраняются отдельной таблицей
- Рейтинги игроков считаются из `player_ratings`
- Турнирные результаты живут в `tournament_results`

## Как развернуть

1. Создай проект в Supabase.
2. Прогони SQL из `supabase/migrations/20260630_initial_schema.sql`.
3. Задай secrets для Edge Function:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AUTH_SERVER_URL` если захочешь переопределить текущий Vercel auth endpoint
   - `ADMIN_WRITE_SECRET` для защищённой записи `submit_player_ratings` опционально
4. Задеплой функцию `api`.
5. Замени `GOOGLE_SCRIPT_URL` на URL Edge Function:
   - [predicts.html](/C:/Users/dmitr/vscode_repos/sgtour4/predicts.html:2531)
   - [profile.html](/C:/Users/dmitr/vscode_repos/sgtour4/profile.html:844)
   - [teams.html](/C:/Users/dmitr/vscode_repos/sgtour4/teams.html:30)

Пример:

```js
const GOOGLE_SCRIPT_URL = "https://<project-ref>.supabase.co/functions/v1/api";
```

Можно потом переименовать переменную, но для быстрого перехода это не обязательно.

## Безопасность записи

- `GET`-запросы можно держать публичными
- `submit_prediction` и `submit_tournament_prediction` теперь должны приходить с `Authorization: Bearer <discord token>`
- Edge Function валидирует этот токен через твой Vercel auth server `/me` и берёт пользователя только оттуда
- `user_id`, `username`, `name` и `avatar_url` из клиентского payload больше не считаются доверенными

## Как перенести данные из Google Sheets

### Predictions

Текущий лист `Predictions` в Apps Script хранит одного пользователя в одной строке и раскладывает матчи по колонкам.

Новая модель:

- одна строка = один предикт на один матч

Нужно вытащить для каждого юзера:

- `user_id`
- `username`
- `name`
- `avatar_url`
- `matchN_id`
- `winnerN`
- `scoreN`
- `bestN`
- `submittedN_at`

И загрузить в:

- `profiles`
- `match_predictions`

### TournamentPredictions

Каждая строка переносится в:

- `profiles`
- `tournament_predictions`

### Ratings

Старые колонки `match1..match5` переносятся в:

- `player_ratings` с `rating_round = 1..5`

## Что лучше поправить после первого запуска

- Перенести `matches` из `predicts.html` в Supabase полностью, чтобы матчи создавались без редактирования HTML.
- Перенести `allPlayers` и `TEAM_PLAYERS` в таблицы `players` и `teams`, а фронт загружать из базы.
- Привязать сайт к Supabase Auth или верифицировать Discord user серверно, если захочешь убрать доверие к `user_id` из клиента.

## Что теперь можно менять прямо в базе

- В `matches`:
  - `format` можно ставить `BO1` или `BO3`
  - `round_number` управляет подписью `Round N`, а pill на карточке матча берёт карту из `modal_data.map` или `modal_data.maps[0].map`
  - `modal_data.team_a_stats` и `modal_data.team_b_stats` можно хранить как объект вида `{ "player-slug": { "k": 10, "d": 8, "a": 3 } }`, а состав подтянется из `teams/players`
  - `status` управляет тем, где матч показывается и открыт ли он для предиктов
  - `result_*` задают итог матча для подсчёта очков
- В `tournament_settings`:
  - `predictions_open = true/false` открывает или закрывает турнирные предикты на сайте
- В `tournament_predictions`:
  - можно вручную посмотреть или даже проставить турнирный предикт конкретному пользователю

## Минимальный переход без переписывания сайта

Если нужен самый быстрый переход:

1. Поднять эту Edge Function.
2. Перенести данные из Sheets в новые таблицы.
3. Поменять только URL API на фронте.

На этом этапе `appscript.gs` уже можно не использовать вообще.
