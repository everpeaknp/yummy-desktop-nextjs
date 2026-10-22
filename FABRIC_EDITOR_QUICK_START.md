# Fabric Editor - Quick Start Guide

Quick reference for developers working with the new Fabric.js poster editor.

---

## Enable/Disable Editor

**File:** `components/grow/campaign-studio/campaign-studio-client.tsx`  
**Line:** ~80

```typescript
// Enable new editor
const USE_FABRIC_EDITOR = true;

// Use existing HTML/CSS editor (default)
const USE_FABRIC_EDITOR = false;
```

---

## File Structure

```
frontend/
├── types/
│   └── fabric-poster.ts                    # Core types
├── lib/growth/fabric-templates/
│   ├── types.ts                            # Template types
│   ├── template-utils.ts                   # Template builders
│   └── index.ts                            # Public API
└── components/grow/campaign-studio/poster-editor/
    ├── PosterEditorClient.tsx              # Main editor component
    ├── FabricCanvas.tsx                    # Canvas wrapper
    ├── EditorToolbar.tsx                   # Toolbar controls
    ├── PropertiesPanel.tsx                 # Object properties
    ├── LayersPanel.tsx                     # Layer hierarchy
    └── hooks/
        ├── useFabricCanvas.ts              # Canvas lifecycle
        ├── useFabricHistory.ts             # Undo/redo
        └── useFabricExport.ts              # PNG export
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Delete` | Delete selected object(s) |
| `Ctrl+D` | Duplicate selected object(s) |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+Y` | Redo (alternative) |

---

## Common Tasks

### Create a New Template

```typescript
// lib/growth/fabric-templates/template-utils.ts

import { Canvas, Textbox, Rect, Gradient } from "fabric";
import type { FabricTemplateConfig } from "./types";

export function createMyTemplate(
  canvas: Canvas,
  config: FabricTemplateConfig
): void {
  // 1. Add background
  const gradient = new Gradient({
    type: "linear",
    coords: { x1: 0, y1: 0, x2: 0, y2: 2160 },
    colorStops: [
      { offset: 0, color: config.primaryColor },
      { offset: 1, color: config.secondaryColor },
    ],
  });
  
  canvas.backgroundColor = gradient;

  // 2. Add headline
  const headline = new Textbox(config.headline, {
    left: 1080,
    top: 800,
    width: 1800,
    fontSize: 120,
    fontWeight: "bold",
    fill: "#ffffff",
    textAlign: "center",
    originX: "center",
  });
  (headline as any).id = "headline";
  canvas.add(headline);

  // 3. Add more objects...
  
  canvas.requestRenderAll();
}
```

### Use the Hook System

```typescript
// In a component
import { useFabricCanvas } from "./hooks/useFabricCanvas";
import { useFabricHistory } from "./hooks/useFabricHistory";
import { useFabricExport } from "./hooks/useFabricExport";

function MyEditor() {
  const { canvas, isReady, deleteSelected, duplicateSelected } = useFabricCanvas({
    backgroundColor: "#ffffff",
  });

  const { undo, redo, canUndo, canRedo } = useFabricHistory({
    canvas,
  });

  const { exportToPNG } = useFabricExport({ canvas });

  return (
    <div>
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>
      <button onClick={deleteSelected}>Delete</button>
      <button onClick={async () => {
        const blob = await exportToPNG();
        // Do something with blob
      }}>Export</button>
    </div>
  );
}
```

### Add Custom Object to Canvas

```typescript
import { Textbox } from "fabric";
import { generateObjectId } from "@/types/fabric-poster";

// Add text with stable ID
const text = new Textbox("Hello World", {
  left: 100,
  top: 100,
  fontSize: 48,
});
(text as any).id = generateObjectId("text");
canvas.add(text);
canvas.requestRenderAll();
```

### Export PNG

```typescript
const { exportToHighResPNG } = useFabricExport({ canvas });

const blob = await exportToHighResPNG();
// Blob is ready for upload or download
```

---

## Type System

### Main Types

```typescript
// Canvas configuration
export interface FabricCanvasConfig {
  width: number;
  height: number;
  backgroundColor?: string;
}

