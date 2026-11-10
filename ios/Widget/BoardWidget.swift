import AppIntents
import SwiftUI
import WidgetKit

/// Lets each widget on the home screen pick which board it shows
/// (long-press the widget, then Edit Widget).
struct SelectBoardIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Board"
    static let description = IntentDescription("Choose which board this widget shows.")

    @Parameter(title: "Board name", default: "budget")
    var board: String
}

struct BoardEntry: TimelineEntry {
    enum Content {
        case board(Board)
        case failure(String)
        case placeholder
    }

    let date: Date
    let content: Content
}

struct BoardProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> BoardEntry {
        BoardEntry(date: .now, content: .placeholder)
    }

    func snapshot(for configuration: SelectBoardIntent, in context: Context) async -> BoardEntry {
        await entry(for: configuration)
    }

    func timeline(for configuration: SelectBoardIntent, in context: Context) async -> Timeline<BoardEntry> {
        // One entry, then ask to be reloaded in 15 minutes. iOS treats this as
        // a request and budgets how often it actually happens.
        Timeline(entries: [await entry(for: configuration)], policy: .after(.now.addingTimeInterval(15 * 60)))
    }

    private func entry(for configuration: SelectBoardIntent) async -> BoardEntry {
        do {
            return BoardEntry(date: .now, content: .board(try await BoardClient.fetch(configuration.board)))
        } catch {
            return BoardEntry(date: .now, content: .failure(error.localizedDescription))
        }
    }
}

struct BoardWidgetView: View {
    let entry: BoardEntry

    var body: some View {
        Group {
            switch entry.content {
            case .board(let board):
                BoardView(board: board)
            case .failure(let message):
                VStack(alignment: .leading, spacing: 4) {
                    Image(systemName: "exclamationmark.triangle")
                    Text(message).font(.caption2)
                }
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            case .placeholder:
                VStack(alignment: .leading, spacing: 6) {
                    Text("Label").font(.caption2)
                    Text("$0,000").font(.system(size: 28, weight: .bold, design: .rounded))
                }
                .redacted(reason: .placeholder)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .containerBackground(.background, for: .widget)
    }
}

@main
struct BoardWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "BoardWidget", intent: SelectBoardIntent.self, provider: BoardProvider()) { entry in
            BoardWidgetView(entry: entry)
        }
        .configurationDisplayName("Board")
        .description("Shows whatever your agents last put on a board.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
