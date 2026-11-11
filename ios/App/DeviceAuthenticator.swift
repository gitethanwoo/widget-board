import AuthenticationServices
import Foundation
import UIKit

@MainActor
final class DeviceAuthenticator: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    @Published private(set) var isConnecting = false
    private var session: ASWebAuthenticationSession?

    func connect() async throws -> DeviceConnection {
        guard !isConnecting else { throw ConnectionError.couldNotStart }
        isConnecting = true
        defer { isConnecting = false; session = nil }
        let pairing = PairingSession()
        let callback: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: pairing.signInURL, callbackURLScheme: "widgetboard") { callback, error in
                if let error { continuation.resume(throwing: error) }
                else if let callback { continuation.resume(returning: callback) }
                else { continuation.resume(throwing: ConnectionError.invalidCallback) }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() { continuation.resume(throwing: ConnectionError.couldNotStart) }
        }
        let connection = try pairing.open(callback)
        // A completed browser login alone does not establish working device access.
        try await BoardClient.verify(connection)
        try ConnectionStore.save(connection)
        try? BoardCache.clear()
        return connection
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows).first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}
