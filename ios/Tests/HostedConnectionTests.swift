import CryptoKit
import XCTest
@testable import WidgetBoard

final class HostedConnectionTests: XCTestCase {
    struct Fixture: Decodable {
        let privateKey: String
        let state: String
        let callback: URL
    }
    private func fixture() throws -> (Fixture, PairingSession) {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "pairing", withExtension: "json"))
        let fixture = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
        let privateKey = try P256.KeyAgreement.PrivateKey(rawRepresentation: XCTUnwrap(Data(base64url: fixture.privateKey)))
        return (fixture, PairingSession(privateKey: privateKey, state: fixture.state))
    }

    func testDecryptsActualWebCryptoFormatAndBuildsHostedRequest() throws {
        let (fixture, pairing) = try fixture()
        let credential = try pairing.open(fixture.callback)
        XCTAssertEqual(credential.gatewayToken, "test-gateway-not-a-credential")
        XCTAssertEqual(credential.deviceToken, String(repeating: "a", count: 43))
        let request = try BoardClient.request(path: "device/boards/welcome", connection: credential)
        XCTAssertEqual(request.url, HostedService.origin.appending(path: "device/boards/welcome"))
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Widget-Device-Token"), credential.deviceToken)
        XCTAssertEqual(request.value(forHTTPHeaderField: "OAI-Sites-Authorization"), "Bearer \(credential.gatewayToken)")
        XCTAssertNil(request.url?.query)
    }

    func testRejectsWrongDeviceWrongStateAndModifiedCiphertext() throws {
        let (fixture, pairing) = try fixture()
        XCTAssertThrowsError(try PairingSession(privateKey: .init(), state: fixture.state).open(fixture.callback))
        XCTAssertThrowsError(try PairingSession(privateKey: pairing.privateKey, state: "wrong-state").open(fixture.callback))
        var modified = try XCTUnwrap(URLComponents(url: fixture.callback, resolvingAgainstBaseURL: false))
        modified.queryItems = modified.queryItems?.map { $0.name == "data" ? URLQueryItem(name: "data", value: String(repeating: "a", count: 64)) : $0 }
        XCTAssertThrowsError(try pairing.open(XCTUnwrap(modified.url)))
    }

    func testRejectsDuplicateStateAndForeignCallback() throws {
        let (fixture, pairing) = try fixture()
        var modified = try XCTUnwrap(URLComponents(url: fixture.callback, resolvingAgainstBaseURL: false))
        modified.queryItems?.append(URLQueryItem(name: "state", value: fixture.state))
        XCTAssertThrowsError(try pairing.open(XCTUnwrap(modified.url)))
        modified = try XCTUnwrap(URLComponents(url: fixture.callback, resolvingAgainstBaseURL: false))
        modified.scheme = "https"
        XCTAssertThrowsError(try pairing.open(XCTUnwrap(modified.url)))
    }

    func testCacheIsAllowedForNetworkFailureButNeverAuthenticationFailure() {
        XCTAssertTrue(BoardClient.allowsCachedBoard(after: URLError(.notConnectedToInternet)))
        XCTAssertTrue(BoardClient.allowsCachedBoard(after: BoardClient.Failure.http(503)))
        XCTAssertFalse(BoardClient.allowsCachedBoard(after: BoardClient.Failure.needsConnection))
        XCTAssertFalse(BoardClient.allowsCachedBoard(after: ConnectionError.expired))
    }
}
