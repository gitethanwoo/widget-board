import SwiftUI
import WidgetKit

/// Draws one leaf in the layout its position calls for. The rules are the
/// table in docs/widget-design.md, "Component layouts".
struct BoardLeafView: View {
    let element: Element
    let layout: LeafLayout
    @Environment(\.redactionReasons) private var redactionReasons

    var body: some View {
        Group {
            switch element.kind {
            case .stat(let props): StatLeaf(props: props, layout: layout)
            case .progress(let props): ProgressLeaf(props: props, layout: layout)
            case .ring(let props): RingLeaf(props: props, layout: layout)
            case .trend(let props): TrendLeaf(props: props, layout: layout)
            case .columns(let props): ColumnsLeaf(props: props, layout: layout)
            case .barList(let props): BarListLeaf(props: props, layout: layout)
            case .split(let props): SplitLeaf(props: props, layout: layout)
            case .rows(let props): RowsLeaf(props: props, layout: layout)
            case .agenda(let props): AgendaLeaf(props: props, layout: layout)
            case .dots(let props): DotsLeaf(props: props, layout: layout)
            case .grid(let props): GridLeaf(props: props, layout: layout)
            case .checklist(let props): ChecklistLeaf(props: props, layout: layout)
            case .steps(let props): StepsLeaf(props: props, layout: layout)
            case .note(let props): NoteLeaf(props: props, layout: layout)
            case .board, .row, .unknown: EmptyView()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(element.spokenSummary(redacted: redactionReasons.contains(.privacy)))
    }
}

private func percentText(_ value: Double) -> String {
    min(max(value, 0), 1).formatted(.percent.precision(.fractionLength(0)))
}

/// Context the app shows and the widget leaves out.
private struct DetailCaption: View {
    let text: String?
    @Environment(\.boardPalette) private var palette

    var body: some View {
        if let text, !text.isEmpty {
            Text(text)
                .font(.footnote)
                .foregroundStyle(palette.secondary)
                .padding(.top, 4)
                .privacySensitive()
        }
    }
}

// MARK: - Stat

private struct StatLeaf: View {
    let props: StatProps
    let layout: LeafLayout

    var body: some View {
        let detailed = layout == .detail
        VStack(alignment: .leading, spacing: 0) {
            if !props.label.isEmpty { LeafLabel(text: props.label, detailed: detailed) }
            LeafValue(text: props.value, size: layout == .supporting ? .small : .headline(for: props.value), tone: props.tone, detailed: detailed)
                .padding(.top, props.label.isEmpty ? 0 : 1)
            if layout != .supporting {
                if let change = props.change { ChangeChip(change: change).padding(.top, 5) }
                if let text = props.supportingText, !text.isEmpty {
                    LeafSub(text: text, lines: 3, detailed: detailed).padding(.top, 4)
                }
            }
            if detailed { DetailCaption(text: props.caption) }
        }
    }
}

// MARK: - Progress

private struct ProgressLeaf: View {
    let props: ProgressProps
    let layout: LeafLayout
    @Environment(\.boardPalette) private var palette
    @Environment(\.boardRowLines) private var rowLines

    var body: some View {
        let detailed = layout == .detail
        let supporting = layout == .supporting
        VStack(alignment: .leading, spacing: 0) {
            LeafLabel(text: props.label, detailed: detailed)
            let headline = props.display ?? percentText(props.value)
            LeafValue(text: headline, size: supporting ? .small : .headline(for: headline), tone: props.tone, detailed: detailed)
                .padding(.top, 1)
            BarTrack(fraction: props.value, color: palette.color(props.tone), marker: props.marker)
                .padding(.top, supporting ? 6 : 12)
            if !supporting, let text = props.supportingText, !text.isEmpty {
                if let trailing = props.trailingText, !trailing.isEmpty {
                    // One caption at each end of a single line. At accessibility
                    // text sizes the two stack when they do not fit side by side.
                    Group {
                        if rowLines > 1 {
                            ViewThatFits(in: .horizontal) {
                                ends(text, trailing)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(text)
                                    Text(trailing)
                                }
                            }
                            .lineLimit(1)
                        } else {
                            ends(text, trailing)
                                .lineLimit(detailed ? nil : 1)
                                .minimumScaleFactor(detailed ? 1 : 0.8)
                        }
                    }
                    .font(detailed ? .footnote : .caption2)
                    .foregroundStyle(palette.secondary)
                    .padding(.top, 7)
                    .privacySensitive()
                } else {
                    LeafSub(text: text, lines: 2, detailed: detailed).padding(.top, 7)
                }
            }
            if detailed { DetailCaption(text: props.caption) }
        }
    }

    private func ends(_ leading: String, _ trailing: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(leading)
            Spacer(minLength: 0)
            Text(trailing)
        }
    }
}

