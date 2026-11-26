/* ================= AI OPPONENT ================= */
    function aiPlayerPool(role, used) {
      const exact = P.filter(player => playsRole(player, role) && !used.has(player.n));
      const available = exact.length
        ? exact
        : P.filter(player => playsGroup(player, POSITION_GROUP[role]) && !used.has(player.n));
      const strong = shuffle(available.filter(player => player.r >= 88));
      const medium = shuffle(available.filter(player => player.r >= 75 && player.r < 88));
      const weak = shuffle(available.filter(player => player.r < 75));
      const pool = [strong[0], medium[0], weak[0], weak[1]].filter(Boolean);
      shuffle(available).forEach(player => {
        if (pool.length < 4 && !pool.includes(player)) pool.push(player);
      });
      return shuffle(pool);
    }

    function aiTeam(formationId) {
      let sum = 0; const names = [], sws = [], pools = [], used = new Set();
      const slots = formationSlots(formationId);
      const roles = formationRoleSlots(formationId);
      roles.forEach(role => {
        const c = aiPlayerPool(role, used);
        let i = 0;
        if (c[0] && c[0].r < 80 && c[1]) i = 1;
        const x = c[i] || c[0];
        sws.push(i ? c[0].n : null);
        pools.push(c.map(z => z.n));
        used.add(x.n);
        names.push(x.n);
        sum += x.r;
      });
      const baseAvg = Math.round(sum / 11);
      const coach = COACHES[Math.floor(Math.random() * COACHES.length)];
      return { avg: coachAdjustedPower(baseAvg, coach), baseAvg, names, sws, pools, name: "الكمبيوتر", formation: formationId, slots, coach };
    }

    function aiClubTeam(difficulty) {
      const formation = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)];
      const slots = formationSlots(formation.id);
      const roles = formationRoleSlots(formation.id);
      const used = new Set();
      const names = roles.map(role => {
        const exact = P.filter(player => playsRole(player, role) && !used.has(player.n));
        const available = exact.length ? exact : P.filter(player => playsGroup(player, POSITION_GROUP[role]) && !used.has(player.n));
        const inRange = available.filter(player => player.r >= difficulty.min && player.r <= difficulty.max);
        const candidates = inRange.length
          ? inRange
          : available.slice().sort((a, b) =>
            Math.abs(a.r - difficulty.target) - Math.abs(b.r - difficulty.target)).slice(0, 10);
        if (!candidates.length) throw new Error(`No computer players available for position ${role}.`);
        const player = candidates[Math.floor(Math.random() * candidates.length)];
        used.add(player.n);
        return player.n;
      });
      const players = names.map(name => P.find(player => player.n === name));
      const baseAvg = Math.round(players.reduce((sum, player) => sum + player.r, 0) / players.length);
      const coachCandidates = COACHES.slice()
        .sort((a, b) => Math.abs(a.r - difficulty.coachTarget) - Math.abs(b.r - difficulty.coachTarget))
        .slice(0, 12);
      const coach = coachCandidates[Math.floor(Math.random() * coachCandidates.length)];
      return {
        avg: coachAdjustedPower(baseAvg, coach),
        baseAvg,
        names,
        name: `الكمبيوتر · ${difficulty.name}`,
        formation: formation.id,
        slots,
        coach
      };
    }


