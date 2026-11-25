/* ================= SIMULATION ================= */
    function rng32(s) {
      return () => {
        s |= 0; s = s + 0x6D2B79F5 | 0;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    function hs(str) {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
      return h >>> 0;
    }
    function pois(l, r) {
      const L = Math.exp(-l); let k = 0, p = 1;
      do { k++; p *= r() } while (p > L && k < 40);
      return k - 1;
    }
    function simulate(me, opp) {
      const key = x => x.names.join(",") + "|" + x.avg + "|" + x.formation + "|" + (x.coach ? x.coach.n : "");
      const seedOf = x => Number.isSafeInteger(x.seed) && x.seed >= 0 && x.seed < 0x100000000
        ? x.seed
        : null;
      const stableKey = x => `${key(x)}|${seedOf(x) === null ? "" : seedOf(x)}`;
      const mineFirst = stableKey(me) <= stableKey(opp);
      const A = mineFirst ? me : opp, B = mineFirst ? opp : me;
      const bothSeeded = seedOf(A) !== null && seedOf(B) !== null;
      const seedInput = bothSeeded
        ? `${stableKey(A)}#${stableKey(B)}`
        : `${key(A)}#${key(B)}`;
      const r = rng32(hs(seedInput));
      const rosterFor = team => {
        const map = new Map();
        [...(team.players || []), ...(team.benchPlayers || [])].forEach(player => {
          if (player && player.n) map.set(player.n, player);
        });
        return name => map.get(name) || findPlayer(name);
      };
      const ratingsByName = new Map();
      [A, B].forEach(team => {
        [...(team.players || []), ...(team.benchPlayers || [])].forEach(player => {
          if (player && player.n) ratingsByName.set(player.n, player.r);
        });
      });
      const ratingOf = name => ratingsByName.has(name) ? ratingsByName.get(name) : (findPlayer(name)?.r || 0);
      const ev = [];
      const occupiedEventMinutes = new Set();
      const pushEvent = event => {
        const preferred = Math.max(1, Math.min(90, Math.round(event.m)));
        let chosen = 0;
        for (let offset = 0; offset <= 90; offset++) {
          const later = preferred + offset, earlier = preferred - offset;
          if (later <= 90 && !occupiedEventMinutes.has(later)) { chosen = later; break; }
          if (earlier >= 1 && !occupiedEventMinutes.has(earlier)) { chosen = earlier; break; }
        }
        if (!chosen) for (let minute = 1; minute <= 90; minute++) if (!occupiedEventMinutes.has(minute)) { chosen = minute; break; }
        event.m = chosen || preferred;
        occupiedEventMinutes.add(event.m);
        ev.push(event);
        return event;
      };

      /* Match incidents are generated before the result so dismissals affect team strength.
         Substitutions run first so later cards and goals know who is still on the pitch. */
      const redMinutes = { A: [], B: [] };
      const pickFreeMinute = (from = 1, to = 90) => {
        let total = 0;
        for (let minute = from; minute <= to; minute++) if (!occupiedEventMinutes.has(minute)) total++;
        if (!total) return null;
        let roll = Math.floor(r() * total);
        for (let minute = from; minute <= to; minute++) {
          if (!occupiedEventMinutes.has(minute) && roll-- === 0) return minute;
        }
        return null;
      };
      ["A", "B"].forEach(side => {
        const team = side === "A" ? A : B;
        const resolve = rosterFor(team);
        const subbedOut = new Map();
        if (Array.isArray(team.benchNames) && team.benchNames.some(Boolean) && r() < 0.82) {
          const teamSlots = team.slots || formationSlots(team.formation);
          const availableBench = team.benchNames.map(name => resolve(name)).filter(player => player && playerGroups(player).some(group => group !== "G"));
          const count = Math.min(availableBench.length, 1 + (r() < 0.42 ? 1 : 0) + (r() < 0.12 ? 1 : 0));
          for (let i = 0; i < count; i++) {
            if (!availableBench.length) break;
            const minute = pickFreeMinute(55, 88);
            if (minute === null) break;
            const incoming = availableBench.splice(Math.floor(r() * availableBench.length), 1)[0];
            const outgoingOptions = team.names.map((name, index) => ({ player: resolve(name), group: teamSlots[index] }))
              .filter(item => item.player && item.group !== "G" && !subbedOut.has(item.player.n) && playsGroup(incoming, item.group));
            if (!outgoingOptions.length) continue;
            const outgoing = outgoingOptions[Math.floor(r() * outgoingOptions.length)].player;
            subbedOut.set(outgoing.n, minute);
            pushEvent({ m: minute, s: side, type: "sub", who: outgoing.n, for: incoming.n, impact: (incoming.r - outgoing.r) * 0.06 });
          }
        }
        const yellowedPlayers = new Set();
        const yellowCards = [];
        if (r() < 0.78) {
          const count = r() < 0.24 ? 2 : 1;
          for (let i = 0; i < count; i++) {
            const minute = pickFreeMinute(12, 88);
            if (minute === null) break;
            const available = team.names.filter(name => !yellowedPlayers.has(name) && (subbedOut.get(name) ?? 91) > minute);
            if (!available.length) break;
            const who = available[Math.floor(r() * available.length)];
            yellowedPlayers.add(who);
            const yellow = pushEvent({ m: minute, s: side, type: "yellow", who });
            yellowCards.push({ who, minute: yellow.m });
          }
        }
        const sentOff = new Set();
        yellowCards.forEach(card => {
          if (r() < 0.04) {
            const limit = Math.min(90, card.minute + 5 + Math.floor(r() * 36), (subbedOut.get(card.who) ?? 91) - 1);
            const minute = limit > card.minute ? pickFreeMinute(card.minute + 1, limit) : null;
            if (minute === null) return;
            pushEvent({ m: minute, s: side, type: "red", who: card.who, secondYellow: true });
            sentOff.add(card.who);
            redMinutes[side].push(minute);
          }
        });
        if (r() < 0.075) {
          const minute = pickFreeMinute(8, 85);
          if (minute !== null) {
            const available = team.names.filter(name => !sentOff.has(name) && !yellowedPlayers.has(name) && (subbedOut.get(name) ?? 91) > minute);
            if (available.length) {
              const who = available[Math.floor(r() * available.length)];
              pushEvent({ m: minute, s: side, type: "red", who });
              sentOff.add(who);
              redMinutes[side].push(minute);
            }
          }
        }
      });
      /* A removed player takes no further part: goals, assists and cards only use active players. */
      const removal = { A: new Map(), B: new Map() };
      const markRemoval = (side, name, minute) => {
        const previous = removal[side].get(name);
        if (previous === undefined || minute < previous) removal[side].set(name, minute);
      };
      ev.forEach(event => {
        if (event.type === "red") markRemoval(event.s, event.who, event.m);
      });
      const redMinuteOf = (side, name) => {
        const red = ev.find(event => event.s === side && event.type === "red" && event.who === name);
        return red ? red.m : Infinity;
      };
      /* Drop a substitution when its player was already sent off before that minute. */
      for (let index = ev.length - 1; index >= 0; index--) {
        const event = ev[index];
        if (event.type === "sub" && redMinuteOf(event.s, event.who) <= event.m) ev.splice(index, 1);
      }
      const playersOn = { A: [], B: [] };
      ev.forEach(event => {
        if (event.type !== "sub") return;
        markRemoval(event.s, event.who, event.m);
        playersOn[event.s].push({ name: event.for, minute: event.m });
      });

      const redImpact = minutes => minutes.reduce((impact, minute) => impact + 3.2 * ((90 - minute) / 90), 0);
      const substitutionImpact = side => ev
        .filter(event => event.s === side && event.type === "sub")
        .reduce((impact, event) => impact + (Number.isFinite(event.impact) ? event.impact : 0) * ((90 - event.m) / 90), 0);
      const gap = A.avg - B.avg - redImpact(redMinutes.A) + redImpact(redMinutes.B) +
        substitutionImpact("A") - substitutionImpact("B");
      const absGap = Math.abs(gap);
      const drawChance = 0.45 * Math.exp(-absGap / 2.5);
      const underdogChance = 0.125 * Math.exp(-absGap / 2);
      const favoriteShare = 1 - underdogChance / (1 - drawChance);
      const drawRoll = r();
      const favoriteIsA = absGap === 0 ? r() < 0.5 : gap > 0;
      let result;
      if (drawRoll < drawChance) {
        result = "draw";
      } else {
        const favoriteWon = (drawRoll - drawChance) / (1 - drawChance) < favoriteShare;
        result = favoriteIsA === favoriteWon ? "A" : "B";
      }

      const clampGoals = value => Math.min(2.4, Math.max(0.15, value));
      const edge = Math.min(Math.abs(gap), 10) * 0.035;
      const redGoalImpact = minutes => minutes.reduce((impact, minute) => impact + 0.25 * ((90 - minute) / 90), 0);
      const goalsA = clampGoals(MATCH_BASE_EXPECTED_GOALS + (gap > 0 ? edge : -edge) - redGoalImpact(redMinutes.A) + redGoalImpact(redMinutes.B));
      const goalsB = clampGoals(MATCH_BASE_EXPECTED_GOALS + (gap < 0 ? edge : -edge) - redGoalImpact(redMinutes.B) + redGoalImpact(redMinutes.A));
      let ga = pois(goalsA, r), gb = pois(goalsB, r);
      if (result === "draw") {
        gb = ga;
      } else if (result === "A" && ga <= gb) {
        ga = gb + 1;
      } else if (result === "B" && gb <= ga) {
        gb = ga + 1;
      }

      const stats = new Map();
      const statsFor = (side, name) => {
        const id = `${side}|${name}`;
        if (!stats.has(id)) stats.set(id, { s: side, who: name, goals: 0, assists: 0, saves: 0 });
        return stats.get(id);
      };
      const groupWeights = group => group === "F" ? { goal: 10, assist: 5 }
        : group === "M" ? { goal: 3, assist: 2 }
          : group === "D" ? { goal: 0.02, assist: 0.02 }
            : { goal: 0, assist: 0 };
      const activePool = (team, side, minute) => {
        const slots = team.slots || formationSlots(team.formation);
        const pool = [];
        team.names.forEach((name, index) => {
          const off = removal[side].get(name);
          if (off !== undefined && off <= minute) return;
          pool.push({ name, ...groupWeights(slots[index]) });
        });
        playersOn[side].forEach(entry => {
          if (entry.minute > minute) return;
          const player = rosterFor(team)(entry.name);
          const group = player ? (POSITION_GROUP[player.role] || player.p) : null;
          if (!group || group === "G") return;
          pool.push({ name: entry.name, ...groupWeights(group) });
        });
        return pool;
      };
      const pickWeighted = (pool, exclude, key) => {
        const options = pool.filter(entry => entry.name !== exclude);
        const total = options.reduce((sum, entry) => sum + entry[key], 0);
        if (!total) return null;
        let roll = total * r(), index = 0;
        while (index < options.length - 1 && roll >= options[index][key]) {
          roll -= options[index++][key];
        }
        return options[index][key] > 0 ? options[index].name : null;
      };
      const addGoals = (team, side, count) => {
        for (let i = 0; i < count; i++) {
          const minute = pickFreeMinute(1, 90);
          if (minute === null) break;
          const pool = activePool(team, side, minute);
          const scorer = pickWeighted(pool, null, "goal") || team.names[0];
          const assist = r() < 0.68 ? pickWeighted(pool, scorer, "assist") : null;
          statsFor(side, scorer).goals++;
          if (assist) statsFor(side, assist).assists++;
          pushEvent({ m: minute, s: side, type: "goal", who: scorer, assist });
        }
      };
      addGoals(A, "A", ga);
      addGoals(B, "B", gb);

      const goalkeeper = team => {
        const slots = team.slots || formationSlots(team.formation);
        const index = slots.findIndex(slot => slot === "G");
        return team.names[index >= 0 ? index : 0] || "الحارس";
      };
      const shotsOnTargetA = ga + 1 + Math.floor(r() * 7);
      const shotsOnTargetB = gb + 1 + Math.floor(r() * 7);
      statsFor("A", goalkeeper(A)).saves = shotsOnTargetB - gb;
      statsFor("B", goalkeeper(B)).saves = shotsOnTargetA - ga;

      const ratings = { A: {}, B: {} };
      const participants = { A: new Map(), B: new Map() };
      ["A", "B"].forEach(side => {
        const team = side === "A" ? A : B;
        const slots = team.slots || formationSlots(team.formation);
        team.names.forEach((name, index) => participants[side].set(name, slots[index] || "M"));
        ev.filter(event => event.s === side && event.type === "sub").forEach(event => {
          const player = rosterFor(team)(event.for);
          const slot = player ? (POSITION_GROUP[player.role] || player.p || "M") : "M";
          participants[side].set(event.for, slot);
        });
      });
      ["A", "B"].forEach(side => {
        const conceded = side === "A" ? gb : ga;
        const won = result === side, drew = result === "draw";
        participants[side].forEach((slot, name) => {
          const playerStats = stats.get(`${side}|${name}`) || { goals: 0, assists: 0, saves: 0 };
          const yellowCount = ev.filter(event => event.s === side && event.type === "yellow" && event.who === name).length;
          const redCount = ev.filter(event => event.s === side && event.type === "red" && event.who === name).length;
          let rating = 6 + playerStats.goals * 1.15 + playerStats.assists * 0.7 - yellowCount * 0.25 - redCount * 1.1;
          if (slot === "G") rating += playerStats.saves * 0.12 - conceded * 0.3;
          else if (slot === "D") rating += conceded === 0 ? 0.35 : -conceded * 0.08;
          if (won) rating += 0.25;
          else if (drew) rating += 0.1;
          ratings[side][name] = Math.round(Math.max(4, Math.min(10, rating)) * 10) / 10;
        });
      });

      // MVP is selected from every player who appeared, using the same final match rating shown in the UI.
      // Performance stats only break a rating tie; unused substitutes are not eligible.
      const candidates = ["A", "B"].flatMap(side =>
        Object.keys(ratings[side]).map(who => ({
          s: side,
          who,
          ...(stats.get(`${side}|${who}`) || { goals: 0, assists: 0, saves: 0 }),
          rating: ratings[side][who]
        }))
      );
      candidates.sort((x, y) =>
        y.rating - x.rating ||
        y.goals - x.goals ||
        y.assists - x.assists ||
        y.saves - x.saves ||
        ratingOf(y.who) - ratingOf(x.who)
      );
      const best = candidates[0];
      const reasonParts = [];
      if (best.assists) reasonParts.push(`${best.assists} ${best.assists === 1 ? "ASSIST" : "ASSISTS"}`);
      if (best.goals) reasonParts.push(`${best.goals} ${best.goals === 1 ? "GOAL" : "GOALS"}`);
      const reason = best.saves >= 5 && best.goals === 0 && best.assists === 0 && (best.s === "A" ? gb : ga) <= 2 && (best.s === "A" ? ga >= gb : gb >= ga)
        ? `${best.saves} SAVES`
        : reasonParts.join(" · ") || (best.saves >= 3 ? `${best.saves} SAVES` : `MATCH RATING ${best.rating.toFixed(1)}`);
      ev.sort((x, y) => x.m - y.m);
      return { mine: mineFirst, ev, ratings, motm: { s: best.s, who: best.who, reason } };
    }


