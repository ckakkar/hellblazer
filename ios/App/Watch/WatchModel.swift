import SwiftUI
import UserNotifications
import WatchKit

/// Everything the watch app knows and does. The server is the source of
/// truth (/api/watch); sets logged here show at once and wait on the watch
/// until the server has them. The rest timer runs here, with a haptic when
/// it's over, and the phone hears about each change for its Lock Screen.
@MainActor
final class WatchModel: ObservableObject {
    static let shared = WatchModel()

    struct Settings: Codable, Equatable {
        var userId: String?
        var unit = "kg"
        var accent = "#df2d28"
        var restSeconds: Double = 90
        var timeZone = TimeZone.current.identifier
    }

    struct Rest: Equatable {
        var endsAt: Date
        var total: Double
    }

    @Published private(set) var token: String?
    @Published private(set) var settings: Settings
    @Published private(set) var state: WatchState?
    @Published private(set) var rest: Rest?
    @Published private(set) var busy = false
    @Published var problem: String?
    /// Whether `problem` is the connection (true) or the server (false).
    @Published private(set) var problemIsOffline = true
    /// The exercise on screen; nil follows the workout's order.
    @Published var selectedExerciseId: String?

    let recorder = WorkoutRecorder.shared

    private var pending: [SetWrite]
    private var flushing = false
    private var restTask: Task<Void, Never>?
    private var pollTask: Task<Void, Never>?
    private let defaults = UserDefaults.standard

    private init() {
        let stored = UserDefaults.standard
        settings = stored.data(forKey: "settings").flatMap { try? JSONDecoder().decode(Settings.self, from: $0) } ?? Settings()
        pending = stored.data(forKey: "pending").flatMap { try? JSONDecoder().decode([SetWrite].self, from: $0) } ?? []
        token = Keychain.token
    }

    var accent: Color { Color(hex: settings.accent) ?? Brand.flame }
    var unit: String { settings.unit }
    var weightStep: Double { settings.unit == "lb" ? 5 : 2.5 }

    // MARK: Launch and the phone

    func boot() {
        PhoneLink.shared.onContext = { [weak self] context in self?.apply(context: context) }
        PhoneLink.shared.onPhoneChanged = { [weak self] in
            Task { await self?.refresh() }
        }
        PhoneLink.shared.activate()
    }

    /// The token and settings from the phone. An empty token: signed out.
    private func apply(context: [String: Any]) {
        guard let raw = context["token"] as? String else { return }
        if raw.isEmpty {
            forget()
            return
        }
        if let s = context["settings"] as? [String: Any] {
            var next = Settings()
            next.userId = s["userId"] as? String
            next.unit = (s["unit"] as? String) == "lb" ? "lb" : "kg"
            next.accent = s["accent"] as? String ?? next.accent
            next.restSeconds = (s["restSeconds"] as? NSNumber)?.doubleValue ?? next.restSeconds
            next.timeZone = s["timeZone"] as? String ?? next.timeZone
            if next != settings {
                settings = next
                defaults.set(try? JSONEncoder().encode(next), forKey: "settings")
            }
        }
        if raw != token {
            Keychain.token = raw
            token = raw
            state = nil
        }
        Task { await refresh() }
    }

    /// Signed out on the phone, or the token was revoked.
    private func forget() {
        Keychain.token = nil
        token = nil
        state = nil
        pending = []
        savePending()
        clearRest()
        Task { await recorder.finish() }
    }

    private var api: WatchAPI? {
        token.map { WatchAPI(token: $0, unit: settings.unit, timeZone: settings.timeZone) }
    }

    // MARK: Staying current

