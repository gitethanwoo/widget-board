import SwiftUI
import WidgetKit

// Shared pieces the leaves are assembled from. Sizes follow docs/widget-design.md.

func clampedUnit(_ value: Double) -> CGFloat {
    CGFloat(min(max(value, 0), 1))
}

struct LeafLabel: View {
    let text: String
    var detailed = false
    @Environment(\.boardPalette) private var palette
    @Environment(\.boardRowLines) private var rowLines

    var body: some View {
        Text(text)
            .font(detailed ? .subheadline : .caption)
            .foregroundStyle(palette.secondary)
            .lineLimit(detailed ? nil : rowLines)
            .minimumScaleFactor(detailed ? 1 : 0.7)
    }
}

/// The headline value. It shrinks to fit rather than truncating, so the
/// complete figure is always on screen.
struct LeafValue: View {
    let text: String
    var size: ValueSize = .large
    var tone: Tone = .default
    var detailed = false
    @Environment(\.boardPalette) private var palette
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Text(text)
            .font(size.font.weight(.semibold))
            .fontDesign(.rounded)
            .foregroundStyle(palette.color(tone))
            .lineLimit(detailed ? nil : 1)
            // The app's list wraps instead of shrinking.
            .minimumScaleFactor(detailed ? 1 : dynamicTypeSize.isAccessibilitySize ? 0.3 : 0.4)
            .widgetAccentable()
            .privacySensitive()
    }
}

struct LeafSub: View {
    let text: String
    /// nil shows every line.
    var lines: Int? = 2
    var detailed = false
    @Environment(\.boardPalette) private var palette

    var body: some View {
        Text(text)
            .font(detailed ? .footnote : .caption)
            .foregroundStyle(palette.secondary)
            .lineLimit(detailed ? nil : lines)
            .minimumScaleFactor(detailed ? 1 : 0.9)
            .fixedSize(horizontal: false, vertical: true)
            .privacySensitive()
    }
}

/// A small capsule: an arrow from the direction, the text, and a color from
/// the sentiment the agent stated.
struct ChangeChip: View {
    let change: ChangeProps
    @Environment(\.boardPalette) private var palette

    private var arrow: String {
        switch change.direction {
        case .up: "arrow.up"
        case .down: "arrow.down"
        case .flat: "arrow.right"
        }
    }

    var body: some View {
        let color = palette.chipColor(change.sentiment)
        HStack(spacing: 3) {
            Image(systemName: arrow).imageScale(.small)
            Text(change.text)
        }
        .font(.caption2.weight(.semibold))
        .foregroundStyle(color)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(color.opacity(0.15), in: Capsule())
        .privacySensitive()
    }
}

/// A 6-point bar with an optional pace tick.
struct BarTrack: View {
    let fraction: Double
    let color: Color
    var marker: Double?
    @Environment(\.boardPalette) private var palette

    var body: some View {
        Capsule()
            .fill(palette.fill)
            .frame(height: 6)
            .overlay {
                GeometryReader { geometry in
                    let width = geometry.size.width
                    Capsule().fill(color)
                        .frame(width: width * clampedUnit(fraction), height: 6)
                    if let marker {
                        RoundedRectangle(cornerRadius: 1).fill(palette.ink)
                            .frame(width: 2, height: 14)
                            .background {
                                if palette.fullColor {
                                    RoundedRectangle(cornerRadius: 3).fill(palette.background).padding(-2)
                                }
                            }
                            .position(x: width * clampedUnit(marker), y: 3)
                    }
                }
            }
            .accessibilityHidden(true)
    }
}

struct RingGauge: View {
    let value: Double
    let text: String
    let color: Color
    let size: CGFloat
    @Environment(\.boardPalette) private var palette

