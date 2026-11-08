const API_URL = "https://api.jikan.moe/v4/anime";
const SEARCH_DELAY = 250;
const API_TIMEOUT = 10000;
const RESULT_LIMIT = 12;
const API_CACHE_LIMIT = 50;

const mockAnime = [
  {
    title: "Frieren: Beyond Journey's End",
    title_english: "Frieren: Beyond Journey's End",
    year: 2023,
    type: "TV",
    score: 9.3,
    genres: [{ name: "Fantasy" }, { name: "Adventure" }],
    studios: [{ name: "Madhouse" }],
    synopsis: "A moving story about time and friendship that begins after the great adventure ends."
  },
  {
    title: "Jujutsu Kaisen",
    title_english: "Jujutsu Kaisen",
    year: 2020,
    type: "TV",
    score: 8.6,
    genres: [{ name: "Action" }, { name: "Supernatural" }],
    studios: [{ name: "MAPPA" }],
    synopsis: "A young sorcerer's dangerous fight in a world filled with curses."
  },
  {
    title: "Your Name",
    title_english: "Your Name",
    year: 2016,
    type: "Movie",
    score: 8.8,
    genres: [{ name: "Romance" }, { name: "Supernatural" }],
    studios: [{ name: "CoMix Wave Films" }],
    synopsis: "Two teenagers who have never met are brought together by a mysterious connection."
  },
  {
    title: "Demon Slayer",
    title_english: "Demon Slayer",
    year: 2019,
    type: "TV",
    score: 8.7,
    genres: [{ name: "Action" }, { name: "Fantasy" }],
    studios: [{ name: "ufotable" }],
    synopsis: "Tanjiro enters the world of demon slayers to save his family."
  },
  {
    title: "Violet Evergarden",
    title_english: "Violet Evergarden",
    year: 2018,
    type: "TV",
    score: 8.9,
    genres: [{ name: "Drama" }],
    studios: [{ name: "Kyoto Animation" }],
    synopsis: "After the war, Violet learns to put people's feelings into letters."
  },
  {
    title: "Spy x Family",
    title_english: "Spy x Family",
    year: 2022,
    type: "TV",
    score: 8.5,
    genres: [{ name: "Comedy" }, { name: "Action" }],
    studios: [{ name: "Wit Studio" }, { name: "CloverWorks" }],
    synopsis: "A family of strangers with secret identities grows closer while trying to save the world."
  },
  {
    title: "Attack on Titan",
    title_english: "Attack on Titan",
    year: 2013,
    type: "TV",
    score: 9.1,
    genres: [{ name: "Action" }, { name: "Drama" }],
    studios: [{ name: "Wit Studio" }],
    synopsis: "Humanity fights for survival behind enormous walls."
  },
  {
    title: "A Silent Voice",
    title_english: "A Silent Voice",
    year: 2016,
    type: "Movie",
    score: 8.9,
    genres: [{ name: "Drama" }],
    studios: [{ name: "Kyoto Animation" }],
    synopsis: "A heartfelt story about a young man trying to make amends for his past."
  }
];

const searchInput = document.querySelector("#anime-search");
const animeGrid = document.querySelector("#anime-list");
const resultCount = document.querySelector("#result-count");
const emptyState = document.querySelector("#empty-state");
const emptyStateTitle = emptyState.querySelector("h3");
const emptyStateMessage = emptyState.querySelector("p");
const emptyIcon = emptyState.querySelector(".empty-icon");
const loadingSpinner = emptyState.querySelector(".loading-spinner");

let searchTimeout;
let activeController;
let searchId = 0;
const animeCache = new Map();

function clearLoadingState() {
  emptyState.classList.remove("is-loading");
  emptyIcon.hidden = false;
  loadingSpinner.hidden = true;
}

function setEmptyState(title, message) {
  clearLoadingState();
  emptyStateTitle.textContent = title;
  emptyStateMessage.textContent = message;
  emptyState.hidden = false;
}

function setLoadingState() {
  emptyState.classList.add("is-loading");
  emptyIcon.hidden = true;
  loadingSpinner.hidden = false;
  emptyStateTitle.textContent = "Searching Jikan...";
  emptyStateMessage.textContent = "Fetching anime results.";
  emptyState.hidden = false;
}

