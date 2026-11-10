import SwiftUI
import WidgetKit

@main
struct WidgetBoardApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

/// The app is a thin host for the widget: it previews a board at widget size
/// and can force the widgets to reload (reloads asked for while the app is in
/// the foreground don't count against the widget's refresh budget).
struct ContentView: View {
    @State private var boardName = "budget"
    @State private var result: Result<Board, Error>?
    @State private var reloadCount = 0

    var body: some View {
        NavigationStack {
            Form {
                Section("Board") {
                    TextField("Board name", text: $boardName)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                Section("Preview") {
                    preview
                        .frame(maxWidth: .infinity)
                        .listRowBackground(Color.clear)
                }
                Section {
                    Button("Reload") {
                        reloadCount += 1
                        WidgetCenter.shared.reloadAllTimelines()
                    }
                } footer: {
                    Text("Reloads this preview and every Board widget on the home screen.")
                }
            }
            .navigationTitle("Widget Board")
        }
        // Fetching is the one place this view talks to something outside
        // SwiftUI; it reruns when the name changes or Reload is tapped.
        .task(id: "\(boardName)#\(reloadCount)") {
            do {
                result = .success(try await BoardClient.fetch(boardName))
            } catch is CancellationError {
                // A newer fetch replaced this one.
            } catch {
                result = .failure(error)
            }
        }
    }

    @ViewBuilder private var preview: some View {
        Group {
            switch result {
            case .success(let board):
                BoardView(board: board)
            case .failure(let error):
                Text(error.localizedDescription)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            case nil:
                ProgressView()
            }
        }
        .padding(16)
        // systemSmall on a 393pt-wide iPhone.
        .frame(width: 158, height: 158)
        .background(.background, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: .black.opacity(0.12), radius: 12, y: 4)
    }
}
