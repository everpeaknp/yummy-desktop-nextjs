"use client";

/**
 * Toolbar for the Fabric poster editor
 */

import { Button } from "@/components/ui/button";
import {
  Type,
  Image,
  Square,
  Circle,
  Trash2,
  Copy,
  Undo,
  Redo,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
} from "lucide-react";

export interface EditorToolbarProps {
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onAddText: () => void;
  onAddImage: () => void;
  onAddRectangle: () => void;
  onAddCircle: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
}

export function EditorToolbar({
  hasSelection,
  canUndo,
  canRedo,
  onAddText,
  onAddImage,
  onAddRectangle,
  onAddCircle,
  onDelete,
  onDuplicate,
  onUndo,
  onRedo,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-2 p-3 bg-white border-b border-gray-200">
      {/* Add tools */}
      <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddText}
          title="Add Text (T)"
        >
          <Type className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddImage}
          title="Add Image (I)"
        >
          <Image className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddRectangle}
          title="Add Rectangle (R)"
        >
          <Square className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddCircle}
          title="Add Circle (C)"
        >
          <Circle className="h-4 w-4" />
        </Button>
      </div>

      {/* History controls */}
      <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
        <Button
          variant="ghost"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      {/* Object controls */}
      <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDuplicate}
          disabled={!hasSelection}
          title="Duplicate (Ctrl+D)"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete (Del)"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Layer controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBringToFront}
          disabled={!hasSelection}
          title="Bring to Front"
        >
          <ChevronsUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBringForward}
          disabled={!hasSelection}
          title="Bring Forward"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSendBackward}
          disabled={!hasSelection}
          title="Send Backward"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSendToBack}
          disabled={!hasSelection}
          title="Send to Back"
        >
          <ChevronsDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
