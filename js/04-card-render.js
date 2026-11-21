/* ================= CARD RENDER ================= */
    const CARD_ART = {
      1397: "./assets/1397-zinedine-zidane-1397-card.png",
      190042: "./assets/190042-diego-maradona-190042-card.png",
      231747: "./assets/231747-kylian-mbappe-84117827-card.png",
      237067: "./assets/237067-pele-237067-card.png",
      28130: "./assets/28130-ronaldinho-28130-card.png",
      37576: "./assets/37576-ronaldo-37576-card.png",
      168473: "./assets/168473-franz-beckenbauer-168473-card.png",
      ...(typeof HI_CARD_ART !== "undefined" ? HI_CARD_ART : {})
    };

    function tier(x) {
      if (x.era === "L") return "t-icon";
      if (x.r >= 90) return "t-elite";
      if (x.r >= 78) return "t-gold";
      if (x.r >= 70) return "t-silver";
      return "t-bronze";
    }
    function cardHTML(x, cls, extra) {
      const cardArt = x.art || CARD_ART[x.eaId];
      const cardContent = cardArt
        ? `<img class="fc-card-art" src="${cardArt}" alt="كارت ${esc(x.n)}" loading="lazy" decoding="async" fetchpriority="low"><span class="sr">${esc(x.n)}</span>`
        : `
    <div class="fc-top"><b>${x.r}</b><i>${POS_SHORT[x.role] || POS_SHORT[x.p] || ""}</i></div>
    <div class="fc-era">${x.era === "L" ? "ICON" : esc(x.era)}</div>
    <div class="fc-mono">${esc(x.n.charAt(0))}</div>
    <div class="fc-player-silhouette" aria-hidden="true"></div>
    <div class="fc-name">${esc(x.n)}</div>
    <div class="fc-rule"></div>
    <div class="fc-meta">${esc(x.nat)}<br>${esc(x.club)}</div>`;
      return `<div class="fc ${tier(x)} ${cls || ""} ${cardArt ? "has-card-art" : ""}" ${extra || ""}>
    ${cardContent}
  </div>`;
    }
    function backHTML(k, used) {
      return `<button class="fc back ${used ? "used" : ""}" data-k="${k}" aria-label="كارت مخفي ${k + 1}">
    <span>${used ? "✕" : "GG"}</span></button>`;
    }


