"use client";

/**
 * Layers panel for managing canvas objects
 */

import { useEffect, useState } from "react";
import type { Canvas, FabricObject } from "fabric";
import { Eye, EyeOff, Lock, Unlock, Type, Image, Square, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LayersPanelProps {
  canvas: Canvas | null;
  onLayerSelect: (obj: FabricObject) => void;
}

interface LayerInfo {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
  obj: FabricObject;
}

export function LayersPanel({ canvas, onLayerSelect }: LayersPanelProps) {
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Update layers when canvas changes
  useEffect(() => {
    if (!canvas) return;

    const updateLayers = () => {
      const objects = canvas.getObjects();
      const layerList: LayerInfo[] = objects.map((obj, index) => {
        const objId = (obj as any).id || `object_${index}`;
        return {
          id: objId,
          name: getObjectName(obj),
          type: obj.type || "object",
          visible: obj.visible !== false,
          locked: obj.lockMovementX === true,
          obj,
        };
      }).reverse(); // Reverse to show top objects first

      setLayers(layerList);
    };

    updateLayers();

    // Listen for canvas changes
    canvas.on("object:added", updateLayers);
    canvas.on("object:removed", updateLayers);
    canvas.on("object:modified", updateLayers);

    // Listen for selection changes
    const updateSelection = () => {
      const activeObjects = canvas.getActiveObjects();
      const ids = new Set(
        activeObjects.map((obj) => (obj as any).id || "").filter(Boolean)
      );
      setSelectedIds(ids);
    };

    canvas.on("selection:created", updateSelection);
    canvas.on("selection:updated", updateSelection);
    canvas.on("selection:cleared", () => setSelectedIds(new Set()));

    return () => {
      canvas.off("object:added", updateLayers);
      canvas.off("object:removed", updateLayers);
      canvas.off("object:modified", updateLayers);
      canvas.off("selection:created", updateSelection);
      canvas.off("selection:updated", updateSelection);
      canvas.off("selection:cleared");
    };
  }, [canvas]);

  const getObjectName = (obj: FabricObject): string => {
    const type = obj.type || "object";
    if (type === "text" || type === "textbox") {
      const text = (obj as any).text || "";
      return text.slice(0, 20) || "Text";
    }
    if (type === "image") {
      return "Image";
    }
    if (type === "rect") {
      return "Rectangle";
    }
    if (type === "circle") {
      return "Circle";
    }
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getObjectIcon = (type: string) => {
    switch (type) {
      case "text":
      case "textbox":
        return <Type className="h-4 w-4" />;
      case "image":
        return <Image className="h-4 w-4" />;
      case "rect":
        return <Square className="h-4 w-4" />;
      case "circle":
        return <Circle className="h-4 w-4" />;
      default:
        return <Square className="h-4 w-4" />;
    }
  };

  const handleLayerClick = (layer: LayerInfo) => {
    if (!canvas) return;
    canvas.setActiveObject(layer.obj);
    canvas.requestRenderAll();
    onLayerSelect(layer.obj);
  };

  const toggleVisibility = (layer: LayerInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvas) return;

    layer.obj.visible = !layer.obj.visible;
    canvas.requestRenderAll();
    setLayers([...layers]); // Force re-render
  };

  const toggleLock = (layer: LayerInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvas) return;

    const isLocked = layer.obj.lockMovementX === true;
    layer.obj.lockMovementX = !isLocked;
    layer.obj.lockMovementY = !isLocked;
    layer.obj.lockScalingX = !isLocked;
    layer.obj.lockScalingY = !isLocked;
    layer.obj.lockRotation = !isLocked;
    layer.obj.selectable = isLocked;
    layer.obj.evented = isLocked;

    canvas.requestRenderAll();
    setLayers([...layers]); // Force re-render
  };

  if (!canvas) {
    return (
      <div className="p-4 text-sm text-gray-500">Loading layers...</div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-200">
        <h3 className="font-semibold text-sm">Layers</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {layers.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 text-center">
            No layers yet
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {layers.map((layer) => (
              <div
                key={layer.id}
                className={`flex items-center gap-2 p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedIds.has(layer.id) ? "bg-emerald-50" : ""
                }`}
                onClick={() => handleLayerClick(layer)}
              >
                <div className="text-gray-600">{getObjectIcon(layer.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {layer.name}
                  </div>
                  <div className="text-xs text-gray-500">{layer.type}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => toggleVisibility(layer, e)}
                    title={layer.visible ? "Hide" : "Show"}
                  >
                    {layer.visible ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3 text-gray-400" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => toggleLock(layer, e)}
                    title={layer.locked ? "Unlock" : "Lock"}
                  >
                    {layer.locked ? (
                      <Lock className="h-3 w-3 text-gray-400" />
                    ) : (
                      <Unlock className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
