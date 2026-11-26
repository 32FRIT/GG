/* ================= ASSET DOWNLOAD ================= */
    const ASSET_CACHE_NAME = "gg-app-v1"; // same cache the service worker reads from
    const ASSET_STATE_KEY = "gg_assets_v1";
    const ASSET_SIZE_LABEL = "حوالي 100 ميجا";
    const assetManager = (() => {
      const version = (typeof FUT_DATA !== "undefined" && FUT_DATA.snapshot) || "v1";
      const urls = [...new Set([
        ...Object.values(typeof CARD_ART !== "undefined" ? CARD_ART : {}),
        ...Object.values(typeof COACH_ART !== "undefined" ? COACH_ART : {}),
        "./Background.jpg"
      ].filter(path => typeof path === "string" && path.length))]
        .map(path => new URL(path, document.baseURI).href);

      const state = { running: false, mode: null, done: 0, failed: [], uncached: 0, refresh: false, cache: null };
      let stored = readState();
      let done = stored.version === version && !!stored.done;
      /* No saved version means this is the first run of the downloader; keep
         whatever the browser already cached instead of refetching all of it. */
      const versionChanged = typeof stored.version === "string" && stored.version !== version;
      let renderTimer = null;
      let promptBox = null;
      let overlay = null;
      let pill = null;
      let booted = false;

      function readState() {
        try {
          const parsed = JSON.parse(localStorage.getItem(ASSET_STATE_KEY) || "{}");
          return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
          return {};
        }
      }

      function writeState(patch) {
        stored = { ...stored, ...patch };
        try { localStorage.setItem(ASSET_STATE_KEY, JSON.stringify(stored)) }
        catch (error) { console.warn("Could not save asset state.", error) }
      }

      function percent() {
        const settled = state.done + state.failed.length;
        return urls.length ? Math.round(settled / urls.length * 100) : 100;
      }

      function addUrls(paths) {
        let added = 0;
        (paths || []).forEach(path => {
          if (typeof path !== "string" || !path) return;
          try {
            const absolute = new URL(path, document.baseURI).href;
            if (!urls.includes(absolute)) { urls.push(absolute); added++; }
          } catch (_) { }
        });
        return added;
      }

      function urlsSignature() {
        let hash = 2166136261;
        const joined = urls.slice().sort().join("|");
        for (let index = 0; index < joined.length; index++) {
          hash ^= joined.charCodeAt(index);
          hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
      }

      function refreshDoneState() {
        if (!done) return false;
        const signature = urlsSignature();
        const covered = stored.signature
          ? stored.signature === signature
          : Number.isSafeInteger(stored.count) && stored.count >= urls.length;
        if (!covered) {
          done = false;
          writeState({ done: false });
          return true;
        }
        return false;
      }

      function packArtUrls() {
        const packs = window.GG_PACKS;
        if (!packs || typeof packs !== "object") return [];
        return Object.values(packs).flatMap(pack =>
          pack && Array.isArray(pack.players) ? pack.players.map(player => player && player.art) : []
        ).filter(path => typeof path === "string" && path.length);
      }

      function addPackArt() {
        if (!booted) return 0;
        const added = addUrls(packArtUrls());
        refreshDoneState();
        if (added) renderPanel();
        return added;
      }

      async function openCache() {
        if (location.protocol === "file:" || typeof caches === "undefined") return null;
        try { return await caches.open(ASSET_CACHE_NAME) }
        catch (error) { return null }
      }

      async function verifyStoredDone() {
        if (!done) return;
        if (location.protocol === "file:") return;
        if (typeof caches === "undefined") { done = false; return }
        const cache = await openCache();
        if (!cache) { done = false; return }
        const samples = urls.length
          ? [urls[0], urls[Math.floor(urls.length / 2)], urls[urls.length - 1]]
          : [];
        const hits = await Promise.all(samples.map(url => cache.match(url).catch(() => null)));
        if (hits.some(hit => !hit)) {
          done = false;
          writeState({ done: false });
        }
      }

      async function fetchAsset(url) {
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 30000) : null;
        try {
          const response = await fetch(url, {
            ...(state.refresh ? { cache: "reload" } : {}),
            ...(controller ? { signal: controller.signal } : {})
          });
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response;
        } finally {
          if (timer) clearTimeout(timer);
        }
      }

      function preloadImage(url) {
        return new Promise((resolve, reject) => {
          const image = new Image();
          const timer = setTimeout(() => { image.src = ""; reject(new Error("Image timeout")) }, 20000);
          image.onload = () => { clearTimeout(timer); resolve() };
          image.onerror = () => { clearTimeout(timer); reject(new Error("Image failed")) };
          image.src = url;
        });
      }

      function removePrompt() {
        if (promptBox) { promptBox.remove(); promptBox = null }
      }

      function showPrompt() {
        if (promptBox || done || state.running) return;
        if (!document.querySelector(".start-screen")) return;
        if (typeof gameInProgress === "function" && gameInProgress()) return;
        if (document.querySelector("[data-welcome-guide]")) {
          setTimeout(showPrompt, 1000);
          return;
        }
        promptBox = document.createElement("div");
        promptBox.className = "pick-overlay sale-overlay";
        promptBox.setAttribute("data-asset-prompt", "");
        promptBox.innerHTML = `<div class="pick-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-title">
      <div class="asset-dialog-title" id="asset-title">تحميل صور اللعبة</div>
      <p class="note">عايز نحمّل صور كل اللاعبين والمدربين (${ASSET_SIZE_LABEL}) على جهازك؟<br>كده اللعبة تفتح أسرع وتشتغل من غير إنترنت. لو قلت لا، هنكمل التحميل في الخلفية وأنت بتلعب.</p>
      <div class="pick-actions">
        <button class="btn w" id="asset-yes" type="button">نعم، حمّل دلوقتي</button>
        <button class="btn g w" id="asset-no" type="button">لا، العب عادي</button>
      </div>
    </div>`;
        document.body.appendChild(promptBox);
        promptBox.querySelector("#asset-yes").onclick = () => {
          removePrompt();
          start("foreground");
        };
        promptBox.querySelector("#asset-no").onclick = () => {
          removePrompt();
          writeState({ version, done: false, declined: true });
          start("background");
          toast("تحميل الصور شغال في الخلفية");
        };
      }

      function renderPanel() {
        const slot = document.getElementById("asset-slot");
        if (!slot) return;
        if (done) {
          slot.innerHTML = "";
          return;
        }
        const running = state.running;
        const failed = state.failed.length + state.uncached;
        const pct = percent();
        const meta = running
          ? `بنجهز الصور… ${pct}%`
          : failed
            ? "التحميل لم يكتمل"
            : `لسه مش متحملة · ${ASSET_SIZE_LABEL}`;
        slot.innerHTML = `<div class="asset-card">
      <div class="asset-row">
        <span><b class="asset-title">صور اللعبة</b><span class="asset-meta">${meta}</span></span>
        ${running ? "" : `<button class="btn g sm" id="asset-go" type="button">${failed ? "كمّل التحميل" : "تحميل الأصول"}</button>`}
      </div>
      ${running ? `<div class="asset-track"><i id="asset-panel-bar" style="width:${pct}%"></i></div>` : ""}
    </div>`;
        const go = document.getElementById("asset-go");
        if (go) go.onclick = () => start("foreground");
      }

      function renderPill() {
        const show = state.running && state.mode === "background" && !document.querySelector(".start-screen");
        if (!show) {
          if (pill) { pill.remove(); pill = null }
          return;
        }
        if (!pill) {
          pill = document.createElement("div");
          pill.className = "asset-pill";
          pill.setAttribute("aria-live", "polite");
          pill.innerHTML = `<div class="asset-pill-text" id="asset-pill-text"></div><div class="asset-track"><i id="asset-pill-bar"></i></div>`;
          document.body.appendChild(pill);
        }
        const pct = percent();
        pill.querySelector("#asset-pill-text").textContent = `تحميل صور اللعبة ${pct}%`;
        pill.querySelector("#asset-pill-bar").style.width = pct + "%";
      }

      function hideOverlay() {
        if (overlay) { overlay.remove(); overlay = null }
      }

      function renderOverlay() {
        if (!overlay || !state.running) return;
        const pct = percent();
        const text = overlay.querySelector("#asset-progress-text");
        const bar = overlay.querySelector("#asset-progress-bar");
        if (text) text.innerHTML = `<b dir="ltr">${pct}%</b>`;
        if (bar) bar.style.width = pct + "%";
      }

      function showOverlay() {
        if (overlay) { renderOverlay(); return }
        overlay = document.createElement("div");
        overlay.className = "pick-overlay sale-overlay";
        overlay.setAttribute("data-asset-progress", "");
        overlay.innerHTML = `<div class="pick-dialog" role="dialog" aria-modal="true" aria-live="polite" aria-label="تحميل صور اللعبة">
      <div class="asset-dialog-title">بنجهز صور اللعبة</div>
      <p class="asset-progress-text" id="asset-progress-text"></p>
      <div class="asset-track"><i id="asset-progress-bar"></i></div>
      <p class="asset-hint">سيب الصفحة مفتوحة لحد 100%، أو كمّل التحميل في الخلفية وألعب عادي.</p>
      <div class="pick-actions"><button class="btn g w" id="asset-background" type="button">كمّل في الخلفية</button></div>
    </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector("#asset-background").onclick = () => {
          state.mode = "background";
          hideOverlay();
          renderAll();
        };
        renderOverlay();
      }

      function showError() {
        if (!overlay) return;
        overlay.innerHTML = `<div class="pick-dialog" role="dialog" aria-modal="true" aria-label="التحميل لم يكتمل">
      <div class="asset-dialog-title">التحميل لم يكتمل</div>
      <p class="note">${state.uncached ? "مساحة الجهاز مش كافية لتخزين كل الصور." : "تعذر تحميل بعض الصور. تأكد من اتصال الإنترنت وجرّب تاني."}</p>
      <div class="pick-actions">
        <button class="btn w" id="asset-retry" type="button">حاول تاني</button>
        <button class="btn g w" id="asset-close" type="button">إغلاق</button>
      </div>
    </div>`;
        overlay.querySelector("#asset-retry").onclick = () => { hideOverlay(); start("foreground") };
        overlay.querySelector("#asset-close").onclick = hideOverlay;
      }

      function renderAll() {
        renderPanel();
        renderPill();
        renderOverlay();
      }

      function scheduleRender() {
        if (renderTimer) return;
        renderTimer = setTimeout(() => {
          renderTimer = null;
          if (state.running) renderAll();
        }, 150);
      }

      function finish() {
        state.running = false;
        if (!state.failed.length && !state.uncached) {
          done = true;
          writeState({ version, done: true, declined: false, count: urls.length, signature: urlsSignature(), at: Date.now() });
          hideOverlay();
          renderAll();
          toast("تم تحميل كل صور اللعبة ✓");
          return;
        }
        writeState({ version, done: false });
        renderPanel();
        renderPill();
        if (overlay) showError();
        else toast("تعذر تحميل بعض الصور — جرّب تاني من الرئيسية");
      }

      async function run() {
        state.done = 0;
        state.failed = [];
        state.uncached = 0;
        state.refresh = versionChanged;
        if (state.mode === "foreground") showOverlay(); else renderAll();
        state.cache = await openCache();
        if (navigator.storage && typeof navigator.storage.persist === "function") {
          navigator.storage.persist().catch(() => { });
        }
        let cursor = 0;
        const useFetch = location.protocol !== "file:";
        const worker = async () => {
          while (cursor < urls.length) {
            const url = urls[cursor++];
            let loaded = false;
            try {
              const cached = !state.refresh && state.cache ? await state.cache.match(url).catch(() => null) : null;
              if (cached) {
                loaded = true;
              } else {
                if (state.refresh && state.cache) await state.cache.delete(url).catch(() => false);
                if (useFetch) {
                  for (let attempt = 0; attempt < 2 && !loaded; attempt++) {
                    try {
                      const response = await fetchAsset(url);
                      if (state.cache) {
                        try { await state.cache.put(url, response.clone()) }
                        catch (error) {
                          const stored = await state.cache.match(url).catch(() => null);
                          if (!stored) state.uncached++;
                        }
                      }
                      await response.blob();
                      loaded = true;
                    } catch (error) {
                      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 250));
                    }
                  }
                }
                if (!loaded) {
                  try { await preloadImage(url); loaded = true } catch (_) { }
                }
              }
            } catch (error) { }
            if (loaded) state.done++;
            else state.failed.push(url);
            scheduleRender();
            if (state.mode === "background") {
              await new Promise(resolve => setTimeout(resolve, 55));
            }
          }
        };
        await Promise.all(Array.from({ length: 2 }, worker));
        finish();
      }

      function start(mode) {
        if (state.running) {
          state.mode = mode;
          if (mode === "foreground") showOverlay();
          else hideOverlay();
          renderAll();
          return;
        }
        removePrompt();
        state.running = true;
        state.mode = mode;
        renderAll();
        run().catch(error => {
          console.error("Asset download failed.", error);
          state.running = false;
          writeState({ version, done: false });
          renderAll();
          toast("تعذر تحميل الصور — جرّب تاني");
        });
      }

      async function boot() {
        booted = true;
        if (!window.GG_PACKS && typeof loadPacks === "function") {
          try { await loadPacks() } catch (_) { }
        }
        addPackArt();
        await verifyStoredDone();
        if (done && !stored.signature) writeState({ signature: urlsSignature(), count: urls.length });
        /* A new data snapshot means every portrait may have changed, so never
           carry the previous version's "downloaded" flag into this one. */
        if (versionChanged) writeState({ version, done: false, declined: false });
        renderPanel();
        if (done) return;
        if (stored.version === version && stored.declined) {
          if (navigator.onLine !== false) start("background");
        } else setTimeout(showPrompt, 1200);
      }

      return { urls, state, boot, start, renderPanel, done: () => done, addPackArt };
    })();
    window.assetManager = assetManager;
    window.renderAssetPanel = assetManager.renderPanel;
    if (!/[?&]smoke=/.test(location.search)) {
      assetManager.boot().catch(error => console.warn("Asset sync boot failed.", error));
    }
