const SHEET_PREDICTIONS = 'Predictions';
const SHEET_LEADERBOARD = 'Leaderboard';
const SHEET_TOURNAMENT_PREDICTIONS = 'TournamentPredictions';
const SHEET_RATINGS = 'Ratings';
const RATING_MATCH_HEADERS = ['match1', 'match2', 'match3', 'match4', 'match5'];

const MATCHES = [
  {
    id: 'pv-loss',
    title: 'PEPEVISION vs LOSSTEAM',
    result: null
  },
  {
    id: 'cz9-zbc',
    title: 'CZ9 vs ZBc',
    result: null
  },
  {
    id: 'dq-amk',
    title: 'DQTEAM vs AMK',
    result: null
  },
  {
    id: 'loss-zbc',
    title: 'LOSSTEAM vs ZBc',
    result: null
  },
  {
    id: 'pv-dq',
    title: 'PEPEVISION vs DQTEAM',
    result: null
  },
  {
    id: 'cz9-amk',
    title: 'CZ9 vs AMK',
    result: null
  },
  {
    id: 'loss-cz9',
    title: 'LOSSTEAM vs CZ9',
    result: null
  },
  {
    id: 'pv-amk',
    title: 'PEPEVISION vs AMK',
    result: null
  },
  {
    id: 'zbc-dq',
    title: 'ZBc vs DQTEAM',
    result: null
  },
  {
    id: 'loss-dq',
    title: 'LOSSTEAM vs DQTEAM',
    result: null
  },
  {
    id: 'pv-cz9',
    title: 'PEPEVISION vs CZ9',
    result: null
  },
  {
    id: 'zbc-amk',
    title: 'ZBc vs AMK',
    result: null
  },
  {
    id: 'loss-amk',
    title: 'LOSSTEAM vs AMK',
    result: null
  },
  {
    id: 'pv-zbc',
    title: 'PEPEVISION vs ZBc',
    result: null
  },
  {
    id: 'cz9-dq',
    title: 'CZ9 vs DQTEAM',
    result: null
  }
];

const SCORING_RULES = {
  winner: 2,
  exactScore: 2,
  bestPlayer: 1
};

const TOURNAMENT_SCORING_RULES = {
  champion_team: 8,
  mvp_player: 5,
  best_kd_player: 3,
  worst_kd_player: 2,
  frag_leader: 3,
  assist_leader: 2,
  most_frequent_map: 3,
  most_infrequent_map: 2
};

const TOURNAMENT_FIELDS = Object.keys(TOURNAMENT_SCORING_RULES);

const MATCH_ORDER = MATCHES.map((match) => match.id);

const MATCH_RESULTS = MATCHES.reduce((acc, match) => {
  if (match.result) {
    acc[match.id] = match.result;
  }
  return acc;
}, {});

const TOURNAMENT_RESULTS = null;
// Fill this once the tournament finishes:
// {
//   champion_team: "LOSSTEAM",
//   mvp_player: "ImNotDima",
//   best_kd_player: "s1mp1k",
//   worst_kd_player: "igrok6574",
//   frag_leader: "Loss",
//   assist_leader: "han4k",
//   most_frequent_map: "Mirage",
//   most_infrequent_map: "Cache"
// }

function getTournamentScoringRules_() {
  return TOURNAMENT_SCORING_RULES;
}

function calculateTournamentPredictionScore_(userPrediction) {
  if (!TOURNAMENT_RESULTS) {
    return null;
  }

  let totalPoints = 0;
  const breakdown = {};

  TOURNAMENT_FIELDS.forEach(function(field) {
    var userValue = String(userPrediction[field] || '').trim();
    var resultValue = String(TOURNAMENT_RESULTS[field] || '').trim();
    var points = TOURNAMENT_SCORING_RULES[field];
    var correct = userValue !== '' && userValue === resultValue;

    if (correct) {
      totalPoints += points;
    }

    breakdown[field] = {
      user_value: userValue,
      result_value: resultValue,
      correct: correct,
      points: points,
      earned: correct ? points : 0
    };
  });

  return {
    total_points: totalPoints,
    max_points: TOURNAMENT_FIELDS.reduce(function(sum, field) { return sum + TOURNAMENT_SCORING_RULES[field]; }, 0),
    breakdown: breakdown
  };
}

