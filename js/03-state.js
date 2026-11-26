/* ================= STATE ================= */
    let S = null;
    let TM = 30;                 // seconds per pick
    let tmr = null, tEnd = 0, tCb = null;
    let phaseTimeout = null, advanceTimer = null, advanceAt = 0;
    let netHeartbeat = null, lastNetMessage = 0;
    let teamRetryTimer = null, pendingTeamResult = null, localTeamResult = null;
    let peer = null, conn = null, activeRoomType = "draft";
    let OPP = null;              // {avg,names,name}
    let OPPK = [], OPPS = [], OPPP = [];
    let rematchContext = null, rematchPending = null, rematchRemote = null, rematchLaunching = false;
    let choiceReadyLocal = false, choiceReadyRemote = false;
    let choiceMatchMinutes = 5;
    let choiceDeadline = 0, choiceDeadlineTimer = null;
    let activeMatchSkip = null, skipMatchProposalSent = false, skipMatchRemotePending = false;
    let gameLive = false;        // true while a draft or match is actually playing
    let draftMode = "hidden";

    function stopTeamResultRetry() {
      clearInterval(teamRetryTimer);
      teamRetryTimer = null;
      pendingTeamResult = null;
    }

    function sendTeamResult(connection) {
      if (!pendingTeamResult || conn !== connection || !connection.open) return;
      try { connection.send(pendingTeamResult) }
      catch (e) { handleOpponentDisconnect(connection) }
    }

    function publishTeamResult(connection, result) {
      if (localTeamResult) return;
      stopTeamResultRetry();
      localTeamResult = result;
      pendingTeamResult = result;
      teamRetryTimer = setInterval(() => sendTeamResult(connection), 2000);
      sendTeamResult(connection);
    }

    function resetOpponent() {
      stopTeamResultRetry();
      localTeamResult = null;
      OPP = null;
      OPPK = [];
      OPPS = [];
      OPPP = [];
      window.__showOpp = null;
      activeMatchSkip = null;
      skipMatchProposalSent = false;
      skipMatchRemotePending = false;
    }

    function stopNetMonitor() {
      clearInterval(netHeartbeat);
      netHeartbeat = null;
      lastNetMessage = 0;
    }
    function startNetMonitor(connection) {
      stopNetMonitor();
      lastNetMessage = Date.now();
      netHeartbeat = setInterval(() => {
        if (conn !== connection) {
          stopNetMonitor();
          return;
        }
        if (!connection.open || Date.now() - lastNetMessage > 12000) {
          handleOpponentDisconnect(connection);
          return;
        }
        try { connection.send({ t: "ping" }) }
        catch (e) { handleOpponentDisconnect(connection) }
      }, 3000);
    }
    function gameInProgress() {
      return gameLive && !!S;
    }
    function quitActiveGame() {
      if (conn && conn.open) {
        try { conn.send({ t: "resign" }) } catch (e) { }
      }
      gameLive = false;
      cancelGameTimers();
      if (typeof clearMatchSkipState === "function") clearMatchSkipState();
      S = null;
      killNet();
      resetOpponent();
    }
    function handleOpponentDisconnect(connection) {
      if (conn !== connection) return;
      const inGame = !!S;
      const returnScreen = activeRoomType === "club" || (S && S.entry === "club")
        ? screenClubModes
        : screenModes;
      gameLive = false;
      cancelGameTimers();
      S = null;
      killNet();
      resetOpponent();
      toast(inGame ? "انقطع اتصال الخصم، انتهت المباراة" : "انقطع اتصال الخصم");
      returnScreen();
    }

    function stopTimer() { if (tmr) { clearInterval(tmr); tmr = null } tCb = null }
    function cancelGameTimers() {
      stopTimer();
      stopChoiceDeadline();
      clearTimeout(phaseTimeout);
      phaseTimeout = null;
      clearInterval(advanceTimer);
      advanceTimer = null;
    }
    function stopChoiceDeadline() {
      if (choiceDeadlineTimer) clearInterval(choiceDeadlineTimer);
      choiceDeadlineTimer = null;
      choiceDeadline = 0;
      document.querySelectorAll(".choice-match-clock").forEach(element => element.remove());
    }
    function startChoiceDeadline() {
      stopChoiceDeadline();
      choiceDeadline = Date.now() + choiceMatchMinutes * 60 * 1000;
      const clock = document.createElement("div");
      clock.className = "choice-match-clock";
      clock.setAttribute("aria-live", "polite");
      clock.textContent = `${choiceMatchMinutes}:00`;
      document.body.appendChild(clock);
      choiceDeadlineTimer = setInterval(() => {
        if (!S || S.draftMode !== "choice") return stopChoiceDeadline();
        const remaining = Math.max(0, choiceDeadline - Date.now());
        const clock = document.querySelector(".choice-match-clock");
        if (clock) {
          const minutes = Math.floor(remaining / 60000);
          const seconds = Math.floor((remaining % 60000) / 1000);
          clock.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;
          clock.classList.toggle("warn", remaining <= 30000);
        }
        if (remaining <= 0) choiceDraftTimedOut();
      }, 250);
    }
    function choiceDraftTimedOut() {
      stopChoiceDeadline();
      if (!S || S.draftMode !== "choice") return;
      if (conn && conn.open) {
        try { conn.send({ t: "choice-timeout" }); } catch (_) {}
      }
      quitActiveGame();
      toast(conn && conn.open ? "انتهى وقت تجهيز التشكيلة" : "انتهى وقت تجهيز التشكيلة");
      screenModes();
    }
    function bindQuitButton() {
      const button = $("quit");
      if (!button) return;
      button.onclick = () => {
        if (!confirm("متأكد إنك عايز تنسحب من المباراة؟")) return;
        const returnScreen = S && S.entry === "club" ? screenClubModes : screenModes;
        quitActiveGame();
        returnScreen();
      };
    }
    function scheduleNextRound() {
      if (advanceTimer) return;
      advanceAt = Date.now() + 5000;
      const tick = () => {
        if (!S || S.phase !== "opp") {
          clearInterval(advanceTimer);
          advanceTimer = null;
          return;
        }
        const left = Math.max(0, Math.ceil((advanceAt - Date.now()) / 1000));
        const label = $("advance");
        if (label) label.textContent = left ? `الجولة التالية بعد ${left} ثواني` : "الجولة التالية...";
        if (left <= 0) {
          clearInterval(advanceTimer);
          advanceTimer = null;
          S.i++;
          round();
        }
      };
      tick();
      if (S && S.phase === "opp") advanceTimer = setInterval(tick, 200);
    }
    function startTimer(sec, cb) {
      stopTimer();
      tEnd = Date.now() + sec * 1000;
      tCb = cb;
      paintTimer();
      tmr = setInterval(paintTimer, 200);
    }
    function paintTimer() {
      const left = Math.max(0, Math.ceil((tEnd - Date.now()) / 1000));
      const t = $("tm"), b = $("bar");
      if (t) { t.textContent = left; t.classList.toggle("warn", left <= 10) }
      if (b) { b.style.width = (left / TM * 100) + "%"; b.classList.toggle("warn", left <= 10) }
      if (left <= 0 && tCb) { const cb = tCb; tCb = null; stopTimer(); cb() }
    }


