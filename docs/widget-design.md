# Widget content and layout

Applied Apple's current [widget guidelines](https://developer.apple.com/design/human-interface-guidelines/widgets) and [WidgetKit appearance guidance](https://developer.apple.com/documentation/widgetkit/preparing-widgets-for-additional-contexts-and-appearances) on November 10, 2026.

The widget had been rendering the complete canvas in every size. The budget's headline, two related figures, long source note, repeated captions, and timestamp competed for the same small area.

## Presentation contract

- One canvas per account. Changing widget size never changes the underlying data.
- The first leaf in document order is the headline. A small widget shows that leaf; medium adds at most the next two in a supporting column.
- Remaining content is available in the app and the website's detail disclosure. Row containers preserve priority order but do not dictate the widget's layout.
- System typography, semantic colors, and WidgetKit's default content margins. No timestamp on the widget. VoiceOver reads combined labels and values, and sensitive content retains privacy redaction.
- Larger accessibility sizes omit secondary content. Number fitting preserves the complete value in the verified large-text case. Reminders select a fitting text style instead of forcing a full report into the widget.
- A Stat shows a label, prominent value, and optional `supportingText`, such as a meaningful comparison. These stay together even in a small widget; no separate Note is needed. Container titles, captions, and save time appear only in the full detail view. The save time does not claim an external source sync.
- MCP initialization, the write tool description, and the component schema teach the same principle: start with one useful answer, then remove every word or element that does not change its meaning. A medium widget's capacity is not a quota. Preserve necessary time periods, units, and exclusions; keep explanations in details. For weekly spending excluding housing, show “Week · excluding housing” and the verified amount, without adding unrelated totals or a budget.

## Verification

Native projection tests preserve every field for the detail view while selecting one or three for widgets, including safe handling of malformed legacy graphs. Ten SwiftUI image renders cover small and medium budget layouts, a styled metric with a comparison, dark appearance, accessibility text, a reminder, and progress. They use synthetic fixture values at 158×158 and 338×158 points. The rendered images were visually inspected and corrected for text fitting.

The website has matching Small/Medium preview controls and a full-detail disclosure. Its selection tests and TypeScript checks pass. Real Home Screen verification is separate from these renders and from a successful app installation.
