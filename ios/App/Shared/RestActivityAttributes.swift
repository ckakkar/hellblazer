import ActivityKit
import Foundation

/// The rest timer's Live Activity. Shared by the app, which starts and ends
/// it, and the widget extension, which draws it on the Lock Screen and in the
/// Dynamic Island.
struct RestActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// When the rest ends. The system draws the countdown from this date,
        /// so it keeps ticking while the app is suspended.
        var endsAt: Date
        /// The rest's full length in seconds, for the progress bar.
        var total: Double
    }

    /// What the rest comes before, e.g. "Bench Press · set 3".
    var label: String
}
