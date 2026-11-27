/* ================= SCREENS · 05a-home.js ================= */
/* ================= SCREENS ================= */
    function resetGameData() {
      if (!window.confirm("هل تريد مسح كل بياناتك في اللعبة؟ سيتم حذف السجل والتشكيلة والكوينز المحفوظة وإرجاع رصيد البداية إلى 9,000,000. صور اللاعبين ستظل محفوظة.")) return;
      cancelGameTimers();
      killNet();
      resetOpponent();
      try {
        localStorage.removeItem(GUEST_PROGRESS_KEY);
        localStorage.removeItem(PACK_CHANCES_KEY);
        localStorage.removeItem(STAR_KEEPER_CUP_WON_KEY);
        localStorage.removeItem(STAR_KEEPER_CUP_OPENING_GRANTED_KEY);
        localStorage.removeItem(STAR_KEEPER_PACK_KEY);
        localStorage.removeItem(STAR_KEEPER_PACK_OPENED_KEY);
        localStorage.removeItem(STAR_KEEPER_PACK_WINNER_KEY);
        localStorage.removeItem(STAR_KEEPER_FREE_OPENING_KEY);
        localStorage.removeItem(STAR_KEEPER_WON_PLAYERS_KEY);
        localStorage.removeItem(STAR_KEEPER_PENDING_PLAYERS_KEY);
        localStorage.removeItem(STAR_KEEPER_TOURNAMENT_KEY);
        localStorage.removeItem(CENTER_BACKS_TOURNAMENT_KEY);
        localStorage.removeItem(CENTER_BACKS_CUP_WON_KEY);
        localStorage.removeItem(CENTER_BACKS_CUP_OPENING_GRANTED_KEY);
        localStorage.removeItem(CENTER_BACKS_FREE_OPENING_KEY);
        localStorage.removeItem(PACK_ROSTER_KEY);
        localStorage.removeItem(PACK_CLAIMS_KEY);
        localStorage.removeItem(PACK_PENDING_KEY);
        localStorage.removeItem("gg_muted");

      } catch (error) {
        console.error("Could not clear saved game data.", error);
        toast("تعذر مسح البيانات من هذا الجهاز");
        return;
      }
      guestProgress = emptyGuestProgress();
      freePackChances = 2;
      Object.keys(tournamentFlags).forEach(eventId => { tournamentFlags[eventId] = { won: false, granted: false } });
      Object.keys(savedTournamentStates).forEach(eventId => { delete savedTournamentStates[eventId] });
      starKeeperPack = null;
      starKeeperPackOpened = false;
      starKeeperPackWinner = null;
      starKeeperWonPlayers = [];
      starKeeperPendingPlayers = [];
      packRoster = {};
      packClaims = {};
      packPending = [];
      try {
        localStorage.setItem(STAR_KEEPER_FREE_OPENING_KEY, "true");
        localStorage.setItem(CENTER_BACKS_FREE_OPENING_KEY, "true");
        localStorage.setItem(STAR_KEEPER_CUP_OPENING_GRANTED_KEY, "false");
        localStorage.setItem(CENTER_BACKS_CUP_OPENING_GRANTED_KEY, "false");
      } catch (_) { }
      savePackChances();
      activeTournament = tournamentTeam = tournamentResult = null;
      activeTournamentEvent = null;
      muted = true;
      selectedSquadSlot = null;
      showBench = false;
      selectedFormation = DEFAULT_FORMATION;
      opponentFormation = DEFAULT_FORMATION;
      if (!saveGuestProgress()) return;
      screenHome();
      toast("تم مسح بيانات اللعبة · رصيد البداية 9,000,000 🪙");
    }

    function screenHome() {
      gameLive = false;
      cancelGameTimers(); killNet();
      selectedSquadSlot = null;
      _navStack = [screenHome];
      _navKeys = [screenHome];
      history.replaceState({}, "");
      const homeClub = guestProgress.club;
      const homeStarters = homeClub && Array.isArray(homeClub.starters)
        ? homeClub.starters.map(name => name && findPlayer(name)).filter(Boolean)
        : [];
      const homeCoach = homeClub && COACHES.find(coach => coach.n === homeClub.coach);
      const homeBaseRating = homeStarters.length === 11
        ? Math.round(homeStarters.reduce((sum, player) => sum + player.r, 0) / homeStarters.length)
        : null;
      const homeRating = homeBaseRating === null ? "—" : homeCoach ? coachAdjustedPower(homeBaseRating, homeCoach) : homeBaseRating;
      app.innerHTML = `
  <main class="start-screen" aria-label="شاشة بداية GG">
    <header class="start-head">
      <div class="start-brand"><div class="logo">GG</div><div class="start-wordmark">GG FOOTBALL<small>كوّن فريقك وابدأ التحدي</small></div></div>
      <div class="wallet-badge brand-wallet" aria-label="رصيد الكوينز"><span>🪙</span><b>${formatCoins(guestProgress.coins)}</b></div>
    </header>
    <section class="start-hero" aria-label="ابدأ رحلتك الكروية">
      <div class="start-pitch" aria-hidden="true"><span class="start-goal top"></span><span class="start-goal bottom"></span></div>
      <h1 class="start-title">ابني فريق أحلامك</h1><p class="start-caption">اختار 11 لاعب ونافس صحابك</p>
    </section>
    <button class="start-team-summary" id="home-team-summary" aria-label="عرض ملخص تشكيلتي">
      <span class="start-summary-title"><b>${homeClub ? "تشكيلتي" : "كوّن تشكيلتك"}</b><small>${homeClub ? homeCoach ? `مدرب ${esc(homeCoach.n)}` : "كمّل اختيار المدرب" : "اختار خطتك ولاعبيك"}</small></span>
      <span class="start-summary-value"><b>${homeStarters.length}/11</b><small>لاعب</small></span>
      <span class="start-summary-value"><b dir="ltr">${homeClub ? esc(formationById(homeClub.formation).id) : "—"}</b><small>الخطة</small></span>
      <span class="start-summary-value start-summary-rating"><b>${homeRating}</b><small>التقييم</small></span>
      <span class="start-summary-arrow" aria-hidden="true">‹</span>
    </button>
    <button class="start-play" id="go"><span>ابدأ اللعب</span><span aria-hidden="true">‹</span></button>
    <nav class="start-shortcuts" aria-label="اختصارات اللعبة">
      <button class="start-shortcut" id="home-market">🛒 <span>السوق</span></button>
      <button class="start-shortcut" id="home-packs">🎁 <span>حزم· ${freePackChances}</span></button>
    </nav>
    <div class="asset-slot" id="asset-slot"></div>
    <footer class="start-bottom"><button id="record">سجل المباريات</button><button id="how">طريقة اللعب</button><button id="reset-game-data">مسح البيانات</button></footer>
  </main>`;
      $("go").onclick = () => { buzz(8); screenModes() };
      $("how").onclick = screenHow;
      $("record").onclick = screenRecord;
      $("reset-game-data").onclick = resetGameData;
      $("home-team-summary").onclick = screenMyTeam;
      $("home-market").onclick = () => openMarket("ALL", null, "home");
      $("home-packs").onclick = () => screenPacks(false);
      if (typeof window.renderAssetPanel === "function") window.renderAssetPanel();
      showWelcomeGuide();
    }

    function showWelcomeGuide() {
      const key = "gg_welcome_seen";
      let seen = false;
      try { seen = localStorage.getItem(key) === "1"; } catch (_) {}
      if (seen) return;
      setTimeout(() => {
        if (document.querySelector("[data-welcome-guide]") || document.querySelector("[data-asset-prompt]")) return;
        const overlay = document.createElement("div");
        overlay.className = "pick-overlay sale-overlay";
        overlay.setAttribute("data-welcome-guide", "");
        overlay.innerHTML = `<div class="pick-dialog welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
          <span class="welcome-kicker">أهلًا بك في GG FOOTBALL</span>
          <h2 id="welcome-title">ابدأ رحلتك في 3 خطوات</h2>
          <p>كوّن فريقك واختار طريقة اللعب، ثم شوف النتيجة على الملعب.</p>
          <div class="welcome-steps">
            <div class="welcome-step"><span>1</span><b>كوّن تشكيلة من 11 لاعب</b></div>
            <div class="welcome-step"><span>2</span><b>اختار مباراة عادية أو دريفت كروت</b></div>
            <div class="welcome-step"><span>3</span><b>خلّي التقييم والنتيجة يحسموا المواجهة</b></div>
          </div>
          <div class="pick-actions"><button class="btn w" id="welcome-start" type="button">فهمت، يلا نبدأ</button></div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector("#welcome-start").onclick = () => {
          try { localStorage.setItem(key, "1"); } catch (_) {}
          overlay.remove();
          if (document.getElementById("asset-slot") && typeof window.assetManager === "object") {
            window.assetManager.renderPanel();
          }
        };
      }, 650);
    }

    function screenRecord() {
      _origPush(screenRecord);
      const { record, lastTeam } = guestProgress;
      app.innerHTML = `
  <div class="hdr"><div class="l"><span class="pos">سجل مبارياتي</span></div>
  <button class="btn g sm" id="bk">رجوع</button></div>
  <div class="sec-title">إحصائيات المباريات</div>
  <div class="rows">
    <div class="row"><span class="n">إجمالي المباريات</span><span class="v">${record.played}</span></div>
    <div class="row"><span class="n">فوز</span><span class="v">${record.wins}</span></div>
    <div class="row"><span class="n">تعادل</span><span class="v">${record.draws}</span></div>
    <div class="row"><span class="n">خسارة</span><span class="v">${record.losses}</span></div>
    <div class="row"><span class="n">أعلى تقييم فريق</span><span class="v">${record.bestRating || "—"}</span></div>
  </div>
  ${lastTeam ? `
  ${formationHTML(lastTeam.names.map(name => findPlayer(name)).filter(Boolean), lastTeam.formation, "آخر فريق أونلاين")}
  <div class="rows">
    <div class="row"><span class="n">المدرب</span><span class="v">${esc(lastTeam.coach)}</span></div>
    <div class="row"><span class="n">التقييم</span><span class="v">${lastTeam.rating}</span></div>
  </div>` : `<div class="rows rows-text"><div class="row"><span class="n">لسه مفيش مباريات أونلاين محفوظة على الجهاز.</span></div></div>`}
  <button class="btn w mt" id="play">العب</button>`;
      $("bk").onclick = screenHome;
      $("play").onclick = screenModes;
    }

    let marketContext = { position: "ALL", roles: [], target: null, returnTo: "home", query: "", ratingMin: "", ratingMax: "", priceMin: "", priceMax: "", filtersOpen: false, searchOpen: false };
    const MARKET_ROLE_FILTERS = [
      ["LB", "LB", "ظهير أيسر"], ["RB", "RB", "ظهير أيمن"], ["GK", "GK", "حارس مرمى"],
      ["CB", "CB", "قلب دفاع"], ["CDM", "CDM", "وسط دفاعي"], ["CM", "CM", "وسط"],
      ["CAM", "CAM", "وسط هجومي"], ["RM", "RM", "وسط أيمن"], ["LM", "LM", "وسط أيسر"],
      ["RW", "RW", "جناح أيمن"], ["LW", "LW", "جناح أيسر"], ["ST", "ST", "مهاجم"]
    ];
    const marketPositionMatches = (player, position, roles, target) => {
      const targetRole = target && target.kind === "player" && POSITION_GROUP[target.position] ? target.position : null;
      const inBaseGroup = position === "ALL" || playsGroup(player, position);
      return inBaseGroup && (!targetRole || playsRole(player, targetRole)) &&
        (!roles.length || roles.some(role => playsRole(player, role)));
    };
    let showBench = false;
    let selectedSquadSlot = null;
    document.addEventListener("click", event => {
      if (!(event.target instanceof Element)) return;
      const target = event.target;
      const clickedPlayerArea = target.closest("[data-squad-slot], .squad-action-panel");
      const currentSquadScreen = !!app.querySelector(".pitch") && !!$("bench-toggle");
      const clickedSquadControl = target.closest(".pitch, .squad-action-panel, #bench-toggle, .setup-confirmation, .coach-management-row");
      let rerenderSquad = false;
      if (selectedSquadSlot && !clickedPlayerArea && (currentSquadScreen || clickedSquadControl)) {
        selectedSquadSlot = null;
        rerenderSquad = true;
      }
      if (showBench && !target.closest(".bench-grid") && !target.closest("#bench-toggle")) {
        showBench = false;
        rerenderSquad = true;
      }
      if (rerenderSquad && $("bench-toggle") && app.querySelector(".pitch")) screenMyTeam();
    });
