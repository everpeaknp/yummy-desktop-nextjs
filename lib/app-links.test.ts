import { afterEach, describe, expect, it } from "vitest";
import { GET as getAndroidAssociation } from "@/app/.well-known/assetlinks.json/route";
import { GET as getAppleAssociation } from "@/app/.well-known/apple-app-site-association/route";

const originalFingerprint =
  process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS;

afterEach(() => {
  if (originalFingerprint === undefined) {
    delete process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS;
  } else {
    process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS = originalFingerprint;
  }
});

describe("mobile app association documents", () => {
  it("serves the Yummy iOS join-path association", async () => {
    const response = getAppleAssociation();
    const document = await response.json();

    expect(response.headers.get("content-type")).toContain("application/json");
    expect(document.applinks.details[0]).toMatchObject({
      appIDs: ["3ANX28CC3Y.com.yummyever.mobile"],
      components: [{ "/": "/join" }],
    });
  });

  it("publishes only valid configured Android signing fingerprints", async () => {
    const validFingerprint = Array(32).fill("AA").join(":");
    process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS =
      `not-a-fingerprint,${validFingerprint}`;

    const response = getAndroidAssociation();
    const document = await response.json();

    expect(document).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.yummyever.yummy",
          sha256_cert_fingerprints: [validFingerprint],
        },
      },
    ]);
    expect(response.headers.get("X-Yummy-App-Link-Configuration")).toBeNull();
  });
});