function normalizeQuery(query) {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function cacheAnimeResults(query, anime) {
  const key = normalizeQuery(query);
  animeCache.delete(key);
  animeCache.set(key, anime);

  if (animeCache.size > API_CACHE_LIMIT) {
    const oldestKey = animeCache.keys().next().value;
    animeCache.delete(oldestKey);
  }
}

function showCachedResults(query) {
  const key = normalizeQuery(query);
  if (!animeCache.has(key)) {
    return false;
  }

  const anime = animeCache.get(key);
  animeCache.delete(key);
  animeCache.set(key, anime);
  showAnimeResults(anime, query);
  return true;
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function renderAnime(anime, index) {
  const card = document.createElement("article");
  card.className = "anime-card";

  const poster = document.createElement("div");
  poster.className = `poster poster-${(index % 8) + 1}`;

  const imageUrl = anime.images?.webp?.large_image_url
    || anime.images?.jpg?.large_image_url
    || anime.images?.webp?.image_url
    || anime.images?.jpg?.image_url;

  if (imageUrl) {
    const image = document.createElement("img");
    image.className = "poster-image";
    image.src = imageUrl;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => image.remove(), { once: true });
    poster.classList.add("has-image");
    poster.append(image);
  }

  const posterTitle = createTextElement(
    "span",
    "poster-title",
    anime.title_english || anime.title || "Untitled anime"
  );
  poster.append(posterTitle);

  const cardContent = document.createElement("div");
  cardContent.className = "card-content";

  const cardTopline = document.createElement("div");
  cardTopline.className = "card-topline";
  const genres = anime.genres?.map((genre) => genre.name).filter(Boolean).join(" · ");
  cardTopline.append(
    createTextElement("span", "genre-tag", genres || anime.type || "Anime"),
    createTextElement("span", "anime-year", anime.year ?? "Year unknown")
  );

  const title = createTextElement(
    "h3",
    "anime-title",
    anime.title_english || anime.title || "Untitled anime"
  );
  const description = createTextElement(
    "p",
    "anime-description",
    anime.synopsis || "No synopsis available."
  );

  const cardFooter = document.createElement("div");
  cardFooter.className = "card-footer";
  const studios = anime.studios?.map((studio) => studio.name).filter(Boolean).join(", ");
  const studio = createTextElement("span", "", studios || "Studio unknown");
  const score = Number.isFinite(anime.score) ? anime.score.toFixed(1) : "N/A";
  const rating = createTextElement("span", "rating", `★ ${score}`);
  rating.setAttribute("aria-label", `Rating ${score}`);
  cardFooter.append(studio, rating);

  cardContent.append(cardTopline, title, description, cardFooter);
  card.append(poster, cardContent);
  return card;
}

function showAnimeResults(anime, query) {
  clearLoadingState();
  animeGrid.replaceChildren(...anime.map(renderAnime));
  animeGrid.setAttribute("aria-busy", "false");

  if (anime.length === 0) {
    resultCount.textContent = "0 anime found";
    setEmptyState("No anime found", "Try another title or check your spelling.");
    return;
  }

  emptyState.hidden = true;
  resultCount.textContent = `${anime.length} anime found for "${query}"`;
}

function showMockResults(query) {
  clearLoadingState();
  const normalizedQuery = query.toLocaleLowerCase("en-US");
  const matches = mockAnime.filter((anime) => {
    const searchableText = [
      anime.title,
      anime.title_english,
      anime.year,
      anime.type,
      anime.synopsis,
      ...anime.genres.map((genre) => genre.name),
      ...anime.studios.map((studio) => studio.name)
    ].join(" ").toLocaleLowerCase("en-US");

    return searchableText.includes(normalizedQuery);
  });

  animeGrid.replaceChildren(...matches.map(renderAnime));
  animeGrid.setAttribute("aria-busy", "false");

  if (matches.length === 0) {
    resultCount.textContent = "0 anime found";
    setEmptyState("No anime found", "Try another title or check your spelling.");
    return;
  }

  emptyState.hidden = true;
  resultCount.textContent = `${matches.length} local anime found for "${query}"`;
}

function showSearchError(message) {
  clearLoadingState();
  animeGrid.replaceChildren();
  animeGrid.setAttribute("aria-busy", "false");
  resultCount.textContent = "Search unavailable";
  setEmptyState("Unable to load anime", message);
}

async function searchAnime(query, requestId) {
  if (requestId !== searchId || showCachedResults(query)) {
    return;
  }

  const controller = new AbortController();
  activeController = controller;
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API_TIMEOUT);

  try {
    const params = new URLSearchParams({
      q: query,
      limit: String(RESULT_LIMIT),
      sfw: "true"
    });
    const response = await fetch(`${API_URL}?${params}`, {
      signal: controller.signal
    });
    console.info("Jikan API response:", response.status, response.statusText);

    if (!response.ok) {
      const message = response.status === 429
        ? "Too many searches. Please wait a moment and try again."
        : `Jikan API request failed (${response.status}). Please try again.`;
      if (requestId === searchId) {
        console.error("Jikan API returned an unsuccessful status:", response.status, response.statusText);
        showSearchError(message);
      }
      return;
    }

    const payload = await response.json();
    if (!Array.isArray(payload.data)) {
      if (requestId === searchId) {
        console.error("Jikan API returned an unexpected payload:", payload);
        showSearchError("The Jikan API returned an unexpected response. Please try again.");
      }
      return;
    }
    if (requestId === searchId) {
      console.info("Jikan API anime results:", payload.data.length);
      cacheAnimeResults(query, payload.data);
      showAnimeResults(payload.data, query);
    }
  } catch (error) {
    if (requestId !== searchId || (error.name === "AbortError" && !timedOut)) {
      return;
    }

    if (timedOut || error instanceof TypeError) {
      console.warn("API'ye ulaşılamadı, yerel veriler gösteriliyor", {
        reason: timedOut ? "Request timed out" : "Network error",
        error
      });
      showMockResults(query);
    } else {
      console.error("Jikan API response could not be processed:", error);
      showSearchError(error.message || "The API response could not be processed. Please try again.");
    }
  } finally {
    clearTimeout(timeoutId);
    if (activeController === controller) {
      activeController = null;
    }
  }
}

function handleSearchInput() {
  const query = searchInput.value.trim();
  searchId += 1;
  const currentSearchId = searchId;
  clearTimeout(searchTimeout);
  activeController?.abort();

  animeGrid.replaceChildren();

  if (!query) {
    animeGrid.setAttribute("aria-busy", "false");
    resultCount.textContent = "";
    setEmptyState("Search for an anime to get started", "Results will appear here as you search.");
    return;
  }

  if (showCachedResults(query)) {
    return;
  }

  animeGrid.setAttribute("aria-busy", "true");
  resultCount.textContent = "Searching...";
  setLoadingState();
  searchTimeout = setTimeout(() => searchAnime(query, currentSearchId), SEARCH_DELAY);
}

searchInput.addEventListener("input", handleSearchInput);
handleSearchInput();