function getMatchFormat_(match) {
  return String((match && match.format) || '').trim().toUpperCase();
}

function canAwardExactScore_(match) {
  const format = getMatchFormat_(match);
  if (format) {
    return format === 'BO3';
  }

  const resultScore = String(match && match.result && match.result.score || '').trim();
  return resultScore !== '1:0';
}

function toImageFormula_(url) {
  const normalized = String(url || '').trim();
  if (!normalized) {
    return '';
  }
  if (/^=IMAGE\(/i.test(normalized)) {
    return normalized;
  }
  const escaped = normalized.replace(/"/g, '""');
  return `=IMAGE("${escaped}")`;
}

function extractImageUrl_(value, formula) {
  const formulaText = String(formula || '').trim();
  if (formulaText) {
    const match = formulaText.match(/^=IMAGE\("([\s\S]*)"\)$/i);
    if (match) {
      return match[1].replace(/""/g, '"');
    }
  }
  return String(value || '').trim();
}

function doPost(e) {
  try {
    const data = JSON.parse((e.postData && e.postData.contents) || '{}');

    if (data.mode === 'submit_prediction') {
      return handleSinglePrediction_(data);
    }

    if (data.mode === 'submit_tournament_prediction') {
      return handleTournamentPrediction_(data);
    }

    if (data.mode === 'submit_player_ratings') {
      return handlePlayerRatingsSubmission_(data);
    }

    return jsonResponse_({ status: 'error', error: 'Unknown mode' });
  } catch (error) {
    return jsonResponse_({ status: 'error', error: String(error.message || error) });
  }
}

function doGet(e) {
  const mode = String((e.parameter && e.parameter.mode) || '').trim();
  const userId = String((e.parameter && e.parameter.user_id) || '').trim();

  if (mode === 'leaderboard') {
    return getLeaderboard_();
  }

  if (mode === 'predictions') {
    return getPredictions_(userId);
  }

  if (mode === 'my_predictions') {
    return getMyPredictions_(userId);
  }

  if (mode === 'tournament_predictions') {
    return getTournamentPredictions_();
  }

  if (mode === 'my_tournament_predictions') {
    return getTournamentPredictions_(userId);
  }

  if (mode === 'matches') {
    return jsonResponse_({
      matches: MATCHES.map((match) => ({
        id: match.id,
        title: match.title,
        result: match.result || null
      }))
    });
  }

  if (mode === 'ratings') {
    return getRatings_();
  }

  if (mode === 'tournament_scoring') {
    return getTournamentScoring_(userId);
  }

  if (mode === 'tournament_results') {
    return getTournamentResults_();
  }

  if (mode === 'combined_leaderboard') {
    return getCombinedLeaderboard_();
  }

  return jsonResponse_({ status: 'ok' });
}

function handleSinglePrediction_(data) {
  const sheet = getOrCreateSheet_(SHEET_PREDICTIONS);
  const headers = buildPredictionHeaders_();

  ensureHeaders_(sheet, headers);

  const match = getMatchConfig_(data.match_id);
  if (!match) {
    return jsonResponse_({ status: 'error', error: `Unknown match_id: ${data.match_id}` });
  }

  if (!data.user_id) {
    return jsonResponse_({ status: 'error', error: 'user_id is required' });
  }

  if (!data.winner || !data.score || !data.best) {
    return jsonResponse_({ status: 'error', error: 'winner, score and best are required' });
  }

  const matchIndex = getMatchIndex_(match.id);
  const rowIndex = findRowByUserId_(sheet, data.user_id);
  const baseRow = rowIndex > 1
    ? sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0]
    : new Array(headers.length).fill('');
  const rowData = baseRow.slice();

  const alreadySubmitted = hasExistingPrediction_(headers, rowData, matchIndex);
  if (alreadySubmitted) {
    return jsonResponse_({
      status: 'already',
      error: 'Prediction for this match already exists'
    });
  }

  const submittedAt = new Date().toISOString();

  setValueByHeader_(headers, rowData, 'username', data.username || '');
  setValueByHeader_(headers, rowData, 'user_id', data.user_id || '');
  setValueByHeader_(headers, rowData, 'name', data.name || '');
  setValueByHeader_(headers, rowData, 'avatar_url', toImageFormula_(data.avatar_url));

  setValueByHeader_(headers, rowData, `match${matchIndex}_id`, match.id);
  setValueByHeader_(headers, rowData, `match${matchIndex}_title`, data.match_title || match.title || '');
  setValueByHeader_(headers, rowData, `winner${matchIndex}`, data.winner || '');
  setValueByHeader_(headers, rowData, `score${matchIndex}`, data.score || '');
  setValueByHeader_(headers, rowData, `best${matchIndex}`, data.best || '');
  setValueByHeader_(headers, rowData, `submitted${matchIndex}_at`, submittedAt);

  let affectedRow;
  if (rowIndex > 1) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);
    affectedRow = rowIndex;
  } else {
    sheet.appendRow(rowData);
    affectedRow = sheet.getLastRow();
  }

  recalculateLeaderboard_();

  return jsonResponse_({
    status: 'created',
    row: affectedRow,
    submitted_at: submittedAt
  });
}

