# Email Preview Component Documentation

## Overview
The Email Preview component provides a realistic preview of how emails will render for recipients, including subject line and HTML body content.

## Component Files

### **email-preview.tsx**
Two variants:
1. **EmailPreview** - Basic preview with subject and body
2. **EmailPreviewEnhanced** - Advanced preview with desktop/mobile toggle

## Features

### ✅ Basic Email Preview (EmailPreview)
- Subject line preview with icon
- HTML body rendering
- Email client chrome (window controls)
- Empty state placeholder
- Client rendering warning

### ✅ Enhanced Email Preview (EmailPreviewEnhanced)
- All basic features PLUS:
- Desktop/Mobile viewport toggle
- Responsive width (full-width vs 375px mobile)
- Smooth transitions between views
- Better visual hierarchy

## Visual Design

### Subject Card
```
┌─────────────────────────────────┐
│ 📧  SUBJECT                     │
│     Your Special Offer Awaits!  │
└─────────────────────────────────┘
```

### Email Client Chrome
```
┌─────────────────────────────────┐
│ 🔴 🟡 🟢  Email Client Preview  │
├─────────────────────────────────┤
│                                 │
│     [HTML Email Content]        │
│                                 │
└─────────────────────────────────┘
```

### Empty State
```
┌─────────────────────────────────┐
│           📧                     │
│   Nothing to preview yet.       │
│   Compose your email...         │
└─────────────────────────────────┘
```

## Usage

### Basic Usage
```tsx
import { EmailPreview } from "@/components/grow/campaign-studio/email-preview";

<EmailPreview
  subject="Summer Special: 20% OFF Everything!"
  bodyHtml="<h1>Welcome!</h1><p>Check out our amazing offers...</p>"
/>
```

### Enhanced Usage (with Desktop/Mobile Toggle)
```tsx
import { EmailPreviewEnhanced } from "@/components/grow/campaign-studio/email-preview";

<EmailPreviewEnhanced
  subject="Summer Special: 20% OFF Everything!"
  bodyHtml="<h1>Welcome!</h1><p>Check out our amazing offers...</p>"
  showWarning={true}
/>
```

### In Campaign Studio
```tsx
// Replace existing email preview section
{channel === "email" && (
  <EmailPreview
    subject={emailSubject}
    bodyHtml={emailBodyHtml}
  />
)}
```

## Props

### EmailPreviewProps
```typescript
interface EmailPreviewProps {
  /** Email subject line */
  subject?: string;
  
  /** HTML email body content */
  bodyHtml?: string;
  
  /** Show client rendering warning (default: true) */
  showWarning?: boolean;
}
```

## Styling Details

### Subject Card
- **Background**: Card background with border
- **Icon**: Primary color mail icon in rounded square
- **Typography**: 
  - Label: Uppercase, bold, small, muted
  - Subject: Bold, foreground color

