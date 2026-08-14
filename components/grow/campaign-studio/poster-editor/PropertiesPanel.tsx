"use client";

/**
 * Properties panel for editing selected objects
 */

import { useState, useEffect } from "react";
import type { FabricObject } from "fabric";

export interface PropertiesPanelProps {
  selectedObjects: FabricObject[];
  onPropertyChange: (property: string, value: unknown) => void;
}

export function PropertiesPanel({
  selectedObjects,
  onPropertyChange,
}: PropertiesPanelProps) {
  const [localProps, setLocalProps] = useState<Record<string, unknown>>({});

  // Update local state when selection changes
  useEffect(() => {
    if (selectedObjects.length === 1) {
      const obj = selectedObjects[0];
      setLocalProps({
        left: obj.left || 0,
        top: obj.top || 0,
        width: obj.width || 0,
        height: obj.height || 0,
        angle: obj.angle || 0,
        opacity: obj.opacity || 1,
        fill: obj.fill || "#000000",
      });
    } else {
      setLocalProps({});
    }
  }, [selectedObjects]);

  if (selectedObjects.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Select an object to edit properties
      </div>
    );
  }

  if (selectedObjects.length > 1) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Multiple objects selected ({selectedObjects.length})
      </div>
    );
  }

  const obj = selectedObjects[0];
  const isText = obj.type === "text" || obj.type === "textbox";

  const handleChange = (property: string, value: unknown) => {
    setLocalProps((prev) => ({ ...prev, [property]: value }));
    onPropertyChange(property, value);
  };

  return (
    <div className="p-4 space-y-4 text-sm">
      <div>
        <h3 className="font-semibold mb-3 text-gray-900">
          {obj.type === "text" || obj.type === "textbox"
            ? "Text Properties"
            : obj.type === "image"
              ? "Image Properties"
              : "Shape Properties"}
        </h3>
      </div>

      {/* Position */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700">
          Position
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500">X</label>
            <input
              type="number"
              value={Math.round(Number(localProps.left) || 0)}
              onChange={(e) => handleChange("left", Number(e.target.value))}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Y</label>
            <input
              type="number"
              value={Math.round(Number(localProps.top) || 0)}
              onChange={(e) => handleChange("top", Number(e.target.value))}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
            />
          </div>
        </div>
      </div>

      {/* Size */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700">Size</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500">W</label>
            <input
              type="number"
              value={Math.round(Number(localProps.width) || 0)}
              onChange={(e) => handleChange("width", Number(e.target.value))}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">H</label>
            <input
              type="number"
              value={Math.round(Number(localProps.height) || 0)}
              onChange={(e) => handleChange("height", Number(e.target.value))}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
            />
          </div>
        </div>
      </div>

      {/* Rotation */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Rotation
        </label>
        <input
          type="number"
          value={Math.round(Number(localProps.angle) || 0)}
          onChange={(e) => handleChange("angle", Number(e.target.value))}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
          min="0"
          max="360"
        />
      </div>

      {/* Opacity */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Opacity
        </label>
        <input
          type="range"
          value={Number(localProps.opacity) || 1}
          onChange={(e) => handleChange("opacity", Number(e.target.value))}
          className="w-full"
          min="0"
          max="1"
          step="0.01"
        />
        <div className="text-xs text-gray-500 text-center mt-1">
          {Math.round((Number(localProps.opacity) || 1) * 100)}%
        </div>
      </div>

      {/* Text-specific properties */}
      {isText && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Font Size
            </label>
            <input
              type="number"
              value={Number((obj as any).fontSize) || 16}
              onChange={(e) =>
                handleChange("fontSize", Number(e.target.value))
              }
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
              min="8"
              max="200"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Text Color
            </label>
            <input
              type="color"
              value={String(obj.fill || "#000000")}
              onChange={(e) => handleChange("fill", e.target.value)}
              className="w-full h-10 border border-gray-300 rounded cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Font Weight
            </label>
            <select
              value={String((obj as any).fontWeight || "normal")}
              onChange={(e) => handleChange("fontWeight", e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
            >
              <option value="normal">Normal</option>
              <option value="bold">Bold</option>
              <option value="600">Semi-Bold</option>
              <option value="900">Black</option>
            </select>
          </div>
        </>
      )}

      {/* Shape fill color */}
      {!isText && obj.type !== "image" && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Fill Color
          </label>
          <input
            type="color"
            value={String(obj.fill || "#000000")}
            onChange={(e) => handleChange("fill", e.target.value)}
            className="w-full h-10 border border-gray-300 rounded cursor-pointer"
          />
        </div>
      )}
    </div>
  );
}
