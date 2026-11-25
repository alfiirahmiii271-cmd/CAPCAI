
const $ = (id) => document.getElementById(id);

let captchaChart = null;

// ==========================================
// BAGIAN 1: DASHBOARD STATISTIK CAPTCHA
// ==========================================

async function loadDashboard() {
    const period = $("period").value;
    const status = $("status");
    const error = $("error");

    status.textContent = "Sedang mengambil data...";
    error.textContent = "";

    try {
        const response = await fetch(
            `/api/stats?period=${encodeURIComponent(period)}`
        );

        if (!response.ok) {
            const message = await response.text();
            throw new Error(message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const stats = data.stats;

        $("challenges").textContent = stats.challenges ?? 0;
        $("verified").textContent = stats.verified ?? 0;
        $("failed").textContent = stats.failed ?? 0;
        $("rateLimited").textContent = stats.rateLimited ?? 0;

        const total = (stats.verified ?? 0) + (stats.failed ?? 0);

        const successRate = total > 0
            ? ((stats.verified ?? 0) / total) * 100
            : 0;

        $("successRate").textContent =
            successRate.toFixed(1) + "%";

        const chartData = Array.isArray(data.chart)
            ? data.chart
            : [];

        const labels = chartData.map((item) => {
            if (item.jam_wib) {
                return item.jam_wib;
            }

            if (item.bucket) {
                const date = new Date(item.bucket * 1000);

                if (period === "today") {
                    return date.toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Jakarta"
                    });
                }

                return date.toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    timeZone: "Asia/Jakarta"
                });
            }

            return item.label ?? "";
        });

        if (captchaChart) {
            captchaChart.destroy();
        }

        captchaChart = new Chart($("captchaChart"), {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: "Berhasil",
                        data: chartData.map((item) => item.verified ?? 0),
                        backgroundColor: "#22c55e",
                        borderRadius: 6
                    },
                    {
                        label: "Gagal",
                        data: chartData.map((item) => item.failed ?? 0),
                        backgroundColor: "#ef4444",
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: "index"
                },
                plugins: {
                    legend: {
                        position: "bottom"
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });

        status.textContent =
            `Data berhasil diperbarui. Periode: ${data.period}`;

    } catch (err) {
        error.textContent = "Gagal mengambil data: " + err.message;
        status.textContent = "Data tidak tersedia.";

        if (captchaChart) {
            captchaChart.destroy();
            captchaChart = null;
        }
    }
}


// ==========================================
// BAGIAN 2: CHATBOT AI GEMINI
// ==========================================

let history = [];

const welcomeMessage =
    "Halo! Saya asisten AI untuk dashboard statistik CAPTCHA Cap. Silakan tanyakan statistik atau aktivitas CAPTCHA.";


// ==========================================
// BAGIAN 2A: FORMAT JAWABAN MARKDOWN
// ==========================================

function renderMarkdown(text) {
    const container = document.createElement("div");

    const lines = String(text ?? "").split(/\r?\n/);
    let currentList = null;

    function addFormattedText(parent, value) {
        const parts = value.split(/(\*\*.*?\*\*)/g);

        parts.forEach((part) => {
            if (
                part.startsWith("**") &&
                part.endsWith("**") &&
                part.length >= 4
            ) {
                const strong = document.createElement("strong");
                strong.textContent = part.slice(2, -2);
                parent.appendChild(strong);
            } else {
                parent.appendChild(
                    document.createTextNode(part)
                );
            }
        });
    }

    lines.forEach((line) => {
        const trimmed = line.trim();

        if (!trimmed) {
            currentList = null;
            return;
        }

        const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);

        if (heading) {
            currentList = null;

            const element = document.createElement(
                `h${heading[1].length + 1}`
            );

            addFormattedText(element, heading[2]);
            container.appendChild(element);
            return;
        }

        const bullet = trimmed.match(/^[-*]\s+(.+)$/);
        const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);

        if (bullet || numbered) {
            const listType = bullet ? "ul" : "ol";

            if (
                !currentList ||
                currentList.tagName.toLowerCase() !== listType
            ) {
                currentList = document.createElement(listType);
                container.appendChild(currentList);
            }

            const item = document.createElement("li");

            addFormattedText(
                item,
                (bullet || numbered)[1]
            );

            currentList.appendChild(item);
            return;
        }

        currentList = null;

        const paragraph = document.createElement("p");
        addFormattedText(paragraph, trimmed);
        container.appendChild(paragraph);
    });

    return container;
}


// ==========================================
// BAGIAN 2B: KARTU STATISTIK DI JAWABAN AI
// ==========================================

function createStatCard(label, value, color) {
    const card = document.createElement("div");

    card.style.cssText = `
        flex: 1 1 120px;
        min-width: 105px;
        padding: 14px;
        border: 1px solid ${color}55;
        border-radius: 12px;
        background: ${color}12;
    `;

    const title = document.createElement("div");
    title.textContent = label;
    title.style.cssText = `
        font-size: 12px;
        opacity: 0.75;
        margin-bottom: 8px;
    `;

    const number = document.createElement("div");
    number.textContent = Number(value ?? 0).toLocaleString("id-ID");
    number.style.cssText = `
        font-size: 23px;
        font-weight: 700;
        color: ${color};
    `;

    card.append(title, number);

    return card;
}


