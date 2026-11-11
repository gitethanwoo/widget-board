import SwiftUI
import WidgetKit

/// A glance, sized for its WidgetKit family. Full content lives in BoardDetails.
///
/// Small shows the first leaf in its compact layout. Medium shows the first
/// leaf with up to two supporting leaves beside it, or a single leaf in its
/// wide layout. Larger accessibility sizes show only the first leaf.
struct BoardView: View {
    let board: Board
    var family: WidgetFamily = .systemSmall
    /// The moment being drawn, which decides whether the footer needs a date.
    var now: Date = .now
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.widgetRenderingMode) private var renderingMode

    var body: some View {
        let content = BoardContent(spec: board.spec)
        let expanded = family == .systemMedium && !dynamicTypeSize.isAccessibilitySize
        let blocks = content.summary(includingSupportingDetails: expanded)
        let fullColor = renderingMode == .fullColor
        let palette = BoardPalette(alert: content.alert && fullColor, fullColor: fullColor)
        Group {
            if let primary = blocks.first {
                let supporting = Array(blocks.dropFirst())
                let footer = content.showUpdated ? BoardFooter.text(updatedAt: board.updatedAt, now: now) : nil
                if supporting.isEmpty {
                    PrimaryArea(element: primary.element, layout: expanded ? .wide : .compact, footer: footer)
                } else {
                    BoardColumns {
                        PrimaryArea(element: primary.element, layout: .compact, footer: footer)
                    } right: {
                        SupportingColumn(blocks: supporting)
                    }
                }
            } else {
                Text("Ask your agent to put something here.").font(.callout)
            }
        }
        .foregroundStyle(palette.ink)
        .environment(\.boardPalette, palette)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

/// The app has room to read every field, including qualifications and source notes.
struct BoardDetails: View {
    let board: Board

    var body: some View {
        let content = BoardContent(spec: board.spec)
        ForEach(content.blocks) { block in
            BoardLeafView(element: block.element, layout: .detail)
                .padding(.vertical, 6)
        }
    }
}

/// The headline leaf, with the "Updated" footer pinned under it when the
/// board asks for one. The leaf centers in the space above the footer.
private struct PrimaryArea: View {
    let element: Element
    let layout: LeafLayout
    let footer: String?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.boardPalette) private var palette
    @ScaledMetric(relativeTo: .caption2) private var footerSize: CGFloat = 10

    var body: some View {
        if let footer {
            VStack(alignment: .leading, spacing: 4) {
                leaf.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                Text(footer)
                    .font(.system(size: min(footerSize, 13)))
                    .foregroundStyle(palette.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        } else {
            leaf
        }
    }

    /// At accessibility sizes the complete leaf is kept by stepping the text
    /// size down until it fits, rather than clipping it. While the text is
    /// larger than the design size, list rows may wrap onto a second line.
    @ViewBuilder private var leaf: some View {
        let view = BoardLeafView(element: element, layout: layout)
        if dynamicTypeSize.isAccessibilitySize {
            let wrapping = view.environment(\.boardRowLines, 2)
            ViewThatFits(in: .vertical) {
                wrapping.fixedSize(horizontal: false, vertical: true)
                wrapping.dynamicTypeSize(...DynamicTypeSize.xxxLarge).fixedSize(horizontal: false, vertical: true)
                view.dynamicTypeSize(...DynamicTypeSize.large)
            }
        } else {
            view
        }
    }
}

/// Up to two leaves beside the headline. The second goes when both do not fit.
private struct SupportingColumn: View {
    let blocks: [BoardContent.Block]

    var body: some View {
        if blocks.count > 1 {
            ViewThatFits(in: .vertical) {
                VStack(alignment: .leading, spacing: 11) {
                    ForEach(blocks) { block in
                        BoardLeafView(element: block.element, layout: .supporting)
                    }
                }
                BoardLeafView(element: blocks[0].element, layout: .supporting)
            }
        } else if let block = blocks.first {
            BoardLeafView(element: block.element, layout: .supporting)
        }
    }
}

#if DEBUG
#Preview("Small") {
    BoardView(board: BoardSamples.spending)
        .padding(16).frame(width: 170, height: 170)
        .background(.background, in: RoundedRectangle(cornerRadius: 24))
}
#Preview("Medium · dark") {
    BoardView(board: BoardSamples.spending, family: .systemMedium)
        .padding(16).frame(width: 364, height: 170)
        .background(.background, in: RoundedRectangle(cornerRadius: 24))
        .preferredColorScheme(.dark)
}
#Preview("Reminder") {
    BoardView(board: BoardSamples.reminder)
        .padding(16).frame(width: 170, height: 170)
}
#endif
