/* Pack definitions. This file is loaded only when the packs screen opens.
   Add a pack by adding an entry to GG_PACKS:
   - id/name/subtitle: shown in the packs screen.
   - players: full player objects. A player that is not in fut-data is kept
     as a pack-only card and becomes usable as soon as it is won.
   - n must be unique; p is G/D/M/F; role is GK/CB/LB/RB/CDM/CM/CAM/LM/RM/LW/RW/ST.
   - price is the sale value shown in the pack; art is optional. */
window.GG_PACKS = window.GG_PACKS || {};

GG_PACKS["center-backs"] = {
  id: "center-backs",
  name: "حزمة قلوب الدفاع",
  subtitle: "11 قلب دفاع · 3 كروت مميزة",
  players: [
    {
      n: "Tarkowski", p: "D", role: "CB", alt: [],
      nat: "England", club: "Everton", era: "2020s", r: 80,
      price: 30000, suggestedPrice: null, eaId: 202695,
      art: "./assets/packs/27-202695.eea22d7221c2846bf830bc837cf6d124940dcd2b4a441f05ab85bf0abad7dcb0.webp"
    },
    {
      n: "Aké", p: "D", role: "CB", alt: [],
      nat: "Netherlands", club: "Feyenoord", era: "2020s", r: 80,
      price: 30000, suggestedPrice: null, eaId: 208920,
      art: "./assets/packs/27-208920.cbbcf151944deaed405ae8b832a43cc857d8c363d1c5910b7eacc8e27cc57e5c.webp"
    },
    {
      n: "Tomori", p: "D", role: "CB", alt: [],
      nat: "England", club: "Milano FC", era: "2020s", r: 80,
      price: 30000, suggestedPrice: null, eaId: 232756,
      art: "./assets/packs/27-232756.967e60812240e8add4d50400909fe48c374e1c81006c985f67cee4259ba66e3b.webp"
    },
    {
      n: "Schouten", p: "D", role: "CB", alt: [],
      nat: "Netherlands", club: "PSV", era: "2020s", r: 80,
      price: 30000, suggestedPrice: null, eaId: 235149,
      art: "./assets/packs/27-235149.781a3a94d6cafa287c2930f320b5e7784346440ff55aeca9171a6345d99e8f79.webp"
    },
    {
      n: "Demiral", p: "D", role: "CB", alt: [],
      nat: "Turkey", club: "Al Ahli", era: "2020s", r: 80,
      price: 30000, suggestedPrice: null, eaId: 238160,
      art: "./assets/packs/27-238160.a9d6a7b82461e5569056e82259c5a12ce68c939dec574d0d5745c9707d2b5589.webp"
    },
    {
      n: "Gabbia", p: "D", role: "CB", alt: [],
      nat: "Italy", club: "Milano FC", era: "2020s", r: 80,
      price: 30000, suggestedPrice: null, eaId: 240277,
      art: "./assets/packs/27-240277.7da59cb6da686cb495dcdfdfe118c900550fae4f793e6bd9e109f1d007b7cfcb.webp"
    },
    {
      n: "Araujo", p: "D", role: "CB", alt: [],
      nat: "Uruguay", club: "Liverpool", era: "2020s", r: 80,
      price: 30000, suggestedPrice: null, eaId: 253163,
      art: "./assets/packs/27-253163.1688c009fa34c27593cb7e7808ea960788131a777179f84eeb5440e123433937.webp"
    },
    {
      n: "Zabarnyi", p: "D", role: "CB", alt: [],
      nat: "Ukraine", club: "PSG", era: "2020s", r: 80,
      price: 30000, suggestedPrice: null, eaId: 258781,
      art: "./assets/packs/27-258781.5841ae073d927b0fd3b92073d6751f3f288b0b8d882ec0d02df35839c60e1070.webp"
    },
    {
      n: "Schlotterbeck", p: "D", role: "CB", alt: [],
      nat: "Germany", club: "Borussia Dortmund", era: "2020s", r: 89,
      price: 400000, suggestedPrice: null, eaId: 50579467,
      art: "./assets/packs/27-50579467.94ec04c91db4eaec41680a154e2580ec9aff167aacb6069cd4f908e0b072fdfc.webp"
    },
    {
      n: "Bastoni", p: "D", role: "CB", alt: [],
      nat: "Italy", club: "Lombardia FC", era: "2020s", r: 88,
      price: 300000, suggestedPrice: null, eaId: 67346247,
      art: "./assets/packs/27-67346247.b71f5e2b91d7dc71e51dc91aa9fb9f396e3ba5031bcadc7e297ea1e139418157.webp"
    },
    {
      n: "Nesta", p: "D", role: "CB", alt: [],
      nat: "Italy", club: "ICON", era: "L", r: 91,
      price: 900000, suggestedPrice: null, eaId: 83887168,
      rarity: "Base Icon", isIcon: true,
      art: "./assets/packs/27-83887168.2342498b0d6736e4b19b608fe64b82a3c2572aae76b4ff084bb297d80a64486f.webp"
    }
  ]
};
