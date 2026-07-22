# Restaurant join App Links

The Flutter app and this web application are configured for:

- `https://app.yummyever.com/join?code=...`
- Android package `com.yummyever.yummy`
- Apple application ID `3ANX28CC3Y.com.yummyever.mobile`

The web app serves both platform association documents directly, without a
redirect:

- `/.well-known/assetlinks.json`
- `/.well-known/apple-app-site-association`

## Required production configuration

Set `ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS` on the deployed Next.js server
to the uppercase SHA-256 fingerprint of the certificate that signs the app
installed on users' phones. Separate multiple fingerprints with commas or
semicolons. For Google Play App Signing, use the **App signing key certificate**
fingerprint from Play Console, not the upload-key fingerprint.

Optional overrides:

```env
ANDROID_APP_LINK_PACKAGE_NAME=com.yummyever.yummy
APPLE_APP_LINK_APPLICATION_ID=3ANX28CC3Y.com.yummyever.mobile
```

If the Android fingerprint is missing or malformed, `assetlinks.json` returns
an empty statement list and the response includes
`X-Yummy-App-Link-Configuration: missing-signing-fingerprint`. This prevents an
incorrect certificate from being presented as a working production setup.

After deployment, verify that both URLs return HTTP 200, JSON content, and no
redirect. Then test a newly installed signed Android/iOS build by opening a real
`/join?code=...` URL from the normal phone camera. Devices without the app keep
the web `/join` sign-in fallback.
