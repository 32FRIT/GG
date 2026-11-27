/* ================= SCREENS · 05b-club.js ================= */
    function openMarket(position, target, returnTo) {
      selectedSquadSlot = null;
      marketContext = { position: position === "ANY" ? "ALL" : position, roles: [], target, returnTo, query: "", ratingMin: "", ratingMax: "", priceMin: "", priceMax: "", filtersOpen: false, searchOpen: false };
      screenMarket();
    }

    function screenClubFormations() {
      _origPush(screenClubFormations);
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
            const player = findPlayer(name);
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
        .map(name => findPlayer(name))
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
      _origPush(screenOwnedClubFormations);
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

    function squadOverallInfo(club) {
      const clubPlayers = club.starters.map(name => name && findPlayer(name)).filter(Boolean);
      const coach = COACHES.find(item => item.n === club.coach);
      const baseRating = clubPlayers.length === 11
        ? lineupBaseRating(clubPlayers, club.formation)
        : null;
      const overall = baseRating === null
        ? null
        : coach ? coachAdjustedPower(baseRating, coach) : baseRating;
      return {
        overall,
        details: `${clubPlayers.length}/11 لاعبين · ${coach ? `مدرب ${coach.n}` : "بدون مدرب"}`
      };
    }

    function squadPitchHTML(club, overlayHTML) {
      const formation = formationById(club.formation);
      const slots = formationSlots(formation.id);
      const roles = formationRoleSlots(formation.id);
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
          const player = name && findPlayer(name);
          const selected = selectedSquadSlot && selectedSquadSlot.area === "starter" && selectedSquadSlot.index === index;
          const role = roles[index];
          const warn = player && role && !playsRole(player, role);
          return `<button class="pitch-player squad-slot ${player ? "has-player-card" : "empty"} ${selected ? "selected" : ""}"
            data-squad-slot="starter" data-index="${index}" data-position="${position}" aria-pressed="${!!selected}"
            aria-label="${player ? `اختيار ${esc(player.n)}` : `إضافة ${POS_NAME[role]}`}">
            ${player ? cardHTML(player, "squad-player-card") : emptySlotCardHTML(role)}
            ${player && role ? `<span class="match-role-tag${warn ? " warn" : ""}" dir="ltr" aria-hidden="true"><i>${POS_SHORT[role] || role}</i><b>${warn ? "!" : "◆"}</b></span>` : ""}
          </button>`;
        }).join("");
        return `<div class="pitch-row">${players}</div>`;
      }).join("");
      return `<div class="pitch squad-pitch" style="--rows:${formation.lines.length};--cols:${Math.max(...formation.lines.map(line => line[1]))}">${overlayHTML || ""}${rows}</div>`;
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
      const player = findPlayer(playerName);
      return !!player && (requiredRole ? playsRole(player, requiredRole) : !requiredPosition || playsGroup(player, requiredPosition));
    }

    function firstEmptySquadSlot(area, playerName) {
      const slots = area === "starter"
        ? formationSlots(guestProgress.club.formation)
        : BENCH_SLOT_POSITIONS;
      const occupied = guestProgress.club[area === "starter" ? "starters" : "bench"];
      const player = findPlayer(playerName);
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
        .map((name, index) => ({ player: name && findPlayer(name), index }))
        .filter(item => item.player && canPlayerUseSlot(item.player.n, target));
    }

    function screenReserveChoices(target) {
      _origPush(screenReserveChoices);
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
      const player = findPlayer(playerName);
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
      const player = findPlayer(playerName);
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
            <span>OVR ${player.r}</span>
          </div>
        </div>
        <p class="squad-selection-hint">اضغط على لاعب آخر للتبديل</p>
        <div class="squad-action-buttons">
          <button class="btn" id="auto-squad-move" ${hasTarget ? "" : "disabled"}>${slot.area === "starter" ? "نقل للاحتياطي" : "نقل للأساسي"}</button>
          <button class="btn g" id="swap-selected-player">استبدال</button>
          ${saleValue ? `<button class="btn sell" id="sell-selected-player">بيع ${formatCoins(saleValue)} 🪙</button>` : ""}
          ${guestProgress.club.confirmed ? "" : `<button class="btn g" id="remove-draft-player">إزالة</button>`}
          <button class="btn g" id="cancel-squad-selection">إلغاء</button>
        </div>
      </section>`;
    }

    function screenMyTeam() {
      if (!guestProgress.club) return screenClubFormations();
      processPendingStarKeeperPlayers();
      processPendingPackPlayers();
      if (selectedSquadSlot && selectedSquadSlot.area === "bench") showBench = true;
      _origPush(screenMyTeam);
      const club = guestProgress.club;
      const setupCost = club.confirmed ? null : clubSetupCostBreakdown(club);
      const { overall, details: ratingDetails } = squadOverallInfo(club);
      const selectionHTML = squadSelectionHTML();
      const benchHTML = showBench ? `<div class="bench-grid">
    ${BENCH_SLOT_POSITIONS.map((position, index) => {
        const name = club.bench[index];
        const player = name && findPlayer(name);
        const label = position ? `بديل ${POS_NAME[position]}` : "احتياطي مرن";
        const selected = selectedSquadSlot && selectedSquadSlot.area === "bench" && selectedSquadSlot.index === index;
        return `<button class="bench-slot ${player ? "owned-slot" : ""} ${selected ? "selected" : ""}"
          data-squad-slot="bench" data-index="${index}" data-position="${position || "ANY"}" aria-pressed="${!!selected}">
        ${player ? `<small>${label}</small>${cardHTML(player, "bench-player-card")}` : `${emptySlotCardHTML(position || "M")}`}
        </button>`;
      }).join("")}
  </div>` : "";
      const pitchOverlay = `<div class="squad-topline">
      <button class="squad-back" id="bk" type="button" aria-label="رجوع" title="رجوع">‹</button>
      <div class="squad-overall" title="${esc(ratingDetails)}" aria-label="التقييم الكلي OVR: ${overall === null ? "غير متاح" : overall}">
        <b>${overall === null ? "—" : overall}</b><span>OVR</span>
      </div>
      <span aria-hidden="true"></span>
    </div>
    <div class="squad-substrip">
      <button class="btn g sm" id="team-market">السوق</button>
      <button class="btn g sm" id="change-club-formation">الخطة · <span dir="ltr">${formationById(club.formation).id}</span></button>
    </div>
    <div class="squad-pitch-actions">
      <button class="btn g sm" id="bench-toggle" aria-expanded="${showBench}">${showBench ? "إخفاء الاحتياطي" : "الاحتياطي · 12"}</button>
      <button class="btn g sm" id="club-coach" type="button">${club.coach ? esc(club.coach) : "＋ إضافة مدرب"}</button>
    </div>
    ${selectionHTML || benchHTML ? `<div class="squad-sheet">${selectionHTML}${benchHTML}</div>` : ""}`;
      app.innerHTML = `<div class="squad-screen">
  ${rematchContext ? `<button class="btn w" id="start-rematch-edit">${rematchContext.online ? "جاهز بعد التعديل · ابدأ مع صاحبك" : "ابدأ المباراة بالتشكيلة دي"}</button>` : ""}
  ${squadPitchHTML(club, pitchOverlay)}
  ${setupCost ? `<div class="setup-confirmation">
    <div class="setup-info">
      <b>تجهيز مجاني قبل التأكيد</b>
      <span>الإجمالي <strong>${formatCoins(setupCost.total)} 🪙</strong></span>
      ${guestProgress.coins < setupCost.total ? `<small>رصيدك ${formatCoins(guestProgress.coins)}؛ عدّل اختياراتك</small>` : ""}
    </div>
    <button class="btn w" id="confirm-club-setup">مراجعة وتأكيد</button>
  </div>` : ""}
  </div>
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
      const selectedBenchSlot = app.querySelector(".squad-sheet .bench-slot.selected");
      if (selectedBenchSlot) selectedBenchSlot.scrollIntoView({ inline: "center", block: "nearest" });
      if ($("cancel-squad-selection")) {
        $("cancel-squad-selection").onclick = () => { selectedSquadSlot = null; screenMyTeam() };
        $("auto-squad-move").onclick = moveSelectedPlayerBetweenSquadAreas;
        $("swap-selected-player").onclick = openSquadPlayerSwap;
        if ($("sell-selected-player")) {
          const selectedPlayer = findPlayer(squadSlotPlayer(selectedSquadSlot));
          $("sell-selected-player").onclick = () => sellOwnedSquadPlayer(selectedPlayer);
        }
        if ($("remove-draft-player")) $("remove-draft-player").onclick = removeDraftSquadPlayer;
      }
      $("club-coach").onclick = screenClubCoaches;
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
