import Foundation
import Security

/// What the watch face complications and the Smart Stack widget show. The
/// watch app writes it whenever it hears from the server; the widget
/// extension only reads. They share it through the team's keychain group
/// (the watch profiles allow it), which needs no App Group set up by hand.
struct ComplicationData: Codable, Equatable {
    /// The next programmed day, e.g. "Day 2: Upper".
    var nextLabel: String?
    /// Monday of the week the counts belong to, yyyy-MM-dd.
    var weekStart: String
    var sessions: Int
    /// Days a week in the active program.
    var planned: Int?
    var sets: Int
    /// The workout in progress, if any.
    var activeTitle: String?
    /// When it started, epoch ms.
    var activeStartedAt: Double?

    static let accessGroup = "Z5ZY342DVK.com.kkrwhofrags.hellblazer.shared"
    private static let service = "com.kkrwhofrags.hellblazer.complication"

    private static var query: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "data",
            kSecAttrAccessGroup as String: accessGroup,
        ]
    }

    static func load() -> ComplicationData? {
        var lookup = query
        lookup[kSecReturnData as String] = true
        lookup[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(lookup as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data
        else { return nil }
        return try? JSONDecoder().decode(ComplicationData.self, from: data)
    }

    func save() {
        guard let data = try? JSONEncoder().encode(self) else { return }
        SecItemDelete(Self.query as CFDictionary)
        var item = Self.query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)
    }

    /// Signed out: the watch face shouldn't show the last lifter's week.
    static func clear() {
        SecItemDelete(query as CFDictionary)
    }

    var activeStartDate: Date? {
        activeStartedAt.map { Date(timeIntervalSince1970: $0 / 1000) }
    }

    /// When the counts stop being "this week".
    var weekEnd: Date? {
        let calendar = Calendar(identifier: .iso8601)
        let parser = DateFormatter()
        parser.calendar = calendar
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd"
        return parser.date(from: weekStart).flatMap { calendar.date(byAdding: .day, value: 7, to: $0) }
    }

    /// The same data as of `date`: a new week starts at zero.
    func asOf(_ date: Date) -> ComplicationData {
        guard let end = weekEnd, date >= end else { return self }
        var fresh = self
        fresh.sessions = 0
        fresh.sets = 0
        return fresh
    }
}
