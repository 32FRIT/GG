/* ================= NETWORK (PeerJS) ================= */
    function killNet() {
      stopNetMonitor();
      stopTeamResultRetry();
      localTeamResult = null;
      try { conn && conn.close() } catch (e) { }
      try { peer && peer.destroy() } catch (e) { }
      conn = null; peer = null;
      activeRoomType = "draft";
    }
    function netFail(msg, returnScreen = screenModes) {
      killNet();
      toast(msg || "مشكلة في الاتصال");
      setTimeout(returnScreen, 600);
    }
    function roomPeerId(code, gameType) {
      return `${gameType === "club" ? "ggc-" : "ggf-"}${code}`;
    }
    function hostRoom(code, lobby, gameType = "draft") {
      resetOpponent();
      const returnScreen = gameType === "club" ? screenClubModes : screenModes;
      if (gameType === "club" && !getClubMatchSetup()) return;
      if (typeof Peer === "undefined") return netFail("مكتبة الاتصال لسه بتحمّل، جرّب تاني", returnScreen);
      killNet();
      activeRoomType = gameType;
      try { peer = new Peer(roomPeerId(code, gameType)) } catch (e) { return netFail(undefined, returnScreen) }
      peer.on("open", () => {
        if (lobby) screenWait("بندور على لاعب", "هنتوصل بأول لاعب متاح...", undefined, returnScreen);
        else screenWait("الغرفة جاهزة", "ابعت الكود لصاحبك", code, returnScreen);
      });
      peer.on("connection", c => {
        if (conn) { try { c.close() } catch (_) { } return; }
        conn = c; link(true, gameType);
      });
      peer.on("error", e => {
        if (lobby && e && e.type === "unavailable-id") joinRoom(code, gameType);
        else netFail("مش قادر أفتح الغرفة", returnScreen);
      });
    }
    function joinRoom(code, gameType = "draft") {
      resetOpponent();
      const returnScreen = gameType === "club" ? screenClubModes : screenModes;
      if (gameType === "club" && !getClubMatchSetup()) return;
      if (typeof Peer === "undefined") return netFail("مكتبة الاتصال لسه بتحمّل، جرّب تاني", returnScreen);
      killNet();
      activeRoomType = gameType;
      screenWait("بندخل الغرفة", "بنوصل بصاحبك...", undefined, returnScreen);
      try { peer = new Peer() } catch (e) { return netFail(undefined, returnScreen) }
      peer.on("open", () => {
        conn = peer.connect(roomPeerId(code, gameType), { reliable: true });
        link(false, gameType);
      });
      peer.on("error", () => netFail("مفيش غرفة بالكود ده", returnScreen));
    }
    function link(isHost, gameType = "draft") {
      if (!conn) return;
      const connection = conn;
      const returnScreen = gameType === "club" ? screenClubModes : screenModes;
      connection.on("data", d => {
        if (conn !== connection || !d || typeof d !== "object" || !d.t) return;
        lastNetMessage = Date.now();
        if (d.t === "ping") {
          try { connection.send({ t: "pong" }) }
          catch (e) { handleOpponentDisconnect(connection) }
          return;
        }
        if (d.t === "pong") return;
        if (d.t === "skip-request" || d.t === "skip-accept" || d.t === "skip-decline") {
          handleMatchSkipMessage(d);
          return;
        }
        if (d.t === "team_ack") {
          stopTeamResultRetry();
          return;
        }
        if (d.t === "mode_error") {
          netFail("نوع المباراة مختلف بين اللاعبين", returnScreen);
          return;
        }
        if (d.t === "resign") {
          cancelGameTimers();
          S = null;
          killNet();
          resetOpponent();
          toast("الخصم انسحب من المباراة");
          returnScreen();
          return;
        }
        if (d.t === "rematch-choice") {
          const allowed = gameType === "club" ? ["same", "edit", "ready"] : ["same", "new"];
          if (!allowed.includes(d.action)) return;
          rematchRemote = d.action;
          checkRematchAgreement();
          if (rematchPending && rematchRemote !== rematchPending) toast("اختاروا نفس طريقة إعادة المباراة");
          return;
        }
        if (d.t === "hello" && isHost) {
          const remoteGameType = d.gameType === "club" ? "club" : "draft";
          if (remoteGameType !== gameType) {
            try { connection.send({ t: "mode_error" }) }
            catch (e) { handleOpponentDisconnect(connection); return }
            return netFail("نوع المباراة مختلف بين اللاعبين", returnScreen);
          }
          const formation = FORMATIONS.find(item => item.id === d.formation);
          if (!formation) return netFail("خطة الخصم غير صالحة", returnScreen);
          opponentFormation = formation.id;
          if (gameType === "club") {
            try { connection.send({ t: "club-ready" }) }
            catch (e) { handleOpponentDisconnect(connection); return }
            return startClubMatch("online");
          }
          try { connection.send({ t: "cfg", tm: TM, formation: selectedFormation, gameType }) }
          catch (e) { handleOpponentDisconnect(connection); return }
          startGame();
        }
        if (d.t === "club-ready" && !isHost && gameType === "club") {
          return startClubMatch("online");
        }
        if (d.t === "cfg" && !isHost) {
          if (gameType !== "draft" || (d.gameType && d.gameType !== "draft")) {
            return netFail("نوع المباراة مختلف بين اللاعبين", returnScreen);
          }
          const formation = FORMATIONS.find(item => item.id === d.formation);
          if (!formation) return netFail("خطة الخصم غير صالحة", returnScreen);
          TM = d.tm || TM;
          opponentFormation = formation.id;
          startGame();
        }
        if (d.t === "pick") {
          const validPick = Number.isInteger(d.i) && d.i >= 0 && d.i < 11 && typeof d.n === "string" && Array.isArray(d.p) &&
            d.p.length === 4 && new Set(d.p).size === 4 && d.p.every(name => PLAYER_BY_NAME.has(name)) && d.p.includes(d.n) &&
            (d.s === null || d.s === undefined || d.p.includes(d.s));
          if (!validPick || OPPK[d.i] && OPPK[d.i] !== d.n) return;
          OPPK[d.i] = d.n; OPPS[d.i] = d.s || null; OPPP[d.i] = d.p.slice();
          if (S && S.phase === "opp") paintOpp();
        }
        if (d.t === "team") {
          const coach = COACHES.find(item => item.n === d.coach);
          const formation = FORMATIONS.find(item => item.id === d.formation);
          const validNames = Array.isArray(d.names) && d.names.length === 11 && d.names.every(name => typeof name === "string") && new Set(d.names).size === 11;
          const team = validNames ? d.names.map(name => P.find(player => player.n === name)) : [];
          const slots = formation ? formationSlots(formation.id) : [];
          const calculatedBaseAvg = team.length === 11 && team.every(Boolean) ? Math.round(team.reduce((sum, player) => sum + player.r, 0) / 11) : null;
          const calculatedAvg = coach && calculatedBaseAvg !== null ? coachAdjustedPower(calculatedBaseAvg, coach) : null;
          const validSeed = Number.isSafeInteger(d.seed) && d.seed >= 0 && d.seed < 0x100000000;
          const validBench = gameType !== "club" || (validNames && Array.isArray(d.benchNames) &&
            d.benchNames.length === BENCH_SLOT_POSITIONS.length && d.benchNames.slice(0, 4).every(Boolean) &&
            d.benchNames.every((name, index) => name === null || typeof name === "string" && P.some(player => player.n === name) &&
              (!BENCH_SLOT_POSITIONS[index] || playsGroup(P.find(player => player.n === name), BENCH_SLOT_POSITIONS[index]))) &&
            new Set([...d.names, ...d.benchNames.filter(Boolean)]).size === 11 + d.benchNames.filter(Boolean).length);
          const validTeam = !!coach && !!formation && team.length === 11 && team.every(Boolean) &&
            team.every((player, index) => playsGroup(player, slots[index])) && validNames &&
            Number.isSafeInteger(d.avg) && d.avg === calculatedAvg && Number.isSafeInteger(d.baseAvg) &&
            d.baseAvg === calculatedBaseAvg && validSeed && validBench;
          if (!validTeam) {
            toast("بيانات فريق الخصم غير مكتملة، مش قادرين نعرض النتيجة");
            return;
          }
          OPP = {
            avg: d.avg,
            baseAvg: d.baseAvg,
            names: d.names,
            benchNames: Array.isArray(d.benchNames) ? d.benchNames.slice() : [],
            name: "الخصم",
            formation: formation.id,
            slots,
            coach,
            seed: d.seed
          };
          try { connection.send({ t: "team_ack" }) }
          catch (e) { handleOpponentDisconnect(connection); return }
          if (window.__showOpp) window.__showOpp();
        }
      });
      connection.on("close", () => handleOpponentDisconnect(connection));
      connection.on("error", () => {
        if (conn === connection) toast("مشكلة في الاتصال، بنحاول نتحقق من رجوع الخصم");
      });
      const go = () => {
        if (!isHost) {
          const formation = gameType === "club" && guestProgress.club
            ? guestProgress.club.formation
            : selectedFormation;
          try { connection.send({ t: "hello", formation, gameType }) }
          catch (e) { handleOpponentDisconnect(connection) }
        }
      };
      const onOpen = () => {
        if (conn !== connection) return;
        startNetMonitor(connection);
        go();
      };
      if (connection.open) onOpen(); else connection.on("open", onOpen);
    }


