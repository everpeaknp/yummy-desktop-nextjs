/**
 * Type definitions for the Fabric.js-based poster editor
 * Phase 1: Foundation types for canvas-based poster design
 */

import type { Canvas, FabricObject } from "fabric";
import type { CampaignPosterTemplate } from "@/lib/growth/campaign-studio";
import type { GrowthLanguage } from "@/lib/api/growth-types";

/**
 * Complete poster design that can be saved/loaded
 */
export interface PosterDesign {
  version: "1.0";
  template: CampaignPosterTemplate;
  canvas: {
    width: number; // 2160
    height: number; // 2160
    backgroundColor: string;
  };
  objects: SerializableFabricObject[];
  metadata: PosterMetadata;
}

/**
 * Metadata about the poster design
 */
export interface PosterMetadata {
  restaurantName: string;
  offer: string;
  headline: string;
  message: string;
  terms: string;
  expiresOn: string;
  language: GrowthLanguage;
  createdAt: string;
  modifiedAt: string;
}

/**
 * Fabric object with stable custom IDs
 */
export interface SerializableFabricObject {
  id: string; // Stable custom ID
  type: string;
  [key: string]: unknown;
}

/**
 * Template definition for Fabric canvas
 */
export interface FabricPosterTemplate {
  id: CampaignPosterTemplate;
  name: string;
  thumbnail?: string;
  fabricJSON: {
    version: string;
    objects: SerializableFabricObject[];
    background?: string;
  };
  variables: {
    [key: string]: TemplateVariable;
  };
}

/**
 * Variable mapping for template customization
 */
export interface TemplateVariable {
  objectId: string; // Fabric object ID
  property: string; // text, src, fill, etc.
  defaultValue?: unknown;
}

/**
 * Configuration for creating a template
 */
export interface TemplateConfig {
  restaurantName: string;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  headline: string;
  offerLabel: string;
  expiresOn: string;
  terms: string;
}

/**
 * Canvas dimensions for the poster editor
 */
export const POSTER_CANVAS_SIZE = {
  width: 2160,
  height: 2160,
  displayWidth: 600, // For responsive display
  displayHeight: 600,
} as const;

/**
 * Export options for the poster
 */
export interface PosterExportOptions {
  format: "png" | "jpeg" | "webp";
  quality: number; // 0-1
  multiplier: number; // Scale factor for export
  withoutBackground?: boolean;
}

/**
 * History state for undo/redo
 */
export interface HistoryState {
  json: string; // Serialized canvas JSON
  timestamp: number;
}

/**
 * Editor tool types
 */
export type EditorTool =
  | "select"
  | "text"
  | "image"
  | "rectangle"
  | "circle"
  | "line"
  | "pan"
  | "zoom";

/**
 * Layer information for the layers panel
 */
export interface LayerInfo {
  id: string;
  type: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  zIndex: number;
}

/**
 * Text properties for the properties panel
 */
export interface TextProperties {
  fontFamily: string;
  fontSize: number;
  fontWeight: string | number;
  fontStyle: string;
  fill: string;
  textAlign: string;
  lineHeight: number;
  charSpacing: number;
  underline: boolean;
  linethrough: boolean;
}

/**
 * Image properties for the properties panel
 */
export interface ImageProperties {
  src: string;
  cropX: number;
  cropY: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  filters: string[];
}

/**
 * Shape properties for the properties panel
 */
export interface ShapeProperties {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  shadow?: {
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
}

/**
 * Type guard for Fabric objects with IDs
 */
export function isFabricObjectWithId(
  obj: unknown
): obj is FabricObject & { id: string } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    typeof (obj as { id: unknown }).id === "string"
  );
}

/**
 * Generate a unique ID for Fabric objects
 */
export function generateObjectId(type: string): string {
  return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
