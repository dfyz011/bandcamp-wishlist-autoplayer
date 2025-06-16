document.addEventListener("DOMContentLoaded", async () => {
	const autoplayToggle = document.getElementById("autoplay-toggle");
	const trackListEl = document.getElementById("track-list");
	const currentTitleEl = document.getElementById("current-title");
	const openAlbumBtn = document.getElementById("open-album");

	const playBtn = document.getElementById("play-track");
	const pauseBtn = document.getElementById("pause-track");
	const nextBtn = document.getElementById("next-track");
	const prevBtn = document.getElementById("prev-track");

	const tabSelect = document.getElementById("tab-select");

	function updatePlayPauseButtons(isPlaying) {
		playBtn.style.display = isPlaying ? "none" : "inline-block";
		pauseBtn.style.display = isPlaying ? "inline-block" : "none";
	}

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
			const noOption = document.createElement("option");
			noOption.disabled = true;
			noOption.selected = true;
			noOption.textContent = "Открой вкладку Bandcamp";
			tabSelect.appendChild(noOption);

			trackListEl.innerHTML = "<li>Вкладка Bandcamp не найдена</li>";
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

		chrome.tabs.sendMessage(tab.id, { type: "GET_TRACKS" }, (response) => {
			trackListEl.innerHTML = "";

			if (!response || !response.tracks || response.tracks.length === 0) {
				trackListEl.innerHTML = "<li>Нет треков</li>";
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
				li.textContent = `${index + 1} ${trackTitle} by ${artist}`;
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
					currentTitleEl.textContent = trackTitle;
				}
				trackListEl.appendChild(li);
			});
		});
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

	// --- INIT ---
	const selectedTab = await renderTabSelect();
	if (selectedTab) renderTrackList(selectedTab);
});
