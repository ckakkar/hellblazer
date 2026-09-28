import Foundation
import HealthKit

/// The rest the page would start after a set, for sets logged by voice
/// while it's asleep: its length and auto-start switch, as the logger last
/// said (setRestDefaults). An exercise's own rest, from its template, wins.
enum RestDefaults {
    private static let defaults = UserDefaults.standard
    private static let secondsKey = "rest.seconds"
    private static let autoKey = "rest.auto"

    static var seconds: Double {
        let saved = defaults.double(forKey: secondsKey)
        return (15...600).contains(saved) ? saved : 90
    }

    static var auto: Bool { defaults.object(forKey: autoKey) as? Bool ?? true }

    static func save(seconds: Double?, auto: Bool?) {
        if let seconds, (15...600).contains(seconds) { defaults.set(seconds, forKey: secondsKey) }
        if let auto { defaults.set(auto, forKey: autoKey) }
    }
}

/// Sets taken back outside the page ("Undo my last set"), until the page
/// takes them (takeRemovedSets). A set the page itself logged would
/// otherwise stay on its screen after the server lost it.
enum RemovedSets {
    /// Posted on the main queue when one's waiting.
    static let posted = Notification.Name("FattySetsRemoved")
    private static let key = "removed-sets"
    private static let defaults = UserDefaults.standard

    static func add(_ setId: String, sessionId: String) {
        var all = defaults.dictionary(forKey: key) as? [String: [String]] ?? [:]
        all[sessionId, default: []].append(setId)
        // Only the workout in progress matters.
        all = all.filter { $0.key == sessionId }
        defaults.set(all, forKey: key)
        DispatchQueue.main.async { NotificationCenter.default.post(name: posted, object: nil) }
    }

    static func take(sessionId: String) -> [String] {
        var all = defaults.dictionary(forKey: key) as? [String: [String]] ?? [:]
        let ids = all.removeValue(forKey: sessionId) ?? []
        defaults.set(all, forKey: key)
        return ids
    }
}

/// The workout without the page (Shared/SetLogging.swift, AppShortcuts.swift):
/// log a set ("Same again", "Log a set", the Lock Screen's Log Set), take the
/// last one back, and finish. The server does the work (/api/device/*, with
/// this phone's device token); this then does what the page would have: the
/// Live Activity, the rest and its alert, Apple Health, and a nudge to the
/// page and the watch to catch up. Each returns what Siri says.
enum VoiceSetLogger {
    typealias Activity = WorkoutActivityAttributes

    /// The workout for the Live Activity, as the page would send it.
    private struct ActivityState: Decodable {
        var sessionId: String
        var startedAt: Double
        var title: String
        var exercise: String?
        var detail: String?
        var sets: Int
        var volume: String
        var next: Activity.NextSet?
    }

    private struct LogReply: Decodable {
        /// "logged", "no-workout", "no-numbers" or "all-done".
        var status: String
        var exercise: String?
        var weight: Double?
        var reps: Int?
        var unit: String?
        var setNumber: Int?
        var targetSets: Int?
        /// This exercise's own rest (its template's), in seconds.
        var restSeconds: Double?
        /// That set finished the plan.
        var complete: Bool?
        var activity: ActivityState?
    }

    private struct UndoReply: Decodable {
        /// "undone", "nothing" or "no-workout".
        var status: String
        var setId: String?
        var sessionId: String?
        var exercise: String?
        var weight: Double?
        var reps: Int?
        var unit: String?
        var activity: ActivityState?
    }

    private struct FinishReply: Decodable {
        /// "finished" or "no-workout".
        var status: String
        var sessionId: String?
        var title: String?
        var startedAt: Double?
        var durationMin: Int?
        var sets: Int?
        var volume: String?
        var effort: Double?
    }

    private struct SpokenWorkout: Decodable {
        /// "ok" or "no-workout".
        var status: String
        var unit: String?
        var exercises: [String]?
    }

    private struct HeardReply: Decodable {
        /// "logged", "nothing" or "no-workout".
        var status: String
        var count: Int?
        /// "3 sets of 8 at 80 kg on Incline Dumbbell Press, the last at RPE 9".
        var said: String?
        /// Exercises said that aren't in the workout.
        var unmatched: [String]?
        var restSeconds: Double?
        /// The last set was a warm-up: no rest for that.
        var warmup: Bool?
        var complete: Bool?
        var activity: ActivityState?
    }

    private enum CallError: Error {
        case unlinked, refused, offline
        var spoken: String {
            switch self {
            case .unlinked: return "Open Fatty once so it can do that for you, then try again."
            case .refused: return "Fatty couldn't do that just now. Try again in a moment."
            case .offline: return "Couldn't reach Fatty. Check your connection and try again."
            }
        }
    }

    private static func post<Reply: Decodable>(_ path: String, _ body: [String: Any] = [:]) async -> Result<Reply, CallError> {
        guard var request = WidgetRefresher.deviceRequest(path) else { return .failure(.unlinked) }
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        return await send(request)
    }

