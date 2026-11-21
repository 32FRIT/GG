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
      const pickPlayer = x => x.names[Math.floor(r() * x.names.length)] || "لاعب";
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

      /* Match incidents are generated before the result so dismissals affect team strength. */
      const redMinutes = { A: [], B: [] };
      ["A", "B"].forEach(side => {
        const team = side === "A" ? A : B;
        if (r() < 0.78) {
          const count = r() < 0.24 ? 2 : 1;
          const yellowedPlayers = new Set();
          const yellowCards = [];
          for (let i = 0; i < count; i++) {
            const available = team.names.filter(n => !yellowedPlayers.has(n));
            if (!available.length) break;
            const who = available[Math.floor(r() * available.length)];
            const minute = 12 + Math.floor(r() * 76);
            yellowedPlayers.add(who);
            const yellow = pushEvent({ m: minute, s: side, type: "yellow", who });
            yellowCards.push({ who, minute: yellow.m });
          }
          yellowCards.forEach(card => {
            if (r() < 0.04) {
              const minute = Math.min(90, card.minute + 5 + Math.floor(r() * 36));
              const red = pushEvent({ m: minute, s: side, type: "red", who: card.who, secondYellow: true });
              redMinutes[side].push(red.m);
            }
          });
        }
        if (r() < 0.075) {
          const minute = 8 + Math.floor(r() * 78);
          const red = pushEvent({ m: minute, s: side, type: "red", who: pickPlayer(team) });
          redMinutes[side].push(red.m);
        }
        if (Array.isArray(team.benchNames) && team.benchNames.some(Boolean) && r() < 0.82) {
          const teamSlots = team.slots || formationSlots(team.formation);
          const availableBench = team.benchNames.map(name => P.find(player => player.n === name)).filter(player => player && playerGroups(player).some(group => group !== "G"));
          const subbedOut = new Set();
          const count = Math.min(availableBench.length, 1 + (r() < 0.42 ? 1 : 0) + (r() < 0.12 ? 1 : 0));
          for (let i = 0; i < count; i++) {
            if (!availableBench.length) break;
            const incoming = availableBench.splice(Math.floor(r() * availableBench.length), 1)[0];
            const outgoingOptions = team.names.map((name, index) => ({ player: P.find(player => player.n === name), group: teamSlots[index] }))
              .filter(item => item.player && item.group !== "G" && !subbedOut.has(item.player.n) && playsGroup(incoming, item.group));
            if (!outgoingOptions.length) continue;
            const outgoing = outgoingOptions[Math.floor(r() * outgoingOptions.length)].player;
            subbedOut.add(outgoing.n);
            pushEvent({ m: 55 + Math.floor(r() * 34), s: side, type: "sub", who: outgoing.n, for: incoming.n, impact: (incoming.r - outgoing.r) * 0.06 });
          }
        }
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

      const pickScorer = x => {
        const slots = x.slots || formationSlots(x.formation);
        const w = x.names.map((n, k) => slots[k] === "F" ? 10 : slots[k] === "M" ? 3 : slots[k] === "D" ? 0.02 : 0);
        const total = w.reduce((sum, value) => sum + value, 0);
        if (!total) return x.names[0];
        let t = total * r(), k = 0;
        while (k < w.length - 1 && t >= w[k]) { t -= w[k]; k++ }
        return x.names[k];
      };
      const stats = new Map();
      const statsFor = (side, name) => {
        const id = `${side}|${name}`;
        if (!stats.has(id)) stats.set(id, { s: side, who: name, goals: 0, assists: 0, saves: 0 });
        return stats.get(id);
      };
      const pickAssister = (team, scorer) => {
        const teamSlots = team.slots || formationSlots(team.formation);
        const weights = team.names.map((name, k) =>
          name === scorer ? 0 : teamSlots[k] === "F" ? 5 : teamSlots[k] === "M" ? 2 : teamSlots[k] === "D" ? 0.02 : 0
        );
        const total = weights.reduce((sum, value) => sum + value, 0);
        if (!total) return null;
        let roll = total * r(), index = 0;
        while (index < weights.length - 1 && roll >= weights[index]) {
          roll -= weights[index++];
        }
        return weights[index] > 0 ? team.names[index] : null;
      };
      const addGoals = (team, side, count) => {
        for (let i = 0; i < count; i++) {
          const scorer = pickScorer(team);
          const assist = r() < 0.68 ? pickAssister(team, scorer) : null;
          statsFor(side, scorer).goals++;
          if (assist) statsFor(side, assist).assists++;
          pushEvent({ m: 1 + Math.floor(r() * 90), s: side, type: "goal", who: scorer, assist });
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

      const candidates = [...stats.values()];
      candidates.sort((x, y) => {
        const goalsAgainst = s => s === "A" ? gb : ga;
        const didNotLose = s => s === "A" ? ga >= gb : gb >= ga;
        const score = player => player.goals * 4 + player.assists * 2.5 + (player.saves >= 5 && goalsAgainst(player.s) <= 2 && didNotLose(player.s) ? player.saves * 0.6 : 0);
        return score(y) - score(x) ||
          (P.find(player => player.n === y.who)?.r || 0) - (P.find(player => player.n === x.who)?.r || 0);
      });
      const best = candidates[0];
      const reasonParts = [];
      if (best.assists) reasonParts.push(`${best.assists} ${best.assists === 1 ? "ASSIST" : "ASSISTS"}`);
      if (best.goals) reasonParts.push(`${best.goals} ${best.goals === 1 ? "GOAL" : "GOALS"}`);
      const reason = best.saves >= 5 && best.goals === 0 && best.assists === 0 && (best.s === "A" ? gb : ga) <= 2 && (best.s === "A" ? ga >= gb : gb >= ga)
        ? `${best.saves} SAVES`
        : reasonParts.join(" · ") || (best.saves >= 3 ? `${best.saves} SAVES` : "IMPACTFUL PERFORMANCE");
      const ratings = { A: {}, B: {} };
      ["A", "B"].forEach(side => {
        const team = side === "A" ? A : B;
        const conceded = side === "A" ? gb : ga;
        const won = result === side, drew = result === "draw";
        team.names.forEach((name, index) => {
          const playerStats = stats.get(`${side}|${name}`) || { goals: 0, assists: 0, saves: 0 };
          const yellowCount = ev.filter(event => event.s === side && event.type === "yellow" && event.who === name).length;
          const redCount = ev.filter(event => event.s === side && event.type === "red" && event.who === name).length;
          const slot = (team.slots || formationSlots(team.formation))[index];
          let rating = 6 + playerStats.goals * 1.15 + playerStats.assists * 0.7 - yellowCount * 0.25 - redCount * 1.1;
          if (slot === "G") rating += playerStats.saves * 0.12 - conceded * 0.3;
          else if (slot === "D") rating += conceded === 0 ? 0.35 : -conceded * 0.08;
          if (won) rating += 0.25;
          else if (drew) rating += 0.1;
          ratings[side][name] = Math.round(Math.max(4, Math.min(10, rating)) * 10) / 10;
        });
      });
      ev.sort((x, y) => x.m - y.m);
      return { mine: mineFirst, ev, ratings, motm: { s: best.s, who: best.who, reason } };
    }