// MARK: - Ring

private struct RingLeaf: View {
    let props: RingProps
    let layout: LeafLayout
    @Environment(\.boardPalette) private var palette

    private var text: String { props.display ?? percentText(props.value) }

    var body: some View {
        switch layout {
        case .compact:
            if let supportingText = props.supportingText, !supportingText.isEmpty {
                ViewThatFits(in: .vertical) {
                    compact(supportingText, lines: 2)
                    compact(supportingText, lines: 1)
                }
            } else {
                compact(nil, lines: 1)
            }
        case .wide:
            HStack(alignment: .center, spacing: 16) {
                gauge(104)
                captions(lines: 3)
            }
        case .supporting:
            VStack(alignment: .leading, spacing: 1) {
                LeafLabel(text: props.label)
                LeafValue(text: text, size: .small, tone: props.tone)
            }
        case .detail:
            HStack(alignment: .center, spacing: 16) {
                gauge(78)
                captions(lines: nil, detailed: true)
            }
        }
    }

    private func gauge(_ size: CGFloat) -> some View {
        RingGauge(value: props.value, text: text, color: palette.color(props.tone), size: size)
    }

    private func compact(_ supportingText: String?, lines: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            gauge(78)
            LeafLabel(text: props.label).padding(.top, 7)
            if let supportingText { LeafSub(text: supportingText, lines: lines).padding(.top, 2) }
        }
    }

    private func captions(lines: Int?, detailed: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            LeafLabel(text: props.label, detailed: detailed)
            if let supportingText = props.supportingText, !supportingText.isEmpty {
                LeafSub(text: supportingText, lines: lines, detailed: detailed)
            }
        }
    }
}

// MARK: - Trend

private struct TrendLeaf: View {
    let props: TrendProps
    let layout: LeafLayout
    @Environment(\.boardPalette) private var palette

    private var hasGoal: Bool { props.goal != nil }
    private var supportingText: String? {
        guard let text = props.supportingText, !text.isEmpty else { return nil }
        return text
    }

    var body: some View {
        switch layout {
        case .compact:
            // The supporting line is optional: it goes before the chart is squeezed.
            if supportingText != nil {
                ViewThatFits(in: .vertical) {
                    compact(showsSupportingText: true)
                    compact(showsSupportingText: false)
                }
            } else {
                compact(showsSupportingText: false)
            }
        case .wide:
            BoardColumns {
                VStack(alignment: .leading, spacing: 0) {
                    LeafLabel(text: props.label)
                    LeafValue(text: props.value).padding(.top, 1)
                    if let supportingText { LeafSub(text: supportingText, lines: 3).padding(.top, 4) }
                }
            } right: {
                chart.frame(height: hasGoal ? 96 : 70)
            }
        case .supporting:
            VStack(alignment: .leading, spacing: 1) {
                LeafLabel(text: props.label)
                LeafValue(text: props.value, size: .small)
            }
        case .detail:
            VStack(alignment: .leading, spacing: 0) {
                LeafLabel(text: props.label, detailed: true)
                LeafValue(text: props.value, detailed: true).padding(.top, 1)
                chart.frame(height: 88).padding(.top, 15)
                if let supportingText { LeafSub(text: supportingText, detailed: true).padding(.top, 7) }
            }
        }
    }

