// app.js - Latverian Cyber-Fortress Logic Engine

document.addEventListener("DOMContentLoaded", () => {
  initProfile();
  initSkills();
  initSpotify();
  initSOCGame();
});

// Sound effects wrapper to prevent crashes if sounds are blocked by browser autoplay policy
const Sound = {
  laser: document.getElementById("sound-laser"),
  error: document.getElementById("sound-error"),
  play(effect) {
    const sfx = this[effect];
    if (sfx) {
      sfx.currentTime = 0;
      sfx.play().catch(() => {
        // Autoplay policy blocked sound - ignore silently
      });
    }
  }
};

/* ==========================================================================
   PROFILE INITIALIZATION
   ========================================================================== */
function initProfile() {
  const profile = CONFIG.profile;
  
  // Set text values
  document.getElementById("profile-name").textContent = profile.name.toUpperCase();
  document.getElementById("profile-alias").textContent = `// ${profile.alias.toUpperCase()}`;
  document.getElementById("profile-tagline").textContent = profile.tagline;
  
  // Links
  document.getElementById("github-link").href = `https://github.com/${profile.github}`;
  document.getElementById("email-link").href = `mailto:${profile.email}`;
  
  // Dynamic Uptime simulator
  const uptimeEl = document.getElementById("uptime");
  setInterval(() => {
    const current = parseFloat(uptimeEl.textContent);
    const fluctuation = (Math.random() - 0.5) * 0.002;
    const newUptime = Math.min(100, Math.max(99.90, current + fluctuation));
    uptimeEl.textContent = newUptime.toFixed(4) + "%";
  }, 4000);
}

/* ==========================================================================
   SKILLS TABS GENERATION & CONTROLLER
   ========================================================================== */
let activeCategory = "";

function initSkills() {
  const tabsNav = document.getElementById("skill-tabs-nav");
  if (!tabsNav) return;
  
  tabsNav.innerHTML = "";
  
  // Create tab buttons dynamically
  CONFIG.skills.forEach((cat, index) => {
    const btn = document.createElement("button");
    btn.classList.add("tab-btn");
    if (index === 0) {
      btn.classList.add("active");
      activeCategory = cat.category;
    }
    btn.textContent = `[ ${cat.category.toUpperCase()} ]`;
    btn.setAttribute("data-category", cat.category);
    btn.addEventListener("click", (e) => {
      // Toggle Active Tab Style
      document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      
      // Render Content
      activeCategory = cat.category;
      renderSkillsForCategory(cat.category);
    });
    tabsNav.appendChild(btn);
  });
  
  // Render first category by default
  if (CONFIG.skills.length > 0) {
    renderSkillsForCategory(CONFIG.skills[0].category);
  }
}

function renderSkillsForCategory(categoryName) {
  const container = document.getElementById("skills-grid-container");
  if (!container) return;
  
  // Animate fade out
  container.style.opacity = "0";
  container.style.transform = "translateY(5px)";
  
  setTimeout(() => {
    container.innerHTML = "";
    
    const categoryData = CONFIG.skills.find(c => c.category === categoryName);
    if (!categoryData) return;
    
    categoryData.items.forEach((skill, index) => {
      const node = document.createElement("div");
      node.classList.add("skill-node");
      node.style.animation = `slide-in 0.3s ease-out ${index * 0.05}s forwards`;
      
      node.innerHTML = `
        <div class="node-header">
          <span class="node-title">${skill.name}</span>
          <span class="node-meta">NODE_0${index + 1}</span>
        </div>
        <div class="node-body">
          ${skill.details}
        </div>
      `;
      container.appendChild(node);
    });
    
    // Fade in
    container.style.opacity = "1";
    container.style.transform = "translateY(0)";
  }, 150);
}

/* ==========================================================================
   SPOTIFY INTEGRATION (Lanyard Live WebSocket + Interactive Fallback Player)
   ========================================================================== */
