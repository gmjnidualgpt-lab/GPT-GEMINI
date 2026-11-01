# Most Nowy Cleaner Android

Native Android companion for local photo and video cleanup.

## Features
- Requests Android media permissions.
- Scans images and videos visible through MediaStore.
- Computes SHA-256 hashes and identifies byte-identical duplicate copies.
- Flags files at least 100 MB.
- Uses Android's system delete confirmation through MediaStore createDeleteRequest.
- Can clear only this app's own cache.
- Opens the Google Drive cleanup dashboard.

## Build
The GitHub Actions workflow `.github/workflows/build-cleaner-android.yml` builds a debug APK and publishes it as an Actions artifact.

Minimum Android version: Android 13 (API 33).

## Limits
- Android requires the user to grant photo/video access. If only selected media are granted, the scan is limited to that selection.
- Deletion requires the system confirmation dialog.
- A normal third-party app cannot silently clear cache or private data belonging to other apps.
- Google Photos cloud content is not directly scanned by this app. The user can use the Google Photos app's own management features.
