import packageJson from "../package.json";

/** GitHub Releases — latest Yummy POS Windows installers. */
export const DESKTOP_APP_GITHUB_REPO = "everpeaknp/yummy-desktop-nextjs";

export const DESKTOP_APP_RELEASES_URL =
  `https://github.com/${DESKTOP_APP_GITHUB_REPO}/releases/latest`;

/**
 * GitHub Release tag (e.g. v0.1.5). Tag and installer version can differ on older builds.
 * Override via NEXT_PUBLIC_DESKTOP_RELEASE_TAG when pinning a release.
 */
export const DESKTOP_RELEASE_TAG =
  process.env.NEXT_PUBLIC_DESKTOP_RELEASE_TAG ?? "v0.1.5";

/**
 * Version in Yummy.POS.Setup.{version}.exe (from package.json at build time).
 * Override via NEXT_PUBLIC_DESKTOP_SETUP_VERSION if needed.
 */
export const DESKTOP_SETUP_VERSION =
  process.env.NEXT_PUBLIC_DESKTOP_SETUP_VERSION ?? packageJson.version;

export function getDesktopSetupArtifactName(version?: string): string {
  const v = (version ?? DESKTOP_SETUP_VERSION).trim() || "0.1.0";
  return `Yummy.POS.Setup.${v}.exe`;
}

/** Direct NSIS installer from a specific GitHub Release tag + asset name. */
export function getDesktopSetupDownloadUrl(version?: string): string {
  const file = getDesktopSetupArtifactName(version);
  const tag = DESKTOP_RELEASE_TAG.startsWith("v")
    ? DESKTOP_RELEASE_TAG
    : `v${DESKTOP_RELEASE_TAG}`;
  return `https://github.com/${DESKTOP_APP_GITHUB_REPO}/releases/download/${tag}/${encodeURIComponent(file)}`;
}

/** Navbar / external download link (override via env for staging or pinned builds). */
export const DESKTOP_APP_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL ?? getDesktopSetupDownloadUrl();