let lanyardSocket = null;
let heartbeatInterval = null;
let currentSpotifyState = {
  isPlaying: false,
  title: "",
  artist: "",
  album: "",
  cover: "",
  duration: 0, // in ms
  elapsed: 0,  // in ms
  lastUpdated: 0, // local timestamp when state received
  url: "#"
};

// Fallback player states
let localPlaylist = CONFIG.spotifyFallback;
let localIndex = 0;
let localTimer = null;
let isLocalPlaying = false;
let isLanyardActive = false;

function initSpotify() {
  const discordId = CONFIG.profile.discordId;
  
  // If user provided a Discord ID, try connecting to Lanyard
  if (discordId && discordId !== "YOUR_DISCORD_ID_HERE") {
    connectLanyard(discordId);
  } else {
    // Engaged fallback immediately
    setupLocalPlayer();
  }
  
  // Connect Spotify controller buttons for local interactive fallback
  const playBtn = document.getElementById("spotify-play-btn");
  const prevBtn = document.getElementById("spotify-prev-btn");
  const nextBtn = document.getElementById("spotify-next-btn");
  const progContainer = document.querySelector(".progress-bar-container");
  
  playBtn.addEventListener("click", () => {
    if (isLanyardActive) {
      // If we are tracking live discord, player controls don't command Spotify but can open url
      window.open(currentSpotifyState.url, "_blank");
      return;
    }
    toggleLocalPlay();
  });
  
  prevBtn.addEventListener("click", () => {
    if (isLanyardActive) return;
    prevLocalTrack();
  });
  
  nextBtn.addEventListener("click", () => {
    if (isLanyardActive) return;
    nextLocalTrack();
  });

  progContainer.addEventListener("click", (e) => {
    if (isLanyardActive) return;
    // Seek inside the song for local mock player
    const rect = progContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    
    const track = localPlaylist[localIndex];
    const durationSec = parseTimeToSeconds(track.duration);
    currentSpotifyState.elapsed = percentage * durationSec * 1000;
    updateSpotifyUIProgress();
  });
}

// Connect to Lanyard WebSocket
function connectLanyard(userId) {
  const wssUrl = "wss://api.lanyard.rest/socket";
  
  try {
    lanyardSocket = new WebSocket(wssUrl);
    
    lanyardSocket.onopen = () => {
      // Socket open - Lanyard requires subscription message
      const initPayload = {
        op: 2,
        d: {
          subscribe_to_id: userId
        }
      };
      lanyardSocket.send(JSON.stringify(initPayload));
    };
    
    lanyardSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // op 1 = Hello (defines heartbeat interval)
      if (data.op === 1) {
        const interval = data.d.heartbeat_interval;
        startLanyardHeartbeat(interval);
      }
      
      // op 0 = Event dispatch (INIT_STATE or PRESENCE_UPDATE)
      if (data.op === 0 && (data.t === "INIT_STATE" || data.t === "PRESENCE_UPDATE")) {
        processLanyardData(data.d);
      }
    };
    
    lanyardSocket.onerror = (e) => {
      console.warn("Lanyard WS error, falling back to mockup player", e);
      setupLocalPlayer();
    };
    
    lanyardSocket.onclose = () => {
      clearInterval(heartbeatInterval);
      if (isLanyardActive) {
        console.warn("Lanyard connection lost, reverting to mockup");
        isLanyardActive = false;
        setupLocalPlayer();
      }
    };
  } catch (err) {
    console.warn("Could not initiate Lanyard Socket. Mockup active.", err);
    setupLocalPlayer();
  }
}

function startLanyardHeartbeat(ms) {
  clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (lanyardSocket && lanyardSocket.readyState === WebSocket.OPEN) {
      lanyardSocket.send(JSON.stringify({ op: 3 }));
    }
  }, ms);
}