    private var chart: some View {
        Sparkline(points: props.points, goal: props.goal, color: palette.color(props.tone))
    }

    private func compact(showsSupportingText: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            LeafLabel(text: props.label)
            LeafValue(text: props.value, size: hasGoal ? .medium : .large).padding(.top, 1)
            chart.frame(height: hasGoal ? 56 : 44).padding(.top, 15)
            if showsSupportingText, let supportingText {
                LeafSub(text: supportingText, lines: 2).padding(.top, 7)
            }
        }
    }
}

// MARK: - Columns

private struct ColumnsLeaf: View {
    let props: ColumnsProps
    let layout: LeafLayout

    private var supportingText: String? {
        guard let text = props.supportingText, !text.isEmpty else { return nil }
        return text
    }

    var body: some View {
        switch layout {
        case .compact:
            if supportingText != nil {
                ViewThatFits(in: .vertical) {
                    compact(showsSupportingText: true)
                    compact(showsSupportingText: false)
                }
            } else {
                compact(showsSupportingText: false)
            }
        case .wide:
            BoardColumns {
                VStack(alignment: .leading, spacing: 0) {
                    LeafLabel(text: props.label)
                    LeafValue(text: props.value).padding(.top, 1)
                    if let supportingText { LeafSub(text: supportingText, lines: 3).padding(.top, 4) }
                }
            } right: {
                chart.frame(height: 92)
            }
        case .supporting:
            VStack(alignment: .leading, spacing: 1) {
                LeafLabel(text: props.label)
                LeafValue(text: props.value, size: .small)
            }
        case .detail:
            VStack(alignment: .leading, spacing: 0) {
                LeafLabel(text: props.label, detailed: true)
                LeafValue(text: props.value, detailed: true).padding(.top, 1)
                chart.frame(height: 92).padding(.top, 15)
                if let supportingText { LeafSub(text: supportingText, detailed: true).padding(.top, 7) }
            }
        }
    }

    private var chart: some View {
        ColumnChart(columns: props.columns, highlight: props.highlight)
    }

    private func compact(showsSupportingText: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            LeafLabel(text: props.label)
            LeafValue(text: props.value, size: .medium).padding(.top, 1)
            chart.frame(height: 58).padding(.top, 15)
            if showsSupportingText, let supportingText {
                LeafSub(text: supportingText, lines: 2).padding(.top, 7)
            }
        }
    }
}

// MARK: - BarList

private struct BarListLeaf: View {
    let props: BarListProps
    let layout: LeafLayout
    @Environment(\.boardPalette) private var palette

    private var label: String? {
        guard let label = props.label, !label.isEmpty else { return nil }
        return label
    }

    var body: some View {
        switch layout {
        case .wide:
            if let change = props.change, let first = props.items.first {
                BoardColumns {
                    VStack(alignment: .leading, spacing: 0) {
                        if let label { LeafLabel(text: label) }
                        LeafValue(text: first.value).padding(.top, 1)
                        ChangeChip(change: change).padding(.top, 5)
                    }
                } right: {
                    rows(detailed: false)
                }
            } else {
                stacked(detailed: false)
            }
        case .supporting:
            rows(detailed: false)
        case .compact:
            stacked(detailed: false)
        case .detail:
            stacked(detailed: true)
        }
    }

    private func stacked(detailed: Bool) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            if let label { LeafLabel(text: label, detailed: detailed) }
            rows(detailed: detailed)
            if let change = props.change { ChangeChip(change: change) }
        }
    }

    private func rows(detailed: Bool) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            ForEach(Array(props.items.enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(item.label)
                            .foregroundStyle(palette.ink)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text(item.value)
                            .foregroundStyle(palette.secondary)
                            .monospacedDigit()
                            .layoutPriority(1)
                            .privacySensitive()
                    }
                    .font(detailed ? .footnote : .caption2)
                    .lineLimit(detailed ? nil : 1)
                    BarTrack(fraction: item.fraction, color: palette.barColor(item.tone))
                }
            }
        }
    }
}

