import Combine
import SwiftUI
import UserNotifications
import WatchKit
import WidgetKit

/// Everything the watch app knows and does. The server is the source of
/// truth (/api/watch); sets logged here show at once and wait on the watch
/// until the server has them. With no connection at all, a workout can still
/// start from the plans the server last sent, and finish: the server hears
/// about it all once the watch is back online. The rest timer runs here,
/// with a haptic when it's over (and one when the heart rate's back down),
/// and the phone hears about each change for its Lock Screen.
@MainActor
final class WatchModel: ObservableObject {
    static let shared = WatchModel()

    struct Settings: Codable, Equatable {
        var userId: String?
        var unit = "kg"
        var accent = "#df2d28"
        var restSeconds: Double = 90
        var timeZone = TimeZone.current.identifier
        /// Tap when the heart rate's back down in a rest; nil (older
        /// settings) means on.
        var hrRest: Bool?
    }

    struct Rest: Equatable {
        var endsAt: Date
        var total: Double
        /// The heart rate that counts as recovered: halfway from the set's
        /// peak back to resting. Nil when there's nothing to recover from.
        var heartRateTarget: Double?
        var startedAt = Date()
        /// When the heart rate got there (the wrist was tapped).
        var recoveredAt: Date?
    }

    /// A workout started with no connection, until the server has it. Its
    /// ids are made up here; the sets logged against them are re-pointed at
    /// the server's once it's started there.
    private struct OfflineWorkout: Codable {
        var option: StartOption
        var localDate: String
        var workout: Workout
        /// Finished before it ever reached the server.
        var finished = false
        var finishedMinutes: Int?
    }

    /// A finish that couldn't reach the server, to send once it can.
    private struct PendingFinish: Codable {
        var sessionId: String
        var durationMin: Int?
    }

    /// The end-of-workout summary, as the Workout app shows one.
    struct Summary {
        var title: String
        var duration: TimeInterval
        var sets: Int
        var volume: Double
        var exercises: Int
        var calories: Double?
        var averageHeartRate: Double?
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
    /// A workout starting from the watch: the 3-2-1 countdown is on screen.
    @Published private(set) var starting: StartOption?
    /// The last workout's summary, until Done.
    @Published var summary: Summary?
    /// Every set of the plan is done, and they chose One More Set rather
    /// than End: log on instead of being offered the finish again.
    @Published var keepGoing = false

    private var countdownDone = false
    /// What the complications last redrew for (see updateComplications).
    private var complicationKey: String?
    private var lastComplicationData: ComplicationData?
    private var startDone = false
    private var concludedId: String?

    let recorder = WorkoutRecorder.shared

    private var pending: [SetWrite]
    private var offline: OfflineWorkout?
    private var pendingFinish: PendingFinish?
    private var flushing = false
    private var restTask: Task<Void, Never>?
    private var pollTask: Task<Void, Never>?
    private var heartRateWatch: AnyCancellable?
    private let defaults = UserDefaults.standard

    private init() {
        let stored = UserDefaults.standard
        func load<T: Decodable>(_ key: String, as type: T.Type) -> T? {
            stored.data(forKey: key).flatMap { try? JSONDecoder().decode(T.self, from: $0) }
        }
        settings = load("settings", as: Settings.self) ?? Settings()
        pending = load("pending", as: [SetWrite].self) ?? []
        offline = load("offline", as: OfflineWorkout.self)
        pendingFinish = load("pendingFinish", as: PendingFinish.self)
        token = Keychain.token
        // The last state the server sent, so the workouts to start are there
        // with no connection. Not its workout: that may have ended since,
        // unless it's one started here offline.
        if var cached = load("state", as: WatchState.self) {
            cached.active = offline?.finished == false ? offline?.workout : nil
            state = cached
        }
    }

    private func save<T: Encodable>(_ value: T?, as key: String) {
        if let value, let data = try? JSONEncoder().encode(value) {
            defaults.set(data, forKey: key)
        } else {
            defaults.removeObject(forKey: key)
        }
    }

