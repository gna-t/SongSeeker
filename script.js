const ITUNES_ENDPOINT = "https://itunes.apple.com/search";
const STORAGE_KEY = "songseeker-saved-songs";

const fallbackCatalog = {
  chill: [
    { title: "Sunset Lover", artist: "Petit Biscuit", genre: "electronic" },
    { title: "Show Me How", artist: "Men I Trust", genre: "indie" },
    { title: "Alaska", artist: "Maggie Rogers", genre: "indie" },
    { title: "Something About Us", artist: "Daft Punk", genre: "electronic" },
    { title: "Midnight City", artist: "M83", genre: "synth-pop" },
    { title: "Tadow", artist: "Masego", genre: "neo-soul" },
    { title: "Electric Feel", artist: "MGMT", genre: "indie" },
    { title: "Redbone", artist: "Childish Gambino", genre: "r-and-b" }
  ],
  gym: [
    { title: "POWER", artist: "Kanye West", genre: "hip-hop" },
    { title: "Stronger", artist: "Kanye West", genre: "hip-hop" },
    { title: "Titanium", artist: "David Guetta", genre: "dance" },
    { title: "Turn Down for What", artist: "DJ Snake", genre: "electronic" },
    { title: "Can't Hold Us", artist: "Macklemore & Ryan Lewis", genre: "hip-hop" },
    { title: "SICKO MODE", artist: "Travis Scott", genre: "hip-hop" },
    { title: "Till I Collapse", artist: "Eminem", genre: "rap" },
    { title: "Animals", artist: "Martin Garrix", genre: "dance" }
  ],
  focus: [
    { title: "Intro", artist: "The xx", genre: "ambient" },
    { title: "Awake", artist: "Tycho", genre: "electronic" },
    { title: "Experience", artist: "Ludovico Einaudi", genre: "classical" },
    { title: "Near Light", artist: "Ólafur Arnalds", genre: "classical" },
    { title: "A Walk", artist: "Tycho", genre: "electronic" },
    { title: "Holocene", artist: "Bon Iver", genre: "indie-folk" },
    { title: "Sun Models", artist: "ODESZA", genre: "electronic" },
    { title: "Nara", artist: "alt-J", genre: "indie" }
  ],
  sad: [
    { title: "Liability", artist: "Lorde", genre: "pop" },
    { title: "Someone Like You", artist: "Adele", genre: "pop" },
    { title: "Skinny Love", artist: "Bon Iver", genre: "indie-folk" },
    { title: "Motion Picture Soundtrack", artist: "Radiohead", genre: "alternative" },
    { title: "The Night We Met", artist: "Lord Huron", genre: "indie-folk" },
    { title: "Youth", artist: "Daughter", genre: "indie" },
    { title: "All I Want", artist: "Kodaline", genre: "indie" },
    { title: "when the party's over", artist: "Billie Eilish", genre: "pop" }
  ],
  party: [
    { title: "Levitating", artist: "Dua Lipa", genre: "pop" },
    { title: "Blinding Lights", artist: "The Weeknd", genre: "pop" },
    { title: "Don't Start Now", artist: "Dua Lipa", genre: "pop" },
    { title: "One Kiss", artist: "Calvin Harris", genre: "dance" },
    { title: "Yeah!", artist: "Usher", genre: "r-and-b" },
    { title: "Uptown Funk", artist: "Mark Ronson", genre: "funk" },
    { title: "Party Rock Anthem", artist: "LMFAO", genre: "dance" },
    { title: "We Found Love", artist: "Rihanna", genre: "dance" }
  ]
};

const vibeTags = {
  chill: ["dreamy", "warm", "late-night"],
  gym: ["adrenaline", "high-energy", "push"],
  focus: ["deep work", "steady", "clear"],
  sad: ["heartbreak", "tender", "rainy"],
  party: ["dancefloor", "bright", "weekend"]
};

const state = {
  currentVibe: "chill",
  currentPlaylist: [],
  currentSong: null,
  currentSeed: null,
  currentMode: "vibe",
  savedSongs: [],
  isPlaying: false,
  previewCache: new Map(),
  progressTimer: null,
  fakeElapsed: 0,
  currentDuration: 30,
  loadingToken: 0,
  preferences: {
    artists: {},
    genres: {},
    vibes: {}
  }
};

