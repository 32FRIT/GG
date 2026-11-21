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
        localStorage.removeItem("gg_muted");

      } catch (error) {
        console.error("Could not clear saved game data.", error);
        toast("تعذر مسح البيانات من هذا الجهاز");
        return;
      }
      guestProgress = emptyGuestProgress();
      freePackChances = 1;
      starKeeperCupWon = false;
      starKeeperCupOpeningGranted = false;
      starKeeperPack = null;
      starKeeperPackOpened = false;
      starKeeperPackWinner = null;
      starKeeperWonPlayers = [];
      starKeeperPendingPlayers = [];
      try { localStorage.setItem(STAR_KEEPER_FREE_OPENING_KEY, "true"); localStorage.setItem(STAR_KEEPER_CUP_OPENING_GRANTED_KEY, "false") } catch (_) { }
      savePackChances();
      activeTournament = tournamentTeam = tournamentResult = null;
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
      cancelGameTimers(); killNet();
      selectedSquadSlot = null;
      _navStack = [screenHome];
      history.pushState({}, "");
      const homeClub = guestProgress.club;
      const homeStarters = homeClub && Array.isArray(homeClub.starters)
        ? homeClub.starters.map(name => name && P.find(player => player.n === name)).filter(Boolean)
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
    <footer class="start-bottom"><button id="record">سجل المباريات</button><button id="how">طريقة اللعب</button><button id="reset-game-data">مسح البيانات</button></footer>
  </main>`;
      $("go").onclick = () => { buzz(8); screenModes() };
      $("how").onclick = screenHow;
      $("record").onclick = screenRecord;
      $("reset-game-data").onclick = resetGameData;
      $("home-team-summary").onclick = screenMyTeam;
      $("home-market").onclick = () => openMarket("ALL", null, "home");
      $("home-packs").onclick = () => screenPacks(false);
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
  ${formationHTML(lastTeam.names.map(name => P.find(player => player.n === name)).filter(Boolean), lastTeam.formation, "آخر فريق أونلاين")}
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
      const clickedSquadControl = target.closest(".pitch, .squad-topbar, .squad-action-panel, #bench-toggle, .setup-confirmation, .coach-management-row");
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

    function openMarket(position, target, returnTo) {
      selectedSquadSlot = null;
      marketContext = { position: position === "ANY" ? "ALL" : position, roles: [], target, returnTo, query: "", ratingMin: "", ratingMax: "", priceMin: "", priceMax: "", filtersOpen: false, searchOpen: false };
      screenMarket();
    }

    function screenClubFormations() {
      app.innerHTML = `
  <div class="hdr"><div class="l"><span class="pos">اختار تشكيلتك</span><span class="cnt">الخطة الأولى مجانية</span></div>
  <button class="btn g sm" id="bk">رجوع</button></div>
  <div class="wallet-badge">🪙 <b>${formatCoins(guestProgress.coins)}</b></div>
  <p class="note">اختار تشكيلتك الأولى مجانًا. تقدر تشتري تشكيلات إضافية من السوق مقابل ${formatCoins(FORMATION_PRICE)} 🪙 لكل تشكيلة.</p>
  <div class="formation-grid mt">
    ${FORMATIONS.map(formation => `<button class="formation-option" data-club-formation="${formation.id}">
      <b>${formation.id}</b><small>${formation.name}</small>
    </button>`).join("")}
  </div>`;
      $("bk").onclick = screenHome;
      app.querySelectorAll("[data-club-formation]").forEach(button => {
        button.onclick = () => {
          if (guestProgress.club) return screenMyTeam();
          const previous = snapshotClubProgress();
          selectedSquadSlot = null;
          guestProgress.club = {
            formation: button.dataset.clubFormation,
            confirmed: false,
            ownedFormations: [button.dataset.clubFormation],
            starters: Array(11).fill(null),
            bench: Array(12).fill(null),
            coaches: [],
            coach: null,
            assetCosts: {
              players: {},
              coaches: {},
              formations: { [button.dataset.clubFormation]: 0 }
            }
          };
          const pendingBeforeSetup = starKeeperPendingPlayers.slice();
          let addedStarKeepers = 0;
          starKeeperPendingPlayers.slice().forEach(name => {
            const player = P.find(item => item.n === name);
            const slot = player && findPlayerSlot(player, null);
            if (!slot) return;
            guestProgress.club[slot.key][slot.index] = name;
            guestProgress.club.assetCosts.players[name] = 0;
            starKeeperPendingPlayers = starKeeperPendingPlayers.filter(pendingName => pendingName !== name);
            addedStarKeepers++;
          });
          if (addedStarKeepers) saveStarKeeperPlayerClaims();
          if (!commitClubProgress(previous)) {
            starKeeperPendingPlayers = pendingBeforeSetup;
            saveStarKeeperPlayerClaims();
            return screenClubFormations();
          }
          screenMyTeam();
          if (addedStarKeepers) toast(`تمت إضافة ${addedStarKeepers} حارس فزت به للتشكيلة مجانًا`);
        };
      });
    }

    function arrangeClubForFormation(club, formationId) {
      const inventory = [...club.starters, ...club.bench]
        .filter(Boolean)
        .map(name => P.find(player => player.n === name))
        .filter(Boolean);
      const remaining = new Set(inventory.map(player => player.n));
      const takePlayer = position => {
        const player = inventory.find(item => remaining.has(item.n) && item.p === position)
          || inventory.find(item => remaining.has(item.n) && playsGroup(item, position));
        if (!player) return null;
        remaining.delete(player.n);
        return player.n;
      };
      const starterRoles = formationRoleSlots(formationId);
      const starterGroups = formationSlots(formationId);
      const starters = starterGroups.map(() => null);
      /* 1) main role  2) extra role  3) same group */
      [(item, role) => item.role === role, (item, role) => playsRole(item, role)].forEach(match => {
        starterRoles.forEach((role, i) => {
          if (starters[i] !== null) return;
          const found = inventory.find(item => remaining.has(item.n) && match(item, role));
          if (found) { remaining.delete(found.n); starters[i] = found.n; }
        });
      });
      starterGroups.forEach((group, i) => { if (starters[i] === null) starters[i] = takePlayer(group); });
      const bench = Array(BENCH_SLOT_POSITIONS.length).fill(null);

      BENCH_SLOT_POSITIONS.forEach((position, index) => {
        if (position) bench[index] = takePlayer(position);
      });
      BENCH_SLOT_POSITIONS.forEach((position, index) => {
        if (position === null) bench[index] = takeAnyPlayer();
      });

      function takeAnyPlayer() {
        const player = inventory.find(item => remaining.has(item.n));
        if (!player) return null;
        remaining.delete(player.n);
        return player.n;
      }

      return { starters, bench };
    }

    function switchClubFormation(formationId) {
      const club = guestProgress.club;
      if (!club || !club.ownedFormations.includes(formationId)) {
        return toast("التشكيلة دي مش مملوكة");
      }
      if (club.formation === formationId) return screenMyTeam();

      const previous = snapshotClubProgress();
      const lineup = arrangeClubForFormation(club, formationId);
      club.formation = formationId;
      club.starters = lineup.starters;
      club.bench = lineup.bench;
      selectedSquadSlot = null;
      showBench = false;
      if (!commitClubProgress(previous)) return screenMyTeam();
      toast(`تم تغيير التشكيلة إلى ${formationId}`);
      screenMyTeam();
    }

    function selectDraftFreeFormation(formationId) {
      const club = guestProgress.club;
      if (!club || club.confirmed) return toast("اختيار الخطة المجاني متاح قبل التأكيد فقط");
      if (club.ownedFormations.includes(formationId)) return switchClubFormation(formationId);
      const freeIndex = club.ownedFormations.findIndex(id => club.assetCosts.formations[id] === 0);
      if (freeIndex === -1) return toast("الخطة المجانية غير موجودة");

      const previous = snapshotClubProgress();
      const oldFreeFormation = club.ownedFormations[freeIndex];
      club.ownedFormations[freeIndex] = formationId;
      delete club.assetCosts.formations[oldFreeFormation];
      club.assetCosts.formations[formationId] = 0;
      const lineup = arrangeClubForFormation(club, formationId);
      club.formation = formationId;
      club.starters = lineup.starters;
      club.bench = lineup.bench;
      selectedSquadSlot = null;
      showBench = false;
      if (!commitClubProgress(previous)) return screenOwnedClubFormations();
      toast(`تم تغيير الخطة مجانًا قبل التأكيد إلى ${formationId}`);
      screenMyTeam();
    }

    function screenOwnedClubFormations() {
      const club = guestProgress.club;
      if (!club) return screenClubFormations();
      const draft = !club.confirmed;
      const freeFormationId = draft
        ? club.ownedFormations.find(id => club.assetCosts.formations[id] === 0)
        : null;
      const visibleFormations = draft ? FORMATIONS.map(formation => formation.id) : club.ownedFormations;
      app.innerHTML = `
  <div class="hdr"><div class="l"><span class="pos">تغيير التشكيلة</span><span class="cnt">${club.ownedFormations.length} تشكيلات</span></div>
  <button class="btn g sm" id="bk">رجوع</button></div>
  <p class="note">${draft
          ? "اختار أي خطة مجانًا للتجهيز الأول. الخطط الإضافية تقدر تضيفها من السوق بسعرها الظاهر."
          : "اضغط على أي خطة اشتريتها لتفعيلها. التبديل بين خططك المملوكة مجاني."}</p>
  <div class="formation-grid mt">
    ${visibleFormations.map(id => {
            const formation = formationById(id);
            const owned = club.ownedFormations.includes(id);
            const active = owned && id === club.formation;
            if (!owned && draft && freeFormationId) {
              return `<button class="formation-option" data-select-free-formation="${id}">
            <b dir="ltr">${formation.id}</b><small>${formation.name} · اختيار مجاني</small>
          </button>`;
            }
            if (!owned) return "";
            return `<button class="formation-option ${active ? "active" : ""}" data-switch-club-formation="${id}">
            <b dir="ltr">${formation.id}</b><small>${formation.name} · ${active ? "الحالية" : "تبديل"}</small>
          </button>`;
          }).join("")}
  </div>
  <button class="btn w" id="buy-formation">شراء تشكيلة من السوق · ${formatCoins(FORMATION_PRICE)} 🪙</button>`;
      $("bk").onclick = screenMyTeam;
      $("buy-formation").onclick = () => openMarket("FORMATION", null, "team");
      app.querySelectorAll("[data-switch-club-formation]").forEach(button => {
        button.onclick = () => switchClubFormation(button.dataset.switchClubFormation);
      });
      app.querySelectorAll("[data-select-free-formation]").forEach(button => {
        button.onclick = () => selectDraftFreeFormation(button.dataset.selectFreeFormation);
      });
    }

    function squadPitchHTML(club) {
      const formation = formationById(club.formation);
      const slots = formationSlots(formation.id);
      const roles = formationRoleSlots(formation.id);
      const clubPlayers = club.starters.map(name => name && P.find(player => player.n === name)).filter(Boolean);
      const starters = alignTeamToFormation(clubPlayers, formation.id);
      const coach = COACHES.find(item => item.n === club.coach);
      const baseRating = clubPlayers.length
        ? Math.round(clubPlayers.reduce((sum, player) => sum + player.r, 0) / clubPlayers.length)
        : null;
      const overall = baseRating === null
        ? null
        : coach ? coachAdjustedPower(baseRating, coach) : baseRating;
      const ratingDetails = `${clubPlayers.length}/11 لاعبين · ${coach ? `مدرب ${coach.n}` : "بدون مدرب"}`;
      const offsets = {
        G: 0,
        D: 1,
        M: 1 + slots.filter(position => position === "D").length,
        F: 1 + slots.filter(position => position === "D").length + slots.filter(position => position === "M").length
      };
      const used = { G: 0, D: 0, M: 0, F: 0 };
      const rows = formation.lines.map(([position, count]) => {
        const players = Array.from({ length: count }, () => {
          const index = offsets[position] + used[position]++;
          const name = club.starters[index];
          const player = name && P.find(item => item.n === name);
          const selected = selectedSquadSlot && selectedSquadSlot.area === "starter" && selectedSquadSlot.index === index;
          return `<button class="pitch-player squad-slot ${player ? "has-player-card" : "empty"} ${selected ? "selected" : ""}"
            data-squad-slot="starter" data-index="${index}" data-position="${position}" aria-pressed="${!!selected}"
            aria-label="${player ? `اختيار ${esc(player.n)}` : `إضافة ${POS_NAME[roles[index]]}`}">
            ${player ? cardHTML(player, "squad-player-card") : `<small>${POS_SHORT[roles[index]]}</small><b>＋ إضافة</b>`}
          </button>`;
        }).join("");
        return `<div class="pitch-row">${players}</div>`;
      }).join("");
      return `<div class="squad-formation-title">
          <div class="sec-title">التشكيلة الأساسية · <b dir="ltr">${formation.id}</b></div>
        ${club.ownedFormations.length > 1 || !club.confirmed ? `<button class="btn g sm" id="change-club-formation">${club.confirmed ? "تغيير الخطة" : "اختيار الخطة"}</button>` : ""}
        </div>
        <div class="pitch">${rows}
          <div class="squad-overall" title="${esc(ratingDetails)}" aria-label="التقييم الكلي OVR: ${overall === null ? "غير متاح" : overall}">
            <b>${overall === null ? "—" : overall}</b><span>OVR</span>
          </div>
        </div>`;
    }

    function squadSlotPlayer(slot) {
      return guestProgress.club[slot.area === "starter" ? "starters" : "bench"][slot.index];
    }

    function squadSlotPosition(slot) {
      return slot.area === "starter"
        ? formationSlots(guestProgress.club.formation)[slot.index]
        : BENCH_SLOT_POSITIONS[slot.index];
    }

    function squadSlotRole(slot) {
      return slot.area === "starter"
        ? formationRoleSlots(guestProgress.club.formation)[slot.index]
        : null;
    }

    function canPlayerUseSlot(playerName, slot) {
      const requiredPosition = squadSlotPosition(slot);
      const requiredRole = squadSlotRole(slot);
      const player = P.find(item => item.n === playerName);
      return !!player && (requiredRole ? playsRole(player, requiredRole) : !requiredPosition || playsGroup(player, requiredPosition));
    }

    function firstEmptySquadSlot(area, playerName) {
      const slots = area === "starter"
        ? formationSlots(guestProgress.club.formation)
        : BENCH_SLOT_POSITIONS;
      const occupied = guestProgress.club[area === "starter" ? "starters" : "bench"];
      const player = P.find(item => item.n === playerName);
      if (!player) return null;
      let index = area === "starter"
        ? bestStarterIndex(player, guestProgress.club.formation, occupied)
        : emptyGroupIndex(player, slots, occupied);
      if (index === -1 && area === "bench") {
        index = slots.findIndex((position, i) => position === null && occupied[i] === null);
      }
      return index === -1 ? null : { area, index };
    }

    function moveSelectedSquadPlayer(target) {
      if (!selectedSquadSlot || !target) return;
      const source = selectedSquadSlot;
      if (source.area === target.area && source.index === target.index) {
        selectedSquadSlot = null;
        return screenMyTeam();
      }
      const sourceName = squadSlotPlayer(source);
      const targetName = squadSlotPlayer(target);
      if (!sourceName || !canPlayerUseSlot(sourceName, target) ||
        (targetName && !canPlayerUseSlot(targetName, source))) {
        toast("المركز غير مناسب للاعب");
        return;
      }

      const sourceKey = source.area === "starter" ? "starters" : "bench";
      const targetKey = target.area === "starter" ? "starters" : "bench";
      guestProgress.club[targetKey][target.index] = sourceName;
      guestProgress.club[sourceKey][source.index] = targetName || null;
      selectedSquadSlot = null;
      showBench = source.area === "bench" || target.area === "bench";
      saveGuestProgress();
      toast(targetName ? "تم تبديل اللاعبين" : "تم نقل اللاعب");
      screenMyTeam();
    }

    function reservePlayersForSlot(target) {
      if (!guestProgress.club || target.area !== "starter") return [];
      return guestProgress.club.bench
        .map((name, index) => ({ player: name && P.find(item => item.n === name), index }))
        .filter(item => item.player && canPlayerUseSlot(item.player.n, target));
    }

    function screenReserveChoices(target) {
      const candidates = reservePlayersForSlot(target);
      if (!candidates.length) {
        return openMarket(squadSlotPosition(target), {
          kind: "player",
          area: target.area,
          index: target.index,
          position: squadSlotRole(target) || squadSlotPosition(target)
        }, "team");
      }

      const position = squadSlotPosition(target);
      app.innerHTML = `
  <div class="hdr"><div class="l"><span class="pos">اختار من الاحتياطي</span><span class="cnt">${POS_NAME[position]}</span></div>
  <button class="btn g sm" id="bk">رجوع</button></div>
  <p class="note">عندك ${candidates.length} لاعب مناسب للمركز ده في الاحتياطي.</p>
  <div class="market-list player-grid">
    ${candidates.map(({ player, index }) => `<div class="market-item player-market-card">
      ${cardHTML(player, "reserve-choice-card")}
      <button class="btn sm" data-use-reserve="${index}">إضافة للتشكيلة</button>
    </div>`).join("")}
  </div>
  <button class="btn g w mt" id="reserve-market">شراء لاعب من السوق</button>`;
      $("bk").onclick = screenMyTeam;
      $("reserve-market").onclick = () => openMarket(position, {
        kind: "player",
        area: target.area,
        index: target.index,
        position: squadSlotRole(target) || position
      }, "team");
      app.querySelectorAll("[data-use-reserve]").forEach(button => {
        button.onclick = () => {
          const currentTarget = { area: target.area, index: target.index };
          if (squadSlotPlayer(currentTarget) !== null) {
            toast("المكان لم يعد فارغًا");
            return screenMyTeam();
          }
          selectedSquadSlot = { area: "bench", index: Number(button.dataset.useReserve) };
          moveSelectedSquadPlayer(currentTarget);
        };
      });
    }

    function handleSquadSlotTap(area, index, position) {
      const target = { area, index };
      if (!selectedSquadSlot) {
        if (squadSlotPlayer(target)) {
          selectedSquadSlot = target;
          if (area === "bench") showBench = true;
          return screenMyTeam();
        }
        if (area === "starter" && reservePlayersForSlot(target).length) {
          return screenReserveChoices(target);
        }
        const requiredRole = area === "starter" ? squadSlotRole(target) : null;
        openMarket(position || "ANY", {
          kind: "player",
          area,
          index,
          position: requiredRole || position || null
        }, "team");
        return;
      }
      moveSelectedSquadPlayer(target);
    }

    function moveSelectedPlayerBetweenSquadAreas() {
      if (!selectedSquadSlot) return;
      const destination = selectedSquadSlot.area === "starter" ? "bench" : "starter";
      const playerName = squadSlotPlayer(selectedSquadSlot);
      const target = firstEmptySquadSlot(destination, playerName);
      if (!target) return toast("مفيش مكان مناسب وفاضي");
      moveSelectedSquadPlayer(target);
    }

    function openSquadPlayerSwap() {
      if (!selectedSquadSlot || !guestProgress.club) return;
      const slot = { ...selectedSquadSlot };
      const playerName = squadSlotPlayer(slot);
      const player = P.find(item => item.n === playerName);
      if (!player) return toast("اللاعب المحدد غير موجود");
      const slotGroup = squadSlotPosition(slot) || player.p;
      openMarket(slotGroup, {
        kind: "player",
        area: slot.area,
        index: slot.index,
        position: squadSlotRole(slot) || slotGroup,
        replaceName: player.n
      }, "team");
    }

    function removeDraftSquadPlayer() {
      const club = guestProgress.club;
      if (!club || club.confirmed || !selectedSquadSlot) return toast("لا يمكن إزالة اللاعب بعد التأكيد");
      const slot = { ...selectedSquadSlot };
      const key = slot.area === "starter" ? "starters" : "bench";
      const playerName = club[key][slot.index];
      if (!playerName) return toast("اللاعب لم يعد في هذا المكان");
      club[key][slot.index] = null;
      delete club.assetCosts.players[playerName];
      selectedSquadSlot = null;
      showBench = slot.area === "bench";
      saveGuestProgress();
      toast("تمت إزالة اللاعب بدون خصم");
      screenMyTeam();
    }

    function squadSelectionHTML() {
      if (!selectedSquadSlot) return "";
      const playerName = squadSlotPlayer(selectedSquadSlot);
      if (!playerName) {
        selectedSquadSlot = null;
        return "";
      }
      const player = P.find(item => item.n === playerName);
      if (!player) return "";
      const slot = selectedSquadSlot;
      const destination = slot.area === "starter" ? "الاحتياطي" : "التشكيلة الأساسية";
      const hasTarget = !!firstEmptySquadSlot(slot.area === "starter" ? "bench" : "starter", playerName);
      const selectedGroup = squadSlotPosition(slot) || player.p;
      const selectedPlace = slot.area === "starter" ? "أساسي" : "احتياطي";
      const saleValue = guestProgress.club.confirmed ? cardSalePrice(player) : null;
      return `<section class="squad-action-panel" aria-label="إجراءات اللاعب المحدد">
        <div class="squad-player-summary">
          <div class="squad-selected-art">${cardHTML(player, "squad-selected-card")}</div>
          <div class="squad-selection-copy">
            <small>${selectedPlace} · ${POS_NAME[selectedGroup] || selectedGroup}</small>
            <strong>${esc(playerName)}</strong>
            <span>OVR ${player.r}${saleValue ? ` · بيع ${formatCoins(saleValue)} 🪙` : ""}</span>
          </div>
        </div>
        <p class="squad-selection-hint">اضغط على لاعب آخر في الملعب أو الاحتياطي لتبديل المكان.</p>
        <div class="squad-action-buttons">
          <button class="btn" id="auto-squad-move" ${hasTarget ? "" : "disabled"}>نقل إلى ${destination}</button>
          <button class="btn g" id="swap-selected-player">استبدال من السوق</button>
          ${saleValue ? `<button class="btn sell" id="sell-selected-player">بيع · ${formatCoins(saleValue)} 🪙</button>` : ""}
          ${guestProgress.club.confirmed ? "" : `<button class="btn g" id="remove-draft-player">إزالة</button>`}
          <button class="btn g" id="cancel-squad-selection">إلغاء</button>
        </div>
      </section>`;
    }

    function screenMyTeam() {
      if (!guestProgress.club) return screenClubFormations();
      processPendingStarKeeperPlayers();
      if (selectedSquadSlot && selectedSquadSlot.area === "bench") showBench = true;
      _origPush(screenMyTeam);
      const club = guestProgress.club;
      const setupCost = club.confirmed ? null : clubSetupCostBreakdown(club);
      app.innerHTML = `
  <div class="hdr"><div class="l"><span class="pos">تشكيلتي</span><span class="cnt" dir="ltr">${formationById(club.formation).id}</span></div>
  <button class="btn g sm" id="bk">رجوع</button></div>
  <div class="squad-topbar">
    <div class="wallet-badge">🪙 <b>${formatCoins(guestProgress.coins)}</b></div>
    <button class="btn g sm" id="team-market">السوق</button>
  </div>
  ${rematchContext ? `<button class="btn w mt" id="start-rematch-edit">${rematchContext.online ? "جاهز بعد التعديل · ابدأ مع صاحبك" : "ابدأ المباراة بالتشكيلة دي"}</button>` : ""}
  ${squadPitchHTML(club)}
  ${squadSelectionHTML()}
  <button class="btn g w mt" id="bench-toggle" aria-expanded="${showBench}">${showBench ? "إخفاء الاحتياطي" : "عرض الاحتياطي · 12"}</button>
  ${showBench ? `<p class="note mt">بديل لكل مركز رئيسي، و8 أماكن مرنة.</p><div class="bench-grid">
    ${BENCH_SLOT_POSITIONS.map((position, index) => {
        const name = club.bench[index];
        const player = name && P.find(item => item.n === name);
        const label = position ? `بديل ${POS_NAME[position]}` : "احتياطي مرن";
        const selected = selectedSquadSlot && selectedSquadSlot.area === "bench" && selectedSquadSlot.index === index;
        return `<button class="bench-slot ${player ? "owned-slot" : ""} ${selected ? "selected" : ""}"
          data-squad-slot="bench" data-index="${index}" data-position="${position || "ANY"}" aria-pressed="${!!selected}">
        ${player ? `<small>${label}</small>${cardHTML(player, "bench-player-card")}` : `<small>${label}</small><b>＋ إضافة</b>`}
        </button>`;
      }).join("")}
  </div>` : ""}
  <div class="sec-title">المدرب الحالي</div>
  <div class="coach-management-row">
    <button class="btn g" id="club-coach">${club.coach ? esc(club.coach) : "＋ إضافة مدرب"}</button>
    <button class="btn" id="club-coaches">المدربين · ${club.coaches.length}</button>
  </div>
  ${setupCost ? `<div class="setup-confirmation">
    <b>تجهيز مجاني قبل التأكيد</b>
    <p>غيّر اللاعبين أو المدرب أو الخطط براحتك؛ مفيش كوينز هتتخصم قبل التأكيد.</p>
    <div>إجمالي الأسعار عند التأكيد: <strong>${formatCoins(setupCost.total)} 🪙</strong></div>
    ${guestProgress.coins < setupCost.total ? `<small>رصيدك الحالي ${formatCoins(guestProgress.coins)}؛ عدّل اختياراتك قبل التأكيد.</small>` : ""}
    <button class="btn w" id="confirm-club-setup">مراجعة وتأكيد التشكيلة</button>
  </div>` : ""}
  `;
      $("bk").onclick = screenHome;
      if ($("start-rematch-edit")) $("start-rematch-edit").onclick = () => {
        if (rematchContext.online) {
          rematchPending = "ready";
          try { conn.send({ t: "rematch-choice", action: "ready" }) } catch (e) { return netFail("الاتصال بالخصم غير جاهز", screenMyTeam) }
          toast("مستني صاحبك يخلص التعديل");
          checkRematchAgreement();
        } else {
          const context = rematchContext; rematchContext = null;
          startClubMatch("ai", context.difficulty);
        }
      };
      $("bench-toggle").onclick = () => { showBench = !showBench; screenMyTeam() };
      if ($("cancel-squad-selection")) {
        $("cancel-squad-selection").onclick = () => { selectedSquadSlot = null; screenMyTeam() };
        $("auto-squad-move").onclick = moveSelectedPlayerBetweenSquadAreas;
        $("swap-selected-player").onclick = openSquadPlayerSwap;
        if ($("sell-selected-player")) {
          const selectedPlayer = P.find(item => item.n === squadSlotPlayer(selectedSquadSlot));
          $("sell-selected-player").onclick = () => sellOwnedSquadPlayer(selectedPlayer);
        }
        if ($("remove-draft-player")) $("remove-draft-player").onclick = removeDraftSquadPlayer;
      }
      $("club-coach").onclick = () => openMarket("COACH", { kind: "coach" }, "team");
      $("club-coaches").onclick = screenClubCoaches;
      if ($("change-club-formation")) $("change-club-formation").onclick = screenOwnedClubFormations;
      if ($("confirm-club-setup")) $("confirm-club-setup").onclick = openClubSetupConfirmation;
      $("team-market").onclick = () => openMarket("ALL", null, "team");
      app.querySelectorAll("[data-squad-slot]").forEach(button => {
        button.onclick = () => handleSquadSlotTap(
          button.dataset.squadSlot,
          Number(button.dataset.index),
          button.dataset.position === "ANY" ? null : button.dataset.position
        );
      });
    }

    function openClubSetupConfirmation() {
      const club = guestProgress.club;
      if (!club || club.confirmed) return screenMyTeam();
      if (!getClubMatchSetup(true)) return;

      const costs = clubSetupCostBreakdown(club);
      if (!Number.isSafeInteger(costs.total) || guestProgress.coins < costs.total) {
        return toast(`الرصيد غير كافٍ · تحتاج ${formatCoins(costs.total)} 🪙`);
      }

      const overlay = document.createElement("div");
      overlay.className = "pick-overlay sale-overlay";
      overlay.innerHTML = `
        <div class="pick-dialog" role="dialog" aria-modal="true" aria-labelledby="setup-confirm-title">
          <div class="pick-dialog-title" id="setup-confirm-title">تأكيد التشكيلة</div>
          <div class="sale-breakdown">
            <span>اللاعبون: <b>${formatCoins(costs.players)} 🪙</b></span>
            <span>المدربون: <b>${formatCoins(costs.coaches)} 🪙</b></span>
            <span>الخطط الإضافية: <b>${formatCoins(costs.formations)} 🪙</b></span>
            <span>الإجمالي: <b>${formatCoins(costs.total)} 🪙</b></span>
            <span>الرصيد بعد التأكيد: <b>${formatCoins(guestProgress.coins - costs.total)} 🪙</b></span>
          </div>
          <p>بعد التأكيد هتتطبق قواعد التشكيلة والمشتريات.</p>
          <div class="pick-actions">
            <button class="btn" type="button" data-confirm-setup>تأكيد وخصم المبلغ</button>
            <button class="btn g" type="button" data-cancel-setup>رجوع للتعديل</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const close = () => overlay.remove();
      overlay.addEventListener("click", event => {
        if (event.target === overlay) close();
      });
      overlay.querySelector("[data-cancel-setup]").onclick = close;
      overlay.querySelector("[data-confirm-setup]").onclick = () => {
        if (guestProgress.club !== club || club.confirmed) {
          close();
          return screenMyTeam();
        }
        const currentCosts = clubSetupCostBreakdown(club);
        if (!Number.isSafeInteger(currentCosts.total) || guestProgress.coins < currentCosts.total) {
          close();
          return toast("رصيد الكوينز لم يعد كافيًا");
        }
        const previous = snapshotClubProgress();
        guestProgress.coins -= currentCosts.total;
        club.confirmed = true;
        if (!commitClubProgress(previous)) {
          close();
          return screenMyTeam();
        }
        close();
        toast("تم تأكيد التشكيلة وخصم أسعار الاختيارات");
        screenMyTeam();
      };
    }

    /* أول خانة فاضية لمجموعة اللاعب: الأساسية الأول وبعدين الإضافية */
    function emptyGroupIndex(player, positions, occupied) {
      let index = positions.findIndex((position, i) => position === player.p && occupied[i] === null);
      if (index === -1) index = positions.findIndex((position, i) => position && playsGroup(player, position) && occupied[i] === null);
      return index;
    }

    /* أحسن خانة أساسية: المركز الأساسي ← مركز إضافي ← نفس المجموعة */
    function bestStarterIndex(player, formationId, occupied) {
      const roles = formationRoleSlots(formationId);
      let index = roles.findIndex((role, i) => role === player.role && occupied[i] === null);
      if (index === -1) index = roles.findIndex((role, i) => playsRole(player, role) && occupied[i] === null);
      if (index === -1) index = emptyGroupIndex(player, formationSlots(formationId), occupied);
      return index;
    }

    function findPlayerSlot(player, target) {
      const club = guestProgress.club;
      if (!club) return null;
      const positions = formationSlots(club.formation);
      if (target && target.kind === "player") {
        const key = target.area === "starter" ? "starters" : "bench";
        const slots = club[key];
        const index = target.index;
        const replacing = target.replaceName && slots[index] === target.replaceName;
        if (!Number.isInteger(index) || index < 0 || index >= slots.length ||
          (slots[index] !== null && !replacing)) return null;
        const required = key === "starters" ? positions[index] : BENCH_SLOT_POSITIONS[index];
        const requiredRole = key === "starters" ? formationRoleSlots(club.formation)[index] : null;
        if (required && !playsGroup(player, required)) return null;
        if (requiredRole && !playsRole(player, requiredRole)) return null;
        return { key, index };
      }

      const starterIndex = bestStarterIndex(player, club.formation, club.starters);
      if (starterIndex !== -1) return { key: "starters", index: starterIndex };
      const reserveIndex = emptyGroupIndex(player, BENCH_SLOT_POSITIONS, club.bench);
      if (reserveIndex !== -1) return { key: "bench", index: reserveIndex };
      const flexibleIndex = BENCH_SLOT_POSITIONS.findIndex((position, index) =>
        position === null && club.bench[index] === null);
      return flexibleIndex === -1 ? null : { key: "bench", index: flexibleIndex };
    }

    function buyMarketPlayer(player) {
      const club = guestProgress.club;
      const ownedPlayers = club ? [...club.starters, ...club.bench].filter(Boolean) : [];
      if (!Number.isSafeInteger(player.price) || player.price <= 0) return toast("سعر اللاعب محتاج تحديد");
      if (ownedPlayers.includes(player.n)) return toast("اللاعب مملوك بالفعل");
      const slot = findPlayerSlot(player, marketContext.target);
      if (!slot) return toast("مفيش مكان متاح للاعب في تشكيلتك");
      const target = marketContext.target;
      const oldName = target && target.replaceName;
      const oldCost = oldName && club.assetCosts.players[oldName];
      if (oldName && (!Number.isSafeInteger(oldCost) || oldCost < 0 ||
        club[target.area === "starter" ? "starters" : "bench"][target.index] !== oldName)) {
        return toast("اللاعب المحدد للتبديل لم يعد في مكانه");
      }
      const pendingCosts = club.confirmed ? 0 : clubSetupCostBreakdown(club).total;
      const available = club.confirmed
        ? guestProgress.coins + (oldCost || 0)
        : guestProgress.coins - (pendingCosts - (oldCost || 0));
      if (!Number.isSafeInteger(available) || available < player.price) {
        return toast(oldName ? "رصيد الكوينز غير كافٍ لتبديل اللاعب" : "رصيد الكوينز غير كافٍ لشراء اللاعب");
      }
      const previous = snapshotClubProgress();
      let swapDifference = null;
      if (club.confirmed) {
        const nextCoins = available - player.price;
        if (!Number.isSafeInteger(nextCoins)) return toast("رصيد الكوينز غير صالح");
        guestProgress.coins = nextCoins;
      }
      if (oldName) swapDifference = player.price - oldCost;
      if (oldName) delete club.assetCosts.players[oldName];
      club[slot.key][slot.index] = player.n;
      club.assetCosts.players[player.n] = player.price;
      if (slot.key === "bench") showBench = true;
      if (!commitClubProgress(previous)) return screenMarket();
      toast(oldName
        ? !club.confirmed ? "تم تبديل اللاعب مجانًا قبل التأكيد"
          : swapDifference < 0
            ? `تم تبديل اللاعب · استرداد ${formatCoins(-swapDifference)} 🪙`
            : `تم تبديل اللاعب · خصم ${formatCoins(swapDifference)} 🪙`
        : club.confirmed
          ? `تم شراء ${player.n} · ${formatCoins(player.price)} 🪙`
          : `تمت إضافة ${player.n} · السعر عند التأكيد ${formatCoins(player.price)} 🪙`);
      screenMyTeam();
    }

    function buyMarketCoach(coach) {
      const club = guestProgress.club;
      const price = coachPrice(coach);
      if (!club) return toast("اختار تشكيلتك الأول");
      if (!Number.isSafeInteger(price) || price <= 0) return toast("سعر المدرب محتاج تحديد");
      const target = marketContext.target;
      const oldName = target && target.replaceName;
      const oldCost = oldName ? club.assetCosts.coaches[oldName] : 0;
      let swapDifference = null;
      if (oldName) {
        if (!club.coaches.includes(oldName) || !Number.isSafeInteger(oldCost) || oldCost < 0) {
          return toast("المدرب المحدد للتبديل لم يعد في تشكيلتك");
        }
        if (club.coaches.includes(coach.n)) return toast("المدرب موجود بالفعل في مجموعتك");
        swapDifference = price - oldCost;
        if (club.confirmed) {
          const available = guestProgress.coins + oldCost;
          if (!Number.isSafeInteger(available) || available < price) {
            return toast("رصيد الكوينز غير كافٍ لتبديل المدرب");
          }
        }
      } else {
        if (club.coaches.includes(coach.n)) return toast("المدرب مملوك بالفعل");
        if (club.confirmed && guestProgress.coins < price) return toast("رصيد الكوينز غير كافٍ");
      }
      const previous = snapshotClubProgress();
      if (club.confirmed) guestProgress.coins += oldCost - price;
      if (oldName) {
        club.coaches = club.coaches.filter(name => name !== oldName);
        delete club.assetCosts.coaches[oldName];
      }
      club.coaches.push(coach.n);
      club.assetCosts.coaches[coach.n] = price;
      if (oldName || !club.coach) club.coach = coach.n;
      if (!commitClubProgress(previous)) return screenMarket();
      toast(oldName
        ? !club.confirmed ? "تم تبديل المدرب مجانًا قبل التأكيد"
          : swapDifference < 0
            ? `تم تبديل المدرب · استرداد ${formatCoins(-swapDifference)} 🪙`
            : `تم تبديل المدرب · خصم ${formatCoins(swapDifference)} 🪙`
        : club.confirmed
          ? `تم شراء ${coach.n} · ${formatCoins(price)} 🪙`
          : `تمت إضافة ${coach.n} · السعر عند التأكيد ${formatCoins(price)} 🪙`);
      if (marketContext.returnTo === "coaches") screenClubCoaches();
      else screenMyTeam();
    }

    function buyMarketFormation(formation) {
      const club = guestProgress.club;
      if (!club) return toast("اختار تشكيلتك الأول");
      if (!FORMATIONS.some(item => item.id === formation.id)) return toast("التشكيلة غير متاحة");
      if (club.ownedFormations.includes(formation.id)) return toast("التشكيلة مملوكة بالفعل");
      if (club.confirmed) {
        if (guestProgress.coins < FORMATION_PRICE) return toast("رصيد الكوينز غير كافٍ");
      }
      const previous = snapshotClubProgress();
      if (club.confirmed) guestProgress.coins -= FORMATION_PRICE;
      club.ownedFormations.push(formation.id);
      club.assetCosts.formations[formation.id] = FORMATION_PRICE;
      if (!commitClubProgress(previous)) return screenMarket();
      toast(club.confirmed
        ? `تم شراء تشكيلة ${formation.id} · ${formatCoins(FORMATION_PRICE)} 🪙`
        : `تمت إضافة تشكيلة ${formation.id} · السعر عند التأكيد ${formatCoins(FORMATION_PRICE)} 🪙`);
      screenMyTeam();
    }

    function openCardSaleDialog(card, onConfirm) {
      const salePrice = cardSalePrice(card);
      if (salePrice === null || salePrice <= 0) {
        toast("سعر البيع غير متاح");
        return;
      }
      if (guestProgress.coins > Number.MAX_SAFE_INTEGER - salePrice) {
        toast("رصيدك وصل للحد الأقصى للكوينز");
        return;
      }
      const loss = card.price - salePrice;
      const returnFocus = document.activeElement;
      const overlay = document.createElement("div");
      overlay.className = "pick-overlay sale-overlay";
      overlay.innerHTML = `
        <div class="pick-dialog" role="dialog" aria-modal="true" aria-labelledby="sale-dialog-title">
          <div class="pick-dialog-title" id="sale-dialog-title">تأكيد بيع الكارت</div>
          <h3>${esc(card.n)}</h3>
          <div class="sale-breakdown">
            <span>السعر الحالي: <b>${formatCoins(card.price)} 🪙</b></span>
            <span class="loss">الخسارة: <b>${formatCoins(loss)} 🪙</b></span>
            <span>هتستلم: <b>${formatCoins(salePrice)} 🪙</b></span>
          </div>
          <div class="pick-actions">
            <button class="btn" type="button" data-confirm-sale>تأكيد البيع</button>
            <button class="btn g" type="button" data-cancel-sale>إلغاء</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const close = () => {
        overlay.remove();
        document.removeEventListener("keydown", handleKeydown);
        if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus();
      };
      const handleKeydown = event => {
        if (event.key === "Escape") close();
      };
      overlay.addEventListener("click", event => {
        if (event.target === overlay) close();
      });
      overlay.querySelector("[data-cancel-sale]").onclick = close;
      overlay.querySelector("[data-confirm-sale]").onclick = () => {
        close();
        onConfirm(salePrice);
      };
      document.addEventListener("keydown", handleKeydown);
      overlay.querySelector("[data-confirm-sale]").focus();
    }

    function sellOwnedSquadPlayer(player) {
      const club = guestProgress.club;
      if (!club || !club.confirmed || !player) return toast("لا يمكن البيع قبل تأكيد التشكيلة");
      const starterIndex = club.starters.indexOf(player.n);
      const benchIndex = club.bench.indexOf(player.n);
      const slot = starterIndex >= 0
        ? { area: "starter", index: starterIndex }
        : benchIndex >= 0 ? { area: "bench", index: benchIndex } : null;
      if (!slot) return toast("اللاعب غير موجود في تشكيلتك");
      openCardSaleDialog(player, salePrice => {
        const currentClub = guestProgress.club;
        const key = slot.area === "starter" ? "starters" : "bench";
        if (!currentClub || !currentClub.confirmed || currentClub[key][slot.index] !== player.n) {
          return toast("اللاعب لم يعد في هذا المكان");
        }
        if (guestProgress.coins > Number.MAX_SAFE_INTEGER - salePrice) {
          return toast("رصيدك وصل للحد الأقصى للكوينز");
        }
        const previous = snapshotClubProgress();
        currentClub[key][slot.index] = null;
        delete currentClub.assetCosts.players[player.n];
        guestProgress.coins += salePrice;
        selectedSquadSlot = null;
        showBench = slot.area === "bench";
        if (!commitClubProgress(previous)) return screenMyTeam();
        toast(`تم بيع ${player.n} · +${formatCoins(salePrice)} 🪙`);
        screenMyTeam();
      });
    }

    function sellClubCoach(coachIndex) {
      const club = guestProgress.club;
      const coach = COACHES[coachIndex];
      if (!club || !coach || !club.coaches.includes(coach.n)) {
        return toast("المدرب غير موجود في مجموعتك");
      }
      openCardSaleDialog(coach, salePrice => {
        const currentClub = guestProgress.club;
        if (!currentClub || !currentClub.coaches.includes(coach.n)) {
          return toast("المدرب لم يعد في مجموعتك");
        }
        if (guestProgress.coins > Number.MAX_SAFE_INTEGER - salePrice) {
          return toast("رصيدك وصل للحد الأقصى للكوينز");
        }
        const previous = snapshotClubProgress();
        currentClub.coaches = currentClub.coaches.filter(name => name !== coach.n);
        delete currentClub.assetCosts.coaches[coach.n];
        if (currentClub.coach === coach.n) currentClub.coach = currentClub.coaches[0] || null;
        guestProgress.coins += salePrice;
        if (!commitClubProgress(previous)) return screenClubCoaches();
        toast(`تم بيع ${coach.n} · +${formatCoins(salePrice)} 🪙`);
        screenClubCoaches();
      });
    }

    function selectClubCoach(coach) {
      const club = guestProgress.club;
      if (!club || !club.coaches.includes(coach.n)) return toast("المدرب غير موجود في مجموعتك");
      if (club.coach === coach.n) return toast("المدرب الحالي بالفعل");
      club.coach = coach.n;
      saveGuestProgress();
      toast(`المدرب الحالي: ${coach.n}`);
      screenMyTeam();
    }

    function openClubCoachSwap() {
      const club = guestProgress.club;
      if (!club || !club.coach) return toast("اختار مدربك الأول");
      openMarket("COACH", { kind: "coach", replaceName: club.coach }, "coaches");
    }

    function removeDraftClubCoach(coachIndex) {
      const club = guestProgress.club;
      const coach = COACHES[coachIndex];
      if (!club || club.confirmed || !coach || !club.coaches.includes(coach.n)) {
        return toast("لا يمكن إزالة المدرب من هنا");
      }
      const previous = snapshotClubProgress();
      club.coaches = club.coaches.filter(name => name !== coach.n);
      delete club.assetCosts.coaches[coach.n];
      if (club.coach === coach.n) club.coach = club.coaches[0] || null;
      if (!commitClubProgress(previous)) return screenClubCoaches();
      toast(`تمت إزالة ${coach.n} قبل التأكيد`);
      screenClubCoaches();
    }

    function screenClubCoaches() {
      const club = guestProgress.club;
      if (!club) return screenMyTeam();
      const coaches = club.coaches
        .map(name => COACHES.find(coach => coach.n === name))
        .filter(Boolean);
      app.innerHTML = `
  <div class="hdr"><div class="l"><span class="pos">مدربو تشكيلتي</span><span class="cnt">${coaches.length} مدرب</span></div>
  <button class="btn g sm" id="bk">رجوع</button></div>
  ${coaches.length ? `<div class="rows">${coaches.map(coach => {
        const salePrice = cardSalePrice(coach);
        const canSell = salePrice !== null && salePrice > 0;
        const action = !club.confirmed
          ? `<button class="btn g sm" data-remove-draft-coach="${COACHES.indexOf(coach)}">إزالة</button>`
          : club.coach === coach.n
            ? ""
            : `<button class="btn g sm sell" data-sell-coach="${COACHES.indexOf(coach)}" ${canSell ? "" : "disabled"}>بيع</button>`;
        return `<div class="row">
      <span class="n">${esc(coach.n)} · تقييم ${coach.r}</span>
      <div class="coach-collection-actions">
        <button class="btn g sm" data-select-coach="${COACHES.indexOf(coach)}" ${club.coach === coach.n ? "disabled" : ""}>
          ${club.coach === coach.n ? "الحالي" : "اختيار"}
        </button>
        ${action}
      </div>
    </div>`;
      }).join("")}</div>` : `<p class="note">لسه ماعندكش مدربين. أضف مدربًا من السوق.</p>`}
  <button class="btn g w mt" id="swap-club-coach" ${club.coach ? "" : "disabled"}>تبديل المدرب الحالي</button>
  <button class="btn w mt" id="add-club-coach">إضافة مدربين من السوق</button>`;
      $("bk").onclick = screenMyTeam;
      $("add-club-coach").onclick = () => openMarket("COACH", { kind: "coach" }, "coaches");
      $("swap-club-coach").onclick = openClubCoachSwap;
      app.querySelectorAll("[data-select-coach]").forEach(button => {
        button.onclick = () => selectClubCoach(COACHES[Number(button.dataset.selectCoach)]);
      });
      app.querySelectorAll("[data-sell-coach]").forEach(button => {
        button.onclick = () => sellClubCoach(Number(button.dataset.sellCoach));
      });
      app.querySelectorAll("[data-remove-draft-coach]").forEach(button => {
        button.onclick = () => removeDraftClubCoach(Number(button.dataset.removeDraftCoach));
      });
    }

    function screenMarket() {
      const { target, returnTo } = marketContext;
      const position = target && target.kind === "coach" ? "COACH" : marketContext.position;
      const isCoachMarket = position === "COACH";
      const isFormationMarket = position === "FORMATION";
      const ownedPlayers = guestProgress.club
        ? [...guestProgress.club.starters, ...guestProgress.club.bench].filter(Boolean)
        : [];
      const pendingClubCost = guestProgress.club && !guestProgress.club.confirmed
        ? clubSetupCostBreakdown(guestProgress.club).total
        : 0;
      /* Managers are listed best first so the elite names lead the market. */
      const items = isCoachMarket
        ? COACHES.slice().sort((a, b) => b.r - a.r || a.price - b.price)
        : isFormationMarket ? FORMATIONS :
          P.filter(player => marketPositionMatches(player, marketContext.position, marketContext.roles, target))
            .sort((a, b) => b.r - a.r || a.n.localeCompare(b.n));
      const roleFilters = MARKET_ROLE_FILTERS;
      const filterCount = marketContext.roles.length +
        (marketContext.ratingMin || marketContext.ratingMax ? 1 : 0) + (marketContext.priceMin || marketContext.priceMax ? 1 : 0);
      const categoryOptions = [["ALL", "لاعبون"], ["COACH", "مدربون"], ["FORMATION", "تشكيلات"]];
      const marketFilterControls = `<div class="market-filter-wrap"><div class="market-actions">
        <button type="button" class="market-filter-toggle" id="market-filter-toggle" aria-expanded="${marketContext.filtersOpen}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16l-6.5 7.2V19l-3 1v-7.8L4 5z"/></svg><span>تصفية السوق</span>${filterCount ? `<span class="market-filter-count">${filterCount}</span>` : ""}</button><button type="button" class="market-search-toggle" id="market-search-toggle" aria-label="بحث" title="بحث" aria-expanded="${marketContext.searchOpen}"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.3"></circle><path d="m15.5 15.5 5 5"></path></svg></button></div><div class="market-search-box" ${marketContext.searchOpen ? "" : "hidden"}><input class="market-search" id="market-search" type="search" dir="auto" placeholder="ابحث بالاسم..." aria-label="بحث في السوق" autocomplete="off" value="${esc(marketContext.query)}"></div><div class="market-filter-panel" ${marketContext.filtersOpen ? "" : "hidden"}>
          ${`<div class="market-filter-categories">${categoryOptions.map(([value,label]) => `<button type="button" class="market-category-choice ${position === value ? "active" : ""}" data-market-category="${value}">${label}</button>`).join("")}</div>`}
          <div class="market-filter-fields">
            ${isCoachMarket || isFormationMarket ? "" : `<label>أقل تقييم<input type="number" id="market-rating-min" min="1" max="99" inputmode="numeric" placeholder="من" value="${esc(marketContext.ratingMin)}"></label><label>أعلى تقييم<input type="number" id="market-rating-max" min="1" max="99" inputmode="numeric" placeholder="إلى" value="${esc(marketContext.ratingMax)}"></label><label>أقل سعر 🪙<input type="number" id="market-price-min" min="0" inputmode="numeric" placeholder="من" value="${esc(marketContext.priceMin)}"></label><label>أعلى سعر 🪙<input type="number" id="market-price-max" min="0" inputmode="numeric" placeholder="إلى" value="${esc(marketContext.priceMax)}"></label>`}
          </div>
          ${!isCoachMarket && !isFormationMarket ? `<div class="market-position-choices" aria-label="اختيار المراكز">${roleFilters.map(([role,label,title]) => `<button type="button" class="market-position-choice ${marketContext.roles.includes(role) ? "active" : ""}" data-market-role="${role}" title="${title}" aria-pressed="${marketContext.roles.includes(role)}">${label}</button>`).join("")}</div>` : ""}
          ${filterCount ? `<button type="button" class="market-filter-clear" id="clear-market-filters">مسح التحديدات</button>` : ""}
        </div></div>`;      const marketItems = isCoachMarket
        ? items.map(coach => {
          const price = coachPrice(coach);
          const owned = guestProgress.club && guestProgress.club.coaches.includes(coach.n);
          const hasPrice = Number.isSafeInteger(price) && price > 0;
          const replacing = target && target.replaceName;
          const refund = replacing && guestProgress.club
            ? guestProgress.club.assetCosts.coaches[target.replaceName] || 0
            : 0;
          const available = guestProgress.coins + refund;
          const canAfford = !guestProgress.club || !guestProgress.club.confirmed ||
            Number.isSafeInteger(available) && available >= price;
          const label = owned ? "مملوك" : !guestProgress.club ? "اختار تشكيلتك" :
            !hasPrice ? "مقترح" : !canAfford ? "رصيد غير كافٍ" :
              replacing ? "تبديل" : guestProgress.club.confirmed ? "شراء" : "إضافة";
          const difference = price - refund;
          const priceText = hasPrice
            ? `السعر ${formatCoins(price)}${replacing ? ` · ${difference < 0 ? `استرداد ${formatCoins(-difference)}` : `فرق ${formatCoins(difference)}`}` : ""}`
            : `بدون سعر حاليًا · المقترح ${formatCoins(coach.suggestedPrice)}`;
          return `<div class="market-item player-market-card coach-market-card" data-market-search-item>
            ${coachCardHTML(coach, "market-coach-card")}
            <small class="market-item-price">${priceText}</small>
            <button class="btn g sm market-price ${owned ? "owned" : ""}" data-buy-coach="${COACHES.indexOf(coach)}" ${owned || !guestProgress.club || !hasPrice || !canAfford ? "disabled" : ""}>${label}</button>
          </div>`;
        }).join("")
        : isFormationMarket
          ? items.map(formation => {
            const owned = guestProgress.club && guestProgress.club.ownedFormations.includes(formation.id);
            const active = guestProgress.club && guestProgress.club.formation === formation.id;
            const canAfford = !guestProgress.club || !guestProgress.club.confirmed ||
              guestProgress.coins >= FORMATION_PRICE;
            const label = active ? "الخطة الحالية" : owned ? "مملوكة" :
              !guestProgress.club ? "اختار تشكيلتك" : !canAfford ? "رصيد غير كافٍ" :
                `${guestProgress.club.confirmed ? "شراء" : "إضافة"} · ${formatCoins(FORMATION_PRICE)} 🪙`;
            return `<div class="market-item" data-market-search-item>
              <div class="market-item-info"><b dir="ltr">${formation.id}</b><small>${esc(formation.name)} · السعر ${formatCoins(FORMATION_PRICE)} 🪙</small></div>
              <button class="btn g sm market-price ${owned ? "owned" : ""}" data-buy-formation="${FORMATIONS.indexOf(formation)}"
                ${active || owned || !guestProgress.club || !canAfford ? "disabled" : ""}>${label}</button>
            </div>`;
          }).join("")
          : items.map(player => {
            const owned = ownedPlayers.includes(player.n);
            const slot = owned ? null : findPlayerSlot(player, target);
            const hasPrice = Number.isSafeInteger(player.price) && player.price > 0;
            const replacing = target && target.kind === "player" && target.replaceName;
            const refund = replacing && guestProgress.club
              ? guestProgress.club.assetCosts.players[target.replaceName] || 0
              : 0;
            const available = guestProgress.club && guestProgress.club.confirmed
              ? guestProgress.coins + refund
              : guestProgress.coins - (pendingClubCost - refund);
            const canAfford = !guestProgress.club || Number.isSafeInteger(available) && available >= player.price;
            const difference = player.price - refund;
            const salePrice = cardSalePrice(player);

            const canSellOwned = owned && !target && guestProgress.club && guestProgress.club.confirmed &&
              salePrice !== null && salePrice > 0;
            /* The price already sits above the button, so the action label stays short
               enough for the narrow grid column. */
            const label = owned ? canSellOwned ? `بيع · ${formatCoins(salePrice)} 🪙` : "مملوك" :
              !guestProgress.club ? "اختار تشكيلتك" :
                !hasPrice ? "مقترح" : !slot ? "لا يوجد مكان" :
                  !canAfford ? "رصيد غير كافٍ" :
                    `${replacing ? "تبديل" : guestProgress.club.confirmed ? "شراء" : "اختيار"}`;
            const actionAttribute = canSellOwned
              ? `data-sell-market-player="${P.indexOf(player)}"`
              : `data-buy-player="${P.indexOf(player)}"`;
            const disabled = canSellOwned
              ? ""
              : owned || !slot || !hasPrice || !canAfford ? "disabled" : "";
            return `<div class="market-item player-market-card" data-market-search-item data-market-player data-market-rating="${player.r}" data-market-price="${hasPrice ? player.price : ""}">
            ${cardHTML(player, "market-player-card")}
            <small class="market-item-price">${hasPrice
                ? `السعر ${formatCoins(player.price)} 🪙${replacing ? ` · ${difference < 0 ? `استرداد ${formatCoins(-difference)}` : `الفرق ${formatCoins(difference)}`}` : ""}`
                : `السعر غير متاح · المقترح ${formatCoins(player.suggestedPrice)} 🪙`}</small>
            <button class="btn g sm market-price ${owned && !canSellOwned ? "owned" : ""}" ${actionAttribute} ${disabled}>${label}</button>
          </div>`;
          }).join("");
      app.innerHTML = `
  <div class="hdr"><div class="l"><span class="pos">السوق</span><span class="cnt">${isCoachMarket ? "المدربين" : isFormationMarket ? "التشكيلات" : "اللاعبين"}</span></div>
  <button class="btn g sm" id="bk">رجوع</button></div>
  <div class="wallet-badge">🪙 <b>${formatCoins(guestProgress.coins)}</b></div>
  ${marketFilterControls}
  <div class="market-list ${!isFormationMarket ? "player-grid" : ""}" id="market-list">
    ${marketItems
          ? marketItems
          : `<div class="rows" data-market-empty><div class="row"><span class="n">مفيش عناصر متاحة في القسم ده.</span></div></div>`}
    <div class="rows market-search-empty" id="market-search-empty" hidden><div class="row"><span class="n">مفيش نتائج مطابقة للبحث.</span></div></div>
  </div>`;
      $("bk").onclick = returnTo === "coaches" ? screenClubCoaches :
        returnTo === "team" ? screenMyTeam : screenHome;
      const marketSearch = $("market-search");
      const applyMarketSearch = () => {
        const ratingMinInput = $("market-rating-min"), ratingMaxInput = $("market-rating-max");
        const priceMinInput = $("market-price-min"), priceMaxInput = $("market-price-max");
        const readBound = input => input && input.value.trim() !== "" ? Number(input.value) : null;
        const ratingMin = readBound(ratingMinInput), ratingMax = readBound(ratingMaxInput);
        const priceMin = readBound(priceMinInput), priceMax = readBound(priceMaxInput);
        if (ratingMinInput) marketContext.ratingMin = ratingMinInput.value;
        if (ratingMaxInput) marketContext.ratingMax = ratingMaxInput.value;
        if (priceMinInput) marketContext.priceMin = priceMinInput.value;
        if (priceMaxInput) marketContext.priceMax = priceMaxInput.value;
        const query = marketSearch ? marketSearch.value.trim().toLocaleLowerCase() : "";
        if (marketSearch) marketContext.query = marketSearch.value;
        let hasMatch = false;
        app.querySelectorAll("[data-market-search-item]").forEach(item => {
          let matches = !query || item.textContent.toLocaleLowerCase().includes(query);
          if (matches && item.hasAttribute("data-market-player")) {
            const rating = Number(item.dataset.marketRating), price = item.dataset.marketPrice === "" ? null : Number(item.dataset.marketPrice);
            if (ratingMin !== null && rating < ratingMin || ratingMax !== null && rating > ratingMax || priceMin !== null && (price === null || price < priceMin) || priceMax !== null && (price === null || price > priceMax)) matches = false;
          }
          item.hidden = !matches; if (matches) hasMatch = true;
        });
        const emptyMarket = app.querySelector("[data-market-empty]");
        if (emptyMarket) emptyMarket.hidden = !!query || ratingMin !== null || ratingMax !== null || priceMin !== null || priceMax !== null;
        const emptySearch = $("market-search-empty"); if (emptySearch) emptySearch.hidden = !query && ratingMin === null && ratingMax === null && priceMin === null && priceMax === null || hasMatch;
      };
      if (marketSearch) marketSearch.oninput = applyMarketSearch;
      app.querySelectorAll(".market-filter-panel input").forEach(input => { input.oninput = applyMarketSearch });
      applyMarketSearch();
      const toggle = $("market-filter-toggle"); if (toggle) toggle.onclick = () => { marketContext.filtersOpen = !marketContext.filtersOpen; screenMarket(); };
      $("market-search-toggle").onclick = () => { marketContext.searchOpen = !marketContext.searchOpen; screenMarket(); if (marketContext.searchOpen) $("market-search").focus(); };
      app.querySelectorAll("[data-market-category]").forEach(button => button.onclick = () => { marketContext.position = button.dataset.marketCategory; marketContext.target = null; marketContext.roles = []; screenMarket(); });
      app.querySelectorAll("[data-market-role]").forEach(button => button.onclick = () => {
        const role = button.dataset.marketRole;
        marketContext.roles = marketContext.roles.includes(role) ? marketContext.roles.filter(value => value !== role) : [...marketContext.roles, role];
        screenMarket();
      });
      const clearFilters = $("clear-market-filters"); if (clearFilters) clearFilters.onclick = () => { Object.assign(marketContext,{roles:[],ratingMin:"",ratingMax:"",priceMin:"",priceMax:""}); screenMarket(); };
      app.querySelectorAll("[data-buy-player]").forEach(button => {
        button.onclick = () => buyMarketPlayer(P[Number(button.dataset.buyPlayer)]);
      });
      app.querySelectorAll("[data-sell-market-player]").forEach(button => {
        button.onclick = () => sellOwnedSquadPlayer(P[Number(button.dataset.sellMarketPlayer)]);
      });
      app.querySelectorAll("[data-buy-coach]").forEach(button => {
        button.onclick = () => buyMarketCoach(COACHES[Number(button.dataset.buyCoach)]);
      });
      app.querySelectorAll("[data-buy-formation]").forEach(button => {
        button.onclick = () => buyMarketFormation(FORMATIONS[Number(button.dataset.buyFormation)]);
      });
    }

    function screenHow() {
      _origPush(screenHow);
      app.innerHTML = `
  <div class="hdr"><div class="l"><span class="pos">إزاي تلعب</span><span class="cnt">القواعد</span></div>
  <button class="btn g sm" id="bk">رجوع</button></div>
  <div class="rows rows-text">
    <div class="row"><span class="n">١. اختار كارت من 4</span></div>
    <div class="row"><span class="n">كل مركز فيه 4 كروت مقلوبة — اختار واحد واكشفه.</span></div>
    <div class="row"><span class="n">٢. عندك تغيير واحد</span></div>
    <div class="row"><span class="n">في كل مركز تقدر تغيّر الكارت مرة واحدة بس.</span></div>
    <div class="row"><span class="n">٣. الخصم بيختار</span></div>
    <div class="row"><span class="n">بعد اختيارك بيظهر اختيار الخصم — الأخضر اختاره والأحمر غيّره.</span></div>
    <div class="row"><span class="n">٤. اختار مدربك من ٤ كروت بعد ما تكمل فريقك.</span></div>
    <div class="row"><span class="n">تقييم المدرب يزود أو يقلل قوة فريقك بالنسبة الموضحة على كارت المدرب.</span></div>
    <div class="row"><span class="n">٥. النتيجة</span></div>
    <div class="row"><span class="n">تقييم فريقك بيحدد فرصك في الفوز، لكن النتيجة بتتحسم في الملعب: التعادل أو الخسارة واردين حتى لو فريقك الأقوى.</span></div>
  </div>
  <button class="btn w mt" id="go">يلا نبدأ</button>`;
      $("bk").onclick = screenHome;
      $("go").onclick = screenModes;
    }

    function screenModes() {
      cancelGameTimers(); killNet();
      _origPush(screenModes);
      app.innerHTML = `
  <main class="play-menu">
    <header class="hdr"><div class="l"><span class="pos">اختار طريقة اللعب</span><span class="cnt">ابدأ مباراة بتشكيلتك أو كوّن فريق بالدريفت</span></div><button class="btn g sm" id="bk">رجوع</button></header>
    <button class="play-club-card" id="mClub"><span class="play-mode-icon">🏟️</span><span class="play-mode-copy"><b>مباريات تشكيلتي</b><small>العب بفريقك ومدربك والبدلاء</small></span><span class="play-mode-arrow">‹</span></button>
    <button class="play-club-card secondary" id="mDraft"><span class="play-mode-icon">🃏</span><span class="play-mode-copy"><b>دريفت الكروت</b><small>اكشف الكروت وكوّن فريقك جولة بجولة</small></span><span class="play-mode-arrow">‹</span></button>
    <button class="play-club-card secondary" id="mEvents"><span class="play-mode-icon">🏆</span><span class="play-mode-copy"><b>الأحداث والبطولات</b><small>نافس الكمبيوتر في بطولة إقصائية واربح فرصة حزمة</small></span><span class="play-mode-arrow">‹</span></button>
  </main>`;
      $("bk").onclick = screenHome;
      $("mClub").onclick = screenClubModes;
      $("mDraft").onclick = screenDraftModes;
      $("mEvents").onclick = screenEvents;
    }

    function screenEvents() {
      _origPush(screenEvents);
      const stages = ["ربع النهائي", "نصف النهائي", "النهائي"];
      const currentStage = activeTournament ? stages[Math.max(0, activeTournament.round - 1)] : null;
      app.innerHTML = `
  <main class="play-menu">
    <header class="hdr"><div class="l"><span class="pos">حارس نجم</span><span class="cnt">بطولة حراس · مستوى الكمبيوتر 89</span></div><button class="btn g sm" id="bk">رجوع</button></header>
    <button class="play-club-card" id="event-start"><span class="play-mode-icon">${starKeeperCupWon ? "🏆" : activeTournament ? "▶️" : "⚽"}</span><span class="play-mode-copy"><b>${starKeeperCupWon ? "العب بطولة حارس نجم مرة أخرى" : activeTournament ? `استكمال البطولة · ${currentStage || "تجهيز الفريق"}` : "ابدأ بطولة حارس نجم"}</b><small>${starKeeperCupWon ? "المكافأة اتفتحت قبل كده · العب بدون مكافأة إضافية" : activeTournament ? "كمّل تحدي الكمبيوتر · التقييم 89" : "محاولة واحدة · العب بتشكيلتك"}</small></span><span class="play-mode-arrow">‹</span></button>
  </main>`;
      $("bk").onclick = screenModes;
      $("event-start").onclick = () => {
        try {
        if (starKeeperCupWon) {
          activeTournament = { round: 1, total: 3 };
          tournamentTeam = tournamentResult = null;
          const setup = getClubMatchSetup(true, true);
          if (!setup) { activeTournament = null; saveTournamentProgress(); return; }
          tournamentTeam = { team: setup.team, bench: setup.bench, formation: setup.club.formation, coach: setup.coach };
          saveTournamentProgress();
          eventTournamentRoundLabel = "ربع النهائي";
          return startTournamentMatch();
        }
        if (!activeTournament) {
          const setup = getClubMatchSetup(true, true);
          if (!setup) return;
          activeTournament = { round: 1, total: 3 };
          tournamentTeam = { team: setup.team, bench: setup.bench, formation: setup.club.formation, coach: setup.coach };
          saveTournamentProgress();
          tournamentResult = null;
          eventTournamentRoundLabel = "ربع النهائي";
          saveTournamentProgress();
          return startTournamentMatch();
        }
        if (tournamentResult) return continueTournament();
        if (tournamentTeam) return startTournamentMatch();
        const setup = getClubMatchSetup(true, true);
        if (setup) {
          tournamentTeam = { team: setup.team, bench: setup.bench, formation: setup.club.formation, coach: setup.coach };
          saveTournamentProgress();
          startTournamentMatch();
        }
        } catch (error) {
          console.error("Could not start Star Keeper tournament.", error);
          toast("حصل خطأ أثناء بدء البطولة · راجع التشكيلة وحاول مرة تانية");
        }
      };
    }

    function ensureStarKeeperPack() {
      const guaranteed = ["Peter Schmeichel", "Jan Oblak", "David Raya"];
      const valid = Array.isArray(starKeeperPack) && starKeeperPack.length === 11 && new Set(starKeeperPack).size === 11 &&
        guaranteed.every(name => starKeeperPack.includes(name)) && starKeeperPack.every(name => P.some(player =>
          player.n === name && (guaranteed.includes(name) ? player.p === "G" : player.p === "G" && player.r < 83)));
      if (!valid) {
        const others = shuffle(P.filter(player => player.p === "G" && player.r < 83 && !guaranteed.includes(player.n))).slice(0, 8);
        starKeeperPack = [...guaranteed, ...others.map(player => player.n)];
        try { localStorage.setItem(STAR_KEEPER_PACK_KEY, JSON.stringify(starKeeperPack)) } catch (_) { }
      }
      return starKeeperPack.map(name => P.find(player => player.n === name)).filter(Boolean);
    }

    function playerMarketValue(player) {
      if (player && Number.isSafeInteger(player.price) && player.price > 0) return player.price;
      if (player && Number.isSafeInteger(player.suggestedPrice) && player.suggestedPrice > 0) return player.suggestedPrice;
      return 0;
    }

    function addWonKeeperToClub(player) {
      const club = guestProgress.club;
      if (!club) return "no-club";
      const owned = [...club.starters, ...club.bench].filter(Boolean);
      if (owned.includes(player.n)) {
        starKeeperPendingPlayers = starKeeperPendingPlayers.filter(name => name !== player.n);
        saveStarKeeperPlayerClaims();
        return "already-owned";
      }
      const slot = findPlayerSlot(player, null);
      if (!slot) return "full";
      const previous = snapshotClubProgress();
      club[slot.key][slot.index] = player.n;
      club.assetCosts.players[player.n] = 0;
      if (!commitClubProgress(previous)) return "save-failed";
      starKeeperPendingPlayers = starKeeperPendingPlayers.filter(name => name !== player.n);
      saveStarKeeperPlayerClaims();
      return "added";
    }

    function processPendingStarKeeperPlayers() {
      if (!guestProgress.club || !starKeeperPendingPlayers.length) return;
      for (const name of starKeeperPendingPlayers.slice()) {
        const player = P.find(item => item.n === name);
        if (!player) {
          starKeeperPendingPlayers = starKeeperPendingPlayers.filter(pending => pending !== name);
          saveStarKeeperPlayerClaims();
          continue;
        }
        if (addWonKeeperToClub(player) === "full") break;
      }
    }

    function availableStarKeeperPlayers(players) {
      const inClub = guestProgress.club ? [...guestProgress.club.starters, ...guestProgress.club.bench].filter(Boolean) : [];
      return players.filter(player => !starKeeperWonPlayers.includes(player.n) && !inClub.includes(player.n));
    }

    function finishWonKeeperAsSale(player) {
      const value = playerMarketValue(player);
      if (!value) return toast("سعر السوق للاعب ده غير متاح");
      const previous = guestProgress.coins;
      guestProgress.coins = Math.min(Number.MAX_SAFE_INTEGER, guestProgress.coins + value);
      if (!saveGuestProgress()) { guestProgress.coins = previous; return }
      starKeeperPendingPlayers = starKeeperPendingPlayers.filter(name => name !== player.n);
      saveStarKeeperPlayerClaims();
      document.getElementById("star-keeper-choice")?.remove();
      toast(`تم بيع ${player.n} بسعر السوق · ${formatCoins(value)} 🪙`);
      screenStarKeeperPackDetails();
    }

    function replaceClubPlayerWithWonKeeper(player, area, index) {
      const club = guestProgress.club;
      const key = area === "starter" ? "starters" : "bench";
      const oldName = club && club[key][index];
      const oldPlayer = oldName && P.find(item => item.n === oldName);
      if (!club || !oldPlayer || !canPlayerUseSlot(player.n, { area, index })) return toast("اختار مكان حارس مناسب");
      const value = playerMarketValue(oldPlayer);
      if (!value) return toast("سعر السوق للاعب المحدد غير متاح");
      if (guestProgress.coins > Number.MAX_SAFE_INTEGER - value) return toast("رصيدك وصل للحد الأقصى للكوينز");
      const previous = snapshotClubProgress();
      guestProgress.coins += value;
      delete club.assetCosts.players[oldName];
      club[key][index] = player.n;
      club.assetCosts.players[player.n] = 0;
      if (!commitClubProgress(previous)) return;
      starKeeperPendingPlayers = starKeeperPendingPlayers.filter(name => name !== player.n);
      saveStarKeeperPlayerClaims();
      document.getElementById("star-keeper-choice")?.remove();
      toast(`تمت إضافة ${player.n} وبيع ${oldName} بسعر السوق · ${formatCoins(value)} 🪙`);
      screenStarKeeperPackDetails();
    }

    function showWonKeeperChoice(player) {
      const overlay = document.createElement("div");
      overlay.id = "star-keeper-choice";
      overlay.className = "pick-overlay sale-overlay";
      overlay.innerHTML = `<div class="pick-dialog" role="dialog" aria-modal="true">
        <div class="pick-dialog-title">كسبت ${esc(player.n)} · ${player.r}</div>
        <p class="note">تشكيلتك ممتلئة. استبدل حارسًا أو مكانًا مرنًا وبِع اللاعب القديم بسعر السوق، أو بِع اللاعب الفائز.</p>
        <button class="btn w" id="choose-keeper-replacement">استبدال لاعب من التشكيلة</button>
        <button class="btn g w mt-s" id="sell-won-keeper">بيع اللاعب الفائز · ${formatCoins(playerMarketValue(player))} 🪙</button>
        <button class="btn g w mt-s" id="close-keeper-choice">لاحقًا</button></div>`;
      document.body.appendChild(overlay);
      $("choose-keeper-replacement").onclick = () => showWonKeeperReplacementList(player);
      $("sell-won-keeper").onclick = () => finishWonKeeperAsSale(player);
      $("close-keeper-choice").onclick = () => overlay.remove();
    }

    function showWonKeeperReplacementList(player) {
      const dialog = $("star-keeper-choice"), club = guestProgress.club;
      if (!dialog || !club) return;
      const players = [...club.starters.map((name, index) => ({ name, area: "starter", index })),
        ...club.bench.map((name, index) => ({ name, area: "bench", index }))]
        .filter(slot => slot.name).map(slot => ({ ...slot, player: P.find(item => item.n === slot.name) }))
        .filter(slot => slot.player && playerMarketValue(slot.player) > 0 && canPlayerUseSlot(player.n, slot));
      dialog.innerHTML = `<div class="pick-dialog" role="dialog" aria-modal="true">
        <div class="pick-dialog-title">اختار لاعبًا للاستبدال</div><p class="note">اللاعب القديم هيتباع بسعر السوق كاملًا.</p>
        ${players.length ? "" : `<p class="note">مفيش خانة مناسبة للاستبدال؛ تقدر تبيع اللاعب الفائز.</p>`}
        <div class="rows">${players.map(slot => `<button class="row" data-keeper-replace-area="${slot.area}" data-keeper-replace-index="${slot.index}"><span class="n">${esc(slot.player.n)} · ${slot.player.r}</span><span class="v">بيع ${formatCoins(playerMarketValue(slot.player))} 🪙</span></button>`).join("")}</div>
        <button class="btn g w mt" id="back-keeper-choice">رجوع</button></div>`;
      $("back-keeper-choice").onclick = () => showWonKeeperChoice(player);
      dialog.querySelectorAll("[data-keeper-replace-area]").forEach(button => button.onclick = () =>
        replaceClubPlayerWithWonKeeper(player, button.dataset.keeperReplaceArea, Number(button.dataset.keeperReplaceIndex)));
    }

    function starKeeperCoverHTML() {
      const club = guestProgress.club ? [...guestProgress.club.starters, ...guestProgress.club.bench].filter(Boolean) : [];
      return `<div class="star-keeper-cover">${["Peter Schmeichel", "Jan Oblak", "David Raya"].map(name => P.find(p => p.n === name)).filter(Boolean)
        .sort((a, b) => b.r - a.r).map(player => `<div class="star-keeper-cover-card ${starKeeperWonPlayers.includes(player.n) || club.includes(player.n) ? "is-owned" : ""}">${cardHTML(player, "pack-player-card")}</div>`).join("")}</div>`;
    }

    function screenPacks() {
      _origPush(() => screenPacks());
      ensureStarKeeperPack();
      app.innerHTML = `<div class="hdr"><div class="l"><span class="pos">الحزم</span><span class="cnt">${freePackChances} فرصة فتح متاحة</span></div><button class="btn g sm" id="bk">رجوع</button></div>
        <button class="star-keeper-pack-tile" id="open-star-keeper-pack"><span class="star-keeper-pack-tile-copy"><b>حزمة حارس نجم</b><small>11 حارسًا · ${freePackChances} فرصة فتح</small><small>3 حراس مميزون و8 حراس تقييمهم أقل من 83</small></span>${starKeeperCoverHTML()}</button>`;
      $("bk").onclick = screenHome;
      $("open-star-keeper-pack").onclick = screenStarKeeperPackDetails;
    }

    async function animateStarKeeperPackOpening(winnerName) {
      const cards = Array.from(app.querySelectorAll(".keeper-pack-row:not(.is-owned)"));
      const winnerIndex = cards.findIndex(card => card.dataset.playerName === winnerName);
      if (!cards.length || winnerIndex < 0) return;
      const loops = cards.length * 3;
      const steps = loops + ((winnerIndex - ((loops - 1) % cards.length) + cards.length) % cards.length);
      for (let step = 0; step < steps; step++) {
        cards.forEach(card => card.classList.remove("opening-highlight"));
        const card = cards[step % cards.length];
        card.classList.add("opening-highlight");
        const rect = card.getBoundingClientRect();
        if (rect.top < 72 || rect.bottom > window.innerHeight - 56) card.scrollIntoView({ behavior: "smooth", block: "center" });
        const easing = Math.max(0, step - Math.floor(steps * .52));
        await new Promise(resolve => setTimeout(resolve, Math.min(360, 48 + Math.pow(easing, 1.55) * 1.5)));
      }
      cards.forEach(card => card.classList.remove("opening-highlight"));
      cards[winnerIndex].classList.add("is-winner");
    }

    function screenStarKeeperPackDetails() {
      _origPush(() => screenStarKeeperPackDetails());
      const packPlayers = ensureStarKeeperPack();
      processPendingStarKeeperPlayers();
      const available = availableStarKeeperPlayers(packPlayers);
      const pending = starKeeperPendingPlayers.map(name => P.find(player => player.n === name)).find(Boolean);
      const clubPlayers = guestProgress.club ? [...guestProgress.club.starters, ...guestProgress.club.bench].filter(Boolean) : [];
      app.innerHTML = `<div class="hdr"><div class="l"><span class="pos">حزمة حارس نجم</span><span class="cnt">11 حارسًا · <span id="keeper-opening-count">${freePackChances}</span> فرصة فتح</span></div><button class="btn g sm" id="bk">رجوع</button></div>
        ${pending ? `<div class="star-keeper-winner">${guestProgress.club ? `اختار مكانًا لـ${esc(pending.n)} أو بِعه بسعر السوق.` : `${esc(pending.n)} محفوظ وسيضاف لتشكيلتك بعد اختيارها.`}<button class="btn g w mt-s" id="manage-pending-keeper">التصرف في اللاعب الفائز</button></div>` : ""}
        <div class="sec-title">اللاعبون داخل الحزمة · ${packPlayers.length}</div>
        <div class="keeper-pack-list">${packPlayers.map((player, index) => { const owned = starKeeperWonPlayers.includes(player.n) || clubPlayers.includes(player.n); const tag = starKeeperWonPlayers.includes(player.n) ? "فزت به" : owned ? "في تشكيلتك" : ""; return `<div class="keeper-pack-row ${owned ? "is-owned" : ""}" data-pack-index="${index}" data-player-name="${esc(player.n)}">${cardHTML(player, "pack-player-card")}${tag ? `<span class="keeper-pack-owned-tag">${tag}</span>` : ""}</div>` }).join("")}</div>
        <button class="btn ${freePackChances > 0 && available.length ? "" : "g"} w mt" id="buy-star-keeper-pack" ${freePackChances > 0 && available.length ? "" : "disabled"}>${!available.length ? "تم جمع كل لاعبي الحزمة" : freePackChances > 0 ? `فتح الحزمة مجانًا · ${freePackChances} فرصة` : "لا توجد فرص فتح"}</button>`;
      $("bk").onclick = screenPacks;
      if ($("manage-pending-keeper")) $("manage-pending-keeper").onclick = () => {
        if (!guestProgress.club) return screenClubFormations();
        const status = addWonKeeperToClub(pending);
        if (status === "added" || status === "already-owned") return screenStarKeeperPackDetails();
        if (status === "full") return showWonKeeperChoice(pending);
      };
      $("buy-star-keeper-pack").onclick = async event => {
        const eligible = availableStarKeeperPlayers(packPlayers);
        if (!freePackChances || !eligible.length) return;
        const button = event.currentTarget, back = $("bk");
        button.disabled = true; if (back) back.disabled = true;
        freePackChances--;
        starKeeperPackOpened = true;
        const winner = eligible[Math.floor(Math.random() * eligible.length)];
        starKeeperPackWinner = winner.n;
        if (!starKeeperWonPlayers.includes(winner.n)) starKeeperWonPlayers.push(winner.n);
        if (!starKeeperPendingPlayers.includes(winner.n)) starKeeperPendingPlayers.push(winner.n);
        saveStarKeeperPlayerClaims(); savePackChances();
        try { localStorage.setItem(STAR_KEEPER_PACK_OPENED_KEY, "true"); localStorage.setItem(STAR_KEEPER_PACK_WINNER_KEY, winner.n) } catch (_) { }
        const count = $("keeper-opening-count"); if (count) count.textContent = String(freePackChances);
        button.textContent = "جاري فتح الحزمة…";
        await animateStarKeeperPackOpening(winner.n);
        const winnerCard = Array.from(app.querySelectorAll(".keeper-pack-row")).find(card => card.dataset.playerName === winner.n);
        if (winnerCard) { winnerCard.classList.add("is-owned"); winnerCard.insertAdjacentHTML("beforeend", `<span class="keeper-pack-owned-tag">فزت به</span>`) }
        const result = addWonKeeperToClub(winner);
        const remaining = availableStarKeeperPlayers(packPlayers).length;
        button.disabled = !freePackChances || !remaining;
        button.classList.toggle("g", button.disabled);
        button.textContent = !remaining ? "تم جمع كل لاعبي الحزمة" : freePackChances ? `فتح الحزمة مجانًا · ${freePackChances} فرصة` : "لا توجد فرص فتح";
        if (back) back.disabled = false;
        if (result === "full") showWonKeeperChoice(winner);
        else if (result === "added") toast(`كسبت ${winner.n} واتضاف للتشكيلة مجانًا`);
        else if (result === "no-club") toast(`كسبت ${winner.n} · اختار تشكيلتك عشان يتضاف`);
        else if (result === "save-failed") toast("كسبت اللاعب، لكن تعذر حفظ إضافته للتشكيلة");
        else toast(`كسبت ${winner.n}`);
      };
    }

    function startTournamentMatch() {
      if (!activeTournament || !tournamentTeam) return screenEvents();
      const team = tournamentTeam.team.slice(), formation = tournamentTeam.formation;
      cancelGameTimers(); resetOpponent();
      OPP = aiClubTeam(STAR_KEEPER_COMPUTER_LEVEL);
      OPP.avg = OPP.baseAvg = 89;
      opponentFormation = OPP.formation;
      OPP.seed = Math.floor(Math.random() * 0x100000000);
      S = { i: 11, team, bench: tournamentTeam.bench || Array(12).fill(null), used: new Set(team.map(player => player.n)), pool: [], shown: new Set(), sw: 0,
        phase: "match", sel: null, formation, slots: formationSlots(formation), roles: formationRoleSlots(formation),
        coach: tournamentTeam.coach, coachPool: [], coachShown: new Set(), coachSwap: 0, mode: "ai", entry: "event",
        matchSeed: Math.floor(Math.random() * 0x100000000) };
      eventTournamentRoundLabel = ["ربع النهائي", "نصف النهائي", "النهائي"][activeTournament.round - 1];
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
        activeTournament = tournamentTeam = tournamentResult = null;
        saveTournamentProgress();
        starKeeperCupWon = true;
        if (!starKeeperCupOpeningGranted) {
          starKeeperCupOpeningGranted = true; freePackChances++;
          try { localStorage.setItem(STAR_KEEPER_CUP_WON_KEY, "true"); localStorage.setItem(STAR_KEEPER_CUP_OPENING_GRANTED_KEY, "true") } catch (_) { }
          savePackChances();
          return screenPacks();
        }
        try { localStorage.setItem(STAR_KEEPER_CUP_WON_KEY, "true") } catch (_) { }
        screenEvents(); toast("كسبت البطولة · المكافأة اتاخدت قبل كده"); return;
      }
      activeTournament.round++; tournamentResult = null;
      saveTournamentProgress();
      toast(`تأهلت إلى ${["ربع النهائي", "نصف النهائي", "النهائي"][activeTournament.round - 1]}`);
      startTournamentMatch();
    }

    function screenDraftModes() {
      _origPush(screenDraftModes);
      app.innerHTML = `
  <main class="play-menu">
    <header class="hdr"><div class="l"><span class="pos">دريفت الكروت</span><span class="cnt">اختار الوقت وطريقة المنافسة</span></div><button class="btn g sm" id="bk">رجوع</button></header>
    <section class="draft-menu" aria-label="إعدادات الدريفت">
      <header class="draft-menu-head"><span class="play-mode-icon">⏱️</span><span><b>وقت كل اختيار</b><small>تقدر تغيّره قبل كل جولة</small></span></header>
      <div class="timer-options">${[15, 30, 45].map(s => `<button class="btn ${s === TM ? "" : "g"} sm" data-t="${s}" aria-pressed="${s === TM}">${s} ثانية</button>`).join("")}</div>
    </section>
    <button class="play-club-card" id="mAi"><span class="play-mode-icon">🤖</span><span class="play-mode-copy"><b>ضد الكمبيوتر</b><small>ابدأ دريفت فردي</small></span><span class="play-mode-arrow">‹</span></button>
    <button class="play-club-card secondary" id="mRoom"><span class="play-mode-icon">👥</span><span class="play-mode-copy"><b>العب مع صاحبك</b><small>اعمل غرفة وابعتله الكود</small></span><span class="play-mode-arrow">‹</span></button>
    <button class="play-club-card secondary" id="mOn"><span class="play-mode-icon">🌐</span><span class="play-mode-copy"><b>أونلاين</b><small>قابل لاعب عشوائي</small></span><span class="play-mode-arrow">‹</span></button>
  </main>`;
      $("bk").onclick = screenModes;
      app.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { TM = +b.dataset.t; screenDraftModes() });
      $("mAi").onclick = () => screenFormations(startAIGame);
      $("mRoom").onclick = () => screenFormations(screenRoom);
      $("mOn").onclick = () => screenFormations(() => hostRoom("lobby", true));
    }

    function screenClubModes() {
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

      const team = club.starters.map(name => P.find(player => player.n === name));
      const bench = club.bench.map(name => name ? P.find(player => player.n === name) : null);
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
      _origPush(() => screenFormations(onContinue));
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
      _origPush(() => screenRoom(gameType));
      const isClubMatch = gameType === "club";
      const returnScreen = isClubMatch ? screenClubModes : screenModes;
      app.innerHTML = `
  <div class="hdr"><div class="l"><span class="pos">${isClubMatch ? "مباراة تشكيلتي مع صاحبك" : "غرفة مع صاحبك"}</span><span class="cnt">كود من 4 حروف</span></div>
  <button class="btn g sm" id="bk">رجوع</button></div>
  <button class="mode primary" id="mk">
    <div class="ic">➕</div>
    <div class="tx"><b>اعمل غرفة جديدة</b><small>هيطلعلك كود تبعته لصاحبك</small></div>
    <div class="arw">‹</div>
  </button>
  <div class="sec-title">أو ادخل بكود</div>
  <input class="input" id="cd" placeholder="كود الغرفة" maxlength="4" inputmode="latin" autocomplete="off" autocapitalize="characters" spellcheck="false">
  <button class="btn w mt-s" id="jn">ادخل الغرفة</button>`;
      $("bk").onclick = returnScreen;
      $("mk").onclick = () => {
        if (isClubMatch && !getClubMatchSetup()) return;
        hostRoom(Math.random().toString(36).slice(2, 6), false, gameType);
      };
      $("jn").onclick = () => {
        const c = ($("cd").value || "").trim().toLowerCase();
        if (c.length !== 4) return toast("الكود 4 حروف");
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


