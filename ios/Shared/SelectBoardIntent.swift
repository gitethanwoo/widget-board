import AppIntents

/// Include this in both app and widget targets: iOS resolves configuration
/// metadata against the containing app when creating a widget timeline.
struct SelectBoardIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Board"
    static let description = IntentDescription("Shows the canvas your agent updates.")
}
