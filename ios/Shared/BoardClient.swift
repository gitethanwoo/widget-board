import Foundation

// Never forward the two device credentials to a sign-in redirect or another host.
private final class NoRedirects: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

enum BoardClient {
    static let baseURL = HostedService.origin
    private static let session = URLSession(configuration: .ephemeral, delegate: NoRedirects(), delegateQueue: nil)

    enum Failure: Error, LocalizedError {
        case notFound(String), invalidName, needsConnection, http(Int)
        var errorDescription: String? {
            switch self {
            case .notFound: "Your canvas is empty. Ask your agent to put something on it."
            case .invalidName: "Use lowercase letters, digits and dashes for a board name."
            case .needsConnection: "Open Widget Board and reconnect with ChatGPT."
            case .http(let status): "The hosted service returned \(status). Try again shortly."
            }
        }
    }

    static func request(path: String, connection: DeviceConnection, method: String = "GET") throws -> URLRequest {
        try connection.validate()
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(connection.gatewayToken)", forHTTPHeaderField: "OAI-Sites-Authorization")
        request.setValue(connection.deviceToken, forHTTPHeaderField: "X-Widget-Device-Token")
        return request
    }

    private static func connection() throws -> DeviceConnection {
        guard let connection = try ConnectionStore.load() else { throw ConnectionError.notConnected }
        guard !connection.isExpired else { throw ConnectionError.expired }
        return connection
    }

    private static func data(for request: URLRequest, board: String = "") async throws -> Data {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw Failure.http(0) }
        if http.statusCode == 401 || http.statusCode == 403 || (300...399).contains(http.statusCode) { throw Failure.needsConnection }
        if http.statusCode == 404 { throw Failure.notFound(board) }
        guard http.statusCode == 200 else { throw Failure.http(http.statusCode) }
        return data
    }

    static func verify(_ connection: DeviceConnection) async throws {
        let bytes = try await data(for: request(path: "device/boards", connection: connection))
        struct Boards: Decodable { let boards: [Board] }
        _ = try decoder.decode(Boards.self, from: bytes)
    }

    static func registerPush(token: String, environment: String, boards: [String], connection: DeviceConnection) async throws -> Bool {
        struct Registration: Encodable { let token: String; let environment: String; let boards: [String] }
        struct Result: Decodable { let deliveryConfigured: Bool }
        var request = try request(path: "device/push", connection: connection, method: "PUT")
        request.timeoutInterval = 5
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(Registration(token: token, environment: environment, boards: boards))
        return try JSONDecoder().decode(Result.self, from: await data(for: request)).deliveryConfigured
    }

    static func fetch() async throws -> Board {
        let id = HostedService.boardID
        let connection = try connection()
        let bytes: Data
        do {
            bytes = try await data(for: request(path: "device/boards/\(id)", connection: connection), board: id)
        } catch Failure.needsConnection {
            // A rejected credential must not become an offline fallback later.
            if (try? ConnectionStore.load()?.deviceId) == connection.deviceId {
                try? ConnectionStore.remove()
                try? BoardCache.clear()
            }
            throw Failure.needsConnection
        }
        let board = try decoder.decode(Board.self, from: bytes)
        try? BoardCache.save(bytes, board: id, connection: connection.deviceId)
        return board
    }

    static func cached() -> Board? {
        let id = HostedService.boardID
        guard let connection = try? connection(), let bytes = try? BoardCache.read(board: id, connection: connection.deviceId) else { return nil }
        return try? decoder.decode(Board.self, from: bytes)
    }

    static func disconnect() async throws {
        if let current = try ConnectionStore.load() {
            _ = try await data(for: request(path: "device/disconnect", connection: current, method: "POST"))
        }
        try ConnectionStore.remove()
        try BoardCache.clear()
    }

    static func allowsCachedBoard(after error: Error) -> Bool {
        if let urlError = error as? URLError { return urlError.code != .cancelled }
        if case Failure.http(let status) = error { return status >= 500 }
        return false
    }

    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let text = try decoder.singleValueContainer().decode(String.self)
            let style = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
            guard let date = try? style.parse(text) else {
                throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Invalid ISO 8601 date."))
            }
            return date
        }
        return decoder
    }()
}

enum BoardCache {
    private static func directory() throws -> URL {
        guard let shared = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: HostedService.appGroup) else { throw ConnectionError.missingEntitlement }
        return shared.appending(path: "Boards", directoryHint: .isDirectory)
    }
    private static func file(board: String, connection: String) throws -> URL {
        guard board.range(of: "^[a-z0-9][a-z0-9-]{0,39}$", options: .regularExpression) != nil, UUID(uuidString: connection) != nil else { throw BoardClient.Failure.invalidName }
        return try directory().appending(path: "\(connection)-\(board).json")
    }
    static func save(_ data: Data, board: String, connection: String) throws {
        var folder = try directory()
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try folder.setResourceValues(values)
        try data.write(to: file(board: board, connection: connection), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
    static func read(board: String, connection: String) throws -> Data { try Data(contentsOf: file(board: board, connection: connection)) }
    static func clear() throws {
        let folder = try directory()
        if FileManager.default.fileExists(atPath: folder.path) { try FileManager.default.removeItem(at: folder) }
    }
}
