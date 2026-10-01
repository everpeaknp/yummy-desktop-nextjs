"use client";

/**
 * Fabric Canvas wrapper component with responsive display and zoom/pan
 */

import { useEffect, useRef } from "react";
import type { Canvas } from "fabric";
import { POSTER_CANVAS_SIZE } from "@/types/fabric-poster";

export interface FabricCanvasProps {
  canvas: Canvas | null;
  isReady: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  className?: string;
}

export function FabricCanvas({
  canvas,
  isReady,
  canvasRef,
  className = "",
}: FabricCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle responsive scaling
  useEffect(() => {
    if (!canvas || !isReady || !containerRef.current) return;

    const updateScale = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Calculate scale to fit canvas in container while maintaining aspect ratio
      const scaleX = containerWidth / POSTER_CANVAS_SIZE.width;
      const scaleY = containerHeight / POSTER_CANVAS_SIZE.height;
      const scale = Math.min(scaleX, scaleY, 1); // Max scale of 1 (100%)

      // Apply zoom to canvas
      canvas.setZoom(scale);

      // Center canvas in container
      const scaledWidth = POSTER_CANVAS_SIZE.width * scale;
      const scaledHeight = POSTER_CANVAS_SIZE.height * scale;
      
      canvas.setDimensions({
        width: scaledWidth,
        height: scaledHeight,
      });

      canvas.requestRenderAll();
    };

    updateScale();

    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [canvas, isReady]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center bg-gray-100 ${className}`}
    >
      <div className="relative shadow-2xl rounded-lg overflow-hidden">
        <canvas ref={canvasRef} />
      </div>
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4" />
            <p className="text-sm text-gray-600">Loading canvas...</p>
          </div>
        </div>
      )}
    </div>
  );
}
