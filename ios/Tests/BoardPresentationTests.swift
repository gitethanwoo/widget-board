import SwiftUI
import WidgetKit
import XCTest
@testable import WidgetBoard

final class BoardPresentationTests: XCTestCase {
    func testSmallStatKeepsItsComparisonAndLegacyStatsStillDecode() throws {
        let blocks = BoardContent(spec: BoardSamples.weeklySpending.spec).summary(includingSupportingDetails: false)
        XCTAssertEqual(blocks.count, 1)
        guard case .stat(let props) = try XCTUnwrap(blocks.first).element.kind else { return XCTFail("Expected a styled Stat") }
        XCTAssertEqual(props.label, "This Week")
        XCTAssertEqual(props.value, "$312.50")
        XCTAssertEqual(props.supportingText, "Down 18% from last month")
        guard case .stat(let legacy) = BoardSamples.spending.spec.elements["spent"]?.kind else { return XCTFail("Expected legacy Stat to decode") }
        XCTAssertNil(legacy.supportingText)
        XCTAssertEqual(legacy.caption, "USD · Nov 1–10 posted, net credits")
    }

    func testCrowdedCanvasKeepsDetailsButLimitsEachWidgetSize() {
        let content = BoardContent(spec: BoardSamples.spending.spec)
        XCTAssertEqual(content.blocks.map(\.id), ["spent", "pending", "uncategorized", "note"])
        XCTAssertEqual(content.summary(includingSupportingDetails: false).map(\.id), ["spent"])
        XCTAssertEqual(content.summary(includingSupportingDetails: true).map(\.id), ["spent", "pending", "uncategorized"])
    }

    func testMalformedLegacyContentCannotLoopOrRepeatFields() throws {
        let bytes = Data("""
        {"root":"b","elements":{
          "b":{"type":"Board","props":{"title":null},"children":["r","missing","future"]},
          "r":{"type":"Row","props":{},"children":["n","b","n"]},
          "n":{"type":"Note","props":{"text":"One reminder","loud":false},"children":[]},
          "future":{"type":"NewComponent","props":{},"children":[]}
        }}
        """.utf8)
        let spec = try JSONDecoder().decode(BoardSpec.self, from: bytes)
        XCTAssertEqual(BoardContent(spec: spec).blocks.map(\.id), ["n"])
    }

    // MARK: - The reviewed catalog (ios/Tests/examples.json, generated from server/src/examples.ts)

    private struct Example: Decodable {
        let id: String
        let name: String
        let spec: BoardSpec
    }

