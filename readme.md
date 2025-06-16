# Bandcamp Wishlist Autoplayer

Automatically play tracks from your Bandcamp Wishlist with a handy popup interface.

---

## 🚀 Features

- ▶️ Manual track switching
- 🔁 Autoplay next tracks
- 🎵 Display of the current track
- 📃 Track list in the Popup (5 visible with scroll)
- 💬 Open the album of the current track

---

## 📦 Local Installation

1. Clone or download the repository:

```
git clone https://github.com/dfyz011/bandcamp-wishlist-autoplayer.git
```

2. Open Google Chrome and go to:

```
chrome://extensions/
```

3. Enable "Developer mode" (top right corner)
4. Click "Load unpacked"
5. Select the `bandcamp-wishlist-autoplayer/` project folder
6. ✅ Extension installed. Open your Bandcamp wishlist and test it out.

---

## 📤 How to Build a ZIP for Publishing

1. Make sure all necessary files are present in the project folder:

   - `manifest.json`
   - popup and content files
   - icons

2. Compress the **contents** of the folder (not the folder itself) into a ZIP archive:

**On Mac/Linux:**

```bash
cd bandcamp-wishlist-autoplayer
zip -r ../bandcamp-wishlist-autoplayer.zip .
```

**On Windows:**

- Select all files inside the folder → Right-click → "Send to → Compressed (zipped) folder"

3. Go to [Chrome Web Store Developer Dashboard](https://chromewebstore.google.com/) and upload the `.zip`

---

## 💡 Future Ideas

- Add support for album queue
- Dark theme support for popup

---