// Object metadata
export interface FabricObjectMetadata {
  id: string;
  type: string;
  name?: string;
  locked?: boolean;
  templateVariable?: string;
}

// Template configuration
export interface FabricTemplateConfig {
  restaurantName: string;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  headline: string;
  offerLabel: string;
  expiresOn: string;
  terms: string;
}
```

---

## Testing the Editor

1. **Navigate to Campaign Studio:**
   ```
   http://localhost:3000/grow/campaign-studio
   ```

2. **Complete Steps 1 & 2:**
   - Choose audience
   - Define offer

3. **Go to Step 3 (Creative):**
   - Select WhatsApp channel
   - See new editor (if `USE_FABRIC_EDITOR = true`)

4. **Test Core Features:**
   - Add objects from toolbar
   - Move/resize objects
   - Edit properties in right panel
   - Use undo/redo
   - Export PNG
   - Check layers panel

---

## Debugging Tips

### Canvas Not Rendering?
```typescript
// Check canvas initialization
console.log("Canvas:", canvas);
console.log("Is Ready:", isReady);

// Force re-render
canvas?.requestRenderAll();
```

### Objects Not Appearing?
```typescript
// Check object was added
console.log("Objects:", canvas?.getObjects());

// Check object position
const obj = canvas?.getObjects()[0];
console.log("Position:", obj?.left, obj?.top);
console.log("Size:", obj?.width, obj?.height);
```

### History Not Working?
```typescript
// Check history state
const { canUndo, canRedo } = useFabricHistory({ canvas });
console.log("Can Undo:", canUndo);
console.log("Can Redo:", canRedo);
```

### Export Failing?
```typescript
try {
  const blob = await exportToPNG();
  console.log("Export success:", blob.size, "bytes");
} catch (error) {
  console.error("Export failed:", error);
}
```

---

## Performance Tips

1. **Limit History States:**
   - Default: 50 states
   - Prevents memory bloat
   - Configurable in `useFabricHistory.ts`

2. **Debounce Property Changes:**
   - Don't save history on every keystroke
   - Save on blur or after delay

3. **Optimize Images:**
   - Compress before upload
   - Use appropriate dimensions
   - Consider lazy loading

4. **Canvas Size:**
   - 2160×2160 is standard
   - Responsive in editor
   - Full res on export

---

## Common Errors & Solutions

### Error: "Cannot read property 'toDataURL' of null"
**Cause:** Canvas not initialized  
**Solution:** Check `isReady` before using canvas

### Error: "Type 'undefined' is not assignable to type 'string | TFiller'"
**Cause:** Setting backgroundColor to undefined  
**Solution:** Use `""` for transparent background

### Error: "Import not found: Button"
**Cause:** Wrong import casing  
**Solution:** Use `@/components/ui/button` (lowercase)

### Error: "Canvas methods not typed correctly"
**Cause:** Fabric v6 TypeScript definitions incomplete  
**Solution:** Use `(canvas as any).methodName()` for certain methods

---

## Next Steps

After Phase 1 testing:

1. **Phase 2: Template Migration**
   - Migrate Fresh template
   - Migrate Warm template
   - Migrate Minimal template
   - Migrate Ticket template

2. **Phase 2: Backend Integration**
   - Save Fabric JSON to database
   - Load Fabric JSON from database
   - Replace html2canvas in upload flow

3. **Phase 2: Advanced Features**
   - Font picker
   - Image cropping
   - Alignment guides
   - Zoom/pan controls

---

## Resources

- **Fabric.js Docs:** http://fabricjs.com/docs/
- **Fabric.js Examples:** http://fabricjs.com/demos/
- **GitHub:** https://github.com/fabricjs/fabric.js
- **TypeScript Types:** `node_modules/fabric/index.d.ts`

---

## Support

For questions or issues:
1. Check this guide first
2. Check `FABRIC_EDITOR_PHASE1_COMPLETE.md` for detailed documentation
3. Review inline JSDoc comments in source files
4. Consult Fabric.js official docs
5. Ask team lead or senior developer

---

**Last Updated:** 2026-08-13  
**Version:** Phase 1  
**Status:** Ready for testing
