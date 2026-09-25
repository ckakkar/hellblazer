import ActivityKit
import Foundation

/// The workout in progress, as a Live Activity on the Lock Screen and in the
/// Dynamic Island. Shared by the app, which starts, updates and ends it, and
/// the widget extension, which draws it.
///
/// The site is the source of truth: the logger sends the whole state whenever
/// something changes (a set lands, a rest starts). Everything that moves on
/// its own, the workout clock and the rest countdown, is a date the system
/// draws from, so it keeps ticking while the app is suspended.
struct WorkoutActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// The session's title, e.g. "Day 1: Upper".
        var title: String
        /// The exercise being worked, or nil before the first one starts.
        var exercise: String?
        /// A short line under the exercise, e.g. "3 sets done".
        var detail: String?
        /// Working sets logged so far, for the whole session.
        var sets: Int
        /// Total volume, already formatted in the lifter's unit ("4,210 kg").
        var volume: String
        /// When the current rest ends; nil when not resting.
        var restEndsAt: Date?
        /// The rest's full length in seconds, for the progress bar.
        var restTotal: Double?
    }

    /// The session's id: tapping the activity opens /log/<id>.
    var sessionId: String
    /// When the session started. The elapsed clock counts up from here.
    var startedAt: Date
}

extension WorkoutActivityAttributes.ContentState {
    /// Whether a rest countdown is running or has just run out.
    var hasRest: Bool { restEndsAt != nil }
}
