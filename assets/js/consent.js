/* ============================================================================
   POLL MASSIVHAUS - consent.js
   Consent-Management fuer massivhaus.poll-gruppe.com

   Rechtsrahmen: Paragraf 25 TDDDG, Art. 6 Abs. 1 lit. a DSGVO,
   Orientierungshilfe der Datenschutzkonferenz (DSK) zu Telemedien.

   AUFBAU
   Kompaktes Pop-up in der Bildschirmmitte. Beide Kategorien sind mit ihrem
   Schalter sofort sichtbar; die Beschreibung steht hinter dem Aufklapp-Pfeil.
   Zwei Schaltflaechen: "Alle akzeptieren" und "Auswahl speichern".

   WARUM DIE SCHALTER AUF DER ERSTEN EBENE STEHEN MUESSEN
   Es gibt keinen eigenen Ablehnen-Button. Ablehnen funktioniert, indem man
   "Marketing" ausgeschaltet laesst und "Auswahl speichern" drueckt - also
   mit EINEM Klick, genauso schnell wie Akzeptieren. Waeren die Schalter
   hinter einem "Einstellungen"-Link versteckt, braeuchte Ablehnen drei
   Klicks gegen einen fuers Akzeptieren. Genau diese Ungleichgewichtung
   beanstanden die Aufsichtsbehoerden (DSK-Orientierungshilfe; EDSA-
   Leitlinien 03/2022 zu Dark Patterns; CNIL gegen Google, Januar 2022).
   Die Schalter duerfen also NICHT wieder eingeklappt werden, solange es
   keinen separaten Ablehnen-Button gibt.

   ZWEI KATEGORIEN
     essential -> nur die Speicherung der Auswahl selbst, nicht abwaehlbar
     marketing -> Google Tag Manager UND Google Ads Conversion-Tracking

   WARUM DER TAG MANAGER IN "MARKETING" LIEGT
   Einwilligungen muessen pro ZWECK granular sein (Art. 4 Nr. 11 DSGVO,
   ErwG 43), nicht pro Werkzeug. Der Container liefert auf dieser Seite
   ausschliesslich Google-Ads-Tags aus, dient also demselben Zweck wie das
   Conversion-Tracking.

   ACHTUNG BEI SPAETEREN AENDERUNGEN
   Sobald im Container ein Dienst mit anderem Zweck liegt - GA4, Heatmaps,
   A/B-Tests -, dient der Tag Manager zwei Zwecken und die Kategorie muss
   aufgeteilt werden (dann CONSENT_VERSION hochzaehlen).

   NICHT AUFGEFUEHRT: das Anfrageformular (Web3Forms)
   Es speichert nichts auf dem Endgeraet und greift auf nichts zu -
   Paragraf 25 TDDDG ist nicht einschlaegig -, und es laeuft erst, wenn der
   Nutzer selbst absendet (Art. 6 Abs. 1 lit. b DSGVO).

   NICHT VERWENDETE SIGNALE
   functionality_storage, personalization_storage und security_storage
   bleiben dauerhaft auf "denied", weil kein Dienst sie benoetigt. Im
   Google Tag Assistant sieht das nach Fehler aus, ist aber Absicht.

   WEITERE BEWUSSTE ENTSCHEIDUNGEN
   - "Marketing" startet immer aus; vorausgewaehlte Haken waeren keine
     wirksame Einwilligung (EuGH Planet49 C-673/17, BGH I ZR 7/16)
   - der Fokus geht beim Oeffnen auf das Pop-up selbst, damit kein Button
     durch den Fokusring mehr Gewicht bekommt als der andere
   ============================================================================ */

'use strict';

