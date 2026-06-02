/** GitHub Releases — latest Yummy POS Windows installers. */
export const DESKTOP_APP_GITHUB_REPO = "everpeaknp/yummy-desktop-nextjs";

export const DESKTOP_APP_RELEASES_URL =
  `https://github.com/${DESKTOP_APP_GITHUB_REPO}/releases/latest`;

/** Sidebar / external link (release page with Setup + Portable). */
export const DESKTOP_APP_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL ?? DESKTOP_APP_RELEASES_URL;

/** Direct NSIS installer URL for a given app version (matches electron-builder artifactName). */
export function getDesktopSetupDownloadUrl(version: string): string {
  const v = version.trim() || "0.1.0";
  return `https://github.com/${DESKTOP_APP_GITHUB_REPO}/releases/latest/download/Yummy-POS-Setup-${v}.exe`;
}