function handleTournamentPrediction_(data) {
  const sheet = getOrCreateSheet_(SHEET_TOURNAMENT_PREDICTIONS);
  const headers = buildTournamentPredictionHeaders_();

  ensureHeaders_(sheet, headers);

  if (!data.user_id) {
    return jsonResponse_({ status: 'error', error: 'user_id is required' });
  }

  if (!data.champion_team || !data.mvp_player || !data.best_kd_player || !data.worst_kd_player || !data.frag_leader || !data.assist_leader || !data.most_frequent_map || !data.most_infrequent_map) {
    return jsonResponse_({
      status: 'error',
      error: 'champion_team, mvp_player, best_kd_player, worst_kd_player, frag_leader, assist_leader, most_frequent_map and most_infrequent_map are required'
    });
  }

  const rowIndex = findRowByUserId_(sheet, data.user_id);
  const baseRow = rowIndex > 1
    ? sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0]
    : new Array(headers.length).fill('');
  const rowData = baseRow.slice();
  const submittedAt = new Date().toISOString();

  setValueByHeader_(headers, rowData, 'username', data.username || '');
  setValueByHeader_(headers, rowData, 'user_id', data.user_id || '');
  setValueByHeader_(headers, rowData, 'name', data.name || '');
  setValueByHeader_(headers, rowData, 'avatar_url', toImageFormula_(data.avatar_url));
  setValueByHeader_(headers, rowData, 'champion_team', data.champion_team || '');
  setValueByHeader_(headers, rowData, 'mvp_player', data.mvp_player || '');
  setValueByHeader_(headers, rowData, 'best_kd_player', data.best_kd_player || '');
  setValueByHeader_(headers, rowData, 'worst_kd_player', data.worst_kd_player || '');
  setValueByHeader_(headers, rowData, 'frag_leader', data.frag_leader || '');
  setValueByHeader_(headers, rowData, 'assist_leader', data.assist_leader || '');
  setValueByHeader_(headers, rowData, 'most_frequent_map', data.most_frequent_map || '');
  setValueByHeader_(headers, rowData, 'most_infrequent_map', data.most_infrequent_map || '');
  setValueByHeader_(headers, rowData, 'submitted_at', submittedAt);

  if (rowIndex > 1) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return jsonResponse_({
    status: rowIndex > 1 ? 'updated' : 'created',
    submitted_at: submittedAt
  });
}

