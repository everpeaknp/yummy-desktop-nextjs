# Email Preview Component - Visual Examples

## Basic Email Preview Component

### Layout Structure
```
┌─────────────────────────────────────────────────────────┐
│  📧 Email preview                                       │
│  How the message renders for a recipient.              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  📧   SUBJECT                                     │ │
│  │       Summer Special: 20% OFF Everything!        │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  🔴 🟡 🟢  Email Client Preview                   │ │
│  ├───────────────────────────────────────────────────┤ │
│  │                                                   │ │
│  │  🎉 Special Offer Just for You!                  │ │
│  │                                                   │ │
│  │  Dear Valued Customer,                           │ │
│  │                                                   │ │
│  │  We're excited to offer you an exclusive         │ │
│  │  20% discount on your next order!                │ │
│  │                                                   │ │
│  │  ┌───────────────────┐                           │ │
│  │  │  CLAIM OFFER NOW  │                           │ │
│  │  └───────────────────┘                           │ │
│  │                                                   │ │
│  │  Valid until: August 31, 2026                    │ │
│  │  Minimum order: Rs. 600                          │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ℹ️  This is a raw HTML preview, not a               │
│     rendered-client simulation...                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Enhanced Email Preview (with Desktop/Mobile Toggle)

### Desktop View
```
┌─────────────────────────────────────────────────────────┐
│  📧 Email preview              [Desktop] [Mobile]       │
│  How the message renders for a recipient.              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  📧   SUBJECT                                     │ │
│  │       Your Weekly Deals Are Here!                │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  🔴 🟡 🟢  Desktop View                           │ │
│  ├───────────────────────────────────────────────────┤ │
│  │                                                   │ │
│  │  [Full-width email content - 100% width]         │ │
│  │                                                   │ │
│  │  ┌─────────────┐  ┌─────────────┐               │ │
│  │  │   Deal 1    │  │   Deal 2    │               │ │
│  │  │  [Image]    │  │  [Image]    │               │ │
│  │  │   20% OFF   │  │   15% OFF   │               │ │
│  │  └─────────────┘  └─────────────┘               │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Mobile View
```
┌─────────────────────────────────────────────────────────┐
│  📧 Email preview              [Desktop] [Mobile]       │
│  How the message renders for a recipient.              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  📧   SUBJECT                                     │ │
│  │       Your Weekly Deals Are Here!                │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│           ┌───────────────────┐                         │
│           │ 🔴 🟡 🟢 Mobile   │                         │
│           ├───────────────────┤                         │
│           │                   │                         │
│           │  [Mobile width]   │                         │
│           │  375px fixed      │                         │
│           │                   │                         │
│           │  ┌─────────────┐ │                         │
│           │  │   Deal 1    │ │                         │
│           │  │  [Image]    │ │                         │
│           │  │   20% OFF   │ │                         │
│           │  └─────────────┘ │                         │
│           │  ┌─────────────┐ │                         │
│           │  │   Deal 2    │ │                         │
│           │  │  [Image]    │ │                         │
│           │  │   15% OFF   │ │                         │
│           │  └─────────────┘ │                         │
│           │                   │                         │
│           └───────────────────┘                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Empty State

```
┌─────────────────────────────────────────────────────────┐
│  📧 Email preview                                       │
│  How the message renders for a recipient.              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  📧   SUBJECT                                     │ │
│  │       Untitled                                    │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  🔴 🟡 🟢  Email Client Preview                   │ │
│  ├───────────────────────────────────────────────────┤ │
│  │                                                   │ │
│  │                                                   │ │
│  │                    📧                             │ │
│  │                                                   │ │
│  │         Nothing to preview yet.                  │ │
│  │      Compose your email to see the preview       │ │
│  │                                                   │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Real-World Email Examples

### Example 1: Restaurant Promotion
```html
Subject: "🍕 Pizza Tuesday: Buy 1 Get 1 Free!"

Body:
┌─────────────────────────────────────────┐
│  🔴 🟡 🟢  Email Client Preview         │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │    BELLA PASTA RESTAURANT       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  🍕 Pizza Tuesday Special!              │
│                                         │
│  Buy 1 Get 1 FREE on all pizzas!       │
│                                         │
│  Every Tuesday from 5 PM - 9 PM        │
│                                         │
│  ┌─────────────────────┐               │
│  │   ORDER NOW         │               │
│  └─────────────────────┘               │
│                                         │
│  Valid only on dine-in orders          │
│  Offer ends: August 27, 2026           │
│                                         │
└─────────────────────────────────────────┘
```