function processLanyardData(presence) {
  const presenceIndicator = document.getElementById("spotify-presence-indicator");
  const presenceText = document.getElementById("presence-text");
  
  // Track status online/offline
  const status = presence.discord_status;
  if (status === "offline") {
    presenceIndicator.className = "presence-indicator offline";
    presenceText.textContent = "OFFLINE";
  } else {
    presenceIndicator.className = "presence-indicator online";
    presenceText.textContent = status.toUpperCase();
  }
  
  const spotify = presence.spotify;
  
  if (spotify) {
    isLanyardActive = true;
    clearInterval(localTimer); // disable local mockup player simulation
    isLocalPlaying = false;
    
    presenceText.textContent = "LISTENING";
    presenceIndicator.className = "presence-indicator online";
    
    currentSpotifyState.isPlaying = true;
    currentSpotifyState.title = spotify.song;
    currentSpotifyState.artist = spotify.artist;
    currentSpotifyState.album = spotify.album;
    currentSpotifyState.cover = spotify.album_art_url;
    currentSpotifyState.duration = spotify.timestamps.end - spotify.timestamps.start;
    currentSpotifyState.elapsed = Date.now() - spotify.timestamps.start;
    currentSpotifyState.lastUpdated = Date.now();
    currentSpotifyState.url = `https://open.spotify.com/track/${spotify.track_id}`;
    
    updateSpotifyUIState(true);
    
    // Start progress tracker ticking locally based on timestamps
    if (!localTimer) {
      localTimer = setInterval(() => {
        const timeDiff = Date.now() - currentSpotifyState.lastUpdated;
        const currentElapsed = Math.min(currentSpotifyState.duration, currentSpotifyState.elapsed + timeDiff);
        
        // Progress updates
        const elapsedSec = Math.floor(currentElapsed / 1000);
        const durationSec = Math.floor(currentSpotifyState.duration / 1000);
        
        document.getElementById("spotify-time-elapsed").textContent = formatSeconds(elapsedSec);
        document.getElementById("spotify-time-total").textContent = formatSeconds(durationSec);
        
        const percent = (currentElapsed / currentSpotifyState.duration) * 100;
        document.getElementById("spotify-progress-bar").style.width = `${percent}%`;
        
        // If song ends, wait for socket state refresh
      }, 500);
    }
  } else {
    // User is online on Discord, but not listening to Spotify. Use local mock.
    if (isLanyardActive) {
      isLanyardActive = false;
      setupLocalPlayer();
    }
  }
}

// Local mock player logic (fully interactive!)
function setupLocalPlayer() {
  isLanyardActive = false;
  clearInterval(localTimer);
  localTimer = null;
  
  // Set indicators to offline or fallback mock state
  document.getElementById("spotify-presence-indicator").className = "presence-indicator offline";
  document.getElementById("presence-text").textContent = "STANDBY";
  
  loadLocalTrack(localIndex);
}

function loadLocalTrack(index) {
  const track = localPlaylist[index];
  
  currentSpotifyState.title = track.title;
  currentSpotifyState.artist = track.artist;
  currentSpotifyState.album = track.album;
  currentSpotifyState.cover = track.cover;
  currentSpotifyState.duration = parseTimeToSeconds(track.duration) * 1000;
  currentSpotifyState.elapsed = 0;
  currentSpotifyState.isPlaying = isLocalPlaying;
  currentSpotifyState.url = track.url;
  
  updateSpotifyUIState(isLocalPlaying);
}

