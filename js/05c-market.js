/* ================= SCREENS · 05c-market.js ================= */
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
      _origPush(screenClubCoaches);
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
      _origPush(screenMarket);
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
      gameLive = false;
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