const audio = document.getElementById("audioPlayer");
const cassette = document.getElementById("cassette");
const loadingOverlay = document.getElementById("loadingOverlay");
const cassetteVibe = document.getElementById("cassetteVibe");
const trackTitle = document.getElementById("trackTitle");
const trackArtist = document.getElementById("trackArtist");
const trackMeta = document.getElementById("trackMeta");
const sourceBadge = document.getElementById("sourceBadge");
const genrePill = document.getElementById("genrePill");
const previewPill = document.getElementById("previewPill");
const recommendationReason = document.getElementById("recommendationReason");
const progressText = document.getElementById("progressText");
const savedGrid = document.getElementById("savedGrid");
const savedCount = document.getElementById("savedCount");
const playButton = document.getElementById("playButton");
const saveButton = document.getElementById("saveButton");
const volumeSlider = document.getElementById("volumeSlider");
const volumeValue = document.getElementById("volumeValue");

for (const button of document.querySelectorAll(".vibe-button")) {
  button.addEventListener("click", () => setVibe(button.dataset.vibe));
}

document.getElementById("randomButton").addEventListener("click", nextRandomSong);
document.getElementById("skipButton").addEventListener("click", skipCurrentSong);
document.getElementById("saveButton").addEventListener("click", saveCurrentSong);
document.getElementById("playButton").addEventListener("click", togglePlayback);
volumeSlider.addEventListener("input", handleVolumeChange);
savedGrid.addEventListener("click", handleSavedGridClick);

audio.addEventListener("timeupdate", syncAudioProgress);
audio.addEventListener("loadedmetadata", syncAudioProgress);
audio.addEventListener("ended", handleTrackEnded);
audio.addEventListener("pause", () => {
  if (!audio.ended && state.isPlaying && !state.progressTimer) {
    stopPlaybackVisuals();
  }
});

init();

async function init() {
  applyVolume(Number(volumeSlider.value));
  loadSavedSongs();
  rebuildPreferences();
  renderSavedSongs();
  await loadPlaylistForMode({ vibe: state.currentVibe, mode: "vibe" });
}

async function setVibe(vibe) {
  await loadPlaylistForMode({ vibe, mode: "vibe" });
}

async function loadPlaylistForMode({ vibe, mode, seedSong = null }) {
  state.currentVibe = vibe;
  state.currentMode = mode;
  state.currentSeed = seedSong;
  updateVibeButtons();
  const token = ++state.loadingToken;
  setLoading(true);
  cassette.classList.add("is-loading");
  stopAllPlayback(true);

  const pool = await buildPlaylist({ vibe, mode, seedSong });
  await wait(450);
  if (token !== state.loadingToken) {
    return;
  }

  state.currentPlaylist = shuffle(pool);
  setLoading(false);
  cassette.classList.remove("is-loading");
  await loadAndPlayRandomSong();
}

async function buildPlaylist({ vibe, mode, seedSong }) {
  const baseSongs = fallbackCatalog[vibe].map((song, index) => ({
    id: `${vibe}-${index}-${slugify(song.artist)}-${slugify(song.title)}`,
    title: song.title,
    artist: song.artist,
    genre: song.genre,
    vibe,
    tags: vibeTags[vibe],
    previewUrl: "",
    duration: 30,
    artwork: "",
    source: "demo mode"
  }));

  const enrichedSongs = await Promise.all(baseSongs.map((song) => enrichTrackWithPreview(song)));
  return filterPlaylistForMode(enrichedSongs, mode, seedSong, vibe);
}