function updateSpotifyUIState(isPlaying) {
  const titleEl = document.getElementById("spotify-track-title");
  const artistEl = document.getElementById("spotify-track-artist");
  const albumEl = document.getElementById("spotify-track-album");
  const albumCenter = document.getElementById("spotify-album-center");
  const vinylRecord = document.getElementById("spotify-record");
  
  // Update elements
  titleEl.textContent = currentSpotifyState.title;
  artistEl.textContent = currentSpotifyState.artist;
  albumEl.textContent = currentSpotifyState.album;
  albumCenter.style.backgroundImage = `url('${currentSpotifyState.cover}')`;
  
  // Update play controls symbols
  const playIcon = document.getElementById("spotify-play-icon");
  const pauseIcon = document.getElementById("spotify-pause-icon");
  
  if (isPlaying) {
    playIcon.classList.add("hidden");
    pauseIcon.classList.remove("hidden");
    vinylRecord.classList.add("playing");
  } else {
    playIcon.classList.remove("hidden");
    pauseIcon.classList.add("hidden");
    vinylRecord.classList.remove("playing");
  }
  
  updateSpotifyUIProgress();
}

function updateSpotifyUIProgress() {
  const elapsedSec = Math.floor(currentSpotifyState.elapsed / 1000);
  const durationSec = Math.floor(currentSpotifyState.duration / 1000);
  
  document.getElementById("spotify-time-elapsed").textContent = formatSeconds(elapsedSec);
  document.getElementById("spotify-time-total").textContent = formatSeconds(durationSec);
  
  const percent = (currentSpotifyState.elapsed / currentSpotifyState.duration) * 100;
  document.getElementById("spotify-progress-bar").style.width = `${percent}%`;
}

function toggleLocalPlay() {
  isLocalPlaying = !isLocalPlaying;
  currentSpotifyState.isPlaying = isLocalPlaying;
  
  const vinylRecord = document.getElementById("spotify-record");
  const playIcon = document.getElementById("spotify-play-icon");
  const pauseIcon = document.getElementById("spotify-pause-icon");
  
  if (isLocalPlaying) {
    playIcon.classList.add("hidden");
    pauseIcon.classList.remove("hidden");
    vinylRecord.classList.add("playing");
    
    // Start timeline ticking
    clearInterval(localTimer);
    localTimer = setInterval(() => {
      currentSpotifyState.elapsed += 1000;
      
      if (currentSpotifyState.elapsed >= currentSpotifyState.duration) {
        // Song finished: loop or next
        nextLocalTrack();
      } else {
        updateSpotifyUIProgress();
      }
    }, 1000);
  } else {
    playIcon.classList.remove("hidden");
    pauseIcon.classList.add("hidden");
    vinylRecord.classList.remove("playing");
    clearInterval(localTimer);
    localTimer = null;
  }
}

function nextLocalTrack() {
  localIndex = (localIndex + 1) % localPlaylist.length;
  loadLocalTrack(localIndex);
}

function prevLocalTrack() {
  localIndex = (localIndex - 1 + localPlaylist.length) % localPlaylist.length;
  loadLocalTrack(localIndex);
}

