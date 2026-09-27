import Foundation

/// The rest the page would start after a set, for sets logged by voice
/// while it's asleep: its length and auto-start switch, as the logger last
/// said (setRestDefaults).
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

/// Sets logged without the page (Shared/SetLogging.swift). The server picks
/// the exercise and, for "same again", the numbers (/api/device/set, with
/// this phone's device token). Then this does what the page would have: the
/// Live Activity, the rest and its alert, and a nudge to the page and the
/// watch to pick the set up.
enum VoiceSetLogger {
    private struct Reply: Decodable {
        /// "logged", "no-workout", "no-numbers" or "all-done".
        var status: String
        var exercise: String?
        var weight: Double?
        var reps: Int?
        var unit: String?
        var setNumber: Int?
        var targetSets: Int?
        /// That set finished the plan.
        var complete: Bool?
        var activity: Activity?

        /// The workout for the Live Activity, as the page would send it.
        struct Activity: Decodable {
            var sessionId: String
            var startedAt: Double
            var title: String
            var exercise: String?
            var detail: String?
            var sets: Int
            var volume: String
        }
    }

    static func log(_ request: SetLogging.Request) async -> String {
        guard var urlRequest = WidgetRefresher.deviceRequest("/api/device/set") else {
            return "Open Fatty and sign in first, then try again."
        }
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var body: [String: Any] = [:]
        if let weight = request.weight, let reps = request.reps {
            body["weight"] = weight
            body["reps"] = reps
        }
        urlRequest.httpBody = try? JSONSerialization.data(withJSONObject: body)

        let reply: Reply
        do {
            let (data, response) = try await URLSession.shared.data(for: urlRequest)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if status == 401 {
                return "Open Fatty once so it can log sets for you, then try again."
            }
            guard status == 200, let decoded = try? JSONDecoder().decode(Reply.self, from: data) else {
                return "Fatty couldn't log that set. Try again in a moment."
            }
            reply = decoded
        } catch {
            return "Couldn't reach Fatty. Check your connection and try again."
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
            return "That's every set done. Finish your workout in Fatty."
        default:
            return "Fatty couldn't log that set. Try again in a moment."
        }

        guard let exercise = reply.exercise, let weight = reply.weight, let reps = reply.reps else {
            return "Logged."
        }
        let complete = reply.complete ?? false
        let rest: Double? = !complete && RestDefaults.auto ? RestDefaults.seconds : nil
        if let activity = reply.activity {
            catchUp(activity, rest: rest, complete: complete)
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
            text += " That's every set. Finish up in Fatty."
        } else if let rest {
            text += " Rest \(spoken(rest))."
        }
        return text
    }

    /// Everything the page would have done for a set logged there.
    private static func catchUp(_ a: Reply.Activity, rest: Double?, complete: Bool) {
        let endsAt = rest.map { Date().addingTimeInterval($0) }
        let state = WorkoutActivityAttributes.ContentState(
            title: a.title,
            exercise: a.exercise,
            detail: a.detail,
            sets: a.sets,
            volume: a.volume,
            restEndsAt: endsAt,
            restTotal: rest
        )
        WorkoutActivity.upsert(sessionId: a.sessionId, startedAt: Date(timeIntervalSince1970: a.startedAt / 1000), state: state)
        if let endsAt, let rest {
            RestAlert.schedule(sessionId: a.sessionId, endsAt: endsAt, label: a.exercise)
            RestControl.post(.init(sessionId: a.sessionId, endsAt: endsAt.timeIntervalSince1970 * 1000, total: rest, alert: true))
        } else if complete {
            // The last set: no rest, as on the watch.
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