async function enrichTrackWithPreview(song) {
  const cacheKey = `${song.artist}::${song.title}`.toLowerCase();
  if (state.previewCache.has(cacheKey)) {
    return { ...song, ...state.previewCache.get(cacheKey) };
  }

  try {
    const url = new URL(ITUNES_ENDPOINT);
    url.searchParams.set("term", `${song.artist} ${song.title}`);
    url.searchParams.set("entity", "song");
    url.searchParams.set("limit", "5");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`iTunes request failed with ${response.status}`);
    }

    const data = await response.json();
    const exactMatch = (data.results || []).find((result) => {
      const resultArtist = String(result.artistName || "").toLowerCase();
      const resultTrack = String(result.trackName || "").toLowerCase();
      return resultArtist.includes(song.artist.toLowerCase()) && resultTrack.includes(song.title.toLowerCase());
    });
    const result = exactMatch || data.results?.[0];

    const enriched = {
      previewUrl: result?.previewUrl || "",
      duration: result?.previewUrl && result?.trackTimeMillis
        ? Math.max(15, Math.round(result.trackTimeMillis / 1000))
        : 30,
      artwork: result?.artworkUrl100 || "",
      source: result?.previewUrl ? "preview available" : "demo mode"
    };

    state.previewCache.set(cacheKey, enriched);
    return { ...song, ...enriched };
  } catch (error) {
    console.warn("iTunes preview lookup failed, keeping demo mode.", error);
    const fallback = {
      previewUrl: "",
      duration: 30,
      artwork: "",
      source: "demo mode"
    };
    state.previewCache.set(cacheKey, fallback);
    return { ...song, ...fallback };
  }
}

function filterPlaylistForMode(playlist, mode, seedSong, vibe) {
  let filtered = [...playlist];

  if (mode === "similar" && seedSong) {
    filtered = filtered.filter((song) => (
      song.id !== seedSong.id && (song.genre === seedSong.genre || song.vibe === seedSong.vibe)
    ));
  }

  if (mode === "artist" && seedSong) {
    filtered = filtered.filter((song) => song.id !== seedSong.id && song.artist === seedSong.artist);
  }

  if (!filtered.length && seedSong && mode !== "vibe") {
    filtered = playlist.filter((song) => song.id !== seedSong.id);
  }

  return applyPreferenceBias(filtered, vibe, seedSong);
}

function applyPreferenceBias(playlist, vibe, seedSong) {
  return playlist.map((song) => {
    let score = 1;
    score += state.preferences.vibes[vibe] || 0;
    score += (state.preferences.genres[song.genre] || 0) * 1.2;
    score += (state.preferences.artists[song.artist] || 0) * 1.6;

    if (seedSong) {
      if (song.artist === seedSong.artist) {
        score += 4;
      }
      if (song.genre === seedSong.genre) {
        score += 2;
      }
      if (song.vibe === seedSong.vibe) {
        score += 1;
      }
    }

    return { ...song, score };
  });
}

function getRandomTrack() {
  if (!state.currentPlaylist.length) {
    return null;
  }

  const weightedPool = [];
  for (const song of state.currentPlaylist) {
    const copies = Math.max(1, Math.round(song.score || 1));
    for (let index = 0; index < copies; index += 1) {
      weightedPool.push(song);
    }
  }

  const randomSong = weightedPool[Math.floor(Math.random() * weightedPool.length)];
  state.currentPlaylist = state.currentPlaylist.filter((song) => song.id !== randomSong.id);
  return randomSong;
}

async function loadAndPlayRandomSong() {
  const nextTrack = getRandomTrack();
  if (!nextTrack) {
    if (state.currentMode === "vibe") {
      await loadPlaylistForMode({ vibe: state.currentVibe, mode: "vibe" });
      return;
    }
    renderEmptyState();
    return;
  }

  await setCurrentSong(nextTrack);
}

async function setCurrentSong(song) {
  stopAllPlayback(true);
  state.currentSong = song;
  renderSong(song, buildRecommendationReason(song));
  autoSpinOnLoad();
  await attemptAutoplay(song);
}

async function attemptAutoplay(song) {
  if (song.previewUrl) {
    audio.src = song.previewUrl;
    audio.currentTime = 0;
    try {
      await audio.play();
      startPlaybackVisuals();
      playButton.textContent = "pause";
      return;
    } catch (error) {
      console.warn("Autoplay blocked, waiting for user play.", error);
      stopPlaybackVisuals();
      playButton.textContent = "play preview";
      return;
    }
  }

  startSimulatedPlayback();
}

