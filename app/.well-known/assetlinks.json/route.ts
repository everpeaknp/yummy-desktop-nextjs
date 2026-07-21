const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/i;

function signingFingerprints() {
  return (process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS || "")
    .split(/[;,\n]/)
    .map((value) => value.trim().toUpperCase())
    .filter((value) => fingerprintPattern.test(value));
}

/** Android Digital Asset Links association for restaurant join links. */
export function GET() {
  const fingerprints = signingFingerprints();
  const statements = fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name:
              process.env.ANDROID_APP_LINK_PACKAGE_NAME?.trim()
              || "com.yummyever.yummy",
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ]
    : [];

  return Response.json(statements, {
    headers: {
      "Cache-Control": fingerprints.length
        ? "public, max-age=3600, s-maxage=86400"
        : "public, max-age=60, s-maxage=300",
      // Makes a missing production fingerprint obvious during deployment
      // checks while keeping the response valid Digital Asset Links JSON.
      ...(fingerprints.length
        ? {}
        : { "X-Yummy-App-Link-Configuration": "missing-signing-fingerprint" }),
    },
  });
}
