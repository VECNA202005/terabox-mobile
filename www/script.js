document.addEventListener("DOMContentLoaded", () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // ================= DUAL-MODE BACKEND LOGIC =================
    let backendBaseUrl = localStorage.getItem("backendBaseUrl") || "https://terabox-dl.onrender.com";
    let serverMode = localStorage.getItem("serverMode") || "cloud";

    // Intercept all fetches to prepend the backend URL if it's an API call
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        let [resource, config] = args;
        if (typeof resource === 'string' && resource.startsWith('/api/')) {
            if (backendBaseUrl) {
                resource = backendBaseUrl.replace(/\/$/, '') + resource;
            }
        }
        return originalFetch(resource, config);
    };

    // ================= HELPERS =================
    const formatSize = (bytes) => {
        if (!bytes) return "0 B";
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
    };

    // ================= ELEMENTS =================
    const btnHamburger = document.getElementById("btn-hamburger");
    const sidebar = document.getElementById("sidebar");
    const sidebarBackdrop = document.getElementById("sidebar-backdrop");
    
    // Sidebar Toggle Logic
    const toggleSidebar = () => {
        sidebar.classList.toggle("open");
        sidebarBackdrop.classList.toggle("show");
    };
    const closeSidebar = () => {
        sidebar.classList.remove("open");
        sidebarBackdrop.classList.remove("show");
    };

    btnHamburger.addEventListener("click", toggleSidebar);
    sidebarBackdrop.addEventListener("click", closeSidebar);

    // Close sidebar when clicking a nav button
    document.querySelectorAll(".sidebar-links .nav-btn").forEach(btn => {
        btn.addEventListener("click", closeSidebar);
    });

    const btnHome = document.getElementById("btn-home");
    const btnDrive = document.getElementById("btn-drive");
    const btnMega = document.getElementById("btn-mega");
    const btnFavorites = document.getElementById("btn-favorites");
    const btnHistory = document.getElementById("btn-history");
    const btnServerDownloads = document.getElementById("btn-server-downloads");
    const btnHelp = document.getElementById("btn-help");
    const btnSettings = document.getElementById("btn-settings");

    const searchSection = document.querySelector(".search-section");
    const heroSection = document.querySelector(".hero-section");
    const loadingSection = document.getElementById("loading-section");
    const errorSection = document.getElementById("error-section");
    const resultsSection = document.getElementById("results-section");
    const driveSection = document.getElementById("drive-section");
    const megaSection = document.getElementById("mega-section");
    const favoritesSection = document.getElementById("favorites-section");
    const historySection = document.getElementById("history-section");
    const serverDownloadsSection = document.getElementById("server-downloads-section");
    const helpSection = document.getElementById("help-section");
    const settingsSection = document.getElementById("settings-section");

    const driveCount = document.getElementById("drive-count");
    const btnDriveBack = document.getElementById("btn-drive-back");
    const btnDriveRefresh = document.getElementById("btn-drive-refresh");
    const driveCurrentPath = document.getElementById("drive-current-path");
    const driveFilesGrid = document.getElementById("drive-files-grid");
    
    const megaGrid = document.getElementById("mega-files-grid");
    const megaCount = document.getElementById("mega-count");
    const btnMegaRefresh = document.getElementById("btn-mega-refresh");
    const btnMegaDuplicates = document.getElementById("btn-mega-duplicates");

    const favoritesCount = document.getElementById("favorites-count");
    const favoritesFilesGrid = document.getElementById("favorites-files-grid");
    const btnFavoritesClear = document.getElementById("btn-favorites-clear");

    const historyCount = document.getElementById("history-count");
    const historyFilesGrid = document.getElementById("history-files-grid");
    const btnHistoryClear = document.getElementById("btn-history-clear");

    const serverDownloadsCount = document.getElementById("server-downloads-count");
    const downloadsGrid = document.getElementById("downloads-grid");
    const btnServerRefresh = document.getElementById("btn-server-refresh");
    const btnServerClearAll = document.getElementById("btn-server-clear-all");

    const inputUrl = document.getElementById("input-url");
    const btnClear = document.getElementById("btn-clear");
    const btnInspect = document.getElementById("btn-inspect");

    const advancedToggle = document.getElementById("advanced-toggle");
    const advancedPanel = document.getElementById("advanced-panel");
    const inputCookie = document.getElementById("input-cookie");
    const btnCookieVisibility = document.getElementById("btn-cookie-visibility");
    const eyeIcon = document.getElementById("eye-icon");

    const settingsCookieInput = document.getElementById("settings-cookie-input");
    const settingsServerMode = document.getElementById("settings-server-mode");
    const settingsServerUrl = document.getElementById("settings-server-url");
    const btnSaveSettings = document.getElementById("btn-save-settings");
    const btnClearSettings = document.getElementById("btn-clear-settings");

    const resultsSurl = document.getElementById("results-surl");
    const resultsCount = document.getElementById("results-count");
    const btnCopySurl = document.getElementById("btn-copy-surl");
    const filesGrid = document.getElementById("files-grid");

    const playerModal = document.getElementById("player-modal");
    const modalBackdrop = document.getElementById("modal-backdrop");
    const btnCloseModal = document.getElementById("btn-close-modal");
    const modalVideoTitle = document.getElementById("modal-video-title");
    const videoPlayer = document.getElementById("player");

    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toast-message");
    const loadingStatus = document.getElementById("loading-status");
    const errorMessage = document.getElementById("error-message");

    const playerNav = document.getElementById("player-nav");
    const btnPrevVideo = document.getElementById("btn-prev-video");
    const btnNextVideo = document.getElementById("btn-next-video");
    const playerNavCounter = document.getElementById("player-nav-counter");

    // Current State
    let activeShortcode = "";
    let savedCookie = localStorage.getItem("ndus_cookie") || "";
    let savedFavorites = [];
    let watchHistory = {};
    let currentPlaylist = [];
    let currentVideoIndex = -1;
    let isDrivePlaylist = false;
    let downloadPollInterval = null;
    let cachedServerDownloads = [];
    let cachedMegaFiles = [];
    let lastSyncedCompleted = "";

    // Sync saved cookie with inputs
    if (savedCookie) {
        inputCookie.value = savedCookie;
        settingsCookieInput.value = savedCookie;
        loadAppDatabase(savedCookie);
    }

    // Initialize Dual-Mode UI
    settingsServerMode.value = serverMode;
    settingsServerUrl.value = backendBaseUrl;
    
    settingsServerMode.addEventListener("change", () => {
        settingsServerUrl.disabled = false;
        if (settingsServerMode.value === "cloud" && !settingsServerUrl.value.includes("render")) {
            settingsServerUrl.value = "https://your-backend.onrender.com";
        } else if (settingsServerMode.value === "local" && !settingsServerUrl.value.includes("http")) {
            settingsServerUrl.value = "http://192.168.x.x:3000";
        }
    });
    // Trigger initial state
    settingsServerMode.dispatchEvent(new Event("change"));

    btnSaveSettings.addEventListener("click", () => {
        const newCookie = settingsCookieInput.value.trim();
        localStorage.setItem("ndus_cookie", newCookie);
        
        const newMode = settingsServerMode.value;
        const newUrl = settingsServerUrl.value.trim();
        localStorage.setItem("serverMode", newMode);
        localStorage.setItem("backendBaseUrl", newUrl);
        
        showToast("Settings saved successfully! Reloading app...");
        setTimeout(() => window.location.reload(), 1500);
    });

    async function loadAppDatabase(cookie) {
        if (!cookie) return;
        try {
            const [favRes, histRes, dlRes] = await Promise.all([
                fetch(`/api/favorites?cookie=${encodeURIComponent(cookie)}`).then(r => r.json()),
                fetch(`/api/history?cookie=${encodeURIComponent(cookie)}`).then(r => r.json()),
                fetch(`/api/downloads-history?cookie=${encodeURIComponent(cookie)}`).then(r => r.json())
            ]);
            if (favRes.status === "success") savedFavorites = favRes.favorites || [];
            if (histRes.status === "success") watchHistory = histRes.history || {};
            if (dlRes.status === "success") {
                cachedServerDownloads = dlRes.downloads || [];
                if (dlRes.megaFiles) cachedMegaFiles = dlRes.megaFiles;
            }
            silentFetchDownloadsStatus();
        } catch (e) {
            console.error("Failed to load app database", e);
        }
    }

    async function silentFetchDownloadsStatus() {
        const customCookie = inputCookie.value.trim() || savedCookie;
        if (!customCookie) return;
        try {
            const res = await fetch(`/api/downloads-status?cookie=${encodeURIComponent(customCookie)}`);
            const data = await res.json();
            
            if (data.status === "success") {
                const activeIds = data.downloads.map(d => d.id);
                // Merge active downloads with historical downloads
                const filteredHistory = cachedServerDownloads.filter(h => !activeIds.includes(h.id));
                cachedServerDownloads = [...filteredHistory, ...(data.downloads || [])];
                if (data.megaFiles) cachedMegaFiles = data.megaFiles;
                
                // Save completed ones to backend Mega DB
                const completed = cachedServerDownloads.filter(d => d.status === "completed" || d.status === "error");
                await fetch("/api/downloads-history", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ cookie: customCookie, downloads: completed })
                });
            }
        } catch (e) {
            console.error("Silent fetch downloads failed", e);
        }
    }

    // Removed Plyr. Using native HTML5 video player instead.
    // Client-side hover preview removed since we use native video controls now.

    let lastHistorySave = 0;
    videoPlayer.addEventListener("timeupdate", () => {
        if (videoPlayer.paused || !modalVideoTitle.textContent) return;
        const time = videoPlayer.currentTime;
        const duration = videoPlayer.duration;
        const title = modalVideoTitle.textContent;
        if (time > 0 && time < duration - 5) {
            if (!watchHistory[title]) {
                const fileObj = currentPlaylist[currentVideoIndex];
                watchHistory[title] = { time, file: fileObj, lastWatched: Date.now() };
            } else {
                watchHistory[title].time = time;
                watchHistory[title].lastWatched = Date.now();
            }
            
            const now = Date.now();
            if (now - lastHistorySave > 5000) {
                lastHistorySave = now;
                const cookieToSend = inputCookie.value.trim() || savedCookie;
                if (!cookieToSend) return;
                fetch("/api/history", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ cookie: cookieToSend, filename: title, time, fileData: watchHistory[title].file })
                }).catch(e => {});
            }
        }
    });

    videoPlayer.addEventListener("loadedmetadata", () => {
        const title = modalVideoTitle.textContent;
        if (watchHistory[title] && watchHistory[title].time > 0) {
            videoPlayer.currentTime = watchHistory[title].time;
            const timestamp = new Date(watchHistory[title].time * 1000).toISOString().substr(11, 8);
            showToast(`Resumed from ${timestamp}`, 2000);
        }
    });

    // ================= TOAST NOTIFICATION =================
    function showToast(message, duration = 3000) {
        toastMessage.textContent = message;
        toast.classList.remove("hidden");
        
        // Remove older timeouts if running
        if (window.toastTimeout) {
            clearTimeout(window.toastTimeout);
        }

        window.toastTimeout = setTimeout(() => {
            toast.classList.add("hidden");
        }, duration);
    }

    // ================= TAB SWITCHING =================
    function hideAllSections() {
        searchSection.classList.add("hidden");
        heroSection.classList.add("hidden");
        loadingSection.classList.add("hidden");
        errorSection.classList.add("hidden");
        resultsSection.classList.add("hidden");
        driveSection.classList.add("hidden");
        megaSection.classList.add("hidden");
        favoritesSection.classList.add("hidden");
        historySection.classList.add("hidden");
        serverDownloadsSection.classList.add("hidden");
        helpSection.classList.add("hidden");
        settingsSection.classList.add("hidden");

        btnHome.classList.remove("active");
        btnDrive.classList.remove("active");
        btnMega.classList.remove("active");
        btnFavorites.classList.remove("active");
        btnHistory.classList.remove("active");
        btnServerDownloads.classList.remove("active");
        btnHelp.classList.remove("active");
        btnSettings.classList.remove("active");

        if (downloadPollInterval) {
            clearInterval(downloadPollInterval);
            downloadPollInterval = null;
        }
    }

    btnHome.addEventListener("click", () => {
        hideAllSections();
        btnHome.classList.add("active");
        searchSection.classList.remove("hidden");
        heroSection.classList.remove("hidden");
        if (filesGrid.children.length > 0) {
            resultsSection.classList.remove("hidden");
        }
    });

    btnDrive.addEventListener("click", () => {
        hideAllSections();
        btnDrive.classList.add("active");
        driveSection.classList.remove("hidden");
        loadDriveFiles(currentDrivePath);
    });

    btnMega.addEventListener("click", () => {
        hideAllSections();
        btnMega.classList.add("active");
        megaSection.classList.remove("hidden");
        fetchMegaFiles();
    });

    if (btnMegaRefresh) {
        btnMegaRefresh.addEventListener("click", () => {
            fetchMegaFiles();
        });
    }
    
    if (btnMegaDuplicates) {
        btnMegaDuplicates.addEventListener("click", () => {
            fetchMegaDuplicates();
        });
    }

    btnFavorites.addEventListener("click", () => {
        hideAllSections();
        btnFavorites.classList.add("active");
        favoritesSection.classList.remove("hidden");
        renderFavorites();
    });

    btnHistory.addEventListener("click", () => {
        hideAllSections();
        btnHistory.classList.add("active");
        historySection.classList.remove("hidden");
        renderHistory();
    });

    btnServerDownloads.addEventListener("click", () => {
        hideAllSections();
        btnServerDownloads.classList.add("active");
        serverDownloadsSection.classList.remove("hidden");
        fetchDownloadsStatus();
        downloadPollInterval = setInterval(fetchDownloadsStatus, 2000);
    });

    btnServerRefresh.addEventListener("click", () => {
        fetchDownloadsStatus();
    });

    btnFavoritesClear.addEventListener("click", () => {
        if (!confirm("Are you sure you want to clear all favorites?")) return;
        savedFavorites = [];
        renderFavorites();
        const cookieToSend = inputCookie.value.trim() || savedCookie;
        fetch("/api/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookie: cookieToSend, favorites: savedFavorites })
        }).catch(e => {});
    });

    btnHistoryClear.addEventListener("click", () => {
        if (!confirm("Are you sure you want to clear all watch history?")) return;
        watchHistory = {};
        renderHistory();
        const cookieToSend = inputCookie.value.trim() || savedCookie;
        fetch("/api/history/clear", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookie: cookieToSend })
        }).catch(e => {});
    });

    btnServerClearAll.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete ALL server downloads? This cannot be undone.")) return;
        
        btnServerClearAll.disabled = true;
        btnServerClearAll.innerHTML = '<i data-lucide="loader" class="btn-icon-sm spin"></i> Deleting...';
        
        try {
            const deletePromises = cachedServerDownloads.map(dl => 
                fetch(`/api/server-download/${dl.id}`, { method: "DELETE" })
            );
            await Promise.all(deletePromises);
            showToast("All server downloads deleted.");
        } catch (e) {
            showToast("Error deleting some downloads.");
        }
        
        btnServerClearAll.disabled = false;
        btnServerClearAll.innerHTML = '<i data-lucide="trash-2" class="btn-icon-sm"></i> Delete All';
        lucide.createIcons();
        fetchDownloadsStatus();
    });

    btnHelp.addEventListener("click", () => {
        hideAllSections();
        btnHelp.classList.add("active");
        helpSection.classList.remove("hidden");
    });

    btnSettings.addEventListener("click", () => {
        hideAllSections();
        btnSettings.classList.add("active");
        settingsSection.classList.remove("hidden");
    });

    // ================= ADVANCED PANEL TOGGLE =================
    advancedToggle.addEventListener("click", () => {
        advancedToggle.classList.toggle("active");
        advancedPanel.classList.toggle("show");
    });

    // Password visibility toggle
    btnCookieVisibility.addEventListener("click", () => {
        const type = inputCookie.getAttribute("type") === "password" ? "text" : "password";
        inputCookie.setAttribute("type", type);
        
        if (type === "text") {
            btnCookieVisibility.innerHTML = '<i data-lucide="eye-off" id="eye-icon"></i>';
        } else {
            btnCookieVisibility.innerHTML = '<i data-lucide="eye" id="eye-icon"></i>';
        }
        lucide.createIcons();
    });

    // ================= SETTINGS EVENT HANDLERS =================
    btnSaveSettings.addEventListener("click", () => {
        const value = settingsCookieInput.value.trim();
        
        if (value) {
            localStorage.setItem("ndus_cookie", value);
            savedCookie = value;
            inputCookie.value = value;
            
            // Sync settings to backend
            fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cookie: value })
            }).catch(e => console.error("Failed to sync settings", e));
            
            showToast("Settings saved successfully! 🚀");
        } else {
            showToast("Please enter a valid cookie string.");
        }
    });

    btnClearSettings.addEventListener("click", () => {
        localStorage.removeItem("ndus_cookie");
        savedCookie = "";
        inputCookie.value = "";
        settingsCookieInput.value = "";
        showToast("Credentials cleared! 🗑️");
    });

    // ================= INPUT MANAGEMENT =================
    inputUrl.addEventListener("input", () => {
        if (inputUrl.value.trim()) {
            btnClear.style.display = "flex";
        } else {
            btnClear.style.display = "none";
        }
    });

    btnClear.addEventListener("click", () => {
        inputUrl.value = "";
        btnClear.style.display = "none";
        inputUrl.focus();
    });

    // Enter key triggers inspect
    inputUrl.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            btnInspect.click();
        }
    });

    // ================= CODES & META EXTRACTION =================
    btnInspect.addEventListener("click", async () => {
        const urlValue = inputUrl.value.trim();
        if (!urlValue) {
            showToast("Please paste a valid TeraBox share link.");
            return;
        }

        // Collapse advanced panel
        advancedToggle.classList.remove("active");
        advancedPanel.classList.remove("show");

        // UI updates
        hideAllSections();
        btnHome.classList.add("active");
        searchSection.classList.remove("hidden");
        heroSection.classList.remove("hidden");
        loadingSection.classList.remove("hidden");
        
        loadingStatus.textContent = "Parsing URL shortcode...";
        
        const cookieToSend = inputCookie.value.trim();

        try {
            loadingStatus.textContent = "Querying backend proxy...";
            const response = await fetch(`/api/list?url=${encodeURIComponent(urlValue)}&cookie=${encodeURIComponent(cookieToSend)}`);
            
            if (!response.ok) {
                throw new Error(`Server returned status code ${response.status}`);
            }

            const data = await response.json();

            if (data.status === "error") {
                throw new Error(data.message || "Failed to retrieve directory list.");
            }

            activeShortcode = data.surl || "";
            renderFiles(data.files || []);

        } catch (err) {
            console.error("Inspection error:", err.message);
            loadingSection.classList.add("hidden");
            errorSection.classList.remove("hidden");
            errorMessage.textContent = err.message || "Failed to connect to the backend server. Make sure it is running.";
        }
    });

    // ================= RENDER GRID OF FILES =================
    function isVideoFile(filename) {
        const ext = filename.split(".").pop().toLowerCase();
        const videoExtensions = ["mp4", "mkv", "avi", "mov", "webm", "flv", "3gp", "ts", "m4v", "wmv"];
        return videoExtensions.includes(ext);
    }

    function renderFiles(files) {
        filesGrid.innerHTML = "";
        loadingSection.classList.add("hidden");

        // Clean old warning banner if exists
        const oldBanner = resultsSection.querySelector(".drive-warning-banner");
        if (oldBanner) oldBanner.remove();

        const hasRestricted = files.some(f => !f.dlink);
        if (hasRestricted) {
            const warningBanner = document.createElement("div");
            warningBanner.className = "error-card drive-warning-banner";
            warningBanner.style.marginBottom = "1.5rem";
            warningBanner.style.border = "1px solid var(--clr-warning)";
            warningBanner.style.backgroundColor = "var(--clr-warning-bg)";
            warningBanner.innerHTML = `
                <i data-lucide="info" style="color: var(--clr-warning); flex-shrink: 0;" class="error-icon"></i>
                <div class="error-content">
                    <h3 class="error-title" style="color: var(--clr-warning)">Flagged/Restricted Share Link Detected</h3>
                    <p class="error-message" style="color: var(--clr-text-main); line-height: 1.5; font-size: 0.9rem;">
                        TeraBox restricts direct downloads on shared links for flagged or restricted files. To play or download:
                        <br>1. Open this share link in your browser and click <strong>"Save to my TeraBox"</strong>.
                        <br>2. Open the <strong>My Drive</strong> tab in this app to access, play, or download it directly!
                    </p>
                </div>
            `;
            resultsSection.insertBefore(warningBanner, resultsSection.children[1]);
        }

        if (!files.length) {
            resultsSurl.textContent = "Share Contents";
            resultsCount.textContent = "0 files found";
            showToast("No files found in the specified folder.");
            return;
        }

        resultsSurl.textContent = `Shortcode: ${activeShortcode}`;
        resultsCount.textContent = `Found ${files.length} item(s)`;

        const videoFiles = files.filter(f => isVideoFile(f.filename));
        currentPlaylist = videoFiles;
        isDrivePlaylist = false;

        files.forEach((file) => {
            const isVideo = isVideoFile(file.filename);
            
            const card = document.createElement("div");
            card.className = `file-card ${isVideo ? "has-video" : ""}`;

            // Image Header / Thumbnail representation
            const mediaDiv = document.createElement("div");
            mediaDiv.className = "file-media shimmer";

            if (file.thumbnail) {
                const img = document.createElement("img");
                img.src = `/api/thumbnail?path=${encodeURIComponent(file.path)}&cookie=${encodeURIComponent(inputCookie.value.trim() || savedCookie)}`;
                img.alt = file.filename;
                img.className = "file-thumbnail";
                img.onload = () => mediaDiv.classList.remove("shimmer");
                mediaDiv.appendChild(img);
            } else {
                mediaDiv.classList.remove("shimmer");
                const placeholder = document.createElement("div");
                placeholder.innerHTML = isVideo 
                    ? '<i data-lucide="video" class="file-icon-placeholder"></i>'
                    : '<i data-lucide="file-text" class="file-icon-placeholder"></i>';
                mediaDiv.appendChild(placeholder);
            }

            // File size badge
            const sizeBadge = document.createElement("span");
            sizeBadge.className = "file-badge";
            sizeBadge.textContent = file.size_readable;
            mediaDiv.appendChild(sizeBadge);
            card.appendChild(mediaDiv);

            // Card Body
            const bodyDiv = document.createElement("div");
            bodyDiv.className = "file-body";

            const title = document.createElement("h3");
            title.className = "file-title";
            title.textContent = file.filename;
            title.title = file.filename;
            bodyDiv.appendChild(title);

            // Meta indicators
            const metaDiv = document.createElement("div");
            metaDiv.className = "file-meta";
            
            const typeItem = document.createElement("div");
            typeItem.className = "meta-item";
            typeItem.innerHTML = isVideo 
                ? '<i data-lucide="clapperboard" class="meta-icon"></i> Video'
                : '<i data-lucide="file" class="meta-icon"></i> Document';
            metaDiv.appendChild(typeItem);
            bodyDiv.appendChild(metaDiv);

            // Card Action Buttons
            const actionsDiv = document.createElement("div");
            actionsDiv.className = "file-actions";

            const hasDlink = !!file.dlink;

            if (!hasDlink) {
                const cookieBadge = document.createElement("span");
                cookieBadge.className = "badge-cookie-required";
                cookieBadge.innerHTML = '<i data-lucide="lock" class="btn-icon-sm"></i> Cookie Required';
                metaDiv.appendChild(cookieBadge);
            }

            if (isVideo) {
                const videoIndex = videoFiles.findIndex(v => v.filename === file.filename);
                const btnStream = document.createElement("button");
                btnStream.className = `btn-card-primary ${!hasDlink ? "btn-disabled" : ""}`;
                btnStream.innerHTML = '<i data-lucide="play" class="btn-icon-sm"></i> Stream';
                if (hasDlink) {
                    btnStream.addEventListener("click", () => playVideoFromPlaylist(videoIndex, false));
                } else {
                    btnStream.addEventListener("click", () => {
                        showToast("⚠️ Valid ndus cookie required. Redirecting to settings...");
                        setTimeout(() => btnSettings.click(), 1200);
                    });
                }
                actionsDiv.appendChild(btnStream);
            }

            const btnDownload = document.createElement("button");
            btnDownload.className = `btn-card-outline ${!hasDlink ? "btn-disabled" : ""}`;
            btnDownload.innerHTML = '<i data-lucide="download" class="btn-icon-sm"></i> Download';
            if (hasDlink) {
                btnDownload.addEventListener("click", () => triggerDownload(file));
            } else {
                btnDownload.addEventListener("click", () => {
                    showToast("⚠️ Valid ndus cookie required. Redirecting to settings...");
                    setTimeout(() => btnSettings.click(), 1200);
                });
            }
            actionsDiv.appendChild(btnDownload);

            const isSaved = cachedServerDownloads.some(dl => dl.filename === file.filename) || cachedMegaFiles.includes(file.filename);
            const btnServerDl = document.createElement("button");
            btnServerDl.className = isSaved ? "btn-primary" : `btn-card-outline ${!hasDlink ? "btn-disabled" : ""}`;
            btnServerDl.innerHTML = isSaved ? '<i data-lucide="check" class="btn-icon-sm"></i> Saved' : '<i data-lucide="hard-drive" class="btn-icon-sm"></i> Save to Server';
            if (hasDlink && !isSaved) {
                btnServerDl.addEventListener("click", () => triggerServerDownload(file, btnServerDl));
            }
            actionsDiv.appendChild(btnServerDl);

            bodyDiv.appendChild(actionsDiv);
            card.appendChild(bodyDiv);

            filesGrid.appendChild(card);
        });

        // Re-create icons for new elements
        lucide.createIcons();
        resultsSection.classList.remove("hidden");
    }

    // ================= PLAY ACTION =================
    function updatePlayerNavButtons() {
        if (currentPlaylist.length <= 1) {
            playerNav.classList.add("hidden");
            return;
        }
        
        playerNav.classList.remove("hidden");
        playerNavCounter.textContent = `${currentVideoIndex + 1} / ${currentPlaylist.length}`;
        
        btnPrevVideo.disabled = currentVideoIndex <= 0;
        btnNextVideo.disabled = currentVideoIndex >= currentPlaylist.length - 1;
        
        if (btnPrevVideo.disabled) btnPrevVideo.classList.add("btn-disabled");
        else btnPrevVideo.classList.remove("btn-disabled");
        
        if (btnNextVideo.disabled) btnNextVideo.classList.add("btn-disabled");
        else btnNextVideo.classList.remove("btn-disabled");
    }

    async function playVideoFromPlaylist(index, isDrive) {
        if (index < 0 || index >= currentPlaylist.length) return;
        
        const file = currentPlaylist[index];
        currentVideoIndex = index;
        updatePlayerNavButtons();
        
        let dlink = file.dlink;
        if (isDrive && !dlink) {
            showToast("Resolving secure direct link... 🔐");
            dlink = await fetchPersonalDlink(file.path);
            if (!dlink) return;
            file.dlink = dlink; // Cache it
        } else if (!isDrive && !dlink) {
            showToast("⚠️ Valid ndus cookie required. Redirecting to settings...");
            setTimeout(() => btnSettings.click(), 1200);
            return;
        }

        triggerVideoPlay({ filename: file.filename, dlink: dlink });
    }

    btnPrevVideo.addEventListener("click", () => {
        if (currentVideoIndex > 0) {
            playVideoFromPlaylist(currentVideoIndex - 1, isDrivePlaylist);
        }
    });

    btnNextVideo.addEventListener("click", () => {
        if (currentVideoIndex < currentPlaylist.length - 1) {
            playVideoFromPlaylist(currentVideoIndex + 1, isDrivePlaylist);
        }
    });

    function triggerVideoPlay(file) {
        modalVideoTitle.textContent = file.filename;
        
        // Construct the streaming proxy endpoint path
        const customCookie = inputCookie.value.trim();
        const base = backendBaseUrl.replace(/\/$/, '');
        const streamUrl = `${base}/api/stream?url=${encodeURIComponent(file.dlink)}&cookie=${encodeURIComponent(customCookie)}`;
        
        // Set native video source
        videoPlayer.src = streamUrl;
        
        // Open modal
        playerModal.classList.remove("hidden");
        document.body.style.overflow = "hidden"; // disable scroll
        
        // Auto play
        videoPlayer.play().catch(e => console.log("Auto-play blocked by browser policy"));
    }

    function playLocalVideo(file) {
        modalVideoTitle.textContent = file.filename;
        
        // Set native video source
        videoPlayer.src = file.urlPath;
        
        // Hide playlist navigation since this is a single local file
        playerNav.classList.add("hidden");

        // Open modal
        playerModal.classList.remove("hidden");
        document.body.style.overflow = "hidden";
        
        // Auto play
        videoPlayer.play().catch(e => console.log("Auto-play blocked by browser policy"));
    }

    function closeModal() {
        videoPlayer.pause();
        videoPlayer.src = "";
        playerModal.classList.add("hidden");
        document.body.style.overflow = ""; // restore scroll
    }

    btnCloseModal.addEventListener("click", closeModal);
    modalBackdrop.addEventListener("click", closeModal);

    // Escape closes player modal
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !playerModal.classList.contains("hidden")) {
            closeModal();
        }
    });

    // ================= DOWNLOAD ACTION =================
    // Download overlay UI (created once)
    const dlOverlay = document.createElement('div');
    dlOverlay.id = 'dl-overlay';
    dlOverlay.style.cssText = `
        display:none; position:fixed; inset:0; z-index:9999;
        background:rgba(0,0,0,0.85); backdrop-filter:blur(8px);
        flex-direction:column; align-items:center; justify-content:center; gap:1.5rem;
    `;
    dlOverlay.innerHTML = `
        <div style="text-align:center;">
            <div style="font-size:2.5rem;">⬇️</div>
            <div id="dl-filename" style="color:#fff;font-weight:700;font-size:1rem;margin-top:0.5rem;max-width:280px;word-break:break-word;"></div>
        </div>
        <div style="width:280px;">
            <div style="background:rgba(255,255,255,0.15);border-radius:999px;height:8px;overflow:hidden;">
                <div id="dl-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#4facfe,#00f2fe);border-radius:999px;transition:width 0.2s;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:0.5rem;">
                <span id="dl-pct" style="color:#00f2fe;font-size:0.9rem;font-weight:700;">0%</span>
                <span id="dl-size" style="color:rgba(255,255,255,0.6);font-size:0.85rem;"></span>
            </div>
        </div>
        <button id="dl-cancel" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;border-radius:999px;padding:0.6rem 1.5rem;font-size:0.9rem;cursor:pointer;">Cancel</button>
    `;
    document.body.appendChild(dlOverlay);

    let dlAbortController = null;
    document.getElementById('dl-cancel').addEventListener('click', () => {
        if (dlAbortController) dlAbortController.abort();
        dlOverlay.style.display = 'none';
        showToast('Download cancelled.');
    });

    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    async function triggerDownload(file) {
        const customCookie = inputCookie.value.trim() || savedCookie;
        const base = backendBaseUrl.replace(/\/$/, '');
        const downloadUrl = `${base}/api/stream?url=${encodeURIComponent(file.dlink)}&cookie=${encodeURIComponent(customCookie)}`;

        // Show overlay
        dlOverlay.style.display = 'flex';
        document.getElementById('dl-filename').textContent = file.filename;
        document.getElementById('dl-bar').style.width = '0%';
        document.getElementById('dl-pct').textContent = '0%';
        document.getElementById('dl-size').textContent = '';

        dlAbortController = new AbortController();

        try {
            const response = await fetch(downloadUrl, { signal: dlAbortController.signal });
            if (!response.ok) throw new Error(`Server error: ${response.status}`);

            const contentLength = response.headers.get('Content-Length');
            const total = contentLength ? parseInt(contentLength, 10) : 0;
            let loaded = 0;
            const chunks = [];

            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                loaded += value.length;

                if (total > 0) {
                    const pct = Math.round((loaded / total) * 100);
                    document.getElementById('dl-bar').style.width = pct + '%';
                    document.getElementById('dl-pct').textContent = pct + '%';
                } else {
                    document.getElementById('dl-pct').textContent = 'Downloading...';
                }
                document.getElementById('dl-size').textContent = formatBytes(loaded) + (total ? ' / ' + formatBytes(total) : '');
            }

            // Combine chunks into a blob and trigger save
            const blob = new Blob(chunks, { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            dlOverlay.style.display = 'none';
            showToast('✅ Download complete! Saved to device.');
        } catch (e) {
            dlOverlay.style.display = 'none';
            if (e.name !== 'AbortError') {
                showToast('❌ Download failed: ' + e.message);
            }
        }
    }

    async function triggerServerDownload(file, btnElement) {
        const customCookie = inputCookie.value.trim();
        showToast("Starting server download... 🚀");
        try {
            const res = await fetch("/api/server-download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: file.dlink,
                    cookie: customCookie,
                    filename: file.filename
                })
            });
            const data = await res.json();
            if (data.status === "success") {
                showToast("Server download queued successfully! Check the Server Downloads tab.");
                if (btnElement) {
                    btnElement.innerHTML = '<i data-lucide="check" class="btn-icon-sm"></i> Saved';
                    btnElement.className = "btn-primary";
                    lucide.createIcons();
                }
            } else {
                showToast(`❌ Error: ${data.message}`);
            }
        } catch (e) {
            showToast("❌ Connection error while queueing server download.");
        }
    }

    // ================= COPY SHORTCODE =================
    btnCopySurl.addEventListener("click", async () => {
        if (!activeShortcode) return;
        try {
            await navigator.clipboard.writeText(activeShortcode);
            showToast("Shortcode copied to clipboard! 📋");
        } catch (e) {
            showToast("Copy failed. Please manually select the code.");
        }
    });

    // ================= PERSONAL DRIVE NAVIGATION =================
    let currentDrivePath = "/";

    async function loadDriveFiles(path) {
        currentDrivePath = path;
        driveCurrentPath.textContent = path;
        
        // Update back button disabled state
        btnDriveBack.disabled = (path === "/");

        // Clear grid and show loader
        driveFilesGrid.innerHTML = "";
        hideAllSections();
        btnDrive.classList.add("active");
        driveSection.classList.remove("hidden");
        loadingSection.classList.remove("hidden");
        loadingStatus.textContent = `Loading folder: ${path}...`;

        const cookieToSend = inputCookie.value.trim();
        if (!cookieToSend) {
            loadingSection.classList.add("hidden");
            errorSection.classList.remove("hidden");
            errorMessage.textContent = "An 'ndus' cookie is required to access your personal drive. Please enter it in Cookie Settings.";
            return;
        }

        try {
            const response = await fetch(`/api/personal-list?cookie=${encodeURIComponent(cookieToSend)}&path=${encodeURIComponent(path)}`);
            if (!response.ok) {
                throw new Error(`Server returned code ${response.status}`);
            }

            const data = await response.json();
            if (data.status === "error") {
                throw new Error(data.message || "Failed to load drive files.");
            }

            await silentFetchDownloadsStatus();
            renderDriveFiles(data.files || []);
        } catch (err) {
            console.error("Drive load error:", err.message);
            loadingSection.classList.add("hidden");
            errorSection.classList.remove("hidden");
            errorMessage.textContent = err.message || "Could not retrieve files from your TeraBox account.";
        }
    }

    function renderDriveFiles(files) {
        driveFilesGrid.innerHTML = "";
        loadingSection.classList.add("hidden");
        
        driveCount.textContent = `Total ${files.length} item(s)`;

        if (!files.length) {
            const emptyState = document.createElement("p");
            emptyState.className = "loading-text";
            emptyState.style.gridColumn = "1 / -1";
            emptyState.style.textAlign = "center";
            emptyState.style.padding = "3rem 0";
            emptyState.textContent = "This folder is empty.";
            driveFilesGrid.appendChild(emptyState);
            return;
        }

        const videoFiles = files.filter(f => !f.is_directory && isVideoFile(f.filename));
        currentPlaylist = videoFiles;
        isDrivePlaylist = true;

        files.forEach((file) => {
            const card = document.createElement("div");
            
            if (file.is_directory) {
                card.className = "file-card is-directory-card";
                
                const mediaDiv = document.createElement("div");
                mediaDiv.className = "file-media";
                mediaDiv.innerHTML = '<div class="directory-icon-container"><i data-lucide="folder" class="directory-icon"></i></div>';
                addFavoriteButtonToMedia(mediaDiv, file);
                card.appendChild(mediaDiv);

                const bodyDiv = document.createElement("div");
                bodyDiv.className = "file-body";

                const title = document.createElement("h3");
                title.className = "file-title";
                title.textContent = file.filename;
                title.title = file.filename;
                bodyDiv.appendChild(title);

                const metaDiv = document.createElement("div");
                metaDiv.className = "file-meta";
                metaDiv.innerHTML = '<div class="meta-item"><i data-lucide="folder" class="meta-icon"></i> Folder</div>';
                bodyDiv.appendChild(metaDiv);
                card.appendChild(bodyDiv);

                card.addEventListener("click", () => {
                    loadDriveFiles(file.path);
                });
            } else {
                const isVideo = isVideoFile(file.filename);
                card.className = `file-card ${isVideo ? "has-video" : ""}`;

                const mediaDiv = document.createElement("div");
                mediaDiv.className = "file-media shimmer";

                if (file.thumbnail) {
                    const img = document.createElement("img");
                    const base = backendBaseUrl.replace(/\/$/, '');
                    img.src = `${base}/api/thumbnail?path=${encodeURIComponent(file.path)}&cookie=${encodeURIComponent(inputCookie.value.trim() || savedCookie)}`;
                    img.alt = file.filename;
                    img.className = "file-thumbnail";
                    img.onload = () => mediaDiv.classList.remove("shimmer");
                    img.onerror = () => {
                        img.remove();
                        const placeholder = document.createElement("div");
                        placeholder.innerHTML = isVideo 
                            ? '<i data-lucide="video" class="file-icon-placeholder"></i>'
                            : '<i data-lucide="file-text" class="file-icon-placeholder"></i>';
                        mediaDiv.appendChild(placeholder);
                        lucide.createIcons();
                    };
                    mediaDiv.appendChild(img);
                } else {
                    mediaDiv.classList.remove("shimmer");
                    const placeholder = document.createElement("div");
                    placeholder.innerHTML = isVideo 
                        ? '<i data-lucide="video" class="file-icon-placeholder"></i>'
                        : '<i data-lucide="file-text" class="file-icon-placeholder"></i>';
                    mediaDiv.appendChild(placeholder);
                }

                const sizeBadge = document.createElement("span");
                sizeBadge.className = "file-badge";
                sizeBadge.textContent = file.size_readable;
                mediaDiv.appendChild(sizeBadge);
                addFavoriteButtonToMedia(mediaDiv, file);
                card.appendChild(mediaDiv);

                const bodyDiv = document.createElement("div");
                bodyDiv.className = "file-body";

                const title = document.createElement("h3");
                title.className = "file-title";
                title.textContent = file.filename;
                title.title = file.filename;
                bodyDiv.appendChild(title);

                const metaDiv = document.createElement("div");
                metaDiv.className = "file-meta";
                metaDiv.innerHTML = isVideo 
                    ? '<div class="meta-item"><i data-lucide="clapperboard" class="meta-icon"></i> Video</div>'
                    : '<div class="meta-item"><i data-lucide="file" class="meta-icon"></i> Document</div>';
                bodyDiv.appendChild(metaDiv);

                const actionsDiv = document.createElement("div");
                actionsDiv.className = "file-actions";

                if (isVideo) {
                    const videoIndex = videoFiles.findIndex(v => v.filename === file.filename);
                    const btnStream = document.createElement("button");
                    btnStream.className = "btn-card-primary";
                    btnStream.innerHTML = '<i data-lucide="play" class="btn-icon-sm"></i> Stream';
                    btnStream.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        playVideoFromPlaylist(videoIndex, true);
                    });
                    actionsDiv.appendChild(btnStream);
                }

                const btnDownload = document.createElement("button");
                btnDownload.className = "btn-card-outline";
                btnDownload.innerHTML = '<i data-lucide="download" class="btn-icon-sm"></i> Download';
                btnDownload.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    showToast("Resolving secure direct link... 🔐");
                    const dlink = await fetchPersonalDlink(file.path);
                    if (dlink) {
                        triggerDownload({ filename: file.filename, dlink: dlink });
                    }
                });
                actionsDiv.appendChild(btnDownload);

                const isSaved = cachedServerDownloads.some(dl => dl.filename === file.filename) || cachedMegaFiles.includes(file.filename);
                const btnServerDl = document.createElement("button");
                btnServerDl.className = isSaved ? "btn-primary" : "btn-card-outline";
                btnServerDl.innerHTML = isSaved ? '<i data-lucide="check" class="btn-icon-sm"></i> Saved' : '<i data-lucide="hard-drive" class="btn-icon-sm"></i> Save to Server';
                if (!isSaved) {
                    btnServerDl.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        showToast("Resolving secure direct link... 🔐");
                        const dlink = await fetchPersonalDlink(file.path);
                        if (dlink) {
                            triggerServerDownload({ filename: file.filename, dlink: dlink }, btnServerDl);
                        }
                    });
                }
                actionsDiv.appendChild(btnServerDl);

                bodyDiv.appendChild(actionsDiv);
                card.appendChild(bodyDiv);
            }

            driveFilesGrid.appendChild(card);
        });

        lucide.createIcons();
    }

    async function fetchPersonalDlink(filePath) {
        const cookieToSend = inputCookie.value.trim();
        try {
            const res = await fetch(`/api/personal-dlink?cookie=${encodeURIComponent(cookieToSend)}&path=${encodeURIComponent(filePath)}`);
            const data = await res.json();
            if (data.status === "error") {
                showToast(`❌ Error: ${data.message}`);
                return null;
            }
            return data.dlink;
        } catch (e) {
            showToast("❌ Connection error. Failed to resolve direct link.");
            return null;
        }
    }

    // Drive back navigation
    btnDriveBack.addEventListener("click", () => {
        if (currentDrivePath === "/") return;
        const parts = currentDrivePath.split("/");
        parts.pop();
        const parentPath = parts.join("/") || "/";
        loadDriveFiles(parentPath);
    });

    // Drive refresh
    btnDriveRefresh.addEventListener("click", () => {
        loadDriveFiles(currentDrivePath);
    });

    // ================= MEGA FILES =================
    async function fetchMegaFiles() {
        megaGrid.innerHTML = "";
        megaCount.textContent = "Loading Mega files...";
        try {
            const res = await fetch("/api/mega-files");
            const data = await res.json();
            if (data.status === "success") {
                renderMegaFiles(data.files);
            } else {
                throw new Error(data.message || "Failed to load");
            }
        } catch (e) {
            megaGrid.innerHTML = `<p class="loading-text" style="grid-column: 1 / -1; text-align: center;">Error loading Mega files: ${e.message}</p>`;
            megaCount.textContent = "Error";
        }
    }

    async function fetchMegaDuplicates() {
        megaGrid.innerHTML = "";
        megaCount.textContent = "Scanning for duplicates... This might take a moment.";
        try {
            const res = await fetch("/api/mega-duplicates");
            const data = await res.json();
            
            if (data.status === "success") {
                renderMegaDuplicates(data.duplicates);
            } else {
                throw new Error(data.message || "Unknown error");
            }
        } catch (e) {
            console.error(e);
            megaCount.textContent = "Failed to scan duplicates.";
            showToast("Error scanning Mega storage.");
        }
    }

    function renderMegaDuplicates(duplicateGroups) {
        megaGrid.innerHTML = "";
        let totalDupes = 0;
        
        if (!duplicateGroups || duplicateGroups.length === 0) {
            megaCount.textContent = "No duplicates found! Your storage is optimized.";
            const emptyState = document.createElement("p");
            emptyState.className = "loading-text";
            emptyState.style.gridColumn = "1 / -1";
            emptyState.style.textAlign = "center";
            emptyState.textContent = "No duplicates found! Your storage is completely optimized.";
            megaGrid.appendChild(emptyState);
            return;
        }

        duplicateGroups.forEach((group, index) => {
            totalDupes += group.length;
            
            const groupHeader = document.createElement("div");
            groupHeader.style.gridColumn = "1 / -1";
            groupHeader.style.padding = "1rem";
            groupHeader.style.background = "var(--clr-bg-dark)";
            groupHeader.style.borderLeft = "4px solid var(--clr-warning)";
            groupHeader.style.marginTop = "1rem";
            groupHeader.style.borderRadius = "var(--radius-sm)";
            groupHeader.innerHTML = `
                <h3 style="color: var(--clr-warning); font-size: 1rem; margin-bottom: 0.25rem;">Duplicate Group ${index + 1} (${group.length} exact copies)</h3>
                <p style="color: var(--clr-text-muted); font-size: 0.85rem;">File: ${group[0].name} • Size: ${(group[0].size / (1024*1024)).toFixed(2)} MB</p>
                <p style="color: var(--clr-text-main); font-size: 0.85rem; margin-top: 0.5rem;">Select the ones you want to delete.</p>
            `;
            megaGrid.appendChild(groupHeader);

            group.forEach((file) => {
                const card = document.createElement("div");
                card.className = "file-card";
                card.style.border = "1px solid var(--clr-warning)";
                
                const bodyDiv = document.createElement("div");
                bodyDiv.className = "file-body";

                const title = document.createElement("h3");
                title.className = "file-title";
                title.textContent = file.name;
                bodyDiv.appendChild(title);

                const metaDiv = document.createElement("div");
                metaDiv.className = "file-meta";
                metaDiv.innerHTML = `<div class="meta-item"><i data-lucide="cloud" class="meta-icon"></i> Mega.nz</div>`;
                bodyDiv.appendChild(metaDiv);

                const actionsDiv = document.createElement("div");
                actionsDiv.className = "file-actions";
                
                const btnDelete = document.createElement("button");
                btnDelete.className = "btn-outline btn-sm";
                btnDelete.style.color = "var(--clr-error)";
                btnDelete.innerHTML = '<i data-lucide="trash-2" class="btn-icon-sm"></i> Delete This Copy';
                btnDelete.addEventListener("click", async () => {
                    if(confirm(`Are you sure you want to permanently delete this duplicate from Mega.nz?`)) {
                        try {
                            const res = await fetch(`/api/mega-files/${file.nodeId}`, { method: 'DELETE' });
                            const d = await res.json();
                            if(d.status === "success") {
                                showToast("Duplicate deleted successfully.");
                                card.remove();
                            } else {
                                showToast("Failed to delete duplicate: " + d.message);
                            }
                        } catch(e) {
                            showToast("Error deleting duplicate.");
                        }
                    }
                });
                
                actionsDiv.appendChild(btnDelete);
                card.appendChild(bodyDiv);
                card.appendChild(actionsDiv);
                megaGrid.appendChild(card);
            });
        });
        
        megaCount.textContent = `Found ${duplicateGroups.length} groups of duplicates (${totalDupes} files total).`;
        lucide.createIcons();
    }

    function renderMegaFiles(files) {

        megaGrid.innerHTML = "";
        megaCount.textContent = `Total ${files.length} item(s)`;
        
        if (files.length === 0) {
            megaGrid.innerHTML = '<p class="loading-text" style="grid-column: 1 / -1; text-align: center;">Your Mega account has no files.</p>';
            return;
        }
        
        files.forEach(file => {
            const card = document.createElement("div");
            card.className = "file-card has-video";

            const mediaDiv = document.createElement("div");
            mediaDiv.className = "file-media shimmer";
            
            const placeholder = document.createElement("div");
            placeholder.className = "mega-thumbnail-container";
            placeholder.dataset.nodeid = file.nodeId;
            placeholder.dataset.filename = file.name;
            placeholder.innerHTML = '<i data-lucide="video" class="file-icon-placeholder"></i>';
            mediaDiv.appendChild(placeholder);
            
            const sizeBadge = document.createElement("span");
            sizeBadge.className = "file-badge";
            sizeBadge.textContent = formatSize(file.size);
            mediaDiv.appendChild(sizeBadge);
            card.appendChild(mediaDiv);

            const bodyDiv = document.createElement("div");
            bodyDiv.className = "file-body";

            const title = document.createElement("h3");
            title.className = "file-title";
            title.textContent = file.name;
            title.title = file.name;
            bodyDiv.appendChild(title);
            
            const metaDiv = document.createElement("div");
            metaDiv.className = "file-meta";
            metaDiv.innerHTML = `<div class="meta-item"><i data-lucide="calendar" class="meta-icon"></i> ${new Date(file.timestamp * 1000).toLocaleDateString()}</div>`;
            bodyDiv.appendChild(metaDiv);

            const actionsDiv = document.createElement("div");
            actionsDiv.className = "file-actions";
            actionsDiv.style.marginTop = "0.75rem";
            actionsDiv.style.display = "flex";
            actionsDiv.style.gap = "0.5rem";
            
            actionsDiv.innerHTML = `
                <button class="btn-card-outline play-btn" style="flex: 1; justify-content: center;" title="Play">
                    <i data-lucide="play" class="btn-icon-sm"></i>
                </button>
                <button class="btn-card-outline download-btn" style="flex: 1; justify-content: center;" title="Download">
                    <i data-lucide="download" class="btn-icon-sm"></i>
                </button>
                <button class="btn-card-outline del-btn" style="flex: 1; justify-content: center; color: #f43f5e; border-color: rgba(244, 63, 94, 0.3);" title="Delete from Mega">
                    <i data-lucide="trash-2" class="btn-icon-sm"></i>
                </button>
            `;
            
            const playBtn = actionsDiv.querySelector(".play-btn");
            playBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                playLocalVideo({ filename: file.name, urlPath: `/api/mega-stream-node/${file.nodeId}` });
            });
            
            const dlBtn = actionsDiv.querySelector(".download-btn");
            dlBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const a = document.createElement("a");
                a.href = `/api/mega-stream-node/${file.nodeId}?download=true`;
                a.download = file.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });
            
            const delBtn = actionsDiv.querySelector(".del-btn");
            delBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to permanently delete "${file.name}" from Mega.nz?`)) {
                    const originalHtml = delBtn.innerHTML;
                    delBtn.innerHTML = '<i data-lucide="loader" class="btn-icon-sm spin"></i>';
                    try {
                        const response = await fetch(`/api/mega-files/${file.nodeId}`, { method: 'DELETE' });
                        const data = await response.json();
                        if (data.status === "success") {
                            card.remove();
                            showToast("Deleted from Mega! 🗑️");
                            
                            // Update count text
                            const currentCount = parseInt(megaCount.textContent.replace(/[^0-9]/g, '')) || 0;
                            megaCount.textContent = `Total ${Math.max(0, currentCount - 1)} item(s)`;
                        } else {
                            showToast("Failed to delete", "error");
                            delBtn.innerHTML = originalHtml;
                            lucide.createIcons({ root: delBtn });
                        }
                    } catch (err) {
                        showToast("Error deleting", "error");
                        delBtn.innerHTML = originalHtml;
                        lucide.createIcons({ root: delBtn });
                    }
                }
            });
            bodyDiv.appendChild(actionsDiv);
            card.appendChild(bodyDiv);
            
            megaGrid.appendChild(card);
        });
        
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const container = entry.target;
                    obs.unobserve(container);
                    
                    const nodeId = container.dataset.nodeid;
                    const filename = container.dataset.filename;
                    
                    if (!isVideoFile(filename)) {
                        container.parentElement.classList.remove("shimmer");
                        return;
                    }
                    
                    const video = document.createElement("video");
                    video.crossOrigin = "anonymous";
                    video.muted = true;
                    video.playsInline = true;
                    
                    let isLoaded = false;
                    
                    video.addEventListener("loadeddata", () => {
                        video.currentTime = 2; // Seek to 2 seconds for thumbnail
                    });
                    
                    video.addEventListener("seeked", () => {
                        if (isLoaded) return;
                        isLoaded = true;
                        try {
                            const canvas = document.createElement("canvas");
                            canvas.width = video.videoWidth / 2;
                            canvas.height = video.videoHeight / 2;
                            const ctx = canvas.getContext("2d");
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            
                            const img = document.createElement("img");
                            img.src = canvas.toDataURL("image/jpeg", 0.7);
                            img.className = "file-thumbnail";
                            img.alt = filename;
                            
                            container.innerHTML = "";
                            container.appendChild(img);
                        } catch (e) {
                            console.log("Canvas extraction failed", e);
                        }
                        container.parentElement.classList.remove("shimmer");
                        video.src = "";
                        video.remove();
                    });
                    
                    video.addEventListener("error", () => {
                        container.parentElement.classList.remove("shimmer");
                        video.remove();
                    });
                    
                    video.src = `/api/mega-stream-node/${nodeId}`;
                }
            });
        }, { rootMargin: "100px" });
        
        document.querySelectorAll(".mega-thumbnail-container").forEach(el => observer.observe(el));
        
        lucide.createIcons();
    }

    // ================= FAVORITES =================
    function addFavoriteButtonToMedia(mediaDiv, file) {
        const isFav = savedFavorites.some(f => f.path === file.path);
        const favBtn = document.createElement("button");
        favBtn.className = "btn-fav " + (isFav ? "active" : "");
        favBtn.innerHTML = `<i data-lucide="heart" class="btn-icon-sm"></i>`;
        favBtn.title = isFav ? "Remove from Favorites" : "Add to Favorites";
        
        favBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleFavorite(file, favBtn);
        });
        
        mediaDiv.appendChild(favBtn);
    }

    async function toggleFavorite(file, btnElement) {
        const index = savedFavorites.findIndex(f => f.path === file.path);
        if (index > -1) {
            savedFavorites.splice(index, 1);
            btnElement.classList.remove("active");
            btnElement.title = "Add to Favorites";
            showToast("Removed from Favorites 💔");
            // If we are currently viewing the favorites section, re-render
            if (!favoritesSection.classList.contains("hidden")) {
                renderFavorites();
            }
        } else {
            savedFavorites.push(file);
            btnElement.classList.add("active");
            btnElement.title = "Remove from Favorites";
            showToast("Added to Favorites ❤️");
        }
        
        lucide.createIcons();
        
        // Save to Mega Database
        const cookieToSend = inputCookie.value.trim() || savedCookie;
        try {
            fetch("/api/favorites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cookie: cookieToSend, favorites: savedFavorites })
            });
        } catch(e) {}
    }

    function renderFavorites() {
        // Reuse the logic of rendering drive files, but for the favorites grid
        favoritesFilesGrid.innerHTML = "";
        favoritesCount.textContent = `Total ${savedFavorites.length} item(s)`;

        if (!savedFavorites.length) {
            const emptyState = document.createElement("p");
            emptyState.className = "loading-text";
            emptyState.style.gridColumn = "1 / -1";
            emptyState.style.textAlign = "center";
            emptyState.style.padding = "3rem 0";
            emptyState.textContent = "You haven't saved any favorites yet.";
            favoritesFilesGrid.appendChild(emptyState);
            return;
        }

        const videoFiles = savedFavorites.filter(f => !f.is_directory && isVideoFile(f.filename));
        currentPlaylist = videoFiles;
        isDrivePlaylist = true;

        savedFavorites.forEach((file) => {
            const card = document.createElement("div");
            
            if (file.is_directory) {
                card.className = "file-card is-directory-card";
                
                const mediaDiv = document.createElement("div");
                mediaDiv.className = "file-media";
                mediaDiv.innerHTML = '<div class="directory-icon-container"><i data-lucide="folder" class="directory-icon"></i></div>';
                addFavoriteButtonToMedia(mediaDiv, file);
                card.appendChild(mediaDiv);

                const bodyDiv = document.createElement("div");
                bodyDiv.className = "file-body";

                const title = document.createElement("h3");
                title.className = "file-title";
                title.textContent = file.filename;
                title.title = file.filename;
                bodyDiv.appendChild(title);

                const metaDiv = document.createElement("div");
                metaDiv.className = "file-meta";
                metaDiv.innerHTML = '<div class="meta-item"><i data-lucide="folder" class="meta-icon"></i> Folder</div>';
                bodyDiv.appendChild(metaDiv);
                card.appendChild(bodyDiv);

                card.addEventListener("click", () => {
                    // Navigate to this folder in drive view
                    btnDrive.click();
                    loadDriveFiles(file.path);
                });
            } else {
                const isVideo = isVideoFile(file.filename);
                card.className = `file-card ${isVideo ? "has-video" : ""}`;

                const mediaDiv = document.createElement("div");
                mediaDiv.className = "file-media shimmer";

                if (file.thumbnail) {
                    const img = document.createElement("img");
                    img.src = `/api/thumbnail?path=${encodeURIComponent(file.path)}&cookie=${encodeURIComponent(savedCookie)}`;
                    img.alt = file.filename;
                    img.className = "file-thumbnail";
                    img.onload = () => mediaDiv.classList.remove("shimmer");
                    img.onerror = () => {
                        img.remove();
                        const placeholder = document.createElement("div");
                        placeholder.innerHTML = isVideo 
                            ? '<i data-lucide="video" class="file-icon-placeholder"></i>'
                            : '<i data-lucide="file-text" class="file-icon-placeholder"></i>';
                        mediaDiv.appendChild(placeholder);
                        lucide.createIcons();
                    };
                    mediaDiv.appendChild(img);
                } else {
                    mediaDiv.classList.remove("shimmer");
                    const placeholder = document.createElement("div");
                    placeholder.innerHTML = isVideo 
                        ? '<i data-lucide="video" class="file-icon-placeholder"></i>'
                        : '<i data-lucide="file-text" class="file-icon-placeholder"></i>';
                    mediaDiv.appendChild(placeholder);
                }

                const sizeBadge = document.createElement("span");
                sizeBadge.className = "file-badge";
                sizeBadge.textContent = file.size_readable;
                mediaDiv.appendChild(sizeBadge);
                addFavoriteButtonToMedia(mediaDiv, file);
                card.appendChild(mediaDiv);

                const bodyDiv = document.createElement("div");
                bodyDiv.className = "file-body";

                const title = document.createElement("h3");
                title.className = "file-title";
                title.textContent = file.filename;
                title.title = file.filename;
                bodyDiv.appendChild(title);

                const metaDiv = document.createElement("div");
                metaDiv.className = "file-meta";
                metaDiv.innerHTML = isVideo 
                    ? '<div class="meta-item"><i data-lucide="clapperboard" class="meta-icon"></i> Video</div>'
                    : '<div class="meta-item"><i data-lucide="file" class="meta-icon"></i> Document</div>';
                bodyDiv.appendChild(metaDiv);

                const actionsDiv = document.createElement("div");
                actionsDiv.className = "file-actions";

                if (isVideo) {
                    const videoIndex = videoFiles.findIndex(v => v.filename === file.filename);
                    const btnStream = document.createElement("button");
                    btnStream.className = "btn-card-primary";
                    btnStream.innerHTML = '<i data-lucide="play" class="btn-icon-sm"></i> Stream';
                    btnStream.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        playVideoFromPlaylist(videoIndex, true);
                    });
                    actionsDiv.appendChild(btnStream);
                }

                const btnDownload = document.createElement("button");
                btnDownload.className = "btn-card-outline";
                btnDownload.innerHTML = '<i data-lucide="download" class="btn-icon-sm"></i> Download';
                btnDownload.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    showToast("Resolving secure direct link... 🔐");
                    const dlink = await fetchPersonalDlink(file.path);
                    if (dlink) {
                        triggerDownload({ filename: file.filename, dlink: dlink });
                    }
                });
                actionsDiv.appendChild(btnDownload);

                const isSaved = cachedServerDownloads.some(dl => dl.filename === file.filename) || cachedMegaFiles.includes(file.filename);
                const btnServerDl = document.createElement("button");
                btnServerDl.className = isSaved ? "btn-primary" : "btn-card-outline";
                btnServerDl.innerHTML = isSaved ? '<i data-lucide="check" class="btn-icon-sm"></i> Saved' : '<i data-lucide="hard-drive" class="btn-icon-sm"></i> Save to Server';
                if (!isSaved) {
                    btnServerDl.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        showToast("Resolving secure direct link... 🔐");
                        const dlink = await fetchPersonalDlink(file.path);
                        if (dlink) {
                            triggerServerDownload({ filename: file.filename, dlink: dlink }, btnServerDl);
                        }
                    });
                }
                actionsDiv.appendChild(btnServerDl);

                bodyDiv.appendChild(actionsDiv);
                card.appendChild(bodyDiv);
            }

            favoritesFilesGrid.appendChild(card);
        });

        lucide.createIcons();
    }

    function formatTime(seconds) {
        if (!seconds) return "00:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function renderHistory() {
        historyFilesGrid.innerHTML = "";
        
        // Convert history object to array and sort by lastWatched desc
        const historyArray = Object.values(watchHistory).filter(h => h && h.file).sort((a, b) => (b.lastWatched || 0) - (a.lastWatched || 0));
        
        historyCount.textContent = `Total ${historyArray.length} item(s)`;

        if (!historyArray.length) {
            const emptyState = document.createElement("p");
            emptyState.className = "loading-text";
            emptyState.style.gridColumn = "1 / -1";
            emptyState.style.textAlign = "center";
            emptyState.style.padding = "3rem 0";
            emptyState.textContent = "You haven't watched any videos yet.";
            historyFilesGrid.appendChild(emptyState);
            return;
        }

        const videoFiles = historyArray.map(h => h.file);
        currentPlaylist = videoFiles;
        isDrivePlaylist = true;

        historyArray.forEach((histItem) => {
            const file = histItem.file;
            const card = document.createElement("div");
            card.className = "file-card has-video";

            const mediaDiv = document.createElement("div");
            mediaDiv.className = "file-media shimmer";

            if (file.thumbnail) {
                const img = document.createElement("img");
                img.src = `/api/thumbnail?path=${encodeURIComponent(file.path)}&cookie=${encodeURIComponent(savedCookie)}`;
                img.alt = file.filename;
                img.className = "file-thumbnail";
                img.onload = () => mediaDiv.classList.remove("shimmer");
                img.onerror = () => {
                    img.remove();
                    const placeholder = document.createElement("div");
                    placeholder.innerHTML = '<i data-lucide="video" class="file-icon-placeholder"></i>';
                    mediaDiv.appendChild(placeholder);
                    lucide.createIcons();
                };
                mediaDiv.appendChild(img);
            } else {
                mediaDiv.classList.remove("shimmer");
                const placeholder = document.createElement("div");
                placeholder.innerHTML = '<i data-lucide="video" class="file-icon-placeholder"></i>';
                mediaDiv.appendChild(placeholder);
            }

            // Progress bar
            const progressContainer = document.createElement("div");
            progressContainer.style.position = "absolute";
            progressContainer.style.bottom = "0";
            progressContainer.style.left = "0";
            progressContainer.style.width = "100%";
            progressContainer.style.height = "4px";
            progressContainer.style.background = "rgba(255,255,255,0.2)";
            
            const progressBar = document.createElement("div");
            progressBar.style.height = "100%";
            progressBar.style.background = "var(--clr-accent)";
            progressBar.style.width = "100%"; 
            progressContainer.appendChild(progressBar);
            mediaDiv.appendChild(progressContainer);

            const sizeBadge = document.createElement("span");
            sizeBadge.className = "file-badge";
            sizeBadge.style.bottom = "10px";
            sizeBadge.innerHTML = `<i data-lucide="clock" style="width:12px; height:12px; margin-right:4px;"></i>${formatTime(histItem.time)}`;
            mediaDiv.appendChild(sizeBadge);
            
            addFavoriteButtonToMedia(mediaDiv, file);
            card.appendChild(mediaDiv);

            const bodyDiv = document.createElement("div");
            bodyDiv.className = "file-body";

            const title = document.createElement("h3");
            title.className = "file-title";
            title.textContent = file.filename;
            title.title = file.filename;
            bodyDiv.appendChild(title);

            const metaDiv = document.createElement("div");
            metaDiv.className = "file-meta";
            const lastWatchedDate = new Date(histItem.lastWatched || Date.now()).toLocaleDateString();
            metaDiv.innerHTML = `<div class="meta-item"><i data-lucide="calendar" class="meta-icon"></i> Watched ${lastWatchedDate}</div>`;
            bodyDiv.appendChild(metaDiv);

            const actionsDiv = document.createElement("div");
            actionsDiv.className = "file-actions";

            const videoIndex = videoFiles.findIndex(v => v.filename === file.filename);
            const btnStream = document.createElement("button");
            btnStream.className = "btn-card-primary";
            btnStream.innerHTML = '<i data-lucide="play" class="btn-icon-sm"></i> Resume';
            btnStream.addEventListener("click", async (e) => {
                e.stopPropagation();
                playVideoFromPlaylist(videoIndex, true);
            });
            actionsDiv.appendChild(btnStream);

            const btnDownload = document.createElement("button");
            btnDownload.className = "btn-card-outline";
            btnDownload.innerHTML = '<i data-lucide="download" class="btn-icon-sm"></i> Download';
            btnDownload.addEventListener("click", async (e) => {
                e.stopPropagation();
                showToast("Resolving secure direct link... 🔐");
                const dlink = await fetchPersonalDlink(file.path);
                if (dlink) {
                    triggerDownload({ filename: file.filename, dlink: dlink });
                }
            });
            actionsDiv.appendChild(btnDownload);

            bodyDiv.appendChild(actionsDiv);
            card.appendChild(bodyDiv);
            historyFilesGrid.appendChild(card);
        });

        lucide.createIcons();
    }

    // ================= SERVER DOWNLOADS =================
    async function fetchDownloadsStatus() {
        const customCookie = inputCookie.value.trim() || savedCookie;
        try {
            const res = await fetch(`/api/downloads-status?cookie=${encodeURIComponent(customCookie)}`);
            const data = await res.json();
            if (data.status === "success") {
                const activeIds = data.downloads.map(d => d.id);
                // Merge active downloads with historical downloads
                const filteredHistory = cachedServerDownloads.filter(h => !activeIds.includes(h.id));
                cachedServerDownloads = [...filteredHistory, ...(data.downloads || [])];
                if (data.megaFiles) cachedMegaFiles = data.megaFiles;
                
                renderServerDownloads(cachedServerDownloads);
                
                // If any completed, sync to background silently only if changed
                const completed = cachedServerDownloads.filter(d => d.status === "completed" || d.status === "error");
                const completedJson = JSON.stringify(completed);
                if (completed.length > 0 && completedJson !== lastSyncedCompleted) {
                     lastSyncedCompleted = completedJson;
                     fetch("/api/downloads-history", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ cookie: customCookie, downloads: completed })
                    }).catch(e=>console.error(e));
                }
            }
        } catch (e) {
            console.error("Failed to fetch downloads status", e);
        }
    }

    function renderServerDownloads(downloads) {
        downloadsGrid.innerHTML = "";
        serverDownloadsCount.textContent = `Tracking ${downloads.length} download(s)`;

        if (!downloads.length) {
            const emptyState = document.createElement("p");
            emptyState.className = "loading-text";
            emptyState.style.gridColumn = "1 / -1";
            emptyState.style.textAlign = "center";
            emptyState.style.padding = "3rem 0";
            emptyState.textContent = "No server downloads active.";
            downloadsGrid.appendChild(emptyState);
            return;
        }

        downloads.forEach(dl => {
            try {
                if (!dl) return;
                
                const card = document.createElement("div");
                card.className = "download-card";
    
                const header = document.createElement("div");
                header.className = "dl-header";
                header.style.display = "flex";
                header.style.alignItems = "center";
                header.style.gap = "0.75rem";
                
                const icon = document.createElement("i");
                icon.dataset.lucide = isVideoFile(dl.filename) ? "video" : "file-text";
                icon.style.color = "var(--md-sys-color-primary)";
                icon.style.width = "2rem";
                icon.style.height = "2rem";
                icon.style.flexShrink = "0";
                
                const title = document.createElement("span");
                title.className = "dl-title";
                title.textContent = dl.filename || "Unknown File";
                title.style.flex = "1";
                title.style.wordBreak = "break-all";
                title.style.display = "-webkit-box";
                title.style.WebkitLineClamp = "2";
                title.style.WebkitBoxOrient = "vertical";
                title.style.overflow = "hidden";
                
                header.appendChild(icon);
                
                const statusStr = dl.status || "unknown";
                const statusBadge = document.createElement("span");
                statusBadge.className = `dl-status-badge dl-status-${statusStr}`;
                statusBadge.textContent = statusStr.charAt(0).toUpperCase() + statusStr.slice(1);
                
                if (statusStr === "error") {
                statusBadge.title = dl.error || "Unknown Error";
            }

            header.appendChild(title);
            header.appendChild(statusBadge);

            const progressContainer = document.createElement("div");
            progressContainer.className = "progress-container";
            const progressBar = document.createElement("div");
            progressBar.className = "progress-bar";
            if (dl.status === "paused") progressBar.classList.add("paused");
            progressBar.style.width = `${dl.progress}%`;
            if (dl.status === "error") progressBar.style.background = "var(--clr-error)";
            if (dl.status === "completed") progressBar.style.background = "var(--clr-success)";
            progressContainer.appendChild(progressBar);

            const meta = document.createElement("div");
            meta.className = "dl-meta";
            
            const sizeText = document.createElement("span");
            if (dl.status === "downloading") {
                const speedText = dl.speed ? ` (${formatSize(dl.speed)}/s)` : "";
                sizeText.textContent = `${formatSize(dl.downloadedBytes)} / ${formatSize(dl.totalBytes)}${speedText}`;
            } else if (dl.status === "uploading") {
                const speedText = dl.speed ? ` (${formatSize(dl.speed)}/s)` : "";
                sizeText.textContent = `Uploading to Server...${speedText}`;
            } else {
                sizeText.textContent = `${formatSize(dl.downloadedBytes)}`;
            }

            const pctText = document.createElement("span");
            pctText.textContent = `${dl.progress}%`;

            meta.appendChild(sizeText);
            meta.appendChild(pctText);

            const actions = document.createElement("div");
            actions.className = "dl-actions";

            const createActionBtn = (icon, text, actionType, btnClass) => {
                const btn = document.createElement("button");
                btn.className = `btn-sm ${btnClass}`;
                btn.innerHTML = `<i data-lucide="${icon}" class="btn-icon-sm"></i> ${text}`;
                btn.addEventListener("click", async () => {
                    try {
                        await fetch(`/api/server-download/${dl.id}/action`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: actionType })
                        });
                        fetchDownloadsStatus();
                    } catch (e) {
                        showToast(`Failed to ${actionType} download.`);
                    }
                });
                return btn;
            };

            if (dl.status === "error") {
                actions.appendChild(createActionBtn("refresh-cw", "Retry", "retry", "btn-card-primary"));
            }

            if (dl.status === "completed") {
                if (isVideoFile(dl.filename)) {
                    const playBtn = document.createElement("button");
                    playBtn.className = "btn-card-primary btn-sm";
                    playBtn.innerHTML = '<i data-lucide="play" class="btn-icon-sm"></i> Play';
                    playBtn.addEventListener("click", () => {
                        const streamUrl = dl.megaLink ? `/api/mega-stream?link=${encodeURIComponent(dl.megaLink)}` : dl.urlPath;
                        playLocalVideo({ filename: dl.filename, urlPath: streamUrl });
                    });
                    actions.appendChild(playBtn);
                }

                const getBtn = document.createElement("button");
                getBtn.className = "btn-primary btn-sm";
                getBtn.innerHTML = '<i data-lucide="download" class="btn-icon-sm"></i> Get File';
                getBtn.addEventListener("click", () => {
                    if (dl.megaLink) {
                        window.open(dl.megaLink, "_blank");
                    } else {
                        const a = document.createElement('a');
                        a.href = dl.urlPath;
                        a.download = dl.filename;
                        a.click();
                    }
                });
                actions.appendChild(getBtn);
            }

            const delBtn = document.createElement("button");
            delBtn.className = "btn-outline btn-sm";
            delBtn.innerHTML = '<i data-lucide="trash-2" class="btn-icon-sm"></i> Delete';
            delBtn.addEventListener("click", async () => {
                try {
                    await fetch(`/api/server-download/${dl.id}`, { method: "DELETE" });
                    
                    // Remove from permanent history cache and sync
                    cachedServerDownloads = cachedServerDownloads.filter(d => d.id !== dl.id);
                    const completed = cachedServerDownloads.filter(d => d.status === "completed" || d.status === "error");
                    const customCookie = inputCookie.value.trim() || savedCookie;
                    await fetch("/api/downloads-history", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ cookie: customCookie, downloads: completed })
                    });
                    
                    fetchDownloadsStatus();
                } catch (e) {
                    showToast("Failed to delete download.");
                }
            });
            actions.appendChild(delBtn);

            card.appendChild(header);
            card.appendChild(progressContainer);
            card.appendChild(meta);
            card.appendChild(actions);

            downloadsGrid.appendChild(card);
            } catch (err) {
                console.error("Failed to render download card:", err, dl);
            }
        });

        lucide.createIcons();
    }    // ================= PWA SERVICE WORKER =================
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => console.log('ServiceWorker registered with scope:', registration.scope))
                .catch(err => console.log('ServiceWorker registration failed:', err));
        });
    }

});
