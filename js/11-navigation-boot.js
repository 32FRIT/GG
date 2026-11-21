/* ================= NAVIGATION (Android back + iOS swipe) ================= */
    let _navStack = [screenHome];
    const _origPush = fn => { history.pushState({}, ""); _navStack.push(fn) };
    window.addEventListener("popstate", () => {
      if (_navStack.length > 1) _navStack.pop();
      const prev = _navStack[_navStack.length - 1];
      if (prev) prev();
      else history.pushState({}, "");
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
    history.pushState({}, "");
    screenHome();

  