// MARK: - Split

private struct SplitLeaf: View {
    let props: SplitProps
    let layout: LeafLayout
    @Environment(\.boardPalette) private var palette
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        switch layout {
        case .compact:
            VStack(alignment: .leading, spacing: 0) {
                LeafLabel(text: props.label)
                LeafValue(text: props.value, size: .medium).padding(.top, 1)
                SplitBar(segments: props.segments).padding(.top, 12)
                legend(limit: 2, spacing: 4, detailed: false).padding(.top, 7)
            }
        case .wide:
            BoardColumns {
                VStack(alignment: .leading, spacing: 0) {
                    LeafLabel(text: props.label)
                    LeafValue(text: props.value).padding(.top, 1)
                    SplitBar(segments: props.segments).padding(.top, 12)
                }
            } right: {
                legend(limit: nil, spacing: 9, detailed: false)
            }
        case .supporting:
            VStack(alignment: .leading, spacing: 1) {
                LeafLabel(text: props.label)
                LeafValue(text: props.value, size: .small)
            }
        case .detail:
            VStack(alignment: .leading, spacing: 0) {
                LeafLabel(text: props.label, detailed: true)
                LeafValue(text: props.value, detailed: true).padding(.top, 1)
                SplitBar(segments: props.segments).padding(.top, 12)
                legend(limit: nil, spacing: 8, detailed: true).padding(.top, 10)
            }
        }
    }

    private func legend(limit: Int?, spacing: CGFloat, detailed: Bool) -> some View {
        let segments = Array(props.segments.enumerated().prefix(limit ?? props.segments.count))
        return VStack(alignment: .leading, spacing: spacing) {
            ForEach(segments, id: \.offset) { index, segment in
                HStack(alignment: .center, spacing: 6) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(palette.segmentColor(index, dark: colorScheme == .dark))
                        .frame(width: 8, height: 8)
                    Text(segment.label)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(segment.value)
                        .fontWeight(.semibold)
                        .monospacedDigit()
                        .layoutPriority(1)
                        .privacySensitive()
                }
                .font(detailed ? .subheadline : .caption)
                .foregroundStyle(palette.ink)
                .lineLimit(detailed ? nil : 1)
            }
        }
    }
}

// MARK: - Rows

private struct RowsLeaf: View {
    let props: RowsProps
    let layout: LeafLayout
    @Environment(\.boardPalette) private var palette
    @Environment(\.boardRowLines) private var rowLines

    var body: some View {
        let detailed = layout == .detail
        VStack(alignment: .leading, spacing: 0) {
            if let label = props.label, !label.isEmpty {
                LeafLabel(text: label, detailed: detailed).padding(.bottom, 9)
            }
            VStack(alignment: .leading, spacing: layout == .wide ? 10 : 9) {
                ForEach(Array(props.items.enumerated()), id: \.offset) { _, item in
                    if detailed {
                        VStack(alignment: .leading, spacing: 2) {
                            row(item, detail: nil)
                            if let detail = item.detail, !detail.isEmpty {
                                Text(detail)
                                    .font(.footnote)
                                    .foregroundStyle(palette.secondary)
                                    .privacySensitive()
                            }
                        }
                    } else {
                        row(item, detail: layout == .wide ? item.detail : nil)
                    }
                }
            }
        }
    }

