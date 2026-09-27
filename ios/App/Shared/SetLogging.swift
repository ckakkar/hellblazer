import AppIntents
import Foundation

/// Logging a set without touching the phone: "Same again" and "Log a set"
/// to Siri, the Shortcuts app, the Action button, and the Control Center and
/// Lock Screen button. As Live Activity intents they run in the app's
/// process (the widget extension, where the button lives, only names them),
/// and the app hands over the logger at launch (App/VoiceSetLogger.swift).
enum SetLogging {
    struct Request {
        /// In the lifter's unit. Nil with `reps`: the next set, same again.
        var weight: Double?
        var reps: Int?
        /// The exercise the Lock Screen showed; nil lets the server pick.
        var sessionExerciseId: String?
    }

    /// Returns what Siri says back.
    static var handler: ((Request) async -> String)?

    static func run(_ request: Request) async -> String {
        guard let handler else { return "Open Fatty once, then try again." }
        return await handler(request)
    }
}

/// "Same again": the next set of the workout in progress, with the numbers
/// the app would fill in (this session's last set on that exercise, else
/// last time's). Once an exercise's sets are done it moves to the next.
struct LogNextSetIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Log Next Set"
    static let description = IntentDescription(
        "Logs the next set of your workout in progress, with the same weight and reps as your last one."
    )

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let reply = await SetLogging.run(SetLogging.Request())
        return .result(dialog: "\(reply)")
    }
}

/// The Live Activity's Log Set: exactly the set it shows ("80 kg × 5"), on
/// the exercise it shows, without opening the app.
struct LogShownSetIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Log the Shown Set"
    static let isDiscoverable = false

    @Parameter(title: "Workout")
    var sessionId: String

    @Parameter(title: "Exercise")
    var sessionExerciseId: String

    @Parameter(title: "Weight")
    var weight: Double

    @Parameter(title: "Reps")
    var reps: Int

    init() {}

    init(sessionId: String, set: WorkoutActivityAttributes.NextSet) {
        self.sessionId = sessionId
        sessionExerciseId = set.sessionExerciseId
        weight = set.weight
        reps = set.reps
    }

    func perform() async throws -> some IntentResult {
        _ = await SetLogging.run(SetLogging.Request(weight: weight, reps: reps, sessionExerciseId: sessionExerciseId))
        return .result()
    }
}

/// "Log a set": Siri asks for the weight and reps.
struct LogSetIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Log a Set"
    static let description = IntentDescription(
        "Logs a set with the weight and reps you give, on the exercise you're doing, in the unit you use in Fatty."
    )

    @Parameter(title: "Weight", requestValueDialog: "What weight?")
    var weight: Double

    @Parameter(title: "Reps", requestValueDialog: "How many reps?")
    var reps: Int

    static var parameterSummary: some ParameterSummary {
        Summary("Log \(\.$weight) for \(\.$reps) reps")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard weight >= 0, weight < 10000, reps >= 1, reps < 1000 else {
            return .result(dialog: "That doesn't sound like a set. Try again with the weight and reps.")
        }
        let reply = await SetLogging.run(SetLogging.Request(weight: weight, reps: reps))
        return .result(dialog: "\(reply)")
    }
}
