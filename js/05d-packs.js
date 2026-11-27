/* ================= SCREENS · 05d-packs.js ================= */
    function tournamentProgressState(eventId) {
      if (activeTournament && activeTournament.event === eventId) {
        return { activeTournament, tournamentResult };
      }
      return savedTournamentStates[eventId] || null;
    }

    function tournamentTileHTML(eventId) {
      const config = EVENT_TOURNAMENTS[eventId];
      const flags = tournamentFlags[eventId] || {};
      const state = tournamentProgressState(eventId);
      const stage = state && state.activeTournament ? TOURNAMENT_ROUND_LABELS[Math.max(0, state.activeTournament.round - 1)] : null;
      const inProgress = !!(state && state.activeTournament);
      const icon = flags.won ? "🏆" : inProgress ? "▶️" : config.icon;
      const title = flags.won
        ? `العب ${config.name} مرة أخرى`
        : inProgress
          ? `استكمال البطولة · ${stage || "تجهيز الفريق"}`
          : `ابدأ ${config.name}`;
      const note = flags.won
        ? `${config.computerLabel} · المكافأة اتاخدت قبل كده`
        : inProgress
          ? `كمّل التحدي · ${config.computerLabel}`
          : `${config.computerLabel} · اربح فرصة فتح مجانية`;
      return `<button class="play-club-card" data-event="${eventId}"><span class="play-mode-icon">${icon}</span><span class="play-mode-copy"><b>${title}</b><small>${note}</small></span><span class="play-mode-arrow">‹</span></button>`;
    }

    function screenEvents() {
      _origPush(screenEvents);
      app.innerHTML = `
  <main class="play-menu">
    <header class="hdr"><div class="l"><span class="pos">الأحداث والبطولات</span><span class="cnt">بطولات إقصائية ضد الكمبيوتر · اربح فرص فتح</span></div><button class="btn g sm" id="bk">رجوع</button></header>
    ${Object.keys(EVENT_TOURNAMENTS).map(tournamentTileHTML).join("")}
  </main>`;
      $("bk").onclick = screenModes;
      app.querySelectorAll("[data-event]").forEach(button => button.onclick = () => startEventTournament(button.dataset.event));
    }

    function startEventTournament(eventId) {
      if (!activateTournament(eventId)) return;
      try {
        if (tournamentResult) return continueTournament();
        if (tournamentTeam) return startTournamentMatch();
        if (!activeTournament) {
          const setup = getClubMatchSetup(true, true);
          if (!setup) return;
          activeTournament = { round: 1, total: 3, event: eventId };
          tournamentTeam = { team: setup.team, bench: setup.bench, formation: setup.club.formation, coach: setup.coach };
          tournamentResult = null;
          eventTournamentRoundLabel = TOURNAMENT_ROUND_LABELS[0];
          saveTournamentProgress();
        }
        return startTournamentMatch();
      } catch (error) {
        console.error("Could not start tournament.", error);
        toast("حصل خطأ أثناء بدء البطولة · راجع التشكيلة وحاول مرة تانية");
      }
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
        const player = findPlayer(name);
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
      const oldPlayer = oldName && findPlayer(oldName);
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
        .filter(slot => slot.name).map(slot => ({ ...slot, player: findPlayer(slot.name) }))
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
      return `<div class="star-keeper-cover">${["Peter Schmeichel", "Jan Oblak", "David Raya"].map(name => findPlayer(name)).filter(Boolean)
        .sort((a, b) => b.r - a.r).map(player => `<div class="star-keeper-cover-card ${starKeeperWonPlayers.includes(player.n) || club.includes(player.n) ? "is-owned" : ""}">${cardHTML(player, "pack-player-card")}</div>`).join("")}</div>`;
    }

    let packsLoadPromise = null;
    function loadPacks() {
      if (window.GG_PACKS) return Promise.resolve(window.GG_PACKS);
      if (!packsLoadPromise) {
        packsLoadPromise = new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = `./packs/gg-packs.js?v=${typeof V !== "undefined" ? V : Date.now()}`;
          script.onload = () => {
            if (window.assetManager && typeof window.assetManager.addPackArt === "function") window.assetManager.addPackArt();
            resolve(window.GG_PACKS || {});
          };
          script.onerror = () => { packsLoadPromise = null; reject(new Error("Pack file failed to load")) };
          document.head.appendChild(script);
        });
      }
      return packsLoadPromise;
    }

    function validPack(pack) {
      return !!pack && typeof pack.id === "string" && !!pack.id && typeof pack.name === "string" &&
        Array.isArray(pack.players) && pack.players.length > 0 &&
        pack.players.every(player => validPackPlayer(player, player && player.n)) &&
        new Set(pack.players.map(player => player.n)).size === pack.players.length;
    }

    function currentPack(packId) {
      const pack = window.GG_PACKS && window.GG_PACKS[packId];
      return validPack(pack) ? pack : null;
    }

    function packCoverHTML(pack) {
      const owned = guestProgress.club ? [...guestProgress.club.starters, ...guestProgress.club.bench].filter(Boolean) : [];
      return `<div class="star-keeper-cover">${pack.players.slice().sort((a, b) => b.r - a.r).slice(0, 3)
        .map(player => `<div class="star-keeper-cover-card ${packWonName(pack.id, player.n) || owned.includes(player.n) ? "is-owned" : ""}">${cardHTML(player, "pack-player-card")}</div>`).join("")}</div>`;
    }

    function renderPacksScreen() {
      ensureStarKeeperPack();
      processPendingPackPlayers();
      const packs = Object.values(window.GG_PACKS || {}).filter(validPack);
      app.innerHTML = `<div class="hdr"><div class="l"><span class="pos">الحزم</span><span class="cnt">${freePackChances} فرصة فتح متاحة</span></div><button class="btn g sm" id="bk">رجوع</button></div>
        <button class="star-keeper-pack-tile" id="open-star-keeper-pack"><span class="star-keeper-pack-tile-copy"><b>حزمة حارس نجم</b><small>11 حارسًا · ${freePackChances} فرصة فتح</small><small>3 حراس مميزون و8 حراس تقييمهم أقل من 83</small></span>${starKeeperCoverHTML()}</button>
        ${packs.map(pack => `<button class="star-keeper-pack-tile" data-open-pack="${esc(pack.id)}"><span class="star-keeper-pack-tile-copy"><b>${esc(pack.name)}</b><small>${esc(pack.subtitle || `${pack.players.length} لاعب`)} · ${freePackChances} فرصة فتح</small></span>${packCoverHTML(pack)}</button>`).join("")}`;
      $("bk").onclick = screenHome;
      $("open-star-keeper-pack").onclick = screenStarKeeperPackDetails;
      app.querySelectorAll("[data-open-pack]").forEach(button => button.onclick = () => screenPackDetails(button.dataset.openPack));
    }

    function screenPacks() {
      _origPush(() => screenPacks(), "packs");
      if (!window.GG_PACKS) {
        app.innerHTML = `<div class="hdr"><div class="l"><span class="pos">الحزم</span><span class="cnt">بنجهز الحزم…</span></div><button class="btn g sm" id="bk">رجوع</button></div><p class="note">بنحمّل ملف الحزم…</p>`;
        $("bk").onclick = screenHome;
        loadPacks().then(renderPacksScreen).catch(error => {
          console.warn("Could not load packs.", error);
          renderPacksScreen();
          toast("تعذر تحميل الحزم — جرّب تاني");
        });
        return;
      }
      renderPacksScreen();
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
      _origPush(() => screenStarKeeperPackDetails(), "star-keeper-pack");
      const packPlayers = ensureStarKeeperPack();
      processPendingStarKeeperPlayers();
      const available = availableStarKeeperPlayers(packPlayers);
      const pending = starKeeperPendingPlayers.map(name => findPlayer(name)).find(Boolean);
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

    function packEligiblePlayers(pack) {
      const inClub = guestProgress.club ? [...guestProgress.club.starters, ...guestProgress.club.bench].filter(Boolean) : [];
      return pack.players.filter(player => !packWonName(pack.id, player.n) && !inClub.includes(player.n));
    }

    function addPackPlayerToClub(player) {
      const club = guestProgress.club;
      if (!club) return "no-club";
      const owned = [...club.starters, ...club.bench].filter(Boolean);
      if (owned.includes(player.n)) { clearPackPending(player.n); return "already-owned" }
      const slot = findPlayerSlot(player, null);
      if (!slot) return "full";
      const previous = snapshotClubProgress();
      club[slot.key][slot.index] = player.n;
      club.assetCosts.players[player.n] = 0;
      if (!commitClubProgress(previous)) return "save-failed";
      clearPackPending(player.n);
      return "added";
    }

    function processPendingPackPlayers() {
      if (!guestProgress.club || !packPending.length) return;
      for (const entry of packPending.slice()) {
        const player = findPlayer(entry.n);
        if (!player) { clearPackPending(entry.n); continue }
        if (addPackPlayerToClub(player) === "full") break;
      }
    }

    function screenPackDetails(packId) {
      const pack = currentPack(packId);
      if (!pack) { toast("الحزمة غير متاحة"); return screenPacks() }
      _origPush(() => screenPackDetails(packId), "pack-" + packId);
      processPendingPackPlayers();
      const available = packEligiblePlayers(pack);
      const sortedPlayers = pack.players.slice().sort((a, b) => b.r - a.r);
      const pending = pendingPackPlayers(packId)[0];
      const clubPlayers = guestProgress.club ? [...guestProgress.club.starters, ...guestProgress.club.bench].filter(Boolean) : [];
      app.innerHTML = `<div class="hdr"><div class="l"><span class="pos">${esc(pack.name)}</span><span class="cnt">${pack.players.length} لاعب · <span id="pack-opening-count">${freePackChances}</span> فرصة فتح</span></div><button class="btn g sm" id="bk">رجوع</button></div>
        ${pending ? `<div class="star-keeper-winner">${guestProgress.club ? `اختار مكانًا لـ${esc(pending.n)} أو بِعه بسعر السوق.` : `${esc(pending.n)} محفوظ وسيضاف لتشكيلتك بعد اختيارها.`}<button class="btn g w mt-s" id="manage-pending-pack">التصرف في اللاعب الفائز</button></div>` : ""}
        <div class="sec-title">اللاعبون داخل الحزمة · ${pack.players.length}</div>
        <div class="keeper-pack-list">${sortedPlayers.map((player, index) => {
          const won = packWonName(pack.id, player.n);
          const owned = won || clubPlayers.includes(player.n);
          const tag = won ? "فزت به" : owned ? "في تشكيلتك" : "";
          return `<div class="keeper-pack-row ${owned ? "is-owned" : ""}" data-pack-index="${index}" data-player-name="${esc(player.n)}">${cardHTML(player, "pack-player-card")}${tag ? `<span class="keeper-pack-owned-tag">${tag}</span>` : ""}</div>`;
        }).join("")}</div>
        <button class="btn ${freePackChances > 0 && available.length ? "" : "g"} w mt" id="open-pack" ${freePackChances > 0 && available.length ? "" : "disabled"}>${!available.length ? "تم جمع كل لاعبي الحزمة" : freePackChances > 0 ? `فتح الحزمة مجانًا · ${freePackChances} فرصة` : "لا توجد فرص فتح"}</button>`;
      $("bk").onclick = screenPacks;
      if ($("manage-pending-pack")) $("manage-pending-pack").onclick = () => {
        if (!guestProgress.club) return screenClubFormations();
        const status = addPackPlayerToClub(pending);
        if (status === "added" || status === "already-owned") return screenPackDetails(packId);
        if (status === "full") return showPackPlayerChoice(pending, packId);
      };
      $("open-pack").onclick = async event => {
        const eligible = packEligiblePlayers(pack);
        if (!freePackChances || !eligible.length) return;
        const button = event.currentTarget, back = $("bk");
        button.disabled = true; if (back) back.disabled = true;
        const winner = eligible[Math.floor(Math.random() * eligible.length)];
        freePackChances--;
        if (!claimPackPlayer(pack.id, winner)) {
          freePackChances++; savePackChances();
          button.disabled = false; if (back) back.disabled = false;
          return toast("تعذر حفظ اللاعب — جرّب تاني");
        }
        setPackPending(pack.id, winner.n, true);
        savePackChances();
        const count = $("pack-opening-count"); if (count) count.textContent = String(freePackChances);
        button.textContent = "جاري فتح الحزمة…";
        await animateStarKeeperPackOpening(winner.n);
        const winnerCard = Array.from(app.querySelectorAll(".keeper-pack-row")).find(card => card.dataset.playerName === winner.n);
        if (winnerCard) { winnerCard.classList.add("is-owned"); winnerCard.insertAdjacentHTML("beforeend", `<span class="keeper-pack-owned-tag">فزت به</span>`) }
        const result = addPackPlayerToClub(winner);
        const remaining = packEligiblePlayers(pack).length;
        button.disabled = !freePackChances || !remaining;
        button.classList.toggle("g", button.disabled);
        button.textContent = !remaining ? "تم جمع كل لاعبي الحزمة" : freePackChances ? `فتح الحزمة مجانًا · ${freePackChances} فرصة` : "لا توجد فرص فتح";
        if (back) back.disabled = false;
        if (result === "full") showPackPlayerChoice(winner, pack.id);
        else if (result === "added") toast(`كسبت ${winner.n} واتضاف للتشكيلة مجانًا`);
        else if (result === "no-club") toast(`كسبت ${winner.n} · اختار تشكيلتك عشان يتضاف`);
        else if (result === "save-failed") toast("كسبت اللاعب، لكن تعذر حفظ إضافته للتشكيلة");
        else toast(`كسبت ${winner.n}`);
      };
    }

    function finishPackPlayerAsSale(player, packId) {
      const value = playerMarketValue(player);
      if (!value) return toast("سعر السوق للاعب ده غير متاح");
      const previous = guestProgress.coins;
      guestProgress.coins = Math.min(Number.MAX_SAFE_INTEGER, guestProgress.coins + value);
      if (!saveGuestProgress()) { guestProgress.coins = previous; return }
      clearPackPending(player.n);
      document.getElementById("pack-player-choice")?.remove();
      toast(`تم بيع ${player.n} بسعر السوق · ${formatCoins(value)} 🪙`);
      screenPackDetails(packId);
    }

    function replaceClubPlayerWithPackPlayer(player, area, index, packId) {
      const club = guestProgress.club;
      const key = area === "starter" ? "starters" : "bench";
      const oldName = club && club[key][index];
      const oldPlayer = oldName && findPlayer(oldName);
      if (!club || !oldPlayer || !canPlayerUseSlot(player.n, { area, index })) return toast("اختار مكان مناسب");
      const value = playerMarketValue(oldPlayer);
      if (!value) return toast("سعر السوق للاعب المحدد غير متاح");
      if (guestProgress.coins > Number.MAX_SAFE_INTEGER - value) return toast("رصيدك وصل للحد الأقصى للكوينز");
      const previous = snapshotClubProgress();
      guestProgress.coins += value;
      delete club.assetCosts.players[oldName];
      club[key][index] = player.n;
      club.assetCosts.players[player.n] = 0;
      if (!commitClubProgress(previous)) return;
      clearPackPending(player.n);
      document.getElementById("pack-player-choice")?.remove();
      toast(`تمت إضافة ${player.n} وبيع ${oldName} بسعر السوق · ${formatCoins(value)} 🪙`);
      screenPackDetails(packId);
    }

    function showPackPlayerReplacementList(player, packId) {
      const dialog = $("pack-player-choice"), club = guestProgress.club;
      if (!dialog || !club) return;
      const players = [...club.starters.map((name, index) => ({ name, area: "starter", index })),
        ...club.bench.map((name, index) => ({ name, area: "bench", index }))]
        .filter(slot => slot.name).map(slot => ({ ...slot, player: findPlayer(slot.name) }))
        .filter(slot => slot.player && playerMarketValue(slot.player) > 0 && canPlayerUseSlot(player.n, slot));
      dialog.innerHTML = `<div class="pick-dialog" role="dialog" aria-modal="true">
        <div class="pick-dialog-title">اختار لاعبًا للاستبدال</div><p class="note">اللاعب القديم هيتباع بسعر السوق كاملًا.</p>
        ${players.length ? "" : `<p class="note">مفيش خانة مناسبة للاستبدال؛ تقدر تبيع اللاعب الفائز.</p>`}
        <div class="rows">${players.map(slot => `<button class="row" data-pack-replace-area="${slot.area}" data-pack-replace-index="${slot.index}"><span class="n">${esc(slot.player.n)} · ${slot.player.r}</span><span class="v">بيع ${formatCoins(playerMarketValue(slot.player))} 🪙</span></button>`).join("")}</div>
        <button class="btn g w mt" id="back-pack-choice">رجوع</button></div>`;
      $("back-pack-choice").onclick = () => showPackPlayerChoice(player, packId);
      dialog.querySelectorAll("[data-pack-replace-area]").forEach(button => button.onclick = () =>
        replaceClubPlayerWithPackPlayer(player, button.dataset.packReplaceArea, Number(button.dataset.packReplaceIndex), packId));
    }

    function showPackPlayerChoice(player, packId) {
      document.getElementById("pack-player-choice")?.remove();
      const overlay = document.createElement("div");
      overlay.id = "pack-player-choice";
      overlay.className = "pick-overlay sale-overlay";
      overlay.innerHTML = `<div class="pick-dialog" role="dialog" aria-modal="true">
        <div class="pick-dialog-title">كسبت ${esc(player.n)} · ${player.r}</div>
        <p class="note">تشكيلتك ممتلئة. استبدل لاعبًا وبِع القديم بسعر السوق، أو بِع اللاعب الفائز.</p>
        <button class="btn w" id="choose-pack-replacement">استبدال لاعب من التشكيلة</button>
        <button class="btn g w mt-s" id="sell-won-pack-player">بيع اللاعب الفائز · ${formatCoins(playerMarketValue(player))} 🪙</button>
        <button class="btn g w mt-s" id="close-pack-choice">لاحقًا</button></div>`;
      document.body.appendChild(overlay);
      $("choose-pack-replacement").onclick = () => showPackPlayerReplacementList(player, packId);
      $("sell-won-pack-player").onclick = () => finishPackPlayerAsSale(player, packId);
      $("close-pack-choice").onclick = () => overlay.remove();
    }
