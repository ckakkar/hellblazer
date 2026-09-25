import AppIntents

/// Siri, Spotlight and the Shortcuts app. Each intent opens the app on the
/// right page; the phrases work without any setup by the user.
struct StartWorkoutIntent: AppIntent {
    static let title: LocalizedStringResource = "Start a Workout"
    static let description = IntentDescription("Opens Fatty ready to log a new session.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        NativeRouter.shared.open(path: "/log")
        return .result()
    }
}

struct ShowProgressIntent: AppIntent {
    static let title: LocalizedStringResource = "Show My Progress"
    static let description = IntentDescription("Opens your lift trends and records.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        NativeRouter.shared.open(path: "/progress")
        return .result()
    }
}

struct ShowHistoryIntent: AppIntent {
    static let title: LocalizedStringResource = "Show Workout History"
    static let description = IntentDescription("Opens your past sessions.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        NativeRouter.shared.open(path: "/history")
        return .result()
    }
}

struct HellBlazerShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartWorkoutIntent(),
            phrases: [
                "Start a workout in \(.applicationName)",
                "Start training in \(.applicationName)",
                "Log a workout in \(.applicationName)",
            ],
            shortTitle: "Start Workout",
            systemImageName: "figure.strengthtraining.traditional"
        )
        AppShortcut(
            intent: ShowProgressIntent(),
            phrases: [
                "Show my progress in \(.applicationName)",
                "How are my lifts in \(.applicationName)",
            ],
            shortTitle: "Progress",
            systemImageName: "chart.line.uptrend.xyaxis"
        )
        AppShortcut(
            intent: ShowHistoryIntent(),
            phrases: ["Show my workouts in \(.applicationName)"],
            shortTitle: "History",
            systemImageName: "clock.arrow.circlepath"
        )
    }
}
