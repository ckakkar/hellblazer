import AppIntents

/// Siri, Spotlight and the Shortcuts app; the phrases work without any setup
/// by the user. "Start a Workout" is in Shared/OpenAppIntents.swift and the
/// set logging in Shared/SetLogging.swift, since Control Center buttons use
/// them too. The workout days and lifts come from
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

// MARK: The workout, hands-free

/// "Finish my workout in Fatty": finishes the one in progress, saves it to
/// Apple Health, and says how it went.
struct FinishWorkoutIntent: AppIntent {
    static let title: LocalizedStringResource = "Finish Workout"
    static let description = IntentDescription("Finishes the workout in progress and saves it.")

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let reply = await VoiceSetLogger.finish()
        return .result(dialog: "\(reply)")
    }
}

/// "Undo my last set in Fatty": for when Siri heard 150, not 105.
struct UndoLastSetIntent: AppIntent {
    static let title: LocalizedStringResource = "Undo Last Set"
    static let description = IntentDescription("Takes back the last set of the workout in progress.")

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let reply = await VoiceSetLogger.undo()
        return .result(dialog: "\(reply)")
    }
}

// MARK: Your week

/// "How's my week in Fatty?": workouts against the plan, sets, the weak
/// point furthest under its 10 sets, and what's next. From the snapshot the
/// app keeps (it's refreshed after every finished workout).
struct WeekSummaryIntent: AppIntent {
    static let title: LocalizedStringResource = "How's My Week"
    static let description = IntentDescription("Tells you this week's workouts and sets, your weakest muscle, and what's next.")

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = WidgetSnapshot.load() else {
            return .result(dialog: "Open Fatty once, and I'll be able to tell you about your week.")
        }
        let fresh = !snapshot.isFromPastWeek()
        let sessions = fresh ? snapshot.sessionsThisWeek : 0
        let sets = fresh ? snapshot.setsThisWeek : 0

        var parts: [String] = []
        let workouts = "\(sessions) \(sessions == 1 ? "workout" : "workouts")"
        if let planned = snapshot.sessionsPlanned {
            parts.append("This week: \(sessions) of \(planned) workouts, \(sets) \(sets == 1 ? "set" : "sets").")
        } else {
            parts.append("This week: \(workouts), \(sets) \(sets == 1 ? "set" : "sets").")
        }
        if fresh, sessions > 0,
           let weakest = snapshot.muscles?.filter({ $0.weak && $0.sets < 10 }).min(by: { $0.sets < $1.sets }) {
            let count = Int(weakest.sets.rounded())
            parts.append("\(weakest.label) is lowest at \(count) \(count == 1 ? "set" : "sets").")
        }
        if let next = snapshot.nextBout {
            parts.append("Next up: \(next).")
        }
        return .result(dialog: "\(parts.joined(separator: " "))")
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
            intent: LogNextSetIntent(),
            phrases: [
                "Same again in \(.applicationName)",
                "Log my next set in \(.applicationName)",
                "Log the same set in \(.applicationName)",
            ],
            shortTitle: "Log Next Set",
            systemImageName: "checkmark.circle"
        )
        AppShortcut(
            intent: LogSetIntent(),
            phrases: [
                "Log a set in \(.applicationName)",
                "Log weight and reps in \(.applicationName)",
            ],
            shortTitle: "Log a Set",
            systemImageName: "plus.circle"
        )
        AppShortcut(
            intent: UndoLastSetIntent(),
            phrases: [
                "Undo my last set in \(.applicationName)",
                "Take back my last set in \(.applicationName)",
            ],
            shortTitle: "Undo Last Set",
            systemImageName: "arrow.uturn.backward"
        )
        AppShortcut(
            intent: FinishWorkoutIntent(),
            phrases: [
                "Finish my workout in \(.applicationName)",
                "End my workout in \(.applicationName)",
            ],
            shortTitle: "Finish Workout",
            systemImageName: "flag.checkered"
        )
        AppShortcut(
            intent: WeekSummaryIntent(),
            phrases: [
                "How's my week in \(.applicationName)",
                "How is my week going in \(.applicationName)",
                "What's my next workout in \(.applicationName)",
            ],
            shortTitle: "My Week",
            systemImageName: "calendar"
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
