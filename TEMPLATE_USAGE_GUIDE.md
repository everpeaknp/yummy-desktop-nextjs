# Poster Template Usage Guide

## Quick Start

### Import Templates
```typescript
import {
  createFreshTemplate,
  createWarmTemplate,
  createMinimalTemplate,
  createTicketTemplate,
  type FabricTemplateConfig,
} from "@/lib/growth/fabric-templates";
```

### Basic Usage
```typescript
const config: FabricTemplateConfig = {
  restaurantName: "Bella Pasta",
  logoUrl: "/path/to/logo.png",
  primaryColor: "#047857",
  secondaryColor: "#10b981",
  headline: "Summer Special",
  offerLabel: "20% OFF",
  expiresOn: "31 Aug 2026",
  terms: "Valid on orders above Rs.600. Cannot be combined with other offers.",
};

// Create template
const template = createFreshTemplate(config);

// Use with Fabric.js canvas
canvas.loadFromJSON(template.fabricJSON, () => {
  canvas.requestRenderAll();
});
```

## Template Selection Guide

### 🌿 Fresh Template
**Best for:**
- Spring/summer campaigns
- New menu launches
- Health-focused offers
- Modern, trendy restaurants

**Visual Style:**
- Vibrant green gradient
- Floating card design
- Modern and energetic
- High visual impact

**Use when:**
- Target audience is young/modern
- Offer is exciting/limited-time
- Want to stand out in feed

### 🔥 Warm Template
**Best for:**
- Comfort food promotions
- Family restaurants
- Seasonal campaigns (autumn/winter)
- Welcome offers

**Visual Style:**
- Warm orange/amber tones
- Centered, balanced layout
- Friendly and inviting
- Gift-focused

**Use when:**
- Building emotional connection
- Loyalty rewards
- Family-oriented messaging
- Want warm, welcoming feel

### 🎨 Minimal Template
**Best for:**
- Fine dining establishments
- Premium offers
- Exclusive deals
- Upscale brands

**Visual Style:**
- Dark, elegant background
- Subtle accent glows
- Left-aligned modern layout
- Sophisticated and premium

**Use when:**
- Targeting affluent customers
- High-value offers
- Want to convey exclusivity
- Brand is premium/luxury

### 🎟️ Ticket Template
**Best for:**
- Voucher campaigns
- Gift certificates
- Redemption offers
- Event promotions

**Visual Style:**
- Split panel design
- Ticket/voucher aesthetic
- Unique perforated edge
- Memorable and distinctive

**Use when:**
- Offer is redeemable/voucher-like
- Want coupon aesthetic
- Creating gift-worthy design
- Stand-out visual needed

## Configuration Options

### Required Fields
```typescript
{
  restaurantName: string;    // Display name
  logoUrl?: string | null;   // Optional logo URL
  primaryColor: string;      // Brand color (hex)
  secondaryColor: string;    // Accent color (hex)
  headline: string;          // Main offer headline
  offerLabel: string;        // e.g., "20% OFF"
  expiresOn: string;         // Expiry date
  terms: string;             // Terms & conditions
}
```

### Color Recommendations

#### Fresh Template
- Primary: #047857 (emerald green)
- Secondary: #10b981 (lighter green)
- Works well: Green, teal, fresh colors

#### Warm Template
- Primary: #f59e0b (amber)
- Secondary: #f97316 (orange)
- Works well: Orange, amber, warm tones

#### Minimal Template
- Primary: #8b5cf6 (purple)
- Secondary: Any dark accent
- Works well: Purple, blue, any bold accent on dark

#### Ticket Template
- Primary: #3b82f6 (blue)
- Secondary: Any complementary
- Works well: Blue, red, any voucher-appropriate color

## Advanced Usage

### Dynamic Template Selection
```typescript
function getTemplateForCampaign(style: string, config: FabricTemplateConfig) {
  const templates = {
    fresh: createFreshTemplate,
    warm: createWarmTemplate,
    minimal: createMinimalTemplate,
    ticket: createTicketTemplate,
  };
  
  const createFn = templates[style] || createFreshTemplate;
  return createFn(config);
}
```