    /// Without a marker the value carries the tone. With one, the marker does,
    /// and the value stays quiet unless the row needs attention.
    private func row(_ item: RowsProps.Item, detail: String?) -> some View {
        let detailed = layout == .detail
        let emphasized = props.marker == .none || item.tone == .warn || item.tone == .bad
        let value = [item.value, detail ?? ""].filter { !$0.isEmpty }.joined(separator: " · ")
        return HStack(alignment: .center, spacing: 6) {
            switch props.marker {
            case .none:
                EmptyView()
            case .dot:
                Circle().fill(palette.barColor(item.tone)).frame(width: 8, height: 8)
            case .icon:
                StatusIcon(glyph: StatusIcon.Glyph(tone: item.tone), color: palette.color(item.tone))
            }
            if layout == .wide {
                // The name is short; the value and its detail take what is left.
                Text(item.label).fixedSize().layoutPriority(1)
                Spacer(minLength: 6)
            } else {
                Text(item.label)
                    .lineLimit(detailed ? nil : rowLines)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            Text(value)
                .fontWeight(emphasized ? .semibold : .regular)
                .foregroundStyle(emphasized ? palette.color(item.tone) : palette.secondary)
                .monospacedDigit()
                .minimumScaleFactor(0.85)
                .layoutPriority(layout == .wide ? 0 : 1)
                .privacySensitive()
        }
        .font(detailed ? .subheadline : .caption)
        .foregroundStyle(palette.ink)
        .lineLimit(detailed ? nil : 1)
    }
}

// MARK: - Agenda

private struct AgendaLeaf: View {
    let props: AgendaProps
    let layout: LeafLayout
    @Environment(\.boardPalette) private var palette
    @Environment(\.boardRowLines) private var rowLines
    @ScaledMetric(relativeTo: .caption2) private var timeWidth: CGFloat = 34

    var body: some View {
        let detailed = layout == .detail
        VStack(alignment: .leading, spacing: 0) {
            LeafLabel(text: props.label, detailed: detailed).padding(.bottom, 9)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(props.items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(item.time)
                            .font(detailed ? .footnote : .caption2)
                            .foregroundStyle(palette.secondary)
                            .monospacedDigit()
                            .lineLimit(1)
                            .frame(width: detailed ? timeWidth * 1.3 : timeWidth, alignment: .leading)
                        Text(item.text)
                            .font(detailed ? .subheadline : .caption)
                            .foregroundStyle(palette.ink)
                            .lineLimit(detailed ? nil : rowLines)
                            .privacySensitive()
                    }
                }
            }
        }
    }
}

// MARK: - Dots

private struct DotsLeaf: View {
    let props: DotsProps
    let layout: LeafLayout
    @Environment(\.boardPalette) private var palette

    var body: some View {
        let detailed = layout == .detail
        if layout == .supporting {
            VStack(alignment: .leading, spacing: 5) {
                LeafLabel(text: props.label)
                DotRow(days: props.days, color: palette.color(props.tone), small: true)
            }
        } else {
            VStack(alignment: .leading, spacing: 0) {
                LeafLabel(text: props.label, detailed: detailed)
                LeafValue(text: props.value, size: .medium, detailed: detailed).padding(.top, 1)
                DotRow(days: props.days, color: palette.color(props.tone)).padding(.top, 11)
            }
        }
    }
}

// MARK: - Grid

private struct GridLeaf: View {
    let props: GridProps
    let layout: LeafLayout
    @Environment(\.boardPalette) private var palette
    @Environment(\.boardRowLines) private var rowLines

    private var supportingText: String? {
        guard let text = props.supportingText, !text.isEmpty else { return nil }
        return text
    }

    var body: some View {
        switch layout {
        case .compact:
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(props.label)
                        .font(.caption2)
                        .foregroundStyle(palette.secondary)
                        .lineLimit(rowLines)
                        .minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(props.value)
                        .font(.subheadline.weight(.semibold))
                        .fontDesign(.rounded)
                        .foregroundStyle(palette.ink)
                        .lineLimit(1)
                        .layoutPriority(1)
                        .widgetAccentable()
                        .privacySensitive()
                }
                grid
            }
        case .wide:
            BoardColumns {
                VStack(alignment: .leading, spacing: 0) {
                    LeafLabel(text: props.label)
                    LeafValue(text: props.value).padding(.top, 1)
                    if let supportingText { LeafSub(text: supportingText, lines: 3).padding(.top, 4) }
                }
            } right: {
                grid
            }
        case .supporting:
            VStack(alignment: .leading, spacing: 1) {
                LeafLabel(text: props.label)
                LeafValue(text: props.value, size: .small)
            }
        case .detail:
            VStack(alignment: .leading, spacing: 0) {
                LeafLabel(text: props.label, detailed: true)
                LeafValue(text: props.value, detailed: true).padding(.top, 1)
                if let supportingText { LeafSub(text: supportingText, detailed: true).padding(.top, 4) }
                grid.frame(maxWidth: 220).padding(.top, 15)
            }
        }
    }

    private var grid: some View {
        MonthGrid(offset: props.offset, days: props.days, color: palette.color(props.tone))
    }
}