function togglePlayback() {
  if (!state.currentSong) {
    return;
  }

  if (state.isPlaying) {
    pauseCurrentPlayback();
    return;
  }

  if (state.currentSong.previewUrl) {
    audio.src = state.currentSong.previewUrl;
    audio.play()
      .then(() => {
        startPlaybackVisuals();
        playButton.textContent = "pause";
      })
      .catch(() => {
        startSimulatedPlayback();
      });
    return;
  }

  startSimulatedPlayback();
}

function pauseCurrentPlayback() {
  audio.pause();
  clearSimulatedPlayback();
  stopPlaybackVisuals();
  playButton.textContent = "play preview";
}

function stopAllPlayback(resetProgress = false) {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  clearSimulatedPlayback();
  stopPlaybackVisuals();
  playButton.textContent = "play preview";
  if (resetProgress) {
    updateTapeProgress(0, 0, state.currentDuration || 30);
  }
}

function startSimulatedPlayback() {
  clearSimulatedPlayback();
  state.fakeElapsed = 0;
  state.currentDuration = state.currentSong?.duration || 30;
  startPlaybackVisuals();
  playButton.textContent = "pause";

  state.progressTimer = window.setInterval(() => {
    state.fakeElapsed += 0.25;
    const progress = Math.min(state.fakeElapsed / state.currentDuration, 1);
    updateTapeProgress(progress, state.fakeElapsed, state.currentDuration);
    if (progress >= 1) {
      handleTrackEnded();
    }
  }, 250);
}

function clearSimulatedPlayback() {
  if (state.progressTimer) {
    window.clearInterval(state.progressTimer);
    state.progressTimer = null;
  }
}

function startPlaybackVisuals() {
  state.isPlaying = true;
  cassette.classList.add("is-playing");
}

function stopPlaybackVisuals() {
  state.isPlaying = false;
  cassette.classList.remove("is-playing");
}

function autoSpinOnLoad() {
  cassette.classList.add("is-playing");
  window.setTimeout(() => {
    if (!state.isPlaying) {
      cassette.classList.remove("is-playing");
    }
  }, 900);
}

function syncAudioProgress() {
  if (!audio.duration || Number.isNaN(audio.duration)) {
    return;
  }

  state.currentDuration = audio.duration;
  startPlaybackVisuals();
  updateTapeProgress(audio.currentTime / audio.duration, audio.currentTime, audio.duration);
}

function handleTrackEnded() {
  pauseCurrentPlayback();
  nextRandomSong();
}

function nextRandomSong() {
  loadAndPlayRandomSong();
}

function skipCurrentSong() {
  loadAndPlayRandomSong();
}

function saveCurrentSong() {
  if (!state.currentSong) {
    return;
  }

  const alreadySaved = state.savedSongs.some((song) => song.id === state.currentSong.id);
  if (alreadySaved) {
    return;
  }

  state.savedSongs.unshift({
    ...state.currentSong,
    savedAt: new Date().toLocaleString()
  });

  persistSavedSongs();
  rebuildPreferences();
  renderSavedSongs();
  renderSong(state.currentSong, `Saved because you liked ${state.currentSong.genre} in a ${state.currentSong.vibe} mood.`);
}

async function handleSavedGridClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const song = state.savedSongs.find((item) => item.id === button.dataset.songId);
  if (!song) {
    return;
  }

  if (button.dataset.action === "remove") {
    state.savedSongs = state.savedSongs.filter((item) => item.id !== song.id);
    persistSavedSongs();
    rebuildPreferences();
    renderSavedSongs();
    return;
  }

  if (button.dataset.action === "similar") {
    await loadPlaylistForMode({
      vibe: song.vibe,
      mode: "similar",
      seedSong: song
    });
  }

  if (button.dataset.action === "artist") {
    await randomizeArtist(song);
  }
}

async function randomizeArtist(savedSong) {
  setLoading(true);
  cassette.classList.add("is-loading");

  try {
    const artistSongs = await fetchTracksByArtist(savedSong.artist, savedSong);
    if (!artistSongs.length) {
      setLoading(false);
      cassette.classList.remove("is-loading");
      recommendationReason.textContent = `No extra tracks found for ${savedSong.artist} right now.`;
      return;
    }

    state.currentVibe = savedSong.vibe;
    state.currentMode = "artist";
    state.currentSeed = savedSong;
    updateVibeButtons();
    state.currentPlaylist = [];
    const randomSong = artistSongs[Math.floor(Math.random() * artistSongs.length)];
    await setCurrentSong(randomSong);
    renderSong(randomSong, `Because you liked ${savedSong.artist}.`);
  } finally {
    setLoading(false);
    cassette.classList.remove("is-loading");
  }
}

