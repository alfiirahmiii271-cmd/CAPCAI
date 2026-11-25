(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const numberFmt = new Intl.NumberFormat("en-US");
  const compactFmt = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  });
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const metaContent = (name, fallback) => {
    const value = $(`meta[name="${name}"]`)?.content?.trim();
    return value || fallback;
  };

  const CONFIG = {
    siteKey: metaContent("cap-site-key", "69083029a7"),
    widgetBaseUrl: metaContent("cap-widget-base-url", "http://localhost:3000").replace(/\/+$/, ""),
    statsEndpoint: "/api/stats",
    statsPollMs: 30000,
    logIntervalMs: 6200,
    maxLogs: 12
  };

  const DEMO_STATS = {
    challenges: 1420,
    verified: 1380,
    failed: 40,
    avgDuration: "0.8s",
    blockRate: "2.8%",
    botDetected: 15
  };

  const BUILTIN_KEYS = {
    [CONFIG.siteKey]: {
      name: "Captcha_projek_fix",
      environment: "Production",
      stats: null
    },
    cap_staging_7f2: {
      name: "Captcha_projek",
      environment: "Staging",
      stats: {
        challenges: 326,
        verified: 313,
        failed: 13,
        avgDuration: "0.7s",
        blockRate: "4.0%",
        botDetected: 6
      }
    },
    cap_dev_local: {
      name: "Localhost Dev",
      environment: "Development",
      stats: {
        challenges: 84,
        verified: 84,
        failed: 0,
        avgDuration: "0.4s",
        blockRate: "0.0%",
        botDetected: 0
      }
    }
  };

  const COUNTRIES = [
    { flag: "🇮🇩", name: "Indonesia", code: "ID", share: 66 },
    { flag: "🇸🇬", name: "Singapura", code: "SG", share: 12 },
    { flag: "🇲🇾", name: "Malaysia", code: "MY", share: 8 },
    { flag: "🇺🇸", name: "Amerika Serikat", code: "US", share: 7 },
    { flag: "🌐", name: "Lainnya", code: "—", share: 7 }
  ];

  const NETWORKS = [
    { name: "Telkomsel", asn: "AS23693", share: 38 },
    { name: "Indosat Ooredoo", asn: "AS4761", share: 24 },
    { name: "Amazon AWS", asn: "AS16509", share: 14 },
    { name: "Cloudflare", asn: "AS13335", share: 11 },
    { name: "Biznet Networks", asn: "AS17451", share: 8 },
    { name: "Lainnya", asn: "—", share: 5 }
  ];

  const DEVICES = [
    { label: "Desktop", value: 62, color: "#22d3ee" },
    { label: "Mobile", value: 33, color: "#a78bfa" },
    { label: "Tablet", value: 5, color: "#fbbf24" }
  ];

  const OPERATING_SYSTEMS = [
    { name: "Windows", icon: "windows", tone: "cyan", share: 54 },
    { name: "Android", icon: "smartphone", tone: "green", share: 24 },
    { name: "macOS", icon: "apple", tone: "purple", share: 10 },
    { name: "iOS", icon: "apple", tone: "blue", share: 7 },
    { name: "Linux", icon: "linux", tone: "amber", share: 5 }
  ];

  const LOG_STATUS = {
    verified: {
      label: "Terverifikasi",
      icon: "check-circle",
      actions: ["Token valid", "Verifikasi berhasil", "Sesi aman"]
    },
    failed: {
      label: "Gagal",
      icon: "x-circle",
      actions: ["Token kedaluwarsa", "Token tidak valid", "Verifikasi ditolak"]
    },
    blocked: {
      label: "Diblokir",
      icon: "ban",
      actions: ["Bot terdeteksi", "Replay attack", "Rate limit terlampaui"]
    },
    warning: {
      label: "Waspada",
      icon: "alert-triangle",
      actions: ["Risk score tinggi", "IP mencurigakan", "Pola tidak wajar"]
    }
  };

  const LOG_LOCATIONS = [
    { flag: "🇮🇩", city: "Jakarta, ID", prefixes: ["103.28", "36.72", "114.10"] },
    { flag: "🇮🇩", city: "Bandung, ID", prefixes: ["103.28", "114.10", "180.243"] },
    { flag: "🇮🇩", city: "Surabaya, ID", prefixes: ["36.72", "114.10", "125.160"] },
    { flag: "🇸🇬", city: "Singapura, SG", prefixes: ["13.212", "52.74", "54.169"] },
    { flag: "🇲🇾", city: "Kuala Lumpur, MY", prefixes: ["175.139", "115.164", "60.48"] },
    { flag: "🇺🇸", city: "Virginia, US", prefixes: ["3.80", "44.192", "52.0"] }
  ];

  const LOG_DEVICES = [
    "Chrome · Windows",
    "Chrome · Android",
    "Safari · iOS",
    "Firefox · Linux",
    "Edge · Windows",
    "Safari · macOS"
  ];

  const RULES_DEFAULTS = {
    difficulty: "sedang",
    retention: "30",
    rateMax: 60,
    rateWindow: 60,
    botProtection: true,
    blockDatacenter: true,
    geoBlock: false,
    geoList: "CN, RU",
    webhook: ""
  };

  const state = {
    activeView: "activity",
    activeKey: CONFIG.siteKey,
    primaryStats: { ...DEMO_STATS },
    stats: { ...DEMO_STATS },
    source: "demo",
    customKeys: [],
    trafficChart: null,
    deviceChart: null,
    logs: [],
    logFilter: "all",
    logsPaused: false,
    logTimer: null,
    lastUpdated: null,
    rules: { ...RULES_DEFAULTS }
  };

  const iconUse = (name, className = "icon") =>
    `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const pad = (value) => String(value).padStart(2, "0");

  const formatClock = (date) =>
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

  const formatDate = (date) =>
    date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const randomInt = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const pick = (items) => items[randomInt(0, items.length - 1)];

  const storageGet = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return fallback;
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  const storageSet = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      return false;
    }
    return true;
  };

  const storageRemove = (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      return;
    }
  };

  function emptyStats() {
    return {
      challenges: 0,
      verified: 0,
      failed: 0,
      avgDuration: "0.0s",
      blockRate: "0.0%",
      botDetected: 0
    };
  }

  function toNumber(value, fallback = 0) {
    const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeStats(input) {
    const source = { ...DEMO_STATS, ...(input || {}) };
    const challenges = Math.max(0, Math.round(toNumber(source.challenges, DEMO_STATS.challenges)));
    const failed = clamp(Math.round(toNumber(source.failed, 0)), 0, challenges);
    const verified = clamp(
      Math.round(toNumber(source.verified, challenges - failed)),
      0,
      challenges
    );
    const botDetected = Math.max(0, Math.round(toNumber(source.botDetected, 0)));
    const avgDuration =
      typeof source.avgDuration === "string" && source.avgDuration.trim()
        ? source.avgDuration.trim()
        : "0.0s";
    const blockRate =
      typeof source.blockRate === "string" && source.blockRate.trim()
        ? source.blockRate.trim()
        : "0.0%";

    return {
      challenges,
      verified,
      failed,
      avgDuration,
      blockRate,
      botDetected
    };
  }

  function computeRisk(stats) {
    const total = Math.max(stats.challenges, 1);
    const failureRate = (stats.failed / total) * 100;
    const botRate = (stats.botDetected / total) * 100;
    const score = clamp(Math.round(failureRate * 5 + botRate * 2.5), 0, 100);

    if (score < 25) return { label: "Rendah", tone: "green", score };
    if (score < 50) return { label: "Sedang", tone: "amber", score };
    if (score < 75) return { label: "Tinggi", tone: "red", score };
    return { label: "Kritis", tone: "red", score };
  }

  function getKeyProfiles() {
    const builtins = Object.entries(BUILTIN_KEYS).map(([key, profile]) => ({
      key,
      name: profile.name,
      environment: profile.environment,
      stats: profile.stats,
      custom: false
    }));
    return [...builtins, ...state.customKeys];
  }

  function getKeyProfile(key) {
    return getKeyProfiles().find((profile) => profile.key === key);
  }

  function getProfileStats(profile) {
    if (!profile) return emptyStats();
    if (profile.key === CONFIG.siteKey) return state.primaryStats;
    return normalizeStats(profile.stats || emptyStats());
  }

  function renderKeyList(query = "") {
    const list = $("#keyList");
    if (!list) return;

    const needle = query.trim().toLowerCase();
    const profiles = getKeyProfiles().filter((profile) => {
      if (!needle) return true;
      return (
        profile.name.toLowerCase().includes(needle) ||
        profile.key.toLowerCase().includes(needle) ||
        profile.environment.toLowerCase().includes(needle)
      );
    });

    if (profiles.length === 0) {
      list.innerHTML = '<li class="key-empty">Site key tidak ditemukan.</li>';
      return;
    }

    list.innerHTML = profiles
      .map((profile) => {
        const stats = getProfileStats(profile);
        const envLabel =
          profile.environment === "Production"
            ? "Prod"
            : profile.environment === "Staging"
              ? "Stage"
              : "Dev";
        const active = profile.key === state.activeKey;

        return `
          <li>
            <button class="key-card${active ? " is-active" : ""}" type="button" data-key="${escapeHtml(profile.key)}">
              <span class="key-dot"></span>
              <span class="key-copy">
                <span class="key-name">${escapeHtml(profile.name)}</span>
                <span class="key-meta">${numberFmt.format(stats.verified)} verifikasi</span>
              </span>
              <span class="env-badge">${envLabel}</span>
            </button>
          </li>
        `;
      })
      .join("");
  }

  function updateHeaderKey() {
    const key = state.activeKey;
    ["activeKeyCode", "integrationSiteKey", "rulesSiteKey"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.textContent = key;
    });
  }

  function animateNumber(element, value, animate = true) {
    if (!element) return;

    const target = Math.max(0, Math.round(Number(value) || 0));
    const from = Number(element.dataset.value ?? 0);

    if (!animate || prefersReducedMotion || from === target) {
      element.textContent = numberFmt.format(target);
      element.dataset.value = String(target);
      return;
    }

    cancelAnimationFrame(element._raf || 0);
    const startedAt = performance.now();
    const duration = 620;

    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const valueNow = Math.round(from + (target - from) * eased);
      element.textContent = numberFmt.format(valueNow);

      if (progress < 1) {
        element._raf = requestAnimationFrame(step);
      } else {
        element.dataset.value = String(target);
        element.textContent = numberFmt.format(target);
      }
    };

    element._raf = requestAnimationFrame(step);
  }

  function applyStats(input, options = {}) {
    const stats = normalizeStats(input);
    state.stats = stats;

    const total = Math.max(stats.challenges, 1);
    const successRate = stats.challenges === 0 ? 0 : (stats.verified / total) * 100;
    const failureRate = stats.challenges === 0 ? 0 : (stats.failed / total) * 100;
    const risk = computeRisk(stats);
    const animate = options.animate !== false;

    animateNumber($("#mChallenges"), stats.challenges, animate);
    animateNumber($("#mVerified"), stats.verified, animate);
    animateNumber($("#mFailed"), stats.failed, animate);
    animateNumber($("#mBotBlocked"), stats.botDetected, animate);

    const challengesFoot = $("#mChallengesFoot");
    if (challengesFoot) {
      challengesFoot.innerHTML = `${iconUse("zap")} Rentang 07:00–14:00`;
    }

    const verifiedFoot = $("#mVerifiedFoot");
    if (verifiedFoot) {
      verifiedFoot.innerHTML = `${iconUse("trend-up")} <span class="positive">${successRate.toFixed(1)}%</span> tingkat sukses`;
    }

    const failedFoot = $("#mFailedFoot");
    if (failedFoot) {
      failedFoot.innerHTML = `${iconUse("alert-triangle")} ${failureRate.toFixed(1)}% failure rate`;
    }

    const duration = $("#mDuration");
    if (duration) duration.textContent = stats.avgDuration;

    const durationFoot = $("#mDurationFoot");
    if (durationFoot) {
      durationFoot.innerHTML = `${iconUse("clock")} Rata-rata penyelesaian`;
    }

    const botFoot = $("#mBotBlockedFoot");
    if (botFoot) {
      botFoot.innerHTML = `${iconUse("lock")} ${stats.blockRate} block rate`;
    }

    const riskCard = $("#riskCard");
    if (riskCard) {
      riskCard.classList.remove("tone-cyan", "tone-green", "tone-red", "tone-amber", "tone-purple", "tone-blue");
      riskCard.classList.add(`tone-${risk.tone}`);
    }

    const riskValue = $("#mRisk");
    if (riskValue) {
      riskValue.textContent = risk.label;
      riskValue.style.color = "var(--tone)";
    }

    const riskFoot = $("#mRiskFoot");
    if (riskFoot) {
      riskFoot.innerHTML = `${iconUse("shield-check")} Skor risiko ${risk.score} / 100`;
    }

    const deviceTotal = $("#deviceTotal");
    if (deviceTotal) deviceTotal.textContent = numberFmt.format(stats.challenges);

    updateTrafficChart();
    renderInsights(stats);
  }

  function distribute(total, weights) {
    const safeTotal = Math.max(0, Math.round(Number(total) || 0));
    if (safeTotal === 0) return weights.map(() => 0);

    const raw = weights.map((weight) => weight * safeTotal);
    const values = raw.map((value) => Math.floor(value));
    let remainder = safeTotal - values.reduce((sum, value) => sum + value, 0);
    const order = raw
      .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
      .sort((a, b) => b.fraction - a.fraction);

    let cursor = 0;
    while (remainder > 0) {
      values[order[cursor % order.length].index] += 1;
      cursor += 1;
      remainder -= 1;
    }

    return values;
  }

  function buildTrafficSeries(stats) {
    const labels = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"];
    const challengeWeights = [0.085, 0.115, 0.105, 0.14, 0.17, 0.13, 0.12, 0.135];
    const failureWeights = [0.1, 0.15, 0.125, 0.175, 0.2, 0.125, 0.075, 0.05];

    const challenges = distribute(stats.challenges, challengeWeights);
    const failed = distribute(stats.failed, failureWeights);
    const verified = challenges.map((value, index) => Math.max(0, value - failed[index]));

    return { labels, challenges, verified, failed };
  }

  function initTrafficChart() {
    const canvas = $("#trafficChart");
    if (!canvas || !window.Chart) return;

    const context = canvas.getContext("2d");
    const fill = context.createLinearGradient(0, 0, 0, 318);
    fill.addColorStop(0, "rgba(34, 211, 238, 0.24)");
    fill.addColorStop(0.65, "rgba(34, 211, 238, 0.04)");
    fill.addColorStop(1, "rgba(34, 211, 238, 0)");

    window.Chart.defaults.color = "#7c8ba1";
    window.Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

    state.trafficChart = new window.Chart(context, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Tantangan",
            data: [],
            borderColor: "#22d3ee",
            backgroundColor: fill,
            borderWidth: 2,
            fill: true,
            tension: 0.38,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: "#22d3ee",
            pointHoverBorderColor: "#041018",
            pointHoverBorderWidth: 2,
            pointHitRadius: 18
          },
          {
            label: "Terverifikasi",
            data: [],
            borderColor: "#34d399",
            backgroundColor: "transparent",
            borderWidth: 2,
            fill: false,
            tension: 0.38,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: "#34d399",
            pointHoverBorderColor: "#041018",
            pointHoverBorderWidth: 2,
            pointHitRadius: 18
          },
          {
            label: "Gagal",
            data: [],
            borderColor: "#fb7185",
            backgroundColor: "transparent",
            borderWidth: 2,
            fill: false,
            tension: 0.38,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: "#fb7185",
            pointHoverBorderColor: "#041018",
            pointHoverBorderWidth: 2,
            pointHitRadius: 18
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false
        },
        animation: {
          duration: 720,
          easing: "easeOutQuart"
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: "rgba(7, 12, 20, 0.97)",
            borderColor: "rgba(34, 211, 238, 0.24)",
            borderWidth: 1,
            titleColor: "#eaf1fb",
            bodyColor: "#a4b2c6",
            footerColor: "#6d7f96",
            padding: 11,
            cornerRadius: 9,
            usePointStyle: true,
            boxPadding: 5,
            callbacks: {
              title: (items) => `Pukul ${items[0].label}`,
              label: (item) => ` ${item.dataset.label}: ${numberFmt.format(item.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: "rgba(148, 163, 184, 0.06)",
              drawTicks: false
            },
            border: {
              display: false
            },
            ticks: {
              color: "#6d7f96",
              padding: 9,
              font: {
                size: 9.5
              }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(148, 163, 184, 0.07)",
              drawTicks: false
            },
            border: {
              display: false
            },
            ticks: {
              color: "#6d7f96",
              padding: 9,
              font: {
                size: 9.5
              },
              callback: (value) => compactFmt.format(value)
            }
          }
        }
      }
    });
  }

  function updateTrafficChart() {
    if (!state.trafficChart) return;

    const series = buildTrafficSeries(state.stats);
    state.trafficChart.data.labels = series.labels;
    state.trafficChart.data.datasets[0].data = series.challenges;
    state.trafficChart.data.datasets[1].data = series.verified;
    state.trafficChart.data.datasets[2].data = series.failed;
    state.trafficChart.update();
  }

  function initDeviceChart() {
    const canvas = $("#deviceDonut");
    if (!canvas || !window.Chart) return;

    state.deviceChart = new window.Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: DEVICES.map((device) => device.label),
        datasets: [
          {
            data: DEVICES.map((device) => device.value),
            backgroundColor: DEVICES.map((device) => device.color),
            borderWidth: 0,
            spacing: 2,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "74%",
        animation: {
          duration: 760,
          easing: "easeOutQuart"
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: "rgba(7, 12, 20, 0.97)",
            borderColor: "rgba(34, 211, 238, 0.24)",
            borderWidth: 1,
            titleColor: "#eaf1fb",
            bodyColor: "#a4b2c6",
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (item) => {
                const count = Math.round((state.stats.challenges * item.parsed) / 100);
                return ` ${item.label}: ${item.parsed}% (${numberFmt.format(count)} sesi)`;
              }
            }
          }
        }
      }
    });
  }

  function initCharts() {
    if (!window.Chart) {
      showToast("Chart.js gagal dimuat. Periksa aset dashboard.", "danger");
      return;
    }
    initTrafficChart();
    initDeviceChart();
  }

  function renderInsights(stats) {
    renderCountries(stats);
    renderNetworks(stats);
    renderDeviceLegend(stats);
    renderOperatingSystems(stats);
  }

  function renderCountries(stats) {
    const container = $("#countryList");
    if (!container) return;

    container.innerHTML = COUNTRIES.map((country) => {
      const count = Math.round((stats.challenges * country.share) / 100);
      return `
        <div class="data-row">
          <div class="data-main">
            <span class="flag">${country.flag}</span>
            <span class="data-copy">
              <span class="data-name">${escapeHtml(country.name)}</span>
              <span class="data-meta">${escapeHtml(country.code)} • ${numberFmt.format(count)} request</span>
            </span>
          </div>
          <span class="data-value">${country.share}%</span>
          <span class="data-bar"><span style="width: ${country.share}%"></span></span>
        </div>
      `;
    }).join("");
  }

  function renderNetworks(stats) {
    const container = $("#networkList");
    if (!container) return;

    container.innerHTML = NETWORKS.map((network) => {
      const count = Math.round((stats.challenges * network.share) / 100);
      return `
        <div class="data-row">
          <div class="data-main">
            <span class="net-mark">${escapeHtml(network.name.charAt(0))}</span>
            <span class="data-copy">
              <span class="data-name">${escapeHtml(network.name)}</span>
              <span class="data-meta">${escapeHtml(network.asn)}</span>
            </span>
          </div>
          <span class="data-value">
            ${network.share}%
            <span class="data-subvalue">${numberFmt.format(count)} req</span>
          </span>
          <span class="data-bar"><span style="width: ${network.share}%"></span></span>
        </div>
      `;
    }).join("");
  }

  function renderDeviceLegend(stats) {
    const container = $("#deviceLegend");
    if (!container) return;

    container.innerHTML = DEVICES.map((device) => {
      const count = Math.round((stats.challenges * device.value) / 100);
      return `
        <div class="device-legend-item">
          <span class="legend-dot" style="--dot: ${device.color}"></span>
          <span class="device-copy">
            <span>${escapeHtml(device.label)}</span>
            <small>${numberFmt.format(count)} sesi</small>
          </span>
          <strong>${device.value}%</strong>
        </div>
      `;
    }).join("");
  }

  function renderOperatingSystems(stats) {
    const container = $("#osList");
    if (!container) return;

    container.innerHTML = OPERATING_SYSTEMS.map((os) => {
      const count = Math.round((stats.challenges * os.share) / 100);
      return `
        <div class="data-row">
          <div class="data-main">
            <span class="os-badge os-${os.tone}">${iconUse(os.icon)}</span>
            <span class="data-copy">
              <span class="data-name">${escapeHtml(os.name)}</span>
              <span class="data-meta">${numberFmt.format(count)} request</span>
            </span>
          </div>
          <span class="data-value">${os.share}%</span>
          <span class="data-bar"><span style="width: ${os.share}%"></span></span>
        </div>
      `;
    }).join("");
  }

  function weightedLogStatus() {
    const roll = Math.random() * 100;
    if (roll < 72) return "verified";
    if (roll < 82) return "failed";
    if (roll < 93) return "blocked";
    return "warning";
  }

  function createLogEntry(date = new Date(), fresh = false) {
    const statusKey = weightedLogStatus();
    const status = LOG_STATUS[statusKey];
    const location = pick(LOG_LOCATIONS);
    const device = pick(LOG_DEVICES);
    const profile = getKeyProfile(state.activeKey);
    const prefix = pick(location.prefixes);
    const ip = `${prefix}.${randomInt(1, 254)}.${randomInt(1, 254)}`;

    let risk = 8;
    let latency = 0.6;

    if (statusKey === "verified") {
      risk = randomInt(2, 18);
      latency = 0.3 + Math.random() * 1.1;
    } else if (statusKey === "failed") {
      risk = randomInt(32, 58);
      latency = 0.5 + Math.random() * 1.7;
    } else if (statusKey === "blocked") {
      risk = randomInt(70, 96);
      latency = 0.2 + Math.random() * 0.7;
    } else {
      risk = randomInt(44, 69);
      latency = 0.8 + Math.random() * 2;
    }

    return {
      id: `${date.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      time: date,
      status: statusKey,
      statusLabel: status.label,
      action: pick(status.actions),
      siteKey: state.activeKey,
      keyName: profile?.name || state.activeKey,
      flag: location.flag,
      city: location.city,
      ip,
      device,
      latency: `${latency.toFixed(1)}s`,
      risk,
      fresh
    };
  }

  function resetAuditLogs() {
    const now = Date.now();
    state.logs = [];

    for (let index = 6; index >= 0; index -= 1) {
      const offset = index * 19000 + randomInt(3000, 14000);
      state.logs.push(createLogEntry(new Date(now - offset)));
    }

    state.logs.sort((a, b) => b.time - a.time);
    renderAuditLogs();
  }

  function riskClass(risk) {
    if (risk < 30) return "risk-low";
    if (risk < 60) return "risk-medium";
    return "risk-high";
  }

  function renderAuditLogs() {
    const body = $("#auditLogBody");
    if (!body) return;

    const filtered =
      state.logFilter === "all"
        ? state.logs
        : state.logs.filter((log) => log.status === state.logFilter);

    if (filtered.length === 0) {
      body.innerHTML = '<tr><td colspan="8" class="table-empty">Belum ada log untuk filter ini.</td></tr>';
    } else {
      body.innerHTML = filtered
        .map((log, index) => {
          const freshClass = log.fresh && index === 0 ? " is-new" : "";
          return `
            <tr class="${freshClass}">
              <td class="cell-time">${formatClock(log.time)}</td>
              <td>
                <span class="status-badge status-${log.status}">
                  ${iconUse(LOG_STATUS[log.status].icon)}
                  ${escapeHtml(log.statusLabel)}
                </span>
              </td>
              <td class="cell-activity" title="${escapeHtml(log.action)}">${escapeHtml(log.action)}</td>
              <td class="cell-key">${escapeHtml(log.siteKey)}</td>
              <td>
                <span class="cell-stack">
                  <span>${log.flag} ${escapeHtml(log.city)}</span>
                  <small>${escapeHtml(log.ip)}</small>
                </span>
              </td>
              <td><span class="device-pill">${escapeHtml(log.device)}</span></td>
              <td class="mono">${escapeHtml(log.latency)}</td>
              <td><span class="risk-chip ${riskClass(log.risk)}">${log.risk}</span></td>
            </tr>
          `;
        })
        .join("");
    }

    const count = $("#auditCount");
    if (count) count.textContent = `${filtered.length} entri`;

    updatePauseUi();
  }

  function updatePauseUi() {
    const button = $("#pauseLogsBtn");
    const label = $("#pauseLogsLabel");
    if (!button || !label) return;

    button.setAttribute("aria-pressed", String(state.logsPaused));
    label.textContent = state.logsPaused ? "Lanjutkan" : "Pause";
    const use = button.querySelector("use");
    if (use) use.setAttribute("href", state.logsPaused ? "#i-play" : "#i-pause");
  }

  function startLogStream() {
    if (state.logTimer) clearInterval(state.logTimer);

    state.logTimer = window.setInterval(() => {
      if (state.logsPaused || document.hidden) return;

      const entry = createLogEntry(new Date(), true);
      state.logs.unshift(entry);
      state.logs = state.logs.slice(0, CONFIG.maxLogs);
      window.setTimeout(() => {
        entry.fresh = false;
      }, 1500);
      renderAuditLogs();
    }, CONFIG.logIntervalMs);
  }

  function exportLogs() {
    if (state.logs.length === 0) {
      showToast("Tidak ada log untuk diekspor.", "warning");
      return;
    }

    const header = ["Waktu", "Status", "Aktivitas", "Site Key", "Lokasi", "IP", "Perangkat", "Durasi", "Risk"];
    const rows = state.logs.map((log) => [
      log.time.toISOString(),
      log.statusLabel,
      log.action,
      log.siteKey,
      log.city,
      log.ip,
      log.device,
      log.latency,
      String(log.risk)
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `capshield-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Audit log berhasil diekspor ke CSV.", "success");
  }

  async function loadStats(options = {}) {
    const silent = options.silent === true;
    const profile = getKeyProfile(state.activeKey);

    if (state.activeKey !== CONFIG.siteKey) {
      applyStats(getProfileStats(profile), { animate: true });
      state.lastUpdated = new Date();
      updateFreshness();
      setSystemStatus("local");
      if (!silent) showToast(`Data ${profile?.name || "site key"} dimuat.`, "info");
      return;
    }

    try {
      const response = await fetch(CONFIG.statsEndpoint, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      state.primaryStats = normalizeStats(data);
      state.source = "api";
      setSystemStatus("online");

      if (state.activeKey === CONFIG.siteKey) {
        applyStats(state.primaryStats, { animate: true });
      }

      renderKeyList($("#keySearch")?.value || "");
      if (!silent) showToast("Statistik dashboard diperbarui.", "success");
    } catch (error) {
      console.error("Gagal memuat statistik dashboard:", error);
      state.primaryStats = normalizeStats(DEMO_STATS);
      state.source = "demo";
      setSystemStatus("offline");

      if (state.activeKey === CONFIG.siteKey) {
        applyStats(state.primaryStats, { animate: true });
      }

      renderKeyList($("#keySearch")?.value || "");
      if (!silent) {
        showToast("API statistik tidak tersedia. Menampilkan data demo.", "warning");
      }
    } finally {
      state.lastUpdated = new Date();
      updateFreshness();
    }
  }

  function setSystemStatus(mode) {
    const dot = $("#systemDot");
    const label = $("#systemApiStatus");
    if (!dot || !label) return;

    dot.classList.remove("is-online", "is-offline");

    if (mode === "online") {
      dot.classList.add("is-online");
      label.textContent = "API tersambung";
    } else if (mode === "local") {
      label.textContent = "Data lokal";
    } else {
      dot.classList.add("is-offline");
      label.textContent = "Mode demo";
    }
  }

  function updateFreshness() {
    const label = $("#lastUpdated");
    if (!label) return;

    if (!state.lastUpdated) {
      label.textContent = "—";
      return;
    }

    const seconds = Math.max(0, Math.floor((Date.now() - state.lastUpdated.getTime()) / 1000));

    if (seconds < 5) {
      label.textContent = "baru saja";
    } else if (seconds < 60) {
      label.textContent = `${seconds} dtk lalu`;
    } else if (seconds < 3600) {
      label.textContent = `${Math.floor(seconds / 60)} mnt lalu`;
    } else {
      label.textContent = `${Math.floor(seconds / 3600)} jam lalu`;
    }
  }

  function selectKey(key, options = {}) {
    const profile = getKeyProfile(key);
    if (!profile) return;

    state.activeKey = key;
    updateHeaderKey();
    renderKeyList($("#keySearch")?.value || "");
    updateIntegrationSnippets();
    resetAuditLogs();

    if (key === CONFIG.siteKey) {
      applyStats(state.primaryStats, { animate: true });
      loadStats({ silent: true });
    } else {
      applyStats(getProfileStats(profile), { animate: true });
      setSystemStatus("local");
    }

    storageSet("capshield_active_key", key);

    if (!options.silent) {
      showToast(`Site key ${profile.name} aktif.`, "info");
    }

    if (window.matchMedia("(max-width: 1024px)").matches) {
      setSidebar(false);
    }
  }

  function switchView(view, options = {}) {
    const validViews = ["activity", "integration", "rules"];
    const nextView = validViews.includes(view) ? view : "activity";
    state.activeView = nextView;

    $$(".view").forEach((section) => {
      const active = section.id === `view-${nextView}`;
      section.classList.toggle("is-active", active);
      section.hidden = !active;
    });

    $$(".tab[data-view]").forEach((tab) => {
      const active = tab.dataset.view === nextView;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });

    $$(".nav-link[data-view]").forEach((link) => {
      link.classList.toggle("is-active", link.dataset.view === nextView);
    });

    if (nextView === "integration") updateIntegrationSnippets();

    if (options.scroll !== false) {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? "auto" : "smooth"
      });
    }
  }

  function scrollToSection(targetId, navButton) {
    switchView("activity", { scroll: false });
    $$(".nav-link").forEach((link) => {
      link.classList.toggle("is-active", link === navButton);
    });

    const target = document.getElementById(targetId);
    if (target) {
      window.setTimeout(() => {
        target.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start"
        });
      }, 40);
    }

    setSidebar(false);
  }

  function setSidebar(open) {
    const sidebar = $("#sidebar");
    const backdrop = $("#sidebarBackdrop");
    const menuButton = $("#menuBtn");
    if (!sidebar || !backdrop || !menuButton) return;

    sidebar.classList.toggle("is-open", open);
    backdrop.classList.toggle("is-visible", open);
    backdrop.hidden = !open;
    menuButton.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("no-scroll", open && window.matchMedia("(max-width: 1024px)").matches);
  }

  function updateIntegrationSnippets() {
    const endpoint = `${CONFIG.widgetBaseUrl}/${state.activeKey}/`;
    const origin = window.location.origin;

    const widgetSnippet =
      `<script src="https://cdn.jsdelivr.net/npm/cap-widget"><\/script>\n\n` +
      `<form action="/verify" method="POST">\n` +
      `  <input type="email" name="email" placeholder="email@example.com" required>\n\n` +
      `  <cap-widget\n` +
      `    data-cap-api-endpoint="${endpoint}"\n` +
      `    data-theme="dark"\n` +
      `  ></cap-widget>\n\n` +
      `  <button type="submit">Kirim</button>\n` +
      `</form>`;

    const verifySnippet =
      `POST /verify\n` +
      `Content-Type: application/x-www-form-urlencoded\n\n` +
      `email=user@example.com&cap-token=<token-dari-widget>\n\n` +
      `curl -X POST ${origin}/verify \\\n` +
      `  --data-urlencode "email=user@example.com" \\\n` +
      `  --data-urlencode "cap-token=<token-dari-widget>"`;

    const widgetCode = $("#widgetSnippet");
    const verifyCode = $("#verifySnippet");
    const endpointCode = $("#integrationEndpoint");
    const actionCode = $("#integrationAction");

    if (widgetCode) widgetCode.textContent = widgetSnippet;
    if (verifyCode) verifyCode.textContent = verifySnippet;
    if (endpointCode) endpointCode.textContent = endpoint;
    if (actionCode) actionCode.textContent = `${origin}/verify`;
  }

  function readRulesForm() {
    return {
      difficulty: $("#rulesDifficulty")?.value || RULES_DEFAULTS.difficulty,
      retention: $("#rulesRetention")?.value || RULES_DEFAULTS.retention,
      rateMax: clamp(parseInt($("#rulesRateMax")?.value, 10) || RULES_DEFAULTS.rateMax, 1, 10000),
      rateWindow: clamp(parseInt($("#rulesRateWindow")?.value, 10) || RULES_DEFAULTS.rateWindow, 10, 3600),
      botProtection: Boolean($("#rulesBotProtection")?.checked),
      blockDatacenter: Boolean($("#rulesBlockDatacenter")?.checked),
      geoBlock: Boolean($("#rulesGeoBlock")?.checked),
      geoList: ($("#rulesGeoList")?.value || "").trim(),
      webhook: ($("#rulesWebhook")?.value || "").trim()
    };
  }

  function applyRulesToForm(rules) {
    const values = { ...RULES_DEFAULTS, ...rules };
    if ($("#rulesDifficulty")) $("#rulesDifficulty").value = values.difficulty;
    if ($("#rulesRetention")) $("#rulesRetention").value = values.retention;
    if ($("#rulesRateMax")) $("#rulesRateMax").value = values.rateMax;
    if ($("#rulesRateWindow")) $("#rulesRateWindow").value = values.rateWindow;
    if ($("#rulesBotProtection")) $("#rulesBotProtection").checked = Boolean(values.botProtection);
    if ($("#rulesBlockDatacenter")) $("#rulesBlockDatacenter").checked = Boolean(values.blockDatacenter);
    if ($("#rulesGeoBlock")) $("#rulesGeoBlock").checked = Boolean(values.geoBlock);
    if ($("#rulesGeoList")) $("#rulesGeoList").value = values.geoList;
    if ($("#rulesWebhook")) $("#rulesWebhook").value = values.webhook;
    updateRulesSummary(values);
  }

  function rulesDifficultyLabel(value) {
    if (value === "ringan") return "Ringan";
    if (value === "ketat") return "Ketat";
    return "Sedang";
  }

  function updateRulesSummary(rules) {
    const summaryDifficulty = $("#summaryDifficulty");
    const summaryRate = $("#summaryRate");
    const summaryBot = $("#summaryBot");
    const summaryDatacenter = $("#summaryDatacenter");
    const summaryGeo = $("#summaryGeo");
    const summaryRetention = $("#summaryRetention");

    if (summaryDifficulty) summaryDifficulty.textContent = rulesDifficultyLabel(rules.difficulty);
    if (summaryRate) summaryRate.textContent = `${rules.rateMax} / ${rules.rateWindow} dtk`;
    if (summaryBot) summaryBot.textContent = rules.botProtection ? "Aktif" : "Nonaktif";
    if (summaryDatacenter) summaryDatacenter.textContent = rules.blockDatacenter ? "Diblokir" : "Diizinkan";
    if (summaryGeo) {
      summaryGeo.textContent = rules.geoBlock
        ? rules.geoList
          ? `Aktif (${rules.geoList})`
          : "Aktif"
        : "Nonaktif";
    }
    if (summaryRetention) summaryRetention.textContent = `${rules.retention} hari`;
  }

  function loadRules() {
    const saved = storageGet("capshield_rules_v1", null);
    state.rules = { ...RULES_DEFAULTS, ...(saved && typeof saved === "object" ? saved : {}) };
    applyRulesToForm(state.rules);

    const savedAt = storageGet("capshield_rules_saved_at", "");
    const savedAtLabel = $("#rulesSavedAt");
    if (savedAtLabel) {
      if (savedAt) {
        const date = new Date(savedAt);
        savedAtLabel.textContent = Number.isNaN(date.getTime())
          ? "belum disimpan"
          : `${formatDate(date)} ${formatClock(date)}`;
      } else {
        savedAtLabel.textContent = "belum disimpan";
      }
    }
  }

  function saveRules(event) {
    event.preventDefault();
    const rules = readRulesForm();
    state.rules = rules;
    storageSet("capshield_rules_v1", rules);
    const savedAt = new Date().toISOString();
    storageSet("capshield_rules_saved_at", savedAt);
    updateRulesSummary(rules);

    const savedAtLabel = $("#rulesSavedAt");
    if (savedAtLabel) savedAtLabel.textContent = `${formatDate(new Date(savedAt))} ${formatClock(new Date(savedAt))}`;

    showToast("Konfigurasi rules berhasil disimpan.", "success");
  }

  function resetRules() {
    state.rules = { ...RULES_DEFAULTS };
    storageRemove("capshield_rules_v1");
    storageRemove("capshield_rules_saved_at");
    applyRulesToForm(state.rules);

    const savedAtLabel = $("#rulesSavedAt");
    if (savedAtLabel) savedAtLabel.textContent = "belum disimpan";

    showToast("Rules dikembalikan ke pengaturan awal.", "info");
  }

  function openNewKeyDialog() {
    const dialog = $("#newKeyDialog");
    const input = $("#newKeyName");
    if (!dialog) return;

    if (input) input.value = "";
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    window.setTimeout(() => input?.focus(), 80);
  }

  function closeNewKeyDialog() {
    const dialog = $("#newKeyDialog");
    if (!dialog) return;

    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  function createCustomKey(name) {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 18) || "site";

    const key = `cap_${base}_${Math.random().toString(36).slice(2, 6)}`;
    state.customKeys.push({
      key,
      name,
      environment: "Development",
      stats: emptyStats(),
      custom: true
    });

    storageSet("capshield_custom_keys", state.customKeys);
    renderKeyList($("#keySearch")?.value || "");
    selectKey(key);
    showToast(`Site key ${name} berhasil dibuat.`, "success");
  }

  function loadCustomKeys() {
    const saved = storageGet("capshield_custom_keys", []);
    if (!Array.isArray(saved)) return;

    state.customKeys = saved
      .filter((item) => item && typeof item.key === "string" && typeof item.name === "string")
      .map((item) => ({
        key: item.key,
        name: item.name,
        environment: "Development",
        stats: emptyStats(),
        custom: true
      }));
  }

  async function copyText(text, label = "Kode") {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} disalin ke clipboard.`, "success");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand("copy");
        showToast(`${label} disalin ke clipboard.`, "success");
      } catch {
        showToast("Gagal menyalin. Salin secara manual.", "danger");
      } finally {
        textarea.remove();
      }
    }
  }

  function showToast(message, tone = "info") {
    const host = $("#toastHost");
    if (!host) return;

    const icons = {
      success: "check-circle",
      warning: "alert-triangle",
      danger: "x-circle",
      info: "info"
    };
    const toast = document.createElement("div");
    toast.className = `toast toast-${tone}`;
    toast.innerHTML = `${iconUse(icons[tone] || "info")}<span></span>`;
    toast.querySelector("span").textContent = message;
    host.appendChild(toast);

    while (host.children.length > 4) {
      host.firstElementChild.remove();
    }

    requestAnimationFrame(() => toast.classList.add("is-visible"));

    window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => toast.remove(), 260);
    }, 3400);
  }

  function refreshDashboard() {
    const button = $("#refreshBtn");
    button?.classList.add("is-spinning");
    if (button) button.disabled = true;

    loadStats({ silent: false }).finally(() => {
      window.setTimeout(() => {
        button?.classList.remove("is-spinning");
        if (button) button.disabled = false;
      }, 450);
    });
  }

  function bindEvents() {
    $$(".tab[data-view]").forEach((tab) => {
      tab.addEventListener("click", () => switchView(tab.dataset.view));
    });

    $$(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        if (link.dataset.view) {
          switchView(link.dataset.view);
          setSidebar(false);
        } else if (link.dataset.scroll) {
          scrollToSection(link.dataset.scroll, link);
        }
      });
    });

    $("#menuBtn")?.addEventListener("click", () => {
      const sidebar = $("#sidebar");
      setSidebar(sidebar?.dataset ? !sidebar.classList.contains("is-open") : true);
    });

    $("#sidebarBackdrop")?.addEventListener("click", () => setSidebar(false));

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setSidebar(false);
    });

    window.addEventListener("resize", () => {
      if (!window.matchMedia("(max-width: 1024px)").matches) setSidebar(false);
    });

    $("#keyList")?.addEventListener("click", (event) => {
      const card = event.target.closest(".key-card");
      if (card?.dataset.key) selectKey(card.dataset.key);
    });

    $("#keySearch")?.addEventListener("input", (event) => {
      renderKeyList(event.target.value);
    });

    $("#addKeyBtn")?.addEventListener("click", openNewKeyDialog);
    $("#closeNewKeyBtn")?.addEventListener("click", closeNewKeyDialog);
    $("#cancelNewKeyBtn")?.addEventListener("click", closeNewKeyDialog);

    $("#newKeyDialog")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeNewKeyDialog();
    });

    $("#newKeyForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = $("#newKeyName");
      const name = input?.value.trim() || "";

      if (!name) {
        showToast("Nama site key wajib diisi.", "warning");
        input?.focus();
        return;
      }

      closeNewKeyDialog();
      createCustomKey(name);
    });

    $("#copySiteKeyBtn")?.addEventListener("click", () => {
      copyText(state.activeKey, "Site key");
    });

    $("#refreshBtn")?.addEventListener("click", refreshDashboard);

    $$("[data-copy-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = document.getElementById(button.dataset.copyTarget);
        if (!target) return;
        copyText(target.textContent, "Kode");
      });
    });

    $$(".legend-btn").forEach((button) => {
      button.addEventListener("click", () => {
        if (!state.trafficChart) return;

        const index = Number(button.dataset.dataset);
        const dataset = state.trafficChart.data.datasets[index];
        if (!dataset) return;

        dataset.hidden = !dataset.hidden;
        button.classList.toggle("is-off", Boolean(dataset.hidden));
        button.setAttribute("aria-pressed", String(!dataset.hidden));
        state.trafficChart.update();
      });
    });

    $("#logFilter")?.addEventListener("change", (event) => {
      state.logFilter = event.target.value;
      renderAuditLogs();
    });

    $("#pauseLogsBtn")?.addEventListener("click", () => {
      state.logsPaused = !state.logsPaused;
      updatePauseUi();
      showToast(
        state.logsPaused ? "Streaming audit log dijeda." : "Streaming audit log dilanjutkan.",
        "info"
      );
    });

    $("#clearLogsBtn")?.addEventListener("click", () => {
      state.logs = [];
      renderAuditLogs();
      showToast("Audit log dibersihkan.", "info");
    });

    $("#exportLogsBtn")?.addEventListener("click", exportLogs);

    $("#rulesForm")?.addEventListener("submit", saveRules);
    $("#resetRulesBtn")?.addEventListener("click", resetRules);
    $("#rulesForm")?.addEventListener("input", () => {
      updateRulesSummary(readRulesForm());
    });
    $("#rulesForm")?.addEventListener("change", () => {
      updateRulesSummary(readRulesForm());
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      const age = state.lastUpdated ? Date.now() - state.lastUpdated.getTime() : Infinity;
      if (age > CONFIG.statsPollMs) loadStats({ silent: true });
    });
  }

  function startClock() {
    const clock = $("#liveClock");
    const today = $("#todayLabel");
    if (today) today.textContent = formatDate(new Date());

    const tick = () => {
      if (clock) clock.textContent = formatClock(new Date());
    };

    tick();
    window.setInterval(tick, 1000);
  }

  function startPolling() {
    window.setInterval(() => {
      if (!document.hidden) loadStats({ silent: true });
    }, CONFIG.statsPollMs);

    window.setInterval(updateFreshness, 10000);
  }

  function init() {
    loadCustomKeys();

    const savedKey = storageGet("capshield_active_key", CONFIG.siteKey);
    if (typeof savedKey === "string" && getKeyProfile(savedKey)) {
      state.activeKey = savedKey;
    }

    updateHeaderKey();
    renderKeyList();
    bindEvents();
    startClock();
    initCharts();

    const initialProfile = getKeyProfile(state.activeKey);
    const initialStats =
      state.activeKey === CONFIG.siteKey
        ? state.primaryStats
        : getProfileStats(initialProfile);

    applyStats(initialStats, { animate: false });
    resetAuditLogs();
    startLogStream();
    loadRules();
    updateIntegrationSnippets();
    startPolling();

    if (state.activeKey === CONFIG.siteKey) {
      loadStats({ silent: true });
    } else {
      setSystemStatus("local");
      state.lastUpdated = new Date();
      updateFreshness();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