// MARK: - Checklist

private struct ChecklistLeaf: View {
    let props: ChecklistProps
    let layout: LeafLayout
    @Environment(\.boardPalette) private var palette
    @Environment(\.boardRowLines) private var rowLines

    /// Open items first, each group in the order the agent wrote it.
    private var ordered: [ChecklistProps.Item] {
        props.items.filter { !$0.done } + props.items.filter(\.done)
    }
    private var doneCount: Int { props.items.filter(\.done).count }
    private var countLabel: String {
        let left = props.items.count - doneCount
        return left == 0 ? "\(props.label) · all done" : "\(props.label) · \(left) left"
    }

    var body: some View {
        switch layout {
        case .compact:
            list(countLabel, Array(ordered.prefix(3)))
        case .wide:
            if ordered.count > 3 {
                let next = Array(ordered.dropFirst(3).prefix(3))
                BoardColumns {
                    list(props.label, Array(ordered.prefix(3)))
                } right: {
                    // Padded to three rows so both headings sit on one line.
                    list("\(doneCount) of \(props.items.count) done", next, placeholders: 3 - next.count)
                }
            } else {
                list(countLabel, ordered)
            }
        case .supporting:
            ViewThatFits(in: .vertical) {
                list(countLabel, Array(ordered.prefix(3)))
                list(countLabel, Array(ordered.prefix(2)))
                list(countLabel, Array(ordered.prefix(1)))
            }
        case .detail:
            list(countLabel, ordered, detailed: true)
        }
    }

    private func list(_ label: String, _ items: [ChecklistProps.Item], placeholders: Int = 0, detailed: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            LeafLabel(text: label, detailed: detailed).padding(.bottom, 9)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    row(item, detailed: detailed)
                }
                ForEach(0..<max(placeholders, 0), id: \.self) { _ in
                    row(ChecklistProps.Item(text: " ", done: false), detailed: false).hidden()
                }
            }
        }
    }

    private func row(_ item: ChecklistProps.Item, detailed: Bool) -> some View {
        HStack(alignment: .center, spacing: 7) {
            StatusIcon(glyph: item.done ? .check : .ring, color: palette.color(.good))
            Text(item.text)
                .font(detailed ? .subheadline : .caption)
                .foregroundStyle(item.done ? palette.secondary : palette.ink)
                .strikethrough(item.done)
                .lineLimit(detailed ? nil : rowLines)
                .privacySensitive()
        }
    }
}

// MARK: - Steps

private struct StepsLeaf: View {
    let props: StepsProps
    let layout: LeafLayout
    @Environment(\.boardPalette) private var palette

    private var current: Int { min(max(props.current, 0), max(props.steps.count - 1, 0)) }
    private var currentName: String { props.steps.indices.contains(current) ? props.steps[current] : "" }
    private var stepLine: String {
        let position = "Step \(current + 1) of \(props.steps.count)"
        guard let text = props.supportingText, !text.isEmpty else { return position }
        return "\(position) · \(text)"
    }

