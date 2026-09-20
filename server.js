import express from "express";
import axios from "axios";
import got from "got";
import https from "https";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { Storage } from "megajs";
import stream from "stream";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static frontend files from 'www' directory
app.use(express.static(path.join(__dirname, "www")));

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, "downloads");
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}
// Serve downloaded files statically
app.use("/downloads", express.static(downloadsDir));

// In-memory tracker for server downloads
let activeDownloads = {};
const downloadQueue = [];
let isDownloading = false;
const stateFilePath = path.join(downloadsDir, "state.json");

let megaStorage = null;
if (process.env.MEGA_EMAIL && process.env.MEGA_PASSWORD) {
  megaStorage = new Storage({
    email: process.env.MEGA_EMAIL,
    password: process.env.MEGA_PASSWORD
  });
  megaStorage.ready.then(() => {
    console.log("Connected to Mega.nz storage.");
    loadAppDataFromMega();
  }).catch(e => console.error("Mega.nz error:", e.message));
} else {
  console.warn("MEGA_EMAIL or MEGA_PASSWORD not set. Server downloads will fall back to local disk.");
}

function saveDownloadsState() {
  try {
    const stateToSave = {};
    for (const [id, dl] of Object.entries(activeDownloads)) {
      const safeDl = { ...dl };
      delete safeDl.abortController;
      stateToSave[id] = safeDl;
    }
    fs.writeFileSync(stateFilePath, JSON.stringify(stateToSave, null, 2));
  } catch (err) {
    console.error("Failed to save downloads state:", err.message);
  }
}

