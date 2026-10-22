export const DEV_UI_GALLERY_PATH = "/dev/ui-gallery";

export function isDevelopmentUiGalleryPath(pathname: string) {
  return pathname === DEV_UI_GALLERY_PATH;
}