function getTournamentPredictions_(filterUserId) {
  const sheet = getOrCreateSheet_(SHEET_TOURNAMENT_PREDICTIONS);
  const values = sheet.getDataRange().getValues();
  const formulas = sheet.getDataRange().getFormulas();

  if (values.length < 2) {
    return jsonResponse_({ predictions: [] });
  }

  const headers = values[0];
  const rows = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (row.join('') === '') {
      continue;
    }

    const userId = getValueFromRowByHeader_(headers, row, 'user_id');
    if (filterUserId && String(userId).trim() !== String(filterUserId).trim()) {
      continue;
    }

    rows.push({
      username: getValueFromRowByHeader_(headers, row, 'username'),
      user_id: userId || '',
      name: getValueFromRowByHeader_(headers, row, 'name'),
      avatar_url: extractImageUrl_(
        getValueFromRowByHeader_(headers, row, 'avatar_url'),
        getValueFromRowByHeader_(headers, formulas[r], 'avatar_url')
      ),
      champion_team: getValueFromRowByHeader_(headers, row, 'champion_team'),
      mvp_player: getValueFromRowByHeader_(headers, row, 'mvp_player'),
      best_kd_player: getValueFromRowByHeader_(headers, row, 'best_kd_player'),
      worst_kd_player: getValueFromRowByHeader_(headers, row, 'worst_kd_player'),
      frag_leader: getValueFromRowByHeader_(headers, row, 'frag_leader'),
      assist_leader: getValueFromRowByHeader_(headers, row, 'assist_leader'),
      most_frequent_map: getValueFromRowByHeader_(headers, row, 'most_frequent_map'),
      most_infrequent_map: getValueFromRowByHeader_(headers, row, 'most_infrequent_map'),
      submitted_at: getValueFromRowByHeader_(headers, row, 'submitted_at')
    });
  }

  return jsonResponse_({ predictions: rows });
}

function buildTournamentPredictionHeaders_() {
  return [
    'username',
    'user_id',
    'name',
    'avatar_url',
    'champion_team',
    'mvp_player',
    'best_kd_player',
    'worst_kd_player',
    'frag_leader',
    'assist_leader',
    'most_frequent_map',
    'most_infrequent_map',
    'submitted_at'
  ];
}

function getRatings_() {
  const sheet = getOrCreateSheet_(SHEET_RATINGS);
  const headers = buildRatingsHeaders_();

  ensureHeaders_(sheet, headers);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return jsonResponse_({ ratings: [] });
  }

  const rowHeaders = values[0];
  const playerIndex = findHeaderIndex_(rowHeaders, ['players', 'player']);
  const averageIndex = findHeaderIndex_(rowHeaders, ['average rating', 'average_rating', 'rating']);

  if (playerIndex === -1) {
    return jsonResponse_({ status: 'error', error: 'Ratings sheet must contain a players column' });
  }

  const matchIndexes = RATING_MATCH_HEADERS.reduce((acc, header) => {
    acc[header] = findHeaderIndex_(rowHeaders, [header]);
    return acc;
  }, {});

  const ratings = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const playerName = String(row[playerIndex] || '').trim();

    if (!playerName) {
      continue;
    }

    const matches = {};
    RATING_MATCH_HEADERS.forEach((header) => {
      const columnIndex = matchIndexes[header];
      matches[header] = columnIndex === -1 ? '' : row[columnIndex];
    });

    ratings.push({
      player: playerName,
      average_rating: averageIndex === -1 ? '' : row[averageIndex],
      matches: matches
    });
  }

  return jsonResponse_({ ratings: ratings });
}

