import AppIntents

/// Siri, Spotlight and the Shortcuts app; the phrases work without any setup
/// by the user. "Start a Workout" is in Shared/OpenAppIntents.swift, since the
/// Control Center button uses it too. The workout days and lifts come from
/// the snapshot the site hands the app (WidgetSnapshot).

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

// MARK: Workout days

/// "Start Day 2 in Fatty": begins that day straight away (/log?start=…).
struct StartWorkoutDayIntent: AppIntent {
    static let title: LocalizedStringResource = "Start a Workout Day"
    static let description = IntentDescription("Starts one of your workout days in Fatty.")
    static let openAppWhenRun = true

    @Parameter(title: "Workout")
    var workout: WorkoutDayEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Start \(\.$workout)")
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        let id = workout.id.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(.init(charactersIn: "-"))) ?? workout.id
        NativeRouter.shared.open(path: "/log?start=\(id)")
        return .result()
    }
}

// MARK: Lifts

/// "What's my bench max in Fatty?": answered out loud, without opening the app.
struct LiftBestIntent: AppIntent {
    static let title: LocalizedStringResource = "Check a Lift's Best"
    static let description = IntentDescription("Tells you your best set and estimated max on a lift.")

    @Parameter(title: "Lift")
    var lift: LiftEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Best on \(\.$lift)")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let snapshot = WidgetSnapshot.load()
        let unit = snapshot?.unit ?? "kg"
        guard let best = snapshot?.lifts?.first(where: { $0.id == lift.id }) else {
            return .result(dialog: "Fatty doesn't have a working set of \(lift.name) from you yet.")
        }
        let weight = best.bestWeight.rounded() == best.bestWeight
            ? String(Int(best.bestWeight))
            : String(format: "%.1f", best.bestWeight)
        let text = "Your best \(best.name) is \(weight) \(unit) for \(best.bestReps), "
            + "an estimated max of \(Int(best.estimatedMax.rounded())) \(unit)."
        return .result(dialog: "\(text)")
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
            intent: StartWorkoutDayIntent(),
            phrases: [
                "Start \(\.$workout) in \(.applicationName)",
                "Train \(\.$workout) in \(.applicationName)",
            ],
            shortTitle: "Start a Day",
            systemImageName: "play.fill"
        )
        AppShortcut(
            intent: LiftBestIntent(),
            phrases: [
                "What's my \(\.$lift) max in \(.applicationName)",
                "What's my best \(\.$lift) in \(.applicationName)",
            ],
            shortTitle: "Lift Best",
            systemImageName: "trophy"
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
