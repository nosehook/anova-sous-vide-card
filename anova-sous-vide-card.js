/*
 * anova-sous-vide-card  v1.0.0
 * Lovelace card for an Anova Precision Cooker (sous vide stick), styled after
 * custom:appliance-washer-card from skyrotter/ha-appliance-electromenager-cards.
 *
 * Works with the core Home Assistant "anova" integration (+ optional smart plug).
 *
 *   type: custom:anova-sous-vide-card
 *   name: Sous vide
 *   state: sensor.anova_precision_cooker_staat              # preheating/cooking/maintaining/...
 *   mode: sensor.anova_precision_cooker_modus               # idle/cook/low_water/...
 *   water_temp: sensor.anova_precision_cooker_watertemperatuur
 *   target_temp: sensor.anova_precision_cooker_target_temperature
 *   remaining: sensor.anova_precision_cooker_kooktijd_resterend
 *   cook_time: sensor.anova_precision_cooker_kooktijd       # optional, for progress bar
 *   switch: switch.sous_vide                                # optional, power button
 *   power: sensor.sous_vide_vermogen                        # optional
 *   energy: sensor.sous_vide_energie                        # optional
 *   confirm_off: true                                       # ask twice before switching off
 *   start_temp: 20                                          # tap-water temp, for the preheat bar
 */
