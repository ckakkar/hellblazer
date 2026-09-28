import BackgroundTasks
import Foundation
import HealthKit
import WidgetKit

/// What Fatty asks Apple Health for, in one sheet: it saves workouts,
/// bodyweight and (iOS 18) each workout's effort, and reads sleep, heart
/// rate variability and resting heart rate for Recovery on Home, plus
/// workouts, to find the one the watch recorded and rate its effort.
enum HealthAccess {
    static let bodyMass = HKQuantityType(.bodyMass)

    static var shareTypes: Set<HKSampleType> {
        var types: Set<HKSampleType> = [HKObjectType.workoutType(), bodyMass]
        if #available(iOS 18.0, *) {
            types.insert(HKQuantityType(.workoutEffortScore))
        }
        return types
    }

    static var readTypes: Set<HKObjectType> {
        [
            HKCategoryType(.sleepAnalysis),
            HKQuantityType(.heartRateVariabilitySDNN),
            HKQuantityType(.restingHeartRate),
            HKObjectType.workoutType(),
        ]
    }
}

/// Whether finished workouts go to Apple Health: the Settings switch, which
/// lives in the page (healthSyncOn); the page tells the app, so a workout
/// finished by voice follows it too.
enum HealthSync {
    private static let key = "health.sync"
    static var on: Bool { UserDefaults.standard.bool(forKey: key) }
    static func set(_ on: Bool) { UserDefaults.standard.set(on, forKey: key) }
}

/// A finished session as a strength-training workout in Apple Health.
enum HealthWorkouts {
    /// Saves `start`...`end`, tagged with the session, with its effort
    /// (1-10) on iOS 18. Calls back with whether a workout was saved.
    static func save(
        start: Date,
        end: Date,
        sessionId: String?,
        effort: Double?,
        store: HKHealthStore,
        completion: @escaping (Result<Bool, Error>) -> Void
    ) {
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        configuration.locationType = .indoor
        let builder = HKWorkoutBuilder(healthStore: store, configuration: configuration, device: .local())
        var metadata: [String: Any] = [HKMetadataKeyIndoorWorkout: true]
        if let sessionId { metadata[HKMetadataKeyExternalUUID] = sessionId }

        builder.beginCollection(withStart: start) { began, error in
            guard began else {
                completion(.failure(error ?? HealthError.failed("Couldn't start the workout")))
                return
            }
            builder.addMetadata(metadata) { _, _ in
                builder.endCollection(withEnd: end) { ended, error in
                    guard ended else {
                        completion(.failure(error ?? HealthError.failed("Couldn't end the workout")))
                        return
                    }
                    builder.finishWorkout { workout, error in
                        if let error {
                            completion(.failure(error))
                            return
                        }
                        if let workout, let effort, let sessionId {
                            WorkoutEffort.rate(workout, score: effort, sessionId: sessionId, store: store)
                        }
                        completion(.success(workout != nil))
                    }
                }
            }
        }
    }

    enum HealthError: LocalizedError {
        case failed(String)
        var errorDescription: String? {
            switch self {
            case .failed(let message): return message
            }
        }
    }
}

/// Recovery on Home: sleep, heart rate variability and resting heart rate,
/// a day at a time over the last four weeks, so the site can weigh today
/// against the lifter's own normal (src/lib/recovery.ts). Read here and
/// handed straight to the page; none of it goes to Fatty's server.
enum RecoveryReadings {
    /// Today plus 28 days of baseline.
    static let days = 29

    /// Whether the sheet still has something to ask (a fresh install, or
    /// types this version added). Health never says whether reading was
    /// allowed, only whether it was asked.
    static func shouldRequest(_ store: HKHealthStore) async -> Bool {
        await withCheckedContinuation { continuation in
            store.getRequestStatusForAuthorization(
                toShare: HealthAccess.shareTypes,
                read: HealthAccess.readTypes
            ) { status, _ in
                continuation.resume(returning: status == .shouldRequest)
            }
        }
    }

    /// One day's readings. A night's sleep is dated by the morning it ends.
    struct Day {
        var date: String
        var sleepMin: Double?
        var hrv: Double?
        var rhr: Double?

        /// For the page: { date, sleepMin?, hrv?, rhr? }.
        var dictionary: [String: Any] {
            var entry: [String: Any] = ["date": date]
            if let sleepMin { entry["sleepMin"] = sleepMin }
            if let hrv { entry["hrv"] = hrv }
            if let rhr { entry["rhr"] = rhr }
            return entry
        }
    }

