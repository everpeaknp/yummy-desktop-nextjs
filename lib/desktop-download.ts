import packageJson from "../package.json";

/** GitHub Releases — latest Yummy POS Windows installers. */
export const DESKTOP_APP_GITHUB_REPO = "everpeaknp/yummy-desktop-nextjs";

export const DESKTOP_APP_RELEASES_URL =
  `https://github.com/${DESKTOP_APP_GITHUB_REPO}/releases/latest`;

/**
 * NSIS installer filename on GitHub Releases (e.g. v0.1.4 asset: Yummy.POS.Setup.0.1.0.exe).
 * Uses app version from package.json, not the release tag.
 */
export function getDesktopSetupArtifactName(version?: string): string {
  const v = (version ?? packageJson.version).trim() || "0.1.0";
  return `Yummy.POS.Setup.${v}.exe`;
}

/** Direct NSIS installer from the latest GitHub Release. */
export function getDesktopSetupDownloadUrl(version?: string): string {
  const file = getDesktopSetupArtifactName(version);
  return `https://github.com/${DESKTOP_APP_GITHUB_REPO}/releases/latest/download/${encodeURIComponent(file)}`;
}

/** Navbar / external download link (override via env for staging or pinned builds). */
export const DESKTOP_APP_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL ?? getDesktopSetupDownloadUrl();