function loadDownloadsState() {
  try {
    if (fs.existsSync(stateFilePath)) {
      const data = fs.readFileSync(stateFilePath, "utf8");
      activeDownloads = JSON.parse(data);
      for (const id in activeDownloads) {
        const dl = activeDownloads[id];
        if (dl.status === "downloading") {
          dl.status = "error";
          dl.error = "Server restarted during download.";
        }
        if (fs.existsSync(dl.filePath)) {
          const stats = fs.statSync(dl.filePath);
          dl.downloadedBytes = stats.size;
          if (dl.totalBytes > 0) {
            dl.progress = Math.round((dl.downloadedBytes / dl.totalBytes) * 100);
            if (dl.downloadedBytes >= dl.totalBytes) {
               dl.status = "completed";
               dl.progress = 100;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to load downloads state:", err.message);
  }
}

loadDownloadsState();

// Database for sync across devices via Mega
let appData = {
  favorites: {},
  history: {},
  downloads: {},
  settings: {}
};

// Use a constant user ID so data isn't lost when the Terabox cookie changes
const getUserId = (cookie) => "admin_user";

async function loadAppDataFromMega() {
  if (!megaStorage) return;
  try {
    const file = megaStorage.root.children.find(f => f.name === 'terabox_app_data.json');
    if (file) {
      const data = await file.downloadBuffer();
      appData = JSON.parse(data.toString());
      
      // Migrate all old hashed cookie IDs into the single permanent "admin_user" profile
      let migrated = false;
      const adminId = "admin_user";
      
      for (const section of ['favorites', 'history', 'downloads']) {
        if (!appData[section]) appData[section] = {};
        if (!appData[section][adminId]) appData[section][adminId] = (section === 'favorites' || section === 'downloads') ? [] : {};
        
        for (const [userId, userData] of Object.entries(appData[section])) {
          if (userId !== adminId) {
            migrated = true;
            if (Array.isArray(userData)) {
              // Merge arrays for favorites and downloads (avoiding duplicates if possible)
              const existingStr = JSON.stringify(appData[section][adminId]);
              for (const item of userData) {
                if (!existingStr.includes(JSON.stringify(item))) {
                  appData[section][adminId].push(item);
                }
              }
            } else {
              // Merge objects for history
              appData[section][adminId] = { ...appData[section][adminId], ...userData };
            }
            delete appData[section][userId]; // Remove the old temporary ID
          }
        }
      }
      
      if (migrated) {
        console.log("Migrated old cookie data to the permanent admin_user profile.");
        scheduleAppDataSync();
      }

      console.log("App data loaded from Mega Database.");
    }
  } catch (e) {
    console.error("Failed to load app data from Mega:", e.message);
  }
}

let syncTimeout = null;
let lastSyncTime = 0;

async function performMegaSync() {
  if (!megaStorage) return;
  lastSyncTime = Date.now();
  try {
    await megaStorage.ready;
      const jsonStr = JSON.stringify(appData, null, 2);
      
      // Find old files before uploading
      const existingFiles = megaStorage.root.children.filter(f => f.name === 'terabox_app_data.json');
      
      // Upload with retry logic to handle transient 'fetch failed' errors
      let retries = 3;
      let uploaded = false;
      while (retries > 0 && !uploaded) {
        try {
          await megaStorage.upload({
            name: 'terabox_app_data.json',
            size: Buffer.byteLength(jsonStr)
          }, jsonStr).complete;
          uploaded = true;
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      // Safely delete old files only AFTER successful upload
      for (const file of existingFiles) {
        try { await file.delete(); } catch(e) {}
      }
      
      console.log("App data synced to Mega Database.");
  } catch (e) {
    console.error("Failed to sync app data:", e.message);
  }
}

function scheduleAppDataSync() {
  if (!megaStorage) return;
  
  const now = Date.now();
  const timeSinceLastSync = now - lastSyncTime;
  const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  if (timeSinceLastSync >= SYNC_INTERVAL) {
    // It's been more than 5 minutes, sync immediately
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
    }
    performMegaSync();
  } else {
    // Debounce the sync
    if (!syncTimeout) {
      syncTimeout = setTimeout(() => {
        performMegaSync();
        syncTimeout = null;
      }, SYNC_INTERVAL - timeSinceLastSync);
    }
  }
}

// Ensure periodic backup every 5 minutes if there are pending unsynced changes
setInterval(() => {
  const timeSinceLastSync = Date.now() - lastSyncTime;
  if (timeSinceLastSync >= (5 * 60 * 1000) && syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
      performMegaSync();
  }
}, 5 * 60 * 1000);

// Logger middleware
app.use((req, res, next) => {
  const ignorePrefixes = [
    '/api/downloads-status',
    '/api/thumbnail',
    '/api/stream',
    '/api/mega-stream-node',
    '/api/history',
    '/api/favorites',
    '/api/ping'
  ];
  if (!ignorePrefixes.some(prefix => req.url.startsWith(prefix))) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

/**
 * Extracts the surl (short URL ID) from various formats of TeraBox share links.
 */
function extractSurl(text) {
  try {
    const trimmed = text.trim();
    const sMatch = trimmed.match(/\/s\/([a-zA-Z0-9_-]+)/i);
    if (sMatch && sMatch[1]) {
      let surl = sMatch[1];
      if (surl.startsWith("1")) surl = surl.substring(1);
      return surl;
    }

    const qMatch = trimmed.match(/surl=([a-zA-Z0-9_-]+)/i);
    if (qMatch && qMatch[1]) {
      let surl = qMatch[1];
      if (surl.startsWith("1")) surl = surl.substring(1);
      return surl;
    }

    if (!trimmed.includes(" ") && !trimmed.includes("http")) {
      return trimmed;
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

function extractPwd(text) {
  try {
    const qMatch = text.match(/pwd=([a-zA-Z0-9_-]+)/i);
    if (qMatch && qMatch[1]) return qMatch[1];

    const pMatch = text.match(/(?:password|pwd|code|pin|提取码)\s*[:=：]?\s*([a-zA-Z0-9]{4})/i);
    if (pMatch && pMatch[1]) return pMatch[1];
    
    return "";
  } catch(e) {
    return "";
  }
}

/**
 * Formats size in bytes to a human-readable string.
 */
function formatSize(bytes) {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return "-";
  if (bytes === 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
}

// ================= API ENDPOINTS =================

/**
 * Fetch file list from a TeraBox share link.
 */
app.get("/api/list", async (req, res) => {
  const { url, cookie } = req.query;

  if (!url) {
    return res.status(400).json({ status: "error", message: "TeraBox share link is required." });
  }

  const surl = extractSurl(url);
  if (!surl) {
    return res.status(400).json({ status: "error", message: "Could not extract a valid shortcode (surl) from the URL." });
  }

  console.log(`Resolving surl: ${surl}`);

  const ndusCookie = cookie || process.env.NDUS_COOKIE;
  const targetHeaders = {
    "User-Agent": "netdisk;7.0.3.2;PC;PC-Windows;10.0.22621",
    "Referer": "https://www.terabox.com/"
  };

  if (ndusCookie) {
    targetHeaders["Cookie"] = `ndus=${ndusCookie.trim()}`;
  }

  try {
    // Call unified Cloudflare Worker proxy
    const proxyUrl = "https://tbx-proxy.shakir-ansarii075.workers.dev/";
    const response = await axios.get(proxyUrl, {
      params: {
        mode: "resolve",
        surl: surl,
        raw: "1"
      },
      headers: targetHeaders,
      timeout: 15000, // 15s timeout
      validateStatus: () => true
    });

    const responseData = response.data;

    if (responseData.error) {
      const details = responseData.details || {};
      const errno = details.errno;
      
      if (errno === 140) {
        return res.json({
          status: "error",
          errno: 140,
          message: "The share link has expired or has been cancelled by the creator."
        });
      }
      if (errno === 400141) {
        return res.json({
          status: "error",
          errno: 400141,
          message: "This link is password-protected or requires verification.",
          requires_password: true,
          surl: surl
        });
      }

      // Check if error is related to authentication
      const errorMsg = responseData.error || "";
      if (errorMsg.includes("jsToken") || errorMsg.toLowerCase().includes("cookie")) {
        return res.json({
          status: "error",
          errno: -1,
          message: "Failed to extract authentication tokens. A valid 'ndus' cookie is required to access this file."
        });
      }
      return res.json({ status: "error", errno: -1, message: errorMsg });
    }

    const apiResponse = responseData.upstream || responseData.data || responseData;
    const errno = apiResponse.errno;

    if (errno === 400141) {
      return res.json({
        status: "error",
        errno: 400141,
        message: "This link is password-protected or requires verification.",
        requires_password: true,
        surl: surl
      });
    }

    if (errno === 140) {
      return res.json({
        status: "error",
        errno: 140,
        message: "The share link has expired or has been cancelled by the creator."
      });
    }

    if (errno !== 0) {
      return res.json({
        status: "error",
        errno: errno,
        message: apiResponse.errmsg || `TeraBox API returned error code ${errno}`
      });
    }

    const rawFiles = apiResponse.list || [];
    if (!rawFiles.length) {
      return res.json({ status: "error", errno: -1, message: "No files found in this share link." });
    }

    // Standardize file objects for frontend representation
    const formattedFiles = rawFiles.map((file) => {
      // Extract high-quality thumbnail if available
      let thumbnail = null;
      if (file.thumbs) {
        thumbnail = file.thumbs.url3 || file.thumbs.url2 || file.thumbs.url1 || file.thumbs.icon || null;
      }

      return {
        filename: file.server_filename || "Unknown File",
        size_bytes: parseInt(file.size) || 0,
        size_readable: formatSize(parseInt(file.size) || 0),
        is_directory: file.isdir === "1" || file.isdir === 1,
        thumbnail: thumbnail,
        dlink: file.dlink || "",
        path: file.path || "",
        fs_id: file.fs_id || ""
      };
    });

    return res.json({
      status: "success",
      surl: surl,
      files: formattedFiles
    });

  } catch (error) {
    console.error("API proxy fetch failed:", error.message);
    let errorMsg = "Failed to connect to the TeraBox API proxy. Please try again later.";
    if (error.response && error.response.data) {
      errorMsg = typeof error.response.data === "string" ? error.response.data : JSON.stringify(error.response.data);
    }
    return res.status(500).json({ status: "error", message: errorMsg });
  }
});

/**
 * Fetch personal drive file list.
 */
app.get("/api/personal-list", async (req, res) => {
  const { cookie, path } = req.query;
  const ndusCookie = cookie || process.env.NDUS_COOKIE;

  if (!ndusCookie) {
    return res.status(401).json({ status: "error", message: "A valid 'ndus' cookie is required to access personal files." });
  }

  const targetPath = path || "/";
  const targetHeaders = {
    "User-Agent": "netdisk;7.0.3.2;PC;PC-Windows;10.0.22621",
    "Referer": "https://dm.1024tera.com/",
    "Cookie": `ndus=${ndusCookie.trim()}`
  };

  try {
    const response = await axios.get("https://dm.1024tera.com/api/list", {
      params: {
        dir: targetPath,
        order: "time",
        desc: "1",
        showempty: "0",
        web: "1",
        page: "1",
        num: "10000",
        channel: "dubox",
        clienttype: "0",
        app_id: "250528"
      },
      headers: targetHeaders,
      timeout: 15000
    });

    const apiResponse = response.data;
    const errno = apiResponse.errno;

    if (errno !== 0 && errno !== undefined) {
      return res.json({
        status: "error",
        errno: errno,
        message: apiResponse.errmsg || `TeraBox API returned error code ${errno}`
      });
    }

    const rawFiles = apiResponse.list || [];
    const formattedFiles = rawFiles.map((file) => {
      let thumbnail = null;
      if (file.thumbs) {
        thumbnail = file.thumbs.url3 || file.thumbs.url2 || file.thumbs.url1 || file.thumbs.icon || null;
      }

      return {
        filename: file.server_filename || "Unknown File",
        size_bytes: parseInt(file.size) || 0,
        size_readable: formatSize(parseInt(file.size) || 0),
        is_directory: file.isdir === 1 || file.isdir === "1",
        thumbnail: thumbnail,
        dlink: file.dlink || "", // Will retrieve on demand if empty
        path: file.path || "",
        fs_id: file.fs_id || ""
      };
    });

    return res.json({
      status: "success",
      path: targetPath,
      files: formattedFiles
    });

  } catch (error) {
    console.error("Personal drive list fetch failed:", error.message);
    return res.status(500).json({ status: "error", message: "Failed to connect to TeraBox personal API: " + error.message });
  }
});

/**
 * Fetch direct link for a personal drive file on-demand.
 */
app.get("/api/personal-dlink", async (req, res) => {
  const { cookie, path } = req.query;
  const ndusCookie = cookie || process.env.NDUS_COOKIE;

  if (!ndusCookie) {
    return res.status(401).json({ status: "error", message: "A valid 'ndus' cookie is required." });
  }

  if (!path) {
    return res.status(400).json({ status: "error", message: "File path is required." });
  }

  const targetHeaders = {
    "User-Agent": "netdisk;7.0.3.2;PC;PC-Windows;10.0.22621",
    "Referer": "https://dm.1024tera.com/",
    "Cookie": `ndus=${ndusCookie.trim()}`
  };

  try {
    const response = await axios.get("https://dm.1024tera.com/api/filemetas", {
      params: {
        target: JSON.stringify([path]),
        dlink: "1",
        web: "1",
        channel: "dubox",
        clienttype: "0",
        app_id: "250528"
      },
      headers: targetHeaders,
      timeout: 15000
    });

    const apiResponse = response.data;
    if (apiResponse.errno !== 0 && apiResponse.errno !== undefined) {
      return res.json({
        status: "error",
        message: apiResponse.errmsg || "Failed to retrieve file metadata."
      });
    }

    const fileInfo = apiResponse.info?.[0];
    if (!fileInfo || !fileInfo.dlink) {
      return res.json({
        status: "error",
        message: "Direct link was not generated by TeraBox. Ensure the file is not corrupted."
      });
    }

    return res.json({
      status: "success",
      dlink: fileInfo.dlink
    });

  } catch (error) {
    console.error("Personal dlink fetch failed:", error.message);
    return res.status(500).json({ status: "error", message: "Failed to connect to TeraBox metadata API: " + error.message });
  }
});

/**
 * Fetch a fresh thumbnail for an old file path on-demand.
 */
app.get("/api/thumbnail", async (req, res) => {
  const { cookie, path } = req.query;
  const ndusCookie = cookie || process.env.NDUS_COOKIE;

  if (!ndusCookie || !path) {
    return res.status(400).send("Missing cookie or path");
  }

  const targetHeaders = {
    "User-Agent": "netdisk;7.0.3.2;PC;PC-Windows;10.0.22621",
    "Referer": "https://dm.1024tera.com/",
    "Cookie": `ndus=${ndusCookie.trim()}`
  };

  try {
    const response = await axios.get("https://dm.1024tera.com/api/filemetas", {
      params: {
        target: JSON.stringify([path]),
        dlink: "1",
        web: "1",
        channel: "dubox",
        clienttype: "0",
        app_id: "250528"
      },
      headers: targetHeaders,
      timeout: 15000
    });

    const fileInfo = response.data?.info?.[0];
    if (fileInfo && fileInfo.thumbs) {
      const thumbnail = fileInfo.thumbs.url3 || fileInfo.thumbs.url2 || fileInfo.thumbs.url1 || fileInfo.thumbs.icon;
      if (thumbnail) {
        const imageRes = await axios({
          method: 'GET',
          url: thumbnail,
          responseType: 'stream',
          headers: targetHeaders,
          timeout: 10000
        });
        res.set('Content-Type', 'image/jpeg');
        return imageRes.data.pipe(res);
      }
    }
    
    return res.status(404).send("Thumbnail not found");
  } catch (error) {
    return res.status(500).send("Failed to fetch thumbnail");
  }
});

/**
 * Proxy stream endpoint to handle byte-range video playbacks and direct downloads.
 */
app.get("/api/stream", async (req, res) => {
  const { url, cookie } = req.query;

  if (!url) {
    return res.status(400).send("Direct link (url) is required for streaming.");
  }

  const ndusCookie = cookie || process.env.NDUS_COOKIE;
  const streamHeaders = {
    "User-Agent": "netdisk;7.0.3.2;PC;PC-Windows;10.0.22621",
    "Referer": "https://www.terabox.com/",
    "Connection": "keep-alive"
  };

  if (ndusCookie) {
    streamHeaders["Cookie"] = `ndus=${ndusCookie.trim()}`;
  }

  // Forward range requests from client browser to TeraBox CDN
  if (req.headers.range) {
    streamHeaders["Range"] = req.headers.range;
    console.log(`Forwarding Range Header: ${req.headers.range}`);
  }

  try {
    const targetUrl = decodeURIComponent(url);

    const stream = got.stream(targetUrl, {
      headers: streamHeaders,
      throwHttpErrors: false,
      maxRedirects: 5
    });

    stream.on('response', (streamResponse) => {
      res.status(streamResponse.statusCode);
      
      const headersToCopy = [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "content-disposition",
        "cache-control"
      ];
  
      headersToCopy.forEach((h) => {
        const val = streamResponse.headers[h];
        if (val) {
          res.setHeader(h, val);
        }
      });
    });

    stream.on("error", (e) => {
      console.error("Got stream proxy error:", e.message);
      if (!res.headersSent) {
        res.status(500).send("Streaming stream failed midway.");
      }
    });

    stream.pipe(res);

  } catch (error) {
    console.error("Stream initialization failed:", error.message);
    if (!res.headersSent) {
      res.status(500).send("Failed to initiate proxy stream: " + error.message);
    }
  }
});

// ================= MEGA STREAM API =================
import { File } from "megajs";

app.get("/api/mega-files", async (req, res) => {
  if (!megaStorage) return res.status(500).json({ status: "error", message: "Mega storage not connected." });
  
  try {
    await megaStorage.ready;
    const files = megaStorage.root.children
      .filter(f => !f.directory && f.name !== 'terabox_app_data.json')
      .map(f => ({
        nodeId: f.nodeId,
        name: f.name,
        size: f.size,
        timestamp: f.timestamp
      }))
      .reverse();
      
    res.json({ status: "success", files });
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message });
  }
});

app.get("/api/mega-duplicates", async (req, res) => {
  if (!megaStorage) return res.status(500).json({ status: "error", message: "Mega storage not connected." });
  
  try {
    await megaStorage.ready;
    const groups = {};
    megaStorage.root.children.forEach(f => {
      if (f.directory || f.name === 'terabox_app_data.json') return;
      const key = `${f.size}_${f.name}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push({
        nodeId: f.nodeId,
        name: f.name,
        size: f.size,
        timestamp: f.timestamp
      });
    });
    
    // Filter to only groups that have more than 1 file
    const duplicates = Object.values(groups).filter(group => group.length > 1);
    res.json({ status: "success", duplicates });
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message });
  }
});

app.delete("/api/mega-files/:nodeId", async (req, res) => {
  if (!megaStorage) return res.status(500).json({ status: "error", message: "Mega storage not connected." });
  
  try {
    await megaStorage.ready;
    const nodeId = req.params.nodeId;
    
    // Find the file by nodeId
    let targetFile = null;
    for (const file of megaStorage.root.children) {
      // MegaJS node objects might not directly expose id/nodeId in a simple way in older versions,
      // but usually file.nodeId or file.id or just finding by name is used. 
      // In GET mega-files, we mapped `nodeId: f.id`.
      if (file.id === nodeId || file.nodeId === nodeId || file.name === nodeId) {
        targetFile = file;
        break;
      }
    }
    
    if (!targetFile) {
      return res.status(404).json({ status: "error", message: "File not found on Mega.nz" });
    }
    
    await targetFile.delete();
    console.log(`[Mega] Deleted file: ${targetFile.name}`);
    res.json({ status: "success", message: "File deleted successfully" });
  } catch (e) {
    console.error("Mega delete error:", e.message);
    res.status(500).json({ status: "error", message: e.message });
  }
});

app.get("/api/mega-stream-node/:nodeId", async (req, res) => {
  if (!megaStorage) return res.status(500).send("Mega storage not connected.");
  const { nodeId } = req.params;
  
  try {
    await megaStorage.ready;
    const file = megaStorage.root.children.find(c => c.nodeId === nodeId);
    if (!file) return res.status(404).send("File not found in Mega.");

    const range = req.headers.range;
    let start = 0;
    let end = file.size - 1;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : file.size - 1;
    }
    
    const chunksize = (end - start) + 1;
    res.writeHead(range ? 206 : 200, {
      "Content-Range": `bytes ${start}-${end}/${file.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4",
      "Content-Disposition": req.query.download === 'true' ? `attachment; filename="${encodeURIComponent(file.name)}"` : `inline; filename="${encodeURIComponent(file.name)}"`
    });
    
    const stream = file.download({ start, end });
    stream.pipe(res);
    stream.on("error", () => res.end());
    req.on("close", () => stream.destroy());
  } catch (e) {
    console.error("Mega streaming error:", e);
    if (!res.headersSent) res.status(500).send("Streaming failed.");
  }
});

app.get("/api/mega-stream", async (req, res) => {
  const { link } = req.query;
  if (!link) return res.status(400).send("Mega link required.");

  try {
    const file = File.fromURL(link);
    await file.loadAttributes();

    const range = req.headers.range;
    let start = 0;
    let end = file.size - 1;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : file.size - 1;
      
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${file.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": (end - start) + 1,
        "Content-Type": "video/mp4",
      });
    } else {
      res.writeHead(200, {
        "Content-Length": file.size,
        "Content-Type": "video/mp4",
      });
    }

    const stream = file.download({ start, end });
    stream.pipe(res);

    stream.on('error', (e) => {
      console.error("Mega stream error:", e.message);
    });

  } catch (e) {
    console.error("Failed to stream mega link:", e.message);
    if (!res.headersSent) {
      res.status(500).send("Mega streaming failed: " + e.message);
    }
  }
});

// ================= SERVER DOWNLOAD API =================

app.post("/api/server-download", async (req, res) => {
  const { url, cookie, filename } = req.body;
  if (!url || !filename) {
    return res.status(400).json({ status: "error", message: "url and filename required." });
  }

  // Prevent duplicate downloads
  const existingId = Object.keys(activeDownloads).find(id => activeDownloads[id].filename === filename);
  if (existingId) {
    const existingDl = activeDownloads[existingId];
    if (["downloading", "queued", "uploading"].includes(existingDl.status)) {
      return res.json({ status: "success", downloadId: existingId, message: "Already in progress" });
    } else if (existingDl.status === "completed") {
      return res.json({ status: "success", downloadId: existingId, message: "Already completed" });
    } else {
      // If it was an error or paused, we will overwrite/restart it by deleting the old one
      delete activeDownloads[existingId];
    }
  }

  const downloadId = crypto.randomUUID();
  // Clean filename to prevent path traversal or special chars issues
  const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const filePath = path.join(downloadsDir, `${downloadId}_${safeFilename}`);

  activeDownloads[downloadId] = {
    id: downloadId,
    filename: filename,
    status: "downloading",
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    filePath: filePath,
    urlPath: `/downloads/${downloadId}_${safeFilename}`,
    error: null,
    startedAt: Date.now(),
    originalUrl: decodeURIComponent(url),
    cookie: cookie || process.env.NDUS_COOKIE
  };

  saveDownloadsState();
  res.json({ status: "success", downloadId });

  activeDownloads[downloadId].status = "queued";
  downloadQueue.push(downloadId);
  processNextDownload();
});

function processNextDownload() {
  if (isDownloading || downloadQueue.length === 0) return;
  const nextId = downloadQueue.shift();
  const dl = activeDownloads[nextId];
  if (dl && (dl.status === "queued" || dl.status === "downloading")) {
    isDownloading = true;
    startDownloadStream(dl);
  } else {
    processNextDownload();
  }
}

async function startDownloadStream(dl) {
  let speedInterval;
  try {
    dl.status = "downloading";
    dl.error = null;
    dl.progress = 0;
    dl.downloadedBytes = 0;
    dl.uploadedBytes = 0;
    dl.speed = 0;
    saveDownloadsState();
    
    let lastCalculatedBytes = 0;
    speedInterval = setInterval(() => {
        if (!activeDownloads[dl.id] || (dl.status !== "downloading" && dl.status !== "uploading")) {
            clearInterval(speedInterval);
            dl.speed = 0;
            return;
        }
        let currentTotalBytes = (dl.status === "downloading") ? dl.downloadedBytes : dl.uploadedBytes;
        dl.speed = currentTotalBytes - lastCalculatedBytes;
        lastCalculatedBytes = currentTotalBytes;
    }, 1000);
    
    const streamHeaders = {
      "User-Agent": "netdisk;7.0.3.2;PC;PC-Windows;10.0.22621",
      "Referer": "https://www.terabox.com/",
      "Connection": "keep-alive"
    };
    if (dl.cookie) streamHeaders["Cookie"] = `ndus=${dl.cookie.trim()}`;

    const abortController = new AbortController();
    dl.abortController = abortController;

    // 1. Get File Size
    const headRes = await axios({
      method: "head",
      url: dl.originalUrl,
      headers: streamHeaders,
      signal: abortController.signal
    });
    
    const contentLength = parseInt(headRes.headers['content-length'] || "0", 10);
    dl.totalBytes = contentLength;
    
    if (contentLength === 0) {
       throw new Error("Could not determine file size or file is empty.");
    }

    // 2. Pre-allocate File (Write 1 byte at the end to prevent Windows NTFS disk thrashing)
    const fd = await fs.promises.open(dl.filePath, 'w');
    const buffer = Buffer.alloc(1);
    await fd.write(buffer, 0, 1, contentLength - 1);
    await fd.close();

    // 3. Setup Chunks
    const numConnections = 16; // Reverted to 16 because Terabox Anti-DDoS drops connections > 16
    const chunkSize = Math.ceil(contentLength / numConnections);
    const downloadPromises = [];
    const chunkProgress = new Array(numConnections).fill(0);

    for (let i = 0; i < numConnections; i++) {
      const start = i * chunkSize;
      const end = i === numConnections - 1 ? contentLength - 1 : (i + 1) * chunkSize - 1;
      
      if (start >= contentLength) break; // In case of rounding quirks

      downloadPromises.push((async () => {
        // Heavily stagger connection starts (500ms) to trick the firewall into thinking it's a slow client
        await new Promise(r => setTimeout(r, i * 500));

        let retries = 5;
        let chunkSuccess = false;
        
        while (retries > 0 && !chunkSuccess) {
          chunkProgress[i] = 0; // Reset progress for this chunk if retrying
          try {
            const headers = { ...streamHeaders, "Range": `bytes=${start}-${end}` };
            
            await new Promise((resolve, reject) => {
              const streamReq = got.stream(dl.originalUrl, {
                headers: headers,
                throwHttpErrors: false,
                retry: { limit: 0 }
              });
              
              const writer = fs.createWriteStream(dl.filePath, { flags: 'r+', start });
              
              let currentChunkDownloaded = 0;
              streamReq.on('data', chunk => {
                if (!activeDownloads[dl.id]) {
                  streamReq.destroy();
                  return reject(new Error("Cancelled"));
                }
                
                currentChunkDownloaded += chunk.length;
                chunkProgress[i] = currentChunkDownloaded;
                
                let total = 0;
                for (let c of chunkProgress) total += c;
                dl.downloadedBytes = total;
                dl.progress = Math.round((total / contentLength) * 50);
              });
              
              streamReq.pipe(writer);
              writer.on('finish', resolve);
              writer.on('error', reject);
              streamReq.on('error', reject);
              
              // Handle abort from user
              const onAbort = () => {
                streamReq.destroy();
                reject(new Error("Cancelled"));
              };
              abortController.signal.addEventListener('abort', onAbort);
              writer.on('finish', () => abortController.signal.removeEventListener('abort', onAbort));
            });
            chunkSuccess = true;
          } catch (err) {
            retries--;
            if (err.message === "Cancelled") throw err;
            console.warn(`Chunk ${i} failed. Retries left: ${retries}. Error: ${err.message}`);
            if (retries === 0) throw new Error(`Chunk ${i} failed after 5 retries: ${err.message}`);
            await new Promise(r => setTimeout(r, 2000)); // wait 2s before retry
          }
        }
      })());
    }

    await Promise.all(downloadPromises);

    // 4. Upload to Mega
    if (megaStorage) {
      dl.status = "uploading"; // A custom UI state could be shown, but we just bump progress to 50+
      saveDownloadsState();

      const readStream = fs.createReadStream(dl.filePath);
      const writer = megaStorage.upload({
        name: dl.filename,
        size: contentLength
      });

      const pass = new stream.PassThrough();
      let megaUploaded = 0;
      pass.on('data', chunk => {
         megaUploaded += chunk.length;
         dl.uploadedBytes = megaUploaded;
         dl.progress = 50 + Math.round((megaUploaded / contentLength) * 50);
      });
      readStream.pipe(pass).pipe(writer);

      writer.on('complete', async (file) => {
        try {
          const link = await file.link();
          if (activeDownloads[dl.id]) {
            dl.status = "completed";
            dl.progress = 100;
            dl.megaLink = link;
            saveDownloadsState();
          }
        } catch (e) {
          if (activeDownloads[dl.id]) {
            dl.status = "error";
            dl.error = "Mega link generation failed.";
            saveDownloadsState();
          }
        } finally {
          fs.promises.unlink(dl.filePath).catch(() => {});
        }
      });
      
      writer.on('error', (err) => {
        console.error("Mega Upload error:", err);
        if (activeDownloads[dl.id]) {
          dl.status = "error";
          dl.error = err.message;
          saveDownloadsState();
        }
        fs.promises.unlink(dl.filePath).catch(() => {});
      });

    } else {
      dl.status = "completed";
      dl.progress = 100;
      saveDownloadsState();
    }

  } catch (error) {
    if (axios.isCancel(error)) {
      console.log(`Download ${dl.id} was cancelled.`);
    } else {
      console.error("Server download failed:", error.message);
      if (activeDownloads[dl.id]) {
        dl.status = "error";
        dl.error = error.message;
        saveDownloadsState();
      }
    }
    fs.promises.unlink(dl.filePath).catch(() => {});
  } finally {
    if (speedInterval) clearInterval(speedInterval);
    dl.speed = 0;
    isDownloading = false;
    processNextDownload();
  }
}

app.post("/api/server-download/:id/action", (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  const dl = activeDownloads[id];

  if (!dl) return res.status(404).json({ status: "error", message: "Download not found." });

  if (action === "retry") {
    if (dl.status === "error") {
      dl.status = "queued";
      downloadQueue.push(id);
      processNextDownload();
    }
  } else {
    return res.status(400).json({ status: "error", message: "Action not supported (Pause/Resume removed for Mega.nz)." });
  }

  res.json({ status: "success" });
});

app.get("/api/downloads-status", (req, res) => {
  const cookie = req.query.cookie;
  let downloads = Object.values(activeDownloads);
  if (cookie) {
    downloads = downloads.filter(dl => dl.cookie === cookie);
  }
  downloads = downloads.sort((a, b) => b.startedAt - a.startedAt);
  
  let megaFiles = [];
  if (megaStorage && megaStorage.root && megaStorage.root.children) {
    megaFiles = megaStorage.root.children.map(f => f.name);
  }
  
  res.json({ status: "success", downloads, megaFiles });
});

app.get("/api/favorites", (req, res) => {
  const cookie = req.query.cookie;
  if (!cookie) return res.json({ status: "success", favorites: [] });
  const userId = getUserId(cookie);
  res.json({ status: "success", favorites: appData.favorites[userId] || [] });
});

app.post("/api/favorites", (req, res) => {
  const { cookie, favorites } = req.body;
  if (!cookie) return res.status(400).json({ status: "error", message: "cookie required" });
  const userId = getUserId(cookie);
  appData.favorites[userId] = favorites || [];
  scheduleAppDataSync();
  res.json({ status: "success" });
});

app.get("/api/history", (req, res) => {
  const cookie = req.query.cookie;
  if (!cookie) return res.json({ status: "success", history: {} });
  const userId = getUserId(cookie);
  res.json({ status: "success", history: appData.history[userId] || {} });
});

app.post("/api/history", (req, res) => {
  const { cookie, filename, time, fileData } = req.body;
  if (!cookie || !filename) return res.status(400).json({ status: "error" });
  const userId = getUserId(cookie);
  if (!appData.history[userId]) appData.history[userId] = {};
  
  if (fileData) {
    appData.history[userId][filename] = { time, file: fileData, lastWatched: Date.now() };
  } else if (appData.history[userId][filename]) {
    appData.history[userId][filename].time = time;
    appData.history[userId][filename].lastWatched = Date.now();
  } else {
    appData.history[userId][filename] = { time, lastWatched: Date.now() };
  }
  
  scheduleAppDataSync();
  res.json({ status: "success" });
});

app.get("/api/downloads-history", (req, res) => {
  const cookie = req.query.cookie;
  if (!cookie) return res.json({ status: "success", downloads: [] });
  const userId = getUserId(cookie);
  res.json({ status: "success", downloads: appData.downloads[userId] || [] });
});

app.post("/api/history/clear", (req, res) => {
  const { cookie } = req.body;
  if (!cookie) return res.status(400).json({ status: "error" });
  const userId = getUserId(cookie);
  appData.history[userId] = {};
  scheduleAppDataSync();
  res.json({ status: "success" });
});

app.post("/api/downloads-history", (req, res) => {
  const { cookie, downloads } = req.body;
  if (!cookie) return res.status(400).json({ status: "error" });
  const userId = getUserId(cookie);
  appData.downloads[userId] = downloads || [];
  scheduleAppDataSync();
  res.json({ status: "success" });
});



app.post("/api/settings", (req, res) => {
  const { cookie } = req.body;
  if (!cookie) return res.status(400).json({ status: "error" });
  const userId = getUserId(cookie);
  if (!appData.settings) appData.settings = {};
  appData.settings[userId] = { cookie };
  scheduleAppDataSync();
  res.json({ status: "success" });
});

app.delete("/api/server-download/:id", async (req, res) => {
  const { id } = req.params;
  const download = activeDownloads[id];
  if (!download) return res.status(404).json({ status: "error", message: "Download not found." });

  if (download.abortController && download.status === "downloading") {
    download.abortController.abort();
  }

  if (download.megaLink && megaStorage) {
    try {
      const file = megaStorage.root.children.find(f => f.name === download.filename);
      if (file) {
        await file.delete();
        console.log(`Deleted ${download.filename} from Mega.nz`);
      } else {
        console.warn(`File ${download.filename} not found in Mega.nz root`);
      }
    } catch (e) {
      console.error("Failed to delete from Mega.nz:", e.message);
    }
  }

  if (fs.existsSync(download.filePath)) {
    try {
      fs.unlinkSync(download.filePath);
    } catch (e) {
      console.error("Failed to delete local file:", e);
    }
  }
  
  delete activeDownloads[id];
  saveDownloadsState();
  res.json({ status: "success", message: "Deleted successfully" });
});
// Render Sleep Prevention (Keep-Alive)
app.get("/api/ping", (req, res) => res.send("pong"));

setInterval(() => {
  const hasActiveDownloads = Object.values(activeDownloads).some(dl => dl.status === "downloading" || dl.status === "uploading");
  if (hasActiveDownloads) {
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    got.get(`${url}/api/ping`, { timeout: { request: 5000 } }).catch(() => {});
    console.log(`[Keep-Alive] Pinged ${url} to prevent Render from sleeping during active downloads.`);
  }
}, 10 * 60 * 1000); // 10 minutes

// Start the server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`  TeraBox Downloader & Viewer Server is Running!`);
  console.log(`  Local Address: http://localhost:${PORT} `);
  console.log(`===================================================`);
});
