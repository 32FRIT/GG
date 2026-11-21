/* ================= HELPERS ================= */
    const app = document.getElementById("app");
    const $ = id => document.getElementById(id);
    const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[b[i], b[j]] = [b[j], b[i]] } return b };
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    let toastT = null;
    function toast(msg) {
      document.querySelectorAll(".toast").forEach(t => t.remove());
      const d = document.createElement("div");
      d.className = "toast"; d.innerHTML = "<i>" + esc(msg) + "</i>";
      document.body.appendChild(d);
      clearTimeout(toastT);
      toastT = setTimeout(() => d.remove(), 1800);
    }
    function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms) } catch (e) { } }

    const GUEST_PROGRESS_KEY = "gg_guest_progress_v1";
    const PACK_CHANCES_KEY = "gg_pack_chances_v1";
    const STAR_KEEPER_CUP_WON_KEY = "gg_star_keeper_cup_won_v1";
    const STAR_KEEPER_PACK_KEY = "gg_star_keeper_pack_v1";
    const STAR_KEEPER_PACK_OPENED_KEY = "gg_star_keeper_pack_opened_v1";
    const STAR_KEEPER_PACK_WINNER_KEY = "gg_star_keeper_pack_winner_v1";
    const STAR_KEEPER_FREE_OPENING_KEY = "gg_star_keeper_free_opening_granted_v1";
    const STAR_KEEPER_CUP_OPENING_GRANTED_KEY = "gg_star_keeper_cup_opening_granted_v1";
    const STAR_KEEPER_WON_PLAYERS_KEY = "gg_star_keeper_won_players_v1";
    const STAR_KEEPER_PENDING_PLAYERS_KEY = "gg_star_keeper_pending_players_v1";
    const STAR_KEEPER_TOURNAMENT_KEY = "gg_star_keeper_tournament_v1";
    const STAR_KEEPER_COMPUTER_LEVEL = { id: "star-keeper-89", name: "89", min: 86, max: 92, target: 89, coachTarget: 80 };
    let activeTournament = null, tournamentTeam = null, tournamentResult = null;
    let eventTournamentRoundLabel = "ربع النهائي";
    function saveTournamentProgress() {
      try {
        if (!activeTournament) { localStorage.removeItem(STAR_KEEPER_TOURNAMENT_KEY); return true; }
        const payload = { activeTournament, tournamentTeam: tournamentTeam ? {
          names: tournamentTeam.team.map(player => player.n),
          benchNames: (tournamentTeam.bench || Array(12).fill(null)).map(player => player ? player.n : null),
          formation: tournamentTeam.formation, coach: tournamentTeam.coach.n
        } : null, tournamentResult, eventTournamentRoundLabel };
        localStorage.setItem(STAR_KEEPER_TOURNAMENT_KEY, JSON.stringify(payload));
        return true;
      } catch (error) { console.warn("Could not save Star Keeper tournament progress.", error); return false; }
    }
    function restoreTournamentProgress() {
      try {
        const saved = JSON.parse(localStorage.getItem(STAR_KEEPER_TOURNAMENT_KEY) || "null");
        if (!saved) return;
        const round = saved.activeTournament && saved.activeTournament.round, total = saved.activeTournament && saved.activeTournament.total;
        if (!Number.isInteger(round) || round < 1 || round > 3 || total !== 3) throw new Error("Invalid tournament stage");
        let restoredTeam = null;
        if (saved.tournamentTeam) {
          const names = saved.tournamentTeam.names, formation = FORMATIONS.find(item => item.id === saved.tournamentTeam.formation);
          const coach = COACHES.find(item => item.n === saved.tournamentTeam.coach);
          if (!Array.isArray(names) || names.length !== 11 || new Set(names).size !== 11 || !formation || !coach) throw new Error("Invalid tournament team");
          const team = names.map(name => P.find(player => player.n === name)), slots = formationSlots(formation.id);
          if (team.some((player, index) => !player || !playsGroup(player, slots[index]))) throw new Error("Invalid starters");
          const benchNames = Array.isArray(saved.tournamentTeam.benchNames) ? saved.tournamentTeam.benchNames : Array(12).fill(null);
          const validBench = benchNames.length === BENCH_SLOT_POSITIONS.length && benchNames.every((name, index) =>
            name === null || typeof name === "string" && P.some(player => player.n === name) &&
            (!BENCH_SLOT_POSITIONS[index] || playsGroup(P.find(player => player.n === name), BENCH_SLOT_POSITIONS[index]))) &&
            new Set([...names, ...benchNames.filter(Boolean)]).size === names.length + benchNames.filter(Boolean).length;
          if (!validBench) throw new Error("Invalid bench");
          restoredTeam = { team, bench: benchNames.map(name => name ? P.find(player => player.n === name) : null), formation: formation.id, coach };
        }
        const result = saved.tournamentResult;
        if (result != null && (!result || typeof result.won !== "boolean" || typeof result.final !== "boolean")) throw new Error("Invalid result");
        activeTournament = { round, total }; tournamentTeam = restoredTeam; tournamentResult = result || null;
        eventTournamentRoundLabel = typeof saved.eventTournamentRoundLabel === "string" ? saved.eventTournamentRoundLabel : ["ربع النهائي", "نصف النهائي", "النهائي"][round - 1];
      } catch (error) {
        console.warn("Invalid saved tournament.", error); activeTournament = tournamentTeam = tournamentResult = null;
        try { localStorage.removeItem(STAR_KEEPER_TOURNAMENT_KEY) } catch (_) { }
      }
    }
    restoreTournamentProgress();
    let starKeeperCupWon = false, starKeeperCupOpeningGranted = false;
    let starKeeperPack = null, starKeeperPackOpened = false, starKeeperPackWinner = null;
    let starKeeperWonPlayers = [], starKeeperPendingPlayers = [];
    try {
      starKeeperCupWon = localStorage.getItem(STAR_KEEPER_CUP_WON_KEY) === "true";
      starKeeperCupOpeningGranted = localStorage.getItem(STAR_KEEPER_CUP_OPENING_GRANTED_KEY) === "true";
      starKeeperPack = JSON.parse(localStorage.getItem(STAR_KEEPER_PACK_KEY) || "null");
      starKeeperPackOpened = localStorage.getItem(STAR_KEEPER_PACK_OPENED_KEY) === "true";
      starKeeperPackWinner = localStorage.getItem(STAR_KEEPER_PACK_WINNER_KEY) || null;
      const savedWinners = JSON.parse(localStorage.getItem(STAR_KEEPER_WON_PLAYERS_KEY) || "[]");
      const savedPending = JSON.parse(localStorage.getItem(STAR_KEEPER_PENDING_PLAYERS_KEY) || "[]");
      starKeeperWonPlayers = Array.isArray(savedWinners) ? [...new Set(savedWinners.filter(name => P.some(player => player.n === name)))] : [];
      starKeeperPendingPlayers = Array.isArray(savedPending) ? [...new Set(savedPending.filter(name => starKeeperWonPlayers.includes(name)))] : [];
    } catch (_) {
      starKeeperCupWon = false; starKeeperCupOpeningGranted = false; starKeeperPack = null;
      starKeeperPackOpened = false; starKeeperPackWinner = null; starKeeperWonPlayers = []; starKeeperPendingPlayers = [];
    }
    let freePackChances = 0;
    try {
      const savedPackChances = Number(localStorage.getItem(PACK_CHANCES_KEY));
      if (Number.isSafeInteger(savedPackChances) && savedPackChances > 0) freePackChances = savedPackChances;
    } catch (error) { console.warn("Could not read pack chances.", error) }
    function savePackChances() {
      try { localStorage.setItem(PACK_CHANCES_KEY, String(freePackChances)); return true }
      catch (error) { console.warn("Could not save pack chances.", error); return false }
    }
    function saveStarKeeperPlayerClaims() {
      try {
        localStorage.setItem(STAR_KEEPER_WON_PLAYERS_KEY, JSON.stringify(starKeeperWonPlayers));
        localStorage.setItem(STAR_KEEPER_PENDING_PLAYERS_KEY, JSON.stringify(starKeeperPendingPlayers));
        return true;
      } catch (error) { console.warn("Could not save Star Keeper players.", error); return false }
    }
    if (starKeeperPackWinner && P.some(player => player.n === starKeeperPackWinner) && !starKeeperWonPlayers.includes(starKeeperPackWinner)) {
      starKeeperWonPlayers.push(starKeeperPackWinner);
      starKeeperPendingPlayers.push(starKeeperPackWinner);
      saveStarKeeperPlayerClaims();
    }
    if (starKeeperPackOpened && !starKeeperPackWinner) {
      starKeeperPackOpened = false;
      try { localStorage.removeItem(STAR_KEEPER_PACK_OPENED_KEY) } catch (_) { }
    }
    let starterOpeningGranted = false;
    try { starterOpeningGranted = localStorage.getItem(STAR_KEEPER_FREE_OPENING_KEY) === "true" } catch (_) { }
    if (!starterOpeningGranted) {
      if (!starKeeperPackOpened && !starKeeperPackWinner) freePackChances = Math.max(1, freePackChances);
      try { localStorage.setItem(STAR_KEEPER_FREE_OPENING_KEY, "true") } catch (_) { }
      savePackChances();
    }
    if (starKeeperCupWon && !starKeeperCupOpeningGranted) {
      freePackChances++;
      starKeeperCupOpeningGranted = true;
      try { localStorage.setItem(STAR_KEEPER_CUP_OPENING_GRANTED_KEY, "true") } catch (_) { }
      savePackChances();
    }
    function emptyGuestProgress() {
      return {
        version: 7,
        record: { played: 0, wins: 0, draws: 0, losses: 0, bestRating: 0 },
        lastTeam: null,
        coins: STARTING_COINS,
        club: null
      };
    }

    function validGuestRecord(record) {
      const counts = record && [record.played, record.wins, record.draws, record.losses];
      return !!(counts && counts.every(value => Number.isSafeInteger(value) && value >= 0) &&
        Number.isInteger(record.bestRating) && record.bestRating >= 0 && record.bestRating <= 99 &&
        record.wins + record.draws + record.losses === record.played);
    }

    function validLastTeam(lastTeam) {
      return lastTeam === null || !!(lastTeam &&
        Array.isArray(lastTeam.names) && lastTeam.names.length === 11 &&
        lastTeam.names.every(name => P.some(player => player.n === name)) &&
        FORMATIONS.some(formation => formation.id === lastTeam.formation) &&
        COACHES.some(coach => coach.n === lastTeam.coach) &&
        Number.isInteger(lastTeam.rating) && lastTeam.rating >= 1 && lastTeam.rating <= 99);
    }

    function validCostTable(table, keys) {
      if (!table || typeof table !== "object" || Array.isArray(table)) return false;
      const entries = Object.entries(table);
      return entries.length === keys.length &&
        keys.every(key => Object.prototype.hasOwnProperty.call(table, key)) &&
        entries.every(([key, value]) => keys.includes(key) && Number.isSafeInteger(value) && value >= 0);
    }

    function clubSetupCostBreakdown(club) {
      const sum = table => Object.values(table).reduce((total, cost) => total + cost, 0);
      const players = sum(club.assetCosts.players);
      const coaches = sum(club.assetCosts.coaches);
      const formations = sum(club.assetCosts.formations);
      return { players, coaches, formations, total: players + coaches + formations };
    }

    function validClub(club) {
      if (club === null) return true;
      if (!club || !FORMATIONS.some(formation => formation.id === club.formation) ||
        typeof club.confirmed !== "boolean" ||
        !Array.isArray(club.ownedFormations) ||
        club.ownedFormations.some(id => !FORMATIONS.some(formation => formation.id === id)) ||
        new Set(club.ownedFormations).size !== club.ownedFormations.length ||
        !club.ownedFormations.includes(club.formation) ||
        !Array.isArray(club.starters) || club.starters.length !== 11 ||
        !Array.isArray(club.bench) || club.bench.length !== BENCH_SLOT_POSITIONS.length ||
        !Array.isArray(club.coaches) ||
        club.coaches.some(name => !COACHES.some(coach => coach.n === name)) ||
        new Set(club.coaches).size !== club.coaches.length ||
        (club.coach !== null && (!club.coaches.includes(club.coach) ||
          !COACHES.some(coach => coach.n === club.coach)))) return false;

      const starters = formationSlots(club.formation);
      const names = [...club.starters, ...club.bench].filter(name => name !== null);
      const costs = club.assetCosts;
      if (names.some(name => !P.some(player => player.n === name)) ||
        new Set(names).size !== names.length ||
        !costs ||
        !validCostTable(costs.players, names) ||
        !validCostTable(costs.coaches, club.coaches) ||
        !validCostTable(costs.formations, club.ownedFormations)) return false;
      if (club.starters.some((name, index) => name !== null &&
        !playsGroup(P.find(player => player.n === name), starters[index]))) return false;
      return club.bench.every((name, index) => name === null || BENCH_SLOT_POSITIONS[index] === null ||
        playsGroup(P.find(player => player.n === name), BENCH_SLOT_POSITIONS[index]));
    }

    /* Saves written before the catalog encoding fix hold names like "PelÃ©".
       Repair them instead of silently dropping the card from the squad. */
    function coherenceName(raw) {
      if (typeof raw !== "string" || PLAYER_BY_NAME.has(raw) || COACH_BY_NAME.has(raw)) return raw;
      const chars = [...raw];
      if (!chars.some(char => char.charCodeAt(0) > 0x7F) ||
        chars.some(char => char.charCodeAt(0) > 0xFF)) return raw;
      try {
        return new TextDecoder("utf-8", { fatal: true })
          .decode(Uint8Array.from(chars, char => char.charCodeAt(0)));
      } catch (error) {
        return raw;
      }
    }

    function normalizeSavedTeam(lastTeam) {
      if (!lastTeam) return null;
      const candidate = {
        ...lastTeam,
        names: Array.isArray(lastTeam.names) ? lastTeam.names.map(coherenceName) : lastTeam.names,
        coach: coherenceName(lastTeam.coach)
      };
      return validLastTeam(candidate) ? candidate : null;
    }

    function sanitizeSavedClub(club) {
      if (club === null) return null;
      if (!club || !FORMATIONS.some(formation => formation.id === club.formation) ||
        !Array.isArray(club.starters) || club.starters.length !== 11 ||
        !Array.isArray(club.bench) || club.bench.length !== BENCH_SLOT_POSITIONS.length) return null;

      club = {
        ...club,
        starters: club.starters.map(coherenceName),
        bench: club.bench.map(coherenceName),
        coaches: Array.isArray(club.coaches) ? club.coaches.map(coherenceName) : club.coaches,
        coach: coherenceName(club.coach)
      };

      const positions = formationSlots(club.formation);
      const candidates = [...new Set([...club.starters, ...club.bench]
        .filter(name => typeof name === "string" && P.some(player => player.n === name)))];
      const takePlayer = requiredPosition => {
        const index = candidates.findIndex(name =>
          !requiredPosition || playsGroup(P.find(player => player.n === name), requiredPosition));
        return index < 0 ? null : candidates.splice(index, 1)[0];
      };
      const starters = positions.map(takePlayer);
      const bench = BENCH_SLOT_POSITIONS.map(position => position ? takePlayer(position) : null);
      BENCH_SLOT_POSITIONS.forEach((position, index) => {
        if (position === null && candidates.length) bench[index] = candidates.shift();
      });
      const ownedFormations = Array.isArray(club.ownedFormations)
        ? [...new Set(club.ownedFormations.filter(id => FORMATIONS.some(formation => formation.id === id)))]
        : [];
      if (!ownedFormations.includes(club.formation)) ownedFormations.unshift(club.formation);
      const activeCoach = COACHES.some(coach => coach.n === club.coach) ? club.coach : null;
      const coaches = Array.isArray(club.coaches)
        ? [...new Set(club.coaches.filter(name => COACHES.some(coach => coach.n === name)))]
        : [];
      if (activeCoach && !coaches.includes(activeCoach)) coaches.unshift(activeCoach);
      const playerNames = [...starters, ...bench].filter(name => name !== null);
      const savedCosts = club.assetCosts || {};
      const costsFor = (table, keys, fallback) => Object.fromEntries(keys.map(key => {
        const savedCost = table && table[key];
        const defaultCost = fallback(key);
        return [key, Number.isSafeInteger(savedCost) && savedCost >= 0
          ? savedCost
          : Number.isSafeInteger(defaultCost) && defaultCost >= 0 ? defaultCost : 0];
      }));
      const sanitized = {
        formation: club.formation,
        confirmed: typeof club.confirmed === "boolean" ? club.confirmed : true,
        ownedFormations,
        starters,
        bench,
        coaches,
        coach: activeCoach,
        assetCosts: {
          players: costsFor(savedCosts.players, playerNames, name => P.find(player => player.n === name).price),
          coaches: costsFor(savedCosts.coaches, coaches, name => coachPrice(COACHES.find(coach => coach.n === name))),
          formations: costsFor(savedCosts.formations, ownedFormations,
            id => id === ownedFormations[0] ? 0 : FORMATION_PRICE)
        }
      };
      return validClub(sanitized) ? sanitized : null;
    }

    function loadGuestProgress() {
      try {
        const raw = localStorage.getItem(GUEST_PROGRESS_KEY);
        if (!raw) return emptyGuestProgress();
        const saved = JSON.parse(raw);
        if (!saved || !validGuestRecord(saved.record)) {
          console.warn("Saved guest progress is invalid; starting a new local record.");
          toast("بيانات التقدم المحفوظ غير صالحة، بدأنا سجلًا جديدًا");
          return emptyGuestProgress();
        }
        const lastTeam = normalizeSavedTeam(saved.lastTeam);
        const club = sanitizeSavedClub(saved.club);
        if (saved.version === 1 || saved.version === 2) {
          return {
            version: 7,
            record: saved.record,
            lastTeam,
            coins: STARTING_COINS,
            club
          };
        }
        if (![3, 4, 5, 6, 7].includes(saved.version) || !Number.isSafeInteger(saved.coins) || saved.coins < 0) {
          console.warn("Saved guest progress is invalid; starting a new local record.");
          toast("بيانات التقدم المحفوظ غير صالحة، بدأنا سجلًا جديدًا");
          return emptyGuestProgress();
        }
        return {
          version: 7,
          record: saved.record,
          lastTeam,
          coins: saved.coins,
          club
        };
      } catch (error) {
        console.error("Could not load guest progress from this device.", error);
        toast("تعذر تحميل التقدم المحفوظ من هذا الجهاز");
        return emptyGuestProgress();
      }
    }

    let guestProgress = loadGuestProgress();

    function saveGuestProgress() {
      try {
        localStorage.setItem(GUEST_PROGRESS_KEY, JSON.stringify(guestProgress));
        return true;
      } catch (error) {
        console.error("Could not save guest progress to this device.", error);
        toast("تعذر حفظ التقدم على هذا الجهاز");
        return false;
      }
    }

    function snapshotClubProgress() {
      const club = guestProgress.club;
      return {
        coins: guestProgress.coins,
        club: club ? {
          ...club,
          ownedFormations: club.ownedFormations.slice(),
          starters: club.starters.slice(),
          bench: club.bench.slice(),
          coaches: club.coaches.slice(),
          assetCosts: {
            players: { ...club.assetCosts.players },
            coaches: { ...club.assetCosts.coaches },
            formations: { ...club.assetCosts.formations }
          }
        } : null
      };
    }

    function restoreClubProgress(snapshot) {
      guestProgress.coins = snapshot.coins;
      guestProgress.club = snapshot.club;
    }

    function commitClubProgress(snapshot) {
      if (saveGuestProgress()) return true;
      restoreClubProgress(snapshot);
      return false;
    }

    function recordGuestMatch(match, goalsFor, goalsAgainst) {
      const win = goalsFor > goalsAgainst;
      const draw = goalsFor === goalsAgainst;
      const online = match.mode === "online";
      if (!online && match.mode !== "ai") return;

      const rewards = online ? MATCH_REWARDS : OFFLINE_MATCH_REWARDS;
      const reward = win ? rewards.win : draw ? rewards.draw : rewards.loss;
      const previousCoins = guestProgress.coins;
      const previousRecord = online ? { ...guestProgress.record } : null;
      const previousTeam = online ? guestProgress.lastTeam : null;
      guestProgress.coins = Math.min(Number.MAX_SAFE_INTEGER, previousCoins + reward);

      if (online) {
        guestProgress.record.played++;
        if (win) guestProgress.record.wins++;
        else if (draw) guestProgress.record.draws++;
        else guestProgress.record.losses++;
        guestProgress.record.bestRating = Math.max(guestProgress.record.bestRating, match.avg);
        guestProgress.lastTeam = {
          names: match.names,
          formation: match.formation,
          coach: match.coach.n,
          rating: match.avg
        };
      }

      if (!saveGuestProgress()) {
        guestProgress.coins = previousCoins;
        if (online) {
          guestProgress.record = previousRecord;
          guestProgress.lastTeam = previousTeam;
        }
        return;
      }
      toast(online
        ? `مكافأة المباراة: +${reward.toLocaleString("en-US")} 🪙`
        : `مكافأة الأوفلاين: +${reward.toLocaleString("en-US")} 🪙`);
    }
    /* ---- sound (only after a real user gesture) ---- */
    let AC = null, muted = true;
    try { muted = localStorage.getItem("gg_muted") !== "false" } catch (e) { }
    function beep(freq, dur, type, vol) {
      if (muted) return;
      try {
        if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
        if (AC.state === "suspended") AC.resume();
        const o = AC.createOscillator(), g = AC.createGain();
        o.type = type || "sine"; o.frequency.value = freq;
        g.gain.setValueAtTime(0, AC.currentTime);
        g.gain.linearRampToValueAtTime(vol || .06, AC.currentTime + .01);
        g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime + (dur || .12));
        o.connect(g); g.connect(AC.destination);
        o.start(); o.stop(AC.currentTime + (dur || .12) + .02);
      } catch (e) { }
    }
    const sfxPick = () => { beep(520, .09, "triangle", .05); setTimeout(() => beep(780, .1, "triangle", .05), 70) };
    const sfxGood = () => { beep(660, .1, "sine", .06); setTimeout(() => beep(990, .14, "sine", .06), 90) };
    const sfxBad = () => beep(180, .18, "sawtooth", .05);
    const sfxGoal = () => { beep(440, .1, "square", .05); setTimeout(() => beep(660, .1, "square", .05), 100); setTimeout(() => beep(880, .18, "square", .05), 200) };
    const sfxWhistle = () => { beep(900, .08, "sine", .07); setTimeout(() => beep(1100, .12, "sine", .07), 90); setTimeout(() => beep(900, .18, "sine", .05), 200) };
    const sfxYellow = () => { beep(440, .06, "square", .04); setTimeout(() => beep(330, .1, "square", .04), 70) };
    const sfxRed = () => { beep(220, .1, "sawtooth", .06); setTimeout(() => beep(180, .18, "sawtooth", .06), 110) };


