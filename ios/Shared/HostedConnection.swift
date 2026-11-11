import CryptoKit
import Foundation
import Security

enum HostedService {
    static let origin = URL(string: "https://ethan-widget-board.ethanwoo.chatgpt.site")!
    static let boardID = "welcome"
    static let appGroup = "group.dev.widgetboard.shared"
}

struct DeviceConnection: Codable, Sendable {
    let version: Int
    let baseURL: URL
    let deviceId: String
    let deviceToken: String
    let gatewayToken: String
    let expiresAt: TimeInterval

    var isExpired: Bool { expiresAt <= Date.now.timeIntervalSince1970 }

    func validate() throws {
        guard version == 1, baseURL == HostedService.origin,
              UUID(uuidString: deviceId) != nil,
              deviceToken.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil,
              !gatewayToken.isEmpty, gatewayToken.count < 16_384,
              !isExpired else { throw ConnectionError.invalidConnection }
    }
}

enum ConnectionError: Error, LocalizedError {
    case notConnected, expired, invalidConnection, invalidCallback, couldNotStart, keychain(OSStatus), missingEntitlement

    var errorDescription: String? {
        switch self {
        case .notConnected: "Open Widget Board and connect with ChatGPT."
        case .expired: "Your device connection expired. Open Widget Board to reconnect."
        case .invalidConnection: "This connection is invalid or expired. Please connect again."
        case .invalidCallback: "Could not verify the connection. Please start again from this app."
        case .couldNotStart: "Could not open ChatGPT sign-in. Please try again."
        case .keychain: "Could not access the secure device connection. Check signing and Keychain Sharing for both app targets."
        case .missingEntitlement: "The shared app group is unavailable. Check signing and App Groups for both app targets."
        }
    }
}

struct PairingSession: Sendable {
    let privateKey: P256.KeyAgreement.PrivateKey // Type declaration only. gitleaks:allow
    let state: String

    init() {
        privateKey = P256.KeyAgreement.PrivateKey()
        // CryptoKit generates this independently of the key-agreement key.
        state = SymmetricKey(size: .bits256).withUnsafeBytes { Data($0).base64url }
    }

    init(privateKey: P256.KeyAgreement.PrivateKey, state: String) {
        self.privateKey = privateKey
        self.state = state
    }

    var signInURL: URL {
        var components = URLComponents(url: HostedService.origin.appending(path: "device/connect"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "state", value: state), URLQueryItem(name: "key", value: privateKey.publicKey.x963Representation.base64url)]
        return components.url!
    }

    func open(_ callback: URL) throws -> DeviceConnection {
        guard let components = URLComponents(url: callback, resolvingAgainstBaseURL: false),
              components.scheme == "widgetboard", components.host == "connect",
              components.path.isEmpty, components.fragment == nil,
              let items = components.queryItems,
              Set(items.map(\.name)).count == items.count,
              items.first(where: { $0.name == "state" })?.value == state else { throw ConnectionError.invalidCallback }
        func value(_ key: String) throws -> Data {
            guard let encoded = items.first(where: { $0.name == key })?.value,
                  let data = Data(base64url: encoded) else { throw ConnectionError.invalidCallback }
            return data
        }
        let peer = try P256.KeyAgreement.PublicKey(x963Representation: value("key"))
        let salt = try value("salt")
        let nonce = try value("nonce")
        let data = try value("data")
        guard salt.count == 32, nonce.count == 12, data.count > 16, data.count < 32_768 else { throw ConnectionError.invalidCallback }
        let shared = try privateKey.sharedSecretFromKeyAgreement(with: peer)
        let key = shared.hkdfDerivedSymmetricKey(using: SHA256.self, salt: salt, sharedInfo: Data("widget-board-device-v1".utf8), outputByteCount: 32)
        let sealed = try AES.GCM.SealedBox(nonce: AES.GCM.Nonce(data: nonce), ciphertext: data.dropLast(16), tag: data.suffix(16))
        let plaintext = try AES.GCM.open(sealed, using: key, authenticating: Data(state.utf8))
        let connection = try JSONDecoder().decode(DeviceConnection.self, from: plaintext)
        try connection.validate()
        return connection
    }
}

extension Data {
    var base64url: String { base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") }
    init?(base64url: String) {
        guard base64url.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else { return nil }
        var value = base64url.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        value += String(repeating: "=", count: (4 - value.count % 4) % 4)
        self.init(base64Encoded: value)
    }
}

enum ConnectionStore {
    private static func query() throws -> [String: Any] {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "BoardKeychainAccessGroup") as? String, !group.isEmpty, !group.contains("$(") else { throw ConnectionError.missingEntitlement }
        return [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "dev.widgetboard.connection", kSecAttrAccount as String: "current-device", kSecAttrAccessGroup as String: group]
    }

    static func load() throws -> DeviceConnection? {
        var attributes = try query()
        attributes[kSecReturnData as String] = true
        attributes[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(attributes as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw ConnectionError.keychain(status) }
        return try JSONDecoder().decode(DeviceConnection.self, from: data)
    }

    static func save(_ connection: DeviceConnection) throws {
        try connection.validate()
        let attributes = try query()
        let values: [String: Any] = [kSecValueData as String: try JSONEncoder().encode(connection), kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        var status = SecItemUpdate(attributes as CFDictionary, values as CFDictionary)
        if status == errSecItemNotFound {
            status = SecItemAdd(attributes.merging(values) { _, value in value } as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw ConnectionError.keychain(status) }
    }

    static func remove() throws {
        let status = SecItemDelete(try query() as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw ConnectionError.keychain(status) }
    }
}
