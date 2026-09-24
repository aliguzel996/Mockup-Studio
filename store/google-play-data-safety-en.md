# Google Play Data safety draft

This is a submission draft based on source and manifest review for version 1.3.7 (versionCode 13007). Recheck it against the final Play Console form before submission.

## Recommended answers

- Does the app collect or share required user data with the developer? **No.**
- Is all user data encrypted in transit? **Not applicable to developer collection.** Website previews use the URL and transport selected by the user; Android cleartext traffic is disabled in the app manifest.
- Can users request deletion? **Local data is deleted by clearing app storage or uninstalling.** Android backup is disabled. Support-correspondence requests can be sent to hiycswu@gmail.com.
- Ads: **No ads and no advertising SDK.**
- Analytics: **No analytics or telemetry SDK.**
- Crash reporting: **No automatic crash-reporting SDK.**
- Account creation: **No account system.**

## Important website-preview disclosure

When the user enters a URL, Android WebView contacts that website directly. The site and its providers may receive ordinary network data such as IP address, user agent, cookies, and the requested URL under their own policies. This traffic is not sent to a YCSWU collection endpoint and is not used to create a developer profile. Re-evaluate the Play Console answer if future releases add proxy capture, cloud sync, analytics, accounts, crash reporting, advertising, or support uploads.

## Local data

Projects, saved devices, bookmarks, recent URLs, imported images, theme, language, and editor preferences are stored in the app's local WebView storage. Exports are written only when the user requests them.

## Permissions

- `android.permission.INTERNET`: required to open user-selected website previews.
- No camera, microphone, location, contacts, notification, advertising-ID, or broad storage permission is declared.
- File selection uses Android's system picker.
- Android 10+ export uses MediaStore Downloads; no broad storage permission is requested.