    var body: some View {
        switch layout {
        case .compact:
            summary(detailed: false)
        case .wide:
            BoardColumns {
                summary(detailed: false)
            } right: {
                // Six steps only fit the height with tighter rows.
                ViewThatFits(in: .vertical) {
                    stepRows(spacing: 9, detailed: false)
                    stepRows(spacing: 6, detailed: false)
                    stepRows(spacing: 3, detailed: false)
                }
            }
        case .supporting:
            VStack(alignment: .leading, spacing: 1) {
                LeafLabel(text: props.label)
                LeafValue(text: currentName, size: .small)
            }
        case .detail:
            VStack(alignment: .leading, spacing: 12) {
                summary(detailed: true)
                stepRows(spacing: 8, detailed: true)
            }
        }
    }

    private func summary(detailed: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            LeafLabel(text: props.label, detailed: detailed)
            LeafValue(text: currentName, size: .medium, detailed: detailed).padding(.top, 1)
            StepBar(count: props.steps.count, current: current).padding(.top, 12)
            LeafSub(text: stepLine, lines: 2, detailed: detailed).padding(.top, 7)
        }
    }

    private func stepRows(spacing: CGFloat, detailed: Bool) -> some View {
        VStack(alignment: .leading, spacing: spacing) {
            ForEach(Array(props.steps.enumerated()), id: \.offset) { index, step in
                HStack(alignment: .center, spacing: 6) {
                    StatusIcon(
                        glyph: index < current ? .check : index == current ? .dot : .ring,
                        color: palette.color(index < current ? .good : .accent)
                    )
                    Text(step)
                        .foregroundStyle(palette.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if index == current {
                        Text("now").foregroundStyle(palette.secondary)
                    }
                }
                .font(detailed ? .subheadline : .caption)
                .lineLimit(1)
            }
        }
    }
}

// MARK: - Note

private struct NoteLeaf: View {
    let props: NoteProps
    let layout: LeafLayout
    @Environment(\.boardPalette) private var palette

    private var supportingText: String? {
        guard let text = props.supportingText, !text.isEmpty else { return nil }
        return text
    }

    var body: some View {
        switch layout {
        case .compact, .wide:
            // Keep the words at their designed size first, drop the optional
            // line next, and only then step the text down.
            ViewThatFits(in: .vertical) {
                if supportingText != nil { message(step: 0, showsSupportingText: true) }
                message(step: 0, showsSupportingText: false)
                message(step: 1, showsSupportingText: false)
                message(step: 2, showsSupportingText: false)
            }
        case .supporting:
            Text(props.text)
                .font(.footnote)
                .foregroundStyle(palette.ink)
                .lineLimit(2)
                .privacySensitive()
        case .detail:
            VStack(alignment: .leading, spacing: 7) {
                icon
                if let byline = props.byline, !byline.isEmpty { LeafLabel(text: byline, detailed: true) }
                Text(props.text)
                    .font(props.loud ? .title3.weight(.bold) : .body)
                    .fontDesign(props.loud ? .rounded : .default)
                    .foregroundStyle(palette.ink)
                    .privacySensitive()
                if let supportingText { LeafSub(text: supportingText, detailed: true) }
            }
        }
    }

    @ViewBuilder private var icon: some View {
        switch props.status {
        case .done: StatusIcon(glyph: .check, color: palette.color(.good), size: 30)
        case .failed: StatusIcon(glyph: .cross, color: palette.color(.bad), size: 30)
        case .attention: StatusIcon(glyph: .exclamation, color: palette.color(.warn), size: 30)
        case nil: EmptyView()
        }
    }

    private func font(step: Int) -> Font {
        if props.loud {
            let fonts: [Font] = [layout == .wide ? .title : .title3, .headline, .footnote]
            return fonts[min(step, 2)].weight(.bold)
        }
        return [Font.callout.weight(.medium), .subheadline, .footnote][min(step, 2)]
    }

