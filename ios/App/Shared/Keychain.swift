import Foundation
import Security

/// Device tokens, in the keychain on each device: the watch's (the iPhone
/// keeps the one it handed over, the watch the one it uses for /api/watch)
/// and the iPhone's own. Only this app can read them, from first unlock on,
/// so a background wake (the watch, a silent push) can still reach them.
enum Keychain {
    private static let service = "com.kkrwhofrags.hellblazer.watch"

    private static func query(_ account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    /// The watch's token.
    static var token: String? {
        get { get("token") }
        set { set(newValue, for: "token") }
    }

    /// The iPhone's own token, for refreshing widgets in the background.
    static var phoneToken: String? {
        get { get("phone") }
        set { set(newValue, for: "phone") }
    }

    private static func get(_ account: String) -> String? {
        var lookup = query(account)
        lookup[kSecReturnData as String] = true
        lookup[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(lookup as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func set(_ value: String?, for account: String) {
        SecItemDelete(query(account) as CFDictionary)
        guard let value, let data = value.data(using: .utf8) else { return }
        var item = query(account)
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)
    }
}
