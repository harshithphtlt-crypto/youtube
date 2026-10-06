// AutoShorts AI Dashboard Frontend Logic

let isVercelEnvironment = false;

document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initSystemStatus();
    initGenerateForm();
    loadGallery();
    initSettingsForm();
    loadGitHubRuns();

    const refreshRunsBtn = document.getElementById("refresh-runs-btn");
    if (refreshRunsBtn) refreshRunsBtn.onclick = loadGitHubRuns;
});

// Toast notification helper
function showToast(message, duration = 3500) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, duration);
}

// Navigation Tab Switching
function initNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const tabPanes = document.querySelectorAll(".tab-pane");

    navItems.forEach(btn => {
        btn.addEventListener("click", () => {
            const tabId = btn.getAttribute("data-tab");
            
            navItems.forEach(b => b.classList.remove("active"));
            tabPanes.forEach(pane => pane.classList.remove("active"));

            btn.classList.add("active");
            const activePane = document.getElementById(`tab-${tabId}`);
            if (activePane) activePane.classList.add("active");

            if (tabId === "library") {
                loadGallery();
            } else if (tabId === "scheduler") {
                loadGitHubRuns();
            }
        });
    });
}

// System Status Check
async function initSystemStatus() {
    try {
        const res = await fetch("/api/status");
        const data = await res.json();
        
        const geminiDot = document.getElementById("gemini-status-dot");
        const geminiText = document.getElementById("gemini-status-text");

        if (data.is_vercel) {
            isVercelEnvironment = true;
            geminiDot.className = "status-dot green";
            geminiText.textContent = "Cloud Mode";

            const ytStatusBox = document.getElementById("youtube-connection-status");
            if (ytStatusBox) {
                if (data.github_configured) {
                    ytStatusBox.className = "alert-box success-box";
                    ytStatusBox.innerHTML = `<strong>&#10004; GitHub Connected:</strong> ${data.repo_owner}/${data.repo_name} &rarr; Actions dispatch ready.`;
                } else {
                    ytStatusBox.className = "alert-box info-box";
                    ytStatusBox.innerHTML = "<strong>Notice:</strong> Add <code>GITHUB_PAT</code>, <code>GITHUB_OWNER</code>, and <code>GITHUB_REPO</code> to your Vercel Environment Variables.";
                }
            }
            return;
        }

        if (data.gemini_configured) {
            geminiDot.className = "status-dot green";
            geminiText.textContent = "API Active";
        } else {
            geminiDot.className = "status-dot yellow";
            geminiText.textContent = "Curated Engine";
        }

        const ytStatusBox = document.getElementById("youtube-connection-status");
        if (ytStatusBox) {
            if (data.youtube_configured) {
                ytStatusBox.className = "alert-box success-box";
                ytStatusBox.innerHTML = "<strong>&#10004; YouTube OAuth Ready:</strong> Direct 1-click uploads and scheduling enabled.";
            } else {
                ytStatusBox.className = "alert-box info-box";
                ytStatusBox.innerHTML = "<strong>Notice:</strong> <code>client_secrets.json</code> not detected. Add it to project root for automatic YouTube uploads.";
            }
        }
    } catch (err) {
        console.error("Status check failed:", err);
    }
}

// GitHub Actions Runs loader
async function loadGitHubRuns() {
    const container = document.getElementById("github-runs-container");
    if (!container) return;

    try {
        const res = await fetch("/api/runs");
        const data = await res.json();

        if (!data.configured) {
            container.innerHTML = `
                <div class="alert-box info-box" style="margin: 0; font-size: 0.85rem;">
                    ${data.message || "Set GITHUB_PAT, GITHUB_OWNER, and GITHUB_REPO in Vercel to link GitHub Actions."}
                </div>
            `;
            return;
        }

        if (!data.runs || data.runs.length === 0) {
            container.innerHTML = `<div class="empty-state" style="padding: 1rem;"><p>No workflow runs triggered yet.</p></div>`;
            return;
        }

        container.innerHTML = data.runs.map(r => {
            const isSuccess = r.conclusion === "success";
            const isProgress = r.status === "in_progress" || r.status === "queued";
            const statusClass = isSuccess ? "green" : (isProgress ? "yellow" : "red");
            const statusLabel = r.conclusion || r.status;
            const dateStr = new Date(r.created_at).toLocaleString();

            return `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 0.6rem 0.9rem; border-radius: 8px; border: 1px solid var(--border-color);">
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <span class="status-dot ${statusClass}"></span>
                        <div>
                            <div style="font-weight: 500; font-size: 0.88rem;">${r.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${dateStr}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.8rem;">
                        <span style="font-size: 0.75rem; text-transform: uppercase; font-family: monospace; color: var(--text-muted);">${statusLabel}</span>
                        <a href="${r.html_url}" target="_blank" class="btn-secondary" style="padding: 0.2rem 0.6rem; font-size: 0.75rem; text-decoration: none;">View Run &rarr;</a>
                    </div>
                </div>
            `;
        }).join("");
    } catch (e) {
        container.innerHTML = `<div class="alert-box error-box" style="margin: 0; font-size: 0.85rem;">Error loading workflow runs: ${e.message}</div>`;
    }
}

