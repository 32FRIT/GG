/* ================= DATA ================= */
    /* A broken catalog used to leave a blank screen; show the reason instead. */
    function fatalStartup(message) {
      window.__GG_BOOT_ERROR = message;
      const target = document.getElementById("app");
      if (target) target.innerHTML = `<div class="rows"><div class="row"><span class="n">${message}</span></div></div>`;
      throw new Error(message);
    }
    if (typeof FUT_DATA === "undefined" || !FUT_DATA ||
      !Array.isArray(FUT_DATA.players) || !Array.isArray(FUT_DATA.coaches)) {
      fatalStartup("بيانات اللعبة الأساسية مش موجودة أو غير صالحة.");
    }
    const P = FUT_DATA.players.map(player => ({
      n: player.n,
      p: String(player.p || "").toUpperCase(),
      role: String(player.role || player.p || "").toUpperCase(),
      alt: (Array.isArray(player.alt) ? player.alt : player.alt ? [player.alt] : [])
        .map(role => String(role).toUpperCase()).filter(role => role !== (player.role || player.p)),
      nat: player.nat,
      club: player.club,
      era: player.era,
      r: player.r,
      price: player.price,
      suggestedPrice: player.suggestedPrice,
      rarity: player.rarity,
      isIcon: player.isIcon,
      eaId: player.eaId
    }));
    if (P.length === 0 || P.some(player => !Number.isInteger(player.r) || player.r < 1 || player.r > 99 || !player.p || !player.role)) {
      fatalStartup("بيانات اللاعبين غير مكتملة أو تقييماتهم غير صالحة.");
    }
    if (P.some(player => player.price === null &&
      (!Number.isSafeInteger(player.suggestedPrice) || player.suggestedPrice <= 0))) {
      fatalStartup("كل لاعب من غير سعر سوق لازم يكون له سعر مقترح.");
    }
    /* The catalog ships a tier per manager; the rating is the fallback. */
    const coachTierOf = coach => coach.tier === "legendary" || coach.tier === "regular" || coach.tier === "weak"
      ? coach.tier
      : coach.r >= 85 ? "legendary" : coach.r >= 79 ? "regular" : "weak";
    const COACHES = FUT_DATA.coaches.map(coach => ({
      id: coach.id,
      n: coach.n,
      tier: coachTierOf(coach),
      r: coach.r,
      quality: coach.quality,
      nation: coach.nat,
      league: coach.league,
      club: coach.club,
      price: coach.price,
      suggestedPrice: coach.suggestedPrice
    }));
    if (COACHES.length < 40) fatalStartup("بيانات المدربين غير مكتملة.");
    if (COACHES.some(coach => coach.price === null &&
      (!Number.isSafeInteger(coach.suggestedPrice) || coach.suggestedPrice <= 0))) {
      fatalStartup("كل مدرب من غير سعر سوق لازم يكون له سعر مقترح.");
    }
    const COACH_TIER = {
      legendary: { name: "أسطوري", color: "var(--gold)" },
      regular: { name: "عادي", color: "var(--ac)" },
      weak: { name: "ضعيف", color: "var(--bad)" }
    };
    /* An 80-rated manager is the neutral benchmark; the catalog spans 75-90, so the
       squad power swings between -3% and +6%. */
    const COACH_NEUTRAL_RATING = 80;
    const COACH_RATING_WEIGHT = 0.003;
    const coachMultiplier = coach => 1 + (coach.r - COACH_NEUTRAL_RATING) * COACH_RATING_WEIGHT;
    const coachAdjustedPower = (base, coach) => Math.min(99, Math.max(1, Math.round(base * coachMultiplier(coach))));
    function mkCoachPool() {
      const pool = [
        shuffle(COACHES.filter(c => c.tier === "legendary"))[0],
        shuffle(COACHES.filter(c => c.tier === "regular"))[0],
        shuffle(COACHES.filter(c => c.tier === "weak"))[0]
      ].filter(Boolean);
      shuffle(COACHES).forEach(coach => {
        if (pool.length < 4 && !pool.some(existing => existing.n === coach.n)) pool.push(coach);
      });
      return shuffle(pool);
    }
    const FORMATIONS = [
      { id: "4-3-3", name: "هجوم متوازن", lines: [["F", 3], ["M", 3], ["D", 4], ["G", 1]] },
      { id: "4-3-3 DM", name: "ارتكاز دفاعي", lines: [["F", 3], ["M", 3], ["D", 4], ["G", 1]] },
      { id: "4-3-3 AM", name: "صانع لعب", lines: [["F", 3], ["M", 3], ["D", 4], ["G", 1]] },
      { id: "4-4-2", name: "توازن كلاسيكي", lines: [["F", 2], ["M", 4], ["D", 4], ["G", 1]] },
      { id: "4-2-4", name: "هجوم مفتوح", lines: [["F", 4], ["M", 2], ["D", 4], ["G", 1]] },
      { id: "4-2-3-1", name: "وسط وصانع لعب", lines: [["F", 1], ["M", 3], ["M", 2], ["D", 4], ["G", 1]] },
      { id: "3-5-2", name: "سيطرة وسط", lines: [["F", 2], ["M", 5], ["D", 3], ["G", 1]] },
      { id: "3-4-3", name: "ضغط هجومي", lines: [["F", 3], ["M", 4], ["D", 3], ["G", 1]] },
      { id: "4-1-4-1", name: "ارتكاز وأجنحة", lines: [["F", 1], ["M", 4], ["M", 1], ["D", 4], ["G", 1]] },
      { id: "4-5-1", name: "كتلة وسطية", lines: [["F", 1], ["M", 5], ["D", 4], ["G", 1]] },
      { id: "5-3-2", name: "دفاع وهجمات مرتدة", lines: [["F", 2], ["M", 3], ["D", 5], ["G", 1]] },
      { id: "5-4-1", name: "دفاع محكم", lines: [["F", 1], ["M", 4], ["D", 5], ["G", 1]] },
      { id: "3-4-2-1", name: "ثلاثي خلف المهاجم", lines: [["F", 1], ["M", 2], ["M", 4], ["D", 3], ["G", 1]] }
    ];
    const DEFAULT_FORMATION = "4-3-3";
    let selectedFormation = DEFAULT_FORMATION;
    let opponentFormation = DEFAULT_FORMATION;
    const formationById = id => FORMATIONS.find(f => f.id === id) || FORMATIONS[0];
    const PLAYER_BY_NAME = new Map(P.map(player => [player.n, player]));
    const COACH_BY_NAME = new Map(COACHES.map(coach => [coach.n, coach]));
    const formationSlots = id => {
      const counts = { G: 0, D: 0, M: 0, F: 0 };
      formationById(id).lines.forEach(([pos, count]) => { counts[pos] += count });
      return ["G", ...Array(counts.D).fill("D"), ...Array(counts.M).fill("M"), ...Array(counts.F).fill("F")];
    };
    const FORMATION_ROLE_LINES = {
      "4-3-3": { D: ["LB", "CB", "CB", "RB"], M: ["CM", "CM", "CM"], F: ["LW", "ST", "RW"] },
      "4-3-3 DM": { D: ["LB", "CB", "CB", "RB"], M: ["CM", "CDM", "CM"], F: ["LW", "ST", "RW"] },
      "4-3-3 AM": { D: ["LB", "CB", "CB", "RB"], M: ["CM", "CAM", "CM"], F: ["LW", "ST", "RW"] },
      "4-2-4": { D: ["LB", "CB", "CB", "RB"], M: ["CM", "CM"], F: ["LW", "ST", "ST", "RW"] },
      "4-4-2": { D: ["LB", "CB", "CB", "RB"], M: ["LM", "CM", "CM", "RM"], F: ["ST", "ST"] },
      "4-2-3-1": { D: ["LB", "CB", "CB", "RB"], M: ["CAM", "CAM", "CAM", "CDM", "CDM"], F: ["ST"] },
      "3-5-2": { D: ["CB", "CB", "CB"], M: ["LM", "CM", "CDM", "CM", "RM"], F: ["ST", "ST"] },
      "3-4-3": { D: ["CB", "CB", "CB"], M: ["LM", "CM", "CM", "RM"], F: ["LW", "ST", "RW"] },
      "4-1-4-1": { D: ["LB", "CB", "CB", "RB"], M: ["LM", "CM", "CM", "RM", "CDM"], F: ["ST"] },
      "4-5-1": { D: ["LB", "CB", "CB", "RB"], M: ["LM", "CM", "CDM", "CM", "RM"], F: ["ST"] },
      "5-3-2": { D: ["LB", "CB", "CB", "CB", "RB"], M: ["CM", "CDM", "CM"], F: ["ST", "ST"] },
      "5-4-1": { D: ["LB", "CB", "CB", "CB", "RB"], M: ["LM", "CM", "CM", "RM"], F: ["ST"] },
      "3-4-2-1": { D: ["CB", "CB", "CB"], M: ["CAM", "CAM", "LM", "CM", "CM", "RM"], F: ["ST"] }
    };
    const POSITION_GROUP = {
      GK: "G", CB: "D", LB: "D", RB: "D",
      CDM: "M", CM: "M", CAM: "M", LM: "M", RM: "M",
      LW: "F", RW: "F", ST: "F"
    };
    const formationRoleSlots = id => {
      const roles = FORMATION_ROLE_LINES[formationById(id).id];
      return ["GK", ...roles.D, ...roles.M, ...roles.F];
    };
    const lineupBaseRating = (team, formationId) => {
      const players = Array.isArray(team) ? team : [];
      if (players.length !== 11 || players.some(player => !player)) return null;
      const roles = formationRoleSlots(formationId);
      const slots = formationSlots(formationId);
      const values = players.map((player, index) => {
        const role = roles[index];
        if (!role) return player.r;
        if (player.role === role) return player.r;
        if (playsRole(player, role)) return player.r - 2;
        if (playsGroup(player, POSITION_GROUP[role] || slots[index])) return player.r - 5;
        return player.r - 8;
      });
      return Math.round(values.reduce((sum, rating) => sum + rating, 0) / 11);
    };
    /* Main role + optional extra roles ("alt" in fut-data.js). */
    const playerRoles = player => [player.role, ...(player.alt || [])];
    const playsRole = (player, role) => playerRoles(player).includes(role);
    const playerGroups = player => [...new Set(playerRoles(player).map(role => POSITION_GROUP[role]).filter(Boolean))];
    const playsGroup = (player, group) => !!group && playerGroups(player).includes(group);
    const alignTeamToFormation = (team, id) => {
      const roles = formationRoleSlots(id), groups = formationSlots(id), remaining = team.filter(Boolean);
      return roles.map((role, index) => {
        let playerIndex = remaining.findIndex(player => player.role === role);
        if (playerIndex < 0) playerIndex = remaining.findIndex(player => playsRole(player, role));
        if (playerIndex < 0) playerIndex = remaining.findIndex(player => playsGroup(player, groups[index]));
        return playerIndex < 0 ? null : remaining.splice(playerIndex, 1)[0];
      });
    };
    const POS_NAME = {
      G: "حارس مرمى", D: "مدافع", M: "لاعب وسط", F: "مهاجم",
      GK: "حارس مرمى", CB: "قلب دفاع", LB: "ظهير أيسر", RB: "ظهير أيمن",
      CDM: "وسط دفاعي", CM: "وسط", CAM: "وسط هجومي", LM: "وسط أيسر", RM: "وسط أيمن",
      LW: "جناح أيسر", RW: "جناح أيمن", ST: "مهاجم"
    };
    const POS_SHORT = {
      G: "GK", D: "DF", M: "MF", F: "FW",
      GK: "GK", CB: "CB", LB: "LB", RB: "RB",
      CDM: "CDM", CM: "CM", CAM: "CAM", LM: "LM", RM: "RM",
      LW: "LW", RW: "RW", ST: "ST"
    };
    const MATCH_REWARDS = { win: 20000, draw: 10000, loss: 5000 };
    /* Offline matches pay less than online matches, with a small loss reward. */
    const OFFLINE_MATCH_REWARDS = { win: 10000, draw: 5000, loss: 2500 };
    /* Results use an explicit win/draw/loss distribution. Equal teams start at a 45% draw chance;
       rating differences favor the stronger side while keeping upsets possible. */
    const MATCH_BASE_EXPECTED_GOALS = 1.25;
    const STARTING_COINS = 9000000;
    const FORMATION_PRICE = 100000;
    const SALE_PRICE_PERCENT = 70;
    const COMPUTER_DIFFICULTIES = [
      { id: "easy", name: "سهل", min: 80, max: 84, target: 82, coachTarget: 72 },
      { id: "normal", name: "متوسط", min: 85, max: 91, target: 88, coachTarget: 85 },
      { id: "hard", name: "صعب", min: 92, max: 98, target: 94, coachTarget: 92 }
    ];
    const formatCoins = amount => amount.toLocaleString("en-US");
    const cardSalePrice = card => Number.isSafeInteger(card.price) && card.price > 0
      ? Math.floor(card.price * SALE_PRICE_PERCENT / 100)
      : null;
    const coachPrice = coach => coach.price;
    const BENCH_SLOT_POSITIONS = ["G", "D", "M", "F", ...Array(8).fill(null)];


