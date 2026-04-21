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

        // Add link references to nodes for fast lookup
        graphData.links.forEach(link => {
            const a = graphData.nodes.find(n => n.id === link.source);
            const b = graphData.nodes.find(n => n.id === link.target);
            if (a && b) {
                if (!a.neighbors) a.neighbors = [];
                if (!b.neighbors) b.neighbors = [];
                a.neighbors.push(b.id);
                b.neighbors.push(a.id);
            }
        });

        let hoverNode = null;

        // Render force-graph
        if (graphInstance) {
            graphInstance.graphData(graphData);
        } else {
            graphInstance = ForceGraph()(canvasEl)
                .graphData(graphData)
                .backgroundColor("rgba(0,0,0,0)")
                .nodeId('id')
                .nodeColor(n => n.color)
                .nodeLabel(n => `${n.id} (${n.language})`)
                .nodeRelSize(6)
                .onNodeHover(node => {
                    hoverNode = node;
                    // Trigger redraw to update opacities
                    graphInstance
                        .nodeColor(graphInstance.nodeColor())
                        .linkColor(graphInstance.linkColor())
                        .linkDirectionalParticles(graphInstance.linkDirectionalParticles());
                })
                .onNodeClick(node => {
                    // Auto-pan and zoom to clicked node
                    graphInstance.centerAt(node.x, node.y, 600);
                    graphInstance.zoom(2, 600);
                })
                .nodeCanvasObject((node, ctx, globalScale) => {
                    // Check dimming
                    let isDimmed = false;
                    if (hoverNode && hoverNode.id !== node.id && !(hoverNode.neighbors && hoverNode.neighbors.includes(node.id))) {
                        isDimmed = true;
                    }

                    const opacity = isDimmed ? 0.15 : 1;
                    
                    // Draw outer glowing aura
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI);
                    ctx.fillStyle = isDimmed ? 'transparent' : node.color.replace('rgb', 'rgba').replace(')', ', 0.25)');
                    ctx.fill();

                    // Draw solid circle
                    const size = 5;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
                    ctx.fillStyle = isDimmed ? `rgba(100,100,100,0.2)` : node.color;
                    ctx.fill();

                    // Draw label always visible if not dimmed or if scale is high
                    if (!isDimmed || globalScale > 2.5) {
                        const label = node.label;
                        const fontSize = Math.max(12 / globalScale, 3.5);
                        ctx.font = `600 ${fontSize}px Inter, sans-serif`;
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
                        ctx.fillText(label, node.x, node.y + size + fontSize + 2);
                    }
                })
                .linkColor(link => {
                    if (hoverNode) {
                        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                        if (sourceId === hoverNode.id || targetId === hoverNode.id) {
                            return hoverNode.color; // Highlight active connection with the node's color
                        }
                        return "rgba(255,255,255,0.03)"; // Deep dim for rest
                    }
                    return "rgba(255,255,255,0.15)";
                })
                .linkDirectionalParticles(link => {
                    if (hoverNode) {
                        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                        return (sourceId === hoverNode.id || targetId === hoverNode.id) ? 4 : 0;
                    }
                    return 2; // Normal state
                })
                .linkDirectionalParticleWidth(link => {
                    if (hoverNode) {
                        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                        return (sourceId === hoverNode.id || targetId === hoverNode.id) ? 3 : 0;
                    }
                    return 1.5;
                })
                .linkDirectionalParticleSpeed(0.005)
                .linkDirectionalArrowLength(3.5)
                .linkDirectionalArrowRelPos(1)
                .linkDirectionalArrowColor(() => "rgba(255,255,255,0.4)")
                .linkWidth(link => {
                    if (hoverNode) {
                        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                        return (sourceId === hoverNode.id || targetId === hoverNode.id) ? 2.5 : 0.5;
                    }
                    return 1.5;
                })
                .d3AlphaDecay(0.02)
                .d3VelocityDecay(0.4)
                .warmupTicks(60)
                .cooldownTicks(200);

            // Auto fit after init
            setTimeout(() => {
                graphInstance.zoomToFit(600, 50);
            }, 500);
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
        const res = await fetch(`${API_BASE}/query?q=${encodeURIComponent(query)}&file_path=${encodeURIComponent(filePath)}&top_k=5`);
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
    // Comprehensive markdown-to-HTML rendering
    let html = text;

    // Fenced code blocks (```lang\ncode\n```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const langLabel = lang ? `<span style="position:absolute;top:6px;right:10px;font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">${lang}</span>` : '';
        return `<div style="position:relative;"><pre style="background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:14px;margin:10px 0;overflow-x:auto;font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);line-height:1.6;">${langLabel}<code>${escapeHtml(code.trim())}</code></pre></div>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(99,102,241,0.1);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:12px;">$1</code>');

    // Headers (### h3, ## h2)
    html = html.replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:600;color:var(--text-primary);margin:16px 0 6px 0;">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 style="font-size:15px;font-weight:600;color:var(--text-primary);margin:18px 0 8px 0;">$1</h3>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border-subtle);margin:14px 0;">');

    // Bold and italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Numbered lists (1. item)
    html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<div style="display:flex;gap:8px;margin:4px 0;padding-left:4px;"><span style="color:var(--accent-indigo);font-weight:600;min-width:18px;">$1.</span><span>$2</span></div>');

    // Bullet lists (- item or * item)
    html = html.replace(/^[\-\*]\s+(.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0;padding-left:4px;"><span style="color:var(--accent-indigo);">•</span><span>$1</span></div>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    // Clean up excessive <br> after block elements
    html = html.replace(/<\/div><br>/g, '</div>');
    html = html.replace(/<\/pre><\/div><br>/g, '</pre></div>');
    html = html.replace(/<\/h3><br>/g, '</h3>');
    html = html.replace(/<\/h4><br>/g, '</h4>');
    html = html.replace(/<hr[^>]*><br>/g, '<hr style="border:none;border-top:1px solid var(--border-subtle);margin:14px 0;">');

    return html;
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