// Video Generation
let currentProgressPoll = null;

function initGenerateForm() {
    const form = document.getElementById("generate-form");
    const idlePreview = document.getElementById("idle-preview");
    const progressContainer = document.getElementById("progress-container");
    const resultContainer = document.getElementById("result-container");
    const startBtn = document.getElementById("start-btn");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const niche = document.getElementById("niche-select").value;
        const prompt = document.getElementById("custom-prompt").value;
        const voice = document.getElementById("voice-select").value;
        const visual_style = document.getElementById("style-select").value;
        const auto_upload = document.getElementById("auto-upload-check").checked;

        // Vercel Serverless Mode: Dispatch directly to GitHub Actions
        if (isVercelEnvironment) {
            idlePreview.style.display = "none";
            progressContainer.style.display = "none";
            startBtn.disabled = true;
            startBtn.innerHTML = `<span>Dispatching to GitHub Actions...</span>`;

            try {
                const response = await fetch("/api/trigger", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ niche, auto_upload })
                });
                const data = await response.json();

                idlePreview.style.display = "block";
                startBtn.disabled = false;
                startBtn.innerHTML = `<span>1-Click Generate & Render Short</span>`;

                if (data.success) {
                    showToast("🚀 Workflow dispatched on GitHub Actions!");
                    idlePreview.innerHTML = `
                        <div class="empty-icon" style="color: var(--accent);">&#10004;</div>
                        <h3>Production Started on GitHub Actions!</h3>
                        <p style="margin-top: 0.5rem; color: var(--text-muted);">${data.message}</p>
                        <p style="margin-top: 0.4rem; font-size: 0.85rem; color: var(--text-muted);">Your video will be generated with FFmpeg and Edge-TTS in GitHub's cloud in ~1.5 minutes.</p>
                        <p style="margin-top: 1.2rem;">
                            <a href="https://github.com/harshithphtlt-crypto/youtube/actions" target="_blank" class="primary-btn" style="display: inline-block; text-decoration: none; padding: 0.6rem 1.2rem;">
                                View Live Run in GitHub Actions &rarr;
                            </a>
                        </p>
                    `;
                    setTimeout(loadGitHubRuns, 1500);
                } else {
                    showToast(data.message || "Failed to trigger workflow");
                }
            } catch (err) {
                idlePreview.style.display = "block";
                startBtn.disabled = false;
                startBtn.innerHTML = `<span>1-Click Generate & Render Short</span>`;
                showToast("Dispatch error: " + err.message);
            }
            return;
        }

        // Local Server Mode
        idlePreview.style.display = "none";
        resultContainer.style.display = "none";
        progressContainer.style.display = "flex";
        startBtn.disabled = true;
        startBtn.innerHTML = `<span>Synthesizing Video...</span>`;

        // Reset step indicators
        resetStepIndicators();

        try {
            const response = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ niche, prompt, voice, visual_style, auto_upload })
            });

            const data = await response.json();
            const jobId = data.job_id;

            // Start polling progress
            startPollingProgress(jobId);

        } catch (error) {
            showToast("Failed to start generation: " + error.message);
            progressContainer.style.display = "none";
            idlePreview.style.display = "block";
            startBtn.disabled = false;
            startBtn.innerHTML = `<span>1-Click Generate & Render Short</span>`;
        }
    });
}

function resetStepIndicators() {
    for (let i = 1; i <= 8; i++) {
        const el = document.getElementById(`step-${i}`);
        if (el) el.className = "step-item";
    }
    updateProgressUI("Starting automated production...", 5);
}

function updateProgressUI(message, percentage) {
    const title = document.getElementById("progress-step-title");
    const perc = document.getElementById("progress-percentage");
    const fill = document.getElementById("progress-bar-fill");

    if (title) title.textContent = message;
    if (perc) perc.textContent = `${percentage}%`;
    if (fill) fill.style.width = `${percentage}%`;

    // Highlight step
    let stepNum = 1;
    if (percentage >= 95) stepNum = 8;
    else if (percentage >= 85) stepNum = 7;
    else if (percentage >= 75) stepNum = 6;
    else if (percentage >= 65) stepNum = 5;
    else if (percentage >= 50) stepNum = 4;
    else if (percentage >= 35) stepNum = 3;
    else if (percentage >= 20) stepNum = 2;
    else stepNum = 1;

    for (let i = 1; i <= 8; i++) {
        const el = document.getElementById(`step-${i}`);
        if (!el) continue;
        if (i < stepNum) el.className = "step-item done";
        else if (i === stepNum) el.className = "step-item active";
        else el.className = "step-item";
    }
}