function renderAIStats(message, statsData) {
    if (!statsData || typeof statsData !== "object") {
        return;
    }

    // Mendukung bentuk data statistik yang bersarang.
    const stats = statsData.stats ?? statsData;

    if (typeof stats !== "object") {
        return;
    }

    const hasStats =
        stats.challenges !== undefined ||
        stats.verified !== undefined ||
        stats.failed !== undefined ||
        stats.rateLimited !== undefined;

    if (!hasStats) {
        return;
    }

    const section = document.createElement("div");

    section.style.cssText = `
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid rgba(128,128,128,0.25);
    `;

    const heading = document.createElement("div");
    heading.textContent = "Ringkasan Statistik CAPTCHA";
    heading.style.cssText = `
        font-size: 14px;
        font-weight: 700;
        margin-bottom: 12px;
    `;

    const cards = document.createElement("div");

    cards.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-bottom: 14px;
    `;

    cards.append(
        createStatCard("Total Tantangan", stats.challenges, "#38bdf8"),
        createStatCard("Berhasil", stats.verified, "#22c55e"),
        createStatCard("Gagal", stats.failed, "#f87171"),
        createStatCard("Rate Limited", stats.rateLimited, "#f59e0b")
    );

    section.append(heading, cards);

    // Grafik hanya dibuat jika data grafik tersedia.
    const chartData = Array.isArray(statsData.chart)
        ? statsData.chart
        : [];

    if (chartData.length > 0 && typeof Chart !== "undefined") {
        const chartTitle = document.createElement("div");

        chartTitle.textContent = "Grafik Aktivitas CAPTCHA";
        chartTitle.style.cssText = `
            font-size: 13px;
            font-weight: 700;
            margin: 8px 0;
        `;

        const chartContainer = document.createElement("div");

        chartContainer.style.cssText = `
            position: relative;
            width: 100%;
            height: 220px;
            padding: 10px;
            box-sizing: border-box;
            border-radius: 12px;
            background: rgba(128,128,128,0.06);
        `;

        const canvas = document.createElement("canvas");
        chartContainer.appendChild(canvas);

        section.append(chartTitle, chartContainer);

        const labels = chartData.map((item, index) => {
            if (item.jam_wib) {
                return item.jam_wib;
            }

            if (item.bucket) {
                return new Date(item.bucket * 1000)
                    .toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Jakarta"
                    });
            }

            return item.label ?? `Data ${index + 1}`;
        });

        new Chart(canvas, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Berhasil",
                        data: chartData.map(
                            (item) => item.verified ?? 0
                        ),
                        borderColor: "#22c55e",
                        backgroundColor: "rgba(34,197,94,0.12)",
                        fill: true,
                        tension: 0.35
                    },
                    {
                        label: "Gagal",
                        data: chartData.map(
                            (item) => item.failed ?? 0
                        ),
                        borderColor: "#f87171",
                        backgroundColor: "rgba(248,113,113,0.10)",
                        fill: true,
                        tension: 0.35
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom"
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    message.appendChild(section);
}


// ==========================================
// BAGIAN 2C: MENAMPILKAN PESAN CHAT
// ==========================================

function addMsg(role, text, statsData = null) {
    const message = document.createElement("div");

    message.className = `msg ${role}`;

    if (
        role === "assistant" &&
        text !== "Sedang berpikir..."
    ) {
        message.appendChild(renderMarkdown(text));
        renderAIStats(message, statsData);
    } else {
        message.textContent = text;
    }

    $("msgs").appendChild(message);

    $("msgs").scrollTop = $("msgs").scrollHeight;

    return message;
}


// ==========================================
// BAGIAN 2D: KONEKSI API GEMINI
// ==========================================

async function api(url, options = {}) {
    const response = await fetch(url, options);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.detail || data.message || `HTTP ${response.status}`
        );
    }

    return data;
}


// ==========================================
// BAGIAN 2E: MENGIRIM PESAN CHAT
// ==========================================

$("form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = $("input");
    const send = $("send");

    const question = input.value.trim();

    if (!question || send.disabled) {
        return;
    }

    addMsg("user", question);

    history.push({
        role: "user",
        content: question
    });

    input.value = "";

    const waiting = addMsg(
        "assistant",
        "Sedang berpikir..."
    );

    send.disabled = true;

    try {
        const messages = history.slice(-19);

        if (
            messages.length > 0 &&
            messages[0].role !== "user"
        ) {
            messages.shift();
        }

        const data = await api("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages
            })
        });

        const reply = data.reply ?? "AI tidak memberikan jawaban.";

        // Menampilkan jawaban beserta kartu dan grafik statistik.
        waiting.replaceChildren(renderMarkdown(reply));
        renderAIStats(waiting, data.stats);

        history.push({
            role: "assistant",
            content: reply
        });

    } catch (err) {
        waiting.textContent = "Gagal: " + err.message;

        history.pop();

    } finally {
        send.disabled = false;
        input.focus();

        $("msgs").scrollTop = $("msgs").scrollHeight;
    }
});


// ==========================================
// BAGIAN 2F: INPUT CHAT
// ==========================================

$("input").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        $("form").requestSubmit();
    }
});


// ==========================================
// BAGIAN 2G: CHAT BARU
// ==========================================

$("clear").addEventListener("click", () => {
    history = [];

    $("msgs").replaceChildren();

    addMsg("assistant", welcomeMessage);

    $("input").focus();
});


// ==========================================
// BAGIAN 3: MENJALANKAN DASHBOARD
// ==========================================

$("msgs").replaceChildren();

addMsg("assistant", welcomeMessage);

$("period").addEventListener("change", loadDashboard);

$("refresh").addEventListener("click", loadDashboard);

loadDashboard();
