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