### Email Body Container
- **Chrome Bar**:
  - Gray background (#f9fafb)
  - macOS-style window controls (red, yellow, green dots)
  - "Email Client Preview" label
  
- **Body Area**:
  - White background
  - Black text (for email content)
  - Max height: 600px with scroll
  - Padding: 24px (6 in Tailwind)

### Warning Alert
- **Color**: Blue scheme
- **Icon**: Info icon
- **Background**: Light blue (blue-50)
- **Border**: Blue-200
- **Text**: Blue-800

## Desktop vs Mobile Toggle (Enhanced Version)

### Desktop View
- Full width container
- Matches typical email client width
- Better for detailed content inspection

### Mobile View
- Fixed 375px width (iPhone SE/8 size)
- Centered in viewport
- Shows mobile rendering

### Toggle UI
```
[Desktop] [Mobile]
   ✓         
```
- Active state: Primary color background
- Inactive state: Transparent with hover effect
- Smooth transitions

## Empty States

### No Content
```tsx
<div className="text-center py-12">
  <Mail className="h-12 w-12 text-gray-300 mx-auto mb-3" />
  <p className="text-sm text-muted-foreground">
    Nothing to preview yet.
  </p>
  <p className="text-xs text-muted-foreground mt-1">
    Compose your email to see the preview
  </p>
</div>
```

### No Subject
- Shows "Untitled" as placeholder
- Muted styling to indicate missing data

## Security Considerations

### HTML Rendering
```tsx
<div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
```

⚠️ **Important**: 
- HTML is rendered as-is using `dangerouslySetInnerHTML`
- Ensure backend sanitizes HTML before sending
- Never render user input directly without sanitization
- Consider using DOMPurify for client-side sanitization

### Recommended Sanitization
```tsx
import DOMPurify from 'dompurify';

const sanitizedHtml = DOMPurify.sanitize(bodyHtml);
<div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
```

## Responsive Behavior

### Basic Component
- Full width on all devices
- Scrollable body content
- Stacks vertically on mobile

### Enhanced Component
- Desktop toggle: Full width
- Mobile toggle: Fixed 375px (may overflow on small screens)
- Centers preview in larger viewports

## Integration with Campaign Studio

### Current Implementation (Lines 1049-1067)
```tsx
{channel === "email" ? (
  <Card>
    <CardHeader>
      <CardTitle>Email preview</CardTitle>
      <CardDescription>How the message renders for a recipient.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject</p>
        <p className="mt-1 font-bold">{emailSubject || "Untitled"}</p>
      </div>
      <div className="rounded-xl border border-border bg-white p-4 text-black">
        {emailBodyHtml ? (
          <div dangerouslySetInnerHTML={{ __html: emailBodyHtml }} />
        ) : (
          <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
        )}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        This is a raw HTML preview, not a rendered-client simulation. 
        Different email clients may render it differently.
      </p>
    </CardContent>
  </Card>
) : (
  // WhatsApp poster preview
)}
```

### Upgrade to New Component
```tsx
import { EmailPreview } from "./email-preview";

{channel === "email" ? (
  <EmailPreview
    subject={emailSubject}
    bodyHtml={emailBodyHtml}
  />
) : (
  // WhatsApp poster preview
)}
```

## Styling Classes

### Main Container
- `rounded-xl` - Rounded corners
- `border border-border` - Subtle border
- `bg-white` - White background for email content
- `shadow-sm` - Subtle shadow
- `overflow-hidden` - Clip content to border radius

### Subject Section
- Icon container: `h-10 w-10 rounded-lg bg-primary/10`
- Label: `text-xs font-bold uppercase tracking-wider text-muted-foreground`
- Subject text: `font-bold text-foreground`

### Chrome Bar
- Background: `bg-gray-50 border-b border-gray-200`
- Window controls: `h-3 w-3 rounded-full` in red/yellow/green
- Label: `text-xs text-gray-600`

### Body Area
- Padding: `p-6`
- Text color: `text-black`
- Scroll: `max-h-[600px] overflow-y-auto`
- Min height: `min-h-[200px]`

## Accessibility

### ARIA Labels
```tsx
<div role="region" aria-label="Email preview">
  <div role="heading" aria-level={3}>SUBJECT</div>
  <div role="article" aria-label="Email content">
    {/* HTML content */}
  </div>
</div>
```

### Keyboard Navigation
- Scrollable content is keyboard accessible
- Toggle buttons have focus states
- Clear visual hierarchy

## Best Practices

### 1. Subject Line
- Keep under 50 characters for desktop
- Under 30 characters for mobile
- Avoid spam trigger words

### 2. HTML Content
- Use inline CSS (email clients strip `<style>` tags)
- Test with real email services
- Provide text alternative
- Optimize images (web-safe formats)

### 3. Preview Accuracy
- Shows raw HTML, not actual email client rendering
- Different clients handle HTML differently
- Consider using Litmus or Email on Acid for real testing

### 4. Performance
- Limit HTML size
- Lazy load images if needed
- Use semantic HTML

## Testing Checklist

- [ ] Preview loads with valid HTML
- [ ] Empty state shows correctly
- [ ] Subject displays properly
- [ ] Long subject lines truncate gracefully
- [ ] HTML content renders
- [ ] Scrolling works for long emails
- [ ] Warning message displays
- [ ] Mobile toggle works (enhanced version)
- [ ] Responsive on different screen sizes
- [ ] No XSS vulnerabilities (sanitized HTML)

## Future Enhancements

### Potential Features
1. **Dark Mode Preview** - Toggle dark/light email client theme
2. **Multiple Client Views** - Gmail, Outlook, Apple Mail presets
3. **Screenshot/Export** - Export preview as image
4. **Spam Score** - Check subject line for spam triggers
5. **A/B Testing** - Show multiple subject line variants
6. **Link Checker** - Verify all links work
7. **Image Loading** - Show how images load/fail
8. **Text Version** - Show plain text fallback

## Related Components

- **PosterPreview** - WhatsApp poster preview
- **PosterEditorClient** - Fabric.js poster editor
- **CampaignStudioClient** - Main campaign creation flow

## Example Templates

### Welcome Email
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #047857;">Welcome to Yummy!</h1>
  <p>Thank you for joining our loyalty program.</p>
  <a href="#" style="display: inline-block; padding: 12px 24px; background: #047857; color: white; text-decoration: none; border-radius: 6px;">
    Get Started
  </a>
</div>
```

### Promotion Email
```html
<div style="text-align: center; font-family: Arial, sans-serif;">
  <h2 style="color: #dc2626;">🔥 Flash Sale!</h2>
  <p style="font-size: 32px; font-weight: bold; color: #047857;">
    20% OFF
  </p>
  <p>Valid for 24 hours only!</p>
</div>
```

## Troubleshooting

### Issue: HTML not rendering
- Check that `bodyHtml` contains valid HTML
- Verify no script tags (should be sanitized)
- Check browser console for errors

### Issue: Subject line too long
- Truncate with CSS: `truncate` class
- Or limit in form validation

### Issue: Styles not applying
- Email HTML requires inline styles
- External stylesheets don't work in emails
- Use `style="..."` attributes

### Issue: Images not loading
- Check image URLs are absolute
- Verify CORS settings
- Use web-safe image formats (JPEG, PNG, GIF)

---

**Version**: 1.0.0
**Last Updated**: 2026-08-13
**Status**: Ready for production