async function fetchTracksByArtist(artistName, seedSong) {
  const localMatches = dedupeByArtistTrack(
    Object.values(fallbackCatalog)
      .flat()
      .filter((song) => song.artist === artistName)
      .map((song, index) => ({
        id: `artist-local-${index}-${slugify(song.artist)}-${slugify(song.title)}`,
        title: song.title,
        artist: song.artist,
        genre: song.genre,
        vibe: guessVibeFromGenre(song.genre, seedSong.vibe),
        tags: vibeTags[guessVibeFromGenre(song.genre, seedSong.vibe)] || vibeTags[seedSong.vibe],
        previewUrl: "",
        duration: 30,
        artwork: "",
        source: "demo mode"
      }))
  ).filter((song) => song.id !== seedSong.id);

  try {
    const url = new URL(ITUNES_ENDPOINT);
    url.searchParams.set("term", artistName);
    url.searchParams.set("entity", "song");
    url.searchParams.set("attribute", "artistTerm");
    url.searchParams.set("limit", "25");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Artist lookup failed with ${response.status}`);
    }

    const data = await response.json();
    const apiSongs = dedupeByArtistTrack(
      (data.results || [])
        .filter((result) => String(result.artistName || "").toLowerCase() === artistName.toLowerCase())
        .map((result, index) => ({
          id: `artist-api-${index}-${slugify(result.artistName)}-${slugify(result.trackName)}`,
          title: result.trackName,
          artist: result.artistName,
          genre: result.primaryGenreName || seedSong.genre,
          vibe: guessVibeFromGenre(result.primaryGenreName || seedSong.genre, seedSong.vibe),
          tags: vibeTags[guessVibeFromGenre(result.primaryGenreName || seedSong.genre, seedSong.vibe)] || vibeTags[seedSong.vibe],
          previewUrl: result.previewUrl || "",
          duration: result.trackTimeMillis
            ? Math.max(15, Math.round(result.trackTimeMillis / 1000))
            : 30,
          artwork: result.artworkUrl100 || "",
          source: result.previewUrl ? "preview available" : "demo mode"
        }))
    ).filter((song) => song.title && song.id !== seedSong.id);

    return apiSongs.length ? apiSongs : localMatches;
  } catch (error) {
    console.warn("Artist randomizer failed, using local matches if available.", error);
    return localMatches;
  }
}

function renderSong(song, reason) {
  cassetteVibe.textContent = song.vibe;
  trackTitle.textContent = song.title;
  trackArtist.textContent = song.artist;
  trackMeta.textContent = `${song.genre} • ${song.previewUrl ? "real preview" : "demo mode"}`;
  sourceBadge.textContent = song.previewUrl ? "preview source" : "demo mode";
  genrePill.textContent = song.genre;
  previewPill.textContent = song.previewUrl ? "preview available" : "demo mode";
  recommendationReason.textContent = reason;
  saveButton.disabled = state.savedSongs.some((savedSong) => savedSong.id === song.id);
  saveButton.textContent = saveButton.disabled ? "saved" : "save";
  state.currentDuration = song.duration || 30;
  updateTapeProgress(0, 0, state.currentDuration);
}

function renderEmptyState() {
  cassetteVibe.textContent = state.currentVibe;
  trackTitle.textContent = "No songs left in this stack";
  trackArtist.textContent = "Load another vibe";
  trackMeta.textContent = "one song at a time";
  sourceBadge.textContent = "standby";
  genrePill.textContent = "waiting";
  previewPill.textContent = "standby";
  recommendationReason.textContent = "Try another vibe or revisit a saved song to keep digging.";
  saveButton.disabled = true;
  saveButton.textContent = "save";
  stopAllPlayback(true);
}

function renderSavedSongs() {
  savedCount.textContent = `${state.savedSongs.length} saved`;

  if (!state.savedSongs.length) {
    savedGrid.innerHTML = `
      <article class="empty-state">
        <h3>No saved songs yet</h3>
        <p>Save tracks you like, then use them to explore similar songs or random picks from the same artist.</p>
      </article>
    `;
    return;
  }

  savedGrid.innerHTML = state.savedSongs.map((song) => `
    <article class="saved-card">
      <h3>${escapeHtml(song.title)}</h3>
      <p>${escapeHtml(song.artist)}</p>
      <p>${escapeHtml(song.genre)} • ${escapeHtml(song.vibe)}</p>
      <p>${escapeHtml(song.previewUrl ? "preview ready" : "demo mode")}</p>
      <div class="saved-card-actions">
        <button type="button" data-action="similar" data-song-id="${escapeHtml(song.id)}">show more of this</button>
        <button type="button" data-action="artist" data-song-id="${escapeHtml(song.id)}">randomize this artist</button>
        <button type="button" data-action="remove" data-song-id="${escapeHtml(song.id)}">remove from saved</button>
      </div>
    </article>
  `).join("");
}

function buildRecommendationReason(song) {
  if (state.currentMode === "artist" && state.currentSeed) {
    return `Because you liked ${state.currentSeed.artist}.`;
  }

  if (state.currentMode === "similar" && state.currentSeed) {
    return `Because you saved ${state.currentSeed.genre} tracks from this vibe.`;
  }

  const favoriteGenre = getTopKey(state.preferences.genres);
  const favoriteArtist = getTopKey(state.preferences.artists);
  if (favoriteArtist && favoriteArtist !== song.artist) {
    return `Because you liked ${favoriteArtist} and adjacent sounds.`;
  }
  if (favoriteGenre) {
    return `Because you saved ${favoriteGenre} tracks.`;
  }
  return `More from this ${song.vibe} vibe.`;
}

function updateTapeProgress(progress, elapsedSeconds, totalSeconds) {
  document.documentElement.style.setProperty("--progress", `${Math.max(0, Math.min(progress, 1)) * 100}%`);
  document.documentElement.style.setProperty("--left-reel-scale", (1.08 - progress * 0.18).toFixed(3));
  document.documentElement.style.setProperty("--right-reel-scale", (0.9 + progress * 0.18).toFixed(3));
  progressText.textContent = `${formatTime(elapsedSeconds)} / ${formatTime(totalSeconds)}`;
}

function handleVolumeChange() {
  applyVolume(Number(volumeSlider.value));
}

function applyVolume(value) {
  const safeValue = Math.max(0, Math.min(value, 100));
  audio.volume = safeValue / 100;
  volumeValue.textContent = `${safeValue}%`;
}

function loadSavedSongs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    state.savedSongs = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    state.savedSongs = [];
  }
}

function persistSavedSongs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.savedSongs));
}

function rebuildPreferences() {
  state.preferences = { artists: {}, genres: {}, vibes: {} };
  for (const song of state.savedSongs) {
    incrementCount(state.preferences.artists, song.artist);
    incrementCount(state.preferences.genres, song.genre);
    incrementCount(state.preferences.vibes, song.vibe);
  }
}

function updateVibeButtons() {
  for (const button of document.querySelectorAll(".vibe-button")) {
    button.classList.toggle("active", button.dataset.vibe === state.currentVibe);
  }
}

function setLoading(isVisible) {
  loadingOverlay.classList.toggle("hidden", !isVisible);
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function incrementCount(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function getTopKey(map) {
  return Object.entries(map).sort((left, right) => right[1] - left[1])[0]?.[0] || "";
}

function dedupeByArtistTrack(songs) {
  const seen = new Set();
  return songs.filter((song) => {
    const key = `${song.artist}::${song.title}`.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function guessVibeFromGenre(genre, fallbackVibe = "chill") {
  const normalized = String(genre || "").toLowerCase();
  for (const [vibe, songs] of Object.entries(fallbackCatalog)) {
    if (songs.some((song) => song.genre === normalized)) {
      return vibe;
    }
  }
  return fallbackVibe;
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const remainder = String(total % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
