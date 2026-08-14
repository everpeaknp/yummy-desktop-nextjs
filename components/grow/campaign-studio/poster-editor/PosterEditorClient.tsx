"use client";

/**
 * Main Fabric-based poster editor component
 * Phase 1: Foundation with basic editing capabilities
 */

import { useState, useCallback, useEffect } from "react";
import { Textbox, Rect, Circle, FabricImage } from "fabric";
import { Button } from "@/components/ui/button";
import { FabricCanvas } from "./FabricCanvas";
import { EditorToolbar } from "./EditorToolbar";
import { PropertiesPanel } from "./PropertiesPanel";
import { LayersPanel } from "./LayersPanel";
import { useFabricCanvas } from "./hooks/useFabricCanvas";
import { useFabricHistory } from "./hooks/useFabricHistory";
import { useFabricExport } from "./hooks/useFabricExport";
import { generateObjectId } from "@/types/fabric-poster";
import {
  createFreshTemplate,
  createWarmTemplate,
  createMinimalTemplate,
  createTicketTemplate,
  createProofOfConceptTemplate,
} from "@/lib/growth/fabric-templates";
import type { FabricTemplateConfig } from "@/lib/growth/fabric-templates/types";
import type { FabricObject } from "fabric";
import { Download, Save } from "lucide-react";

export interface PosterEditorClientProps {
  templateConfig: FabricTemplateConfig;
  onSave?: (blob: Blob) => Promise<void>;
  onExport?: (blob: Blob) => void;
}

