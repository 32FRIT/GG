/* ================= GAME FLOW ================= */
    function startGame() {
      cancelGameTimers();
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
          if (!player) return `<div class="pitch-player"><small>${POS_SHORT[roles[index]] || ""}</small><b>—</b></div>`;
          const rating = Number.isFinite(ratings[player.n]) ? ratings[player.n] : 6;
          const tone = rating < 6 ? "low" : rating < 7 ? "average" : "";
          const isMvp = player.n === mvpName;
          return `<div class="pitch-player has-player-card"><div class="match-player-art"><span class="match-rating-badge ${tone} ${isMvp ? "mvp" : ""}" aria-label="تقييم المباراة ${rating.toFixed(1)}">${rating.toFixed(1)}${isMvp ? `<span class="star">★</span>` : ""}</span>${cardHTML(player, "formation-player-card")}</div></div>`;
        }).join("");
        return `<div class="pitch-row">${players}</div>`;
      }).join("");
    }

    function matchFormationHTML(myTeam, myFormation, myRatings, myMvp, opponentTeam, opponentFormation, opponentRatings, opponentMvp) {
      const mine = formationById(myFormation), theirs = formationById(opponentFormation);
      const ownLines = mine.lines, opponentLines = theirs.lines;
      const pitchHeight = Math.max(ownLines.length, opponentLines.length) * 66 * 2;
      return `<div class="sec-title">تقييمات اللاعبين في المباراة</div>
        <div class="match-formation-label">تشكيلتك · <b dir="ltr">${mine.id}</b></div>
        <div class="match-pitch" style="--match-pitch-height:${pitchHeight}px"><div class="match-pitch-half" style="--match-row-count:${ownLines.length}">${matchFormationRows(myTeam, mine.id, myRatings, myMvp, true)}</div>
        <div class="match-pitch-half" style="--match-row-count:${opponentLines.length}">${matchFormationRows(opponentTeam, theirs.id, opponentRatings, opponentMvp, false)}</div></div>
        <div class="match-formation-label">تشكيلة الخصم · <b dir="ltr">${theirs.id}</b></div>`;
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