    /// The last four weeks, oldest first, in the phone's calendar.
    static func read(_ store: HKHealthStore) async -> [Day] {
        let calendar = Calendar.current
        let now = Date()
        let today = calendar.startOfDay(for: now)
        guard let first = calendar.date(byAdding: .day, value: -(days - 1), to: today) else { return [] }

        async let hrv = dailyAverages(
            HKQuantityType(.heartRateVariabilitySDNN), unit: .secondUnit(with: .milli),
            from: first, to: now, store: store
        )
        async let rhr = dailyAverages(
            HKQuantityType(.restingHeartRate), unit: .count().unitDivided(by: .minute()),
            from: first, to: now, store: store
        )
        async let sleep = nightlySleep(from: first, to: now, store: store)
        let (hrvByDay, rhrByDay, sleepByNight) = await (hrv, rhr, sleep)

        var result: [Day] = []
        var day = first
        while day <= today {
            let key = Self.key(day)
            result.append(Day(date: key, sleepMin: sleepByNight[key], hrv: hrvByDay[key], rhr: rhrByDay[key]))
            guard let next = calendar.date(byAdding: .day, value: 1, to: day) else { break }
            day = next
        }
        return result
    }

    private static func key(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    /// Each day's average reading, keyed by day.
    private static func dailyAverages(
        _ type: HKQuantityType,
        unit: HKUnit,
        from start: Date,
        to end: Date,
        store: HKHealthStore
    ) async -> [String: Double] {
        let descriptor = HKStatisticsCollectionQueryDescriptor(
            predicate: .quantitySample(type: type, predicate: HKQuery.predicateForSamples(withStart: start, end: end)),
            options: .discreteAverage,
            anchorDate: start,
            intervalComponents: DateComponents(day: 1)
        )
        guard let collection = try? await descriptor.result(for: store) else { return [:] }
        var byDay: [String: Double] = [:]
        collection.enumerateStatistics(from: start, to: end) { statistics, _ in
            if let value = statistics.averageQuantity()?.doubleValue(for: unit) {
                byDay[Self.key(statistics.startDate)] = (value * 10).rounded() / 10
            }
        }
        return byDay
    }

    /// Minutes asleep per night. The watch, the phone and a sleep app can
    /// all record the same night, so overlapping stretches are merged before
    /// they're added up. A stretch belongs to the day six hours after it
    /// ends: last night's sleep counts for this morning, a nap for today.
    private static func nightlySleep(from start: Date, to end: Date, store: HKHealthStore) async -> [String: Double] {
        let since = start.addingTimeInterval(-18 * 60 * 60)
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.categorySample(
                type: HKCategoryType(.sleepAnalysis),
                predicate: HKQuery.predicateForSamples(withStart: since, end: end)
            )],
            sortDescriptors: [SortDescriptor(\.startDate)]
        )
        guard let samples = try? await descriptor.result(for: store) else { return [:] }
        let asleep = Set(HKCategoryValueSleepAnalysis.allAsleepValues.map(\.rawValue))

        var byNight: [String: [(Date, Date)]] = [:]
        for sample in samples where asleep.contains(sample.value) {
            let night = key(sample.endDate.addingTimeInterval(6 * 60 * 60))
            byNight[night, default: []].append((sample.startDate, sample.endDate))
        }
        var minutes: [String: Double] = [:]
        for (night, spans) in byNight {
            var total: TimeInterval = 0
            var current: (Date, Date)?
            for span in spans.sorted(by: { $0.0 < $1.0 }) {
                if let open = current, span.0 <= open.1 {
                    current = (open.0, max(open.1, span.1))
                } else {
                    if let open = current { total += open.1.timeIntervalSince(open.0) }
                    current = span
                }
            }
            if let open = current { total += open.1.timeIntervalSince(open.0) }
            if total > 0 { minutes[night] = (total / 60).rounded() }
        }
        return minutes
    }
}

/// Today's Recovery call from the readings: the same rules, thresholds and
/// words as the card on Home (src/lib/recovery.ts, where they're tested);
/// change both together. Each reading is weighed against the median of the
/// four weeks before it, once there's a week of them.
enum RecoveryCall {
    private enum Tone { case good, fair, poor }

    private static func median(_ values: [Double]) -> Double? {
        guard values.count >= 7 else { return nil }
        let sorted = values.sorted()
        let mid = sorted.count / 2
        return sorted.count % 2 == 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    }

