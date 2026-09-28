import Foundation

/// Today's Recovery call, for the Recovery widget. The app works it out from
/// Apple Health (App/HealthExtras.swift: RecoveryCall, the same rules as the
/// card on Home in src/lib/recovery.ts) when it opens, when Home loads, and
/// in a background refresh early each morning, and leaves it in the App
/// Group; the widget only reads. Health can't be read while the phone's
/// locked, so the widget says when the call it has is from an earlier day.
struct RecoveryCache: Codable {
    static let widgetKind = "Recovery"
    private static let key = "recovery-call"

    /// The day it's for, yyyy-MM-dd in the phone's calendar.
    var date: String
    /// "ready", "steady" or "easy".
    var verdict: String
    var headline: String
    var sleepMin: Double?
    var hrv: Double?
    var rhr: Double?

    static func load() -> RecoveryCache? {
        guard let data = UserDefaults(suiteName: WidgetSnapshot.appGroup)?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(RecoveryCache.self, from: data)
    }

    func save() {
        guard let data = try? JSONEncoder().encode(self) else { return }
        UserDefaults(suiteName: WidgetSnapshot.appGroup)?.set(data, forKey: Self.key)
    }

    static func dayKey(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    func isFor(_ day: Date) -> Bool { date == Self.dayKey(day) }
}
