/* ================= NAVIGATION (Android back + iOS swipe) ================= */
    let _navStack = [screenHome];
    let _navKeys = [screenHome];
    let _navBackRender = false;
    let _navConfirmRestore = false;
    /* Screens restored by the browser back button must not push another entry,
       otherwise history grows on every back press. */
    const _origPush = (fn, key) => {
      const id = key || fn;
      if (_navBackRender || _navKeys[_navKeys.length - 1] === id) return;
      history.pushState({}, "");
      _navStack.push(fn);
      _navKeys.push(id);
    };
    window.addEventListener("popstate", () => {
      if (_navConfirmRestore) {
        _navConfirmRestore = false;
        return;
      }
      /* Leaving mid-match would drop the game without telling the opponent
         or clearing timers, so ask first and tear the match down properly. */
      if (gameInProgress()) {
        if (!confirm("متأكد إنك عايز تنسحب من المباراة؟")) {
          _navConfirmRestore = true;
          history.forward();
          return;
        }
        quitActiveGame();
      }
      if (_navStack.length <= 1) return;
      _navStack.pop();
      _navKeys.pop();
      const prev = _navStack[_navStack.length - 1] || screenHome;
      _navBackRender = true;
      try { prev(); } finally { _navBackRender = false; }
    });
    let _swipeStartX = 0, _swipeStartY = 0;
    document.addEventListener("touchstart", e => {
      _swipeStartX = e.touches[0].clientX;
      _swipeStartY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener("touchend", e => {
      const dx = e.changedTouches[0].clientX - _swipeStartX;
      const dy = Math.abs(e.changedTouches[0].clientY - _swipeStartY);
      if (_swipeStartX < 30 && dx > 60 && dy < 80) history.back();
    }, { passive: true });


/* ================= BOOT ================= */
    history.replaceState({}, "");
    if (!window.__GG_BOOT_ERROR) screenHome();

  
