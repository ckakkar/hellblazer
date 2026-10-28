import Foundation

// The server's view of the lifter, from /api/watch (src/lib/watch/protocol.ts:
// change both together). Weights are in the lifter's display unit; the
// server converts to and from kg, so the watch never does unit math.

struct WatchState: Codable, Equatable {
    var unit: String
    var active: Workout?
    var next: StartOption?
    var options: [StartOption]
    /// This week so far, for the complications. Optional: older servers.
    var week: Week?
    /// With no workout on: the sessions finished in the last day, so a
    /// workout that left the watch's view can be told finished (Health keeps
    /// it) from discarded (it doesn't). Nil from an older server.
    var finished: [String]?
    /// From a start: the session it made, however old (an offline workout
    /// that reached the server hours later). Nil from an older server.
    var started: Workout?

    struct Week: Codable, Equatable {
        /// Monday, yyyy-MM-dd.
        var start: String
        var sessions: Int
        var planned: Int?
        var sets: Int
    }
}

struct Workout: Codable, Equatable, Identifiable {
    var id: String
    var title: String
    /// Epoch ms.
    var startedAt: Double
    var exercises: [Exercise]

    var startDate: Date { Date(timeIntervalSince1970: startedAt / 1000) }
}

struct Exercise: Codable, Equatable, Identifiable {
    /// The session_exercise id: sets are logged against it.
    var id: String
    var name: String
    var targetSets: Int?
    var targetReps: String?
    /// Seconds to rest after its sets (its template's); nil: the usual rest.
    var restSeconds: Double?
    var sets: [LoggedSet]
    /// The last session's working sets on this movement.
    var last: [PastSet]
    /// Today's target from them (src/lib/progression.ts): the first set's numbers.
    var target: Target?
    /// Its superset group (src/lib/supersets.ts): consecutive exercises
    /// sharing one are done back to back, resting after the round.
    var superset: Int?
    /// Ended by hand ("Done with this one") on any device: done, whatever its
    /// target says. Nil from a server before it.
    var ended: Bool?

    /// The sets that count toward the plan: plain working sets, as
    /// src/lib/set-kinds.ts has them (no warm-ups, drops or rest-pause).
    var workingSets: [LoggedSet] {
        sets.filter { !$0.warmup && $0.reps >= 1 && $0.kind != "drop" && $0.kind != "rest_pause" }
    }

    /// Every working set, drops and rest-pause in full: the workout's sets
    /// and volume.
    var workSets: [LoggedSet] { sets.filter { !$0.warmup && $0.reps >= 1 } }
}

struct Target: Codable, Equatable {
    var weight: Double
    var reps: Int
}

struct LoggedSet: Codable, Equatable, Identifiable {
    var id: String
    var n: Int
    var weight: Double
    var reps: Int
    var warmup: Bool
    /// "drop" or "rest_pause", logged in the app; nil for a plain set.
    var kind: String?
}

struct PastSet: Codable, Equatable {
    var weight: Double
    var reps: Int
}

struct StartOption: Codable, Equatable, Identifiable {
    var templateId: String
    var programDayId: String?
    var label: String
    var exercises: Int
    /// The day's exercises, so it can start with no connection (sent while
    /// no workout's on, and kept with the rest of the state).
    var plan: [PlanExercise]?

    var id: String { templateId }
}

struct PlanExercise: Codable, Equatable {
    var name: String
    var targetSets: Int?
    var targetReps: String?
    var restSeconds: Double?
    var last: [PastSet]
    var target: Target?
    var superset: Int?
}

/// A set waiting to reach the server. Kept on the watch until it does, so a
/// dead connection in the gym loses nothing.
struct SetWrite: Codable, Equatable {
    var id: String
    var sessionId: String
    var sessionExerciseId: String
    var setNumber: Int
    var weight: Double
    var reps: Int
    /// The unit `weight` was logged in: the lifter can switch units before a
    /// queued set reaches the server. Nil in a queue from an older build.
    var unit: String? = nil
    /// When it was logged (epoch ms), so a set that waited for a connection
    /// keeps its time (the heart-rate read places sets by it).
    var loggedAt: Double? = nil
}

enum APIError: Error {
    /// The token was revoked or never valid: ask the phone for a new one.
    case unlinked
    /// The server said no (4xx) or broke (5xx).
    case server(Int)
    /// No connection.
    case offline
}

struct WatchAPI {
    static let base = URL(string: "https://hellblazer.vercel.app/api/watch/")!

    let token: String
    let unit: String
    let timeZone: String

    func state() async throws -> WatchState {
        try await send("state", method: "GET", body: Optional<Empty>.none)
    }

    /// `startedAt` (epoch ms) for a workout started offline: the server
    /// dates it from then, not from when the connection came back.
    func start(_ option: StartOption, localDate: String, startedAt: Double? = nil) async throws -> WatchState {
        try await send("start", body: StartBody(templateId: option.templateId, programDayId: option.programDayId, localDate: localDate, startedAt: startedAt))
    }

    func save(_ write: SetWrite) async throws {
        let body = SetBody(
            id: write.id, sessionExerciseId: write.sessionExerciseId, setNumber: write.setNumber,
            weight: write.weight, reps: write.reps, unit: write.unit ?? unit, loggedAt: write.loggedAt
        )
        let _: Ok = try await send("set", body: body)
    }

    func delete(setId: String) async throws {
        let _: Ok = try await send("delete-set", body: DeleteBody(id: setId))
    }

    func finish(sessionId: String, durationMin: Int?) async throws -> WatchState {
        try await send("finish", body: FinishBody(sessionId: sessionId, durationMin: durationMin))
    }

    private struct Empty: Encodable {}
    private struct Ok: Decodable {}
    private struct StartBody: Encodable {
        var templateId: String
        var programDayId: String?
        var localDate: String
        var startedAt: Double?
    }
    private struct SetBody: Encodable {
        var id: String
        var sessionExerciseId: String
        var setNumber: Int
        var weight: Double
        var reps: Int
        var unit: String
        var loggedAt: Double?
    }
    private struct DeleteBody: Encodable { var id: String }
    private struct FinishBody: Encodable {
        var sessionId: String
        var durationMin: Int?
    }

    private func send<Body: Encodable, Response: Decodable>(
        _ path: String,
        method: String = "POST",
        body: Body?
    ) async throws -> Response {
        var request = URLRequest(url: Self.base.appendingPathComponent(path))
        request.httpMethod = method
        request.timeoutInterval = 15
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(unit, forHTTPHeaderField: "X-Fatty-Unit")
        request.setValue(timeZone, forHTTPHeaderField: "X-Fatty-TZ")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError.offline
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 { throw APIError.unlinked }
        guard (200..<300).contains(status) else { throw APIError.server(status) }
        return try JSONDecoder().decode(Response.self, from: data)
    }
}