    var body: some View {
        ZStack {
            Circle().stroke(palette.fill, lineWidth: 9)
            Circle()
                .trim(from: 0, to: clampedUnit(value))
                .stroke(color, style: StrokeStyle(lineWidth: 9, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text(text)
                .font(.title3.weight(.semibold))
                .fontDesign(.rounded)
                .monospacedDigit()
                .foregroundStyle(palette.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .frame(width: size - 30)
                .widgetAccentable()
                .privacySensitive()
        }
        .padding(4.5)
        .frame(width: size, height: size)
    }
}

/// A line with a faint area under it and a dot on the newest point. No axis
/// fits, so it shows direction and shape rather than readable values.
struct Sparkline: View {
    let points: [Double]
    var goal: Double?
    let color: Color
    @Environment(\.boardPalette) private var palette

    var body: some View {
        GeometryReader { geometry in
            let size = geometry.size
            let plot = SparkPlot(points: points, goal: goal, size: size)
            ZStack(alignment: .topLeading) {
                if let goalY = plot.goalY {
                    Path { path in
                        path.move(to: CGPoint(x: 0, y: goalY))
                        path.addLine(to: CGPoint(x: size.width, y: goalY))
                    }
                    .stroke(palette.secondary, style: StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
                    Text("Goal")
                        .font(.system(size: 9))
                        .foregroundStyle(palette.secondary)
                        .frame(width: size.width, height: 11, alignment: .trailing)
                        .offset(y: goalY - 14)
                }
                plot.area.fill(color.opacity(0.13))
                plot.line.stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                Circle().fill(color)
                    .frame(width: 7, height: 7)
                    .background {
                        if palette.fullColor { Circle().fill(palette.background).padding(-2) }
                    }
                    .position(plot.last)
            }
        }
        .accessibilityHidden(true)
        .privacySensitive()
    }
}

struct SparkPlot {
    let line: Path
    let area: Path
    let last: CGPoint
    let goalY: CGFloat?

    init(points: [Double], goal: Double?, size: CGSize) {
        let pad: CGFloat = 4
        // Room above a goal line for its label.
        let top: CGFloat = goal == nil ? pad : 14
        let all = points + (goal.map { [$0] } ?? [])
        let low = all.min() ?? 0
        let high = all.max() ?? 1
        let span = high - low
        func x(_ index: Int) -> CGFloat {
            pad + CGFloat(index) * (size.width - 2 * pad) / CGFloat(max(points.count - 1, 1))
        }
        func y(_ value: Double) -> CGFloat {
            let unit = span > 0 ? (value - low) / span : 0.5
            return size.height - pad - CGFloat(unit) * (size.height - pad - top)
        }
        let coordinates = points.enumerated().map { CGPoint(x: x($0.offset), y: y($0.element)) }
        var line = Path()
        line.addLines(coordinates)
        var area = Path()
        if let first = coordinates.first, let last = coordinates.last {
            area.move(to: CGPoint(x: first.x, y: size.height - pad))
            area.addLines(coordinates)
            area.addLine(to: CGPoint(x: last.x, y: size.height - pad))
            area.closeSubpath()
        }
        self.line = line
        self.area = area
        last = coordinates.last ?? .zero
        goalY = goal.map(y)
    }
}

/// Up to seven columns with a letter under each. A nil value has not happened
/// yet and draws a stub, so it cannot be mistaken for zero.
struct ColumnChart: View {
    let columns: [ColumnsProps.Column]
    let highlight: Int?
    @Environment(\.boardPalette) private var palette

    var body: some View {
        let peak = columns.compactMap(\.value).max() ?? 0
        HStack(alignment: .bottom, spacing: 4) {
            ForEach(Array(columns.enumerated()), id: \.offset) { index, column in
                VStack(spacing: 3) {
                    GeometryReader { geometry in
                        bar(column.value, peak: peak, highlighted: index == highlight, height: geometry.size.height)
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                    }
                    Text(column.label)
                        .font(.system(size: 9))
                        .foregroundStyle(palette.secondary)
                        .lineLimit(1)
                        .fixedSize()
                        .frame(height: 9)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .accessibilityHidden(true)
        .privacySensitive()
    }

    @ViewBuilder private func bar(_ value: Double?, peak: Double, highlighted: Bool, height: CGFloat) -> some View {
        if let value {
            let unit = peak > 0 ? max(0.06, value / peak) : 0.06
            UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 1, bottomTrailingRadius: 1, topTrailingRadius: 3)
                .fill(highlighted ? palette.color(.accent) : palette.tertiary)
                .frame(height: height * CGFloat(unit))
        } else {
            Capsule().fill(palette.fill).frame(height: 3)
        }
    }
}

/// One dot per day. Done is the tone color, today an open ring, missed and
/// upcoming gray.
struct DotRow: View {
    let days: [DotsProps.Day]
    let color: Color
    var small = false
    @Environment(\.boardPalette) private var palette

    var body: some View {
        let diameter: CGFloat = small ? 10 : 14
        HStack(alignment: .top, spacing: small ? 3 : 4) {
            ForEach(Array(days.enumerated()), id: \.offset) { _, day in
                VStack(spacing: 4) {
                    dot(day.state).frame(width: diameter, height: diameter)
                    if !small {
                        Text(day.label)
                            .font(.system(size: 9))
                            .foregroundStyle(palette.secondary)
                            .lineLimit(1)
                            .fixedSize()
                            .frame(width: diameter, height: 9)
                    }
                }
            }
        }
        .accessibilityHidden(true)
        .privacySensitive()
    }

    @ViewBuilder private func dot(_ state: DotsProps.Day.State) -> some View {
        switch state {
        case .done: Circle().fill(color)
        case .today: Circle().strokeBorder(palette.secondary, lineWidth: 1.5)
        case .missed, .upcoming: Circle().fill(palette.fill)
        }
    }
}

/// A seven-column grid of rounded squares that fills the width it is given,
/// or the height when that is the tighter limit.
struct MonthGrid: View {
    let offset: Int
    let days: [Bool]
    let color: Color
    @Environment(\.boardPalette) private var palette

    private static let gap: CGFloat = 3
    private var rows: Int { max(1, Int((Double(offset + days.count) / 7).rounded(.up))) }

    var body: some View {
        let rows = rows
        let fill = palette.fill
        // Shape the frame like the grid at its usual cell size; the cell size
        // itself is worked out from the space actually given.
        let ratio = (7 * 15 + 6 * Self.gap) / (CGFloat(rows) * 15 + CGFloat(rows - 1) * Self.gap)
        Canvas { context, size in
            let cell = min((size.width - 6 * Self.gap) / 7, (size.height - CGFloat(rows - 1) * Self.gap) / CGFloat(rows))
            guard cell > 0 else { return }
            for (index, filled) in days.enumerated() {
                let slot = index + offset
                let rect = CGRect(
                    x: CGFloat(slot % 7) * (cell + Self.gap),
                    y: CGFloat(slot / 7) * (cell + Self.gap),
                    width: cell,
                    height: cell
                )
                let square = Path(roundedRect: rect, cornerRadius: cell * 0.26, style: .continuous)
                context.fill(square, with: .color(filled ? color : fill))
            }
        }
        .aspectRatio(ratio, contentMode: .fit)
        .accessibilityHidden(true)
        .privacySensitive()
    }
}

/// One segment per step: done faded, current solid, upcoming gray.
struct StepBar: View {
    let count: Int
    let current: Int
    @Environment(\.boardPalette) private var palette

    var body: some View {
        let accent = palette.color(.accent)
        HStack(spacing: 3) {
            ForEach(0..<count, id: \.self) { index in
                Capsule()
                    .fill(index < current ? accent.opacity(0.42) : index == current ? accent : palette.fill)
                    .frame(height: 6)
            }
        }
        .accessibilityHidden(true)
    }
}

/// A 10-point bar divided by share.
struct SplitBar: View {
    let segments: [SplitProps.Segment]
    @Environment(\.boardPalette) private var palette
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        GeometryReader { geometry in
            let gap: CGFloat = 2
            let total = segments.reduce(0) { $0 + max($1.share, 0) }
            let usable = geometry.size.width - gap * CGFloat(max(segments.count - 1, 0))
            HStack(spacing: gap) {
                ForEach(Array(segments.enumerated()), id: \.offset) { index, segment in
                    let first = index == 0
                    let last = index == segments.count - 1
                    UnevenRoundedRectangle(
                        topLeadingRadius: first ? 5 : 2,
                        bottomLeadingRadius: first ? 5 : 2,
                        bottomTrailingRadius: last ? 5 : 2,
                        topTrailingRadius: last ? 5 : 2
                    )
                    .fill(palette.segmentColor(index, dark: colorScheme == .dark))
                    .frame(width: total > 0 ? max(3, usable * CGFloat(max(segment.share, 0) / total)) : 3)
                }
            }
        }
        .frame(height: 10)
        .accessibilityHidden(true)
    }
}

/// A status glyph in a tinted circle, or a hollow ring for "not yet".
struct StatusIcon: View {
    enum Glyph {
        case check, cross, exclamation, dot, ring

        init(tone: Tone) {
            self = switch tone {
            case .good: .check
            case .warn: .exclamation
            case .bad: .cross
            case .accent: .dot
            case .default: .ring
            }
        }
    }

    let glyph: Glyph
    let color: Color
    var size: CGFloat = 16
    @Environment(\.boardPalette) private var palette

    var body: some View {
        Group {
            switch glyph {
            case .ring:
                Image(systemName: "circle")
                    .resizable()
                    .fontWeight(.medium)
                    .foregroundStyle(palette.tertiary)
            case .check: tinted("checkmark", scale: 0.5)
            case .cross: tinted("xmark", scale: 0.5)
            case .exclamation: tinted("exclamationmark", scale: 0.56)
            case .dot: tinted("circle.fill", scale: 0.34)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    private func tinted(_ name: String, scale: CGFloat) -> some View {
        ZStack {
            Circle().fill(color.opacity(0.17))
            Image(systemName: name)
                .font(.system(size: size * scale, weight: .bold))
                .foregroundStyle(color)
        }
    }
}

/// The medium widget's two halves with a hairline between them. Used for a
/// headline with its supporting column, and for a single leaf's wide layout.
struct BoardColumns<Left: View, Right: View>: View {
    @ViewBuilder let left: Left
    @ViewBuilder let right: Right
    @Environment(\.boardPalette) private var palette

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            left.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            Rectangle().fill(palette.separator).frame(width: 1)
            right.frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
