// ===== CONFIG =====
const API_BASE = "http://127.0.0.1:8000";

// ===== STATE =====
let repoLoaded = false;
let graphInstance = null;

// ===== TAB SWITCHING =====
function switchTab(tab) {
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));

    document.querySelector(`[data-tab="${tab}"]`).classList.add("active");
    document.getElementById(`panel-${tab}`).classList.add("active");

    // Re-render graph on tab switch (force-graph needs visible container)
    if (tab === "graph" && repoLoaded && !graphInstance) {
        loadArchitecture();
    }
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = "info") {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove("show"), 3500);
}

// ===== REPO LOADING =====
async function loadRepo() {
    const input = document.getElementById("repo-url-input");
    const btn = document.getElementById("load-repo-btn");
    const url = input.value.trim();

    if (!url) {
        showToast("Please enter a GitHub repository URL", "error");
        return;
    }

    // Show loading state
    btn.querySelector(".btn-text").textContent = "Loading...";
    btn.querySelector(".btn-loader").style.display = "block";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/load_repo?url=${encodeURIComponent(url)}`);
        const data = await res.json();

        if (data.error) {
            showToast(data.error, "error");
            return;
        }

        repoLoaded = true;

        // Update status badge
        const statusBadge = document.getElementById("repo-status");
        const statusText = document.getElementById("status-text");
        statusBadge.classList.remove("hidden");
        statusText.textContent = `${data.chunks} chunks · ${data.files} files`;

        // Enable chat
        document.getElementById("send-btn").disabled = false;

        showToast(data.message, "success");

        // Load files list
        loadFiles();

        // Pre-load architecture graph
        loadArchitecture();

    } catch (err) {
        showToast("Failed to connect to backend. Is it running?", "error");
        console.error(err);
    } finally {
        btn.querySelector(".btn-text").textContent = "Load Repo";
        btn.querySelector(".btn-loader").style.display = "none";
        btn.disabled = false;
    }
}

// ===== CHAT =====
function setQuery(text) {
    document.getElementById("chat-input").value = text;
    document.getElementById("chat-input").focus();
}

function handleChatKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendQuery();
    }
}

function addMessage(type, content) {
    const container = document.getElementById("chat-messages");

    // Remove welcome message if it exists
    const welcome = container.querySelector(".welcome-message");
    if (welcome) welcome.remove();

    const msg = document.createElement("div");
    msg.className = `message message-${type}`;

    if (type === "user") {
        msg.innerHTML = `<div class="message-content">${escapeHtml(content)}</div>`;
    } else if (type === "loading") {
        msg.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>`;
        msg.id = "loading-msg";
    }

    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg;
}

function addAIResponse(explanation, sources) {
    const container = document.getElementById("chat-messages");

    // Remove loading
    const loading = document.getElementById("loading-msg");
    if (loading) loading.remove();

    const msg = document.createElement("div");
    msg.className = "message message-ai";

    // Build source tags
    const sourceTags = sources.map(s =>
        `<span class="source-tag">📄 ${escapeHtml(s.file)} · L${s.lines}</span>`
    ).join(" ");

    msg.innerHTML = `
        <div class="message-content">
            <div class="message-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                AI Explanation
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
                ${sourceTags}
            </div>
            <div class="explanation-text">${formatExplanation(explanation)}</div>
        </div>`;
    container.appendChild(msg);

    container.scrollTop = container.scrollHeight;
}

async function sendQuery() {
    const input = document.getElementById("chat-input");
    const query = input.value.trim();

    if (!query || !repoLoaded) return;

    // Add user message
    addMessage("user", query);
    input.value = "";

    // Show loading
    addMessage("loading");

    try {
        const res = await fetch(`${API_BASE}/query?q=${encodeURIComponent(query)}&top_k=3`);
        const data = await res.json();

        if (data.error) {
            const loading = document.getElementById("loading-msg");
            if (loading) loading.remove();
            showToast(data.error, "error");
            return;
        }

        addAIResponse(data.explanation, data.sources || []);

    } catch (err) {
        const loading = document.getElementById("loading-msg");
        if (loading) loading.remove();
        showToast("Failed to get response from backend", "error");
        console.error(err);
    }
}

// ===== ARCHITECTURE GRAPH =====
const LANGUAGE_COLORS = {
    python: "#6366f1",
    javascript: "#f59e0b",
    typescript: "#3b82f6",
    c: "#ef4444",
    cpp: "#ef4444",
    java: "#10b981",
    go: "#06b6d4",
    rust: "#ff7043",
    ruby: "#e91e63",
    csharp: "#68217a",
    swift: "#fc6d26",
    kotlin: "#7f52ff",
    unknown: "#8b5cf6",
};

