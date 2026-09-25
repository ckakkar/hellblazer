import Foundation

/// What the Home Screen and Lock Screen widgets show. The app writes it into
/// the shared App Group whenever the dashboard loads; the widget only reads.
struct WidgetSnapshot: Codable {
    /// The next programmed workout, e.g. "Upper A (Mon)". Nil without a program.
    var nextBout: String?
    var programName: String?
    var sessionsThisWeek: Int
    /// Workouts per week in the active program, when there is one.
    var sessionsPlanned: Int?
    var setsThisWeek: Int
    /// Monday of the week the numbers belong to (yyyy-MM-dd, the lifter's
    /// calendar). Past that week, the widget shows a fresh week instead.
    var weekStart: String
    /// Epoch milliseconds.
    var updatedAt: Double

    static let appGroup = "group.com.kkrwhofrags.hellblazer"
    static let storageKey = "widget-snapshot"

    static func load() -> WidgetSnapshot? {
        guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: storageKey) else { return nil }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }

    /// The first moment of the week after this snapshot's: when its numbers
    /// stop being "this week", and when the widget's timeline redraws.
    func weekEnd() -> Date? {
        let calendar = Calendar(identifier: .iso8601)
        let parser = DateFormatter()
        parser.calendar = calendar
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd"
        guard let start = parser.date(from: weekStart) else { return nil }
        return calendar.date(byAdding: .day, value: 7, to: start)
    }

    func isFromPastWeek(now: Date = Date()) -> Bool {
        guard let end = weekEnd() else { return false }
        return now >= end
    }
}