    private static func get<Reply: Decodable>(_ path: String) async -> Result<Reply, CallError> {
        guard let request = WidgetRefresher.deviceRequest(path) else { return .failure(.unlinked) }
        return await send(request)
    }

    private static func send<Reply: Decodable>(_ request: URLRequest) async -> Result<Reply, CallError> {
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if status == 401 { return .failure(.unlinked) }
            guard status == 200, let reply = try? JSONDecoder().decode(Reply.self, from: data) else {
                return .failure(.refused)
            }
            return .success(reply)
        } catch {
            return .failure(.offline)
        }
    }

    // MARK: Log

    static func log(_ request: SetLogging.Request) async -> String {
        var body: [String: Any] = [:]
        if let weight = request.weight, let reps = request.reps {
            body["weight"] = weight
            body["reps"] = reps
        }
        if let id = request.sessionExerciseId { body["sessionExerciseId"] = id }

        let reply: LogReply
        let result: Result<LogReply, CallError> = await post("/api/device/set", body)
        switch result {
        case .failure(let failure): return failure.spoken
        case .success(let value): reply = value
        }

        switch reply.status {
        case "logged":
            break
        case "no-workout":
            return "You don't have a workout going. Start one in Fatty first."
        case "no-numbers":
            return "Fatty doesn't have numbers for \(reply.exercise ?? "that exercise") yet. "
                + "Say \u{201C}Log a set in Fatty\u{201D} and give the weight and reps."
        case "all-done":
            return "That's every set done. Say \u{201C}Finish my workout in Fatty\u{201D} to wrap up."
        default:
            return CallError.refused.spoken
        }

        guard let exercise = reply.exercise, let weight = reply.weight, let reps = reply.reps else {
            return "Logged."
        }
        let complete = reply.complete ?? false
        let rest: Double? = !complete && RestDefaults.auto ? (reply.restSeconds ?? RestDefaults.seconds) : nil
        if let activity = reply.activity {
            catchUp(activity, rest: rest, clearRest: complete)
        }

        var text = "Logged \(trim(weight)) \(reply.unit ?? "kg") for \(reps) on \(exercise)"
        if let n = reply.setNumber {
            if let target = reply.targetSets {
                text += n <= target ? ", set \(n) of \(target)" : ", an extra set"
            } else {
                text += ", set \(n)"
            }
        }
        text += "."
        if complete {
            text += " That's every set. Say \u{201C}Finish my workout in Fatty\u{201D} when you're done."
        } else if let rest {
            text += " Rest \(spoken(rest))."
        }
        return text
    }

    // MARK: In your own words

    /// "Log a set" where the phone's on-device model runs: what the lifter
    /// said, read here against the workout's exercises (SetReader), then
    /// matched, filled in and saved by the server (logHeardSets).
    static func logSpoken(_ words: String) async -> String {
        let workout: SpokenWorkout
        let fetched: Result<SpokenWorkout, CallError> = await get("/api/device/set")
        switch fetched {
        case .failure(let failure): return failure.spoken
        case .success(let value): workout = value
        }
        guard workout.status == "ok" else {
            return "You don't have a workout going. Start one in Fatty first."
        }

        let runs: [[String: Any]]
        do {
            runs = try await SetReader.read(
                String(words.prefix(500)),
                exercises: workout.exercises ?? [],
                unit: workout.unit ?? "kg"
            )
        } catch {
            return "Fatty couldn't make that out. Try something like \u{201C}3 sets of 8 at 80 on bench\u{201D}."
        }

        let reply: HeardReply
        let result: Result<HeardReply, CallError> = await post("/api/device/set", ["heard": runs])
        switch result {
        case .failure(let failure): return failure.spoken
        case .success(let value): reply = value
        }

        let missing = reply.unmatched ?? []
        switch reply.status {
        case "logged":
            break
        case "no-workout":
            return "You don't have a workout going. Start one in Fatty first."
        case "nothing":
            if !missing.isEmpty { return "\(notInWorkout(missing)), so nothing was logged." }
            return "Fatty couldn't tell the reps from that, so nothing was logged. "
                + "Try something like \u{201C}3 sets of 8 at 80\u{201D}."
        default:
            return CallError.refused.spoken
        }

        let complete = reply.complete ?? false
        let rest: Double? = !complete && !(reply.warmup ?? false) && RestDefaults.auto
            ? (reply.restSeconds ?? RestDefaults.seconds)
            : nil
        if let activity = reply.activity {
            catchUp(activity, rest: rest, clearRest: complete)
        }

        var text = "Logged \(reply.said ?? "\(reply.count ?? 0) sets")."
        if !missing.isEmpty { text += " \(notInWorkout(missing)), so I left that out." }
        if complete {
            text += " That's every set. Say \u{201C}Finish my workout in Fatty\u{201D} when you're done."
        } else if let rest {
            text += " Rest \(spoken(rest))."
        }
        return text
    }

    /// "“Leg press” isn't in this workout", "“Leg press” and “lunges” aren't…".
    private static func notInWorkout(_ words: [String]) -> String {
        let quoted = words.map { "\u{201C}\($0)\u{201D}" }
        let list = quoted.count > 1
            ? quoted.dropLast().joined(separator: ", ") + " and " + (quoted.last ?? "")
            : (quoted.first ?? "")
        return list + (quoted.count > 1 ? " aren't" : " isn't") + " in this workout"
    }

    // MARK: Undo

    static func undo() async -> String {
        let reply: UndoReply
        let result: Result<UndoReply, CallError> = await post("/api/device/undo")
        switch result {
        case .failure(let failure): return failure.spoken
        case .success(let value): reply = value
        }
        switch reply.status {
        case "undone":
            break
        case "nothing":
            return "There's no set to take back yet."
        default:
            return "You don't have a workout going."
        }
        if let setId = reply.setId, let sessionId = reply.sessionId {
            RemovedSets.add(setId, sessionId: sessionId)
        }
        if let activity = reply.activity {
            catchUp(activity, rest: nil, clearRest: true)
        }
        guard let exercise = reply.exercise, let weight = reply.weight, let reps = reply.reps else {
            return "Took back your last set."
        }
        return "Took back \(trim(weight)) \(reply.unit ?? "kg") for \(reps) on \(exercise)."
    }

    // MARK: Finish

    static func finish() async -> String {
        let reply: FinishReply
        let result: Result<FinishReply, CallError> = await post("/api/device/finish")
        switch result {
        case .failure(let failure): return failure.spoken
        case .success(let value): reply = value
        }
        guard reply.status == "finished", let sessionId = reply.sessionId else {
            return "You don't have a workout going."
        }

        WorkoutActivity.end()
        RestAlert.cancel()
        RestControl.post(.init(sessionId: sessionId, endsAt: nil, total: 0, alert: false))
        saveToHealth(reply, sessionId: sessionId)
        WatchBridge.shared.phoneChanged()
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: WatchBridge.changed, object: nil)
        }

        let sets = reply.sets ?? 0
        var text = "Finished \(reply.title ?? "your workout"): \(sets) \(sets == 1 ? "set" : "sets")"
        if let volume = reply.volume { text += ", \(volume)" }
        if let minutes = reply.durationMin { text += " in \(minutes) \(minutes == 1 ? "minute" : "minutes")" }
        return text + ". Good work."
    }

    /// As the page's finish does: into Health when the lifter's switch is
    /// on, unless the watch recorded it (then only its effort).
    private static func saveToHealth(_ reply: FinishReply, sessionId: String) {
        guard HealthSync.on, HKHealthStore.isHealthDataAvailable() else { return }
        let store = HKHealthStore()
        let effort = reply.effort.flatMap { (1...10).contains($0) ? $0 : nil }
        if WatchBridge.shared.recordedOnWatch(sessionId) {
            if let effort { WorkoutEffort.rateWatchWorkout(sessionId: sessionId, score: effort, store: store) }
            return
        }
        guard store.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized,
              let startedAt = reply.startedAt
        else { return }
        let start = Date(timeIntervalSince1970: startedAt / 1000)
        let end = reply.durationMin.map { start.addingTimeInterval(Double($0) * 60) } ?? Date()
        HealthWorkouts.save(
            start: start,
            end: max(end, start.addingTimeInterval(60)),
            sessionId: sessionId,
            effort: effort,
            store: store
        ) { _ in }
    }

    // MARK: Catching the rest up

    /// What the page would have done: the Live Activity, the rest and its
    /// alert, and a nudge to the page and the watch.
    private static func catchUp(_ a: ActivityState, rest: Double?, clearRest: Bool) {
        let endsAt = rest.map { Date().addingTimeInterval($0) }
        let state = Activity.ContentState(
            title: a.title,
            exercise: a.exercise,
            detail: a.detail,
            sets: a.sets,
            volume: a.volume,
            restEndsAt: endsAt,
            restTotal: rest,
            next: a.next
        )
        WorkoutActivity.upsert(sessionId: a.sessionId, startedAt: Date(timeIntervalSince1970: a.startedAt / 1000), state: state)
        if let endsAt, let rest {
            RestAlert.schedule(sessionId: a.sessionId, endsAt: endsAt, label: a.exercise)
            RestControl.post(.init(sessionId: a.sessionId, endsAt: endsAt.timeIntervalSince1970 * 1000, total: rest, alert: true))
        } else if clearRest {
            RestAlert.cancel()
            RestControl.post(.init(sessionId: a.sessionId, endsAt: nil, total: 0, alert: false))
        }
        WatchBridge.shared.phoneChanged()
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: WatchBridge.changed, object: nil)
        }
    }

    private static func trim(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
    }

    /// "90 seconds", "2 minutes", "2 minutes 30".
    private static func spoken(_ seconds: Double) -> String {
        let total = Int(seconds.rounded())
        if total < 120 && total % 60 != 0 { return "\(total) seconds" }
        let minutes = total / 60, rest = total % 60
        let head = "\(minutes) \(minutes == 1 ? "minute" : "minutes")"
        return rest == 0 ? head : "\(head) \(rest)"
    }
}