    var accent: Color { Color(hex: settings.accent) ?? Brand.flame }
    var unit: String { settings.unit }
    var weightStep: Double { settings.unit == "lb" ? 5 : 2.5 }

    // MARK: Launch and the phone

    func boot() {
        heartRateWatch = recorder.$heartRate.sink { [weak self] bpm in
            Task { @MainActor in self?.heartRateChanged(bpm) }
        }
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
            next.hrRest = s["hrRest"] as? Bool
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

    /// The watch face complications' data (ComplicationData), redrawn only
    /// when something they show at a glance changes: Apple rations widget
    /// reloads, and a set logged mid-workout isn't worth one (the workout's
    /// clock runs by itself).
    private func updateComplications() {
        guard let state else { return }
        let data = ComplicationData(
            nextLabel: state.next?.label,
            weekStart: state.week?.start ?? "",
            sessions: state.week?.sessions ?? 0,
            planned: state.week?.planned,
            sets: state.week?.sets ?? 0,
            activeTitle: state.active?.title,
            activeStartedAt: state.active?.startedAt
        )
        if data != lastComplicationData {
            data.save()
            lastComplicationData = data
        }
        let key = [
            data.nextLabel ?? "", data.weekStart, String(data.sessions), String(data.planned ?? -1),
            data.activeTitle ?? "", data.activeTitle == nil ? String(data.sets) : "",
        ].joined(separator: "|")
        guard key != complicationKey else { return }
        complicationKey = key
        WidgetCenter.shared.reloadAllTimelines()
    }

    /// Signed out on the phone, or the token was revoked.
    private func forget() {
        ComplicationData.clear()
        complicationKey = nil
        lastComplicationData = nil
        WidgetCenter.shared.reloadAllTimelines()
        Keychain.token = nil
        token = nil
        state = nil
        pending = []
        savePending()
        offline = nil
        save(offline, as: "offline")
        pendingFinish = nil
        save(pendingFinish, as: "pendingFinish")
        save(Optional<WatchState>.none, as: "state")
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

    /// A new state: the server's (`fromServer`), or this watch's own for a
    /// workout started offline.
    private func apply(state fresh: WatchState, fromServer: Bool = true) {
        let previous = state?.active
        var next = fresh
        if fromServer {
            // The plans for starting offline only come while no workout's on:
            // keep the last ones through a workout.
            let known = ((state?.options ?? []) + [state?.next].compactMap { $0 })
            let withPlan = { (option: StartOption) -> StartOption in
                var kept = option
                if kept.plan == nil { kept.plan = known.first { $0.templateId == option.templateId }?.plan }
                return kept
            }
            next.options = next.options.map(withPlan)
            next.next = next.next.map(withPlan)
            // A workout started here offline is the workout until the server
            // has it; one finished offline is over. A finish on its way
            // hasn't reached the server yet either.
            if let offline { next.active = offline.finished ? nil : offline.workout }
            if let pendingFinish, next.active?.id == pendingFinish.sessionId { next.active = nil }
            var cached = next
            cached.active = nil
            save(cached, as: "state")
        }
        if previous?.id != next.active?.id { keepGoing = false }
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
        updateComplications()

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
            // Finished (or discarded) elsewhere: end it here too.
            selectedExerciseId = nil
            clearRest()
            if let previous {
                Task { await conclude(previous) }
            } else if recorder.isRecording {
                Task { await recorder.finish() }
            }
        }
    }

    /// The workout's over, here or on the phone: stop recording and show its
    /// summary. Once per workout.
    private func conclude(_ workout: Workout) async {
        guard concludedId != workout.id else { return }
        concludedId = workout.id
        clearRest()
        let health = await recorder.finish()
        let working = workout.exercises.flatMap(\.workingSets)
        summary = Summary(
            title: workout.title,
            duration: health?.duration ?? Date().timeIntervalSince(workout.startDate),
            sets: working.count,
            volume: working.reduce(0) { $0 + $1.weight * Double($1.reps) },
            exercises: workout.exercises.filter { !$0.workingSets.isEmpty }.count,
            calories: health?.calories,
            averageHeartRate: health?.averageHeartRate
        )
    }

    /// The exercise to log next: the one picked, else the latest one worked
    /// until its target's met, then the next one that isn't finished (back
    /// round to any skipped earlier).
    func currentExercise() -> Exercise? {
        guard let exercises = state?.active?.exercises, !exercises.isEmpty else { return nil }
        if let id = selectedExerciseId, let chosen = exercises.first(where: { $0.id == id }) {
            return chosen
        }
        guard let i = exercises.lastIndex(where: { !$0.workingSets.isEmpty }) else { return exercises.first }
        let latest = exercises[i]
        guard Self.metTarget(latest) else { return latest }
        return Self.nextUnfinished(after: i, in: exercises) ?? latest
    }

    /// Whether every exercise has had its sets: the workout's done bar the
    /// tap on End. An exercise without a target counts once it has a set;
    /// a workout with no targets at all (freeform) is never done by itself.
    func isComplete(_ workout: Workout) -> Bool {
        workout.exercises.contains { $0.targetSets != nil } && workout.exercises.allSatisfy(Self.isDone)
    }

    private static func metTarget(_ exercise: Exercise) -> Bool {
        guard let target = exercise.targetSets else { return false }
        return exercise.workingSets.count >= target
    }

    private static func isDone(_ exercise: Exercise) -> Bool {
        exercise.targetSets == nil ? !exercise.workingSets.isEmpty : metTarget(exercise)
    }

    /// The first unfinished exercise after position `i`, wrapping round.
    private static func nextUnfinished(after i: Int, in exercises: [Exercise]) -> Exercise? {
        (Array(exercises[(i + 1)...]) + Array(exercises[..<i])).first { !isDone($0) }
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

    /// Tapping a workout: the countdown runs while the server opens the
    /// session, and the workout appears once both are done.
    func begin(_ option: StartOption) {
        guard starting == nil, !busy else { return }
        problem = nil
        starting = option
        countdownDone = false
        startDone = false
        Task {
            await start(option)
            startDone = true
            finishStarting()
        }
    }

    func countdownFinished() {
        countdownDone = true
        finishStarting()
    }

    private func finishStarting() {
        guard countdownDone, startDone else { return }
        starting = nil
    }

    private func start(_ option: StartOption) async {
        guard let api, !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let fresh = try await api.start(option, localDate: localDate())
            selectedExerciseId = nil
            apply(state: fresh)
        } catch APIError.unlinked {
            forget()
        } catch APIError.offline where option.plan?.isEmpty == false {
            startOffline(option)
        } catch {
            problem = "Couldn't start the workout. Check your connection."
        }
    }

    /// No connection: the workout starts here from the plan the server last
    /// sent, and reaches the server when the watch does (syncOffline).
    private func startOffline(_ option: StartOption) {
        guard let plan = option.plan, var base = state else { return }
        let id = "offline-\(UUID().uuidString.lowercased())"
        let workout = Workout(
            id: id,
            title: option.label,
            startedAt: Date().timeIntervalSince1970 * 1000,
            exercises: plan.enumerated().map { item in
                Exercise(
                    id: "\(id)-\(item.offset)", name: item.element.name, targetSets: item.element.targetSets,
                    targetReps: item.element.targetReps, restSeconds: item.element.restSeconds, sets: [],
                    last: item.element.last
                )
            }
        )
        offline = OfflineWorkout(option: option, localDate: localDate(), workout: workout)
        save(offline, as: "offline")
        selectedExerciseId = nil
        base.active = workout
        apply(state: base, fromServer: false)
    }

    /// The offline workout reaches the server: it's started there (dated the
    /// day it happened), its sets are re-pointed at the server's exercises,
    /// and a finish made offline follows them. False while still offline.
    private func syncOffline(_ api: WatchAPI) async -> Bool {
        guard let started = offline else { return true }
        let fresh: WatchState
        do {
            fresh = try await api.start(started.option, localDate: started.localDate)
        } catch APIError.server(let status) where (400..<500).contains(status) {
            // The day was deleted since: nothing left to attach the sets to.
            pending.removeAll { $0.sessionId == started.workout.id }
            savePending()
            offline = nil
            save(offline, as: "offline")
            problem = "That workout's day was deleted, so its sets couldn't be saved."
            return true
        } catch {
            return false
        }
        guard let server = fresh.active else { return false }

        // In order where the names agree, else by name.
        var ids: [String: String] = [:]
        var unmatched = server.exercises
        for (i, local) in started.workout.exercises.enumerated() {
            let inPlace = i < server.exercises.count && server.exercises[i].name == local.name
                && unmatched.contains { $0.id == server.exercises[i].id }
            guard let match = inPlace ? server.exercises[i] : unmatched.first(where: { $0.name == local.name }) else { continue }
            ids[local.id] = match.id
            unmatched.removeAll { $0.id == match.id }
        }
        pending = pending.compactMap { write in
            guard write.sessionId == started.workout.id else { return write }
            guard let exerciseId = ids[write.sessionExerciseId] else { return nil }
            var moved = write
            moved.sessionId = server.id
            moved.sessionExerciseId = exerciseId
            return moved
        }
        savePending()
        if let selected = selectedExerciseId { selectedExerciseId = ids[selected] ?? selected }
        offline = nil
        save(offline, as: "offline")
        if started.finished {
            pendingFinish = PendingFinish(sessionId: server.id, durationMin: started.finishedMinutes)
            save(pendingFinish, as: "pendingFinish")
        } else {
            if recorder.sessionId == started.workout.id { recorder.retag(server.id) }
            apply(state: fresh)
        }
        return true
    }

    /// The phone opened this app to record a workout it just started.
    func phoneStartedWorkout() async {
        await refresh()
    }

    /// Ends the workout. It ends here at once, connection or not; the
    /// server hears about it (after every set) as soon as it can.
    func finish() async {
        guard let active = state?.active, !busy else { return }
        busy = true
        defer { busy = false }
        let minutes = Int((Date().timeIntervalSince(active.startDate) / 60).rounded())
        let duration = minutes <= 360 ? max(1, minutes) : nil
        if var started = offline, started.workout.id == active.id {
            started.finished = true
            started.finishedMinutes = duration
            offline = started
            save(offline, as: "offline")
        } else {
            pendingFinish = PendingFinish(sessionId: active.id, durationMin: duration)
            save(pendingFinish, as: "pendingFinish")
            // The phone's Lock Screen can end now, before the server knows.
            PhoneLink.shared.sendGuaranteed(["finished": active.id])
        }
        WKInterfaceDevice.current().play(.success)
        clearRest()
        await conclude(state?.active ?? active)
        state?.active = nil
        problem = nil
        if await flush(), let api, let fresh = try? await api.state() {
            apply(state: fresh)
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

        // Done with this one: the next unfinished exercise comes up after the rest.
        let exercise = active.exercises[i]
        if Self.metTarget(exercise), let next = Self.nextUnfinished(after: i, in: active.exercises) {
            selectedExerciseId = next.id
        } else {
            selectedExerciseId = exerciseId
        }

        WKInterfaceDevice.current().play(.success)
        if isComplete(active) && !keepGoing {
            // That was the last set: no rest, the finish comes up instead.
            clearRest()
            tellPhone()
        } else {
            // This exercise's own rest (its template's), else the usual.
            startRest(seconds: exercise.restSeconds)
        }
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

    /// Sends waiting sets, oldest first; true once none are left. Offline,
    /// they wait for next time. A send already under way is waited out
    /// first, so a finish can never overtake a set still on its way.
    @discardableResult
    private func flush() async -> Bool {
        while flushing {
            try? await Task.sleep(nanoseconds: 50_000_000)
        }
        guard let api else { return pending.isEmpty && offline == nil && pendingFinish == nil }
        flushing = true
        defer { flushing = false }
        guard await syncOffline(api) else { return false }
        while let write = pending.first {
            do {
                try await api.save(write)
            } catch APIError.unlinked {
                return false
            } catch APIError.server(let status) where (400..<500).contains(status) {
                // Refused for good (the workout was deleted, say): drop it.
            } catch {
                return false
            }
            pending.removeFirst()
            savePending()
        }
        if let finish = pendingFinish {
            do {
                _ = try await api.finish(sessionId: finish.sessionId, durationMin: finish.durationMin)
            } catch APIError.server(let status) where (400..<500).contains(status) {
                // Gone or already finished: nothing more to send.
            } catch {
                return false
            }
            pendingFinish = nil
            save(pendingFinish, as: "pendingFinish")
            PhoneLink.shared.sendGuaranteed(["finished": finish.sessionId])
            return true
        }
        tellPhone()
        return true
    }

    private func savePending() {
        defaults.set(try? JSONEncoder().encode(pending), forKey: "pending")
    }

    // MARK: Rest

    func startRest(seconds: Double? = nil) {
        let total = seconds ?? settings.restSeconds
        rest = Rest(endsAt: Date().addingTimeInterval(total), total: total, heartRateTarget: heartRateTarget())
        scheduleRestEnd()
        tellPhone()
    }

    /// Recovered, for this rest: halfway from the set's peak back down to
    /// resting (Health's resting heart rate, else 65). Only when the set
    /// raised it 20 or more, and the lifter hasn't turned it off.
    private func heartRateTarget() -> Double? {
        guard settings.hrRest != false, let peak = recorder.peakHeartRate() else { return nil }
        let resting = recorder.restingHeartRate ?? 65
        guard peak - resting >= 20 else { return nil }
        return resting + (peak - resting) / 2
    }

    /// Heart rate back down mid-rest: a tap on the wrist, and the rest page
    /// says Ready. The timer keeps running; it's their call.
    private func heartRateChanged(_ bpm: Double?) {
        guard let bpm, var current = rest, current.recoveredAt == nil,
              let target = current.heartRateTarget, bpm <= target,
              current.endsAt > Date(), Date().timeIntervalSince(current.startedAt) >= 20
        else { return }
        current.recoveredAt = Date()
        rest = current
        WKInterfaceDevice.current().play(.directionDown)
    }

    func extendRest(by seconds: Double) {
        guard var extended = rest else {
            startRest(seconds: seconds)
            return
        }
        let end = max(extended.endsAt, Date()).addingTimeInterval(seconds)
        extended.total = max(extended.total, end.timeIntervalSinceNow)
        extended.endsAt = end
        self.rest = extended
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
            guard !Task.isCancelled, let self, self.rest?.endsAt == rest.endsAt else { return }
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
        // A workout started offline isn't the server's yet: nothing the
        // phone's Lock Screen could act on.
        guard let active = state?.active, offline?.workout.id != active.id else { return }
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
            let finished = isComplete(active) && !keepGoing
            activity["detail"] = finished
                ? "All sets done"
                : done > 0 ? "\(done) \(done == 1 ? "set" : "sets") done" : "Up next"
            // What the Lock Screen's Log Set logs: what the logger here would fill in.
            if !finished, let numbers = plannedNext(exercise) {
                let weight = numbers.weight.rounded() == numbers.weight
                    ? String(Int(numbers.weight)) : String(format: "%.1f", numbers.weight)
                activity["next"] = [
                    "sessionExerciseId": exercise.id,
                    "weight": numbers.weight,
                    "reps": numbers.reps,
                    "label": "\(weight) \(settings.unit) × \(numbers.reps)",
                ] as [String: Any]
            }
        }
        if let rest {
            activity["restEndsAt"] = rest.endsAt.timeIntervalSince1970 * 1000
            activity["restTotal"] = rest.total
        }
        PhoneLink.shared.sendIfReachable(["activity": activity])
    }

    /// The next set's numbers, as the logger fills them in: this session's
    /// last set, else the same set last time.
    func plannedNext(_ exercise: Exercise) -> (weight: Double, reps: Int)? {
        if let latest = exercise.sets.max(by: { $0.n < $1.n }) { return (latest.weight, latest.reps) }
        let done = exercise.workingSets.count
        let past = done < exercise.last.count ? exercise.last[done] : exercise.last.last
        return past.map { ($0.weight, $0.reps) }
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