function startPollingProgress(jobId) {
    if (currentProgressPoll) clearInterval(currentProgressPoll);

    currentProgressPoll = setInterval(async () => {
        try {
            const res = await fetch(`/api/progress/${jobId}`);
            const data = await res.json();

            updateProgressUI(data.message, data.percentage);

            if (data.status === "completed") {
                clearInterval(currentProgressPoll);
                showFinalVideoResult(data.result);
            } else if (data.status === "error") {
                clearInterval(currentProgressPoll);
                showToast("Generation error: " + data.message);
                document.getElementById("start-btn").disabled = false;
                document.getElementById("start-btn").innerHTML = `<span>1-Click Generate & Render Short</span>`;
            }
        } catch (err) {
            console.error("Progress poll error:", err);
        }
    }, 1200);
}

function showFinalVideoResult(record) {
    const progressContainer = document.getElementById("progress-container");
    const resultContainer = document.getElementById("result-container");
    const startBtn = document.getElementById("start-btn");

    progressContainer.style.display = "none";
    resultContainer.style.display = "flex";

    startBtn.disabled = false;
    startBtn.innerHTML = `<span>1-Click Generate & Render Short</span>`;

    // Populate data
    document.getElementById("result-title").textContent = record.title;

    // Tags
    const tagsContainer = document.getElementById("result-tags");
    tagsContainer.innerHTML = "";
    (record.tags || []).slice(0, 5).forEach(tag => {
        const span = document.createElement("span");
        span.className = "tag-pill";
        span.textContent = `#${tag}`;
        tagsContainer.appendChild(span);
    });

    // Video Player
    const player = document.getElementById("final-video-player");
    player.src = `/api/video/${record.filename}`;
    player.load();
    player.play().catch(() => {}); // Autoplay if permitted

    // Download button
    const downloadBtn = document.getElementById("download-video-btn");
    downloadBtn.href = `/api/video/${record.filename}`;

    // Copy Metadata
    document.getElementById("copy-metadata-btn").onclick = () => {
        const text = `TITLE:\n${record.title}\n\nDESCRIPTION:\n${record.description}\n\nTAGS:\n${(record.tags || []).join(", ")}`;
        navigator.clipboard.writeText(text);
        showToast("SEO Metadata copied to clipboard!");
    };

    // Upload Now Button
    document.getElementById("upload-now-btn").onclick = async () => {
        showToast("Initiating YouTube upload...");
        try {
            const res = await fetch(`/api/upload/${record.id}`, { method: "POST" });
            const data = await res.json();
            if (data.status === "uploaded") {
                showToast("Uploaded successfully! " + data.url);
            } else {
                showToast(data.message || "Upload status: " + data.status);
            }
        } catch (e) {
            showToast("Upload failed: " + e.message);
        }
    };

    showToast("Video rendered successfully!");
    loadGallery();
}

// Video Gallery
async function loadGallery() {
    try {
        const res = await fetch("/api/gallery");
        const list = await res.json();

        const countBadge = document.getElementById("video-count");
        if (countBadge) countBadge.textContent = list.length;

        const grid = document.getElementById("gallery-grid");
        if (!grid) return;

        grid.innerHTML = "";
        if (list.length === 0) {
            grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>No generated videos yet. Create your first Short above!</p></div>`;
            return;
        }

        list.forEach(item => {
            const card = document.createElement("div");
            card.className = "gallery-card";
            card.innerHTML = `
                <div class="gallery-thumb-container">
                    <video src="/api/video/${item.filename}" controls preload="metadata"></video>
                </div>
                <div class="gallery-meta">
                    <h4>${item.title}</h4>
                    <div class="gallery-meta-row">
                        <span>${item.niche}</span>
                        <span>${item.duration}s</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        console.error("Failed to load gallery:", err);
    }
}

// Refresh gallery button
const refreshBtn = document.getElementById("refresh-gallery-btn");
if (refreshBtn) refreshBtn.onclick = loadGallery;

// Settings Form
function initSettingsForm() {
    const form = document.getElementById("save-gemini-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const key = document.getElementById("gemini-key-input").value.trim();
        if (!key) return;

        try {
            const res = await fetch("/api/settings/gemini", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ api_key: key })
            });
            const data = await res.json();
            if (data.success) {
                showToast("Gemini API Key saved to .env!");
                initSystemStatus();
                document.getElementById("gemini-key-input").value = "";
            }
        } catch (err) {
            showToast("Error saving key: " + err.message);
        }
    });
}
