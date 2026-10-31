import Foundation

/// Today's Recovery call, for the Recovery widget and the watch. The app
/// works it out from Apple Health and the training Home handed it
/// (App/HealthExtras.swift: RecoveryCall, the same rules as the card on Home
/// in src/lib/recovery.ts) when it opens, when Home loads, and in a
/// background refresh about every hour, and leaves it in the App Group; the
/// widget only reads. Health can't be read while the phone's locked, so the
/// widget says when the call it has is from an earlier day.
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
    /// What to do about it, in a sentence (2.9 on, as are the rest).
    var advice: String? = nil
    /// What the call rests on, the most telling first: "HRV 41 ms, 18% under your usual 50".
    var reasons: [String]? = nil
    /// Two weeks of HRV, oldest first, nil where there's no reading: the watch's line.
    var hrvTrend: [Double?]? = nil
    /// When it was worked out, epoch seconds.
    var readAt: Double? = nil

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
