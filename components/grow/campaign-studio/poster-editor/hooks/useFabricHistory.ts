/**
 * Hook for undo/redo history management using Fabric JSON snapshots
 */

import { useCallback, useRef, useEffect } from "react";
import type { Canvas } from "fabric";

const MAX_HISTORY_STATES = 50;

interface HistoryState {
  json: string;
  timestamp: number;
}

export interface UseFabricHistoryOptions {
  canvas: Canvas | null;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

export function useFabricHistory(options: UseFabricHistoryOptions) {
  const { canvas, onHistoryChange } = options;

  const historyStack = useRef<HistoryState[]>([]);
  const currentIndex = useRef<number>(-1);
  const isApplyingHistory = useRef<boolean>(false);
  const lastSavedJson = useRef<string>("");

  // Save current state to history
  const saveState = useCallback(() => {
    if (!canvas || isApplyingHistory.current) return;

    const json = JSON.stringify((canvas as any).toJSON(["id"]));
    
    // Don't save duplicate states
    if (json === lastSavedJson.current) return;
    
    lastSavedJson.current = json;

    // Remove any redo states if we're not at the end
    if (currentIndex.current < historyStack.current.length - 1) {
      historyStack.current = historyStack.current.slice(0, currentIndex.current + 1);
    }

    // Add new state
    historyStack.current.push({
      json,
      timestamp: Date.now(),
    });

    // Limit history size
    if (historyStack.current.length > MAX_HISTORY_STATES) {
      historyStack.current.shift();
    } else {
      currentIndex.current++;
    }

    if (onHistoryChange) {
      onHistoryChange(canUndo(), canRedo());
    }
  }, [canvas, onHistoryChange]);

  // Undo
  const undo = useCallback(async () => {
    if (!canvas || !canUndo()) return;

    isApplyingHistory.current = true;
    currentIndex.current--;

    const state = historyStack.current[currentIndex.current];
    if (state) {
      await canvas.loadFromJSON(JSON.parse(state.json));
      lastSavedJson.current = state.json;
      canvas.requestRenderAll();
    }

    isApplyingHistory.current = false;

    if (onHistoryChange) {
      onHistoryChange(canUndo(), canRedo());
    }
  }, [canvas, onHistoryChange]);

  // Redo
  const redo = useCallback(async () => {
    if (!canvas || !canRedo()) return;

    isApplyingHistory.current = true;
    currentIndex.current++;

    const state = historyStack.current[currentIndex.current];
    if (state) {
      await canvas.loadFromJSON(JSON.parse(state.json));
      lastSavedJson.current = state.json;
      canvas.requestRenderAll();
    }

    isApplyingHistory.current = false;

    if (onHistoryChange) {
      onHistoryChange(canUndo(), canRedo());
    }
  }, [canvas, onHistoryChange]);

  // Check if can undo
  const canUndo = useCallback((): boolean => {
    return currentIndex.current > 0;
  }, []);

  // Check if can redo
  const canRedo = useCallback((): boolean => {
    return currentIndex.current < historyStack.current.length - 1;
  }, []);

  // Clear history
  const clearHistory = useCallback(() => {
    historyStack.current = [];
    currentIndex.current = -1;
    lastSavedJson.current = "";

    if (onHistoryChange) {
      onHistoryChange(false, false);
    }
  }, [onHistoryChange]);

  // Setup keyboard shortcuts
  useEffect(() => {
    if (!canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + Z = Undo
      if (isCtrlOrCmd && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y = Redo
      else if (
        (isCtrlOrCmd && e.key === "z" && e.shiftKey) ||
        (isCtrlOrCmd && e.key === "y")
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canvas, undo, redo]);

  // Listen to canvas changes and save state
  useEffect(() => {
    if (!canvas) return;

    const handleObjectModified = () => {
      saveState();
    };

    const handleObjectAdded = () => {
      saveState();
    };

    const handleObjectRemoved = () => {
      saveState();
    };

    canvas.on("object:modified", handleObjectModified);
    canvas.on("object:added", handleObjectAdded);
    canvas.on("object:removed", handleObjectRemoved);

    // Save initial state
    if (historyStack.current.length === 0) {
      saveState();
    }

    return () => {
      canvas.off("object:modified", handleObjectModified);
      canvas.off("object:added", handleObjectAdded);
      canvas.off("object:removed", handleObjectRemoved);
    };
  }, [canvas, saveState]);

  return {
    undo,
    redo,
    canUndo: canUndo(),
    canRedo: canRedo(),
    saveState,
    clearHistory,
  };
}