    private func examples() throws -> [Example] {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "examples", withExtension: "json"))
        return try JSONDecoder().decode([Example].self, from: Data(contentsOf: url))
    }

    func testEveryCatalogExampleDecodesWithNoUnknownComponent() throws {
        let examples = try examples()
        XCTAssertEqual(examples.count, 28)
        XCTAssertEqual(Set(examples.map(\.id)).count, 28)
        for example in examples {
            for (key, element) in example.spec.elements {
                if case .unknown(let type) = element.kind {
                    XCTFail("\(example.id): \(key) is an unknown component \(type)")
                }
            }
            let content = BoardContent(spec: example.spec)
            XCTAssertFalse(content.blocks.isEmpty, "\(example.id) has no leaf to draw")
            XCTAssertEqual(content.blocks.count, example.spec.elements.count - 1, "\(example.id) lost a leaf")
            for block in content.blocks {
                XCTAssertFalse(block.element.spokenSummary(redacted: false).isEmpty, "\(example.id): \(block.id) has no VoiceOver label")
            }
        }
    }

    func testBoardFlagsComeFromTheRootAndDefaultToOff() throws {
        let byID = Dictionary(uniqueKeysWithValues: try examples().map { ($0.id, BoardContent(spec: $0.spec)) })
        XCTAssertEqual(byID["needs-you"]?.alert, true)
        XCTAssertEqual(byID["needs-you"]?.showUpdated, false)
        XCTAssertEqual(byID["all-clear"]?.showUpdated, true)
        XCTAssertEqual(byID["all-clear"]?.alert, false)
        XCTAssertEqual(byID["rows"]?.alert, false)
        XCTAssertEqual(byID["rows"]?.showUpdated, false)
    }

    /// Optional props may be missing (boards saved before they existed) or null.
    func testOptionalPropsDecodeWhenAbsentOrNull() throws {
        let absent = """
        {"root":"b","elements":{
          "b":{"type":"Board","props":{"title":null},"children":["stat","progress","ring","trend","columns","bars","split","rows","agenda","dots","grid","list","steps","note"]},
          "stat":{"type":"Stat","props":{"label":"L","value":"1","caption":null,"tone":"default"},"children":[]},
          "progress":{"type":"Progress","props":{"label":"L","value":0.5,"caption":null,"tone":"default"},"children":[]},
          "ring":{"type":"Ring","props":{"label":"L","value":0.5,"tone":"accent"},"children":[]},
          "trend":{"type":"Trend","props":{"label":"L","value":"1","points":[1,2],"tone":"accent"},"children":[]},
          "columns":{"type":"Columns","props":{"label":"L","value":"1","columns":[{"label":"M","value":1},{"label":"T","value":null}]},"children":[]},
          "bars":{"type":"BarList","props":{"label":null,"items":[{"label":"A","value":"1","fraction":0.5,"tone":"accent"},{"label":"B","value":"2","fraction":1,"tone":"default"}]},"children":[]},
          "split":{"type":"Split","props":{"label":"L","value":"1","segments":[{"label":"A","value":"1","share":1},{"label":"B","value":"2","share":2}]},"children":[]},
          "rows":{"type":"Rows","props":{"label":null,"marker":"none","items":[{"label":"A","value":"1","tone":"default"},{"label":"B","value":"2","tone":"bad"}]},"children":[]},
          "agenda":{"type":"Agenda","props":{"label":"Today","items":[{"time":"3:30","text":"A"}]},"children":[]},
          "dots":{"type":"Dots","props":{"label":"L","value":"1","days":[{"label":"M","state":"done"},{"label":"T","state":"today"}],"tone":"good"},"children":[]},
          "grid":{"type":"Grid","props":{"label":"L","value":"1","offset":0,"days":[true,false],"tone":"good"},"children":[]},
          "list":{"type":"Checklist","props":{"label":"L","items":[{"text":"A","done":false}]},"children":[]},
          "steps":{"type":"Steps","props":{"label":"L","steps":["A","B"],"current":0},"children":[]},
          "note":{"type":"Note","props":{"text":"N","loud":false},"children":[]}
        }}
        """
        let null = """
        {"root":"b","elements":{
          "b":{"type":"Board","props":{"title":null,"alert":null,"showUpdated":null},"children":["stat","progress","ring","trend","columns","bars","split","rows","grid","steps","note"]},
          "stat":{"type":"Stat","props":{"label":"L","value":"1","supportingText":null,"change":null,"caption":null,"tone":"default"},"children":[]},
          "progress":{"type":"Progress","props":{"label":"L","value":0.5,"display":null,"marker":null,"supportingText":null,"trailingText":null,"caption":null,"tone":"default"},"children":[]},
          "ring":{"type":"Ring","props":{"label":"L","value":0.5,"display":null,"supportingText":null,"tone":"accent"},"children":[]},
          "trend":{"type":"Trend","props":{"label":"L","value":"1","points":[1,2],"goal":null,"supportingText":null,"tone":"accent"},"children":[]},
          "columns":{"type":"Columns","props":{"label":"L","value":"1","supportingText":null,"columns":[{"label":"M","value":1},{"label":"T","value":null}],"highlight":null},"children":[]},
          "bars":{"type":"BarList","props":{"label":null,"items":[{"label":"A","value":"1","fraction":0.5,"tone":"accent"},{"label":"B","value":"2","fraction":1,"tone":"default"}],"change":null},"children":[]},
          "split":{"type":"Split","props":{"label":"L","value":"1","segments":[{"label":"A","value":"1","share":1},{"label":"B","value":"2","share":2}]},"children":[]},
          "rows":{"type":"Rows","props":{"label":null,"marker":"icon","items":[{"label":"A","value":"1","detail":null,"tone":"default"},{"label":"B","value":"2","detail":null,"tone":"bad"}]},"children":[]},
          "grid":{"type":"Grid","props":{"label":"L","value":"1","supportingText":null,"offset":0,"days":[true,false],"tone":"good"},"children":[]},
          "steps":{"type":"Steps","props":{"label":"L","steps":["A","B"],"current":0,"supportingText":null},"children":[]},
          "note":{"type":"Note","props":{"text":"N","loud":false,"byline":null,"status":null,"supportingText":null},"children":[]}
        }}
        """
        for (name, json, count) in [("absent", absent, 14), ("null", null, 11)] {
            let spec = try JSONDecoder().decode(BoardSpec.self, from: Data(json.utf8))
            let content = BoardContent(spec: spec)
            XCTAssertEqual(content.blocks.count, count, "\(name): every leaf should decode")
            XCTAssertFalse(content.alert, name)
            XCTAssertFalse(content.showUpdated, name)
        }
    }

    func testUpdatedFooterNamesTheDayOnlyWhenItIsNotToday() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/Chicago"))
        let locale = Locale(identifier: "en_US")
        let saved = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 11, day: 10, hour: 7, minute: 2)))
        // Date formatting separates the time from AM/PM with a narrow no-break space.
        func plain(_ text: String) -> String {
            text.replacingOccurrences(of: "\u{202F}", with: " ").replacingOccurrences(of: "\u{00A0}", with: " ")
        }
        let laterThatDay = saved.addingTimeInterval(9 * 3600)
        let nextMorning = saved.addingTimeInterval(24 * 3600)
        XCTAssertEqual(plain(BoardFooter.text(updatedAt: saved, now: laterThatDay, calendar: calendar, locale: locale)), "Updated 7:02 AM")
        XCTAssertEqual(plain(BoardFooter.text(updatedAt: saved, now: nextMorning, calendar: calendar, locale: locale)), "Updated Nov 10, 7:02 AM")
    }

    /// Every catalog design at true widget size, small and medium, for
    /// comparison with the reviewed mockups. Set TEST_RUNNER_BOARD_RENDER_DIR
    /// on the xcodebuild command to also write the images to that directory.
    @MainActor func testCatalogRenderings() throws {
        let saved = try XCTUnwrap(Calendar.current.date(from: DateComponents(year: 2026, month: 11, day: 10, hour: 7, minute: 2)))
        let now = saved.addingTimeInterval(2 * 3600)
        let darkPass: Set<String> = ["number-delta", "number-sparkline", "budget-pace", "ring", "split-bar", "week-bars", "habit-week", "month-grid", "checklist", "steps", "agents", "outcome", "needs-you", "all-clear", "compare", "goal-line"]
        let largeTypePass: Set<String> = ["number-comparison", "remaining-bar", "ring", "week-bars", "agenda", "month-grid", "loud-reminder", "checklist", "steps", "needs-you", "all-clear", "goal-line"]
        for example in try examples() {
            let board = Board(id: example.id, spec: example.spec, updatedAt: saved)
            try render(board, name: "small-\(example.id)", family: .systemSmall, now: now)
            try render(board, name: "medium-\(example.id)", family: .systemMedium, now: now)
            try renderDetails(board, name: "detail-\(example.id)")
            if darkPass.contains(example.id) {
                try render(board, name: "small-dark-\(example.id)", family: .systemSmall, colorScheme: .dark, now: now)
                try render(board, name: "medium-dark-\(example.id)", family: .systemMedium, colorScheme: .dark, now: now)
            }
            if largeTypePass.contains(example.id) {
                try render(board, name: "small-ax3-\(example.id)", family: .systemSmall, typeSize: .accessibility3, now: now)
                try render(board, name: "medium-ax3-\(example.id)", family: .systemMedium, typeSize: .accessibility3, now: now)
            }
            if example.id == "needs-you" {
                // A tinted Home Screen removes the orange, so the standard palette must stay.
                try render(board, name: "small-tinted-\(example.id)", family: .systemSmall, colorScheme: .dark, fullColor: false, now: now)
            }
            if example.id == "all-clear" {
                try render(board, name: "small-yesterday-\(example.id)", family: .systemSmall, now: now.addingTimeInterval(24 * 3600))
            }
        }
    }

    @MainActor private func render(
        _ board: Board,
        name: String,
        family: WidgetFamily,
        colorScheme: ColorScheme = .light,
        typeSize: DynamicTypeSize = .large,
        fullColor: Bool = true,
        now: Date = .now
    ) throws {
        let view = BoardView(board: board, family: family, now: now)
            .padding(16)
            .frame(width: family == .systemMedium ? 338 : 158, height: 158)
            .background(BoardBackground(board: board, fullColor: fullColor))
            .environment(\.widgetRenderingMode, fullColor ? .fullColor : .accented)
            .environment(\.colorScheme, colorScheme)
            .environment(\.dynamicTypeSize, typeSize)
        try attach(view, name: name)
    }

    /// The app's list, where nothing may be truncated.
    @MainActor private func renderDetails(_ board: Board, name: String) throws {
        let view = VStack(alignment: .leading, spacing: 0) { BoardDetails(board: board) }
            .padding(16)
            .frame(width: 340, alignment: .leading)
            .background(Color.white)
            .environment(\.colorScheme, .light)
        try attach(view, name: name)
    }

    @MainActor private func attach(_ view: some View, name: String) throws {
        let renderer = ImageRenderer(content: view)
        renderer.scale = 3
        let image = try XCTUnwrap(renderer.uiImage, name)
        let attachment = XCTAttachment(image: image)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let directory = ProcessInfo.processInfo.environment["BOARD_RENDER_DIR"], !directory.isEmpty {
            let folder = URL(fileURLWithPath: directory, isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try XCTUnwrap(image.pngData(), name).write(to: folder.appendingPathComponent("\(name).png"))
        }
    }

    /// Artifacts are inspected at actual widget dimensions, not a roomy app preview.
    @MainActor func testNativeWidgetRenderings() throws {
        let cases: [(String, Board, WidgetFamily, CGFloat, CGFloat, ColorScheme, DynamicTypeSize)] = [
            ("small-weekly", BoardSamples.weeklySpending, .systemSmall, 158, 158, .light, .large),
            ("small-weekly-dark", BoardSamples.weeklySpending, .systemSmall, 158, 158, .dark, .large),
            ("small-weekly-large-type", BoardSamples.weeklySpending, .systemSmall, 158, 158, .light, .accessibility3),
            ("medium-weekly", BoardSamples.weeklySpending, .systemMedium, 338, 158, .light, .large),
            ("small-spending", BoardSamples.spending, .systemSmall, 158, 158, .light, .large),
            ("medium-spending", BoardSamples.spending, .systemMedium, 338, 158, .light, .large),
            ("medium-dark", BoardSamples.spending, .systemMedium, 338, 158, .dark, .large),
            ("small-large-type", BoardSamples.spending, .systemSmall, 158, 158, .light, .accessibility3),
            ("small-reminder", BoardSamples.reminder, .systemSmall, 158, 158, .light, .large),
            ("small-progress", BoardSamples.progress, .systemSmall, 158, 158, .light, .large)
        ]
        for (name, board, family, width, height, colorScheme, typeSize) in cases {
            let view = BoardView(board: board, family: family)
                .padding(16).frame(width: width, height: height)
                .background(colorScheme == .dark ? Color.black : Color.white)
                .environment(\.colorScheme, colorScheme)
                .environment(\.dynamicTypeSize, typeSize)
            let renderer = ImageRenderer(content: view)
            renderer.scale = 3
            let attachment = XCTAttachment(image: try XCTUnwrap(renderer.uiImage))
            attachment.name = name
            attachment.lifetime = .keepAlways
            add(attachment)
        }
    }
}