// Utility formatting functions
function parseTimeToSeconds(timeStr) {
  const parts = timeStr.split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function formatSeconds(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}


/* ==========================================================================
   SOC THREAT TERMINAL DEFENSE GAME
   ========================================================================== */
let gameActive = false;
let blockedCount = 0;
let systemIntegrity = 100;
let gameInterval = null;
let currentThreatIP = "";
let threatTimer = null;
let threatIndex = 0;

const threatTypes = [
  { name: "SQL Injection Probe", risk: 15, msg: "EXPLOIT: Input sanitization failure. Query injection detected on /endpoint/api.php" },
  { name: "SYN Flood DDoS", risk: 20, msg: "DDoS: Unsynchronized SYN flood overload detected on secure Port 443" },
  { name: "SSH Brute-Force", risk: 10, msg: "AUTH: Repeated login failure on admin account. Bruteforce script active." },
  { name: "Suricata Alert: Portscan", risk: 10, msg: "SCAN: Rapid port polling sweeps scanning for vulnerabilities" },
  { name: "Wazuh Alert: Ransomware Signature", risk: 25, msg: "FILE: High-entropy rapid directory write detected on file system" }
];

function initSOCGame() {
  const cmdBtn = document.getElementById("terminal-game-btn");
  if (!cmdBtn) return;
  
  cmdBtn.addEventListener("click", () => {
    if (!gameActive) {
      if (systemIntegrity <= 0) {
        // If system crashed, reboot first
        rebootSystem();
      } else {
        startSOCDefense();
      }
    } else {
      // User blocks the intrusion!
      blockActiveThreat();
    }
  });
}

function startSOCDefense() {
  gameActive = true;
  blockedCount = 0;
  systemIntegrity = 100;
  
  const cmdBtn = document.getElementById("terminal-game-btn");
  cmdBtn.textContent = "SCANNING NETGRID...";
  cmdBtn.className = "terminal-btn btn-glowing";
  
  document.getElementById("blocked-count").textContent = "0";
  const integrityEl = document.getElementById("system-integrity");
  integrityEl.textContent = "100%";
  integrityEl.className = "security-high";
  
  document.getElementById("game-status-bar").classList.remove("hidden");
  
  const screen = document.getElementById("terminal-output");
  screen.innerHTML = `<p class="sys-msg text-success">[SOC MONITORS BOOTED - DOOM DETECTOR v9.4]</p>
  <p class="sys-msg">[Grid perimeter set to defensive hold...]</p>`;
  
  // Start threat spawner
  gameInterval = setInterval(spawnThreat, 3000);
}

function spawnThreat() {
  if (!gameActive) return;
  
  const screen = document.getElementById("terminal-output");
  
  // Scroll logs
  if (screen.children.length > 15) {
    screen.removeChild(screen.firstChild);
  }
  
  // Normal network logs (80% chance) or threat alert (20% chance / guarantee if none active)
  if (currentThreatIP === "" && Math.random() < 0.6) {
    // Spawn threat!
    const threat = threatTypes[Math.floor(Math.random() * threatTypes.length)];
    const fakeIP = `192.168.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
    currentThreatIP = fakeIP;
    
    // Add threat to terminal screen
    const log = document.createElement("div");
    log.className = "threat-log";
    log.innerHTML = `
      <p class="text-alert">!!! CRITICAL ALERT !!!</p>
      <p class="sys-msg">${threat.msg}</p>
      <p class="sys-msg">SOURCE IP: <strong class="text-alert">${fakeIP}</strong></p>
      <p class="sys-msg">SEVERITY RISK: ${threat.risk}%</p>
    `;
    screen.appendChild(log);
    screen.scrollTop = screen.scrollHeight;
    
    // Play alert sound
    Sound.play("error");
    
    // Update button to action button
    const cmdBtn = document.getElementById("terminal-game-btn");
    cmdBtn.textContent = `BLOCK IP: ${fakeIP}`;
    cmdBtn.className = "terminal-btn btn-glowing btn-alert";
    
    // Threat countdown (user has 2.2 seconds to block)
    threatTimer = setTimeout(() => {
      // Threat triggers! System integrity drops.
      systemIntegrity = Math.max(0, systemIntegrity - threat.risk);
      
      const integrityEl = document.getElementById("system-integrity");
      integrityEl.textContent = `${systemIntegrity}%`;
      
      if (systemIntegrity > 50) {
        integrityEl.className = "security-high";
      } else if (systemIntegrity > 20) {
        integrityEl.className = "sys-msg text-alert";
      } else {
        integrityEl.className = "text-alert";
      }
      
      // Log penalty
      const penaltyLog = document.createElement("p");
      penaltyLog.className = "text-alert";
      penaltyLog.textContent = `[SYSTEM BREACHED] Intruder compromised core buffer. Integrity dropped by ${threat.risk}%!`;
      screen.appendChild(penaltyLog);
      screen.scrollTop = screen.scrollHeight;
      
      // Reset threat tracking
      clearActiveThreatState();
      
      if (systemIntegrity <= 0) {
        triggerSystemCollapse();
      }
    }, 2200);
    
  } else {
    // Normal routine traffic log
    const normalLogs = [
      `[ROUTING] VLAN_10 tag verification passed for host 10.0.10.${Math.floor(Math.random()*90)+10}`,
      `[SURICATA] Flow clean. Packet length ${Math.floor(Math.random()*500)+64} matching signature default`,
      `[OSPF] Neighbor state change: full convergence on router R2_DoomHQ`,
      `[WAZUH] Agent syslog integrity check: all files validated`,
      `[PORTWALL] Filtering traffic through secure tunnel. 0 drops.`
    ];
    
    const normalLog = document.createElement("p");
    normalLog.className = "sys-msg";
    normalLog.textContent = normalLogs[Math.floor(Math.random() * normalLogs.length)];
    screen.appendChild(normalLog);
    screen.scrollTop = screen.scrollHeight;
  }
}

function blockActiveThreat() {
  if (currentThreatIP === "") return; // No threat to block right now
  
  // Laser sound feedback
  Sound.play("laser");
  
  // Cancel threat trigger countdown
  clearTimeout(threatTimer);
  
  const screen = document.getElementById("terminal-output");
  
  // Visual block feedback in logs
  const blockMsg = document.createElement("p");
  blockMsg.className = "text-success";
  blockMsg.textContent = `[PORTWALL SHIELD] Successfully deployed Wazuh rules. Blocked IP: ${currentThreatIP}`;
  screen.appendChild(blockMsg);
  screen.scrollTop = screen.scrollHeight;
  
  // Increment stats
  blockedCount++;
  document.getElementById("blocked-count").textContent = blockedCount;
  
  // Reset threat tracking
  clearActiveThreatState();
  
  // Win condition: defend 10 threats
  if (blockedCount >= 10) {
    triggerSystemVictory();
  }
}

function clearActiveThreatState() {
  currentThreatIP = "";
  threatTimer = null;
  
  const cmdBtn = document.getElementById("terminal-game-btn");
  cmdBtn.textContent = "SCANNING NETGRID...";
  cmdBtn.className = "terminal-btn btn-glowing";
}

function triggerSystemCollapse() {
  gameActive = false;
  clearInterval(gameInterval);
  clearTimeout(threatTimer);
  
  Sound.play("error");
  
  const screen = document.getElementById("terminal-output");
  screen.innerHTML = `
    <h3 class="text-alert font-bold">!!! COLD SHUTDOWN COMPROMISED !!!</h3>
    <p class="text-alert">Latverian server core corrupted. Core integrity at 0%.</p>
    <p class="sys-msg">DOOMBOT RECLAMATION INITIATED...</p>
    <p class="sys-msg">// Reboot command console required.</p>
  `;
  screen.scrollTop = screen.scrollHeight;
  
  const cmdBtn = document.getElementById("terminal-game-btn");
  cmdBtn.textContent = "REBOOT MAIN CORE";
  cmdBtn.className = "terminal-btn btn-alert";
}

function triggerSystemVictory() {
  gameActive = false;
  clearInterval(gameInterval);
  clearTimeout(threatTimer);
  
  const screen = document.getElementById("terminal-output");
  screen.innerHTML = `
    <h3 class="text-success font-bold">=== SECURITY PERIMETER SECURED ===</h3>
    <p class="sys-msg">Defended 10 intrusions. Systems stabilized. Intruder packets dropped.</p>
    <p class="text-success">"No one compromises Doctor Doom's mainframe. Latveria prevails."</p>
    <p class="sys-msg">// Network Command Center standing by.</p>
  `;
  screen.scrollTop = screen.scrollHeight;
  
  const cmdBtn = document.getElementById("terminal-game-btn");
  cmdBtn.textContent = "SYSTEM STABLE - RESTART";
  cmdBtn.className = "terminal-btn";
}

function rebootSystem() {
  systemIntegrity = 100;
  blockedCount = 0;
  clearActiveThreatState();
  startSOCDefense();
}