function handlePlayerRatingsSubmission_(data) {
  const sheet = getOrCreateSheet_(SHEET_RATINGS);
  const headers = buildRatingsHeaders_();

  ensureHeaders_(sheet, headers);

  const values = sheet.getDataRange().getValues();
  const rowHeaders = values[0] || headers;
  const playerColumnIndex = findHeaderIndex_(rowHeaders, ['players', 'player']);
  const matchHeader = resolveRatingMatchHeader_(data);
  const matchColumnIndex = findHeaderIndex_(rowHeaders, [matchHeader]);

  if (playerColumnIndex === -1) {
    return jsonResponse_({ status: 'error', error: 'Ratings sheet must contain a players column' });
  }

  if (!matchHeader || matchColumnIndex === -1) {
    return jsonResponse_({ status: 'error', error: 'A valid match column from match1 to match5 is required' });
  }

  const entries = normalizeRatingEntries_(data);
  if (!entries.length) {
    return jsonResponse_({ status: 'error', error: 'ratings data is required' });
  }

  const rowIndexByPlayer = {};
  for (let r = 1; r < values.length; r++) {
    const playerName = String(values[r][playerColumnIndex] || '').trim();
    if (!playerName) {
      continue;
    }
    rowIndexByPlayer[normalizePlayerName_(playerName)] = r + 1;
  }

  const missingPlayers = [];
  let updatedCount = 0;

  entries.forEach((entry) => {
    const playerName = String(entry.player || '').trim();
    const rowIndex = rowIndexByPlayer[normalizePlayerName_(playerName)];

    if (!playerName || !rowIndex) {
      if (playerName) {
        missingPlayers.push(playerName);
      }
      return;
    }

    sheet.getRange(rowIndex, matchColumnIndex + 1).setValue(entry.rating);
    updatedCount += 1;
  });

  return jsonResponse_({
    status: missingPlayers.length ? 'partial' : 'updated',
    match: matchHeader,
    updated_count: updatedCount,
    missing_players: missingPlayers
  });
}

function buildRatingsHeaders_() {
  return ['players'].concat(RATING_MATCH_HEADERS, ['average rating']);
}

function getLeaderboard_() {
  return jsonResponse_({ leaderboard: recalculateLeaderboard_() });
}

function getPredictions_(userId) {
  return jsonResponse_({ predictions: getPredictionObjects_(userId) });
}

function getMyPredictions_(userId) {
  if (!userId) {
    return jsonResponse_({ predictions: [] });
  }

  return jsonResponse_({ predictions: getPredictionObjects_(userId) });
}

function recalculateLeaderboard_() {
  const predictionRows = getPredictionObjects_();
  const leaderboard = buildLeaderboardFromPredictions_(predictionRows);
  writeLeaderboardSheet_(leaderboard);
  return leaderboard;
}

function rebuildLeaderboardManually() {
  return recalculateLeaderboard_();
}

function debugLeaderboardStatus() {
  const ss = getSpreadsheet_();
  const predictionsSheet = getOrCreateSheet_(SHEET_PREDICTIONS);
  const leaderboardSheet = getOrCreateSheet_(SHEET_LEADERBOARD);
  const predictionRows = getPredictionObjects_();
  const leaderboard = buildLeaderboardFromPredictions_(predictionRows);

  return {
    spreadsheet_id: ss.getId(),
    spreadsheet_name: ss.getName(),
    predictions_sheet: predictionsSheet.getName(),
    leaderboard_sheet: leaderboardSheet.getName(),
    predictions_count: predictionRows.length,
    leaderboard_count: leaderboard.length,
    leaderboard_preview: leaderboard.slice(0, 10)
  };
}

