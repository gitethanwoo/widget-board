import Foundation

/// Mirrors what the server returns from `GET /boards/:id`:
/// `{ "id": "...", "spec": { "root": "...", "elements": { ... } }, "updatedAt": "..." }`
struct Board: Decodable, Sendable {
    let id: String
    let spec: BoardSpec
    let updatedAt: Date
}

/// A json-render flat spec: `root` names the root element and `elements`
/// maps keys to elements that list their children by key.
struct BoardSpec: Decodable, Sendable {
    let root: String
    let elements: [String: Element]
}

enum Tone: String, Decodable, Sendable {
    case `default`, accent, good, warn, bad
}

// Props mirror server/src/catalog.ts. Every prop the schema marks optional is
// an Optional here, so boards saved before a prop existed still decode.

struct BoardProps: Decodable, Sendable {
    let title: String?
    /// Paints the whole widget orange when the user must act now.
    let alert: Bool?
    /// Asks the phone to draw "Updated 7:02 AM" from the save time.
    let showUpdated: Bool?
}

/// A change chip. The agent states whether the change is good news; the
/// phone never guesses it from the direction.
struct ChangeProps: Decodable, Sendable {
    enum Direction: String, Decodable, Sendable { case up, down, flat }
    enum Sentiment: String, Decodable, Sendable { case good, bad, neutral }
    let direction: Direction
    let text: String
    let sentiment: Sentiment
}

struct StatProps: Decodable, Sendable {
    let label: String
    let value: String
    /// Optional glanceable context, kept with the value in every widget size.
    let supportingText: String?
    let change: ChangeProps?
    let caption: String?
    let tone: Tone
}

struct ProgressProps: Decodable, Sendable {
    let label: String
    let value: Double
    /// Headline above the bar when a percentage is not the answer.
    let display: String?
    /// Where the value should be by now, from 0 to 1.
    let marker: Double?
    let supportingText: String?
    /// Right-hand end of the supportingText line.
    let trailingText: String?
    let caption: String?
    let tone: Tone
}

struct RingProps: Decodable, Sendable {
    let label: String
    let value: Double
    let display: String?
    let supportingText: String?
    let tone: Tone
}

struct TrendProps: Decodable, Sendable {
    let label: String
    let value: String
    /// Oldest to newest, evenly spaced.
    let points: [Double]
    let goal: Double?
    let supportingText: String?
    let tone: Tone
}

struct ColumnsProps: Decodable, Sendable {
    struct Column: Decodable, Sendable {
        let label: String
        /// nil means the period has not happened yet.
        let value: Double?
    }
    let label: String
    let value: String
    let supportingText: String?
    let columns: [Column]
    let highlight: Int?
}

struct BarListProps: Decodable, Sendable {
    struct Item: Decodable, Sendable {
        let label: String
        let value: String
        let fraction: Double
        let tone: Tone
    }
    let label: String?
    let items: [Item]
    let change: ChangeProps?
}

struct SplitProps: Decodable, Sendable {
    struct Segment: Decodable, Sendable {
        let label: String
        let value: String
        let share: Double
    }
    let label: String
    let value: String
    let segments: [Segment]
}

struct RowsProps: Decodable, Sendable {
    enum Marker: String, Decodable, Sendable { case none, dot, icon }
    struct Item: Decodable, Sendable {
        let label: String
        let value: String
        /// Shown after the value only when the list has a medium widget's full width.
        let detail: String?
        let tone: Tone
    }
    let label: String?
    let marker: Marker
    let items: [Item]
}

struct AgendaProps: Decodable, Sendable {
    struct Item: Decodable, Sendable {
        let time: String
        let text: String
    }
    let label: String
    let items: [Item]
}

struct DotsProps: Decodable, Sendable {
    struct Day: Decodable, Sendable {
        enum State: String, Decodable, Sendable { case done, missed, today, upcoming }
        let label: String
        let state: State
    }
    let label: String
    let value: String
    let days: [Day]
    let tone: Tone
}

struct GridProps: Decodable, Sendable {
    let label: String
    let value: String
    let supportingText: String?
    /// Empty cells before the first day.
    let offset: Int
    let days: [Bool]
    let tone: Tone
}

struct ChecklistProps: Decodable, Sendable {
    struct Item: Decodable, Sendable {
        let text: String
        let done: Bool
    }
    let label: String
    let items: [Item]
}

struct StepsProps: Decodable, Sendable {
    let label: String
    let steps: [String]
    let current: Int
    let supportingText: String?
}

struct NoteProps: Decodable, Sendable {
    enum Status: String, Decodable, Sendable { case done, failed, attention }
    let text: String
    let loud: Bool
    let byline: String?
    let status: Status?
    let supportingText: String?
}

struct Element: Decodable, Sendable {
    enum Kind: Sendable {
        case board(BoardProps)
        case row
        case stat(StatProps)
        case progress(ProgressProps)
        case ring(RingProps)
        case trend(TrendProps)
        case columns(ColumnsProps)
        case barList(BarListProps)
        case split(SplitProps)
        case rows(RowsProps)
        case agenda(AgendaProps)
        case dots(DotsProps)
        case grid(GridProps)
        case checklist(ChecklistProps)
        case steps(StepsProps)
        case note(NoteProps)
        /// A component this build doesn't know. The server catalog can grow
        /// ahead of the installed app, so unknown types are skipped when
        /// drawing rather than failing the whole board.
        case unknown(String)
    }

    let kind: Kind
    let children: [String]

    private enum CodingKeys: String, CodingKey { case type, props, children }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        children = try container.decode([String].self, forKey: .children)
        func props<Props: Decodable>(_: Props.Type = Props.self) throws -> Props {
            try container.decode(Props.self, forKey: .props)
        }
        switch type {
        case "Board": kind = .board(try props())
        case "Row": kind = .row
        case "Stat": kind = .stat(try props())
        case "Progress": kind = .progress(try props())
        case "Ring": kind = .ring(try props())
        case "Trend": kind = .trend(try props())
        case "Columns": kind = .columns(try props())
        case "BarList": kind = .barList(try props())
        case "Split": kind = .split(try props())
        case "Rows": kind = .rows(try props())
        case "Agenda": kind = .agenda(try props())
        case "Dots": kind = .dots(try props())
        case "Grid": kind = .grid(try props())
        case "Checklist": kind = .checklist(try props())
        case "Steps": kind = .steps(try props())
        case "Note": kind = .note(try props())
        default: kind = .unknown(type)
        }
    }
}
