import AppIntents
import Foundation

/// Opening the app on a page from an intent. The intents that open the app
/// run in its process, where the app sets `handler` at launch; they're also
/// compiled into the widget extension so a Control Center button can name
/// them. Should one ever run there, the path waits in the App Group for the
/// app to pick up when it comes forward.
enum IntentRouter {
    static var handler: ((String) -> Void)?
    private static let pendingKey = "pending-path"

    static func open(_ path: String) {
        if let handler {
            handler(path)
        } else {
            UserDefaults(suiteName: WidgetSnapshot.appGroup)?.set(path, forKey: pendingKey)
        }
    }

    /// A path left by an intent that ran outside the app, once.
    static func takePending() -> String? {
        let store = UserDefaults(suiteName: WidgetSnapshot.appGroup)
        guard let path = store?.string(forKey: pendingKey) else { return nil }
        store?.removeObject(forKey: pendingKey)
        return path
    }
}

/// "Start a workout": Siri, Shortcuts, the Action button, and the Control
/// Center and Lock Screen control. Opens the Log screen.
struct StartWorkoutIntent: AppIntent {
    static let title: LocalizedStringResource = "Start a Workout"
    static let description = IntentDescription("Opens Fatty ready to log a new session.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        IntentRouter.open("/log")
        return .result()
    }
}
