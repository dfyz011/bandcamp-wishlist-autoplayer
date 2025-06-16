// --- STORAGE UTILS ---
async function getSelectedTabId() {
	return new Promise((resolve) =>
		chrome.storage.local.get(["selectedTabId"], (res) =>
			resolve(res.selectedTabId)
		)
	);
}

async function setSelectedTabId(tabId) {
	return new Promise((resolve) =>
		chrome.storage.local.set({ selectedTabId: tabId }, resolve)
	);
}

async function getCurrentLang() {
	return new Promise((resolve) =>
		chrome.storage.local.get(["lang"], (res) => resolve(res.lang || "en"))
	);
}

// --- TAB UTILS ---
async function getBandcampTabs() {
	return new Promise((resolve) => {
		chrome.tabs.query({}, (tabs) => {
			const bandcampTabs = tabs.filter((tab) =>
				tab.url?.includes("bandcamp.com")
			);
			resolve(bandcampTabs);
		});
	});
}

document.addEventListener("DOMContentLoaded", async () => {
	const autoplayToggle = document.getElementById("autoplay-toggle");
	const trackListEl = document.getElementById("track-list");

	const currentCoverEl = document.getElementById("current-cover");
	const currentTitleEl = document.getElementById("current-title");
	const openAlbumBtn = document.getElementById("open-album");

	const playBtn = document.getElementById("play-track");
	const pauseBtn = document.getElementById("pause-track");
	const nextBtn = document.getElementById("next-track");
	const prevBtn = document.getElementById("prev-track");

	const tabSelect = document.getElementById("tab-select");

	const langButtons = {
		en: document.getElementById("lang-en"),
		ru: document.getElementById("lang-ru"),
	};
	const i18n = {
		en: {
			autoplay: "🔁 Autoplay next albums",
			currentTrack: "Current track:",
			loading: "Loading tracks...",
			noTracks: "No tracks",
			prev: "Previous track",
			pause: "Pause",
			play: "Play",
			next: "Next track",
			selectTabPlaceholder: "Select Bandcamp tab",
		},
		ru: {
			autoplay: "🔁 Автоплей следующих альбомов",
			currentTrack: "Текущий трек:",
			loading: "Загрузка треков...",
			noTracks: "Нет треков",
			prev: "Предыдущий трек",
			pause: "Пауза",
			play: "Старт",
			next: "Следующий трек",
			selectTabPlaceholder: "Выберите вкладку Bandcamp",
		},
	};

	const lang = await getCurrentLang();
	trackListEl.innerHTML = `<li>${i18n[lang].loading}</li>`;

	function updatePlayPauseButtons(isPlaying) {
		playBtn.style.display = isPlaying ? "none" : "inline-block";
		pauseBtn.style.display = isPlaying ? "inline-block" : "none";
	}

	// --- TAB UTILS ---
	async function getValidSelectedTab(tabs) {
		const selectedTabId = await getSelectedTabId();
		const found = tabs.find((tab) => tab.id === selectedTabId);
		if (found) return found;

		if (tabs.length > 0) {
			await setSelectedTabId(tabs[0].id);
			return tabs[0];
		}

		return null;
	}

	// --- SELECT RENDERING ---
	async function renderTabSelect() {
		console.debug("Bandcamp autoplayer popup: renderTabSelect");

		const tabs = await getBandcampTabs();

		tabSelect.innerHTML = "";

		if (tabs.length === 0) {
			const lang = await getCurrentLang();
			const noOption = document.createElement("option");
			noOption.disabled = true;
			noOption.selected = true;
			noOption.textContent = i18n[lang].selectTabPlaceholder;
			tabSelect.appendChild(noOption);

			trackListEl.innerHTML = `<li>${i18n[lang].noTracks}</li>`;

			updatePlayPauseButtons(false);
			return null;
		}

		tabs.forEach((tab) => {
			const option = document.createElement("option");
			option.value = tab.id;
			option.textContent = tab.url;
			tabSelect.appendChild(option);
		});

		const selectedTab = await getValidSelectedTab(tabs);
		if (selectedTab) {
			tabSelect.value = selectedTab.id;
		}

		return selectedTab;
	}

	tabSelect.addEventListener("change", async () => {
		await setSelectedTabId(parseInt(tabSelect.value, 10));
		const selectedTab = await getValidSelectedTab(await getBandcampTabs());
		if (selectedTab) renderTrackList(selectedTab);
	});

	// --- MESSAGE UTILS ---
	async function controlMessage(type, callbackAfter = null) {
		const tabs = await getBandcampTabs();
		const tab = await getValidSelectedTab(tabs);
		if (!tab) return;

		chrome.tabs.sendMessage(tab.id, { type }, () => {
			if (callbackAfter) callbackAfter(tab);
		});
	}

	// --- TRACK RENDERING ---
	async function renderTrackList(tab) {
		renderTabSelect(); // обновим список вкладок каждый раз

		chrome.tabs.sendMessage(
			tab.id,
			{ type: "GET_TRACKS" },
			async (response) => {
				trackListEl.innerHTML = "";

				if (!response || !response.tracks || response.tracks.length === 0) {
					const lang = await getCurrentLang();
					trackListEl.innerHTML = `<li>${i18n[lang].noTracks}</li>`;
					updatePlayPauseButtons(false);
					return;
				}

				// Обновить отображение кнопок на основе состояния плеера
				updatePlayPauseButtons(response.isPlaying);

				response.tracks.forEach((track, index) => {
					const {
						trackId,
						itemId,
						itemType, // "album" или "track"
						albumTitle,
						artist,
						trackTitle,
						albumUrl,
						coverUrl,
					} = track;
					const li = document.createElement("li");

					const img = document.createElement("img");
					img.src = coverUrl || "";
					img.alt = "cover";
					img.className = "track-cover";
					li.appendChild(img);

					const span = document.createElement("span");
					span.textContent = `${index + 1} ${trackTitle} by ${artist}`;
					li.appendChild(span);
					li.addEventListener("click", () => {
						chrome.tabs.sendMessage(
							tab.id,
							{
								type: "PLAY_TRACK_INDEX",
								index,
							},
							() => renderTrackList(tab)
						);
					});
					if (response.currentIndex === index) {
						li.classList.add("playing");
						currentTitleEl.textContent = `${trackTitle} by ${artist}`;

						if (coverUrl) {
							currentCoverEl.src = coverUrl;
							currentCoverEl.style.display = "block";
						} else {
							currentCoverEl.style.display = "none";
						}
					}
					trackListEl.appendChild(li);
				});
			}
		);
	}

	// --- BUTTON HANDLERS ---
	playBtn.addEventListener("click", () =>
		controlMessage("PLAY", (tab) => {
			updatePlayPauseButtons(true);
			renderTrackList(tab);
		})
	);

	pauseBtn.addEventListener("click", () =>
		controlMessage("PAUSE", () => updatePlayPauseButtons(false))
	);

	nextBtn.addEventListener("click", () =>
		controlMessage("NEXT_TRACK", renderTrackList)
	);
	prevBtn.addEventListener("click", () =>
		controlMessage("PREV_TRACK", renderTrackList)
	);
	// openAlbumBtn.addEventListener("click", () => controlMessage("OPEN_ALBUM"));

	// Get autoplay preference
	chrome.storage.sync.get(["autoplayEnabled"], (result) => {
		autoplayToggle.checked = result.autoplayEnabled || false;
	});

	// Toggle autoplay
	autoplayToggle.addEventListener("change", () => {
		chrome.storage.sync.set({ autoplayEnabled: autoplayToggle.checked });
	});

	function setLanguage(lang) {
		// Сохраняем в хранилище
		chrome.storage.local.set({ lang });

		// Активная кнопка
		Object.keys(langButtons).forEach((key) => {
			langButtons[key].classList.toggle("active", key === lang);
		});

		const currentLanguage = i18n[lang];

		document.querySelector(".toggle").lastChild.textContent =
			" " + currentLanguage.autoplay;
		document.querySelector(".label").textContent = currentLanguage.currentTrack;
		document.getElementById("prev-track").title = currentLanguage.prev;
		document.getElementById("pause-track").title = currentLanguage.pause;
		document.getElementById("play-track").title = currentLanguage.play;
		document.getElementById("next-track").title = currentLanguage.next;

		// Можно также обновить список треков, если он локализуемый
	}

	Object.entries(langButtons).forEach(([lang, button]) => {
		button.addEventListener("click", () => setLanguage(lang));
	});

	// --- INIT ---
	chrome.storage.local.get(["lang"], (res) => {
		const lang = res.lang || "en";
		setLanguage(lang);
	});
	const selectedTab = await renderTabSelect();
	if (selectedTab) renderTrackList(selectedTab);
});