function getPredictionObjects_(filterUserId) {
  const sheet = getOrCreateSheet_(SHEET_PREDICTIONS);
  const values = sheet.getDataRange().getValues();
  const formulas = sheet.getDataRange().getFormulas();

  if (values.length < 2) {
    return [];
  }

  const headers = values[0];
  const rows = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (row.join('') === '') {
      continue;
    }

    const userId = getValueFromRowByHeader_(headers, row, 'user_id');
    if (filterUserId && String(userId).trim() !== String(filterUserId).trim()) {
      continue;
    }

    const username = getValueFromRowByHeader_(headers, row, 'username');
    const name = getValueFromRowByHeader_(headers, row, 'name');
    const avatarUrl = extractImageUrl_(
      getValueFromRowByHeader_(headers, row, 'avatar_url'),
      getValueFromRowByHeader_(headers, formulas[r], 'avatar_url')
    );

    for (let i = 1; i <= MATCH_ORDER.length; i++) {
      const matchId = getValueFromRowByHeader_(headers, row, `match${i}_id`);
      const matchTitle = getValueFromRowByHeader_(headers, row, `match${i}_title`);
      const winner = getValueFromRowByHeader_(headers, row, `winner${i}`);
      const score = getValueFromRowByHeader_(headers, row, `score${i}`);
      const best = getValueFromRowByHeader_(headers, row, `best${i}`);
      const submittedAt = getValueFromRowByHeader_(headers, row, `submitted${i}_at`);

      const isEmptyPrediction =
        String(matchId || '').trim() === '' &&
        String(winner || '').trim() === '' &&
        String(score || '').trim() === '' &&
        String(best || '').trim() === '';

      if (isEmptyPrediction) {
        continue;
      }

      rows.push({
        username: username || '',
        user_id: userId || '',
        name: name || '',
        avatar_url: avatarUrl || '',
        match_id: matchId || '',
        match_title: matchTitle || '',
        winner: winner || '',
        score: score || '',
        best: best || '',
        submitted_at: submittedAt || ''
      });
    }
  }

  return rows;
}

function buildLeaderboardFromPredictions_(predictions) {
  const grouped = {};

  predictions.forEach((item) => {
    const userId = String(item.user_id || '').trim();
    const matchId = String(item.match_id || '').trim();
    const result = MATCH_RESULTS[matchId];
    const match = getMatchConfig_(matchId);

    if (!userId || !matchId || !result) {
      return;
    }

    if (!grouped[userId]) {
      grouped[userId] = {
        user_id: userId,
        username: item.username || item.name || 'Unknown',
        avatar_url: item.avatar_url || '',
        points: 0
      };
    }

    const row = grouped[userId];

    if (normalize_(item.winner) === normalize_(result.winner)) {
      row.points += SCORING_RULES.winner;
    }

    if (canAwardExactScore_(match) && normalize_(item.score) === normalize_(result.score)) {
      row.points += SCORING_RULES.exactScore;
    }

    if (normalize_(item.best) === normalize_(result.best)) {
      row.points += SCORING_RULES.bestPlayer;
    }
  });

  return Object.keys(grouped)
    .map((key) => grouped[key])
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return String(a.username).localeCompare(String(b.username));
    })
    .map((item, index) => ({
      place: index + 1,
      username: item.username,
      user_id: item.user_id,
      avatar_url: item.avatar_url,
      points: item.points
    }));
}

function writeLeaderboardSheet_(leaderboard) {
  const sheet = getOrCreateSheet_(SHEET_LEADERBOARD);
  const headers = ['place', 'username', 'user_id', 'avatar_url', 'points'];

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (!leaderboard.length) {
    return;
  }

  const rows = leaderboard.map((item) => [
    item.place,
    item.username,
    item.user_id,
    toImageFormula_(item.avatar_url),
    item.points
  ]);

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function buildPredictionHeaders_() {
  const headers = ['username', 'user_id', 'name', 'avatar_url'];

  for (let i = 1; i <= MATCH_ORDER.length; i++) {
    headers.push(`match${i}_id`);
    headers.push(`match${i}_title`);
    headers.push(`winner${i}`);
    headers.push(`score${i}`);
    headers.push(`best${i}`);
    headers.push(`submitted${i}_at`);
  }

  return headers;
}

function getMatchIndex_(matchId) {
  const index = MATCH_ORDER.indexOf(matchId);
  return index === -1 ? -1 : index + 1;
}

function getMatchConfig_(matchId) {
  return MATCHES.filter((match) => match.id === matchId)[0] || null;
}

function ensureHeaders_(sheet, headers) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const isEmpty = currentHeaders.every((cell) => cell === '');

  if (isEmpty) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const needsUpdate =
    currentHeaders.length < headers.length ||
    headers.some((header, index) => currentHeaders[index] !== header);

  if (needsUpdate) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function findRowByUserId_(sheet, userId) {
  if (!userId) return -1;

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return -1;

  const headers = values[0];
  const userIdIndex = headers.indexOf('user_id');
  if (userIdIndex === -1) return -1;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][userIdIndex]).trim() === String(userId).trim()) {
      return i + 1;
    }
  }

  return -1;
}

