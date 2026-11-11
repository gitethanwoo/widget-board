import SwiftUI
import WidgetKit

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
        await entry()
    }

    func timeline(for configuration: SelectBoardIntent, in context: Context) async -> Timeline<BoardEntry> {
        if #available(iOS 26.0, *) { _ = await WidgetPushRegistration.shared.refresh() }
        // One entry, then ask to be reloaded in 15 minutes. iOS treats this as
        // a request and budgets how often it actually happens.
        return Timeline(entries: [await entry()], policy: .after(.now.addingTimeInterval(15 * 60)))
    }

    private func entry() async -> BoardEntry {
        do {
            return BoardEntry(date: .now, content: .board(try await BoardClient.fetch()))
        } catch {
            if BoardClient.allowsCachedBoard(after: error), let cached = BoardClient.cached() {
                return BoardEntry(date: .now, content: .board(cached))
            }
            return BoardEntry(date: .now, content: .failure(error.localizedDescription))
        }
    }
}

struct BoardWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: BoardEntry

    var body: some View {
        Group {
            switch entry.content {
            case .board(let board):
                BoardView(board: board, family: family)
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
        .widgetURL(URL(string: "widgetboard://open"))
    }
}

@main
struct BoardWidgets: WidgetBundle {
    var body: some Widget { availableWidget }

    // WidgetBundleBuilder supports availability-only branches, not if/else.
    // Erase both configurations through the same builder result to keep the
    // existing widget kind on older iOS versions without duplicate widgets.
    private var availableWidget: some Widget {
        if #available(iOS 26.0, *) {
            return WidgetBundleBuilder.buildOptional(WidgetBundleBuilder.buildLimitedAvailability(PushBoardWidget()))
        } else {
            return WidgetBundleBuilder.buildOptional(WidgetBundleBuilder.buildLimitedAvailability(BoardWidget()))
        }
    }
}

@available(iOS 26.0, *)
struct PushBoardWidget: Widget {
    var body: some WidgetConfiguration { BoardWidget().body.pushHandler(BoardPushHandler.self) }
}

struct BoardWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "BoardWidget", intent: SelectBoardIntent.self, provider: BoardProvider()) { entry in
            BoardWidgetView(entry: entry)
        }
        .configurationDisplayName("Board")
        .description("Shows the canvas your agents update.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