    /// Today's reading (else yesterday's, when allowed) and the usual before it.
    private static func latest(
        _ days: [RecoveryReadings.Day],
        _ value: (RecoveryReadings.Day) -> Double?,
        allowYesterday: Bool
    ) -> (value: Double, usual: Double?)? {
        let last = days.count - 1
        for i in allowYesterday ? [last, last - 1] : [last] where i >= 0 {
            guard let reading = value(days[i]) else { continue }
            return (reading, median(days[..<i].compactMap(value)))
        }
        return nil
    }

    private static func sleepTone(_ minutes: Double, _ usual: Double?) -> Tone {
        if minutes < 360 || (usual.map { minutes < $0 - 90 } ?? false) { return .poor }
        if minutes < 420 || (usual.map { minutes < $0 - 45 } ?? false) { return .fair }
        return .good
    }

    private static func hrvTone(_ ms: Double, _ usual: Double?) -> Tone {
        guard let usual, usual > 0 else { return .good }
        let ratio = ms / usual
        return ratio < 0.85 ? .poor : ratio < 0.95 ? .fair : .good
    }

    private static func rhrTone(_ bpm: Double, _ usual: Double?) -> Tone {
        guard let usual else { return .good }
        let over = bpm - usual
        return over > 5 ? .poor : over > 2 ? .fair : .good
    }

    static func assess(_ days: [RecoveryReadings.Day], on today: Date = Date()) -> RecoveryCache? {
        let sleep = latest(days, { $0.sleepMin }, allowYesterday: false)
        let hrv = latest(days, { $0.hrv }, allowYesterday: true)
        let rhr = latest(days, { $0.rhr }, allowYesterday: true)
        var tones: [Tone] = []
        if let sleep { tones.append(sleepTone(sleep.value, sleep.usual)) }
        if let hrv { tones.append(hrvTone(hrv.value, hrv.usual)) }
        if let rhr { tones.append(rhrTone(rhr.value, rhr.usual)) }
        guard !tones.isEmpty else { return nil }

        let poor = tones.filter { $0 == .poor }.count
        let fair = tones.filter { $0 == .fair }.count
        let verdict = poor >= 2 || poor + fair >= 3 ? "easy" : poor + fair > 0 ? "steady" : "ready"
        let headline = ["ready": "Ready to push", "steady": "Train as planned", "easy": "Go lighter today"][verdict]!
        return RecoveryCache(
            date: RecoveryCache.dayKey(today),
            verdict: verdict,
            headline: headline,
            sleepMin: sleep?.value,
            hrv: hrv?.value,
            rhr: rhr?.value
        )
    }
}

/// Keeps the Recovery widget current: reads Health, makes the call, and
/// stores it for the widget. Runs when the app comes forward, when Home
/// asks for the readings, and in a background refresh each morning.
enum RecoveryRefresher {
    static let taskId = "com.kkrwhofrags.hellblazer.recovery"

    /// Whether there was anything to make a call from.
    @discardableResult
    static func refresh(store: HKHealthStore = HKHealthStore(), days: [RecoveryReadings.Day]? = nil) async -> Bool {
        guard HKHealthStore.isHealthDataAvailable() else { return false }
        let readings: [RecoveryReadings.Day]
        if let days {
            readings = days
        } else {
            readings = await RecoveryReadings.read(store)
        }
        guard let call = RecoveryCall.assess(readings) else { return false }
        call.save()
        WidgetCenter.shared.reloadTimelines(ofKind: RecoveryCache.widgetKind)
        schedule()
        return true
    }

    /// At launch, before it finishes (BGTaskScheduler's rule).
    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: taskId, using: nil) { task in
            guard let task = task as? BGAppRefreshTask else { return }
            schedule()
            let work = Task { task.setTaskCompleted(success: await refresh()) }
            task.expirationHandler = { work.cancel() }
        }
    }

    /// Asks for a run after 5:30 tomorrow morning, once last night's sleep
    /// has synced. iOS picks the moment; it learns when the app gets used.
    static func schedule() {
        let calendar = Calendar.current
        let now = Date()
        var morning = calendar.date(bySettingHour: 5, minute: 30, second: 0, of: now) ?? now
        if morning <= now { morning = calendar.date(byAdding: .day, value: 1, to: morning) ?? now }
        let request = BGAppRefreshTaskRequest(identifier: taskId)
        request.earliestBeginDate = morning
        try? BGTaskScheduler.shared.submit(request)
    }
}

