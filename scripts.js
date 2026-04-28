/*
  Combined Page1+Page2 JS
  - Keeps ALL Page 1 handleSubmission() logic (storage + scoring + adobeDataLayer push)
  - Adds ALL Page 2 logic (AJO decisioning fetch, parsing, rendering, click tracking, fallback offers)
  - Uses Option B (context-based eligibility): sends PreferredInterest + Scoring1 in the decision request

  Assumptions about HTML (same as your Page 1):
  - Radio inputs: <input type="radio" name="assetclass" value="Stocks|Bonds|CD">
  - Submit button: id="submitPreference" (recommended) OR HTML calls handleSubmission()
  - Message containers: id="error-message" and id="message"
  - Offer placement containers (optional but recommended):
      <div data-placement="ajo-offer"></div>
      <div data-placement="wireless-deals"></div>
*/

(() => {
  // ------------------------------------------------------------
  // AJO Decisioning / Web SDK config (from Page 2)
  // ------------------------------------------------------------
  const SURFACE_URI = "web://anmolraj-accenture.github.io/poc-decisioning2#ajo-offer";
  const CONTENT_SCHEMA = "https://ns.adobe.com/personalization/json-content-item";

  // ------------------------------------------------------------
  // Demo offers (fallback/default) (from Page 2)
  // ------------------------------------------------------------
  const OFFERS = [
    { id:"TD-001", placement:"ajo-offer", title:"Galaxy Ultra for $0/mo (demo)",
      desc:"Eligible trade-in required. Terms apply (demo copy).",
      badges:["Trade-in","36 mo"], ctaText:"Shop now", ctaUrl:"#", priority:90 },

    { id:"TD-002", placement:"ajo-offer", title:"Fiber: save monthly (demo)",
      desc:"Bundle savings + reward card messaging (demo copy).",
      badges:["Bundle","New customers"], ctaText:"Explore", ctaUrl:"#", priority:80 },

    { id:"TD-003", placement:"ajo-offer", title:"$200 off per line (demo)",
      desc:"Online order + new line. Limited time (demo copy).",
      badges:["New line","Credits"], ctaText:"Get offer", ctaUrl:"#", priority:70 },

    { id:"WD-101", placement:"wireless-deals", title:"Phone deal A (demo)",
      desc:"Great value with eligible plan (demo copy).",
      badges:["Wireless","Featured"], ctaText:"View", ctaUrl:"#", priority:85 },

    { id:"WD-102", placement:"wireless-deals", title:"Phone deal B (demo)",
      desc:"No trade-in required (demo copy).",
      badges:["No trade-in"], ctaText:"Shop", ctaUrl:"#", priority:75 },

    { id:"WD-103", placement:"wireless-deals", title:"Phone deal C (demo)",
      desc:"Bill credits over time (demo copy).",
      badges:["Bill credits"], ctaText:"Details", ctaUrl:"#", priority:65 },
  ];

  // Runtime offers (start with demo; replaced if AJO returns offers)
  let RUNTIME_OFFERS = [...OFFERS];

  // ------------------------------------------------------------
  // UI helpers (from Page 2)
  // ------------------------------------------------------------
  function setError(msg) {
    const box = document.getElementById("error-message");
    if (box) box.textContent = msg || "";
  }

  function setMessage(msg) {
    const box = document.getElementById("message");
    if (box) box.textContent = msg || "";
  }

  // ------------------------------------------------------------
  // HTML helpers (from Page 2)
  // ------------------------------------------------------------
  function decodeHtmlEntities(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[m]));
  }

  // ------------------------------------------------------------
  // Data Layer tracking (from Page 2)
  // ------------------------------------------------------------
  function ensureDataLayer() {
    window.adobeDataLayer = window.adobeDataLayer || [];
    return window.adobeDataLayer;
  }

  function trackOfferClick({ offerId, placement, title, destinationUrl, clickType }) {
    const dl = ensureDataLayer();

    const payload = {
      event: "offer-click",
      eventInfo: {
        clickType: clickType || "unknown",
        timestamp: new Date().toISOString()
      },
      offer: {
        id: offerId,
        placement,
        title,
        destinationUrl: destinationUrl || ""
      },
      page: {
        url: window.location.href,
        hash: window.location.hash || ""
      }
    };

    dl.push(payload);
    window.__lastClick = payload;

    console.log("[DEMO] offer-click pushed to adobeDataLayer:", payload);
  }

  // ------------------------------------------------------------
  // Offer lookup (from Page 2)
  // ------------------------------------------------------------
  function getOfferById(offerId) {
    return (RUNTIME_OFFERS || []).find(o => o.id === offerId);
  }

  // Backward compatible function if anything else calls window.__demoClick(id)
  window.__demoClick = function(offerId) {
    const offer = getOfferById(offerId);
    trackOfferClick({
      offerId,
      placement: offer?.placement || "",
      title: offer?.title || "",
      destinationUrl: offer?.ctaUrl || "",
      clickType: "legacy-track-button"
    });
  };

  // ------------------------------------------------------------
  // Rendering (from Page 2)
  // ------------------------------------------------------------
  function renderPlacement(placementName, offers) {
    const host = document.querySelector(`[data-placement="${placementName}"]`);
    if (!host) return;

    const sorted = offers
      .slice()
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // For hero placement, render the top 1 by default (prevents multiple tiles if you only want 1)
    const toRender = (placementName === "ajo-offer") ? sorted.slice(0, 1) : sorted;

    host.innerHTML = toRender.map(o => `
      <article class="card" data-offer-id="${escapeHtml(o.id)}" data-placement="${escapeHtml(placementName)}">
        <div class="card__media">Placement: ${escapeHtml(placementName)}</div>
        <div class="card__body">
          <h3 class="card__title">${escapeHtml(o.title || "")}</h3>
          <p class="card__desc">${escapeHtml(o.desc || "")}</p>

          <div class="card__meta">
            <span class="badge">ID: ${escapeHtml(o.id)}</span>
            ${(o.badges || []).slice(0, 3).map(b => `<span class="badge">${escapeHtml(b)}</span>`).join("")}
          </div>

          <div class="card__actions">
            <a class="btn"
               href="${escapeHtml(o.ctaUrl || "#") }"
               data-cta="true"
               data-offer-id="${escapeHtml(o.id)}"
               data-placement="${escapeHtml(placementName)}">
              ${escapeHtml(o.ctaText || "Shop")}
            </a>

            <button class="btn btn--ghost"
                    type="button"
                    data-track="true"
                    data-offer-id="${escapeHtml(o.id)}"
                    data-placement="${escapeHtml(placementName)}">
              Track click
            </button>
          </div>
        </div>
      </article>
    `).join("");
  }

  function renderAllPlacements() {
    renderPlacement("ajo-offer", (RUNTIME_OFFERS || []).filter(o => o.placement === "ajo-offer"));
    renderPlacement("wireless-deals", (RUNTIME_OFFERS || []).filter(o => o.placement === "wireless-deals"));
  }

  // ------------------------------------------------------------
  // Click wiring (event delegation) (from Page 2)
  // ------------------------------------------------------------
  function attachClickHandlers() {
    document.addEventListener("click", (e) => {
      const cta = e.target.closest('a[data-cta="true"]');
      const trackBtn = e.target.closest('button[data-track="true"]');

      if (!cta && !trackBtn) return;

      const el = cta || trackBtn;
      const offerId = el.getAttribute("data-offer-id");
      const placement = el.getAttribute("data-placement");
      const offer = getOfferById(offerId);

      const destinationUrl = cta ? (cta.getAttribute("href") || "") : (offer?.ctaUrl || "");
      const clickType = cta ? "cta" : "track-button";

      // Always track
      trackOfferClick({
        offerId,
        placement,
        title: offer?.title || "",
        destinationUrl,
        clickType
      });

      // If CTA is real navigation, allow DL push then navigate
      if (cta && destinationUrl && destinationUrl !== "#") {
        e.preventDefault();
        setTimeout(() => { window.location.href = destinationUrl; }, 60);
      }
    });
  }

  // ------------------------------------------------------------
  // AJO response helpers (from Page 2)
  // ------------------------------------------------------------
  function pickPropositionForSurface(result) {
    const propositions = result?.propositions || [];
    return propositions.find(p => p.scope === SURFACE_URI) || propositions[0] || null;
  }

  function extractOffersFromAjoContent(content) {
    if (!content) return null;

    // If string: may be HTML entities or JSON string
    if (typeof content === "string") {
      const decoded = decodeHtmlEntities(content);

      // Try JSON
      try {
        const parsed = JSON.parse(decoded);
        return extractOffersFromAjoContent(parsed);
      } catch {
        // Not JSON -> treat as HTML snippet
        return { htmlSnippet: decoded };
      }
    }

    // If array -> assume offers list
    if (Array.isArray(content)) {
      return { offers: content };
    }

    // If object -> check known shapes
    if (typeof content === "object") {
      if (Array.isArray(content.offers)) return { offers: content.offers };

      // placements: { "ajo-offer": [...], "wireless-deals": [...] }
      if (content.placements && typeof content.placements === "object") {
        const flattened = [];
        Object.keys(content.placements).forEach((pl) => {
          const arr = content.placements[pl];
          if (Array.isArray(arr)) {
            arr.forEach(o => flattened.push({ placement: pl, ...o }));
          }
        });
        return flattened.length ? { offers: flattened } : null;
      }

      // Unknown object -> show JSON
      return {
        htmlSnippet: `<pre style="white-space: pre-wrap;">${escapeHtml(JSON.stringify(content, null, 2))}</pre>`
      };
    }

    return null;
  }

  function normalizeOfferShape(raw, fallbackPlacement) {
    const id =
      raw.id ||
      raw.offerId ||
      raw.code ||
      raw.name ||
      `offer_${Math.random().toString(16).slice(2)}`;

    return {
      id: String(id),
      placement: raw.placement || raw.slot || fallbackPlacement || "ajo-offer",
      title: raw.title || raw.headline || raw.name || "Personalized offer",
      desc: raw.desc || raw.description || raw.body || raw.copy || "",
      badges: raw.badges || raw.tags || raw.labels || [],
      ctaText: raw.ctaText || raw.ctaLabel || (raw.cta && raw.cta.text) || "Shop",
      ctaUrl: raw.ctaUrl || raw.url || (raw.cta && raw.cta.url) || "#",
      priority: Number(raw.priority ?? raw.rank ?? raw.score ?? 50)
    };
  }

  function renderAjoFallbackHtml(html) {
    const container = document.querySelector('[data-placement="ajo-offer"]') || document.getElementById("ajo-offer");
    if (!container) return;
    container.innerHTML = `<div class="offer-card"><h3>Personalized Offer</h3>${html}</div>`;
  }

  // ------------------------------------------------------------
  // ✅ AJO Decisioning fetch (moved into Page 1)
  // Called AFTER user preference selection (Option B: context-based eligibility)
  // ------------------------------------------------------------
  function fetchPersonalization({ preferredInterest, m1, m2, totalScore, expOfNegTotal, randEpsilon, normalizationScore }) {
    console.log("🚀 Fetching personalization for surface:", SURFACE_URI, "PreferredInterest:", preferredInterest);

    return alloy("sendEvent", {
      renderDecisions: true,
      personalization: {
        surfaces: [SURFACE_URI],
        schemas: [CONTENT_SCHEMA],
        defaultPersonalizationEnabled: false
      },
      xdm: {
        // Use your custom event type so your AJO audience/rules can key off it if needed
        eventType: "assetClassSelection",

        web: {
          webPageDetails: {
            name: document.title || "deals",
            URL: window.location.href
          },
          webReferrer: {
            URL: document.referrer || ""
          }
        },

        // ✅ Context fields used by eligibility/ranking in AJO (Option B)
        _accenture_partner: {
          Interest: {
            PreferredInterest: preferredInterest
          },
          Scoring1: {
            M1Score: m1,
            M2Score: m2,
            TotalScore: totalScore,
            ExpOfNegTotal: expOfNegTotal,
            RandEpsilon: randEpsilon,
            NormalizationScore: normalizationScore
          }
        },

        timestamp: new Date().toISOString()
      }
    })
    .then((result) => {
      console.log("🔍 Web SDK decision response:", result);

      const proposition = pickPropositionForSurface(result);
      const item =
        proposition?.items?.find(i => i.schema === CONTENT_SCHEMA) ||
        proposition?.items?.[0];

      const content = item?.data?.content;
      const extracted = extractOffersFromAjoContent(content);

      // If offers returned -> replace runtime offers and render placements
      if (extracted?.offers && Array.isArray(extracted.offers) && extracted.offers.length) {
        RUNTIME_OFFERS = extracted.offers.map(o => normalizeOfferShape(o, o.placement));
        renderAllPlacements();
        setError("");
        setMessage(`✅ Personalized offer loaded for "${preferredInterest}".`);
        return;
      }

      // If non-offer payload returned -> show it, keep demo placements
      if (extracted?.htmlSnippet) {
        renderAjoFallbackHtml(extracted.htmlSnippet);
        setError("");
        setMessage(`✅ Personalized content loaded for "${preferredInterest}".`);
        return;
      }

      console.warn("⚠️ No usable personalization content returned. Using demo offers.");
      setMessage("⚠️ No personalized content returned. Showing demo offers.");
    })
    .catch((error) => {
      console.error("❌ sendEvent failed:", error);
      setError("Failed to load personalization (sendEvent failed). Check console/network.");
    });
  }

  function waitForAlloy(callback, retries = 60) {
    if (typeof alloy === "function") {
      console.log("✅ Alloy loaded.");
      callback();
    } else if (retries > 0) {
      setTimeout(() => waitForAlloy(callback, retries - 1), 250);
    } else {
      console.error("❌ alloy not loaded after waiting.");
      setError("Adobe Alloy did not load. Check Launch script, environment, and console errors.");
    }
  }

  // ------------------------------------------------------------
  // ✅ PAGE 1 handleSubmission() (kept exactly, plus calls personalization)
  // ------------------------------------------------------------
  function handleSubmission() {
    const selectedAssetClass =
      document.querySelector('input[name="assetclass"]:checked');

    const errorMessage = document.getElementById("error-message");
    const messageBox = document.getElementById("message");

    if (!selectedAssetClass) {
      if (errorMessage) errorMessage.textContent = "Please select a financial instrument.";
      if (messageBox) messageBox.textContent = "";
      return;
    }

    const preferredInterest = selectedAssetClass.value;

    if (errorMessage) errorMessage.textContent = "";

    // 1) Store preference (unchanged)
    localStorage.setItem("PreferredInterest", selectedAssetClass.value);
    console.log("✅ Stored in localStorage:", localStorage.getItem("PreferredInterest"));

    // 2) Simple demo math utils (client-side "data layer" compute)
    const adobeMathUtils = {
      sum: (arr) => (arr || []).reduce((a, b) => a + b, 0),
      exp: (val) => Math.exp(val),
      random: (scale = 1) => Math.random() * scale
    };

    // 3) Dummy inputs (single M1/M2 doubles for POC)
    //    You can make these deterministic per selection (helps repeatability in demos)
    const scoreMap = {
      Stocks: { m1: 0.85, m2: 0.45 },
      Bonds:  { m1: 0.25, m2: 0.60 },
      CD:     { m1: 0.10, m2: 0.15 }
    };

    const picked = scoreMap[selectedAssetClass.value] || { m1: 0.20, m2: 0.20 };
    const m1 = picked.m1;
    const m2 = picked.m2;

    // 4) Calculate total + normalizationScore
    const totalScore = m1 + m2;
    const expOfNegTotal = adobeMathUtils.exp(-totalScore);

    // same structure you described: 0.95/(1+EXP(-SUM)) + rand*0.000001
    const randEpsilon = adobeMathUtils.random() * 0.000001;
    const normalizationScore = (0.95 / (1 + expOfNegTotal)) + randEpsilon;

    console.log("🧮 Scores:", { m1, m2, totalScore, expOfNegTotal, randEpsilon, normalizationScore });

    // 5) Push event to adobeDataLayer (same as you do today), now enriched with Scoring1 fields
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push({
      event: "assetClassSelection",
      xdm: {
        eventType: "assetClassSelection",
        _accenture_partner: {
          Interest: {
            PreferredInterest: preferredInterest
          },
          Scoring1: {
            M1Score: m1,
            M2Score: m2,
            TotalScore: totalScore,
            ExpOfNegTotal: expOfNegTotal,
            RandEpsilon: randEpsilon,
            NormalizationScore: normalizationScore
          }
        }
      }
    });

    if (messageBox) {
      messageBox.textContent = `Thank you for selecting "${selectedAssetClass.value}".`;
    }

    // ✅ NEW: Trigger AJO decisioning on the same page (Page 2 logic embedded)
    waitForAlloy(() => {
      fetchPersonalization({
        preferredInterest,
        m1,
        m2,
        totalScore,
        expOfNegTotal,
        randEpsilon,
        normalizationScore
      });
    });
  }

  // Expose globally (so existing Page 1 HTML onClick="handleSubmission()" still works)
  window.handleSubmission = handleSubmission;

  // ------------------------------------------------------------
  // Boot (from Page 2 + minimal additions)
  // ------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    // Render demo immediately (no blank UI while AJO loads)
    RUNTIME_OFFERS = [...OFFERS];
    renderAllPlacements();
    attachClickHandlers();

    // Baseline data layer context
    ensureDataLayer().unshift({
      page: {
        name: document.title || "deals",
        section: "marketing",
        url: window.location.href
      }
    });

    // If you use a button with id="submitPreference", wire it automatically
    const submitBtn = document.getElementById("submitPreference");
    if (submitBtn) {
      submitBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleSubmission();
      });
    }

    // If Alloy is present, log readiness; otherwise wait will handle on submit
    if (typeof alloy === "function") {
      console.log("✅ Alloy already available.");
    } else {
      console.log("ℹ️ Alloy not yet available at DOMContentLoaded; will wait on submit.");
    }
  });
})();