### Example 2: Birthday Offer
```html
Subject: "🎂 Happy Birthday! Here's Your Special Gift"

Body:
┌─────────────────────────────────────────┐
│  🔴 🟡 🟢  Email Client Preview         │
├─────────────────────────────────────────┤
│                                         │
│  🎉 HAPPY BIRTHDAY!                     │
│                                         │
│  Dear Sarah,                            │
│                                         │
│  Celebrate your special day with us!   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │        YOUR GIFT                │   │
│  │                                 │   │
│  │      🎁 30% OFF                 │   │
│  │                                 │   │
│  │    Valid for 7 days             │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────┐               │
│  │   REDEEM OFFER      │               │
│  └─────────────────────┘               │
│                                         │
│  Valid until: August 20, 2026          │
│  Use code: BDAY2026                    │
│                                         │
│  Team Yummy ❤️                          │
│                                         │
└─────────────────────────────────────────┘
```

### Example 3: Weekly Newsletter
```html
Subject: "Your Weekly Menu Updates 📋"

Body:
┌─────────────────────────────────────────┐
│  🔴 🟡 🟢  Email Client Preview         │
├─────────────────────────────────────────┤
│                                         │
│  📋 THIS WEEK'S HIGHLIGHTS              │
│                                         │
│  Hello Foodie! 👋                       │
│                                         │
│  Check out what's new this week:       │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  🍝 New Italian Menu             │   │
│  │  Fresh pasta dishes added        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  🥗 Healthy Bowls                │   │
│  │  Low-calorie options             │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  🍰 Weekend Desserts             │   │
│  │  Special treats Sat & Sun        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────┐               │
│  │   VIEW FULL MENU    │               │
│  └─────────────────────┘               │
│                                         │
└─────────────────────────────────────────┘
```

## Component States

### Loading State
```
┌─────────────────────────────────────────┐
│  📧 Email preview                       │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Loading preview...             │   │
│  │  ⏳                              │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Error State
```
┌─────────────────────────────────────────┐
│  📧 Email preview                       │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  ⚠️  Error loading preview       │   │
│  │  Please check your HTML format  │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

## Color Scheme

### Subject Card
- Background: `bg-card` (light gray)
- Border: `border-border` (subtle gray)
- Icon background: `bg-primary/10` (10% primary color)
- Icon: `text-primary`
- Label text: `text-muted-foreground`
- Subject text: `text-foreground` (black/dark)

### Email Body Container
- Chrome bar: `bg-gray-50`
- Window controls: `bg-red-400`, `bg-yellow-400`, `bg-green-400`
- Body background: `bg-white`
- Body text: `text-black`

### Warning Alert
- Background: `bg-blue-50`
- Border: `border-blue-200`
- Icon: `text-blue-600`
- Text: `text-blue-800`

## Responsive Breakpoints

### Mobile (< 640px)
- Full width container
- Stacked layout
- Smaller padding

### Tablet (640px - 1024px)
- Centered preview
- Comfortable padding
- Side margins

### Desktop (> 1024px)
- Full layout with sidebars
- Maximum content width
- Optimal reading experience

## Interaction States

### Desktop/Mobile Toggle Buttons

#### Inactive
```
┌─────────────────┐
│  Desktop        │ ← Transparent with hover
└─────────────────┘
```

#### Active
```
┌─────────────────┐
│  Desktop        │ ← Primary color background
└─────────────────┘
```

#### Hover
```
┌─────────────────┐
│  Mobile         │ ← Muted background
└─────────────────┘
```

## Accessibility Features

### Screen Reader Markup
```html
<div role="region" aria-label="Email preview">
  <div role="heading" aria-level="3">
    SUBJECT
  </div>
  <p aria-label="Email subject">
    Summer Special: 20% OFF Everything!
  </p>
  
  <div role="article" aria-label="Email content">
    <!-- HTML email content -->
  </div>
  
  <div role="note" aria-label="Preview disclaimer">
    This is a raw HTML preview...
  </div>
</div>
```

### Keyboard Navigation
- Tab through interactive elements
- Scroll body with arrow keys
- Toggle buttons accessible via keyboard
- Focus indicators visible

## Animation & Transitions

### View Mode Toggle
```css
transition: width 300ms ease-in-out
```
- Smooth width transition when switching desktop/mobile
- Duration: 300ms
- Easing: ease-in-out

### Hover States
```css
transition: background-color 150ms ease
```
- Button hover effects
- Duration: 150ms
- Easing: ease

## Print Styles

### Print Media Query
```css
@media print {
  .email-preview-chrome {
    display: none; /* Hide window controls */
  }
  
  .email-preview-warning {
    display: none; /* Hide warning */
  }
  
  .email-preview-body {
    max-height: none; /* Remove scroll */
    page-break-inside: avoid;
  }
}
```

---

**Component**: EmailPreview & EmailPreviewEnhanced
**Last Updated**: 2026-08-13
**Status**: Ready for use
