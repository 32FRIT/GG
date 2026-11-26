/* ================= GAME FLOW ================= */
    function startGame() {
      cancelGameTimers();
      gameLive = true;
      if (draftMode === "choice") return startChoiceDraft();
      S = { i: 0, team: [], used: new Set(), pool: [], shown: new Set(), sw: 1, phase: "pick", sel: null, formation: selectedFormation, slots: formationSlots(selectedFormation), roles: formationRoleSlots(selectedFormation), coach: null, coachPool: [], coachShown: new Set(), coachSwap: 1, mode: conn && conn.open ? "online" : "ai", matchSeed: Math.floor(Math.random() * 0x100000000) };
      round();
    }

    function round() {
      clearInterval(advanceTimer);
      advanceTimer = null;
      clearTimeout(phaseTimeout);
      phaseTimeout = null;
      if (S.i >= 11) return startCoachDraft();
      S.multiSeen = S.multiSeen || new Set();
      S.pool = mkPool(S.roles[S.i], new Set([...S.used, ...S.multiSeen]));
      S.pool.forEach(x => { if (x.alt.length) S.multiSeen.add(x.n); });
      S.shown = new Set();
      S.sw = 1;
      S.phase = "pick";
      S.sel = null;
      tEnd = Date.now() + TM * 1000;
      drawPick();
      startTimer(TM, () => {
        if (S.phase !== "pick") return;
        const available = S.pool
          .map((x, k) => S.shown.has(x.n) ? null : k)
          .filter(k => k !== null);
        const k = S.sel != null && !S.shown.has(S.pool[S.sel].n)
          ? S.sel
          : available[Math.floor(Math.random() * available.length)];
        if (k != null) keepPick(k);
      });
    }

    function mkPool(role, used) {
      const exact = P.filter(player => playsRole(player, role) && !used.has(player.n));
      const av = exact.length ? exact : P.filter(player => playsGroup(player, POSITION_GROUP[role]) && !used.has(player.n));
      const st = shuffle(av.filter(x => x.r >= 88));
      const md = shuffle(av.filter(x => x.r >= 75 && x.r < 88));
      const wk = shuffle(av.filter(x => x.r < 75));
      const pool = [st[0], md[0], wk[0], wk[1]].filter(Boolean);
      shuffle(av).forEach(x => { if (pool.length < 4 && !pool.includes(x)) pool.push(x) });
      return shuffle(pool);
    }

    function headerHTML() {
      const live = S.phase === "pick";
      const left = live ? Math.max(0, Math.ceil((tEnd - Date.now()) / 1000)) : 0;
      return `<div class="hdr">
    <div class="l"><span class="pos">${POS_SHORT[S.roles[S.i]]} · ${POS_NAME[S.roles[S.i]]}</span><span class="cnt">الاختيار ${S.i + 1} من 11 · ${formationById(S.formation).id}</span></div>
    <div class="timer ${live && left <= 10 ? "warn" : ""}" id="tm">${live ? left : "—"}</div>
    <button class="btn g sm" id="quit">انسحاب</button>
  </div>
  <div class="bar"><i id="bar" class="${live && left <= 10 ? "warn" : ""}" style="width:${live ? left / TM * 100 : 100}%"></i></div>`;
    }

    function coachHeaderHTML() {
      const left = Math.max(0, Math.ceil((tEnd - Date.now()) / 1000));
      return `<div class="hdr">
    <div class="l"><span class="pos">اختيار المدرب</span><span class="cnt">الاختيار 12 من 12 · ${formationById(S.formation).id}</span></div>
    <div class="timer ${left <= 10 ? "warn" : ""}" id="tm">${left}</div>
    <button class="btn g sm" id="quit">انسحاب</button>
  </div>
  <div class="bar"><i id="bar" class="${left <= 10 ? "warn" : ""}" style="width:${left / TM * 100}%"></i></div>`;
    }

    function squadHTML() {
      return `<div class="squad">
    <div class="lbl"><span>فريقك</span><span dir="ltr">${S.team.length} / 11</span></div>
    <div class="slots">
      ${(S.roles || formationRoleSlots(S.formation)).map((role, k) => {
        const t = S.team[k];
        if (t) return `<div class="slot on">${esc(t.n)}</div>`;
        if (k === S.i) return `<div class="slot now">${POS_SHORT[role]}</div>`;
        return `<div class="slot">${POS_SHORT[role]}</div>`;
      }).join("")}
    </div>
  </div>`;
    }

    function formationHTML(team, formationId, title) {
      const formation = formationById(formationId);
      team = alignTeamToFormation(team, formation.id);
      const slots = formationSlots(formation.id);
      const roles = formationRoleSlots(formation.id);
      const offsets = { G: 0, D: 1, M: 1 + slots.filter(p => p === "D").length, F: 1 + slots.filter(p => p === "D").length + slots.filter(p => p === "M").length };
      const used = { G: 0, D: 0, M: 0, F: 0 };
      const rows = formation.lines.map(([pos, count]) => {
        const players = Array.from({ length: count }, () => {
          const index = offsets[pos] + used[pos]++;
          const player = team[index];
          return player
            ? `<div class="pitch-player has-player-card" aria-label="${esc(player.n)}">${cardHTML(player, "formation-player-card")}</div>`
            : `<div class="pitch-player"><small>${POS_SHORT[roles[index]]}</small><b>—</b></div>`;
        }).join("");
        return `<div class="pitch-row">${players}</div>`;
      }).join("");
      return `<div class="sec-title">${esc(title)} · <b dir="ltr">${formation.id}</b></div><div class="pitch">${rows}</div>`;
    }

    function matchRoleTag(role, warn) {
      const text = POS_SHORT[role] || role || "";
      if (!text) return "";
      return `<span class="match-role-tag${warn ? " warn" : ""}" dir="ltr" aria-label="${text}${warn ? " · مركز غير مناسب" : ""}"><i>${text}</i><b aria-hidden="true">${warn ? "!" : "◆"}</b></span>`;
    }

    function matchFormationRows(team, formationId, ratings, mvpName, reverseRows) {
      const formation = formationById(formationId);
      team = alignTeamToFormation(team, formation.id);
      const slots = formationSlots(formation.id);
      const roles = formationRoleSlots(formation.id);
      const offsets = { G: 0, D: 1, M: 1 + slots.filter(pos => pos === "D").length, F: 1 + slots.filter(pos => pos === "D").length + slots.filter(pos => pos === "M").length };
      const used = { G: 0, D: 0, M: 0, F: 0 };
      const lines = formation.lines.map(([position, count]) => {
        const start = offsets[position] + used[position];
        used[position] += count;
        return { position, count, start };
      });
      const displayLines = reverseRows ? lines.slice().reverse() : lines;
      return displayLines.map(({ position, count, start }) => {
        const players = Array.from({ length: count }, (_, rowIndex) => {
          const index = start + rowIndex;
          const player = team[index];
          const role = roles[index];
          if (!player) return `<div class="pitch-player"><small>${POS_SHORT[role] || ""}</small><b>—</b></div>`;
          const rating = Number.isFinite(ratings[player.n]) ? ratings[player.n] : 6;
          const tone = rating < 6 ? "low" : rating < 7 ? "average" : "";
          const isMvp = player.n === mvpName;
          return `<div class="pitch-player has-player-card"><div class="match-player-art"><span class="match-rating-badge ${tone} ${isMvp ? "mvp" : ""}" aria-label="تقييم المباراة ${rating.toFixed(1)}">${rating.toFixed(1)}${isMvp ? `<span class="star">★</span>` : ""}</span>${cardHTML(player, "formation-player-card")}</div>${matchRoleTag(role, !playsRole(player, role))}</div>`;
        }).join("");
        return `<div class="pitch-row">${players}</div>`;
      }).join("");
    }

    function matchFormationHTML(myTeam, myFormation, myRatings, myMvp, opponentTeam, opponentFormation, opponentRatings, opponentMvp) {
      const mine = formationById(myFormation), theirs = formationById(opponentFormation);
      const pitchHeight = Math.max(mine.lines.length, theirs.lines.length) * 136;
      const pitchIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/><circle cx="12" cy="12" r="3.2"/></svg>`;
      return `<div class="match-lineup" data-view="mine">
          <div class="match-lineup-view" data-lineup="mine">
            <div class="match-formation-label">تشكيلتك · <b dir="ltr">${mine.id}</b></div>
            <div class="match-pitch single" style="--match-pitch-height:${pitchHeight}px;--match-row-count:${mine.lines.length}">${matchFormationRows(myTeam, mine.id, myRatings, myMvp, false)}</div>
          </div>
          <div class="match-lineup-view" data-lineup="opp" hidden>
            <div class="match-formation-label">تشكيلة الخصم · <b dir="ltr">${theirs.id}</b></div>
            <div class="match-pitch single" style="--match-pitch-height:${pitchHeight}px;--match-row-count:${theirs.lines.length}">${matchFormationRows(opponentTeam, theirs.id, opponentRatings, opponentMvp, false)}</div>
          </div>
          <div class="match-pitch-tools" dir="ltr">
            <button type="button" class="match-view-btn active" data-match-view="mine" aria-pressed="true" aria-label="تشكيلتي" title="تشكيلتي">${pitchIcon}</button>
            <button type="button" class="match-view-btn" data-match-view="opp" aria-pressed="false" aria-label="تشكيلة الخصم" title="تشكيلة الخصم">${pitchIcon}</button>
          </div>
        </div>`;
    }
    function coachCardHTML(coach, cls) {
      const tierKey = COACH_TIER[coach.tier] ? coach.tier : "regular";
      const tier = COACH_TIER[tierKey];
      const effect = Math.round((coachMultiplier(coach) - 1) * 1000) / 10;
      const effectText = `${effect > 0 ? "+" : effect < 0 ? "-" : ""}${Math.abs(effect).toFixed(1).replace(/\.0$/, "")}%`;
      const needle = Math.max(6, Math.min(94, 50 + (effect / 6) * 44));
      const art = typeof COACH_ART !== "undefined" ? COACH_ART[coach.id] : null;
      return `<div class="fc coach ${cls || ""}" data-tier="${tierKey}" style="--needle:${needle.toFixed(1)}%">
    <div class="fc-coach-pitch" aria-hidden="true"></div>
    ${art
          ? `<img class="fc-coach-photo" src="${art}" alt="مدرب ${esc(coach.n)}" loading="lazy" decoding="async">`
          : `<div class="fc-coach-mono" aria-hidden="true">م</div>`}
    <div class="fc-coach-spine">
      <b class="fc-coach-rating">${coach.r}</b>
      <span class="fc-coach-rail" aria-hidden="true"></span>
      <span class="fc-coach-effect ${effect > 0 ? "up" : effect < 0 ? "down" : ""}" dir="ltr">${effectText}</span>
      <span class="fc-coach-deviation" aria-hidden="true"></span>
    </div>
    <div class="fc-coach-plate">
      <span class="fc-coach-name" dir="auto">${esc(coach.n)}</span>
      <span class="fc-coach-tier">${tier.name}</span>
    </div>
  </div>`;
    }

    function pickStackHTML(frontCard) {
      return `<div class="pick-card-stack">
      <div class="fc back stack-back" aria-hidden="true"><span>GG</span></div>
      <div class="fc back stack-back" aria-hidden="true"><span>GG</span></div>
      <div class="fc back stack-back" aria-hidden="true"><span>GG</span></div>
      <div class="fcwrap pick-card-front">${frontCard}</div>
    </div>`;
    }

    function choicePlayerFitsRole(player, role) {
      if (!player || !role) return false;
      return playsRole(player, role);
    }

    function choicePlayerFitsGroup(player, group) {
      if (!player || !group) return false;
      return playsGroup(player, group);
    }

    function choiceBenchGroup(index) {
      return BENCH_SLOT_POSITIONS[index] || null;
    }

    function choicePool(poolSize, role) {
      const used = new Set(S && S.used ? S.used : []);
      if (S && S.captain) used.add(S.captain.n);
      let available = P.filter(player => !used.has(player.n));
      if (role) {
        available = available.filter(player => choicePlayerFitsRole(player, role));
      }
      const strong = available.filter(player => player.r >= 90);
      const regular = available.filter(player => player.r >= 80 && player.r < 90);
      const weak = available.filter(player => player.r < 80);
      const pool = [];
      const strongLimit = 3;
      if (strong.length && S.choiceStrongCount < strongLimit && Math.random() < .58) pool.push(shuffle(strong)[0]);
      shuffle(regular).forEach(player => {
        if (pool.length < poolSize && !pool.includes(player)) pool.push(player);
      });
      shuffle(weak).forEach(player => {
        if (pool.length < poolSize && !pool.includes(player)) pool.push(player);
      });
      shuffle(available).forEach(player => {
        if (pool.length < poolSize && !pool.includes(player)) pool.push(player);
      });
      return shuffle(pool.slice(0, poolSize));
    }

    function startChoiceDraft() {
      gameLive = true;
      startChoiceDeadline();
      choiceReadyLocal = false;
      choiceReadyRemote = false;
      S = {
        i: 0, team: [], starters: [], bench: Array(12).fill(null), used: new Set(), pool: [], captain: null, coach: null,
        formation: selectedFormation, phase: "choice-coach", draftMode: "choice",
        choiceStrongCount: 0, choiceStrongLimit: 3,
        choiceBenchVisible: false, choiceBenchSelectedIndex: null,
        mode: conn && conn.open ? "online" : "ai", entry: "draft"
      };
      drawChoiceFormation();
    }

    function drawChoiceCoach() {
      S.phase = "choice-coach";
      S.coachPool = shuffle(COACHES).slice(0, 6);
      app.innerHTML = `<div class="hdr"><div class="l"><span class="pos">اختار المدرب</span><span class="cnt">الجولة الثانية · اختار واحد من 6</span></div><button class="btn g sm" id="quit">انسحاب</button></div>
        <p class="note">اختار المدرب المكشوف لفريقك.</p>
        <div class="grid pick-grid choice-grid">${S.coachPool.map((coach, index) => `<button class="fcwrap choice-card" data-choice-coach="${index}" aria-label="اختار مدرب ${esc(coach.n)}">${coachCardHTML(coach, "pick")}</button>`).join("")}</div>`;
      bindQuitButton();
      app.querySelectorAll("[data-choice-coach]").forEach(button => {
        button.onclick = () => {
          S.coach = S.coachPool[+button.dataset.choiceCoach];
          buzz(8);
          drawChoiceCaptain();
        };
      });
    }

    function drawChoiceCaptain() {
      S.phase = "choice-captain";
      const availableRoles = [...new Set(S.roles.filter(Boolean))];
      S.captainPool = shuffle(P.filter(player =>
        player.r >= 90 &&
        availableRoles.some(role => choicePlayerFitsRole(player, role))
      )).slice(0, 6);
      app.innerHTML = `<div class="hdr"><div class="l"><span class="pos">اختار الكابتن</span><span class="cnt">الجولة الثالثة · اختار قائد قوي</span></div><button class="btn g sm" id="quit">انسحاب</button></div>
        <p class="note">الكابتن اختياري قوي من 90 فما فوق.</p>
        <div class="grid pick-grid choice-grid">${S.captainPool.map((player, index) => `<button class="fcwrap choice-card" data-choice-captain="${index}" aria-label="اختار كابتن ${esc(player.n)}">${cardHTML(player, "pick")}</button>`).join("")}</div>`;
      bindQuitButton();
      app.querySelectorAll("[data-choice-captain]").forEach(button => {
        button.onclick = () => {
          S.captain = S.captainPool[+button.dataset.choiceCaptain];
          S.team = [S.captain];
          S.used = new Set([S.captain.n]);
          S.starters = Array(S.roles.length).fill(null);
          let captainIndex = S.roles.findIndex(role => choicePlayerFitsRole(S.captain, role));
          if (captainIndex < 0) captainIndex = -1;
          if (captainIndex < 0) {
            toast("الكابتن غير مناسب لأي دور في الخطة");
            return;
          }
          S.starters[captainIndex] = S.captain;
          S.choiceStrongCount = 1;
          buzz(10);
          drawChoiceLineup();
        };
      });
    }

    function drawChoiceFormation() {
      S.phase = "choice-formation";
      app.innerHTML = `<div class="hdr"><div class="l"><span class="pos">اختار التشكيلة</span><span class="cnt">الجولة الأولى · اختار خطتك</span></div><button class="btn g sm" id="quit">انسحاب</button></div>
        <p class="note">اختار الخطة قبل توزيع اللاعبين على المراكز.</p>
        <div class="formation-grid">${FORMATIONS.map(formation => `<button class="formation-option ${formation.id === selectedFormation ? "active" : ""}" data-choice-formation="${formation.id}" aria-pressed="${formation.id === selectedFormation}">
          <b>${formation.id}</b><small>${formation.name}</small>
        </button>`).join("")}</div>`;
      bindQuitButton();
      app.querySelectorAll("[data-choice-formation]").forEach(button => {
        button.onclick = () => {
          selectedFormation = button.dataset.choiceFormation;
          S.formation = selectedFormation;
          S.roles = formationRoleSlots(selectedFormation);
          drawChoiceCoach();
        };
      });
    }

    function drawChoiceLineup() {
      if (!S) return;
      S.phase = "choice-position";
      const filled = S.starters.filter(Boolean).length;
      const benchFilled = S.bench ? S.bench.slice(0,4).filter(Boolean).length : 0;
      const teamReady = filled >= 11 && benchFilled >= 4;
      const lineupTeam = S.starters;
      const lineupRating = lineupTeam.length === 11
        ? lineupBaseRating(lineupTeam, S.formation)
        : null;
      const liveOverall = lineupRating === null
        ? "—"
        : coachAdjustedPower(lineupRating, S.coach);
      const formation = formationById(S.formation);
      const slots = formationSlots(S.formation);
      const offsets = {
        G: 0,
        D: 1,
        M: 1 + slots.filter(position => position === "D").length,
        F: 1 + slots.filter(position => position === "D").length + slots.filter(position => position === "M").length
      };
      const used = { G: 0, D: 0, M: 0, F: 0 };
      const rows = formation.lines.map(([position, count]) => {
        const cells = Array.from({ length: count }, () => {
          const index = offsets[position] + used[position]++;
          const role = S.roles[index];
          const player = S.starters[index];
          return player
            ? player.n === (S.captain && S.captain.n)
              ? `<button class="pitch-player squad-slot has-player-card ${S.choiceSelectedIndex === index ? "selected" : ""}" data-choice-edit="${index}" data-choice-role="${role}" type="button" aria-label="الكابتن ${esc(player.n)}">
                ${cardHTML(player, "choice-slot-card")}
                ${role ? `<span class="match-role-tag" dir="ltr"><i>${POS_SHORT[role]}</i><b>◆</b></span>` : ""}
              </button>`
              : `<button class="pitch-player squad-slot has-player-card ${S.choiceSelectedIndex === index ? "selected" : ""}" data-choice-edit="${index}" data-choice-role="${role}" type="button" aria-label="تبديل ${esc(player.n)} في مركز ${POS_NAME[role]}">
                ${cardHTML(player, "choice-slot-card")}
                ${role ? `<span class="match-role-tag" dir="ltr"><i>${POS_SHORT[role]}</i><b>◆</b></span>` : ""}
              </button>`
            : `<button class="pitch-player squad-slot empty" data-choice-role="${role}" data-choice-index="${index}" type="button" aria-label="اختار لاعب ${POS_NAME[role]}">
                ${emptySlotCardHTML(role)}
              </button>`;
        }).join("");
        return `<div class="pitch-row">${cells}</div>`;
      }).join("");
      app.innerHTML = `<div class="choice-draft-screen">
        <div class="hdr"><div class="l"><span class="pos">تشكيلتي</span><span class="cnt">الأساسي ${filled} من 11 · <b dir="ltr">${S.formation}</b></span></div><button class="btn g sm" id="quit">انسحاب</button></div>
        <div class="choice-draft-top">
          <span>مدربك: <b>${esc(S.coach.n)}</b></span>
          <span>كابتن: <b>${esc(S.captain.n)}</b></span>
          <span class="choice-live-ovr">OVR <b dir="ltr">${liveOverall}</b></span>
        </div>
        <div class="pitch squad-pitch choice-draft-pitch">${rows}</div>
        ${S.choiceBenchVisible ? `<div class="choice-bench-sheet"><div class="bench-grid">
          ${BENCH_SLOT_POSITIONS.map((position, index) => {
            if (index >= 4) return `<button class="bench-slot choice-bench-lock" type="button" disabled aria-label="مكان احتياطي مقفل">🔒<small>مقفل</small></button>`;
            const player = S.bench[index];
            const label = position ? `بديل ${POS_NAME[position]}` : "احتياطي مرن";
            return `<button class="bench-slot ${player ? "owned-slot" : ""} ${S.choiceBenchSelectedIndex === index ? "selected" : ""}" data-choice-bench-slot="${index}" data-position="${position || "ANY"}" type="button" aria-label="${player ? `تبديل ${esc(player.n)}` : `إضافة ${esc(label)}`}">
              ${player ? `<small>${label}</small>${cardHTML(player, "bench-player-card")}` : `${emptySlotCardHTML(position || "M")}`}
            </button>`;
          }).join("")}
        </div></div>` : ""}
        <div class="choice-draft-actions" dir="ltr">
          <button class="choice-bench-inline" id="choice-bench-inline" type="button">${S.choiceBenchVisible ? "إخفاء الاحتياطي" : "الاحتياطي"}</button>
          ${teamReady ? `<button class="choice-ready-inline" id="choice-ready-inline" type="button">${choiceReadyLocal ? "مستعد ✓" : "مستعد"}</button>` : ""}
        </div>
      </div>`;
      bindQuitButton();
      app.querySelectorAll("[data-choice-role]").forEach(button => {
        button.onclick = () => {
          const targetIndex = +button.dataset.choiceIndex;
          if (Number.isInteger(S.choiceSelectedIndex)) {
            const sourceIndex = S.choiceSelectedIndex;
            const sourcePlayer = S.starters[sourceIndex];
            const targetRole = S.roles[targetIndex];
            if (!sourcePlayer || !choicePlayerFitsRole(sourcePlayer, targetRole)) {
              toast(`هذا اللاعب لا يلائم مركز ${POS_NAME[targetRole] || targetRole}`);
              S.choiceSelectedIndex = null;
              drawChoiceLineup();
              return;
            }
            S.starters[targetIndex] = S.starters[sourceIndex];
            S.starters[sourceIndex] = null;
            S.choiceSelectedIndex = null;
            S.team = S.starters.filter(Boolean);
            if (choiceReadyLocal) {
              choiceReadyLocal = false;
              if (conn && conn.open) try { conn.send({ t: "choice-unready" }); } catch (_) {}
            }
            buzz(6);
            drawChoiceLineup();
            return;
          }
          drawChoicePlayerRound(button.dataset.choiceRole, targetIndex);
        };
      });
      app.querySelectorAll("[data-choice-edit]").forEach(button => {
        button.onclick = () => {
          const index = +button.dataset.choiceEdit;
          if (Number.isInteger(S.choiceBenchSelectedIndex)) {
            const benchIndex = S.choiceBenchSelectedIndex;
            const benchPlayer = S.bench[benchIndex];
            const role = S.roles[index];
            if (!benchPlayer || !choicePlayerFitsRole(benchPlayer, role)) {
              toast("الاحتياطي لا يناسب هذا المركز");
              S.choiceBenchSelectedIndex = null;
              drawChoiceLineup();
              return;
            }
            const oldStarter = S.starters[index];
            S.starters[index] = benchPlayer;
            const benchGroup = choiceBenchGroup(benchIndex);
            S.bench[benchIndex] = oldStarter && (!benchGroup || choicePlayerFitsGroup(oldStarter, benchGroup)) ? oldStarter : null;
            S.choiceBenchSelectedIndex = null;
            S.team = S.starters.filter(Boolean);
            drawChoiceLineup();
            return;
          }
          if (!Number.isInteger(S.choiceSelectedIndex)) {
            S.choiceSelectedIndex = index;
            buzz(6);
            drawChoiceLineup();
            return;
          }
          if (S.choiceSelectedIndex === index) {
            S.choiceSelectedIndex = null;
            drawChoiceLineup();
            return;
          }
          const sourceIndex = S.choiceSelectedIndex;
          const sourcePlayer = S.starters[sourceIndex];
          const targetPlayer = S.starters[index];
          const sourceRole = S.roles[sourceIndex];
          const targetRole = S.roles[index];
          const sourceFitsTarget = sourcePlayer && targetRole && choicePlayerFitsRole(sourcePlayer, targetRole);
          const targetFitsSource = targetPlayer && sourceRole && choicePlayerFitsRole(targetPlayer, sourceRole);
          if (!sourceFitsTarget || !targetFitsSource) {
            toast("التبديل غير مناسب للمركزين");
            S.choiceSelectedIndex = null;
            drawChoiceLineup();
            return;
          }
          [S.starters[sourceIndex], S.starters[index]] = [S.starters[index], S.starters[sourceIndex]];
          S.choiceSelectedIndex = null;
          S.team = S.starters.filter(Boolean);
          if (choiceReadyLocal) {
            choiceReadyLocal = false;
            if (conn && conn.open) try { conn.send({ t: "choice-unready" }); } catch (_) {}
          }
          buzz(8);
          drawChoiceLineup();
        };
      });
      if ($("choice-bench-inline")) $("choice-bench-inline").onclick = () => {
        S.choiceBenchVisible = !S.choiceBenchVisible;
        drawChoiceLineup();
      };
      app.querySelectorAll("[data-choice-bench-slot]").forEach(button => {
        button.onclick = () => {
          const index = +button.dataset.choiceBenchSlot;
          if (index >= 4) return toast("مكان الاحتياطي المقفل غير متاح في الدريفت");
          const position = button.dataset.position;
          if (Number.isInteger(S.choiceSelectedIndex)) {
            const starterIndex = S.choiceSelectedIndex;
            const starterPlayer = S.starters[starterIndex];
            const benchGroup = choiceBenchGroup(index);
            if (!starterPlayer || (benchGroup && !choicePlayerFitsGroup(starterPlayer, benchGroup))) {
              toast("اللاعب لا يناسب مكان الاحتياطي");
              return;
            }
            S.bench[index] = starterPlayer;
            S.starters[starterIndex] = null;
            S.choiceSelectedIndex = null;
            S.team = S.starters.filter(Boolean);
            drawChoiceLineup();
            return;
          }
          if (S.bench[index]) {
            S.choiceBenchSelectedIndex = S.choiceBenchSelectedIndex === index ? null : index;
            drawChoiceLineup();
            return;
          }
          if (Number.isInteger(S.choiceBenchSelectedIndex)) {
            const sourceIndex = S.choiceBenchSelectedIndex;
            const sourcePlayer = S.bench[sourceIndex];
            if (!sourcePlayer) {
              S.choiceBenchSelectedIndex = null;
              return drawChoiceLineup();
            }
            if (choiceBenchGroup(index) && !choicePlayerFitsGroup(sourcePlayer, choiceBenchGroup(index))) {
              toast("اللاعب لا يناسب مكان الاحتياطي");
              return;
            }
            S.bench[index] = sourcePlayer;
            S.bench[sourceIndex] = null;
            S.choiceBenchSelectedIndex = null;
            drawChoiceLineup();
            return;
          }
          drawChoiceBenchPlayerRound(index);
        };
      });
      if ($("choice-ready-inline")) $("choice-ready-inline").onclick = () => markChoiceReady();
    }

    function drawChoicePlayerRound(role, slotIndex) {
      if (!S) return;
      S.phase = "choice-player";
      S.choiceRole = role;
      S.choiceSlotIndex = slotIndex;
      S.pool = choicePool(6, role);
      S.pool = S.pool.filter(player => player.n !== S.captain.n).slice(0, 6);
      app.innerHTML = `<div class="hdr"><div class="l"><span class="pos">${role} · ${POS_NAME[role] || role}</span><span class="cnt">اختيار اللاعب · الأساسيات ${S.team.length} من 11</span></div><button class="btn g sm" id="quit">انسحاب</button></div>
        <p class="note">اختار واحدًا من 6 كروت مكشوفة لهذا المركز.</p>
        <div class="grid pick-grid choice-grid">${S.pool.map((player, index) => `<button class="fcwrap choice-card" data-choice-player="${index}" aria-label="اختار ${esc(player.n)}">${cardHTML(player, "pick")}</button>`).join("")}</div>`;
      bindQuitButton();
      app.querySelectorAll("[data-choice-player]").forEach(button => {
        button.onclick = () => keepChoicePlayer(+button.dataset.choicePlayer);
      });
    }

    function keepChoicePlayer(index) {
      if (!S || S.phase !== "choice-player") return;
      const player = S.pool[index];
      if (!player) return;
      if (!Number.isInteger(S.choiceSlotIndex) || S.starters[S.choiceSlotIndex]) return;
      S.starters[S.choiceSlotIndex] = player;
      S.team = S.starters.filter(Boolean);
      if (choiceReadyLocal) {
        choiceReadyLocal = false;
        if (conn && conn.open) try { conn.send({ t: "choice-unready" }); } catch (_) {}
      }
      S.used.add(player.n);
      if (player.r >= 90) S.choiceStrongCount++;
      buzz(10); sfxGood();
      setTimeout(() => {
        if (S && S.phase === "choice-player") drawChoiceLineup();
      }, 350);
    }

    function markChoiceReady() {
      if (!S || !S.starters || S.starters.filter(Boolean).length < 11) return toast("اكمل التشكيلة الأساسية أولًا");
      if (!S.bench || S.bench.slice(0,4).filter(Boolean).length < 4) return toast("اختار أربعة احتياطيين أولًا");
      choiceReadyLocal = true;
      buzz(10);
      if (conn && conn.open) {
        try { conn.send({ t: "choice-ready" }); } catch (_) { return netFail("تعذر إرسال حالة الاستعداد", screenModes); }
        toast(choiceReadyRemote ? "الطرفان مستعدان — بنبدأ المباراة" : "انت مستعد — مستني خصمك");
      }
      drawChoiceLineup();
      if (!conn || !conn.open) finishChoiceDraft();
      else if (choiceReadyRemote) finishChoiceDraft();
    }

    function choiceLineupPitchHTML() {
      if (!S || !S.formation) return "";
      const formation = formationById(S.formation);
      const slots = formationSlots(S.formation);
      const offsets = {
        G: 0,
        D: 1,
        M: 1 + slots.filter(position => position === "D").length,
        F: 1 + slots.filter(position => position === "D").length + slots.filter(position => position === "M").length
      };
      const used = { G: 0, D: 0, M: 0, F: 0 };
      const rows = formation.lines.map(([position, count]) => {
        const cells = Array.from({ length: count }, () => {
          const index = offsets[position] + used[position]++;
          const role = S.roles[index];
          const player = S.starters[index];
          return player
            ? `<div class="pitch-player squad-slot has-player-card">${cardHTML(player, "choice-slot-card")}<span class="match-role-tag" dir="ltr"><i>${POS_SHORT[role]}</i><b>◆</b></span></div>`
            : `<div class="pitch-player squad-slot empty">${emptySlotCardHTML(role)}</div>`;
        }).join("");
        return `<div class="pitch-row">${cells}</div>`;
      }).join("");
      return `<div class="pitch squad-pitch choice-draft-pitch choice-bench-lineup">${rows}</div>`;
    }

    function drawChoiceBenchRound() {
      if (!S) return;
      S.choiceBenchVisible = true;
      drawChoiceLineup();
    }

    function drawChoiceBenchPlayerRound(benchIndex) {
      if (!S || benchIndex < 0 || benchIndex >= 4 || S.bench[benchIndex]) return drawChoiceBenchRound();
      const position = BENCH_SLOT_POSITIONS[benchIndex];
      const role = position === "G" ? "GK" : position === "D" ? "CB" : position === "M" ? "CM" : position === "F" ? "ST" : null;
      S.phase = "choice-bench-player";
      if (position === "D") {
        S.pool = shuffle(P.filter(player =>
          !S.used.has(player.n) &&
          ["LB","CB","RB"].some(defenderRole => choicePlayerFitsRole(player, defenderRole))
        )).slice(0,6);
      } else if (position === "M") {
        S.pool = shuffle(P.filter(player =>
          !S.used.has(player.n) &&
          ["CM","CDM","CAM","LM","RM"].some(midRole => choicePlayerFitsRole(player, midRole))
        )).slice(0,6);
      } else if (position === "F") {
        S.pool = shuffle(P.filter(player =>
          !S.used.has(player.n) &&
          ["LW","ST","RW"].some(forwardRole => choicePlayerFitsRole(player, forwardRole))
        )).slice(0,6);
      } else {
        S.pool = choicePool(6, role);
      }
      app.innerHTML = `<div class="choice-draft-screen">
        <div class="hdr"><div class="l"><span class="pos">${POS_NAME[position]}</span><span class="cnt">اختيار الاحتياطي · ${benchIndex + 1} من 4</span></div><button class="btn g sm" id="quit">انسحاب</button></div>
        <div class="choice-draft-top"><span>اختار لاعبًا احتياطيًا لـ <b>${POS_NAME[position]}</b></span><span dir="ltr">${role}</span></div>
        <div class="grid pick-grid choice-grid">${S.pool.map((player, index) => `<button class="fcwrap choice-card" data-choice-bench="${index}" aria-label="اختار احتياطي ${esc(player.n)}">${cardHTML(player, "pick")}</button>`).join("")}</div>
        <button class="btn g w mt" id="bench-change-slot">تغيير المركز</button>
      </div>`;
      bindQuitButton();
      $("bench-change-slot").onclick = drawChoiceBenchRound;
      app.querySelectorAll("[data-choice-bench]").forEach(button => {
        button.onclick = () => {
          const player = S.pool[+button.dataset.choiceBench];
          if (!player) return;
          S.bench[benchIndex] = player;
          S.used.add(player.n);
          if (choiceReadyLocal) {
            choiceReadyLocal = false;
            if (conn && conn.open) try { conn.send({ t: "choice-unready" }); } catch (_) {}
          }
          buzz(10); sfxGood();
          drawChoiceBenchRound();
        };
      });
    }

    function finishChoiceDraft() {
      stopChoiceDeadline();
      S.phase = "choice-result";
      S.team = S.starters.filter(Boolean);
      S.bench = S.bench.map(player => player || null);
      S.slots = formationSlots(S.formation);
      S.roles = formationRoleSlots(S.formation);
      S.i = 11;
      S.matchSeed = Math.floor(Math.random() * 0x100000000);
      OPP = aiTeam(opponentFormation || S.formation);
      endGame();
    }

    function startCoachDraft() {
      if (S.coach) return endGame();
      S.phase = "coach-pick";
      S.coachPool = mkCoachPool();
      S.coachShown = new Set();
      S.coachSwap = 1;
      S.coachSel = null;
      drawCoachPick();
      startTimer(TM, () => {
        if (S && S.phase === "coach-pick") {
          const available = S.coachPool
            .map((coach, k) => S.coachShown.has(coach.n) ? null : k)
            .filter(k => k !== null);
          const k = S.coachSel != null && !S.coachShown.has(S.coachPool[S.coachSel].n)
            ? S.coachSel
            : available[Math.floor(Math.random() * available.length)];
          if (k != null) chooseCoach(k);
        }
      });
    }

    function drawCoachPick() {
      const selectedCoach = S.coachSel;
      const coachGrid = selectedCoach == null
        ? `<div class="grid pick-grid" style="margin-top:14px">
       ${S.coachPool.map((coach, k) => `<button class="fc back ${S.coachShown.has(coach.n) ? "used" : ""}" data-coach="${k}" aria-label="كارت مدرب مخفي ${k + 1}" ${S.coachShown.has(coach.n) ? "disabled" : ""}><span>${S.coachShown.has(coach.n) ? "✕" : "GG"}</span></button>`).join("")}
     </div>`
        : `<div class="pick-stage" style="margin-top:14px">
       <div class="grid pick-grid pick-stage-grid" aria-hidden="true">
         ${S.coachPool.map(coach => `<div class="fc back ${S.coachShown.has(coach.n) ? "used" : ""}"><span>${S.coachShown.has(coach.n) ? "✕" : "GG"}</span></div>`).join("")}
       </div>
       <div class="pick-overlay">
         <div class="pick-dialog" role="dialog" aria-modal="true" aria-label="تأكيد اختيار المدرب">
           <div class="pick-dialog-title">المدرب اللي اخترته</div>
           ${pickStackHTML(coachCardHTML(S.coachPool[selectedCoach], "pick"))}
           <div class="pick-actions">
             <button class="btn w" id="coachKeep">اختار المدرب وكمّل</button>
             ${S.coachSwap > 0 && S.coachPool.filter(coach => !S.coachShown.has(coach.n)).length > 1
          ? `<button class="btn g w" id="coachChange">غيّر المدرب</button>` : ""}
           </div>
         </div>
       </div>
     </div>`;
      app.innerHTML = coachHeaderHTML() +
        `<p class="note">اختار مدربك من ٤ كروت. تقييمه هيأثر على قوة فريقك.<br><b>${S.coachSwap ? "عندك تغيير واحد" : "التغيير خلص — اختيارك التالي إجباري"}</b></p>
     ${coachGrid}`;
      bindQuitButton();
      app.querySelectorAll("[data-coach]").forEach(button => button.onclick = () => {
        const k = +button.dataset.coach;
        if (S.coachShown.has(S.coachPool[k].n)) return;
        if (S.coachSwap === 0) {
          chooseCoach(k);
          return;
        }
        S.coachSel = k;
        drawCoachPick();
      });
      const keep = $("coachKeep");
      if (keep) keep.onclick = () => chooseCoach(S.coachSel);
      const change = $("coachChange");
      if (change) change.onclick = () => {
        S.coachSwap--;
        S.coachShown.add(S.coachPool[S.coachSel].n);
        S.coachSel = null;
        drawCoachPick();
      };
    }

    function chooseCoach(k) {
      if (!S || S.phase !== "coach-pick") return;
      const coach = S.coachPool[k];
      if (!coach || S.coachShown.has(coach.n)) return;
      S.coach = coach;
      stopTimer();
      endGame();
    }

    function drawPick() {
      S.phase = "pick";
      app.innerHTML = headerHTML() +
        `<p class="note">كل الكروت مخفية — اختار كارت وجرّب حظك.<br><b>${S.sw > 0 ? "عندك تغيير واحد في المركز ده" : "خلص تغييرك في المركز ده"}</b></p>
     <div class="grid pick-grid" style="margin-top:14px">
       ${S.pool.map((x, k) => backHTML(k, S.shown.has(x.n))).join("")}
     </div>`+ squadHTML();
      bindQuitButton();
      app.querySelectorAll("[data-k]").forEach(b => b.onclick = () => {
        const k = +b.dataset.k;
        if (S.shown.has(S.pool[k].n)) return;
        buzz(6); sfxPick();
        drawCard(k);
      });
    }

    function drawCard(k) {
      S.sel = k;
      const x = S.pool[k];
      if (S.sw === 0) {
        keepPick(k);
        return;
      }
      const hidden = S.pool.filter(y => !S.shown.has(y.n)).length;
      const canSwap = S.sw > 0 && hidden > 1;
      app.innerHTML = headerHTML() +
        `<p class="note">الكارت اللي اخترته ظهر لك — ضمّه لفريقك أو غيّره.</p>
     <div class="pick-stage" style="margin-top:14px">
       <div class="grid pick-grid pick-stage-grid" aria-hidden="true">
         ${S.pool.map(() => `<div class="fc back"><span>GG</span></div>`).join("")}
       </div>
       <div class="pick-overlay">
         <div class="pick-dialog" role="dialog" aria-modal="true" aria-label="الكارت الذي اخترته">
           <div class="pick-dialog-title">الكارت اللي اخترته</div>
           ${pickStackHTML(cardHTML(x, "pick"))}
           <div class="pick-actions">
             <button class="btn w" id="keep">ضمّه للفريق</button>
             ${canSwap ? `<button class="btn g w" id="chg">غيّر الكارت (${S.sw} متاح)</button>` : ""}
           </div>
         </div>
       </div>
     </div>`+ squadHTML();
      bindQuitButton();
      $("keep").onclick = () => { buzz(10); sfxGood(); keepPick(k) };
      const cg = $("chg");
      if (cg) cg.onclick = () => {
        S.sw--; S.shown.add(x.n); S.sel = null; buzz(6); sfxBad();
        drawPick();
      };
    }

    function keepPick(k) {
      if (S.phase !== "pick") return;
      const x = S.pool[k];
      if (!x || S.shown.has(x.n)) return;
      S.phase = "reveal";
      stopTimer();
      S.team.push(x);
      S.used.add(x.n);
      if (conn && conn.open) {
        try { conn.send({ t: "pick", i: S.i, n: x.n, s: [...S.shown][0] || null, p: S.pool.map(y => y.n) }) } catch (e) { }
      }
      revealAll(k);
    }

    function revealAll(sel) {
      const x = S.pool[sel];
      app.innerHTML = headerHTML() +
        `<p class="note">كروتك اتكشفت</p>
     <div class="grid pick-grid" style="margin-top:12px">
       ${S.pool.map((y, k) => {
          const isPick = y.n === x.n;
          const wasShown = S.shown.has(y.n);
          const cls = isPick ? "pick win" : (wasShown ? "dim" : "");
          const badge = isPick ? `<div class="badge ok">✓</div>` : (wasShown ? `<div class="badge no">✕</div>` : "");
          return `<div class="fcwrap">${badge}${cardHTML(y, cls)}</div>`;
        }).join("")}
     </div>
     <p class="note">اختيار الخصم بعد ثواني...</p>`+ squadHTML();
      bindQuitButton();
      phaseTimeout = setTimeout(() => {
        phaseTimeout = null;
        if (S && S.phase === "reveal") oppPhase();
      }, 2200);
    }

    function oppPhase() {
      S.phase = "opp";
      app.innerHTML = headerHTML() +
        `<div class="sec-title">اختيارك</div>
     <div class="fcwrap" style="max-width:180px;margin:0 auto">${cardHTML(S.team[S.i], "win")}</div>
     <div class="sec-title">اختيار الخصم</div>
        <div id="op"><p class="note">الخصم لسه مختارش...</p></div>
        <p class="note" id="advance"></p>`;
      bindQuitButton();
      stopTimer();
      const t = $("tm"); if (t) t.textContent = "—";
      const b = $("bar"); if (b) b.style.width = "100%";
      const settle = () => {
        if (!S || S.phase !== "opp") return;
        if (!OPPK[S.i]) {
          if (conn) {
            const box = $("op");
            if (box) box.innerHTML = `<p class="note">مستني اختيار الخصم...</p>`;
            return;
          }
          const pool = OPPP[S.i] || S.pool.map(y => y.n);
          OPPK[S.i] = pool[Math.floor(Math.random() * pool.length)];
        }
        paintOpp();
      };
      phaseTimeout = setTimeout(() => {
        phaseTimeout = null;
        settle();
      }, 900);
    }

    function paintOpp() {
      const box = $("op"); if (!box) return;
      const n = OPPK[S.i];
      if (!n) { box.innerHTML = `<p class="note">الخصم لسه مختارش...</p>`; return }
      const s = OPPS[S.i];
      const pl = (OPPP[S.i] || [n, s]).filter(Boolean);
      box.innerHTML = `<div class="grid pick-grid">
    ${pl.map(z => {
        const p = P.find(y => y.n === z); if (!p) return "";
        const isOpp = z === n, isSwap = z === s;
        const cls = isOpp ? "win" : (isSwap ? "lose" : "dim");
        const badge = isOpp ? `<div class="badge ok">✓</div>` : (isSwap ? `<div class="badge no">✕</div>` : "");
        return `<div class="fcwrap">${badge}${cardHTML(p, cls)}</div>`;
      }).join("")}
  </div>
  <p class="note">${s ? "الأخضر اختاره، والأحمر غيّره" : "اختار من أول كارت من غير تغيير"}</p>`;
      stopTimer();
      scheduleNextRound();
    }


