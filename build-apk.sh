#!/usr/bin/env bash
# Rebuild the Android APK after changing the app.
# Uses the local toolchain installed under ~/gh-toolchain and ~/Library/Android/sdk.
set -e
cd "$(dirname "$0")"

export JAVA_HOME="$HOME/gh-toolchain/jdk-17.0.19+10/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

echo "▶ Building web app…"
( cd app && npm run build )

echo "▶ Syncing to Android…"
( cd app && npx cap sync android )

echo "▶ Assembling APK…"
( cd app/android && ./gradlew assembleDebug --no-daemon )

mkdir -p dist
cp app/android/app/build/outputs/apk/debug/app-debug.apk dist/greenhouse-v1.0.apk
echo "✅ APK ready: dist/greenhouse-v1.0.apk"