function hasExistingPrediction_(headers, row, matchIndex) {
  const values = [
    getValueByHeader_(headers, row, `match${matchIndex}_id`),
    getValueByHeader_(headers, row, `winner${matchIndex}`),
    getValueByHeader_(headers, row, `score${matchIndex}`),
    getValueByHeader_(headers, row, `best${matchIndex}`)
  ];

  return values.some((value) => String(value || '').trim() !== '');
}

function setValueByHeader_(headers, row, header, value) {
  const index = headers.indexOf(header);
  if (index !== -1) {
    row[index] = value;
  }
}

function getValueByHeader_(headers, row, header) {
  const index = headers.indexOf(header);
  return index !== -1 ? row[index] : '';
}

function getValueFromRowByHeader_(headers, row, header) {
  const index = headers.indexOf(header);
  return index !== -1 ? row[index] : '';
}

function findHeaderIndex_(headers, candidates) {
  const normalizedHeaders = headers.map((header) => normalizeHeader_(header));

  for (let i = 0; i < candidates.length; i++) {
    const target = normalizeHeader_(candidates[i]);
    const index = normalizedHeaders.indexOf(target);
    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

function resolveRatingMatchHeader_(data) {
  const rawMatchKey = String(
    data.match ||
    data.match_key ||
    data.match_column ||
    ''
  ).trim().toLowerCase();

  if (RATING_MATCH_HEADERS.indexOf(rawMatchKey) !== -1) {
    return rawMatchKey;
  }

  if (/^\d+$/.test(rawMatchKey)) {
    const directMatchNumber = Number(rawMatchKey);
    if (directMatchNumber >= 1 && directMatchNumber <= RATING_MATCH_HEADERS.length) {
      return `match${directMatchNumber}`;
    }
  }

  const matchNumber = Number(data.match_number);
  if (matchNumber >= 1 && matchNumber <= RATING_MATCH_HEADERS.length) {
    return `match${matchNumber}`;
  }

  const rawMatchId = String(data.match_id || data.matchId || '').trim();
  if (rawMatchId) {
    const matchHeaderById = getRatingMatchHeaderByMatchId_(rawMatchId);
    if (matchHeaderById) {
      return matchHeaderById;
    }
  }

  const rawStage = String(data.stage || data.round || '').trim();
  if (rawStage) {
    const matchHeaderByStage = getRatingMatchHeaderByStage_(rawStage);
    if (matchHeaderByStage) {
      return matchHeaderByStage;
    }
  }

  return '';
}

function normalizeRatingEntries_(data) {
  const source = Array.isArray(data.ratings)
    ? data.ratings
    : Array.isArray(data.players)
      ? data.players
      : isPlainObject_(data.ratings)
        ? Object.keys(data.ratings).map((playerName) => ({
          player: playerName,
          rating: data.ratings[playerName]
        }))
        : data && (data.player || data.name || data.players)
          ? [data]
        : [];

  return source
    .map((item) => ({
      player: item && (item.player || item.name || item.players) || '',
      rating: item && item.rating
    }))
    .filter((item) => String(item.player || '').trim() !== '');
}

function getOrCreateSheet_(name) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  return sheet;
}

function getSpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    return active;
  }

  const configuredId = String(
    PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || ''
  ).trim();

  if (configuredId) {
    return SpreadsheetApp.openById(configuredId);
  }

  throw new Error('Spreadsheet is not available. Bind the script to a spreadsheet or set Script Property SPREADSHEET_ID.');
}

function normalize_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePlayerName_(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^0-9a-zа-яё]+/gi, '')
    .toLowerCase();
}

function normalizeHeader_(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();
}

