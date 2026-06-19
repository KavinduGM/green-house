# Installing the app on your phone

The file is **`dist/greenhouse-v1.0.apk`**.

## Get it onto the phone (any one)
- **USB:** connect the phone, copy `greenhouse-v1.0.apk` into its Downloads folder.
- **Cloud:** upload to Google Drive / send to yourself on WhatsApp/Telegram, open on the phone.
- **Email:** mail it to yourself and download the attachment on the phone.

## Install
1. Tap the `.apk` file (in Files / Downloads).
2. Android will ask to allow installing from this source → **Allow / Settings → enable**,
   then go back and tap **Install**.
3. Open **Greenhouse**.

## First run
1. **Server URL** — your VPS address, e.g. `http://203.0.113.10:8080`
   (or `https://greenhouse.yourdomain.com` if you set up HTTPS).
2. **Email / Password** — the `APP_EMAIL` / `APP_PASSWORD` from your backend `.env`.
3. Sign in. The URL and login are remembered.

## Notes
- This is a **debug-signed** build — perfect for personal use. Android may show a
  "not from Play Store" notice; that's expected for a sideloaded app.
- Camera permission is requested the first time you scan a diagram or a plant photo.
- To update later, rebuild with `./build-apk.sh` and reinstall the new APK over the old one.
- For a Play-Store / release-signed build, generate a keystore and run
  `./gradlew assembleRelease` — ask if you want that set up.