/// The workout's Effort rating in the Fitness app (iOS 18): the RPE logged
/// in Fatty, averaged over the working sets. A workout the watch recorded
/// reaches the phone's Health a little after the workout ends, so its effort
/// waits here, and is tried again whenever the app comes forward.
enum WorkoutEffort {
    private struct Pending: Codable {
        var sessionId: String
        var score: Double
        var queuedAt: Date
    }

    private static let defaults = UserDefaults.standard
    private static let pendingKey = "health.pendingEffort"
    private static let ratedKey = "health.ratedSessions"
    private static let lock = NSLock()

    /// Rates the workout the phone just saved.
    static func rate(_ workout: HKWorkout, score: Double, sessionId: String, store: HKHealthStore) {
        guard #available(iOS 18.0, *) else { return }
        Task { _ = await relate(score: score, to: workout, sessionId: sessionId, store: store) }
    }

    /// Rates the workout the watch recorded for this session, now if it has
    /// synced, else once it has.
    static func rateWatchWorkout(sessionId: String, score: Double, store: HKHealthStore) {
        guard #available(iOS 18.0, *) else { return }
        update { pending in
            pending.removeAll { $0.sessionId == sessionId }
            pending.append(Pending(sessionId: sessionId, score: score, queuedAt: Date()))
        }
        retryPending(store: store)
        // Usually synced within the minute: one more go while the app's still up.
        DispatchQueue.main.asyncAfter(deadline: .now() + 60) { retryPending(store: store) }
    }

    /// Tries every waiting rating; gives up on any two days old.
    static func retryPending(store: HKHealthStore) {
        guard #available(iOS 18.0, *) else { return }
        let waiting = load()
        guard !waiting.isEmpty else { return }
        Task {
            for item in waiting {
                if Date().timeIntervalSince(item.queuedAt) > 2 * 24 * 60 * 60 {
                    update { $0.removeAll { $0.sessionId == item.sessionId } }
                    continue
                }
                guard let workout = await find(sessionId: item.sessionId, store: store) else { continue }
                _ = await relate(score: item.score, to: workout, sessionId: item.sessionId, store: store)
                update { $0.removeAll { $0.sessionId == item.sessionId } }
            }
        }
    }

    @available(iOS 18.0, *)
    private static func relate(score: Double, to workout: HKWorkout, sessionId: String, store: HKHealthStore) async -> Bool {
        let type = HKQuantityType(.workoutEffortScore)
        guard store.authorizationStatus(for: type) == .sharingAuthorized,
              !(defaults.stringArray(forKey: ratedKey) ?? []).contains(sessionId)
        else { return false }
        let sample = HKQuantitySample(
            type: type,
            quantity: HKQuantity(unit: .appleEffortScore(), doubleValue: min(10, max(1, score.rounded()))),
            start: workout.startDate,
            end: workout.endDate
        )
        let related = await withCheckedContinuation { continuation in
            store.relateWorkoutEffortSample(sample, with: workout, activity: nil) { success, _ in
                continuation.resume(returning: success)
            }
        }
        if related {
            let rated = (defaults.stringArray(forKey: ratedKey) ?? []).suffix(29)
            defaults.set(Array(rated) + [sessionId], forKey: ratedKey)
        }
        return related
    }

    /// The workout tagged with this session (the watch sets the tag too).
    private static func find(sessionId: String, store: HKHealthStore) async -> HKWorkout? {
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.workout(HKQuery.predicateForObjects(
                withMetadataKey: HKMetadataKeyExternalUUID,
                allowedValues: [sessionId]
            ))],
            sortDescriptors: [SortDescriptor(\.endDate, order: .reverse)],
            limit: 1
        )
        return try? await descriptor.result(for: store).first
    }

    private static func load() -> [Pending] {
        lock.lock()
        defer { lock.unlock() }
        return defaults.data(forKey: pendingKey).flatMap { try? JSONDecoder().decode([Pending].self, from: $0) } ?? []
    }

    private static func update(_ change: (inout [Pending]) -> Void) {
        lock.lock()
        defer { lock.unlock() }
        var pending = defaults.data(forKey: pendingKey).flatMap { try? JSONDecoder().decode([Pending].self, from: $0) } ?? []
        change(&pending)
        defaults.set(try? JSONEncoder().encode(pending), forKey: pendingKey)
    }
}
