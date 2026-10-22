/**
 * Hook for exporting Fabric canvas to PNG using native Fabric export
 * Ensures pixel-perfect fidelity with canvas preview
 */

import { useCallback } from "react";
import type { Canvas, FabricImage } from "fabric";
import { POSTER_CANVAS_SIZE } from "@/types/fabric-poster";

export interface UseFabricExportOptions {
  canvas: Canvas | null;
}

export interface ExportOptions {
  format?: "png" | "jpeg" | "webp";
  quality?: number; // 0-1
  multiplier?: number; // Scale factor
  withoutBackground?: boolean;
  debug?: boolean; // Enable debug logging
}

/**
 * Wait for all fonts to be loaded
 */
async function waitForFonts(): Promise<void> {
  if (typeof document === "undefined") return;
  
  try {
    await document.fonts.ready;
    console.log("[Export] All fonts loaded");
  } catch (error) {
    console.warn("[Export] Font loading wait failed:", error);
  }
}

/**
 * Wait for all Fabric images to be fully loaded
 */
async function waitForImages(canvas: Canvas): Promise<void> {
  const objects = canvas.getObjects();
  const imageObjects = objects.filter(
    (obj) => obj.type === "image"
  ) as FabricImage[];

  if (imageObjects.length === 0) {
    console.log("[Export] No images to wait for");
    return;
  }

  const imagePromises = imageObjects.map((img) => {
    return new Promise<void>((resolve) => {
      const element = (img as any)._element;
      
      if (!element) {
        resolve();
        return;
      }

      if (element.complete && element.naturalWidth > 0) {
        resolve();
      } else {
        element.onload = () => resolve();
        element.onerror = () => {
          console.warn("[Export] Image failed to load:", element.src);
          resolve();
        };
      }
    });
  });

  await Promise.all(imagePromises);
  console.log(`[Export] All ${imageObjects.length} images loaded`);
}

