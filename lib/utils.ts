import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function getImageUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("asset:")) {
    // Convert asset:menu_gallery/americano.webp to /assets/menu_gallery/americano.webp
    return `/${path.replace("asset:", "assets/")}`;
  }
  return path;
}