    private func message(step: Int, showsSupportingText: Bool) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            icon
            if let byline = props.byline, !byline.isEmpty { LeafLabel(text: byline) }
            Group {
                if step < 2 {
                    Text(props.text).fixedSize(horizontal: false, vertical: true)
                } else {
                    Text(props.text).lineLimit(7)
                }
            }
            .font(font(step: step))
            .fontDesign(props.loud ? .rounded : .default)
            .foregroundStyle(palette.ink)
            .privacySensitive()
            if showsSupportingText, let supportingText { LeafSub(text: supportingText, lines: 2) }
        }
    }
}

// MARK: - VoiceOver

extension Element {
    /// One spoken sentence per leaf. Charts are described rather than read
    /// shape by shape. A redacted widget speaks only what the leaf is.
    func spokenSummary(redacted: Bool) -> String {
        func joined(_ parts: [String?]) -> String {
            parts.compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
        }
        func spoken(_ change: ChangeProps?) -> String? {
            guard let change else { return nil }
            let direction = switch change.direction {
            case .up: "up"
            case .down: "down"
            case .flat: "no change"
            }
            return "\(direction) \(change.text)"
        }
        switch kind {
        case .stat(let props):
            if redacted { return props.label }
            return joined([props.label, props.value, spoken(props.change), props.supportingText])
        case .progress(let props):
            if redacted { return props.label }
            let pace = props.marker.map { "expected by now \(percentText($0))" }
            let percent = props.display == nil ? nil : "\(percentText(props.value)) full"
            return joined([props.label, props.display ?? percentText(props.value), percent, pace, props.supportingText, props.trailingText])
        case .ring(let props):
            if redacted { return props.label }
            return joined([props.label, props.display ?? percentText(props.value), props.supportingText])
        case .trend(let props):
            if redacted { return props.label }
            let first = props.points.first ?? 0
            let last = props.points.last ?? 0
            let direction = last > first ? "trending up" : last < first ? "trending down" : "flat"
            let goal = props.goal.map { last >= $0 ? "goal reached" : "below the goal line" }
            return joined([props.label, props.value, direction, goal, props.supportingText])
        case .columns(let props):
            if redacted { return props.label }
            return joined([props.label, props.value, props.supportingText])
        case .barList(let props):
            if redacted { return props.label ?? "Bars" }
            return joined([props.label] + props.items.map { "\($0.label) \($0.value)" } + [spoken(props.change)])
        case .split(let props):
            if redacted { return props.label }
            return joined([props.label, props.value] + props.segments.map { "\($0.label) \($0.value)" })
        case .rows(let props):
            if redacted { return props.label ?? "List" }
            return joined([props.label] + props.items.map { joined([$0.label, $0.value, $0.detail]) })
        case .agenda(let props):
            if redacted { return props.label }
            return joined([props.label] + props.items.map { "\($0.time) \($0.text)" })
        case .dots(let props):
            if redacted { return props.label }
            let done = props.days.filter { $0.state == .done }.count
            let missed = props.days.filter { $0.state == .missed }.count
            return joined([props.label, props.value, "\(done) done", missed > 0 ? "\(missed) missed" : nil])
        case .grid(let props):
            if redacted { return props.label }
            let filled = props.days.filter { $0 }.count
            return joined([props.label, props.value, "\(filled) of \(props.days.count) days filled", props.supportingText])
        case .checklist(let props):
            if redacted { return props.label }
            let left = props.items.filter { !$0.done }.count
            return joined([props.label, left == 0 ? "all done" : "\(left) left"] + props.items.map { "\($0.text), \($0.done ? "done" : "to do")" })
        case .steps(let props):
            if redacted { return props.label }
            let current = min(max(props.current, 0), max(props.steps.count - 1, 0))
            let name = props.steps.indices.contains(current) ? props.steps[current] : nil
            return joined([props.label, name, "step \(current + 1) of \(props.steps.count)", props.supportingText])
        case .note(let props):
            if redacted { return "Note" }
            let status: String? = switch props.status {
            case .done: "Done"
            case .failed: "Failed"
            case .attention: "Needs attention"
            case nil: nil
            }
            return joined([status, props.byline, props.text, props.supportingText])
        case .board, .row, .unknown:
            return ""
        }
    }
}
