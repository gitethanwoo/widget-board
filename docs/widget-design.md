# Widget content and layout

Applied Apple's current [widget guidelines](https://developer.apple.com/design/human-interface-guidelines/widgets) and [WidgetKit appearance guidance](https://developer.apple.com/documentation/widgetkit/preparing-widgets-for-additional-contexts-and-appearances) on November 10, 2026.

The component set comes from a reviewed catalog of 28 designs, grouped by the question a glance answers (how much, how are the parts doing, when, what should I remember, is it done yet, is everything OK, which way is it heading). Each design is a complete example spec in `server/src/examples.ts`. That file is the single source for what `get_examples` returns to agents, what the site preview draws, and what the iOS render tests draw.

## Presentation contract

- One canvas per account. Changing widget size never changes the underlying data.
- **One design is one leaf.** A chart, bar or list belongs to the component that draws it, so a small widget never shows a number without the picture that explains it.
- The first leaf in document order is the headline. A small widget shows that leaf in its compact layout.
- A medium widget shows the first leaf on the left and at most the next two leaves in a supporting column on the right, separated by a hairline. If both supporting leaves do not fit the height, only the first is shown.
- When a medium widget has only one leaf, that leaf uses its wide layout: its chart or list moves into the right half, or it takes the full width.
- Remaining content is available in the app and the website's detail disclosure. Row containers preserve priority order but do not dictate the widget's layout.
- System typography, semantic colors, and WidgetKit's default content margins. VoiceOver reads combined labels and values, and sensitive content retains privacy redaction.
- Larger accessibility sizes show only the first leaf in its compact layout. Number fitting preserves the complete value. Optional lines (supporting text under a chart) are dropped before anything is clipped.
- Agents never send colors or timestamps. Tone is semantic. `Board.showUpdated` asks the phone to draw "Updated 7:02 AM" from the save time, in a small quiet footer pinned to the bottom of the primary area; the content centers in the space above it. The save time does not claim an external source sync.
- `Board.alert` paints the widget orange with dark ink and suppresses tone colors, in full-color rendering only. Tinted and clear Home Screens remove the background, so the words must carry the message.
- MCP initialization, the tool descriptions, the component schema and `get_examples` teach the same principle: start with one useful answer, then remove every word or element that does not change its meaning. A medium widget's capacity is not a quota.

## Sizes and spacing

Text sizes are the points used in the reviewed mockups; the native renderer uses the nearest Dynamic Type style.

| Role | Size |
| --- | --- |
| Label, supporting text | 12, secondary |
| Headline value | 34 rounded semibold (large), 26 (medium, used above a chart or for a phrase), 19 (in the supporting column) |
| List rows | 12 to 12.5; bar-row captions and end captions 11 |
| Chart axis letters | 9 |
| Updated footer | 10, secondary |

- Stacked text is 7 points apart. A bar, step bar or split bar under a headline value needs 12; a chart, column chart or grid needs 15. Text that tight against a chart reads as cramped.
- Captions under a bar stay on one line: one caption at each end rather than a wrapped sentence.
- Grids and charts fill the width they are given.
- Tracks and empty cells use the system fill gray. Bars are 6 points tall with full rounding.

## Component layouts

Compact is the small widget and the left side of a medium widget that has supporting leaves. Wide is a medium widget with a single leaf. Supporting is the right column of a medium widget.

| Component | Compact | Wide | Supporting |
| --- | --- | --- | --- |
| Stat | Label, large value, change chip, supporting text. An empty label is omitted. | Same, full width. | Label, small value. |
| Progress | Label, large headline (`display`, or the percentage), bar with optional pace tick, then supporting text. With `trailingText`, the two sit at opposite ends of one line. | Same, full width. | Label, small headline, bar. |
| Ring | 78-point ring with the percentage inside, then label and supporting text. | 104-point ring on the left; label and supporting text on the right. | Label, small percentage. |
| Trend | Label, value, line chart (2-point line, faint area fill, dot on the last point). A goal draws a dashed line labeled Goal. Supporting text only if it fits. | Label, large value and supporting text on the left; a taller chart on the right. | Label, small value. |
| Columns | Label, medium value, up to seven columns with a letter under each. The highlighted column is accent; `null` draws a stub. Supporting text only if it fits. | Label, large value and supporting text on the left; taller columns on the right. | Label, small value. |
| BarList | Optional label, then rows of name, right-aligned value and a bar; change chip last. A `default` tone is a quiet gray baseline bar. | With a change chip: label, first row's value large and the chip on the left, bars on the right. Otherwise full width. | The rows. |
| Split | Label, medium value, segmented bar, first two legend rows. Segment colors are a fixed categorical order; the fourth is gray. | Label, large value and bar on the left; every legend row on the right. | Label, small value. |
| Rows | Optional label, then rows of marker, name and right-aligned value. Without a marker the value is semibold in its tone. With a marker the value is quiet unless the tone is warn or bad. Icons: good is a check, warn an exclamation, bad a cross, accent a filled dot, default a hollow ring. | Full width; each value is followed by its `detail`. | Same as compact. |
| Agenda | Label, then rows of a fixed-width time and one line of text. | Full width. | Same as compact. |
| Dots | Label, medium value, a 14-point dot per day with its letter. Done is the tone color, today an open ring, missed and upcoming gray. | Same as compact. | Label and 10-point dots without letters. |
| Grid | One line with the label on the left and the value on the right, then a seven-column grid of rounded squares that fills the width. | Label, large value and supporting text on the left; the grid on the right. | Label, small value. |
| Checklist | Label with the count left ("Before we go · 2 left"), then three items, open ones first. Done items are struck through with a check. | Three items on the left; "4 of 6 done" and the next three on the right. With three or fewer items, full width. | Label and the first items that fit. |
| Steps | Label, the current step's name as a medium value, a segmented bar (done faded, current solid, upcoming gray), then "Step 3 of 4" followed by the supporting text. | Compact on the left; every step with a check, filled dot or hollow ring on the right, and "now" on the current one. | Label, current step as a small value. |
| Note | Optional status icon, optional byline, the text (loud is rounded bold), supporting text if it fits. | Same, full width; loud text is larger. | Two lines of footnote text. |

A change chip is a small capsule: an arrow from `direction`, the text, and a color from `sentiment` (good is green, bad is red, neutral is gray).

## Verification

Every example spec is validated against the schema in the site's test suite, so an example cannot drift from the contract. The iOS render test decodes the same specs and draws each at 158×158 and 338×158 points. The rendered images are compared against the reviewed mockups.

Real Home Screen verification is separate from these renders and from a successful app installation.
