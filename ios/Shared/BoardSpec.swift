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

struct BoardProps: Decodable, Sendable { let title: String? }
struct StatProps: Decodable, Sendable {
    let label: String
    let value: String
    let caption: String?
    let tone: Tone
}
struct ProgressProps: Decodable, Sendable {
    let label: String
    let value: Double
    let caption: String?
    let tone: Tone
}
struct NoteProps: Decodable, Sendable {
    let text: String
    let loud: Bool
}

struct Element: Decodable, Sendable {
    enum Kind: Sendable {
        case board(BoardProps)
        case row
        case stat(StatProps)
        case progress(ProgressProps)
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
        switch type {
        case "Board": kind = .board(try container.decode(BoardProps.self, forKey: .props))
        case "Row": kind = .row
        case "Stat": kind = .stat(try container.decode(StatProps.self, forKey: .props))
        case "Progress": kind = .progress(try container.decode(ProgressProps.self, forKey: .props))
        case "Note": kind = .note(try container.decode(NoteProps.self, forKey: .props))
        default: kind = .unknown(type)
        }
    }
}

enum BoardClient {
    /// The prototype server runs on the Mac; the simulator reaches it at
    /// localhost. A real phone will need a deployed server and auth.
    static let baseURL = URL(string: "http://127.0.0.1:4747")!

    enum Failure: Error, LocalizedError {
        case notFound(String)
        case http(Int)

        var errorDescription: String? {
            switch self {
            case .notFound(let id): "No board named \"\(id)\""
            case .http(let status): "Server returned \(status)"
            }
        }
    }

    static func fetch(_ id: String) async throws -> Board {
        let url = baseURL.appending(path: "boards").appending(path: id)
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 10
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode != 200 {
            throw http.statusCode == 404 ? Failure.notFound(id) : Failure.http(http.statusCode)
        }
        return try decoder.decode(Board.self, from: data)
    }

    /// The server writes `updatedAt` with `Date.toISOString()`, which always
    /// includes milliseconds, e.g. `2026-11-10T04:02:55.538Z`.
    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let text = try decoder.singleValueContainer().decode(String.self)
            let style = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
            guard let date = try? style.parse(text) else {
                throw DecodingError.dataCorrupted(
                    .init(codingPath: decoder.codingPath, debugDescription: "Not an ISO 8601 date with milliseconds: \(text)")
                )
            }
            return date
        }
        return decoder
    }()
}
