/* ================= NETWORK (PeerJS) ================= */
    /* الثوابت NET_HEARTBEAT_INTERVAL_MS / NET_SILENCE_TIMEOUT_MS / NET_RESEND_INTERVAL_MS
       معرّفة في 03-state.js (بيستخدمها الاتنين). */
    const NET_FAIL_DELAY_MS = 600;            // مهلة قبل الرجوع للشاشة بعد فشل الاتصال
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
      setTimeout(returnScreen, NET_FAIL_DELAY_MS);
    }
    const ROOM_CODE_LENGTH = 6;
    /* No 0/O/1/I/L so a code read aloud or typed by hand stays unambiguous. */
    const ROOM_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
    function newRoomCode() {
      const bytes = new Uint8Array(ROOM_CODE_LENGTH);
      if (window.crypto && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
      else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
      return Array.from(bytes, byte => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join("");
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
    function validNetworkPlayer(player) {
      if (!player || typeof player !== "object" || typeof player.n !== "string" || !player.n) return false;
      if (!["G", "D", "M", "F"].includes(player.p) || typeof player.role !== "string" || !POSITION_GROUP[player.role]) return false;
      if (!Number.isInteger(player.r) || player.r < 1 || player.r > 99) return false;
      if (player.alt != null && (!Array.isArray(player.alt) || player.alt.some(role => !POSITION_GROUP[role]))) return false;
      if (player.art != null && (typeof player.art !== "string" || player.art.length > 300 ||
        /(^|\/)\.\.(\/|$)/.test(player.art) || /^[a-z][a-z0-9+.-]*:/i.test(player.art))) return false;
      return true;
    }
    function validOpponentPick(d) {
      /* الاختيار لازم يكون للجولة الحالية بالظبط — الاختيارات المتأخرة أو المستقبلة مرفوضة. */
      if (!d || !Number.isInteger(d.i) || d.i < 0 || d.i >= 11) return false;
      if (S && typeof S.i === "number" && d.i !== S.i) return false;
      if (!S && OPPK.slice(0, 11).some(Boolean)) return false;
      if (typeof d.n !== "string" || !Array.isArray(d.p)) return false;
      if (d.p.length !== 4 || new Set(d.p).size !== 4) return false;
      const roundRole = formationRoleSlots(opponentFormation)[d.i];
      if (!roundRole) return false;
      const fitsRound = name => {
        const player = PLAYER_BY_NAME.get(name);
        return !!player && (playsRole(player, roundRole) || playsGroup(player, POSITION_GROUP[roundRole]));
      };
      if (!d.p.every(fitsRound) || !d.p.includes(d.n)) return false;
      if (!(d.s === null || d.s === undefined ||
        typeof d.s === "string" && d.s !== d.n && d.p.includes(d.s))) return false;
      return !OPPK.slice(0, 11).some((name, index) => index !== d.i && name === d.n);
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
          if (draftMode !== (d.draftMode === "choice" ? "choice" : "hidden")) {
            try { connection.send({ t: "mode_error" }) }
            catch (e) { handleOpponentDisconnect(connection); return }
            return netFail("نوع الدريفت مختلف بين اللاعبين", returnScreen);
          }
          if (draftMode === "choice" && Number.isInteger(d.choiceMatchMinutes) && d.choiceMatchMinutes !== choiceMatchMinutes) {
            try { connection.send({ t: "mode_error" }) }
            catch (e) { handleOpponentDisconnect(connection); return }
            return netFail("وقت التشكيلة مختلف بين اللاعبين", returnScreen);
          }
          const formation = FORMATIONS.find(item => item.id === d.formation);
          if (!formation) return netFail("خطة الخصم غير صالحة", returnScreen);
          opponentFormation = formation.id;
          if (gameType === "club") {
            try { connection.send({ t: "club-ready" }) }
            catch (e) { handleOpponentDisconnect(connection); return }
            return startClubMatch("online");
          }
          try { connection.send({ t: "cfg", tm: TM, formation: selectedFormation, gameType, draftMode, choiceMatchMinutes }) }
          catch (e) { handleOpponentDisconnect(connection); return }
          if (draftMode === "choice") startChoiceDraft();
          else startGame();
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
          if (Number.isInteger(d.choiceMatchMinutes) && [3,5,10].includes(d.choiceMatchMinutes)) choiceMatchMinutes = d.choiceMatchMinutes;
          opponentFormation = formation.id;
          draftMode = d.draftMode === "choice" ? "choice" : "hidden";
          if (draftMode === "choice") startChoiceDraft();
          else startGame();
        }
        if (d.t === "choice-timeout") {
          stopChoiceDeadline();
          toast("خصمك انتهى وقته — كسبت المباراة");
          gameLive = false;
          cancelGameTimers();
          killNet();
          resetOpponent();
          screenModes();
          return;
        }
        if (d.t === "choice-ready") {
          choiceReadyRemote = true;
          toast("الخصم مستعد");
          if (choiceReadyLocal && S && S.draftMode === "choice") finishChoiceDraft();
          return;
        }
        if (d.t === "choice-unready") {
          choiceReadyRemote = false;
          toast("الخصم عدّل التشكيلة ولم يعد مستعدًا");
          return;
        }
        if (d.t === "pick") {
          if (!validOpponentPick(d) || OPPK[d.i] && OPPK[d.i] !== d.n) return;
          OPPK[d.i] = d.n; OPPS[d.i] = d.s || null; OPPP[d.i] = d.p.slice();
          if (S && S.phase === "opp") paintOpp();
        }
        if (d.t === "team") {
          const coach = COACHES.find(item => item.n === d.coach);
          const formation = FORMATIONS.find(item => item.id === d.formation);
          const validNames = Array.isArray(d.names) && d.names.length === 11 && d.names.every(name => typeof name === "string") && new Set(d.names).size === 11;
          const payloadPlayers = gameType === "club" && Array.isArray(d.players) ? d.players : null;
          const validPayload = !payloadPlayers || (payloadPlayers.length === 11 &&
            payloadPlayers.every(validNetworkPlayer) &&
            new Set(payloadPlayers.map(player => player.n)).size === 11 &&
            payloadPlayers.every((player, index) => player.n === d.names[index]));
          const team = payloadPlayers
            ? validPayload ? payloadPlayers.map(player => ({ ...player, alt: Array.isArray(player.alt) ? player.alt.slice() : [] })) : []
            : validNames ? d.names.map(name => P.find(player => player.n === name)) : [];
          const slots = formation ? formationSlots(formation.id) : [];
          const calculatedBaseAvg = team.length === 11 && team.every(Boolean)
            ? (lineupBaseRating(team, formation.id) || Math.round(team.reduce((sum, player) => sum + player.r, 0) / 11))
            : null;
          const calculatedAvg = coach && calculatedBaseAvg !== null ? coachAdjustedPower(calculatedBaseAvg, coach) : null;
          const validSeed = Number.isSafeInteger(d.seed) && d.seed >= 0 && d.seed < 0x100000000;
          const benchPlayers = gameType === "club" && Array.isArray(d.benchPlayers) ? d.benchPlayers : null;
          const benchNames = benchPlayers ? benchPlayers.map(player => player ? player.n : null) : d.benchNames;
          const validBench = gameType !== "club" || (validNames &&
            (benchPlayers
              ? benchPlayers.length === BENCH_SLOT_POSITIONS.length &&
                benchPlayers.slice(0, 4).every(Boolean) &&
                benchPlayers.every((player, index) => player === null || validNetworkPlayer(player) &&
                  (!BENCH_SLOT_POSITIONS[index] || playsGroup(player, BENCH_SLOT_POSITIONS[index]))) &&
                new Set([...d.names, ...benchPlayers.filter(Boolean).map(player => player.n)]).size === 11 + benchPlayers.filter(Boolean).length
              : Array.isArray(benchNames) && benchNames.length === BENCH_SLOT_POSITIONS.length &&
                benchNames.slice(0, 4).every(Boolean) &&
                benchNames.every((name, index) => name === null || typeof name === "string" && !!P.find(player => player.n === name) &&
                  (!BENCH_SLOT_POSITIONS[index] || playsGroup(P.find(player => player.n === name), BENCH_SLOT_POSITIONS[index]))) &&
                new Set([...d.names, ...benchNames.filter(Boolean)]).size === 11 + benchNames.filter(Boolean).length));
          const validTeam = !!coach && !!formation && team.length === 11 && team.every(Boolean) &&
            team.every((player, index) => validNetworkPlayer(player) && playsGroup(player, slots[index])) && validNames && validPayload &&
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
            benchNames: Array.isArray(benchNames) ? benchNames.slice() : [],
            players: team,
            benchPlayers: Array.isArray(benchPlayers) ? benchPlayers.slice() : [],
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
          try { connection.send({ t: "hello", formation, gameType, draftMode, choiceMatchMinutes }) }
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


