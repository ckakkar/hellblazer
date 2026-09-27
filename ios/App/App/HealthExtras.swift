import Foundation
import HealthKit

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

    /// [{ date: "yyyy-MM-dd", sleepMin?, hrv?, rhr? }], oldest first, in the
    /// phone's calendar. A night's sleep is dated by the morning it ends.
    static func read(_ store: HKHealthStore) async -> [[String: Any]] {
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

        var result: [[String: Any]] = []
        var day = first
        while day <= today {
            let key = Self.key(day)
            var entry: [String: Any] = ["date": key]
            if let minutes = sleepByNight[key] { entry["sleepMin"] = minutes }
            if let value = hrvByDay[key] { entry["hrv"] = value }
            if let value = rhrByDay[key] { entry["rhr"] = value }
            result.append(entry)
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
