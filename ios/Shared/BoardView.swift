import SwiftUI
import WidgetKit

/// A glance, sized for its WidgetKit family. Full content lives in BoardDetails.
struct BoardView: View {
    let board: Board
    var family: WidgetFamily = .systemSmall
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let content = BoardContent(spec: board.spec)
        let expanded = family == .systemMedium && !dynamicTypeSize.isAccessibilitySize
        let blocks = content.summary(includingSupportingDetails: expanded)
        Group {
            if let primary = blocks.first {
                HStack(alignment: .center, spacing: 16) {
                    BoardBlockView(element: primary.element, prominence: .primary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if blocks.count > 1 {
                        Divider()
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(Array(blocks.dropFirst())) { block in
                                BoardBlockView(element: block.element, prominence: .supporting)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            } else {
                Text("Ask your agent to put something here.").font(.callout)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

}

/// The app has room to read every field, including qualifications and source notes.
struct BoardDetails: View {
    let board: Board

    var body: some View {
        let content = BoardContent(spec: board.spec)
        ForEach(content.blocks) { block in
            BoardBlockView(element: block.element, prominence: .detail)
                .padding(.vertical, 6)
        }
    }
}

private enum BlockProminence {
    case primary, supporting, detail
}

private struct BoardBlockView: View {
    let element: Element
    let prominence: BlockProminence
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var detailed: Bool { prominence == .detail }
    private var supporting: Bool { prominence == .supporting }
    private var valueFont: Font { supporting ? .title3.weight(.semibold) : .largeTitle.weight(.semibold) }

    var body: some View {
        Group {
            switch element.kind {
            case .stat(let props):
                if detailed || props.supportingText == nil {
                    stat(props)
                } else {
                    ViewThatFits(in: .vertical) {
                        stat(props).fixedSize(horizontal: false, vertical: true)
                        stat(props)
                            .dynamicTypeSize(...DynamicTypeSize.large)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            case .progress(let props):
                VStack(alignment: .leading, spacing: supporting ? 3 : 5) {
                    label(props.label)
                    Text(props.value, format: .percent.precision(.fractionLength(0)))
                        .font(supporting ? .title3.weight(.semibold) : .title.weight(.semibold))
                        .fontDesign(.rounded)
                        .foregroundStyle(props.tone.color)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .privacySensitive()
                    Capsule()
                        .fill(.quaternary)
                        .frame(height: 5)
                        .overlay(alignment: .leading) {
                            GeometryReader { geometry in
                                Capsule().fill(props.tone.color)
                                    .frame(width: geometry.size.width * min(max(props.value, 0), 1))
                            }
                        }
                        .accessibilityHidden(true)
                    caption(props.caption)
                }
            case .note(let props):
                if detailed {
                    Text(props.text).font(.body).privacySensitive()
                } else if supporting {
                    Text(props.text).font(.footnote).lineLimit(2).privacySensitive()
                } else {
                    ViewThatFits(in: .vertical) {
                        Text(props.text)
                            .font(props.loud ? .title3.weight(.semibold) : .headline)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(props.text)
                            .font(.subheadline.weight(props.loud ? .semibold : .regular))
                            .fixedSize(horizontal: false, vertical: true)
                        Text(props.text).font(.footnote).lineLimit(4)
                    }
                    .privacySensitive()
                }
            case .board, .row, .unknown:
                EmptyView()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    /// Fit the complete metric into the widget before falling back to compact text.
    /// The app detail view remains fully responsive to the preferred text size.
    private func stat(_ props: StatProps) -> some View {
        VStack(alignment: .leading, spacing: supporting ? 2 : 4) {
            label(props.label)
            Text(props.value)
                .font(valueFont)
                .fontDesign(.rounded)
                .foregroundStyle(props.tone.color)
                .lineLimit(detailed ? nil : 1)
                .minimumScaleFactor(dynamicTypeSize.isAccessibilitySize ? 0.3 : 0.65)
                .widgetAccentable()
                .privacySensitive()
            if let text = props.supportingText, !text.isEmpty {
                Text(text)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(detailed ? nil : 3)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, supporting ? 2 : 5)
                    .privacySensitive()
            }
            caption(props.caption)
        }
    }

    private func label(_ text: String) -> some View {
        Text(text)
            .font(detailed ? .subheadline : .caption)
            .foregroundStyle(.secondary)
            .lineLimit(detailed ? nil : dynamicTypeSize.isAccessibilitySize ? 2 : 1)
            .minimumScaleFactor(0.7)
    }

    @ViewBuilder private func caption(_ text: String?) -> some View {
        if detailed, let text, !text.isEmpty {
            Text(text)
                .font(detailed ? .footnote : .caption2)
                .foregroundStyle(.secondary)
                .lineLimit(detailed ? nil : 2)
                .privacySensitive()
        }
    }
}

private extension Tone {
    var color: Color {
        switch self {
        case .default: .primary
        case .accent: .accentColor
        case .good: .green
        case .warn: .orange
        case .bad: .red
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