export function useFabricExport(options: UseFabricExportOptions) {
  const { canvas } = options;

  /**
   * Export canvas to PNG blob with pixel-perfect fidelity
   * Uses Fabric's native toDataURL instead of html2canvas
   */
  const exportToPNG = useCallback(
    async (exportOptions: ExportOptions = {}): Promise<Blob | null> => {
      if (!canvas) {
        console.error("Canvas not initialized");
        return null;
      }

      const {
        format = "png",
        quality = 0.95,
        multiplier = 1,
        withoutBackground = false,
        debug = false,
      } = exportOptions;

      try {
        if (debug) {
          console.log("[Export] Starting export process...");
          console.log("[Export] Canvas state:", {
            width: canvas.width,
            height: canvas.height,
            getWidth: canvas.getWidth(),
            getHeight: canvas.getHeight(),
            zoom: canvas.getZoom(),
            viewportTransform: canvas.viewportTransform,
            objectCount: canvas.getObjects().length,
          });
        }

        // Step 1: Wait for fonts to load
        await waitForFonts();

        // Step 2: Wait for all images to load
        await waitForImages(canvas);

        // Step 3: Store current canvas state
        const originalZoom = canvas.getZoom();
        const originalViewport = (canvas.viewportTransform?.slice() || [1, 0, 0, 1, 0, 0]) as [number, number, number, number, number, number];
        const originalBackground = canvas.backgroundColor;

        if (debug) {
          console.log("[Export] Stored state:", {
            zoom: originalZoom,
            viewport: originalViewport,
            background: originalBackground,
          });
        }

        // Step 4: Reset canvas to design space for export
        // Set zoom to 1.0 (no scaling)
        canvas.setZoom(1);
        
        // Reset viewport transform to identity
        canvas.viewportTransform = [1, 0, 0, 1, 0, 0];

        // Set canvas to exact design dimensions
        canvas.setWidth(POSTER_CANVAS_SIZE.width);
        canvas.setHeight(POSTER_CANVAS_SIZE.height);

        // Temporarily set background to transparent if requested
        if (withoutBackground) {
          canvas.backgroundColor = "";
        }

        // Force render with reset state
        canvas.requestRenderAll();

        // Small delay to ensure render completes
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (debug) {
          console.log("[Export] Export state:", {
            width: canvas.width,
            height: canvas.height,
            zoom: canvas.getZoom(),
            viewportTransform: canvas.viewportTransform,
          });
        }

        // Step 5: Export canvas to data URL
        const dataURL = (canvas as any).toDataURL({
          format,
          quality,
          multiplier,
          width: POSTER_CANVAS_SIZE.width,
          height: POSTER_CANVAS_SIZE.height,
        });

        // Step 6: Restore original canvas state
        canvas.setZoom(originalZoom);
        canvas.viewportTransform = originalViewport;
        
        if (withoutBackground) {
          canvas.backgroundColor = originalBackground;
        }

        // Restore display dimensions (will be recalculated by responsive handler)
        canvas.requestRenderAll();

        if (debug) {
          console.log("[Export] Restored state:", {
            zoom: canvas.getZoom(),
            viewportTransform: canvas.viewportTransform,
          });
        }

        // Convert data URL to Blob
        const blob = await dataURLToBlob(dataURL);
        
        if (debug && blob) {
          console.log("[Export] Export complete:", {
            size: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
            type: blob.type,
          });
        }

        return blob;
      } catch (error) {
        console.error("Error exporting canvas:", error);
        return null;
      }
    },
    [canvas]
  );

  /**
   * Export to high-resolution PNG (2160x2160) with debug option
   */
  const exportToHighResPNG = useCallback(
    async (debug = false): Promise<Blob | null> => {
      return exportToPNG({
        format: "png",
        quality: 0.95,
        multiplier: 1,
        withoutBackground: false,
        debug,
      });
    },
    [exportToPNG]
  );

  /**
   * Get canvas as data URL for preview (with current zoom/viewport)
   */
  const getPreviewDataURL = useCallback(
    (scale = 0.5): string | null => {
      if (!canvas) return null;

      try {
        return (canvas as any).toDataURL({
          format: "png",
          quality: 0.8,
          multiplier: scale,
        });
      } catch (error) {
        console.error("Error getting preview:", error);
        return null;
      }
    },
    [canvas]
  );

  /**
   * Export canvas JSON for saving design
   */
  const exportJSON = useCallback((): string | null => {
    if (!canvas) return null;

    try {
      return JSON.stringify((canvas as any).toJSON(["id"]), null, 2);
    } catch (error) {
      console.error("Error exporting JSON:", error);
      return null;
    }
  }, [canvas]);

  /**
   * Load design from JSON
   */
  const loadFromJSON = useCallback(
    async (json: string): Promise<boolean> => {
      if (!canvas) return false;

      try {
        await canvas.loadFromJSON(JSON.parse(json));
        
        // Wait for images to load after JSON load
        await waitForImages(canvas);
        
        canvas.requestRenderAll();
        return true;
      } catch (error) {
        console.error("Error loading JSON:", error);
        return false;
      }
    },
    [canvas]
  );

  /**
   * Debug comparison mode - exports canvas and logs comparison data
   */
  const debugComparePreviewVsExport = useCallback(async (): Promise<{
    previewDataURL: string;
    exportDataURL: string;
    canvasState: {
      preview: Record<string, any>;
      export: Record<string, any>;
    };
  } | null> => {
    if (!canvas) return null;

    try {
      // Capture preview state
      const previewState = {
        width: canvas.width,
        height: canvas.height,
        zoom: canvas.getZoom(),
        viewportTransform: canvas.viewportTransform?.slice(),
        objectCount: canvas.getObjects().length,
      };
      const previewDataURL = getPreviewDataURL(1) || "";

      // Export with reset state
      const exportBlob = await exportToHighResPNG(true);
      if (!exportBlob) return null;

      const exportDataURL = URL.createObjectURL(exportBlob);

      // Capture export state (should be reset)
      const exportState = {
        width: canvas.width,
        height: canvas.height,
        zoom: canvas.getZoom(),
        viewportTransform: canvas.viewportTransform?.slice(),
        objectCount: canvas.getObjects().length,
      };

      console.log("[Debug] Preview vs Export Comparison:", {
        preview: previewState,
        export: exportState,
        dimensions: {
          target: POSTER_CANVAS_SIZE,
        },
      });

      return {
        previewDataURL,
        exportDataURL,
        canvasState: {
          preview: previewState,
          export: exportState,
        },
      };
    } catch (error) {
      console.error("Error in debug comparison:", error);
      return null;
    }
  }, [canvas, getPreviewDataURL, exportToHighResPNG]);

  return {
    exportToPNG,
    exportToHighResPNG,
    getPreviewDataURL,
    exportJSON,
    loadFromJSON,
    debugComparePreviewVsExport,
  };
}

/**
 * Convert data URL to Blob
 */
async function dataURLToBlob(dataURL: string): Promise<Blob> {
  const response = await fetch(dataURL);
  return response.blob();
}
