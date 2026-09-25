import ActivityKit
import AppIntents
import Foundation
import UserNotifications

/// Changing the rest from outside the page: the Live Activity's +30s and
/// Skip buttons, the "Rest's up" alert's +30s, and a rest started on the
/// Apple Watch. Each updates the Live Activity and the alert straight away,
/// then leaves a command for the page, which takes it when it's next awake
/// (see useRestTimer in src/components/workout/rest-timer.tsx).
///
/// Shared by the app and the widget extension: the buttons live in the
/// extension, but their intents run in the app's process.
enum RestControl {
    /// A rest change for the page to take. Times are epoch ms, as on the web.
    struct Command: Codable {
        var sessionId: String
        /// Nil: the rest was skipped.
        var endsAt: Double?
        /// Seconds.
        var total: Double
        /// Whether the phone should say when it's over. False when the watch
        /// already does, so the wrist doesn't buzz twice.
        var alert: Bool
    }

    /// Posted in the app's process when a command is waiting.
    static let commandPosted = Notification.Name("FattyRestCommand")
    private static let commandKey = "rest-command"
    private static var store: UserDefaults? { UserDefaults(suiteName: WidgetSnapshot.appGroup) }

    static func post(_ command: Command) {
        guard let data = try? JSONEncoder().encode(command) else { return }
        store?.set(data, forKey: commandKey)
        NotificationCenter.default.post(name: commandPosted, object: nil)
    }

    /// The waiting command for this session, handed over once.
    static func take(sessionId: String) -> Command? {
        guard let data = store?.data(forKey: commandKey),
              let command = try? JSONDecoder().decode(Command.self, from: data),
              command.sessionId == sessionId
        else { return nil }
        store?.removeObject(forKey: commandKey)
        return command
    }

    private static func activity(for sessionId: String) -> Activity<WorkoutActivityAttributes>? {
        Activity<WorkoutActivityAttributes>.activities.first { $0.attributes.sessionId == sessionId }
    }

    /// More rest: a running rest moves; one that's over starts again from now.
    static func extend(sessionId: String, by seconds: Double) async {
        let now = Date()
        let activity = activity(for: sessionId)
        let state = activity?.content.state
        let running = state?.restEndsAt.flatMap { $0 > now ? $0 : nil }
        let end = (running ?? now).addingTimeInterval(seconds)
        let left = end.timeIntervalSince(now)
        let total = running == nil ? left : max(state?.restTotal ?? left, left)
        if let activity, var updated = state {
            updated.restEndsAt = end
            updated.restTotal = total
            await activity.update(ActivityContent(state: updated, staleDate: end))
        }
        RestAlert.schedule(sessionId: sessionId, endsAt: end, label: state?.exercise)
        post(Command(sessionId: sessionId, endsAt: end.timeIntervalSince1970 * 1000, total: total, alert: true))
    }

    /// No more rest: straight to the next set.
    static func skip(sessionId: String) async {
        if let activity = activity(for: sessionId) {
            var state = activity.content.state
            state.restEndsAt = nil
            state.restTotal = nil
            await activity.update(ActivityContent(state: state, staleDate: nil))
        }
        RestAlert.cancel()
        post(Command(sessionId: sessionId, endsAt: nil, total: 0, alert: false))
    }
}

/// The "Rest's up" alert, for when the phone is locked or the page asleep.
/// Time Sensitive, so it gets through a Focus; with a +30s action.
enum RestAlert {
    static let id = "rest-over"
    static let category = "rest-over"
    static let extendAction = "rest-extend-30"

    /// Registers the alert's +30s action. Called once at launch.
    static func registerCategory() {
        let extend = UNNotificationAction(identifier: extendAction, title: "Rest 30s more", options: [])
        UNUserNotificationCenter.current().setNotificationCategories([
            UNNotificationCategory(identifier: category, actions: [extend], intentIdentifiers: [], options: []),
        ])
    }

    /// Replaces any pending alert with one at `endsAt`. Asks for permission
    /// the first time. `label` is the exercise, e.g. "Bench Press".
    static func schedule(sessionId: String?, endsAt: Date, label: String?) {
        cancel()
        let interval = endsAt.timeIntervalSinceNow
        guard interval >= 1 else { return }
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            guard granted else { return }
            let content = UNMutableNotificationContent()
            content.title = "Rest's up"
            content.body = "\(label ?? "Next set"). Time to lift."
            content.sound = .default
            content.interruptionLevel = .timeSensitive
            content.categoryIdentifier = category
            if let sessionId { content.userInfo = ["sessionId": sessionId] }
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
            center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
        }
    }

    static func cancel() {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [id])
        center.removeDeliveredNotifications(withIdentifiers: [id])
    }
}

/// The Live Activity's "+30s" button.
struct ExtendRestIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Add 30 Seconds of Rest"
    static let isDiscoverable = false

    @Parameter(title: "Workout")
    var sessionId: String

    init() {}

    init(sessionId: String) {
        self.sessionId = sessionId
    }

    func perform() async throws -> some IntentResult {
        await RestControl.extend(sessionId: sessionId, by: 30)
        return .result()
    }
}

/// The Live Activity's "Skip" button (or "Done", once the rest is over).
struct SkipRestIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Skip Rest"
    static let isDiscoverable = false

    @Parameter(title: "Workout")
    var sessionId: String

    init() {}

    init(sessionId: String) {
        self.sessionId = sessionId
    }

    func perform() async throws -> some IntentResult {
        await RestControl.skip(sessionId: sessionId)
        return .result()
    }
}
