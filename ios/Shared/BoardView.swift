import SwiftUI
import WidgetKit

/// Draws a board spec with native SwiftUI. Shared by the widget and the app.
struct BoardView: View {
    let board: Board

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ElementView(spec: board.spec, key: board.spec.root, depth: 0)
            Spacer(minLength: 4)
            // Always show when the data was written, so a widget that hasn't
            // refreshed for a while is obviously stale.
            Text("as of \(board.updatedAt.formatted(.dateTime.month(.abbreviated).day().hour().minute()))")
                .font(.system(size: 9))
                .foregroundStyle(.tertiary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct ElementView: View {
    let spec: BoardSpec
    let key: String
    /// The server rejects cycles and nested rows, but the widget must never
    /// hang on a bad spec, so recursion is capped here too.
    let depth: Int

    var body: some View {
        if depth <= 4, let element = spec.elements[key] {
            switch element.kind {
            case .board(let props):
                VStack(alignment: .leading, spacing: 8) {
                    if let title = props.title {
                        Text(title.uppercased())
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    children(of: element)
                }
            case .row:
                HStack(alignment: .top, spacing: 12) {
                    ForEach(element.children, id: \.self) { child in
                        ElementView(spec: spec, key: child, depth: depth + 1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            case .stat(let props):
                StatView(props: props)
            case .progress(let props):
                ProgressBlock(props: props)
            case .note(let props):
                NoteView(props: props)
            case .unknown:
                EmptyView()
            }
        }
    }

    private func children(of element: Element) -> some View {
        ForEach(element.children, id: \.self) { child in
            ElementView(spec: spec, key: child, depth: depth + 1)
        }
    }
}

private struct StatView: View {
    let props: StatProps

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(props.label)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Text(props.value)
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundStyle(props.tone.color)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .widgetAccentable()
                // Numbers like a budget are hidden while the phone is locked.
                .privacySensitive()
            if let caption = props.caption {
                Text(caption)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
    }
}

private struct ProgressBlock: View {
    let props: ProgressProps

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(props.label)
                    .font(.caption2.weight(.medium))
                    .lineLimit(1)
                Spacer(minLength: 0)
                if let caption = props.caption {
                    Text(caption)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .privacySensitive()
                }
            }
            // Drawn with shapes rather than ProgressView so it looks the same
            // in the widget, the app, and offscreen renders.
            Capsule()
                .fill(.quaternary)
                .frame(height: 6)
                .overlay(alignment: .leading) {
                    GeometryReader { proxy in
                        Capsule()
                            .fill(props.tone.color)
                            .frame(width: proxy.size.width * min(max(props.value, 0), 1))
                            .widgetAccentable()
                    }
                }
        }
    }
}

private struct NoteView: View {
    let props: NoteProps

    var body: some View {
        Text(props.text)
            .font(props.loud ? .system(size: 24, weight: .heavy, design: .rounded) : .footnote)
            .minimumScaleFactor(props.loud ? 0.4 : 0.8)
            .frame(maxWidth: .infinity, alignment: .leading)
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
