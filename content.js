function getAudioElement() {
	return document.querySelector("audio");
}

function getTrackIdFromAudio(audio) {
	try {
		const url = new URL(audio.src);
		return url.searchParams.get("track_id");
	} catch (e) {
		return null;
	}
}

function getAllTrackLinks() {
	return [...document.querySelectorAll("a[data-trackid]")];
}

function playTrackByIndex(index) {
	const tracks = getAllTrackLinks();
	if (tracks[index]) {
		tracks[index].click();
	}
}

function getAllTracksLi() {
	return [...document.querySelectorAll("li[data-trackid]")];
}

function extractTrackOrAlbumInfo(li) {
	if (!li) return null;

	const trackId = li.dataset.trackid || null;
	const itemId = li.dataset.itemid || null;
	const itemType = li.dataset.itemtype || null;
	const albumTitle =
		li.querySelector(".collection-item-title")?.textContent?.trim() || null;
	const artist =
		li
			.querySelector(".collection-item-artist")
			?.textContent?.replace(/^by\s+/, "")
			.trim() || null;
	const albumUrl =
		li.querySelector(".collection-title-details a.item-link")?.href || null;
	const coverUrl = li.querySelector("img.collection-item-art")?.src || null;

	// Fallback: если fav-track-link нет, возьми title напрямую
	const trackTitle =
		li.querySelector(".fav-track-link")?.textContent?.trim() ||
		li.querySelector(".collection-item-title")?.textContent?.trim() ||
		null;

	return {
		trackId,
		itemId,
		itemType, // "album" или "track"
		albumTitle,
		artist,
		trackTitle,
		albumUrl,
		coverUrl,
	};
}

// data-collect-item кодирует тип объекта, который воспроизводится в данный момент:
// - t + track_id → пользователь кликнул по отдельному треку
// - a + album_id → пользователь кликнул по альбому, и проигрывается "featured track"
function getCurrentCollectItemType() {
	const el = document.querySelector(
		"#carousel-player .item-collection-controls"
	);
	if (!el) return null;

	const collectItem = el.getAttribute("data-collect-item");
	if (!collectItem) return null;

	if (collectItem.startsWith("a")) return "album";
	if (collectItem.startsWith("t")) return "track";

	return null;
}

function getCurrentTrackIndex() {
	const audio = getAudioElement();
	const currentTrackId = getTrackIdFromAudio(audio);
	const type = getCurrentCollectItemType();
	if (!currentTrackId || !type) return null;

	const tracks = getAllTracksLi();

	return tracks.findIndex(
		(el) =>
			el.dataset.trackid === currentTrackId && el.dataset.itemtype === type
	);
}

function autoPlayNextTrack() {
	console.debug("Bandcamp autoplayer: autoPlayNextTrack");
	chrome.storage.sync.get(["autoplayEnabled"], (result) => {
		console.debug("Bandcamp autoplayer: get autoplayEnabled", result);
		if (!result.autoplayEnabled) return;
		playNextTrack();
	});
}

function playNextTrack() {
	console.debug("Bandcamp autoplayer: playNextTrack");
	const currentIndex = getCurrentTrackIndex();
	playTrackByIndex(currentIndex + 1);
}

function playPrevTrack() {
	const currentIndex = getCurrentTrackIndex();
	if (currentIndex > 0) {
		playTrackByIndex(currentIndex - 1);
	}
}

function openCurrentAlbum() {
	const currentTrack = getAllTrackLinks()[getCurrentTrackIndex()];
	if (currentTrack) {
		const albumUrl = currentTrack.href.split("?")[0];
		window.open(albumUrl, "_blank");
	}
}

function bindAudioEvents(audio) {
	if (!audio.__autoplayerBound) {
		console.debug("Bandcamp autoplayer: binding ended event");
		audio.addEventListener("ended", autoPlayNextTrack);
		audio.__autoplayerBound = true; // флаг, чтобы не дублировать
	}
}

function observeAudioElement() {
	const existing = getAudioElement();
	if (existing) {
		bindAudioEvents(existing);
		return; // уже есть — не наблюдаем
	}

	const observer = new MutationObserver(() => {
		const audio = getAudioElement();
		if (audio) {
			bindAudioEvents(audio);
			observer.disconnect();
		}
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true,
	});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	console.debug("Bandcamp autoplayer: onMessage", msg);

	if (msg.type === "GET_TRACKS") {
		const currentIndex = getCurrentTrackIndex();
		const tracks = getAllTracksLi().map((el) => ({
			...extractTrackOrAlbumInfo(el),
		}));
		const audio = getAudioElement();
		const isPlaying = !audio.paused && !audio.ended;
		sendResponse({ tracks, currentIndex, isPlaying });
	} else if (msg.type === "NEXT_TRACK") {
		playNextTrack();
	} else if (msg.type === "PREV_TRACK") {
		playPrevTrack();
	} else if (msg.type === "PLAY_TRACK_INDEX") {
		playTrackByIndex(msg.index);
		observeAudioElement(); // на случай, если audio пересоздали
	} else if (msg.type === "PLAY") {
		const audio = getAudioElement();
		const hasTrack = audio && !!audio.src;
		if (hasTrack) {
			audio?.play();
		} else {
			playTrackByIndex(0);
			observeAudioElement(); // на случай, если audio пересоздали
		}
	} else if (msg.type === "PAUSE") {
		const audio = getAudioElement();
		const hasTrack = audio && !!audio.src;
		if (hasTrack) {
			audio?.pause();
		}
	} else if (msg.type === "OPEN_ALBUM") {
		openCurrentAlbum();
	}
});

function setup() {
	console.debug("Bandcamp autoplayer: setup");
	const audio = getAudioElement();
	if (audio) {
		bindAudioEvents(audio);
	} else {
		observeAudioElement();
	}
}

setup();
