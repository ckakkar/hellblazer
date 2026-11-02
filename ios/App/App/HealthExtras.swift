import BackgroundTasks
import Foundation
import HealthKit
import WidgetKit

/// What Fatty asks Apple Health for, a feature at a time, each when it's
/// turned on. Saving to Health (Profile) saves workouts, bodyweight and (iOS
/// 18) each workout's effort, and reads workouts, to find the one the watch
/// recorded and rate its effort. Recovery on Home reads sleep, breathing
/// rate, heart rate variability, resting, walking and workout heart rate, and
/// the workouts themselves, and nothing else: asking for it doesn't ask to
/// write anything.
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
        [HKObjectType.workoutType()]
    }

    static var recoveryTypes: Set<HKObjectType> {
        [
            HKCategoryType(.sleepAnalysis),
            HKQuantityType(.heartRateVariabilitySDNN),
            HKQuantityType(.restingHeartRate),
            HKQuantityType(.respiratoryRate),
            HKQuantityType(.walkingHeartRateAverage),
            HKQuantityType(.heartRate),
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

/// Recovery on Home: sleep, breathing rate asleep, heart rate variability,
/// resting and walking heart rate, a day at a time over the last four weeks,
/// so the site can weigh today against the lifter's own normal
/// (src/lib/recovery.ts), and the last two weeks' workouts with their heart
/// rate. Read here and handed straight to the page; none of it goes to
/// Fatty's server.
enum RecoveryReadings {
    /// Today plus 28 days of baseline.
    static let days = 29

    /// Whether the sheet still has something to ask (a fresh install, or
    /// types this version added). Health never says whether reading was
    /// allowed, only whether it was asked.
    static func shouldRequest(_ store: HKHealthStore) async -> Bool {
        await withCheckedContinuation { continuation in
            store.getRequestStatusForAuthorization(
                toShare: [],
                read: HealthAccess.recoveryTypes
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
        /// Breaths a minute asleep, the night's average.
        var rr: Double?
        /// Walking heart rate, the day's average.
        var walkHr: Double?

        /// For the page: { date, sleepMin?, hrv?, rhr?, rr?, walkHr? }.
        var dictionary: [String: Any] {
            var entry: [String: Any] = ["date": date]
            if let sleepMin { entry["sleepMin"] = sleepMin }
            if let hrv { entry["hrv"] = hrv }
            if let rhr { entry["rhr"] = rhr }
            if let rr { entry["rr"] = rr }
            if let walkHr { entry["walkHr"] = walkHr }
            return entry
        }
    }

    /// A workout from Health, with how hard the heart worked in it.
    struct Workout {
        var start: Date
        var end: Date
        /// "strength", or "other".
        var kind: String
        var avgHr: Double?
        var maxHr: Double?

        /// For the page: { start, end (epoch ms), kind, avgHr?, maxHr? }.
        var dictionary: [String: Any] {
            var entry: [String: Any] = [
                "start": start.timeIntervalSince1970 * 1000,
                "end": end.timeIntervalSince1970 * 1000,
                "kind": kind,
            ]
            if let avgHr { entry["avgHr"] = avgHr }
            if let maxHr { entry["maxHr"] = maxHr }
            return entry
        }
    }

    /// The last four weeks, oldest first, in the phone's calendar.
    static func read(_ store: HKHealthStore) async -> [Day] {
        let calendar = Calendar.current
        let now = Date()
        let today = calendar.startOfDay(for: now)
        guard let first = calendar.date(byAdding: .day, value: -(days - 1), to: today) else { return [] }

        let perMinute = HKUnit.count().unitDivided(by: .minute())
        async let hrv = dailyAverages(
            HKQuantityType(.heartRateVariabilitySDNN), unit: .secondUnit(with: .milli),
            from: first, to: now, store: store
        )
        async let rhr = dailyAverages(HKQuantityType(.restingHeartRate), unit: perMinute, from: first, to: now, store: store)
        async let walk = dailyAverages(HKQuantityType(.walkingHeartRateAverage), unit: perMinute, from: first, to: now, store: store)
        async let breathing = nightlyAverages(HKQuantityType(.respiratoryRate), unit: perMinute, from: first, to: now, store: store)
        async let sleep = nightlySleep(from: first, to: now, store: store)
        let (hrvByDay, rhrByDay, walkByDay, rrByNight, sleepByNight) = await (hrv, rhr, walk, breathing, sleep)

        var result: [Day] = []
        var day = first
        while day <= today {
            let key = Self.key(day)
            result.append(Day(
                date: key,
                sleepMin: sleepByNight[key],
                hrv: hrvByDay[key],
                rhr: rhrByDay[key],
                rr: rrByNight[key],
                walkHr: walkByDay[key]
            ))
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

    /// A reading taken overnight (breathing rate asleep), averaged per night
    /// and dated like sleep: by the morning it ends. Only readings from the
    /// evening to late morning count, so a daytime one can't pass for sleep.
    private static func nightlyAverages(
        _ type: HKQuantityType,
        unit: HKUnit,
        from start: Date,
        to end: Date,
        store: HKHealthStore
    ) async -> [String: Double] {
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.quantitySample(
                type: type,
                predicate: HKQuery.predicateForSamples(withStart: start.addingTimeInterval(-18 * 60 * 60), end: end)
            )],
            sortDescriptors: [SortDescriptor(\.startDate)]
        )
        guard let samples = try? await descriptor.result(for: store) else { return [:] }
        let calendar = Calendar.current
        var sums: [String: (total: Double, count: Int)] = [:]
        for sample in samples {
            let hour = calendar.component(.hour, from: sample.endDate)
            guard hour >= 20 || hour < 11 else { continue }
            let night = key(sample.endDate.addingTimeInterval(6 * 60 * 60))
            let sum = sums[night] ?? (0, 0)
            sums[night] = (sum.total + sample.quantity.doubleValue(for: unit), sum.count + 1)
        }
        return sums.mapValues { (($0.total / Double($0.count)) * 10).rounded() / 10 }
    }

    /// The last two weeks' workouts, newest first, each with its average
    /// and highest heart rate while it ran (the watch records it).
    static func workouts(_ store: HKHealthStore, days: Int = 14) async -> [Workout] {
        let now = Date()
        let since = now.addingTimeInterval(-Double(days) * 86_400)
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.workout(HKQuery.predicateForSamples(withStart: since, end: now))],
            sortDescriptors: [SortDescriptor(\.endDate, order: .reverse)],
            limit: 30
        )
        guard let found = try? await descriptor.result(for: store) else { return [] }
        let strength: Set<HKWorkoutActivityType> = [.traditionalStrengthTraining, .functionalStrengthTraining]
        var result: [Workout] = []
        for workout in found {
            let heart = await heartRate(from: workout.startDate, to: workout.endDate, store: store)
            result.append(Workout(
                start: workout.startDate,
                end: workout.endDate,
                kind: strength.contains(workout.workoutActivityType) ? "strength" : "other",
                avgHr: heart.avg,
                maxHr: heart.max
            ))
        }
        return result
    }

    private static func heartRate(from start: Date, to end: Date, store: HKHealthStore) async -> (avg: Double?, max: Double?) {
        let descriptor = HKStatisticsQueryDescriptor(
            predicate: .quantitySample(
                type: HKQuantityType(.heartRate),
                predicate: HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
            ),
            options: [.discreteAverage, .discreteMax]
        )
        guard let statistics = try? await descriptor.result(for: store) else { return (nil, nil) }
        let bpm = HKUnit.count().unitDivided(by: .minute())
        return (
            statistics.averageQuantity()?.doubleValue(for: bpm).rounded(),
            statistics.maximumQuantity()?.doubleValue(for: bpm).rounded()
        )
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

/// What Fatty's log says about the training (src/lib/training-load.ts),
/// handed over by Home (setTrainingLoad) so a background refresh can weigh it
/// with the hour's Health readings: the widget and the watch then make the
/// same call as the card.
struct TrainingLoad: Codable {
    /// Epoch ms the last heavy session ended, and what it was.
    var lastHeavyAt: Double?
    var lastHeavyTitle: String?
    var lastHeavySets: Int?
    var recentSets: Int
    var usualSets: Double?
    var streakDays: Int
    /// When Home worked it out, epoch ms.
    var at: Double

    private static let key = "recovery.trainingLoad"

    static func load() -> TrainingLoad? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(TrainingLoad.self, from: data)
    }

    func save() {
        guard let data = try? JSONEncoder().encode(self) else { return }
        UserDefaults.standard.set(data, forKey: Self.key)
    }

    /// Signing out: it was that account's training.
    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}

/// Today's Recovery call from the readings and the training: the same rules,
/// thresholds and words as the card on Home (src/lib/recovery.ts, where
/// they're tested); change both together. Each reading is weighed against
/// the median of the four weeks before it, once there's a week of them.
enum RecoveryCall {
    private enum Tone: Int { case poor = 0, fair = 1, good = 2 }
    private struct Signal {
        var tone: Tone
        var text: String
        var training: Bool
    }

    private static func median(_ values: [Double], min: Int = 7) -> Double? {
        guard values.count >= min else { return nil }
        let sorted = values.sorted()
        let mid = sorted.count / 2
        return sorted.count % 2 == 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    }

    /// Today's reading (else yesterday's, when allowed), the usual before
    /// it, and whether it's yesterday's.
    private static func latest(
        _ days: [RecoveryReadings.Day],
        _ value: (RecoveryReadings.Day) -> Double?,
        allowYesterday: Bool
    ) -> (value: Double, usual: Double?, yesterday: Bool)? {
        let last = days.count - 1
        for i in allowYesterday ? [last, last - 1] : [last] where i >= 0 {
            guard let reading = value(days[i]) else { continue }
            return (reading, median(days[..<i].compactMap(value)), i != last)
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

    /// Over the usual by more than `poor` or `fair`.
    private static func overTone(_ value: Double, _ usual: Double?, poor: Double, fair: Double) -> Tone {
        guard let usual else { return .good }
        let over = value - usual
        return over > poor ? .poor : over > fair ? .fair : .good
    }

    private static func sleepText(_ minutes: Double) -> String {
        let m = Int(minutes.rounded())
        return "\(m / 60)h \(String(format: "%02d", m % 60))m"
    }

    private static func one(_ n: Double) -> String {
        let r = (n * 10).rounded() / 10
        return r == r.rounded() ? String(Int(r)) : String(format: "%.1f", r)
    }

    private static func ago(_ hours: Double) -> String {
        if hours < 1 { return "under an hour ago" }
        if hours < 36 {
            let h = Int(hours.rounded())
            return "\(h) \(h == 1 ? "hour" : "hours") ago"
        }
        return "\(Int((hours / 24).rounded())) days ago"
    }

    static func assess(
        _ days: [RecoveryReadings.Day],
        workouts: [RecoveryReadings.Workout] = [],
        load: TrainingLoad? = TrainingLoad.load(),
        on today: Date = Date()
    ) -> RecoveryCache? {
        let sleep = latest(days, { $0.sleepMin }, allowYesterday: false)
        let hrv = latest(days, { $0.hrv }, allowYesterday: true)
        let rhr = latest(days, { $0.rhr }, allowYesterday: true)
        let rr = latest(days, { $0.rr }, allowYesterday: false)
        let walk = latest(days, { $0.walkHr }, allowYesterday: true)
        guard sleep != nil || hrv != nil || rhr != nil || rr != nil else { return nil }

        var signals: [Signal] = []
        if let sleep {
            let short = sleep.usual.map { abs(sleep.value - $0) >= 30 } ?? false
            signals.append(Signal(
                tone: sleepTone(sleep.value, sleep.usual),
                text: short
                    ? "Slept \(sleepText(sleep.value)), \(sleep.value < sleep.usual! ? "short of" : "over") your usual \(sleepText(sleep.usual!))"
                    : "Slept \(sleepText(sleep.value))",
                training: false
            ))
        }
        if let hrv {
            let reading = "HRV \(Int(hrv.value.rounded())) ms\(hrv.yesterday ? " yesterday" : "")"
            var text = "\(reading), still learning your usual"
            if let usual = hrv.usual, usual > 0 {
                let pct = Int(((hrv.value - usual) / usual * 100).rounded())
                text = abs(pct) < 5
                    ? "\(reading), right on your usual"
                    : "\(reading), \(abs(pct))% \(pct < 0 ? "under" : "over") your usual \(Int(usual.rounded()))"
            }
            signals.append(Signal(tone: hrvTone(hrv.value, hrv.usual), text: text, training: false))
        }
        if let rhr {
            let reading = "Resting heart rate \(Int(rhr.value.rounded()))\(rhr.yesterday ? " yesterday" : "")"
            let over = rhr.usual.map { Int((rhr.value - $0).rounded()) } ?? 0
            signals.append(Signal(
                tone: overTone(rhr.value, rhr.usual, poor: 5, fair: 2),
                text: over == 0
                    ? reading
                    : "\(reading), \(abs(over)) \(over > 0 ? "over" : "under") your usual",
                training: false
            ))
        }
        if let rr {
            let over = rr.usual.map { rr.value - $0 } ?? 0
            signals.append(Signal(
                tone: overTone(rr.value, rr.usual, poor: 1.5, fair: 0.8),
                text: rr.usual == nil || abs(over) < 0.5
                    ? "Breathing \(one(rr.value)) a minute asleep"
                    : "Breathing \(one(rr.value)) a minute asleep, \(over > 0 ? "up" : "down") from \(one(rr.usual!))",
                training: false
            ))
        }
        if let walk {
            let tone = overTone(walk.value, walk.usual, poor: 8, fair: 5)
            if tone != .good {
                signals.append(Signal(
                    tone: tone,
                    text: "Walking heart rate \(Int(walk.value.rounded()))\(walk.yesterday ? " yesterday" : ""), \(Int((walk.value - (walk.usual ?? walk.value)).rounded())) over your usual",
                    training: false
                ))
            }
        }

        // The training, as Home last worked it out.
        let nowMs = today.timeIntervalSince1970 * 1000
        if let load {
            if let at = load.lastHeavyAt, let title = load.lastHeavyTitle {
                let hours = (nowMs - at) / 3_600_000
                if hours >= 0 && hours < 24 * 7 {
                    signals.append(Signal(
                        tone: hours < 24 ? .fair : .good,
                        text: "Last heavy session \(ago(hours)): \(title), \(load.lastHeavySets ?? 0) sets",
                        training: true
                    ))
                }
            }
            // The three-day count only holds for a day or so after Home said it.
            if let usual = load.usualSets, usual > 0, load.recentSets > 0, nowMs - load.at < 36 * 3_600_000 {
                let ratio = Double(load.recentSets) / usual
                if ratio > 1.3 {
                    signals.append(Signal(
                        tone: ratio > 1.6 ? .poor : .fair,
                        text: "\(load.recentSets) sets in 3 days, \(one(ratio))× your usual",
                        training: true
                    ))
                }
            }
            if load.streakDays >= 5, nowMs - load.at < 36 * 3_600_000 {
                signals.append(Signal(tone: .fair, text: "\(load.streakDays) days in a row of training", training: true))
            }
        }
        // The last strength workout's heart against the ones before it.
        let strength = workouts.filter { $0.kind == "strength" && $0.avgHr != nil && $0.end <= today }
            .sorted { $0.end > $1.end }
        if let last = strength.first, let avg = last.avgHr,
           let usual = median(strength.dropFirst().compactMap(\.avgHr), min: 3) {
            let hours = today.timeIntervalSince(last.end) / 3600
            if hours < 48 {
                let over = avg - usual
                let tone: Tone = hours < 36 && over > 15 ? .poor : hours < 36 && over > 8 ? .fair : .good
                signals.append(Signal(
                    tone: tone,
                    text: abs(over) < 3
                        ? "Last workout averaged \(Int(avg)) bpm, as usual"
                        : "Last workout averaged \(Int(avg)) bpm, \(Int(abs(over).rounded())) \(over > 0 ? "over" : "under") your usual",
                    training: true
                ))
            }
        }

        let poor = signals.filter { $0.tone == .poor }.count
        let fair = signals.filter { $0.tone == .fair }.count
        let called = poor >= 2 || poor + fair >= 3 ? "easy" : poor + fair > 0 ? "steady" : "ready"
        // Ready means read against a usual and found good, not just nothing to say.
        let baselined = [sleep?.usual, hrv?.usual, rhr?.usual, rr?.usual].contains { $0 != nil }
        let learning = called == "ready" && !baselined
        let verdict = learning ? "steady" : called
        let ordered = signals.enumerated()
            .sorted { ($0.element.tone.rawValue, $0.offset) < ($1.element.tone.rawValue, $1.offset) }
            .map(\.element)
        let off = ordered.filter { $0.tone != .good }
        let trainingLed = !off.isEmpty && off.filter(\.training).count * 2 >= off.count
        let heavyBehind = load?.lastHeavyAt.map { nowMs - $0 >= 48 * 3_600_000 } ?? false

        let headline = learning
            ? "Learning your usual"
            : ["ready": "Ready to push", "steady": "Train as planned", "easy": "Go lighter today"][verdict]!
        let advice: String
        switch learning ? "learning" : verdict {
        case "learning":
            advice = "Fatty needs about a week of nights with your Apple Watch to know your usual. Until then, train as planned."
        case "ready":
            advice = heavyBehind
                ? "You've recovered well and the last heavy day is behind you. A good day to go after a record."
                : "You've recovered well. A good day to go after a record."
        case "steady":
            advice = trainingLed
                ? "You're still carrying the last few sessions. Do the work, but save the records for another day."
                : "Not quite at your best. Do the work, but leave the records for another day."
        default:
            advice = trainingLed
                ? "Your training's run ahead of your recovery. Drop a set per exercise or take 10% off."
                : "Your body's still recovering. Drop a set per exercise or take 10% off."
        }

        return RecoveryCache(
            date: RecoveryCache.dayKey(today),
            verdict: verdict,
            headline: headline,
            sleepMin: sleep?.value,
            hrv: hrv?.value,
            rhr: rhr?.value,
            advice: advice,
            reasons: ordered.prefix(4).map(\.text),
            hrvTrend: days.suffix(14).map(\.hrv),
            readAt: today.timeIntervalSince1970
        )
    }
}

/// Keeps the Recovery widget and the watch current: reads Health, makes the
/// call with the training Home last handed over, stores it for the widget
/// and sends it to the watch. Runs when the app comes forward, when Home
/// asks for the readings, and in a background refresh about every hour
/// (iOS picks the moment; it learns when the app gets used).
enum RecoveryRefresher {
    static let taskId = "com.kkrwhofrags.hellblazer.recovery"

    /// Whether there was anything to make a call from.
    @discardableResult
    static func refresh(
        store: HKHealthStore = HKHealthStore(),
        days: [RecoveryReadings.Day]? = nil,
        workouts: [RecoveryReadings.Workout]? = nil
    ) async -> Bool {
        // Signed out: nothing for the widget or a watch until someone's in.
        guard HKHealthStore.isHealthDataAvailable(), WidgetRefresher.linkedUserId != nil else { return false }
        let readings: [RecoveryReadings.Day]
        if let days { readings = days } else { readings = await RecoveryReadings.read(store) }
        let recent: [RecoveryReadings.Workout]
        if let workouts { recent = workouts } else { recent = await RecoveryReadings.workouts(store) }
        defer { schedule() }
        guard let call = RecoveryCall.assess(readings, workouts: recent) else { return false }
        call.save()
        WidgetCenter.shared.reloadTimelines(ofKind: RecoveryCache.widgetKind)
        WatchBridge.shared.sendRecovery()
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

    /// Asks for the next run in an hour: the night's sleep lands by the
    /// morning, HRV and heart rates through the day.
    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: taskId)
        request.earliestBeginDate = Date().addingTimeInterval(60 * 60)
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