export function PosterEditorClient({
  templateConfig,
  onSave,
  onExport,
}: PosterEditorClientProps) {
  const [selectedObjects, setSelectedObjects] = useState<FabricObject[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [templateId, setTemplateId] = useState<
    "fresh" | "warm" | "minimal" | "ticket"
  >("fresh");

  // Initialize canvas
  const {
    canvasRef,
    canvas,
    isReady,
    deleteSelected,
    duplicateSelected,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
  } = useFabricCanvas({
    backgroundColor: "#ffffff",
    onSelectionChanged: setSelectedObjects,
  });

  // History management
  const { undo, redo, canUndo, canRedo } = useFabricHistory({
    canvas,
  });

  // Export functionality
  const { exportToHighResPNG, debugComparePreviewVsExport } = useFabricExport({ canvas });

  // Debug comparison state
  const [showDebugComparison, setShowDebugComparison] = useState(false);
  const [debugData, setDebugData] = useState<{
    previewDataURL: string;
    exportDataURL: string;
  } | null>(null);

  // Load template when canvas is ready or template changes
  useEffect(() => {
    if (!canvas || !isReady) return;

    const templates = {
      fresh: createFreshTemplate,
      warm: createWarmTemplate,
      minimal: createMinimalTemplate,
      ticket: createTicketTemplate,
    };

    const createTemplate = templates[templateId];
    const template = createTemplate(templateConfig);

    canvas.loadFromJSON(template.fabricJSON).then(() => {
      canvas.requestRenderAll();
    });
  }, [canvas, isReady, templateConfig, templateId]);

  // Handle template change
  const handleTemplateChange = useCallback(
    (newTemplateId: "fresh" | "warm" | "minimal" | "ticket") => {
      setTemplateId(newTemplateId);
    },
    []
  );

  // Add text
  const handleAddText = useCallback(() => {
    if (!canvas) return;

    const text = new Textbox("Double-click to edit", {
      left: 100,
      top: 100,
      width: 400,
      fontSize: 48,
      fontFamily: "Inter, system-ui, sans-serif",
      fill: "#000000",
      editable: true,
    });

    (text as any).id = generateObjectId("text");
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
  }, [canvas]);

  // Add image (placeholder for now)
  const handleAddImage = useCallback(() => {
    if (!canvas) return;

    // Create a placeholder rectangle
    const placeholder = new Rect({
      left: 150,
      top: 150,
      width: 400,
      height: 300,
      fill: "#e5e7eb",
      stroke: "#9ca3af",
      strokeWidth: 2,
      strokeDashArray: [5, 5],
    });

    // Add text label
    const label = new Textbox("Image Placeholder\n(Upload coming in Phase 2)", {
      left: 200,
      top: 250,
      width: 300,
      fontSize: 24,
      fontFamily: "Inter, system-ui, sans-serif",
      fill: "#6b7280",
      textAlign: "center",
      editable: false,
      selectable: false,
    });

    (placeholder as any).id = generateObjectId("image");
    (label as any).id = generateObjectId("text");

    canvas.add(placeholder);
    canvas.add(label);
    canvas.setActiveObject(placeholder);
    canvas.requestRenderAll();
  }, [canvas]);

  // Add rectangle
  const handleAddRectangle = useCallback(() => {
    if (!canvas) return;

    const rect = new Rect({
      left: 200,
      top: 200,
      width: 300,
      height: 200,
      fill: "#10b981",
      stroke: "#047857",
      strokeWidth: 2,
    });

    (rect as any).id = generateObjectId("rect");
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.requestRenderAll();
  }, [canvas]);

  // Add circle
  const handleAddCircle = useCallback(() => {
    if (!canvas) return;

    const circle = new Circle({
      left: 250,
      top: 250,
      radius: 100,
      fill: "#3b82f6",
      stroke: "#1d4ed8",
      strokeWidth: 2,
    });

    (circle as any).id = generateObjectId("circle");
    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.requestRenderAll();
  }, [canvas]);

  // Handle property change
  const handlePropertyChange = useCallback(
    (property: string, value: unknown) => {
      if (!canvas || selectedObjects.length === 0) return;

      selectedObjects.forEach((obj) => {
        obj.set(property as any, value);
      });

      canvas.requestRenderAll();
    },
    [canvas, selectedObjects]
  );

  // Handle export
  const handleExport = useCallback(async () => {
    const blob = await exportToHighResPNG();
    if (blob && onExport) {
      onExport(blob);
    }
  }, [exportToHighResPNG, onExport]);

  // Handle debug comparison
  const handleDebugComparison = useCallback(async () => {
    const result = await debugComparePreviewVsExport();
    if (result) {
      setDebugData({
        previewDataURL: result.previewDataURL,
        exportDataURL: result.exportDataURL,
      });
      setShowDebugComparison(true);
    }
  }, [debugComparePreviewVsExport]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      const blob = await exportToHighResPNG();
      if (blob) {
        await onSave(blob);
      }
    } catch (error) {
      console.error("Error saving poster:", error);
    } finally {
      setIsSaving(false);
    }
  }, [exportToHighResPNG, onSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete
      if (e.key === "Delete" || e.key === "Backspace") {
        if (
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          e.preventDefault();
          deleteSelected();
        }
      }

      // Duplicate
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
      if (isCtrlOrCmd && e.key === "d") {
        e.preventDefault();
        duplicateSelected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected, duplicateSelected]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Top bar with template selector */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            Template Style:
          </label>
          <div className="flex gap-2">
            <Button
              variant={templateId === "fresh" ? "default" : "outline"}
              size="sm"
              onClick={() => handleTemplateChange("fresh")}
              className="gap-2"
            >
              <span>🌿</span>
              <span>Fresh</span>
            </Button>
            <Button
              variant={templateId === "warm" ? "default" : "outline"}
              size="sm"
              onClick={() => handleTemplateChange("warm")}
              className="gap-2"
            >
              <span>🔥</span>
              <span>Warm</span>
            </Button>
            <Button
              variant={templateId === "minimal" ? "default" : "outline"}
              size="sm"
              onClick={() => handleTemplateChange("minimal")}
              className="gap-2"
            >
              <span>🎨</span>
              <span>Minimal</span>
            </Button>
            <Button
              variant={templateId === "ticket" ? "default" : "outline"}
              size="sm"
              onClick={() => handleTemplateChange("ticket")}
              className="gap-2"
            >
              <span>🎟️</span>
              <span>Ticket</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <EditorToolbar
        hasSelection={selectedObjects.length > 0}
        canUndo={canUndo}
        canRedo={canRedo}
        onAddText={handleAddText}
        onAddImage={handleAddImage}
        onAddRectangle={handleAddRectangle}
        onAddCircle={handleAddCircle}
        onDelete={deleteSelected}
        onDuplicate={duplicateSelected}
        onUndo={undo}
        onRedo={redo}
        onBringToFront={bringToFront}
        onSendToBack={sendToBack}
        onBringForward={bringForward}
        onSendBackward={sendBackward}
      />

      {/* Main editor area */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar - Layers */}
        <div className="w-64 border-r border-gray-200 bg-gray-50 overflow-hidden">
          <LayersPanel
            canvas={canvas}
            onLayerSelect={(obj) => setSelectedObjects([obj])}
          />
        </div>

        {/* Canvas area */}
        <div className="flex-1 p-4 overflow-hidden">
          <FabricCanvas
            canvas={canvas}
            isReady={isReady}
            canvasRef={canvasRef}
          />
        </div>

        {/* Right sidebar - Properties */}
        <div className="w-64 border-l border-gray-200 bg-gray-50 overflow-y-auto">
          <PropertiesPanel
            selectedObjects={selectedObjects}
            onPropertyChange={handlePropertyChange}
          />
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="border-t border-gray-200 p-4 flex items-center justify-between bg-white">
        <div className="text-sm text-gray-600">
          {isReady ? (
            <span>
              Canvas ready • {canvas?.getObjects().length || 0} objects
            </span>
          ) : (
            <span>Loading...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Debug comparison button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDebugComparison}
            disabled={!isReady}
            className="text-xs"
          >
            🔍 Debug Compare
          </Button>
          
          {onExport && (
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={!isReady}
            >
              <Download className="h-4 w-4 mr-2" />
              Export PNG
            </Button>
          )}
          {onSave && (
            <Button
              variant="default"
              onClick={handleSave}
              disabled={!isReady || isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Poster"}
            </Button>
          )}
        </div>
      </div>

      {/* Debug comparison modal */}
      {showDebugComparison && debugData && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8"
          onClick={() => setShowDebugComparison(false)}
        >
          <div
            className="bg-white rounded-lg p-8 max-w-7xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Preview vs Export Comparison</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDebugComparison(false)}
              >
                Close
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-8">
              {/* Canvas Preview */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Canvas Preview (Display)</h3>
                <div className="border-2 border-blue-500 rounded-lg p-4 bg-gray-50">
                  <img
                    src={debugData.previewDataURL}
                    alt="Canvas Preview"
                    className="w-full h-auto rounded shadow-lg"
                  />
                </div>
                <p className="text-sm text-gray-600">
                  This is the canvas as displayed with zoom/viewport scaling applied
                </p>
              </div>

              {/* Exported PNG */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Exported PNG (2160×2160)</h3>
                <div className="border-2 border-emerald-500 rounded-lg p-4 bg-gray-50">
                  <img
                    src={debugData.exportDataURL}
                    alt="Exported PNG"
                    className="w-full h-auto rounded shadow-lg"
                  />
                </div>
                <p className="text-sm text-gray-600">
                  This is the exported PNG at full 2160×2160 resolution
                </p>
              </div>
            </div>

            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium mb-2">✅ Export Process:</p>
              <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                <li>Waited for fonts to load (document.fonts.ready)</li>
                <li>Verified all images are loaded</li>
                <li>Reset zoom to 1.0 (removed display scaling)</li>
                <li>Reset viewport transform to identity [1,0,0,1,0,0]</li>
                <li>Set dimensions to exact 2160×2160</li>
                <li>Exported using Fabric's native toDataURL()</li>
                <li>Restored original canvas state</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
