/* ================= END ================= */
    function endGame() {
      cancelGameTimers();
      gameLive = true;
      if (S) S.phase = "match";
      const returnToModeMenu = S.entry === "club" ? screenClubModes : screenModes;
      const baseAvg = Math.round(S.team.reduce((a, t) => a + t.r, 0) / 11);
      const avg = coachAdjustedPower(baseAvg, S.coach);
      app.innerHTML = `
    <div id="match" class="mt"></div>
    <div class="rating-compare" id="rating-compare">
      <div class="rating-card">
        <div class="label">تقييم فريقك</div>
        <div class="value">${avg}</div>
        <small>${esc(S.coach.n)} · ${formationById(S.formation).id}</small>
      </div>
      <div class="rating-card opponent">
        <div class="label">تقييم الخصم</div>
        <div class="value">—</div>
        <small>مستني بيانات فريقه</small>
      </div>
    </div>
    <div class="sec-title">المدربين</div>
    <div class="coach-compare" id="coach-compare">
      <div class="coach-compare-item">
        <div class="coach-compare-title">مدربك · ${esc(S.coach.n)}</div>
        <div class="fcwrap">${coachCardHTML(S.coach, "win")}</div>
      </div>
      <div class="coach-compare-item">
        <div class="coach-compare-title">مدرب الخصم · في انتظار بياناته</div>
        <div class="fcwrap"><div class="fc back" aria-hidden="true"><span>؟</span></div></div>
      </div>
    </div>
    <p class="note">قوة اللاعبين ${baseAvg}، وتأثير المدرب ${coachMultiplier(S.coach).toFixed(3)}، فيصبح تقييم الفريق <b>${avg}</b>.</p>
    <div class="mt" style="display:flex;gap:10px">
      <button class="btn" id="again" style="flex:1" ${S.entry === "event" ? "disabled" : ""}>${S.entry === "event" ? `مباراة ${esc(eventTournamentRoundLabel)} جارية` : "إعادة المباراة"}</button>
      <button class="btn g" id="hm" style="flex:1">الرئيسية</button>
    </div>`;
      $("again").onclick = () => S && S.entry === "event" ? continueTournament() : showRematchChoices();
      $("hm").onclick = () => { clearMatchSkipState(); killNet(); screenHome() };
      runMatch(avg);
    }

    function showRematchChoices() {
      rematchLaunching = false;
      const isClub = S && S.entry === "club";
      // Keep the session's original mode: a dropped peer must never turn
      // an online rematch into two unrelated local matches.
      const online = !!(S && S.mode === "online");
      const overlay = document.createElement("div");
      overlay.className = "pick-overlay sale-overlay";
      overlay.innerHTML = `<div class="pick-dialog" role="dialog" aria-modal="true" aria-labelledby="rematch-title">
        <div class="pick-dialog-title" id="rematch-title">إعادة المباراة</div>
        <p>${online ? "اختاروا نفس الاختيار عشان تبدأ المباراة الجديدة عندكم" : "اختار طريقة اللعب من جديد"}</p>
        <div class="pick-actions">
          <button class="btn" type="button" data-rematch="same">بنفس التشكيلة</button>
          <button class="btn g" type="button" data-rematch="${isClub ? "edit" : "new"}">${isClub ? "تعديل التشكيلة" : "تشكيلة جديدة"}</button>
          <button class="btn g" type="button" data-rematch-cancel>إلغاء</button>
        </div></div>`;
      document.body.appendChild(overlay);
      overlay.querySelector("[data-rematch-cancel]").onclick = () => overlay.remove();
      overlay.querySelectorAll("[data-rematch]").forEach(button => button.onclick = () => {
        const action = button.dataset.rematch; overlay.remove();
        if (online) {
          if (!conn || !conn.open) return netFail("اتصال المباراة انقطع، ارجعوا للغرفة وحاولوا تاني", isClub ? screenClubModes : screenModes);
          // Do not clear rematchRemote here: the other player may have chosen
          // first while this device was still showing the result screen.
          rematchPending = action; rematchLaunching = false;
          try { conn.send({ t: "rematch-choice", action }) }
          catch (e) { return netFail("الاتصال بالخصم غير جاهز", isClub ? screenClubModes : screenModes) }
          toast("مستني اختيار صاحبك"); checkRematchAgreement();
        } else if (action === "same") launchSameLineupRematch();
        else if (isClub) { rematchContext = { online: false, difficulty: S.difficulty }; screenMyTeam() }
        else screenModes();
      });
    }

    function launchSameLineupRematch() {
      if (!S) return;
      const previous = S, club = previous.entry === "club";
      if (previous.mode === "online" && (!conn || !conn.open)) {
        return netFail("اتصال المباراة انقطع، مش هنبدأ مباراة منفصلة", club ? screenClubModes : screenModes);
      }
      if (club) return startClubMatch(previous.mode === "online" ? "online" : "ai", previous.difficulty);
      cancelGameTimers(); resetOpponent();
      S = { i: 11, team: previous.team.slice(), used: new Set(previous.team.map(player => player.n)), pool: [], shown: new Set(), sw: 0,
        phase: "match", sel: null, formation: previous.formation, slots: formationSlots(previous.formation), roles: formationRoleSlots(previous.formation),
        coach: previous.coach, coachPool: [], coachShown: new Set(), coachSwap: 0, mode: conn && conn.open ? "online" : "ai", entry: "draft",
        matchSeed: Math.floor(Math.random() * 0x100000000) };
      if (!(conn && conn.open)) {
        opponentFormation = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)].id;
        OPP = aiTeam(opponentFormation);
        OPP.seed = Math.floor(Math.random() * 0x100000000);
      }
      endGame();
    }

    function checkRematchAgreement() {
      if (rematchLaunching || !rematchPending || !rematchRemote || rematchPending !== rematchRemote) return;
      if (S && S.mode === "online" && (!conn || !conn.open)) {
        rematchPending = rematchRemote = null;
        rematchLaunching = false;
        return netFail("اتصال المباراة انقطع، ارجعوا للغرفة وحاولوا تاني", S.entry === "club" ? screenClubModes : screenModes);
      }
      rematchLaunching = true;
      const action = rematchPending;
      rematchPending = rematchRemote = null;
      const club = S && S.entry === "club";
      if (action === "ready" && club) { rematchContext = null; return startClubMatch("online"); }
      if (action === "same") return launchSameLineupRematch();
      if (action === "edit" && club) { rematchLaunching = false; rematchContext = { online: true }; return screenMyTeam(); }
      if (action === "new" && !club) return startGame();
    }

    function clearMatchSkipState() {
      activeMatchSkip = null;
      skipMatchProposalSent = false;
      skipMatchRemotePending = false;
      document.querySelectorAll("[data-match-skip-overlay]").forEach(overlay => overlay.remove());
    }

    function requestMatchSkip() {
      if (!activeMatchSkip) return;
      if (conn && conn.open) {
        if (skipMatchProposalSent) return toast("طلب التخطي اتبعت بالفعل");
        skipMatchProposalSent = true;
        try { conn.send({ t: "skip-request" }); toast("بعتّ لصاحبك طلب تخطي المباراة"); }
        catch (error) { skipMatchProposalSent = false; toast("تعذر إرسال طلب التخطي"); }
        return;
      }
      activeMatchSkip();
    }

    function handleMatchSkipMessage(message) {
      if (!message) return;
      if (message.t === "skip-request" && (!S || S.phase !== "match" || !activeMatchSkip)) {
        // The peer may have received the request before its match UI is ready.
        // Decline explicitly so the proposer can try again instead of getting stuck.
        try { conn && conn.open && conn.send({ t: "skip-decline" }); } catch (_) {}
        return;
      }
      if (!S || S.phase !== "match" || !activeMatchSkip) return;
      if (message.t === "skip-request") {
        if (skipMatchRemotePending) return;
        if (skipMatchProposalSent) {
          skipMatchProposalSent = false;
          try { conn && conn.open && conn.send({ t: "skip-accept" }); } catch (_) {}
          activeMatchSkip();
          return;
        }
        skipMatchRemotePending = true;
        const overlay = document.createElement("div");
        overlay.className = "pick-overlay sale-overlay";
        overlay.setAttribute("data-match-skip-overlay", "");
        overlay.innerHTML = `<div class="pick-dialog" role="dialog" aria-modal="true">
          <div class="pick-dialog-title">طلب تخطي المباراة</div>
          <p>صاحبك بيقترح تخطي المباراة والانتقال للنتيجة النهائية. توافق؟</p>
          <div class="pick-actions">
            <button class="btn" type="button" data-skip-accept>موافق</button>
            <button class="btn g" type="button" data-skip-decline>رفض</button>
          </div></div>`;
        document.body.appendChild(overlay);
        overlay.querySelector("[data-skip-accept]").onclick = () => {
          try { conn && conn.open && conn.send({ t: "skip-accept" }); } catch (_) {}
          overlay.remove(); skipMatchRemotePending = false;
          if (activeMatchSkip) activeMatchSkip();
        };
        overlay.querySelector("[data-skip-decline]").onclick = () => {
          try { conn && conn.open && conn.send({ t: "skip-decline" }); } catch (_) {}
          overlay.remove(); skipMatchRemotePending = false;
          toast("رفضت طلب تخطي المباراة");
        };
        return;
      }
      if (message.t === "skip-accept") {
        if (!skipMatchProposalSent) return;
        skipMatchProposalSent = false;
        toast("صاحبك وافق على تخطي المباراة");
        activeMatchSkip();
      } else if (message.t === "skip-decline") {
        if (!skipMatchProposalSent) return;
        skipMatchProposalSent = false;
        toast("صاحبك رفض تخطي المباراة");
      }
    }

    function runMatch(me) {
      const box = $("match"); if (!box) return;
      const matchState = S;
      const mt = {
        avg: me,
        baseAvg: Math.round(S.team.reduce((a, t) => a + t.r, 0) / 11),
        names: S.team.map(t => t.n),
        benchNames: Array.isArray(matchState.bench) ? matchState.bench.map(player => player ? player.n : null) : null,
        players: S.team.slice(),
        benchPlayers: Array.isArray(matchState.bench) ? matchState.bench.slice() : null,
        formation: S.formation,
        slots: S.slots,
        coach: S.coach,
        mode: S.mode,
        entry: S.entry,
        seed: S.matchSeed
      };
      if (conn && conn.open) {
        publishTeamResult(conn, {
          t: "team",
          avg: mt.avg,
          baseAvg: mt.baseAvg,
          names: mt.names,
          benchNames: mt.benchNames,
          players: mt.players,
          benchPlayers: mt.benchPlayers,
          formation: mt.formation,
          coach: mt.coach.n,
          seed: mt.seed
        });
      }

      const coaches = $("coach-compare");
      if (coaches) {
        coaches.innerHTML = `<div class="coach-compare-item">
        <div class="coach-compare-title">مدربك · ${esc(S.coach.n)}</div>
        <div class="fcwrap">${coachCardHTML(S.coach, "win")}</div>
      </div>
      <div class="coach-compare-item">
        <div class="coach-compare-title">${OPP ? `مدرب الخصم · ${esc(OPP.coach.n)}` : "مدرب الخصم · في انتظار بياناته"}</div>
        <div class="fcwrap">${OPP ? coachCardHTML(OPP.coach, "win") : `<div class="fc back" aria-hidden="true"><span>؟</span></div>`}</div>
      </div>`;
      }
      if (!OPP) {
        const comparison = $("rating-compare");
        if (comparison) {
          comparison.innerHTML = `<div class="rating-card">
        <div class="label">تقييم فريقك</div>
        <div class="value">${me}</div>
        <small>${esc(S.coach.n)} · ${formationById(S.formation).id}</small>
      </div>
      <div class="rating-card opponent">
        <div class="label">تقييم الخصم</div>
        <div class="value">—</div>
        <small>مستني الخصم يخلص فريقه</small>
      </div>`;
        }
        box.innerHTML = `<div class="rows"><div class="row"><span class="n">مستني الخصم يخلص فريقه...</span></div></div>`;
        window.__showOpp = () => { window.__showOpp = null; runMatch(me) };
        return;
      }
      const comparison = $("rating-compare");
      if (comparison) {
        comparison.innerHTML = `<div class="rating-card">
        <div class="label">تقييم فريقك</div>
        <div class="value">${me}</div>
        <small>${esc(S.coach.n)} · ${formationById(S.formation).id}</small>
      </div>
      <div class="rating-card opponent">
        <div class="label">تقييم الخصم</div>
        <div class="value">${OPP.avg}</div>
        <small>${esc(OPP.coach.n)} · ${formationById(OPP.formation).id}</small>
      </div>`;
      }
      const r = simulate(mt, OPP);
      const evs = r.ev.map(e => ({ ...e, me: (e.s === "A") === r.mine }));
      const motm = { ...r.motm, me: (r.motm.s === "A") === r.mine };
      box.innerHTML = `
    <div class="sec-title">المباراة</div>
    <div class="match-score-card" style="background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:16px;text-align:center">

      <div class="score" id="sc" dir="ltr" style="font-size:clamp(38px,12vw,52px);margin:8px 0 4px;display:flex;align-items:center;justify-content:center;gap:clamp(8px,3vw,14px)"><span id="sc-opp">0</span><i id="mn" style="font-style:normal;font-size:clamp(15px,4.5vw,20px);font-weight:900;color:var(--mu);min-width:clamp(34px,10vw,46px);text-align:center">0'</i><span id="sc-mine">0</span></div>
      <div dir="ltr" style="font-size:11px;font-weight:800;color:var(--mu)">فريقك · الخصم</div>
      <div id="match-live" style="display:flex;justify-content:center;margin:4px 0 0">
        <button class="btn g sm" id="skip-match" type="button" disabled>تخطي للنتيجة</button>
      </div>
      <div id="match-pitch" style="margin-top:10px"></div>
      <div id="lg" style="margin-top:12px;text-align:right"></div>
    </div>`;
      sfxWhistle();
      let m = 0, a = 0, b = 0, matchFinished = false, t = null;
      const TICK_MS = Math.round(30000 / 90);
      const tick = () => {
        if (!$("sc") || S !== matchState) { clearInterval(t); return }
        m = Math.min(m + 1, 90);
        evs.filter(e => e.m === m).forEach(e => {
          const teamName = e.me ? "فريقك" : esc(OPP.name);
          const icon = e.type === "goal" ? "⚽" : e.type === "yellow" ? "🟨" : e.type === "red" ? "🟥" : "🔁";
          const detail = e.type === "goal"
            ? `${esc(e.who)}${e.assist ? ` · أسيست ${esc(e.assist)}` : ""}`
            : e.type === "yellow" ? `إنذار · ${esc(e.who)}`
              : e.type === "red" ? `${e.secondYellow ? "طرد بعد الإنذار الثاني" : "طرد"} · ${esc(e.who)}`
                : `تبديل · ${esc(e.who)}${e.for ? ` بدل ${esc(e.for)}` : ""}`;
          if (e.type === "goal") {
            if (e.me) a++; else b++;
            sfxGoal();
            const sc = $("sc"); if (sc) { sc.style.transform = "scale(1.18)"; setTimeout(() => { if (sc) sc.style.transform = "" }, 300) }
          } else if (e.type === "yellow") {
            sfxYellow();
          } else if (e.type === "red") {
            sfxRed();
          }
          $("lg").insertAdjacentHTML("beforeend",
            `<div class="row" style="padding:8px 0;background:transparent;border-color:rgba(255,255,255,.06)">
          <span class="n" style="font-size:12.5px">${icon} ${e.m}' ${detail}</span>
          <span class="r" style="font-size:11px">${teamName}</span>
        </div>`);
        });
        const scoreOpp = $("sc-opp"), scoreMine = $("sc-mine"), mn = $("mn");
        if (scoreOpp) scoreOpp.textContent = b;
        if (scoreMine) scoreMine.textContent = a;
        if (mn) mn.textContent = m + "'";
        if (m >= 90) {
          if (matchFinished) return;
          matchFinished = true;
          gameLive = false;
          clearMatchSkipState();
          const liveBar = $("match-live");
          if (liveBar) liveBar.remove();
          clearInterval(t);
          const win = a > b;
          sfxWhistle();
          if (win) buzz([20, 60, 20]);
          const mvpTeamLabel = motm.me ? "فريقك" : esc(OPP.name);
          $("lg").insertAdjacentHTML("beforeend",
            `<div class="row" style="margin-top:10px;padding:10px;background:rgba(255,207,74,.08);border-color:rgba(255,207,74,.25)">
          <span class="n" style="font-size:12.5px">⭐ MVP: ${esc(motm.who.toLocaleUpperCase())} · ${mvpTeamLabel}</span>
          <span class="r" dir="ltr" style="font-size:11px;direction:ltr;unicode-bidi:isolate;text-align:left">${esc(motm.reason)}</span>
        </div>`);
          const mySide = r.mine ? "A" : "B", opponentSide = r.mine ? "B" : "A";
          const opponentTeam = (OPP.players || OPP.names.map(name => findPlayer(name))).filter(Boolean);
          const matchPitch = $("match-pitch");
          if (matchPitch) {
            matchPitch.innerHTML = matchFormationHTML(
              S.team, S.formation, r.ratings[mySide], motm.me ? motm.who : null,
              opponentTeam, OPP.formation, r.ratings[opponentSide], motm.me ? null : motm.who
            );
            matchPitch.querySelectorAll("[data-match-view]").forEach(button => {
              button.onclick = () => {
                const view = button.dataset.matchView;
                const lineup = matchPitch.querySelector(".match-lineup");
                if (!lineup) return;
                lineup.dataset.view = view;
                lineup.querySelectorAll("[data-lineup]").forEach(panel => {
                  panel.hidden = panel.dataset.lineup !== view;
                });
                matchPitch.querySelectorAll("[data-match-view]").forEach(item => {
                  const active = item.dataset.matchView === view;
                  item.classList.toggle("active", active);
                  item.setAttribute("aria-pressed", String(active));
                });
              };
            });
          }
          recordGuestMatch(mt, a, b);
          if (matchState.entry === "event") resolveTournamentMatch(a, b);
        }
      };
      t = setInterval(tick, TICK_MS);
      activeMatchSkip = () => {
        if (matchFinished || S !== matchState || !$("sc")) {
          activeMatchSkip = null;
          return;
        }
        clearInterval(t);
        while (m < 90 && !matchFinished) {
          // tick() intentionally does nothing if the match screen was torn down.
          // Detect that state before/after each tick to avoid an infinite loop.
          if (!$("sc") || S !== matchState) {
            activeMatchSkip = null;
            break;
          }
          const before = m;
          tick();
          if (m === before) {
            activeMatchSkip = null;
            break;
          }
        }
      };
      const skipButton = $("skip-match");
      if (skipButton) { skipButton.disabled = false; skipButton.onclick = requestMatchSkip; }
    }


