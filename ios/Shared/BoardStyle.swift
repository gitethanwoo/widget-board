import SwiftUI
import UIKit

/// Where a leaf is being drawn. See docs/widget-design.md, "Component layouts".
enum LeafLayout {
    /// The small widget, and the left side of a medium widget that has supporting leaves.
    case compact
    /// A medium widget with a single leaf.
    case wide
    /// The right column of a medium widget.
    case supporting
    /// The app's list, where nothing is truncated.
    case detail
}

/// Headline value sizes: 34, 26 and 19 points in the reviewed mockups.
enum ValueSize {
    case large, medium, small

    var font: Font {
        switch self {
        case .large: .largeTitle
        case .medium: .title
        case .small: .title3
        }
    }
}

/// Semantic colors for one board. `Board.alert` swaps every color for dark ink
/// on orange, and only in full-color rendering: tinted and clear Home Screens
/// remove the background, so the standard palette stays in place there.
struct BoardPalette: Sendable, Equatable {
    var alert = false
    /// False in the accented and vibrant widget rendering modes.
    var fullColor = true

    static let alertBackground = Color(hex: 0xFF9F0A)
    static let alertInk = Color(hex: 0x1C1C1E)

    var ink: Color { alert ? Self.alertInk : .primary }
    var secondary: Color { alert ? Self.alertInk.opacity(0.78) : .secondary }
    var tertiary: Color { alert ? Self.alertInk.opacity(0.4) : Color(uiColor: .tertiaryLabel) }
    /// Tracks and empty cells.
    var fill: Color { alert ? Self.alertInk.opacity(0.18) : Color(uiColor: .systemFill) }
    var separator: Color { alert ? Self.alertInk.opacity(0.25) : Color(uiColor: .separator) }
    var background: Color { alert ? Self.alertBackground : Color(uiColor: .systemBackground) }

    func color(_ tone: Tone) -> Color {
        if alert { return ink }
        return switch tone {
        case .default: .primary
        case .accent: .accentColor
        case .good: .green
        case .warn: .orange
        case .bad: .red
        }
    }

    /// A bar with no tone is a quiet gray baseline, such as last month.
    func barColor(_ tone: Tone) -> Color {
        tone == .default ? tertiary : color(tone)
    }

    func chipColor(_ sentiment: ChangeProps.Sentiment) -> Color {
        if alert { return ink }
        return switch sentiment {
        case .good: .green
        case .bad: .red
        case .neutral: .secondary
        }
    }

    /// Split segments use a fixed categorical order; the fourth is gray.
    func segmentColor(_ index: Int, dark: Bool) -> Color {
        if alert { return ink.opacity([1, 0.68, 0.44, 0.24][min(index, 3)]) }
        let light: [UInt32] = [0x2A78D6, 0xEB6834, 0x1BAF7A, 0xA9ACB3]
        let night: [UInt32] = [0x3987E5, 0xD95926, 0x199E70, 0x6B6E75]
        return Color(hex: (dark ? night : light)[min(index, 3)])
    }
}

extension EnvironmentValues {
    @Entry var boardPalette = BoardPalette()
    /// Lines a list row's words may take. One, except at accessibility text
    /// sizes, where a row wraps once instead of ending in an ellipsis.
    @Entry var boardRowLines = 1
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

/// The widget's container background. BoardWidget owns where it is applied.
struct BoardBackground: View {
    let alert: Bool

    /// `fullColor` is whether WidgetKit is rendering in full color.
    init(board: Board?, fullColor: Bool) {
        alert = fullColor && (board.map { BoardContent(spec: $0.spec).alert } ?? false)
    }

    var body: some View {
        if alert {
            BoardPalette.alertBackground
        } else {
            Rectangle().fill(.background)
        }
    }
}

enum BoardFooter {
    /// "Updated 7:02 AM" for a save made today, otherwise "Updated Nov 9, 7:02 AM".
    /// The time is when the board was saved, not when its source last synced.
    static func text(updatedAt: Date, now: Date, calendar: Calendar = .current, locale: Locale = .current) -> String {
        let base = Date.FormatStyle(locale: locale, calendar: calendar, timeZone: calendar.timeZone)
        let time = updatedAt.formatted(base.hour().minute())
        if calendar.isDate(updatedAt, inSameDayAs: now) { return "Updated \(time)" }
        let day = updatedAt.formatted(base.month(.abbreviated).day())
        return "Updated \(day), \(time)"
    }
}