function getRatingMatchHeaderByMatchId_(matchId) {
  const index = MATCHES.findIndex((match) => String(match && match.id || '').trim() === String(matchId).trim());
  if (index === -1) {
    return '';
  }

  const roundNumber = Math.floor(index / 3) + 1;
  return roundNumber >= 1 && roundNumber <= RATING_MATCH_HEADERS.length
    ? `match${roundNumber}`
    : '';
}

function getRatingMatchHeaderByStage_(stage) {
  const normalizedStage = normalizeHeader_(stage);
  const match = normalizedStage.match(/(\d+)/);
  if (!match) {
    return '';
  }

  const roundNumber = Number(match[1]);
  return roundNumber >= 1 && roundNumber <= RATING_MATCH_HEADERS.length
    ? `match${roundNumber}`
    : '';
}

function isPlainObject_(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function getTournamentScoring_(userId) {
  const predictions = getTournamentPredictions_(userId);
  const parsed = JSON.parse(predictions.getContent());
  const preds = parsed.predictions || [];

  if (!TOURNAMENT_RESULTS) {
    return jsonResponse_({
      results_available: false,
      scoring: null
    });
  }

  const scoringResults = preds.map(function(pred) {
    var score = calculateTournamentPredictionScore_(pred);
    return {
      user_id: pred.user_id,
      username: pred.username,
      name: pred.name,
      avatar_url: pred.avatar_url,
      scoring: score
    };
  });

  return jsonResponse_({
    results_available: true,
    tournament_results: TOURNAMENT_RESULTS,
    scoring: scoringResults
  });
}

function getTournamentResults_() {
  if (!TOURNAMENT_RESULTS) {
    return jsonResponse_({
      results_available: false,
      tournament_results: null
    });
  }

  return jsonResponse_({
    results_available: true,
    tournament_results: TOURNAMENT_RESULTS,
    scoring_rules: TOURNAMENT_SCORING_RULES,
    max_points: TOURNAMENT_FIELDS.reduce(function(sum, field) { return sum + TOURNAMENT_SCORING_RULES[field]; }, 0)
  });
}

function getCombinedLeaderboard_() {
  var matchPredictions = getPredictionObjects_();
  var matchLeaderboard = buildLeaderboardFromPredictions_(matchPredictions);

  var tournamentPredictions = getTournamentPredictions_();
  var tournamentParsed = JSON.parse(tournamentPredictions.getContent());
  var tournamentPreds = tournamentParsed.predictions || [];

  var tournamentScores = {};
  if (TOURNAMENT_RESULTS) {
    tournamentPreds.forEach(function(pred) {
      var score = calculateTournamentPredictionScore_(pred);
      if (score) {
        tournamentScores[pred.user_id] = score.total_points;
      }
    });
  }

  var userMap = {};

  matchLeaderboard.forEach(function(entry) {
    var uid = String(entry.user_id).trim();
    userMap[uid] = {
      user_id: uid,
      username: entry.username,
      avatar_url: entry.avatar_url,
      match_points: entry.points,
      tournament_points: tournamentScores[uid] || 0,
      total_points: entry.points + (tournamentScores[uid] || 0)
    };
  });

  tournamentPreds.forEach(function(pred) {
    var uid = String(pred.user_id).trim();
    if (!userMap[uid]) {
      userMap[uid] = {
        user_id: uid,
        username: pred.username || pred.name || 'Unknown',
        avatar_url: pred.avatar_url || '',
        match_points: 0,
        tournament_points: tournamentScores[uid] || 0,
        total_points: tournamentScores[uid] || 0
      };
    }
  });

  var combined = Object.keys(userMap)
    .map(function(key) { return userMap[key]; })
    .sort(function(a, b) {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      if (b.match_points !== a.match_points) {
        return b.match_points - a.match_points;
      }
      return String(a.username).localeCompare(String(b.username));
    })
    .map(function(entry, index) {
      entry.place = index + 1;
      return entry;
    });

  return jsonResponse_({
    leaderboard: combined,
    tournament_results_available: Boolean(TOURNAMENT_RESULTS),
    tournament_scoring_rules: TOURNAMENT_SCORING_RULES,
    match_scoring_rules: SCORING_RULES
  });
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