### Updating Template Variables
```typescript
import { applyTemplateVariables } from "@/lib/growth/fabric-templates";

const updatedTemplate = applyTemplateVariables(template, {
  headline: "New Headline",
  offerLabel: "30% OFF",
});
```

### Color Utilities
```typescript
import { safeHex, getTemplateColors } from "@/lib/growth/fabric-templates";

// Validate hex color
const color = safeHex(userInput, "#047857"); // Falls back if invalid

// Get template colors
const { primary, secondary } = getTemplateColors("fresh", TEMPLATE_COLORS);
```

## React Component Example

```tsx
"use client";

import { useState } from "react";
import { Canvas } from "fabric";
import {
  createFreshTemplate,
  createWarmTemplate,
  createMinimalTemplate,
  createTicketTemplate,
} from "@/lib/growth/fabric-templates";

export function PosterTemplateSelector() {
  const [templateId, setTemplateId] = useState("fresh");
  const [canvas, setCanvas] = useState<Canvas | null>(null);

  const templates = {
    fresh: createFreshTemplate,
    warm: createWarmTemplate,
    minimal: createMinimalTemplate,
    ticket: createTicketTemplate,
  };

  const loadTemplate = (id: string) => {
    if (!canvas) return;
    
    const config = {
      restaurantName: "Demo Restaurant",
      primaryColor: "#047857",
      secondaryColor: "#10b981",
      headline: "Special Offer",
      offerLabel: "20% OFF",
      expiresOn: "31 Dec 2026",
      terms: "Valid on orders above Rs.600",
    };

    const template = templates[id](config);
    canvas.loadFromJSON(template.fabricJSON, () => {
      canvas.requestRenderAll();
    });
    
    setTemplateId(id);
  };

  return (
    <div>
      <select value={templateId} onChange={(e) => loadTemplate(e.target.value)}>
        <option value="fresh">🌿 Fresh - Modern & Vibrant</option>
        <option value="warm">🔥 Warm - Friendly & Centered</option>
        <option value="minimal">🎨 Minimal - Dark & Elegant</option>
        <option value="ticket">🎟️ Ticket - Split Panel</option>
      </select>
      
      <canvas ref={(el) => {
        if (el && !canvas) {
          const fabricCanvas = new Canvas(el, {
            width: 2160,
            height: 2160,
          });
          setCanvas(fabricCanvas);
          loadTemplate("fresh");
        }
      }} />
    </div>
  );
}
```

## Best Practices

### 1. Color Consistency
- Always provide both primary and secondary colors
- Use brand colors for consistency
- Test contrast for readability

### 2. Text Length
- Headlines: Keep under 40 characters
- Offer labels: Short and punchy (e.g., "20% OFF")
- Terms: Be concise but complete

### 3. Template Selection
- Match template to offer type
- Consider target audience
- Align with brand personality
- Test multiple templates for performance

### 4. Image Quality
- Templates output at 2160×2160 (high-res)
- Suitable for Instagram, Facebook, print
- Export as PNG for best quality

### 5. Testing
- Preview on mobile devices
- Check readability at thumbnail size
- Verify color contrast
- Test with different text lengths

## Troubleshooting

### Template not rendering?
- Check Fabric.js version (6.0.0+)
- Verify config object has all required fields
- Ensure canvas is initialized

### Colors look wrong?
- Verify hex format (#RRGGBB)
- Use `safeHex()` utility for validation
- Check color contrast on dark/light backgrounds

### Text overflow?
- Reduce text length
- Adjust fontSize in template objects
- Use multi-line text with lineHeight

### Export quality low?
- Canvas is 2160×2160 by default
- Export at 1x scale for full resolution
- Use PNG format for best quality

## Resources

- Fabric.js Docs: https://fabricjs.com/docs
- Color Picker: https://coolors.co
- Typography Guide: Google Fonts
- Template Examples: See `POSTER_TEMPLATES_REDESIGN_COMPLETE.md`

---

**Last Updated**: 2026-08-13
**Version**: 1.0.0
**Templates**: Fresh, Warm, Minimal, Ticket
