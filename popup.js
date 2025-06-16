document.addEventListener("DOMContentLoaded", () => {
	const autoplayToggle = document.getElementById("autoplay-toggle");
	const trackListEl = document.getElementById("track-list");
	const currentTitleEl = document.getElementById("current-title");
	const openAlbumBtn = document.getElementById("open-album");

	const playBtn = document.getElementById("play-track");
	const pauseBtn = document.getElementById("pause-track");

	function updatePlayPauseButtons(isPlaying) {
		playBtn.style.display = isPlaying ? "none" : "inline-block";
		pauseBtn.style.display = isPlaying ? "inline-block" : "none";
	}

	const nextBtn = document.getElementById("next-track");
	const prevBtn = document.getElementById("prev-track");

	// Get autoplay preference
	chrome.storage.sync.get(["autoplayEnabled"], (result) => {
		autoplayToggle.checked = result.autoplayEnabled || false;
	});

	// Toggle autoplay
	autoplayToggle.addEventListener("change", () => {
		chrome.storage.sync.set({ autoplayEnabled: autoplayToggle.checked });
	});

	function controlMessage(type, callbackAfter = null) {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			chrome.tabs.sendMessage(tabs[0].id, { type }, () => {
				if (callbackAfter) callbackAfter(tabs[0]);
			});
		});
	}

	function renderTrackList(tab) {
		chrome.tabs.sendMessage(tab.id, { type: "GET_TRACKS" }, (response) => {
			trackListEl.innerHTML = "";
			if (!response || !response.tracks || response.tracks.length === 0) {
				trackListEl.innerHTML = "<li>Нет треков</li>";
				updatePlayPauseButtons(false);
				return;
			}

			// 👇 Обновить отображение кнопок на основе состояния плеера
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
							index: index,
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

	playBtn.addEventListener("click", () => {
		controlMessage("PLAY", (tab) => {
			updatePlayPauseButtons(true);
			renderTrackList(tab);
		});
	});
	pauseBtn.addEventListener("click", () => {
		controlMessage("PAUSE", () => {
			updatePlayPauseButtons(false);
		});
	});
	nextBtn.addEventListener("click", () =>
		controlMessage("NEXT_TRACK", renderTrackList)
	);
	prevBtn.addEventListener("click", () =>
		controlMessage("PREV_TRACK", renderTrackList)
	);
	// openAlbumBtn.addEventListener("click", () => controlMessage("OPEN_ALBUM"));

	// Initial render
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		renderTrackList(tabs[0]);
	});
});