    /// Polls while on screen, and slowly while recording in the background,
    /// so a workout finished on the phone ends here too.
    func scenePhaseChanged(_ phase: ScenePhase) {
        pollTask?.cancel()
        let interval: Double
        switch phase {
        case .active: interval = 15
        default:
            guard recorder.isRecording else { return }
            interval = 60
        }
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh()
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
            }
        }
    }

    func refresh() async {
        guard let api else {
            PhoneLink.shared.requestContext()
            return
        }
        await flush()
        do {
            let fresh = try await api.state()
            apply(state: fresh)
            problem = nil
        } catch APIError.unlinked {
            forget()
            PhoneLink.shared.requestContext()
        } catch APIError.offline {
            if state == nil {
                problemIsOffline = true
                problem = "Can't reach Fatty. Keep your iPhone nearby, or join Wi-Fi."
            }
        } catch {
            // Reached the server, which failed: not the watch's connection.
            if state == nil {
                problemIsOffline = false
                problem = "Fatty's server had a problem. Try again in a minute."
            }
        }
    }

    private func apply(state fresh: WatchState) {
        var next = fresh
        // Sets still on their way to the server stay on screen.
        if var active = next.active {
            for write in pending where write.sessionId == active.id {
                guard let i = active.exercises.firstIndex(where: { $0.id == write.sessionExerciseId }),
                      !active.exercises[i].sets.contains(where: { $0.id == write.id })
                else { continue }
                active.exercises[i].sets.append(
                    LoggedSet(id: write.id, n: write.setNumber, weight: write.weight, reps: write.reps, warmup: false)
                )
            }
            next.active = active
        }
        state = next

        if let active = next.active {
            if let selected = selectedExerciseId, !active.exercises.contains(where: { $0.id == selected }) {
                selectedExerciseId = nil
            }
            // A workout on the wrist is recorded to Health.
            if recorder.sessionId != active.id {
                Task {
                    await recorder.finish()
                    await recorder.start(for: active)
                }
            }
        } else {
            // Finished or discarded elsewhere.
            selectedExerciseId = nil
            clearRest()
            if recorder.isRecording { Task { await recorder.finish() } }
        }
    }

    /// The exercise to log next: the one picked, else the latest one worked
    /// until its target's met, then the next.
    func currentExercise() -> Exercise? {
        guard let exercises = state?.active?.exercises, !exercises.isEmpty else { return nil }
        if let id = selectedExerciseId, let chosen = exercises.first(where: { $0.id == id }) {
            return chosen
        }
        guard let i = exercises.lastIndex(where: { !$0.workingSets.isEmpty }) else { return exercises.first }
        let latest = exercises[i]
        guard let target = latest.targetSets, latest.workingSets.count >= target, i + 1 < exercises.count else {
            return latest
        }
        return exercises[i + 1]
    }

    /// The exercise after the one on screen, if there is one.
    func exercise(after id: String) -> Exercise? {
        guard let exercises = state?.active?.exercises,
              let i = exercises.firstIndex(where: { $0.id == id }),
              i + 1 < exercises.count
        else { return nil }
        return exercises[i + 1]
    }

    // MARK: Starting and finishing

    func start(_ option: StartOption) async {
        guard let api, !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let fresh = try await api.start(option, localDate: localDate())
            selectedExerciseId = nil
            apply(state: fresh)
            WKInterfaceDevice.current().play(.start)
        } catch APIError.unlinked {
            forget()
        } catch {
            problem = "Couldn't start the workout. Check your connection."
        }
    }

    /// The phone opened this app to record a workout it just started.
    func phoneStartedWorkout() async {
        await refresh()
    }

    func finish() async {
        guard let api, let active = state?.active, !busy else { return }
        busy = true
        defer { busy = false }
        await flush()
        let minutes = Int((Date().timeIntervalSince(active.startDate) / 60).rounded())
        do {
            let fresh = try await api.finish(sessionId: active.id, durationMin: minutes <= 360 ? max(1, minutes) : nil)
            clearRest()
            await recorder.finish()
            PhoneLink.shared.sendGuaranteed(["finished": active.id])
            apply(state: fresh)
            WKInterfaceDevice.current().play(.success)
        } catch APIError.unlinked {
            forget()
        } catch {
            problem = "Couldn't finish. Your sets are safe; try again in a moment."
        }
    }

    // MARK: Sets

    func log(exerciseId: String, weight: Double, reps: Int) {
        guard var active = state?.active,
              let i = active.exercises.firstIndex(where: { $0.id == exerciseId })
        else { return }
        let write = SetWrite(
            id: UUID().uuidString.lowercased(),
            sessionId: active.id,
            sessionExerciseId: exerciseId,
            setNumber: (active.exercises[i].sets.map(\.n).max() ?? 0) + 1,
            weight: weight,
            reps: reps
        )
        active.exercises[i].sets.append(
            LoggedSet(id: write.id, n: write.setNumber, weight: weight, reps: reps, warmup: false)
        )
        state?.active = active
        pending.append(write)
        savePending()

        // Done with this one: the next exercise comes up after the rest.
        let exercise = active.exercises[i]
        if let target = exercise.targetSets, exercise.workingSets.count >= target, i + 1 < active.exercises.count {
            selectedExerciseId = active.exercises[i + 1].id
        } else {
            selectedExerciseId = exerciseId
        }

        WKInterfaceDevice.current().play(.success)
        startRest()
        Task { await flush() }
    }

    /// Takes back the last set logged on the exercise on screen.
    func undoLast() async {
        guard var active = state?.active,
              let exercise = currentExercise(),
              let i = active.exercises.firstIndex(where: { $0.id == exercise.id }),
              let last = active.exercises[i].sets.max(by: { $0.n < $1.n })
        else { return }
        active.exercises[i].sets.removeAll { $0.id == last.id }
        state?.active = active
        clearRest()
        if pending.contains(where: { $0.id == last.id }) {
            pending.removeAll { $0.id == last.id }
            savePending()
        } else if let api {
            do {
                try await api.delete(setId: last.id)
            } catch {
                problem = "Couldn't undo that set. Try again."
                await refresh()
                return
            }
        }
        WKInterfaceDevice.current().play(.click)
        tellPhone()
    }

    /// Sends waiting sets, oldest first. Offline, they wait for next time.
    private func flush() async {
        guard !flushing, let api else { return }
        flushing = true
        defer { flushing = false }
        while let write = pending.first {
            do {
                try await api.save(write)
            } catch APIError.unlinked {
                return
            } catch APIError.server(let status) where (400..<500).contains(status) {
                // Refused for good (the workout was deleted, say): drop it.
            } catch {
                return
            }
            pending.removeFirst()
            savePending()
        }
        tellPhone()
    }

    private func savePending() {
        defaults.set(try? JSONEncoder().encode(pending), forKey: "pending")
    }

    // MARK: Rest

    func startRest(seconds: Double? = nil) {
        let total = seconds ?? settings.restSeconds
        rest = Rest(endsAt: Date().addingTimeInterval(total), total: total)
        scheduleRestEnd()
        tellPhone()
    }

    func extendRest(by seconds: Double) {
        guard let rest else {
            startRest(seconds: seconds)
            return
        }
        let end = max(rest.endsAt, Date()).addingTimeInterval(seconds)
        self.rest = Rest(endsAt: end, total: max(rest.total, end.timeIntervalSinceNow))
        scheduleRestEnd()
        tellPhone()
        WKInterfaceDevice.current().play(.click)
    }

    func skipRest() {
        clearRest()
        tellPhone()
    }

    private func clearRest() {
        rest = nil
        restTask?.cancel()
        restTask = nil
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["rest"])
    }

    /// A haptic when the rest is over, while Fatty's on screen; an alert
    /// when it isn't (wrist down), which the system taps out instead.
    private func scheduleRestEnd() {
        guard let rest else { return }
        restTask?.cancel()
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["rest"])
        let name = currentExercise()?.name ?? "Next set"
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            guard granted else { return }
            let content = UNMutableNotificationContent()
            content.title = "Rest's up"
            content.body = "\(name). Time to lift."
            content.sound = .default
            let wait = max(1, rest.endsAt.timeIntervalSinceNow + 0.5)
            UNUserNotificationCenter.current().add(UNNotificationRequest(
                identifier: "rest",
                content: content,
                trigger: UNTimeIntervalNotificationTrigger(timeInterval: wait, repeats: false)
            ))
        }
        restTask = Task { [weak self] in
            let wait = rest.endsAt.timeIntervalSinceNow
            if wait > 0 { try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000)) }
            guard !Task.isCancelled, let self, self.rest == rest else { return }
            if WKApplication.shared().applicationState == .active {
                UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["rest"])
                WKInterfaceDevice.current().play(.notification)
            }
            self.rest = nil
        }
    }

    // MARK: The phone's Lock Screen

    /// The workout as it stands, for the phone's Live Activity and page.
    private func tellPhone() {
        guard let active = state?.active else { return }
        let working = active.exercises.flatMap(\.workingSets)
        let volume = working.reduce(0) { $0 + $1.weight * Double($1.reps) }
        var activity: [String: Any] = [
            "sessionId": active.id,
            "startedAt": active.startedAt,
            "title": active.title,
            "sets": working.count,
            "volume": "\(Int(volume.rounded()).formatted()) \(settings.unit)",
        ]
        if let exercise = currentExercise() {
            activity["exercise"] = exercise.name
            let done = exercise.workingSets.count
            activity["detail"] = done > 0 ? "\(done) \(done == 1 ? "set" : "sets") done" : "Up next"
        }
        if let rest {
            activity["restEndsAt"] = rest.endsAt.timeIntervalSince1970 * 1000
            activity["restTotal"] = rest.total
        }
        PhoneLink.shared.sendIfReachable(["activity": activity])
    }

    /// Today in the lifter's calendar, for the session's date.
    private func localDate() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: settings.timeZone) ?? .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}

extension Color {
    /// "#df2d28" → a color; nil if it isn't one.
    init?(hex: String) {
        let digits = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return nil }
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}