async function loadArchitecture() {
    try {
        const res = await fetch(`${API_BASE}/architecture`);
        const data = await res.json();

        if (data.error) return;
        if (!data.nodes || data.nodes.length === 0) return;

        const canvasEl = document.getElementById("graph-canvas");
        const emptyState = document.getElementById("graph-empty");
        const legend = document.getElementById("graph-legend");

        emptyState.style.display = "none";
        canvasEl.style.display = "block";
        legend.classList.remove("hidden");

        // Build graph data
        const graphData = {
            nodes: data.nodes.map(n => ({
                id: n.id,
                label: n.label,
                language: n.language,
                color: LANGUAGE_COLORS[n.language] || LANGUAGE_COLORS.unknown,
            })),
            links: data.edges.map(e => ({
                source: e.source,
                target: e.target,
            })),
        };

        // Render force-graph
        if (graphInstance) {
            graphInstance.graphData(graphData);
        } else {
            graphInstance = ForceGraph()(canvasEl)
                .graphData(graphData)
                .backgroundColor("rgba(0,0,0,0)")
                .nodeColor(n => n.color)
                .nodeLabel(n => `${n.id} (${n.language})`)
                .nodeRelSize(6)
                .nodeCanvasObject((node, ctx, globalScale) => {
                    // Draw circle
                    const size = 6;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
                    ctx.fillStyle = node.color;
                    ctx.shadowColor = node.color;
                    ctx.shadowBlur = 8;
                    ctx.fill();
                    ctx.shadowBlur = 0;

                    // Draw label
                    const label = node.label;
                    const fontSize = Math.max(10 / globalScale, 3);
                    ctx.font = `500 ${fontSize}px Inter, sans-serif`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = "rgba(240,240,245,0.85)";
                    ctx.fillText(label, node.x, node.y + size + fontSize + 1);
                })
                .linkColor(() => "rgba(255,255,255,0.08)")
                .linkDirectionalArrowLength(4)
                .linkDirectionalArrowRelPos(1)
                .linkDirectionalArrowColor(() => "rgba(255,255,255,0.15)")
                .linkWidth(1)
                .d3AlphaDecay(0.04)
                .d3VelocityDecay(0.3)
                .warmupTicks(50)
                .cooldownTicks(200);
        }

    } catch (err) {
        console.error("Failed to load architecture:", err);
    }
}

// ===== FILE EXPLORER =====
async function loadFiles() {
    try {
        const res = await fetch(`${API_BASE}/files`);
        const data = await res.json();

        if (data.error) return;

        const fileList = document.getElementById("file-list");
        fileList.innerHTML = "";

        // Group files by directory
        const groups = {};
        data.files.forEach(f => {
            const parts = f.path.split("/");
            const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "/";
            if (!groups[dir]) groups[dir] = [];
            groups[dir].push(f);
        });

        Object.entries(groups).sort().forEach(([dir, files]) => {
            // Directory header
            const dirEl = document.createElement("div");
            dirEl.className = "file-item";
            dirEl.style.opacity = "0.5";
            dirEl.style.fontSize = "11px";
            dirEl.style.fontWeight = "600";
            dirEl.style.textTransform = "uppercase";
            dirEl.style.letterSpacing = "0.5px";
            dirEl.style.cursor = "default";
            dirEl.textContent = dir === "/" ? "Root" : dir;
            fileList.appendChild(dirEl);

            // Files in directory
            files.forEach(f => {
                const el = document.createElement("div");
                el.className = "file-item";
                el.onclick = () => selectFile(f.path, f.language, el);

                const iconClass = getIconClass(f.language);
                const iconLabel = getIconLabel(f.language);

                el.innerHTML = `
                    <div class="file-icon ${iconClass}">${iconLabel}</div>
                    <span class="file-name" title="${f.path}">${f.path.split("/").pop()}</span>
                    <span class="file-lang-tag">${f.language}</span>
                `;
                fileList.appendChild(el);
            });
        });

    } catch (err) {
        console.error("Failed to load files:", err);
    }
}

async function selectFile(filePath, language, el) {
    // Update active state
    document.querySelectorAll(".file-item.active").forEach(e => e.classList.remove("active"));
    el.classList.add("active");

    const headerText = document.getElementById("detail-header-text");
    const content = document.getElementById("file-detail-content");

    headerText.textContent = filePath;

    content.innerHTML = `
        <div class="file-summary">
            <div class="summary-loading">
                <div class="btn-loader" style="display:inline-block;width:16px;height:16px;"></div>
                Generating AI summary...
            </div>
        </div>`;

    try {
        const query = `Give a concise summary of the file ${filePath}. What does it do? What are its main functions/classes?`;
        const res = await fetch(`${API_BASE}/query?q=${encodeURIComponent(query)}&top_k=1`);
        const data = await res.json();

        if (data.explanation) {
            const sourcesHtml = (data.sources || []).map(s =>
                `<span class="source-tag">📄 ${escapeHtml(s.file)} · L${s.lines}</span>`
            ).join(" ");

            content.innerHTML = `
                <div class="file-summary">
                    <h3>
                        <span class="file-icon ${getIconClass(language)}">${getIconLabel(language)}</span>
                        ${filePath.split("/").pop()}
                    </h3>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
                        ${sourcesHtml}
                    </div>
                    <div class="summary-text">${formatExplanation(data.explanation)}</div>
                </div>`;
        } else {
            content.innerHTML = `<div class="empty-state small"><p>No relevant content found for this file.</p></div>`;
        }

    } catch (err) {
        content.innerHTML = `<div class="empty-state small"><p>Failed to generate summary.</p></div>`;
        console.error(err);
    }
}

// ===== UTILITIES =====
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function formatExplanation(text) {
    // Very basic markdown-like formatting
    return text
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code style="background:rgba(99,102,241,0.1);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:12px;">$1</code>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

function getIconClass(language) {
    const mapping = {
        python: "python", javascript: "javascript", typescript: "typescript",
        c: "c", cpp: "cpp", java: "java", go: "go",
    };
    return mapping[language] || "other";
}

function getIconLabel(language) {
    const mapping = {
        python: "PY", javascript: "JS", typescript: "TS",
        c: "C", cpp: "C+", java: "JV", go: "GO",
        rust: "RS", ruby: "RB", csharp: "C#", swift: "SW", kotlin: "KT",
    };
    return mapping[language] || "?";
}

// ===== AUTO-RESIZE TEXTAREA =====
document.addEventListener("DOMContentLoaded", () => {
    const textarea = document.getElementById("chat-input");
    textarea.addEventListener("input", () => {
        textarea.style.height = "auto";
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    });
});