(function () {

  /* ==========================================================================
     1. KONFIGURATION
     ========================================================================== */

  var GTM_ID = 'GTM-MVCTLGZT';   // Container-ID Poll Massivhaus Landingpage

  var STORAGE_KEY     = 'pollConsent';
  var CONSENT_VERSION = 4;        // Bei inhaltlicher Aenderung der Kategorien
                                  // hochzaehlen -> alle Nutzer werden erneut
                                  // gefragt.
  var VALID_DAYS      = 365;

  var PRIVACY_URL = 'datenschutz.html';
  var IMPRINT_URL = 'https://www.poll-gruppe.com/impressum';

  // Schwelle fuer das Ereignis "poll_verweildauer_1min" (siehe Abschnitt 6).
  var DWELL_MS = 60000;


  /* ==========================================================================
     2. CONSENT MODE v2  -  DEFAULT: ALLES ABGELEHNT
     Laeuft sofort beim Parsen dieser Datei, also bevor irgendein Tag
     geladen werden koennte.
     ========================================================================== */

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    ad_storage:              'denied',
    ad_user_data:            'denied',
    ad_personalization:      'denied',
    analytics_storage:       'denied',
    functionality_storage:   'denied',
    personalization_storage: 'denied',
    security_storage:        'denied',
    wait_for_update: 500
  });


  /* ==========================================================================
     3. KATEGORIEN
     ========================================================================== */

  var CATEGORIES = [
    {
      key: 'essential',
      locked: true,
      title: 'Notwendig',
      text: 'Erforderlich für den Betrieb der Website (z. B. Speicherung Ihrer Cookie-Auswahl). Kann nicht deaktiviert werden.'
    },
    {
      // Anbieteranschrift und Drittlandtransfer stehen in der
      // Datenschutzerklaerung (Ziffern 5, 6 und 8).
      key: 'marketing',
      locked: false,
      title: 'Marketing',
      text: 'Ermöglicht personalisierte Werbung und Erfolgsmessung (Google Ads und Google Tag Manager).'
    }
  ];


  /* ==========================================================================
     4. SPEICHERUNG DER ENTSCHEIDUNG
     ========================================================================== */

  function defaults() {
    return { essential: true, marketing: false };
  }

  function readConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (data.version !== CONSENT_VERSION) return null;
      var ageMs = Date.now() - new Date(data.timestamp).getTime();
      if (isNaN(ageMs) || ageMs > VALID_DAYS * 864e5) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function writeConsent(marketing) {
    var previous = readConsent();
    var data = {
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      essential: true,
      marketing: !!marketing
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
    applyConsent(data);
    window.dispatchEvent(new CustomEvent('pollConsentUpdate', { detail: data }));

    // Echter Widerruf: Ein "denied"-Signal allein genuegt nicht - bereits
    // gesetzte Cookies muessen weg und der geladene Container muss aus dem
    // Seitenkontext verschwinden. Das geht nur ueber einen Neuaufbau.
    if (previous && previous.marketing && !data.marketing) {
      clearTrackingCookies();
      if (gtmLoaded) {
        window.setTimeout(function () { window.location.reload(); }, 120);
      }
    }
    return data;
  }

  function clearTrackingCookies() {
    var host = window.location.hostname;
    var domains = ['', host, '.' + host];
    var parts = host.split('.');
    if (parts.length > 2) domains.push('.' + parts.slice(-2).join('.'));

    document.cookie.split(';').forEach(function (entry) {
      var name = entry.split('=')[0].trim();
      if (!/^(_gcl_|_gac_|_ga)/.test(name)) return;
      domains.forEach(function (d) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/' +
          (d ? '; domain=' + d : '');
      });
    });
  }


  /* ==========================================================================
     5. ANWENDEN DER ENTSCHEIDUNG
     ========================================================================== */

  var gtmLoaded = false;

  function loadGTM() {
    if (gtmLoaded) return;
    if (!GTM_ID || GTM_ID.indexOf('XXXX') > -1) return;
    gtmLoaded = true;
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(GTM_ID);
    document.head.appendChild(s);
  }

  function applyConsent(data) {
    // Alle vier Signale haengen an "Marketing": Der Container liefert nur
    // Ads-Tags aus, und die Google-Tags darin erwarten neben den drei
    // Ads-Signalen auch analytics_storage.
    var state = data.marketing ? 'granted' : 'denied';
    gtag('consent', 'update', {
      ad_storage:         state,
      ad_user_data:       state,
      ad_personalization: state,
      analytics_storage:  state
    });

    if (data.marketing) loadGTM();

    window.dataLayer.push({
      event: 'poll_consent_update',
      consent_marketing: !!data.marketing
    });

    if (data.marketing) startDwellTimer();
  }


  /* ==========================================================================
     5b. VERWEILDAUER
     Zaehlt erst, wenn die Seite tatsaechlich benutzbar ist - also nachdem
     der Nutzer im Banner entschieden hat und die blockierende Ebene weg ist.
     Gezaehlt wird nur SICHTBARE Zeit: Wechselt der Nutzer den Tab oder
     minimiert das Fenster, pausiert die Uhr (Page Visibility API).

     Der eingebaute Timer-Trigger von GTM startet dagegen mit dem Laden des
     Containers und laeuft auch im Hintergrund-Tab weiter. Deshalb im GTM den
     Tag "Verweildauer 1min+" auf einen BENUTZERDEFINIERTES-EREIGNIS-Trigger
     mit dem Ereignisnamen "poll_verweildauer_1min" umstellen.
     ========================================================================== */

  var dwellFired = false, dwellRunning = false, dwellMs = 0, dwellSince = null, dwellTick = null;

  function startDwellTimer() {
    if (dwellFired || dwellRunning) return;
    dwellRunning = true;
    dwellSince = Date.now();

    document.addEventListener('visibilitychange', onVisibility);
    dwellTick = window.setInterval(checkDwell, 1000);
    if (document.hidden) pauseDwell();
  }

  function onVisibility() {
    if (document.hidden) pauseDwell();
    else if (dwellSince === null) dwellSince = Date.now();
  }

  function pauseDwell() {
    if (dwellSince !== null) {
      dwellMs += Date.now() - dwellSince;
      dwellSince = null;
    }
  }

  function checkDwell() {
    if (dwellFired) return;
    var total = dwellMs + (dwellSince !== null ? Date.now() - dwellSince : 0);
    if (total < DWELL_MS) return;

    dwellFired = true;
    window.clearInterval(dwellTick);
    document.removeEventListener('visibilitychange', onVisibility);
    window.dataLayer.push({
      event: 'poll_verweildauer_1min',
      sichtbare_sekunden: Math.round(total / 1000)
    });
  }


  /* ==========================================================================
     6. OEFFENTLICHE API
     ========================================================================== */

  window.pollConsent = {
    get: function () {
      var c = readConsent();
      return c ? { essential: true, marketing: !!c.marketing } : defaults();
    },
    open: function () { openBanner(); },
    openSettings: function () { openBanner(); },
    onChange: function (cb) {
      window.addEventListener('pollConsentUpdate', function (e) { cb(e.detail); });
    }
  };
  window.openConsentSettings = function () { openBanner(); };

  // Jedes Element mit data-consent-open oeffnet den Banner erneut - z. B. der
  // Link "Cookie-Einstellungen" im Seitenfuss. Art. 7 Abs. 3 DSGVO: Der
  // Widerruf muss so einfach sein wie die Einwilligung, also von jeder Seite
  // aus mit einem Klick erreichbar.
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest && e.target.closest('[data-consent-open]');
    if (!trigger) return;
    e.preventDefault();
    openBanner();
  });


  /* ==========================================================================
     7. STYLES
     ========================================================================== */

  var CSS = [
    '.pc-root{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:20px;}',
    '.pc-root.is-open{display:flex;}',
    '.pc-root [hidden]{display:none !important;}',
    /* Solange das Pop-up offen ist, ist die Seite dahinter gesperrt: Der
       Schleier faengt alle Klicks ab, diese Regel verhindert zusaetzlich das
       Scrollen. Zulaessig, weil Ablehnen ein Klick bleibt - eine Cookie-Wall
       waere es nur, wenn die Seite ohne ZUSTIMMUNG unerreichbar bliebe. */
    'html.pc-locked,html.pc-locked body{overflow:hidden !important;}',
    '.pc-scrim{position:fixed;inset:0;background:rgba(28,26,23,.55);opacity:0;transition:opacity .3s ease;}',
    '.pc-root.is-open .pc-scrim{opacity:1;}',
    '.pc-box{position:relative;width:100%;max-width:500px;max-height:calc(100vh - 40px);display:flex;flex-direction:column;',
      'background:var(--white,#fff);border-radius:var(--radius-l,10px);overflow:hidden;',
      'box-shadow:0 40px 90px -30px rgba(28,26,23,.65);',
      'font-family:var(--font-body,"Inter","Helvetica Neue",Helvetica,Arial,sans-serif);color:var(--ink,#1C1A17);',
      'transform:translateY(12px) scale(.985);opacity:0;transition:transform .3s cubic-bezier(.16,.8,.24,1),opacity .3s ease;}',
    '.pc-root.is-open .pc-box{transform:none;opacity:1;}',
    /* Das Pop-up traegt den Fokus beim Oeffnen, soll dabei aber keinen Ring
       zeigen. Die Buttons behalten ihren :focus-visible-Ring. */
    '.pc-box:focus{outline:none;}',

    '.pc-head{padding:24px 26px 0;flex:none;}',
    '.pc-brand{height:24px;width:auto;margin-bottom:16px;display:block;}',
    '.pc-title{font-family:var(--font-display,inherit);font-weight:700;font-size:18px;line-height:1.3;margin:0;}',
    '.pc-intro{margin:10px 0 0;font-size:13.5px;line-height:1.6;color:var(--ink-65,rgba(28,26,23,.66));}',
    '.pc-intro a{color:var(--red,#D6001C);text-decoration:underline;text-underline-offset:2px;}',
    '.pc-intro a:hover{color:var(--red-dark,#A8001A);}',

    '.pc-body{flex:1 1 auto;overflow-y:auto;padding:16px 26px 4px;}',

    /* Kategoriezeile: Schalter links, Titel, Aufklapp-Pfeil rechts */
    '.pc-cat{border-bottom:1px solid var(--line-soft,#EEE7D8);}',
    '.pc-cat:first-child{border-top:1px solid var(--line-soft,#EEE7D8);}',
    '.pc-cat-head{display:flex;align-items:center;gap:14px;padding:13px 0;}',
    '.pc-cat-title{flex:1 1 auto;font-size:14.5px;font-weight:700;min-width:0;}',
    '.pc-chev{appearance:none;background:none;border:0;padding:4px;cursor:pointer;color:var(--ink-45,rgba(28,26,23,.46));',
      'display:flex;align-items:center;justify-content:center;border-radius:4px;flex:none;}',
    '.pc-chev:hover{color:var(--ink,#1C1A17);}',
    '.pc-chev svg{width:16px;height:16px;transition:transform .25s ease;}',
    '.pc-cat.is-open .pc-chev svg{transform:rotate(180deg);}',
    '.pc-cat-text{display:none;padding:0 0 15px;font-size:13px;line-height:1.62;color:var(--ink-65,rgba(28,26,23,.66));}',
    '.pc-cat.is-open .pc-cat-text{display:block;}',
    '.pc-hint{margin:14px 0 0;font-size:12.5px;line-height:1.5;color:var(--ink-45,rgba(28,26,23,.46));}',

    /* Schalter */
    '.pc-switch{flex:none;position:relative;width:44px;height:26px;}',
    '.pc-switch input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;}',
    '.pc-track{position:absolute;inset:0;border-radius:100px;background:#D8D0C0;transition:background .22s ease;pointer-events:none;}',
    '.pc-track::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;',
      'background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .22s cubic-bezier(.16,.8,.24,1);}',
    '.pc-switch input:checked + .pc-track{background:var(--red,#D6001C);}',
    '.pc-switch input:checked + .pc-track::after{transform:translateX(18px);}',
    /* Der gesperrte Schalter bleibt sichtbar aktiv, aber gedaempft. */
    '.pc-switch input:disabled + .pc-track{background:var(--red,#D6001C);opacity:.45;}',
    '.pc-switch input:disabled{cursor:not-allowed;}',
    '.pc-switch input:focus-visible + .pc-track{outline:2px solid var(--red,#D6001C);outline-offset:3px;}',

    /* Fusszeile */
    '.pc-foot{flex:none;padding:16px 26px 22px;}',
    '.pc-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;}',
    '.pc-btn{font-family:inherit;font-weight:700;font-size:14px;line-height:1.25;padding:13px 14px;border-radius:var(--radius-s,3px);',
      'cursor:pointer;border:1.5px solid transparent;text-align:center;',
      'display:inline-flex;align-items:center;justify-content:center;',
      'transition:background .22s ease,border-color .22s ease,color .22s ease;}',
    /* Gleiche Groesse, gleiche Position, gleiche Lesbarkeit - "Auswahl
       speichern" bei ausgeschaltetem Marketing ist das Ein-Klick-Ablehnen. */
    '.pc-btn-primary{background:var(--ink,#1C1A17);color:#fff;border-color:var(--ink,#1C1A17);}',
    '.pc-btn-primary:hover{background:#000;border-color:#000;}',
    '.pc-btn-secondary{background:var(--white,#fff);color:var(--ink,#1C1A17);border-color:var(--ink,#1C1A17);}',
    '.pc-btn-secondary:hover{background:var(--stone-50,#FAF7F1);}',
    '.pc-btn:focus-visible,.pc-chev:focus-visible{outline:2px solid var(--red,#D6001C);outline-offset:3px;}',

    '@media (max-width:540px){',
      '.pc-root{padding:0;align-items:flex-end;}',
      '.pc-box{max-width:none;max-height:92vh;border-radius:var(--radius-l,10px) var(--radius-l,10px) 0 0;}',
      '.pc-head{padding:20px 18px 0;}',
      '.pc-body{padding:14px 18px 4px;}',
      '.pc-foot{padding:14px 18px 18px;}',
      '.pc-actions{grid-template-columns:1fr;}',
    '}',
    '@media (prefers-reduced-motion:reduce){',
      '.pc-box,.pc-scrim,.pc-track::after,.pc-chev svg{transition:none;}',
    '}'
  ].join('');


  /* ==========================================================================
     8. MARKUP
     ========================================================================== */

  var CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function categoryMarkup(c) {
    return '<div class="pc-cat" data-pc-catbox="' + c.key + '">' +
      '<div class="pc-cat-head">' +
        '<label class="pc-switch">' +
          '<input type="checkbox" data-pc-cat="' + c.key + '"' + (c.locked ? ' checked disabled' : '') +
            ' aria-label="' + esc(c.title) + ' zulassen">' +
          '<span class="pc-track"></span>' +
        '</label>' +
        '<span class="pc-cat-title">' + esc(c.title) + '</span>' +
        '<button type="button" class="pc-chev" data-pc="expand" aria-expanded="false" ' +
          'aria-label="Beschreibung zu ' + esc(c.title) + ' anzeigen">' + CHEVRON + '</button>' +
      '</div>' +
      '<div class="pc-cat-text">' + esc(c.text) + '</div>' +
    '</div>';
  }


  /* ==========================================================================
     9. BANNER AUFBAUEN UND STEUERN
     ========================================================================== */

  var root = null, lastFocus = null;

  function build() {
    if (root) return;

    var style = document.createElement('style');
    style.setAttribute('data-poll-consent', '');
    style.textContent = CSS;
    document.head.appendChild(style);

    root = document.createElement('div');
    root.className = 'pc-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'pcTitle');
    root.innerHTML =
      '<div class="pc-scrim"></div>' +
      // tabindex="-1": Fokus auf das Pop-up, nicht auf einen Button.
      '<div class="pc-box" tabindex="-1">' +

        '<div class="pc-head">' +
          '<img class="pc-brand" src="assets/img/logo-positiv.svg" alt="Poll Massivhaus">' +
          '<h2 class="pc-title" id="pcTitle">Cookie-Einstellungen</h2>' +
          '<p class="pc-intro">Wir nutzen Cookies, um unsere Website technisch bereitzustellen. ' +
            'Mit Ihrer Einwilligung setzen wir außerdem Marketing-Cookies ein. Details finden Sie in unserer ' +
            '<a href="' + PRIVACY_URL + '" target="_blank" rel="noopener">Datenschutzerklärung</a> und im ' +
            '<a href="' + IMPRINT_URL + '" target="_blank" rel="noopener">Impressum</a>.</p>' +
        '</div>' +

        '<div class="pc-body">' + CATEGORIES.map(categoryMarkup).join('') +
          // Macht die Ablehnung erkennbar: Gleicher Aufwand allein genuegt
          // den Aufsichtsbehoerden nicht, der Nutzer muss auch verstehen,
          // dass "Auswahl speichern" ohne Aenderung ein Ablehnen ist
          // (EDSA-Leitlinien 03/2022 zu Dark Patterns).
          '<p class="pc-hint">Ohne Änderung speichern Sie nur die notwendigen Cookies.</p>' +
        '</div>' +

        '<div class="pc-foot">' +
          '<div class="pc-actions">' +
            '<button type="button" class="pc-btn pc-btn-primary" data-pc="accept">Alle akzeptieren</button>' +
            '<button type="button" class="pc-btn pc-btn-secondary" data-pc="save">Auswahl speichern</button>' +
          '</div>' +
        '</div>' +

      '</div>';

    document.body.appendChild(root);

    root.addEventListener('click', function (e) {
      var el = e.target.closest('[data-pc]');
      if (!el || !root.contains(el)) return;

      switch (el.getAttribute('data-pc')) {
        case 'expand': {
          var box = el.closest('.pc-cat');
          var open = box.classList.toggle('is-open');
          el.setAttribute('aria-expanded', String(open));
          break;
        }
        case 'accept':
          writeConsent(true);
          closeBanner();
          break;
        case 'save':
          writeConsent(switchState('marketing'));
          closeBanner();
          break;
      }
    });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && readConsent()) { closeBanner(); return; }

      // Fokusfalle: Ohne sie koennte man mit der Tabulatortaste hinter das
      // Pop-up auf die gesperrte Seite wandern und dort Links ausloesen.
      if (e.key !== 'Tab') return;
      var focusables = root.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled])'
      );
      if (!focusables.length) return;
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      } else if (!root.contains(document.activeElement)) {
        e.preventDefault(); first.focus();
      }
    });
  }

  function setSwitch(key, val) {
    var el = root.querySelector('[data-pc-cat="' + key + '"]');
    if (el && !el.disabled) el.checked = !!val;
  }

  function switchState(key) {
    var el = root.querySelector('[data-pc-cat="' + key + '"]');
    return !!(el && el.checked);
  }

  function openBanner() {
    build();
    setSwitch('marketing', window.pollConsent.get().marketing);

    lastFocus = document.activeElement;
    root.classList.add('is-open');
    document.documentElement.classList.add('pc-locked');
    var box = root.querySelector('.pc-box');
    if (box) box.focus({ preventScroll: true });
  }

  function closeBanner() {
    if (!root) return;
    root.classList.remove('is-open');
    document.documentElement.classList.remove('pc-locked');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
  }


  /* ==========================================================================
     10. START
     ========================================================================== */

  function init() {
    var stored = readConsent();
    if (stored) {
      applyConsent(stored);   // Bereits entschieden: anwenden, nicht fragen.
    } else {
      openBanner();           // Noch nichts entschieden: nichts laden, fragen.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
