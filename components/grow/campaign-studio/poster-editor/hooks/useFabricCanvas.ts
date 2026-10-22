/**
 * Hook for managing Fabric canvas initialization and lifecycle
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, FabricObject } from "fabric";
import { POSTER_CANVAS_SIZE } from "@/types/fabric-poster";

export interface UseFabricCanvasOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  onReady?: (canvas: Canvas) => void;
  onObjectModified?: (obj: FabricObject) => void;
  onSelectionChanged?: (objects: FabricObject[]) => void;
}

export function useFabricCanvas(options: UseFabricCanvasOptions = {}) {
  const {
    width = POSTER_CANVAS_SIZE.width,
    height = POSTER_CANVAS_SIZE.height,
    backgroundColor = "#ffffff",
    onReady,
    onObjectModified,
    onSelectionChanged,
  } = options;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor,
      preserveObjectStacking: true,
      selection: true,
      renderOnAddRemove: true,
      enableRetinaScaling: true,
    });

    fabricRef.current = canvas;
    setIsReady(true);

    if (onReady) {
      onReady(canvas);
    }

    return () => {
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
      setIsReady(false);
    };
  }, [width, height, backgroundColor, onReady]);

  // Setup event listeners
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const handleObjectModified = (e: { target?: FabricObject }) => {
      if (e.target && onObjectModified) {
        onObjectModified(e.target);
      }
    };

    const handleSelectionCreated = () => {
      const activeObjects = canvas.getActiveObjects();
      if (onSelectionChanged) {
        onSelectionChanged(activeObjects);
      }
    };

    const handleSelectionUpdated = () => {
      const activeObjects = canvas.getActiveObjects();
      if (onSelectionChanged) {
        onSelectionChanged(activeObjects);
      }
    };

    const handleSelectionCleared = () => {
      if (onSelectionChanged) {
        onSelectionChanged([]);
      }
    };

    canvas.on("object:modified", handleObjectModified);
    canvas.on("selection:created", handleSelectionCreated);
    canvas.on("selection:updated", handleSelectionUpdated);
    canvas.on("selection:cleared", handleSelectionCleared);

    return () => {
      canvas.off("object:modified", handleObjectModified);
      canvas.off("selection:created", handleSelectionCreated);
      canvas.off("selection:updated", handleSelectionUpdated);
      canvas.off("selection:cleared", handleSelectionCleared);
    };
  }, [onObjectModified, onSelectionChanged]);

  // Get selected objects
  const getSelectedObjects = useCallback((): FabricObject[] => {
    if (!fabricRef.current) return [];
    return fabricRef.current.getActiveObjects();
  }, []);

  // Delete selected objects
  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length === 0) return;

    activeObjects.forEach((obj) => {
      canvas.remove(obj);
    });
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }, []);

  // Duplicate selected objects
  const duplicateSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length === 0) return;

    activeObjects.forEach((obj) => {
      obj.clone().then((cloned: FabricObject) => {
        cloned.set({
          left: (cloned.left || 0) + 20,
          top: (cloned.top || 0) + 20,
        });
        canvas.add(cloned);
      });
    });
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }, []);

  // Bring selected to front
  const bringToFront = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach((obj) => {
      canvas.bringObjectToFront(obj);
    });
    canvas.requestRenderAll();
  }, []);

  // Send selected to back
  const sendToBack = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach((obj) => {
      canvas.sendObjectToBack(obj);
    });
    canvas.requestRenderAll();
  }, []);

  // Bring selected forward
  const bringForward = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach((obj) => {
      canvas.bringObjectForward(obj);
    });
    canvas.requestRenderAll();
  }, []);

  // Send selected backward
  const sendBackward = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach((obj) => {
      canvas.sendObjectBackwards(obj);
    });
    canvas.requestRenderAll();
  }, []);

  return {
    canvasRef,
    canvas: fabricRef.current,
    isReady,
    getSelectedObjects,
    deleteSelected,
    duplicateSelected,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
  };
}
