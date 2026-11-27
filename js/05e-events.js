/* ================= SCREENS · 05e-events.js ================= */
    function startTournamentMatch() {
      if (!activeTournament || !tournamentTeam) return screenEvents();
      const config = EVENT_TOURNAMENTS[activeTournament.event] || EVENT_TOURNAMENTS["star-keeper"];
      const team = tournamentTeam.team.slice(), formation = tournamentTeam.formation;
      cancelGameTimers(); resetOpponent();
      OPP = aiClubTeam(config.level);
      OPP.avg = OPP.baseAvg = Number.isInteger(config.fixedAvg) ? config.fixedAvg : OPP.baseAvg;
      opponentFormation = OPP.formation;
      OPP.seed = Math.floor(Math.random() * 0x100000000);
      S = { i: 11, team, bench: tournamentTeam.bench || Array(12).fill(null), used: new Set(team.map(player => player.n)), pool: [], shown: new Set(), sw: 0,
        phase: "match", sel: null, formation, slots: formationSlots(formation), roles: formationRoleSlots(formation),
        coach: tournamentTeam.coach, coachPool: [], coachShown: new Set(), coachSwap: 0, mode: "ai", entry: "event",
        matchSeed: Math.floor(Math.random() * 0x100000000) };
      eventTournamentRoundLabel = TOURNAMENT_ROUND_LABELS[activeTournament.round - 1];
      saveTournamentProgress();
      endGame();
    }

    function resolveTournamentMatch(goalsFor, goalsAgainst) {
      if (!activeTournament || tournamentResult) return;
      tournamentTeam = { team: S.team.slice(), bench: S.bench || Array(12).fill(null), formation: S.formation, coach: S.coach };
      tournamentResult = { won: goalsFor > goalsAgainst, final: activeTournament.round >= activeTournament.total };
      saveTournamentProgress();
      const button = $("again"); if (!button) return;
      button.disabled = false;
      button.textContent = tournamentResult.won ? tournamentResult.final ? "الجائزة والحزمة" : "الجولة التالية" : "محاولة مرة أخرى";
    }

    function continueTournament() {
      if (!tournamentResult) return toast("استنى نتيجة المباراة الأول");
      if (!tournamentResult.won) {
        activeTournament.round = 1; tournamentResult = null;
        saveTournamentProgress();
        toast("خسرت الجولة · جاهز تبدأ محاولة جديدة");
        return startTournamentMatch();
      }
      if (tournamentResult.final) {
        const eventId = activeTournament ? activeTournament.event : activeTournamentEvent;
        const config = EVENT_TOURNAMENTS[eventId] || EVENT_TOURNAMENTS["star-keeper"];
        activeTournament = tournamentTeam = tournamentResult = null;
        saveTournamentProgress();
        const flags = tournamentFlags[eventId] = tournamentFlags[eventId] || { won: false, granted: false };
        flags.won = true;
        writeFlag(config.cupWonKey);
        if (!flags.granted) {
          flags.granted = true; freePackChances++;
          writeFlag(config.rewardKey);
          savePackChances();
          return screenPacks();
        }
        screenEvents(); toast("كسبت البطولة · المكافأة اتاخدت قبل كده"); return;
      }
      activeTournament.round++; tournamentResult = null;
      saveTournamentProgress();
      toast(`تأهلت إلى ${TOURNAMENT_ROUND_LABELS[activeTournament.round - 1]}`);
      startTournamentMatch();
    }

    function screenDraftModes() {
      _origPush(screenDraftModes);
      app.innerHTML = `
  <main class="play-menu">
    <header class="hdr"><div class="l"><span class="pos">دريفت الكروت</span><span class="cnt">اختار نوع الدريفت وطريقة المنافسة</span></div><button class="btn g sm" id="bk">رجوع</button></header>
    <section class="draft-menu" aria-label="نوع الدريفت">
      <header class="draft-menu-head"><span class="play-mode-icon">🃏</span><span><b>نوع الدريفت</b><small>اختار شكل الكروت وطريقة الاختيار</small></span></header>
      <div class="draft-submodes">
        <button class="draft-submode ${draftMode === "hidden" ? "active" : ""}" data-draft-mode="hidden" aria-pressed="${draftMode === "hidden"}"><span>🎴</span><b>كروت مخفية</b></button>
        <button class="draft-submode ${draftMode === "choice" ? "active" : ""}" data-draft-mode="choice" aria-pressed="${draftMode === "choice"}"><span>⚽</span><b>اختار لاعب</b></button>
      </div>
    </section>
    <section class="draft-menu" aria-label="إعدادات الدريفت">
      <header class="draft-menu-head"><span class="play-mode-icon">⏱️</span><span><b>${draftMode === "choice" ? "وقت تجهيز التشكيلة" : "وقت كل اختيار"}</b><small>${draftMode === "choice" ? "الوقت يبدأ عند دخول الدريفت" : "تقدر تغيّره قبل كل جولة"}</small></span></header>
      ${draftMode === "choice"
        ? `<div class="timer-options">${[3,5,10].map(minutes => `<button class="btn ${minutes === choiceMatchMinutes ? "" : "g"} sm" data-choice-time="${minutes}" aria-pressed="${minutes === choiceMatchMinutes}">${minutes} دقائق</button>`).join("")}</div>`
        : `<div class="timer-options">${[15,30,45].map(s => `<button class="btn ${s === TM ? "" : "g"} sm" data-t="${s}" aria-pressed="${s === TM}">${s} ثانية</button>`).join("")}</div>`}
    </section>
    <button class="play-club-card" id="mAi"><span class="play-mode-icon">🤖</span><span class="play-mode-copy"><b>ضد الكمبيوتر</b><small>ابدأ دريفت فردي</small></span><span class="play-mode-arrow">‹</span></button>
    <button class="play-club-card secondary" id="mRoom"><span class="play-mode-icon">👥</span><span class="play-mode-copy"><b>العب مع صاحبك</b><small>اعمل غرفة وابعتله الكود</small></span><span class="play-mode-arrow">‹</span></button>
    <button class="play-club-card secondary" id="mOn"><span class="play-mode-icon">🌐</span><span class="play-mode-copy"><b>أونلاين</b><small>قابل لاعب عشوائي</small></span><span class="play-mode-arrow">‹</span></button>
  </main>`;
      $("bk").onclick = screenModes;
      app.querySelectorAll("[data-draft-mode]").forEach(b => b.onclick = () => {
        draftMode = b.dataset.draftMode;
        screenDraftModes();
      });
      app.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { TM = +b.dataset.t; screenDraftModes() });
      app.querySelectorAll("[data-choice-time]").forEach(b => b.onclick = () => {
        choiceMatchMinutes = +b.dataset.choiceTime;
        screenDraftModes();
      });
      $("mAi").onclick = () => draftMode === "choice" ? startAIGame() : screenFormations(startAIGame);
      $("mRoom").onclick = () => draftMode === "choice" ? screenRoom("draft") : screenFormations(screenRoom);
      $("mOn").onclick = () => screenFormations(() => hostRoom("lobby", true));
    }

    function screenClubModes() {
      gameLive = false;
      _origPush(screenClubModes);
      app.innerHTML = `
  <div class="hdr"><div class="l"><span class="pos">مباريات تشكيلتي</span><span class="cnt" dir="ltr">${guestProgress.club ? formationById(guestProgress.club.formation).id : "—"}</span></div>
  <button class="btn g sm" id="bk">رجوع</button></div>
  <p class="note">لازم تكمل 11 لاعبًا أساسيًا، و4 بدلاء للمراكز، وتختار مدربًا قبل اللعب. الاحتياطي المرن اختياري.</p>
  <button class="mode primary" id="clubCpu">
    <div class="ic">🤖</div>
    <div class="tx"><b>ضد الكمبيوتر</b><small>اختار مستوى المنافس</small></div>
    <div class="arw">‹</div>
  </button>
  <button class="mode" id="clubFriend">
    <div class="ic">👥</div>
    <div class="tx"><b>العب مع صاحبك</b><small>اعمل غرفة أو ادخل بكود</small></div>
    <div class="arw">‹</div>
  </button>
  <button class="mode" id="clubOnline">
    <div class="ic">🌐</div>
    <div class="tx"><b>العب أونلاين</b><small>قابل لاعبًا عشوائيًا بتشكيلته</small></div>
    <div class="arw">‹</div>
  </button>`;
      $("bk").onclick = screenModes;
      $("clubCpu").onclick = screenClubDifficulties;
      $("clubFriend").onclick = () => screenRoom("club");
      $("clubOnline").onclick = () => {
        if (!getClubMatchSetup()) return;
        hostRoom("club-lobby", true, "club");
      };
    }

    function screenClubDifficulties() {
      _origPush(screenClubDifficulties);
      app.innerHTML = `
  <div class="hdr"><div class="l"><span class="pos">مستوى الكمبيوتر</span><span class="cnt">العب بتشكيلتك</span></div>
  <button class="btn g sm" id="bk">رجوع</button></div>
  <p class="note">الكمبيوتر هيكوّن 11 لاعبًا وتشكيلة ومدربًا حسب المستوى.</p>
  <div class="formation-grid">
    ${COMPUTER_DIFFICULTIES.map(level => `<button class="formation-option" data-club-level="${level.id}">
      <b>${level.name}</b><small>تقييم لاعبين ${level.min}–${level.max}</small>
    </button>`).join("")}
  </div>`;
      $("bk").onclick = screenClubModes;
      app.querySelectorAll("[data-club-level]").forEach(button => {
        button.onclick = () => startClubMatch("ai", button.dataset.clubLevel);
      });
    }

    function getClubMatchSetup(allowUnconfirmed = false, allowIncompleteBench = false) {
      const club = guestProgress.club;
      if (!club) {
        toast("اختار تشكيلتك الأول");
        screenMyTeam();
        return null;
      }
      if (!club.confirmed && !allowUnconfirmed) {
        toast("أكد تشكيلتك واشتري اختياراتك قبل اللعب");
        screenMyTeam();
        return null;
      }

      const missingStarters = !Array.isArray(club.starters) || club.starters.length !== 11 ||
        club.starters.some(name => !name);
      const missingFixedBench = !allowIncompleteBench && (!Array.isArray(club.bench) ||
        BENCH_SLOT_POSITIONS.some((position, index) => position !== null && !club.bench[index]));
      if (missingStarters || missingFixedBench) {
        selectedSquadSlot = null;
        showBench = missingFixedBench;
        const missing = [];
        if (missingStarters) missing.push("الـ11 لاعب الأساسيين");
        if (missingFixedBench) missing.push("البدلاء الأربعة الأساسيين");
        toast(`كمّل ${missing.join(" و")} قبل اللعب`);
        screenMyTeam();
        return null;
      }

      const team = club.starters.map(name => findPlayer(name));
      const bench = club.bench.map(name => name ? findPlayer(name) : null);
      if (team.some(player => !player) || new Set(team.map(player => player.n)).size !== 11) {
        toast("راجع لاعبي التشكيلة الأساسية قبل اللعب");
        screenMyTeam();
        return null;
      }
      const coach = COACHES.find(item => item.n === club.coach);
      if (!coach) {
        toast("اختار مدربك من السوق قبل اللعب");
        screenMyTeam();
        return null;
      }
      return { club, team, bench, coach };
    }

    function startClubMatch(mode, difficulty) {
      const setup = getClubMatchSetup();
      if (!setup) {
        if (mode === "online") killNet();
        return;
      }
      const online = mode === "online";
      const level = online ? null : COMPUTER_DIFFICULTIES.find(item => item.id === difficulty);
      if (!online && !level) {
        toast("اختار مستوى الكمبيوتر");
        return screenClubDifficulties();
      }
      if (online && (!conn || !conn.open)) {
        return netFail("الاتصال بالخصم غير جاهز", screenClubModes);
      }

      cancelGameTimers();
      if (!online) killNet();
      resetOpponent();
      selectedFormation = setup.club.formation;
      S = {
        i: 11,
        team: setup.team,
        bench: setup.bench,
        used: new Set(setup.team.map(player => player.n)),
        pool: [],
        shown: new Set(),
        sw: 0,
        phase: "match",
        sel: null,
        formation: setup.club.formation,
        slots: formationSlots(setup.club.formation),
        roles: formationRoleSlots(setup.club.formation),
        coach: setup.coach,
        coachPool: [],
        coachShown: new Set(),
        coachSwap: 0,
        mode: online ? "online" : "ai",
        entry: "club",
        difficulty: level ? level.id : null,
        matchSeed: Math.floor(Math.random() * 0x100000000)
      };
      if (!online) OPP = aiClubTeam(level);
      endGame();
    }

    function screenFormations(onContinue) {
      _origPush(() => screenFormations(onContinue), "formations");
      app.innerHTML = `
  <div class="hdr"><div class="l"><span class="pos">اختار خطة فريقك</span><span class="cnt">الخطة هتحدد مراكز الكروت</span></div>
  <button class="btn g sm" id="bk">رجوع</button></div>
  <div class="formation-grid">
    ${FORMATIONS.map(f => `<button class="formation-option ${f.id === selectedFormation ? "active" : ""}" data-formation="${f.id}" aria-pressed="${f.id === selectedFormation}">
      <b>${f.id}</b><small>${f.name}</small>
    </button>`).join("")}
  </div>
  <button class="btn w" id="continue">اختار الخطة دي وكمل</button>`;
      $("bk").onclick = screenModes;
      app.querySelectorAll("[data-formation]").forEach(button => button.onclick = () => {
        selectedFormation = button.dataset.formation;
        screenFormations(onContinue);
      });
      $("continue").onclick = onContinue;
    }

    function startAIGame() {
      resetOpponent();
      const opponentFormations = FORMATIONS.filter(formation => formation.id !== selectedFormation);
      opponentFormation = Math.random() < 0.05
        ? selectedFormation
        : opponentFormations[Math.floor(Math.random() * opponentFormations.length)].id;
      OPP = aiTeam(opponentFormation);
      OPP.seed = Math.floor(Math.random() * 0x100000000);
      OPPK = OPP.names.slice(); OPPS = OPP.sws.slice(); OPPP = OPP.pools.slice();
      startGame();
    }

    function screenRoom(gameType = "draft") {
      _origPush(() => screenRoom(gameType), "room");
      const isClubMatch = gameType === "club";
      const returnScreen = isClubMatch ? screenClubModes : screenModes;
      app.innerHTML = `
  <div class="hdr"><div class="l"><span class="pos">${isClubMatch ? "مباراة تشكيلتي مع صاحبك" : "غرفة مع صاحبك"}</span><span class="cnt">كود من ${ROOM_CODE_LENGTH} حروف</span></div>
  <button class="btn g sm" id="bk">رجوع</button></div>
  <button class="mode primary" id="mk">
    <div class="ic">➕</div>
    <div class="tx"><b>اعمل غرفة جديدة</b><small>هيطلعلك كود تبعته لصاحبك</small></div>
    <div class="arw">‹</div>
  </button>
  <div class="sec-title">أو ادخل بكود</div>
  <input class="input" id="cd" placeholder="كود الغرفة" maxlength="${ROOM_CODE_LENGTH}" inputmode="latin" autocomplete="off" autocapitalize="characters" spellcheck="false">
  <button class="btn w mt-s" id="jn">ادخل الغرفة</button>`;
      $("bk").onclick = returnScreen;
      $("mk").onclick = () => {
        if (isClubMatch && !getClubMatchSetup()) return;
        hostRoom(newRoomCode(), false, gameType);
      };
      $("jn").onclick = () => {
        const c = ($("cd").value || "").trim().toLowerCase();
        if (c.length !== ROOM_CODE_LENGTH) return toast(`الكود ${ROOM_CODE_LENGTH} حروف`);
        if (isClubMatch && !getClubMatchSetup()) return;
        joinRoom(c, gameType);
      };
      $("cd").addEventListener("keydown", e => { if (e.key === "Enter") $("jn").click() });
    }

    function screenWait(title, sub, code, cancelScreen = screenModes) {
      app.innerHTML = `
  <div class="center" style="padding-top:40px">
    <div class="spin"></div>
    <h2 style="font-size:20px;font-weight:900">${esc(title)}</h2>
    <p class="mu" style="font-size:13.5px;margin-top:8px">${esc(sub)}</p>
    ${code ? `<div style="margin:22px auto 0;max-width:260px;background:var(--card);border:1px solid rgba(46,224,138,.3);border-radius:16px;padding:18px">
      <div style="font-size:11.5px;color:var(--mu);font-weight:700;margin-bottom:6px">كود الغرفة</div>
      <div style="font-size:38px;font-weight:900;letter-spacing:.18em;color:var(--ac);direction:ltr">${esc(code.toUpperCase())}</div>
      <button class="btn g sm w" id="cp" style="margin-top:12px">نسخ الكود</button>
    </div>`: ""}
    <button class="btn g w" id="cx" style="margin-top:24px">إلغاء</button>
  </div>`;
      $("cx").onclick = () => { killNet(); cancelScreen() };
      const cp = $("cp");
      if (cp) cp.onclick = async () => {
        try { await navigator.clipboard.writeText(code.toUpperCase()); toast("تم نسخ الكود") }
        catch (e) { toast("الكود: " + code.toUpperCase()) }
      };
    }
