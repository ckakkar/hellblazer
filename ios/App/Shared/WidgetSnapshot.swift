import Foundation

/// What the Home Screen and Lock Screen widgets show, plus what Siri and
/// Spotlight know. The app writes it into the shared App Group whenever the
/// dashboard loads; the widget only reads.
struct WidgetSnapshot: Codable {
    /// The next programmed workout, e.g. "Upper A (Mon)". Nil without a program.
    var nextBout: String?
    /// Its template, for the widget's Start button.
    var nextTemplateId: String?
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

    /// For Siri and Spotlight: the lifter's display unit ("kg" or "lb"),
    /// the days /log offers, and their bests (src/lib/actions/native.ts).
    var unit: String?
    var workouts: [Workout]?
    var lifts: [Lift]?
    /// This week's sets per muscle, in the dashboard chart's order.
    var muscles: [MuscleSets]?
    /// Estimated-max history per lift, most trained first.
    var trends: [Trend]?

    struct Workout: Codable {
        var templateId: String
        /// "Day 2: Upper".
        var label: String
    }

    struct Lift: Codable {
        /// The exercise id.
        var id: String
        var name: String
        /// The set behind the best estimated max, in the display unit.
        var bestWeight: Double
        var bestReps: Int
        var estimatedMax: Double
    }

    struct MuscleSets: Codable {
        var key: String
        var label: String
        var sets: Double
        /// One of the lifter's tracked weak points.
        var weak: Bool
    }

    struct Trend: Codable {
        /// The exercise id.
        var id: String
        var name: String
        var points: [Point]

        struct Point: Codable {
            /// yyyy-MM-dd.
            var date: String
            /// Best estimated 1RM that session, display unit.
            var e1rm: Double
        }
    }

    /// Starts the next programmed day (/log?start=…), for the widget's button.
    var startURL: URL? {
        nextTemplateId.flatMap { URL(string: "https://hellblazer.vercel.app/log?start=\($0)") }
    }

    static let appGroup = "group.com.kkrwhofrags.hellblazer"
    static let storageKey = "widget-snapshot"

    /// Stores a snapshot's JSON for the widgets (the app only).
    static func save(_ data: Data) {
        UserDefaults(suiteName: appGroup)?.set(data, forKey: storageKey)
    }

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
