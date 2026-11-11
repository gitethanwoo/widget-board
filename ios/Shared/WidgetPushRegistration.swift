import Foundation
import OSLog
import WidgetKit

@available(iOS 26.0, *)
struct BoardPushHandler: WidgetPushHandler {
    func pushTokenDidChange(_ pushInfo: WidgetPushInfo, widgets: [WidgetInfo]) {
        Task { _ = await WidgetPushRegistration.shared.register(pushInfo, widgets: widgets) }
    }
}

@available(iOS 26.0, *)
actor WidgetPushRegistration {
    static let shared = WidgetPushRegistration()
    private let logger = Logger(subsystem: "dev.widgetboard.app", category: "widget-push")
    private var lastUpload: (signature: String, date: Date, message: String)?

    func refresh() async -> String {
        do {
            guard let (info, widgets) = try await Self.currentRegistration() else {
                return "Push refresh will be ready after iOS registers your Home Screen widget."
            }
            return await register(info, widgets: widgets)
        } catch {
            return "Could not check widget push registration. It will retry automatically."
        }
    }

    private nonisolated static func currentRegistration() async throws -> (WidgetPushInfo, [WidgetInfo])? {
        guard let info = await WidgetCenter.shared.currentPushInfo else { return nil }
        return (info, try await WidgetCenter.shared.currentConfigurations())
    }

    func register(_ info: WidgetPushInfo, widgets: [WidgetInfo]) async -> String {
        do {
            guard let connection = try ConnectionStore.load(), !connection.isExpired else { return "Connect to enable widget pushes." }
            let names = widgets.contains { $0.kind == "BoardWidget" } ? [HostedService.boardID] : []
            let token = info.token.map { String(format: "%02x", $0) }.joined()
            let environment = Self.pushEnvironment()
            let signature = "\(connection.deviceId)|\(environment)|\(token)|\(names.joined(separator: ","))"
            if let lastUpload, lastUpload.signature == signature, Date.now.timeIntervalSince(lastUpload.date) < 60 {
                return lastUpload.message
            }
            let configured = try await BoardClient.registerPush(token: token, environment: environment, boards: names, connection: connection)
            let message = names.isEmpty ? "Add a Board widget to your Home Screen to receive push updates."
                : configured ? "Widget push refresh is enabled."
                : "Widget registered. Apple push delivery is awaiting server setup."
            lastUpload = (signature, .now, message)
            logger.info("Registered widget push; canvas present: \(!names.isEmpty); server configured: \(configured)")
            return message
        } catch {
            logger.error("Widget push registration failed; will retry on the next refresh")
            return "Push registration will retry on the next refresh."
        }
    }

    // Development and ad-hoc builds include their actual signed environment.
    // App Store installs omit the provisioning profile and use production APNs.
    static func pushEnvironment() -> String {
        if let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
           let data = try? Data(contentsOf: url),
           let start = data.range(of: Data("<?xml".utf8)),
           let end = data.range(of: Data("</plist>".utf8), in: start.lowerBound..<data.endIndex),
           let plist = try? PropertyListSerialization.propertyList(from: data[start.lowerBound..<end.upperBound], format: nil) as? [String: Any],
           let entitlements = plist["Entitlements"] as? [String: Any],
           let value = entitlements["aps-environment"] as? String,
           value == "development" || value == "production" { return value }
        return "production"
    }
}
