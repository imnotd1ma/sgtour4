import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const REQUIRED_TOURNAMENT_FIELDS = [
  "champion_team",
  "mvp_player",
  "best_kd_player",
  "worst_kd_player",
  "frag_leader",
  "assist_leader",
  "most_frequent_map",
  "most_infrequent_map",
] as const;

type JsonRecord = Record<string, unknown>;
type AuthUser = {
  id: string;
  username?: string;
  global_name?: string;
  name?: string;
  avatar?: string;
  avatar_url?: string;
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizePlayerName(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9a-zа-яё]+/gi, "")
    .toLowerCase();
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getAuthServerUrl() {
  return String(Deno.env.get("AUTH_SERVER_URL") || "https://discord-auth-server-six.vercel.app").trim();
}

function getDiscordAvatarUrl(user: AuthUser) {
  if (user.avatar_url) {
    return String(user.avatar_url).trim();
  }

  if (!user.id || !user.avatar) {
    return "";
  }

  const extension = String(user.avatar).startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=128`;
}

async function requireAuthenticatedDiscordUser(request: Request) {
  const authorization = String(request.headers.get("authorization") || "").trim();

  if (!authorization) {
    return {
      error: jsonResponse({
        status: "error",
        error: "Missing authorization header",
      }, 401),
      user: null,
    };
  }

  const response = await fetch(`${getAuthServerUrl()}/me`, {
    method: "GET",
    headers: {
      Authorization: authorization,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      error: jsonResponse({
        status: "error",
        error: payload?.error || payload?.message || "Unauthorized",
      }, response.status === 401 || response.status === 403 ? 401 : 502),
      user: null,
    };
  }

  const authUser = payload as AuthUser;
  if (!String(authUser.id || "").trim()) {
    return {
      error: jsonResponse({
        status: "error",
        error: "Authenticated user is missing id",
      }, 502),
      user: null,
    };
  }

  return {
    error: null,
    user: authUser,
  };
}

function createAdminClient() {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

async function upsertProfile(supabase: ReturnType<typeof createAdminClient>, authUser: AuthUser) {
  const discordUserId = String(authUser.id ?? "").trim();
  if (!discordUserId) {
    throw new Error("user_id is required");
  }

  const payload = {
    discord_user_id: discordUserId,
    username: String(authUser.username ?? authUser.global_name ?? authUser.name ?? "").trim() || "Unknown",
    display_name: String(authUser.global_name ?? authUser.name ?? authUser.username ?? "").trim(),
    avatar_url: getDiscordAvatarUrl(authUser),
  };

  const { data: profile, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "discord_user_id" })
    .select("id, discord_user_id, username, display_name, avatar_url")
    .single();

  if (error || !profile) {
    throw new Error(error?.message || "Failed to upsert profile");
  }

  return profile;
}

async function getMatchRules(supabase: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabase
    .from("match_scoring_rules")
    .select("rule_key, points");

  if (error) {
    throw new Error(error.message);
  }

  return Object.fromEntries((data ?? []).map((item) => [item.rule_key, item.points]));
}

async function getTournamentRules(supabase: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabase
    .from("tournament_scoring_rules")
    .select("field, points");

  if (error) {
    throw new Error(error.message);
  }

  return Object.fromEntries((data ?? []).map((item) => [item.field, item.points]));
}

async function getTournamentResultStatus(supabase: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabase
    .from("v_tournament_results_status")
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to load tournament results");
  }

  return data;
}

function resolveRatingRound(data: JsonRecord, matches: Array<{ id: string; stage_number: number }>) {
  const direct = String(data.match ?? data.match_key ?? data.match_column ?? "").trim().toLowerCase();
  if (/^match[1-5]$/.test(direct)) {
    return Number(direct.replace("match", ""));
  }

  if (/^[1-5]$/.test(direct)) {
    return Number(direct);
  }

  const matchNumber = Number(data.match_number);
  if (Number.isInteger(matchNumber) && matchNumber >= 1 && matchNumber <= 5) {
    return matchNumber;
  }

  const matchId = String(data.match_id ?? data.matchId ?? "").trim();
  if (matchId) {
    const match = matches.find((item) => item.id === matchId);
    if (match?.stage_number) {
      return match.stage_number;
    }
  }

  const stage = String(data.stage ?? data.round ?? "").trim();
  const stageDigits = stage.match(/(\d+)/);
  if (stageDigits) {
    const parsed = Number(stageDigits[1]);
    if (parsed >= 1 && parsed <= 5) {
      return parsed;
    }
  }

  return 0;
}

function normalizeRatingEntries(data: JsonRecord) {
  const source = Array.isArray(data.ratings)
    ? data.ratings
    : Array.isArray(data.players)
      ? data.players
      : data.ratings && typeof data.ratings === "object"
        ? Object.entries(data.ratings as Record<string, unknown>).map(([player, rating]) => ({ player, rating }))
        : (data.player || data.name || data.players)
          ? [data]
          : [];

  return source
    .map((entry) => {
      const item = entry as JsonRecord;
      return {
        player: String(item.player ?? item.name ?? item.players ?? "").trim(),
        rating: item.rating,
      };
    })
    .filter((entry) => entry.player !== "");
}

function calcTournamentBreakdown(
  prediction: Record<string, unknown>,
  tournamentResults: Record<string, unknown>,
  rules: Record<string, number>,
) {
  const resultsAvailable = REQUIRED_TOURNAMENT_FIELDS.every((field) => {
    return String(tournamentResults[field] ?? "").trim() !== "";
  });

  if (!resultsAvailable) {
    return null;
  }

  let totalPoints = 0;
  const breakdown: Record<string, unknown> = {};

  for (const field of REQUIRED_TOURNAMENT_FIELDS) {
    const userValue = String(prediction[field] ?? "").trim();
    const resultValue = String(tournamentResults[field] ?? "").trim();
    const points = Number(rules[field] ?? 0);
    const correct = userValue !== "" && normalize(userValue) === normalize(resultValue);

    if (correct) {
      totalPoints += points;
    }

    breakdown[field] = {
      user_value: userValue,
      result_value: resultValue,
      correct,
      points,
      earned: correct ? points : 0,
    };
  }

  return {
    total_points: totalPoints,
    max_points: Object.values(rules).reduce((sum, points) => sum + Number(points || 0), 0),
    breakdown,
  };
}

async function handleGet(request: Request, supabase: ReturnType<typeof createAdminClient>) {
  const url = new URL(request.url);
  const mode = String(url.searchParams.get("mode") ?? "").trim();
  const userId = String(url.searchParams.get("user_id") ?? "").trim();

  if (mode === "leaderboard") {
    const { data, error } = await supabase
      .from("v_match_leaderboard")
      .select("*")
      .order("place", { ascending: true });
    if (error) {
      throw new Error(error.message);
    }
    return jsonResponse({ leaderboard: data ?? [] });
  }

  if (mode === "predictions" || mode === "my_predictions") {
    let query = supabase
      .from("v_match_prediction_feed")
      .select("username, user_id, name, avatar_url, match_id, match_title, winner, score, best, submitted_at, sort_order")
      .order("sort_order", { ascending: true })
      .order("submitted_at", { ascending: true });

    if (mode === "my_predictions") {
      if (!userId) {
        return jsonResponse({ predictions: [] });
      }
      query = query.eq("user_id", userId);
    } else if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return jsonResponse({
      predictions: (data ?? []).map(({ sort_order: _sortOrder, ...row }) => row),
    });
  }

  if (mode === "tournament_predictions" || mode === "my_tournament_predictions") {
    let query = supabase
      .from("v_tournament_prediction_feed")
      .select("*")
      .order("submitted_at", { ascending: true });

    if (mode === "my_tournament_predictions") {
      if (!userId) {
        return jsonResponse({ predictions: [] });
      }
      query = query.eq("user_id", userId);
    } else if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return jsonResponse({ predictions: data ?? [] });
  }

  if (mode === "matches") {
    const { data, error } = await supabase
      .from("matches")
      .select("id, title, sort_order, stage_number, stage_label, status, format, team_a_name, team_b_name, score_options, scheduled_at, result_winner, result_score, result_best_player, modal_data")
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return jsonResponse({
      matches: (data ?? []).map((match) => ({
        id: match.id,
        title: match.title,
        sort_order: match.sort_order,
        stage_number: match.stage_number,
        stage_label: match.stage_label,
        status: match.status,
        format: match.format,
        team_a_name: match.team_a_name,
        team_b_name: match.team_b_name,
        score_options: match.score_options,
        scheduled_at: match.scheduled_at,
        modal_data: match.modal_data,
        result: match.result_winner
          ? {
            winner: match.result_winner,
            score: match.result_score,
            best: match.result_best_player,
          }
          : null,
      })),
    });
  }

  if (mode === "teams") {
    const [teamsResult, playersResult] = await Promise.all([
      supabase
        .from("teams")
        .select("id, slug, name, logo_url, subtitle, sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("players")
        .select("id, slug, display_name, team_id, image_url, role, playtime, fav_weapon, roster_order, is_captain")
        .eq("active", true)
        .order("roster_order", { ascending: true })
        .order("display_name", { ascending: true }),
    ]);

    if (teamsResult.error) {
      throw new Error(teamsResult.error.message);
    }

    if (playersResult.error) {
      throw new Error(playersResult.error.message);
    }

    const playersByTeamId = new Map<string, Array<Record<string, unknown>>>();

    for (const player of playersResult.data ?? []) {
      const teamId = String(player.team_id ?? "").trim();
      if (!teamId) {
        continue;
      }

      if (!playersByTeamId.has(teamId)) {
        playersByTeamId.set(teamId, []);
      }

      playersByTeamId.get(teamId)?.push({
        id: player.id,
        slug: player.slug,
        display_name: player.display_name,
        image_url: player.image_url,
        role: player.role,
        playtime: player.playtime,
        fav_weapon: player.fav_weapon,
        roster_order: player.roster_order,
        is_captain: player.is_captain,
      });
    }

    return jsonResponse({
      teams: (teamsResult.data ?? [])
        .map((team) => ({
          id: team.id,
          slug: team.slug,
          name: team.name,
          logo_url: team.logo_url,
          subtitle: team.subtitle,
          sort_order: team.sort_order,
          players: playersByTeamId.get(team.id) ?? [],
        }))
        .filter((team) => team.players.length > 0),
    });
  }

  if (mode === "tournament_config") {
    const { data, error } = await supabase
      .from("tournament_settings")
      .select("tournament_key, predictions_open, updated_at")
      .eq("tournament_key", "default")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return jsonResponse({
      tournament_key: data.tournament_key,
      predictions_open: Boolean(data.predictions_open),
      updated_at: data.updated_at,
    });
  }

  if (mode === "ratings") {
    const { data, error } = await supabase
      .from("v_player_rating_summary")
      .select("*")
      .order("player", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return jsonResponse({
      ratings: (data ?? []).map((row) => ({
        player: row.player,
        average_rating: row.average_rating ?? "",
        matches: {
          match1: row.match1 ?? "",
          match2: row.match2 ?? "",
          match3: row.match3 ?? "",
          match4: row.match4 ?? "",
          match5: row.match5 ?? "",
        },
      })),
    });
  }

  if (mode === "tournament_results") {
    const tournamentStatus = await getTournamentResultStatus(supabase);
    const tournamentRules = await getTournamentRules(supabase);

    if (!tournamentStatus.results_available) {
      return jsonResponse({
        results_available: false,
        tournament_results: null,
      });
    }

    return jsonResponse({
      results_available: true,
      tournament_results: {
        champion_team: tournamentStatus.champion_team,
        mvp_player: tournamentStatus.mvp_player,
        best_kd_player: tournamentStatus.best_kd_player,
        worst_kd_player: tournamentStatus.worst_kd_player,
        frag_leader: tournamentStatus.frag_leader,
        assist_leader: tournamentStatus.assist_leader,
        most_frequent_map: tournamentStatus.most_frequent_map,
        most_infrequent_map: tournamentStatus.most_infrequent_map,
      },
      scoring_rules: tournamentRules,
      max_points: tournamentStatus.max_points,
    });
  }

  if (mode === "tournament_scoring") {
    const tournamentStatus = await getTournamentResultStatus(supabase);
    const tournamentRules = await getTournamentRules(supabase);

    let query = supabase.from("v_tournament_prediction_feed").select("*");
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    if (!tournamentStatus.results_available) {
      return jsonResponse({
        results_available: false,
        scoring: null,
      });
    }

    const tournamentResults = {
      champion_team: tournamentStatus.champion_team,
      mvp_player: tournamentStatus.mvp_player,
      best_kd_player: tournamentStatus.best_kd_player,
      worst_kd_player: tournamentStatus.worst_kd_player,
      frag_leader: tournamentStatus.frag_leader,
      assist_leader: tournamentStatus.assist_leader,
      most_frequent_map: tournamentStatus.most_frequent_map,
      most_infrequent_map: tournamentStatus.most_infrequent_map,
    };

    return jsonResponse({
      results_available: true,
      tournament_results: tournamentResults,
      scoring: (data ?? []).map((prediction) => ({
        user_id: prediction.user_id,
        username: prediction.username,
        name: prediction.name,
        avatar_url: prediction.avatar_url,
        scoring: calcTournamentBreakdown(prediction, tournamentResults, tournamentRules),
      })),
    });
  }

  if (mode === "combined_leaderboard") {
    const [leaderboardResult, tournamentStatus, tournamentRules, matchRules] = await Promise.all([
      supabase.from("v_combined_leaderboard").select("*").order("place", { ascending: true }),
      getTournamentResultStatus(supabase),
      getTournamentRules(supabase),
      getMatchRules(supabase),
    ]);

    if (leaderboardResult.error) {
      throw new Error(leaderboardResult.error.message);
    }

    return jsonResponse({
      leaderboard: leaderboardResult.data ?? [],
      tournament_results_available: Boolean(tournamentStatus.results_available),
      tournament_scoring_rules: tournamentRules,
      match_scoring_rules: {
        winner: matchRules.winner ?? 0,
        exactScore: matchRules.exact_score ?? 0,
        bestPlayer: matchRules.best_player ?? 0,
      },
    });
  }

  return jsonResponse({ status: "ok" });
}

async function handleSubmitPrediction(
  payload: JsonRecord,
  authUser: AuthUser,
  supabase: ReturnType<typeof createAdminClient>,
) {
  const profile = await upsertProfile(supabase, authUser);
  const matchId = String(payload.match_id ?? "").trim();

  if (!matchId) {
    return jsonResponse({ status: "error", error: "match_id is required" }, 400);
  }

  const winner = String(payload.winner ?? "").trim();
  const score = String(payload.score ?? "").trim();
  const best = String(payload.best ?? "").trim();

  if (!winner || !score || !best) {
    return jsonResponse({ status: "error", error: "winner, score and best are required" }, 400);
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    return jsonResponse({ status: "error", error: `Unknown match_id: ${matchId}` }, 400);
  }

  const submittedAt = new Date().toISOString();
  const { error } = await supabase
    .from("match_predictions")
    .insert({
      user_id: profile.id,
      match_id: matchId,
      winner,
      score,
      best_player: best,
      submitted_at: submittedAt,
    });

  if (error) {
    if (error.code === "23505") {
      return jsonResponse({
        status: "already",
        error: "Prediction for this match already exists",
      });
    }
    throw new Error(error.message);
  }

  return jsonResponse({
    status: "created",
    submitted_at: submittedAt,
  });
}

async function handleSubmitTournamentPrediction(
  payload: JsonRecord,
  authUser: AuthUser,
  supabase: ReturnType<typeof createAdminClient>,
) {
  const profile = await upsertProfile(supabase, authUser);

  for (const field of REQUIRED_TOURNAMENT_FIELDS) {
    if (!String(payload[field] ?? "").trim()) {
      return jsonResponse({
        status: "error",
        error: `${field} is required`,
      }, 400);
    }
  }

  const submittedAt = new Date().toISOString();
  const { error } = await supabase
    .from("tournament_predictions")
    .upsert({
      user_id: profile.id,
      champion_team: String(payload.champion_team ?? "").trim(),
      mvp_player: String(payload.mvp_player ?? "").trim(),
      best_kd_player: String(payload.best_kd_player ?? "").trim(),
      worst_kd_player: String(payload.worst_kd_player ?? "").trim(),
      frag_leader: String(payload.frag_leader ?? "").trim(),
      assist_leader: String(payload.assist_leader ?? "").trim(),
      most_frequent_map: String(payload.most_frequent_map ?? "").trim(),
      most_infrequent_map: String(payload.most_infrequent_map ?? "").trim(),
      submitted_at: submittedAt,
    }, {
      onConflict: "user_id",
    });

  if (error) {
    throw new Error(error.message);
  }

  return jsonResponse({
    status: "updated",
    submitted_at: submittedAt,
  });
}

async function handleSubmitPlayerRatings(request: Request, payload: JsonRecord, supabase: ReturnType<typeof createAdminClient>) {
  const requiredAdminSecret = Deno.env.get("ADMIN_WRITE_SECRET");
  const providedAdminSecret = request.headers.get("x-admin-secret") ?? "";

  if (requiredAdminSecret && providedAdminSecret !== requiredAdminSecret) {
    return jsonResponse({ status: "error", error: "Unauthorized" }, 401);
  }

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id, stage_number");

  if (matchesError) {
    throw new Error(matchesError.message);
  }

  const ratingRound = resolveRatingRound(payload, matches ?? []);
  if (!ratingRound) {
    return jsonResponse({
      status: "error",
      error: "A valid match column from match1 to match5 is required",
    }, 400);
  }

  const entries = normalizeRatingEntries(payload);
  if (!entries.length) {
    return jsonResponse({ status: "error", error: "ratings data is required" }, 400);
  }

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, display_name");

  if (playersError) {
    throw new Error(playersError.message);
  }

  const playerByName = new Map(
    (players ?? []).map((player) => [normalizePlayerName(player.display_name), player]),
  );

  const targetMatch = (matches ?? []).find((item) => item.stage_number === ratingRound);
  const missingPlayers: string[] = [];
  let updatedCount = 0;

  for (const entry of entries) {
    const player = playerByName.get(normalizePlayerName(entry.player));
    const ratingValue = Number(entry.rating);

    if (!player) {
      missingPlayers.push(entry.player);
      continue;
    }

    if (!Number.isFinite(ratingValue)) {
      continue;
    }

    const { error } = await supabase
      .from("player_ratings")
      .upsert({
        player_id: player.id,
        rating_round: ratingRound,
        match_id: targetMatch?.id ?? null,
        rating: ratingValue,
        rated_at: new Date().toISOString(),
      }, {
        onConflict: "player_id,rating_round",
      });

    if (error) {
      throw new Error(error.message);
    }

    updatedCount += 1;
  }

  return jsonResponse({
    status: missingPlayers.length ? "partial" : "updated",
    match: `match${ratingRound}`,
    updated_count: updatedCount,
    missing_players: missingPlayers,
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient();

    if (request.method === "GET") {
      return await handleGet(request, supabase);
    }

    if (request.method === "POST") {
      const payload = await request.json() as JsonRecord;
      const mode = String(payload.mode ?? "").trim();

      if (mode === "submit_prediction") {
        const auth = await requireAuthenticatedDiscordUser(request);
        if (auth.error || !auth.user) {
          return auth.error as Response;
        }
        return await handleSubmitPrediction(payload, auth.user, supabase);
      }

      if (mode === "submit_tournament_prediction") {
        const auth = await requireAuthenticatedDiscordUser(request);
        if (auth.error || !auth.user) {
          return auth.error as Response;
        }
        return await handleSubmitTournamentPrediction(payload, auth.user, supabase);
      }

      if (mode === "submit_player_ratings") {
        return await handleSubmitPlayerRatings(request, payload, supabase);
      }

      return jsonResponse({ status: "error", error: "Unknown mode" }, 400);
    }

    return jsonResponse({ status: "error", error: "Method not allowed" }, 405);
  } catch (error) {
    return jsonResponse({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