(() => {
  const VERSION = "1.0.0";

  const STATE_LABELS = {
    nl: {
      off: "Uit", idle: "Stand-by", offline: "Niet verbonden", preheating: "Voorverwarmen",
      cooking: "Garen", maintaining: "Op temperatuur", timer_expired: "Klaar", set_timer: "Timer instellen",
      no_state: "Actief", low_water: "Waterniveau te laag", high_temp: "Temperatuur te hoog",
      device_failure: "Storing", ota: "Update bezig", startup: "Opstarten", provisioning: "Instellen",
      water: "Water", target: "Doel", remaining: "Resterend", ready_at: "Klaar om", power: "Vermogen",
      energy: "Energie", onoff: "Aan/uit", confirm: "Nogmaals tikken om uit te zetten",
    },
    en: {
      off: "Off", idle: "Idle", offline: "Offline", preheating: "Preheating",
      cooking: "Cooking", maintaining: "Holding", timer_expired: "Done", set_timer: "Set timer",
      no_state: "Active", low_water: "Low water", high_temp: "Temperature too high",
      device_failure: "Device failure", ota: "Updating", startup: "Starting", provisioning: "Provisioning",
      water: "Water", target: "Target", remaining: "Remaining", ready_at: "Ready at", power: "Power",
      energy: "Energy", onoff: "On/off", confirm: "Tap again to switch off",
    },
  };

  const DEFAULTS = {
    name: "Sous vide",
    state: "sensor.anova_precision_cooker_staat",
    mode: "sensor.anova_precision_cooker_modus",
    water_temp: "sensor.anova_precision_cooker_watertemperatuur",
    target_temp: "sensor.anova_precision_cooker_target_temperature",
    remaining: "sensor.anova_precision_cooker_kooktijd_resterend",
    cook_time: "sensor.anova_precision_cooker_kooktijd",
    confirm_off: true,
  };

  const BAD = new Set(["unavailable", "unknown", "none", "", undefined, null]);

  const toSeconds = (st) => {
    if (!st || BAD.has(st.state)) return null;
    const raw = String(st.state);
    if (/^\d{1,3}:\d{2}(:\d{2})?$/.test(raw)) {
      const p = raw.split(":").map(Number);
      return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 3600 + p[1] * 60;
    }
    const v = parseFloat(raw);
    if (isNaN(v)) return null;
    const u = (st.attributes.unit_of_measurement || "s").toLowerCase();
    if (u === "min") return v * 60;
    if (u === "h") return v * 3600;
    if (u === "d") return v * 86400;
    if (u === "ms") return v / 1000;
    return v;
  };

  const fmtDur = (s) => {
    if (s == null) return "—";
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${String(m).padStart(2, "0")} u` : `${m} min`;
  };

  const num = (st) => (st && !BAD.has(st.state) && !isNaN(parseFloat(st.state)) ? parseFloat(st.state) : null);

  const CSS = `
    :host {
      --ac-active: var(--appliance-active-color, var(--state-active-color, var(--primary-color)));
      --ac-heat: var(--appliance-heat-color, var(--state-climate-heat-color, #ff8a3d));
      --ac-cold: var(--appliance-cold-color, var(--state-climate-cool-color, #2b9af9));
      --ac-alert: var(--appliance-alert-color, var(--error-color, #db4437));
      --ac-ok: var(--appliance-ok-color, var(--success-color, #43a047));
      display: block; height: 100%;
    }
    [hidden] { display: none !important; }
    ha-card { display: flex; flex-direction: column; justify-content: safe center; height: 100%;
      cursor: pointer; overflow: hidden; container-type: inline-size; }
    .wrap { padding: 14px; display: flex; flex-direction: column; gap: 12px; --c: var(--ac-active); }
    .wrap.st-preheating { --c: var(--ac-heat); }
    .wrap.st-cooking, .wrap.st-maintaining { --c: var(--ac-active); }
    .wrap.st-timer_expired { --c: var(--ac-ok); }
    .wrap.alert { --c: var(--ac-alert); }
    .top { display: grid; grid-template-columns: auto minmax(0,1fr);
      grid-template-areas: "illus head" "illus stats"; gap: 10px 14px; align-items: start; min-width: 0; }
    .illus { grid-area: illus; width: var(--appliance-illustration-size, 116px); aspect-ratio: 120/140;
      border-radius: 16px; padding: 4px; box-sizing: content-box;
      background: radial-gradient(circle at 50% 40%, rgba(127,127,127,.1), rgba(127,127,127,.03) 70%); }
    .illus svg { width: 100%; height: 100%; display: block; overflow: visible; }
    .st-offline .illus, .st-off .illus { opacity: .55; filter: grayscale(.85); }
    .head { grid-area: head; display: flex; gap: 8px; align-items: flex-start; min-width: 0; }
    .info { flex: 1 1 0%; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .name { font-size: 16px; font-weight: 600; color: var(--primary-text-color);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .status { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--secondary-text-color); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--disabled-text-color, #888); flex: none; }
    .active .dot { background: var(--c); box-shadow: 0 0 0 0 var(--c); animation: ac-ping 1.8s infinite; }
    .alert-line { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--ac-alert); font-weight: 600; }
    .alert-line ha-icon { --mdc-icon-size: 16px; }
    .toggle { width: 36px; height: 36px; border-radius: 50%; border: none; display: grid; place-items: center;
      cursor: pointer; color: var(--secondary-text-color); background: rgba(127,127,127,.14);
      transition: background .2s, color .2s; flex: none; }
    .toggle.on { color: var(--text-primary-color, #fff); background: var(--c); }
    .toggle.confirm { color: #fff; background: var(--ac-alert); animation: ac-pulse 1s ease-in-out infinite; }
    .toggle ha-icon { --mdc-icon-size: 20px; }
    .stats { grid-area: stats; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 6px; }
    .tile { display: flex; flex-direction: column; padding: 6px 9px; border-radius: 10px; min-width: 0;
      background: var(--ac-tile-bg, rgba(127,127,127,.09)); }
    .tile:hover { background: var(--ac-tile-bg, rgba(127,127,127,.16)); }
    .val { font-size: 14px; font-weight: 600; color: var(--primary-text-color); white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
    .lbl { display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; }
    .lbl ha-icon { --mdc-icon-size: 13px; color: var(--c); }
    .tile.hot .val { color: var(--ac-heat); }
    .bar { height: 6px; border-radius: 3px; background: rgba(127,127,127,.15); overflow: hidden; }
    .bar > div { height: 100%; border-radius: 3px; background: var(--c); transition: width .6s ease; }
    .barline { display: flex; justify-content: space-between; font-size: 11px; color: var(--secondary-text-color); margin-top: -6px; }
    @keyframes ac-ping { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--c) 60%, transparent); }
      80%,100% { box-shadow: 0 0 0 6px transparent; } }
    @keyframes ac-pulse { 50% { filter: brightness(1.25); } }

    /* ---- illustration ---- */
    .lcd { font: 700 6.6px/1 "Courier New", ui-monospace, monospace; fill: #f2f6f8; letter-spacing: .3px; }
    .lcd-sub { font: 600 3.2px/1 sans-serif; fill: #9aa7ad; }
    .st-off .lcd, .st-offline .lcd { fill: #3a3f44; }
    .st-timer_expired .lcd { fill: #3ddc84; }
    .alert .lcd { fill: #ff6b5b; }
    .led { fill: #23344a; }
    .active .led, .st-idle .led { fill: #2b9af9; filter: drop-shadow(0 0 1.6px #2b9af9); }
    .st-preheating .led { animation: led-blink 1.4s ease-in-out infinite; }
    .alert .led { fill: #ff4d3d; filter: drop-shadow(0 0 1.6px #ff4d3d); }
    @keyframes led-blink { 50% { opacity: .25; } }
    .water { fill: url(#asv-water); }
    .wave { fill: rgba(170,215,240,.35); }
    .active .wave { animation: wave 3.2s ease-in-out infinite; }
    @keyframes wave { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-6px); } }
    .bub { fill: rgba(255,255,255,.75); opacity: 0; }
    .active .bub { animation: bub 2.4s ease-in infinite; }
    .active .bub.b2 { animation-delay: .6s; } .active .bub.b3 { animation-delay: 1.2s; }
    .active .bub.b4 { animation-delay: 1.8s; } .active .bub.b5 { animation-delay: .9s; }
    @keyframes bub { 0% { opacity: 0; transform: translateY(0); } 15% { opacity: .9; }
      100% { opacity: 0; transform: translateY(-34px); } }
    .heat { fill: url(#asv-heat); opacity: 0; transition: opacity .8s; }
    .st-preheating .heat { opacity: .9; animation: heat 2s ease-in-out infinite; }
    .st-cooking .heat, .st-maintaining .heat { opacity: .45; }
    @keyframes heat { 50% { opacity: .45; } }
    .steam { fill: none; stroke: rgba(220,230,240,.55); stroke-width: 1.4; stroke-linecap: round; opacity: 0; }
    .st-preheating .steam, .st-cooking .steam, .st-maintaining .steam { animation: steam 3s ease-out infinite; }
    .steam.s2 { animation-delay: 1s !important; } .steam.s3 { animation-delay: 2s !important; }
    @keyframes steam { 0% { opacity: 0; transform: translateY(4px); } 30% { opacity: .8; }
      100% { opacity: 0; transform: translateY(-10px); } }
    .done-ring { fill: none; stroke: #3ddc84; stroke-width: 1.2; opacity: 0; }
    .st-timer_expired .done-ring { animation: done 1.6s ease-out infinite; }
    @keyframes done { 0% { opacity: .9; r: 16; } 100% { opacity: 0; r: 24; } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
  `;

  const SVG = `
  <svg viewBox="0 0 120 140" aria-hidden="true">
    <defs>
      <linearGradient id="asv-water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#bfe3f5" stop-opacity=".38"/>
        <stop offset="1" stop-color="#8fc7e6" stop-opacity=".22"/>
      </linearGradient>
      <radialGradient id="asv-heat" cx=".5" cy=".55" r=".55">
        <stop offset="0" stop-color="#ff8a3d" stop-opacity=".55"/>
        <stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="asv-steel" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#8d949a"/><stop offset=".3" stop-color="#e9edf0"/>
        <stop offset=".55" stop-color="#b9c0c6"/><stop offset="1" stop-color="#6f777e"/>
      </linearGradient>
      <linearGradient id="asv-body" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#050505"/><stop offset=".35" stop-color="#2a2a2a"/>
        <stop offset=".6" stop-color="#151515"/><stop offset="1" stop-color="#000"/>
      </linearGradient>
      <linearGradient id="asv-box" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e8f1f6" stop-opacity=".16"/>
        <stop offset="1" stop-color="#e8f1f6" stop-opacity=".07"/>
      </linearGradient>
      <clipPath id="asv-clip"><path d="M17 68 H103 L100 129 Q100 133 96 133 H24 Q20 133 20 129 Z"/></clipPath>
    </defs>

    <!-- steam above lid -->
    <path class="steam s1" d="M30 60 q-3 -5 0 -9 q3 -4 0 -8"/>
    <path class="steam s2" d="M88 60 q-3 -5 0 -9 q3 -4 0 -8"/>
    <path class="steam s3" d="M96 60 q-3 -5 0 -9 q3 -4 0 -8"/>

    <!-- container (Cambro style, transparent) -->
    <path d="M17 68 H103 L100 129 Q100 133 96 133 H24 Q20 133 20 129 Z"
          fill="url(#asv-box)" stroke="rgba(225,238,245,.55)" stroke-width="1"/>
    <g clip-path="url(#asv-clip)">
      <rect class="water" x="10" y="76" width="100" height="60"/>
      <path class="wave" d="M8 77 q6 -2 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 V80 H8 Z"/>
      <ellipse class="heat" cx="60" cy="106" rx="36" ry="24"/>
      <circle class="bub b1" cx="50" cy="118" r="1.3"/>
      <circle class="bub b2" cx="70" cy="122" r="1"/>
      <circle class="bub b3" cx="47" cy="124" r="0.9"/>
      <circle class="bub b4" cx="73" cy="114" r="1.2"/>
      <circle class="bub b5" cx="62" cy="126" r="1"/>
    </g>
    <!-- bottom ribs -->
    <path d="M32 128 h56" stroke="rgba(225,238,245,.25)" stroke-width="1.5" stroke-linecap="round"/>

    <!-- lid -->
    <path d="M9 61 H111 Q113 61 112 64 L110 68 H10 L8 64 Q7 61 9 61 Z"
          fill="rgba(232,242,248,.22)" stroke="rgba(225,238,245,.6)" stroke-width="1"/>
    <path d="M22 64.5 H98" stroke="rgba(255,255,255,.25)" stroke-width=".8"/>

    <!-- steel lower part -->
    <rect x="52.5" y="56" width="15" height="54" rx="1.5" fill="url(#asv-steel)"/>
    <path d="M52.5 86 H67.5" stroke="rgba(0,0,0,.18)" stroke-width=".5"/>
    <text x="60" y="84.6" text-anchor="middle" style="font:600 2.2px sans-serif;fill:#5c656c">MIN</text>
    <!-- black cap at the bottom -->
    <rect x="53.5" y="108" width="13" height="5" rx="2" fill="#111"/>
    <!-- lid clip around stick -->
    <path d="M49 61 h22 l-2 5 h-18 Z" fill="rgba(232,242,248,.35)" stroke="rgba(225,238,245,.6)" stroke-width=".6"/>

    <!-- collar -->
    <rect x="49.5" y="47" width="21" height="9" rx="1.5" fill="#141414"/>
    <rect x="51" y="55.5" width="18" height="2.2" fill="#c9d0d5"/>

    <!-- body / handle (tapers like the Anova) -->
    <path d="M44.5 20 Q44 16 48 14 H72 Q76 16 75.5 20 L70.5 47 H49.5 Z" fill="url(#asv-body)"/>
    <rect class="led" x="58.9" y="29" width="2.2" height="8" rx="1.1"/>

    <!-- head with round display -->
    <ellipse cx="60" cy="13" rx="17.5" ry="9.5" fill="#0d0d0d"/>
    <ellipse cx="60" cy="11.6" rx="16.5" ry="8.2" fill="#000" stroke="#2a2a2a" stroke-width=".5"/>
    <text class="lcd-sub" x="60" y="5.6" text-anchor="middle">ANOVA</text>
    <text class="lcd" id="lcd" x="60" y="13.6" text-anchor="middle">--.-°</text>
    <text class="lcd-sub" x="60" y="18.2" text-anchor="middle">−   ▶   +</text>
    <circle class="done-ring" cx="60" cy="12" r="16"/>
  </svg>`;

  class AnovaSousVideCard extends HTMLElement {
    static getStubConfig() { return { ...DEFAULTS, switch: "", power: "", energy: "" }; }

    setConfig(config) {
      if (!config) throw new Error("Invalid configuration");
      this._config = { ...DEFAULTS, ...config };
      this._lang = (this._config.language || "nl").startsWith("en") ? "en" : "nl";
      this._built = false;
      this._confirm = false;
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._built) this._build();
      this._update();
    }

    getCardSize() { return 3; }
    getGridOptions() { return { columns: 6, rows: 3, min_columns: 6 }; }

    t(k) { return STATE_LABELS[this._lang][k] || k; }
    st(id) { return id && this._hass ? this._hass.states[id] : undefined; }

    _build() {
      const root = this.shadowRoot || this.attachShadow({ mode: "open" });
      root.innerHTML = `
        <style>${CSS}</style>
        <ha-card>
          <div class="wrap" id="wrap">
            <div class="top">
              <div class="illus">${SVG}</div>
              <div class="head">
                <div class="info">
                  <div class="name" id="name"></div>
                  <div class="status"><span class="dot"></span><span id="status"></span></div>
                  <div class="alert-line" id="alert" hidden><ha-icon icon="mdi:alert-circle-outline"></ha-icon><span id="alerttxt"></span></div>
                </div>
                <button class="toggle" id="toggle" hidden><ha-icon icon="mdi:power"></ha-icon></button>
              </div>
              <div class="stats" id="stats"></div>
            </div>
            <div id="progress" hidden>
              <div class="bar"><div id="barfill" style="width:0%"></div></div>
            </div>
            <div class="barline" id="barline" hidden><span id="barl"></span><span id="barr"></span></div>
          </div>
        </ha-card>`;
      this.$ = (id) => root.getElementById(id);
      root.querySelector("ha-card").addEventListener("click", (e) => {
        const tile = e.target.closest(".tile");
        if (e.target.closest(".toggle")) return;
        this._moreInfo(tile?.dataset.entity || this._config.entity || this._config.state);
      });
      this.$("toggle").addEventListener("click", (e) => { e.stopPropagation(); this._toggle(); });
      this._built = true;
    }

    _moreInfo(entityId) {
      if (!entityId) return;
      this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
    }

    _toggle() {
      const sw = this.st(this._config.switch);
      if (!sw) return;
      const isOn = sw.state === "on";
      if (isOn && this._config.confirm_off !== false && !this._confirm) {
        this._confirm = true;
        this._update();
        clearTimeout(this._ct);
        this._ct = setTimeout(() => { this._confirm = false; this._update(); }, 4000);
        return;
      }
      this._confirm = false;
      clearTimeout(this._ct);
      const [domain] = this._config.switch.split(".");
      this._hass.callService(domain === "light" ? "light" : "homeassistant", isOn ? "turn_off" : "turn_on",
        { entity_id: this._config.switch });
    }

    _derive() {
      const c = this._config;
      const sw = this.st(c.switch);
      const state = this.st(c.state);
      const mode = this.st(c.mode);
      const water = num(this.st(c.water_temp));
      const target = num(this.st(c.target_temp));
      const remaining = toSeconds(this.st(c.remaining));
      const cookTime = toSeconds(this.st(c.cook_time));
      const power = num(this.st(c.power));
      const plugOff = sw && sw.state === "off";
      const offline = !state || BAD.has(state.state);
      const m = mode && !BAD.has(mode.state) ? mode.state : null;
      let key, alert = null;

      if (plugOff) key = "off";
      else if (offline) key = power != null && power > 5 ? "cooking" : "offline";
      else if (["low_water", "high_temp", "device_failure"].includes(m)) { key = m; alert = this.t(m); }
      else if (["ota", "startup", "provisioning"].includes(m)) key = m;
      else if (m === "idle") key = state.state === "timer_expired" ? "timer_expired" : "idle";
      else key = state.state;

      const active = ["preheating", "cooking", "maintaining", "set_timer", "no_state"].includes(key);
      return { key, alert, active, water, target, remaining, cookTime, power, sw };
    }

    _update() {
      if (!this._built || !this._hass) return;
      const c = this._config;
      const d = this._derive();
      const wrap = this.$("wrap");
      wrap.className = `wrap st-${d.key}${d.active ? " active" : ""}${d.alert ? " alert" : ""}`;
      this.$("name").textContent = c.name;
      this.$("status").textContent = this.t(d.key);
      this.$("alert").hidden = !d.alert;
      this.$("alerttxt").textContent = d.alert || "";

      // LCD on the stick shows the water temperature (like the real display)
      const lcd = this.$("lcd") || this.shadowRoot.querySelector("#lcd");
      const showTemp = d.water ?? d.target;
      lcd.textContent = d.key === "off" || d.key === "offline" ? "--.-°"
        : d.key === "timer_expired" ? "DONE" : showTemp != null ? `${showTemp.toFixed(1)}°` : "--.-°";

      // toggle button
      const tg = this.$("toggle");
      tg.hidden = !d.sw;
      if (d.sw) {
        tg.className = `toggle${d.sw.state === "on" ? " on" : ""}${this._confirm ? " confirm" : ""}`;
        tg.title = this._confirm ? this.t("confirm") : this.t("onoff");
        tg.setAttribute("aria-pressed", d.sw.state === "on");
      }

      // tiles
      const unit = this.st(c.water_temp)?.attributes.unit_of_measurement || "°C";
      const fmtT = (v) => (v == null ? "—" : `${v.toFixed(1)} ${unit}`);
      const tiles = [
        { e: c.water_temp, v: fmtT(d.water), l: this.t("water"), i: "mdi:thermometer-water",
          hot: d.key === "preheating" },
        { e: c.target_temp, v: fmtT(d.target), l: this.t("target"), i: "mdi:target" },
        { e: c.remaining, v: d.remaining ? fmtDur(d.remaining) : "—", l: this.t("remaining"), i: "mdi:timer-sand" },
      ];
      if (d.remaining && d.active) {
        const end = new Date(Date.now() + d.remaining * 1000);
        tiles.push({ e: c.remaining, v: end.toLocaleTimeString(this._hass.locale?.language || "nl",
          { hour: "2-digit", minute: "2-digit" }), l: this.t("ready_at"), i: "mdi:clock-check-outline" });
      } else if (c.power) {
        tiles.push({ e: c.power, v: d.power == null ? "—" : `${Math.round(d.power)} W`, l: this.t("power"), i: "mdi:flash" });
      } else if (c.energy) {
        const en = num(this.st(c.energy));
        tiles.push({ e: c.energy, v: en == null ? "—" : `${en.toFixed(2)} kWh`, l: this.t("energy"), i: "mdi:lightning-bolt-circle" });
      }
      const html = tiles.map((t) => `<div class="tile${t.hot ? " hot" : ""}" data-entity="${t.e || ""}">
          <span class="val">${t.v}</span><span class="lbl"><ha-icon icon="${t.i}"></ha-icon>${t.l}</span></div>`).join("");
      if (html !== this._lastTiles) { this.$("stats").innerHTML = html; this._lastTiles = html; }

      // progress bar: preheat = water/target, cooking = elapsed/cook time
      let pct = null, l = "", r = "";
      if (d.key === "preheating" && d.water != null && d.target) {
        const start = Math.min(this._config.start_temp ?? 20, d.target - 1);
        pct = ((d.water - start) / Math.max(0.1, d.target - start)) * 100;
        l = `${this.t("preheating")}…`; r = `${d.water.toFixed(1)} / ${d.target.toFixed(1)}°`;
      } else {
        if (d.active && d.remaining != null && d.cookTime) {
          pct = (1 - d.remaining / d.cookTime) * 100;
          l = this.t(d.key); r = `${fmtDur(d.cookTime - d.remaining)} / ${fmtDur(d.cookTime)}`;
        }
      }
      this.$("progress").hidden = pct == null;
      this.$("barline").hidden = pct == null;
      if (pct != null) {
        this.$("barfill").style.width = `${Math.max(0, Math.min(100, pct)).toFixed(1)}%`;
        this.$("barl").textContent = l; this.$("barr").textContent = r;
      }
    }
  }

  if (!customElements.get("anova-sous-vide-card")) {
    customElements.define("anova-sous-vide-card", AnovaSousVideCard);
    window.customCards = window.customCards || [];
    window.customCards.push({
      type: "anova-sous-vide-card",
      name: "Anova Sous Vide Card",
      description: "Animated card for the Anova Precision Cooker (washer-card style).",
      preview: true,
    });
    console.info(`%c ANOVA-SOUS-VIDE-CARD %c v${VERSION} `, "background:#111;color:#2b9af9", "background:#2b9af9;color:#fff");
  }
})();
