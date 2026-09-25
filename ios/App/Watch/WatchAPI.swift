import Foundation

// The server's view of the lifter, from /api/watch (src/lib/watch/protocol.ts:
// change both together). Weights are in the lifter's display unit; the
// server converts to and from kg, so the watch never does unit math.

struct WatchState: Codable, Equatable {
    var unit: String
    var active: Workout?
    var next: StartOption?
    var options: [StartOption]
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
    var sets: [LoggedSet]
    /// The last session's working sets on this movement.
    var last: [PastSet]

    var workingSets: [LoggedSet] { sets.filter { !$0.warmup } }
}

struct LoggedSet: Codable, Equatable, Identifiable {
    var id: String
    var n: Int
    var weight: Double
    var reps: Int
    var warmup: Bool
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

    var id: String { templateId }
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

    func start(_ option: StartOption, localDate: String) async throws -> WatchState {
        try await send("start", body: StartBody(templateId: option.templateId, programDayId: option.programDayId, localDate: localDate))
    }

    func save(_ write: SetWrite) async throws {
        let body = SetBody(id: write.id, sessionExerciseId: write.sessionExerciseId, setNumber: write.setNumber, weight: write.weight, reps: write.reps)
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
    }
    private struct SetBody: Encodable {
        var id: String
        var sessionExerciseId: String
        var setNumber: Int
        var weight: Double
        var reps: Int
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
