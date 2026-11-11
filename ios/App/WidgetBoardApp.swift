import SwiftUI
import WidgetKit
import AuthenticationServices

@main
struct WidgetBoardApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

/// Opening a widget reveals its full canvas, with connection controls below.
struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var authenticator = DeviceAuthenticator()
    @State private var connection: DeviceConnection?
    @State private var connectionError: String?
    @State private var isDisconnecting = false
    @State private var result: Result<Board, Error>?
    @State private var reloadCount = 0
    @State private var pushStatus: String?

    var body: some View {
        NavigationStack {
            Form {
                canvas
                Section {
                    if let connection, !connection.isExpired {
                        Label("Connected to your canvas", systemImage: "checkmark.shield")
                            .foregroundStyle(.green)
                        Button("Reconnect with ChatGPT") { connect() }
                        Button(isDisconnecting ? "Disconnecting…" : "Disconnect this iPhone", role: .destructive) {
                            Task {
                                isDisconnecting = true
                                defer { isDisconnecting = false }
                                do {
                                    try await BoardClient.disconnect()
                                    self.connection = nil
                                    result = nil
                                    connectionError = nil
                                    WidgetCenter.shared.reloadAllTimelines()
                                } catch { connectionError = error.localizedDescription }
                            }
                        }
                        .disabled(isDisconnecting)
                    } else {
                        Button(authenticator.isConnecting ? "Connecting…" : "Continue with ChatGPT") { connect() }
                    }
                    if let connectionError { Text(connectionError).font(.footnote).foregroundStyle(.red) }
                    if connection != nil, let pushStatus { Text(pushStatus).font(.footnote).foregroundStyle(.secondary) }
                } header: {
                    Text("Connection")
                } footer: {
                    Text("Connect once to let this iPhone and its widgets read your canvas. Your agents update it through ChatGPT.")
                }
                .disabled(authenticator.isConnecting)
                Section {
                    Button("Reload") {
                        reloadCount += 1
                        WidgetCenter.shared.reloadAllTimelines()
                    }
                    .disabled(connection == nil)
                    Link("Open hosted board", destination: HostedService.origin)
                    Link("Manage connected devices", destination: HostedService.origin.appending(path: "devices"))
                } footer: {
                    Text("Refreshes your canvas and every Board widget on the home screen.")
                }
            }
            .navigationTitle("Widget Board")
        }
        .task {
            do { connection = try ConnectionStore.load() }
            catch { connectionError = error.localizedDescription }
        }
        .task(id: "\(scenePhase == .active)#\(reloadCount)#\(connection?.deviceId ?? "")") {
            guard scenePhase == .active, connection != nil else { return }
            if #available(iOS 26.0, *) { pushStatus = await WidgetPushRegistration.shared.refresh() }
        }
        // Fetching is the one place this view talks to something outside
        // SwiftUI; it reruns when the connection changes or Reload is tapped.
        .task(id: "\(scenePhase == .active)#\(reloadCount)#\(connection?.deviceId ?? "")") {
            guard connection != nil else { result = nil; return }
            guard scenePhase == .active else { return }
            do {
                result = .success(try await BoardClient.fetch())
            } catch is CancellationError {
                // A newer fetch replaced this one.
            } catch {
                result = .failure(error)
            }
        }
    }

    private func connect() {
        Task {
            connectionError = nil
            do {
                connection = try await authenticator.connect()
                reloadCount += 1
                WidgetCenter.shared.reloadAllTimelines()
            } catch let error as ASWebAuthenticationSessionError where error.code == .canceledLogin {
                // Cancelling leaves an existing connection intact.
            } catch { connectionError = error.localizedDescription }
        }
    }

    @ViewBuilder private var canvas: some View {
        switch result {
        case .success(let board):
            Section {
                BoardDetails(board: board)
            } header: {
                Text(BoardContent(spec: board.spec).title ?? "Your canvas")
            } footer: {
                Text("Canvas saved \(board.updatedAt.formatted(date: .abbreviated, time: .shortened)).")
            }
        case .failure(let error):
            Section("Your canvas") {
                Text(error.localizedDescription).foregroundStyle(.secondary)
            }
        case nil:
            Section("Your canvas") {
                if connection == nil {
                    Label("Connect to see your canvas", systemImage: "rectangle.badge.person.crop")
                        .foregroundStyle(.secondary)
                } else { ProgressView() }
            }
        }
    }
}
