import Foundation
import HealthKit

/// Records the workout to Apple Health from the wrist: a strength-training
/// workout session, which also keeps Fatty on screen when you raise your
/// wrist, with live heart rate and calories. When the workout finishes it's
/// saved to Health; the phone then skips its own copy (WatchBridge).
final class WorkoutRecorder: NSObject, ObservableObject, HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate {
    static let shared = WorkoutRecorder()

    private let store = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?

    /// Beats per minute, most recent.
    @Published private(set) var heartRate: Double?
    /// Active kilocalories so far.
    @Published private(set) var calories: Double?
    /// The Fatty session being recorded.
    @Published private(set) var sessionId: String?
    /// Paused from the controls: the clock and Health recording stop.
    @Published private(set) var paused = false

    var isRecording: Bool { session != nil }

    /// The heart rate the iPhone last heard, and when.
    private var sentHeartRate: (bpm: Int, at: Date)?
    /// The last minute's readings, for a rest's peak.
    private var recentHeartRates: [(at: Date, bpm: Double)] = []
    /// Health's latest resting heart rate, looked up when recording starts.
    private(set) var restingHeartRate: Double?

    /// The highest reading in the last `seconds`: the set just done.
    func peakHeartRate(within seconds: TimeInterval = 30) -> Double? {
        let since = Date().addingTimeInterval(-seconds)
        return recentHeartRates.filter { $0.at >= since }.map { $0.bpm }.max()
    }

    /// A workout started offline got its server id: Health's copy and the
    /// phone go by that one now.
    @MainActor
    func retag(_ id: String) {
        guard let builder, sessionId != id else { return }
        sessionId = id
        builder.addMetadata([HKMetadataKeyExternalUUID: id]) { _, _ in }
        PhoneLink.shared.sendGuaranteed(["workoutStarted": id])
    }

    /// The newest resting heart rate from the last two weeks.
    private func loadRestingHeartRate() async {
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.quantitySample(
                type: HKQuantityType(.restingHeartRate),
                predicate: HKQuery.predicateForSamples(withStart: Date().addingTimeInterval(-14 * 86_400), end: Date())
            )],
            sortDescriptors: [SortDescriptor(\.endDate, order: .reverse)],
            limit: 1
        )
        let bpm = HKUnit.count().unitDivided(by: .minute())
        let value = try? await descriptor.result(for: store).first?.quantity.doubleValue(for: bpm)
        await MainActor.run { self.restingHeartRate = value }
    }

    /// Time recorded so far, pauses excluded; nil when not recording.
    func elapsed(at date: Date) -> TimeInterval? {
        builder?.elapsedTime(at: date)
    }

    /// What Health measured, for the summary at the end.
    struct Summary {
        var duration: TimeInterval
        var calories: Double?
        var averageHeartRate: Double?
    }

    private func authorize() async -> Bool {
        guard HKHealthStore.isHealthDataAvailable() else { return false }
        let share: Set<HKSampleType> = [HKObjectType.workoutType(), HKQuantityType(.activeEnergyBurned)]
        let read: Set<HKObjectType> = [
            HKQuantityType(.heartRate), HKQuantityType(.activeEnergyBurned), HKQuantityType(.restingHeartRate),
        ]
        do {
            try await store.requestAuthorization(toShare: share, read: read)
        } catch {
            return false
        }
        return store.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized
    }

    /// Starts recording a Fatty session, dated from when it began if that
    /// was recent (it may have started on the phone), else from now.
    @MainActor
    func start(for workout: Workout) async {
        guard session == nil, await authorize(), session == nil else { return }
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        configuration.locationType = .indoor
        do {
            let session = try HKWorkoutSession(healthStore: store, configuration: configuration)
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: configuration)
            session.delegate = self
            builder.delegate = self
            self.session = session
            self.builder = builder
            sessionId = workout.id
            heartRate = nil
            calories = nil
            paused = false

            let recent = Date().timeIntervalSince(workout.startDate) < 2 * 60 * 60
            let start = recent ? min(workout.startDate, Date()) : Date()
            session.startActivity(with: start)
            try await builder.beginCollection(at: start)
            Task { await loadRestingHeartRate() }
            try? await builder.addMetadata([
                HKMetadataKeyExternalUUID: workout.id,
                HKMetadataKeyIndoorWorkout: true,
            ])
            PhoneLink.shared.sendGuaranteed(["workoutStarted": workout.id])
        } catch {
            reset()
        }
    }

    @MainActor
    func pause() {
        session?.pause()
    }

    @MainActor
    func resume() {
        session?.resume()
    }

    /// Stops recording; saves the workout to Health unless `save` is false.
    /// Returns what was measured, for the summary.
    @MainActor
    @discardableResult
    func finish(save: Bool = true) async -> Summary? {
        guard let session, let builder else { return nil }
        let bpm = HKUnit.count().unitDivided(by: .minute())
        let summary = Summary(
            duration: builder.elapsedTime(at: Date()),
            calories: builder.statistics(for: HKQuantityType(.activeEnergyBurned))?.sumQuantity()?.doubleValue(for: .kilocalorie()),
            averageHeartRate: builder.statistics(for: HKQuantityType(.heartRate))?.averageQuantity()?.doubleValue(for: bpm)
        )
        session.end()
        do {
            try await builder.endCollection(at: Date())
            if save {
                _ = try await builder.finishWorkout()
            } else {
                builder.discardWorkout()
            }
        } catch {
            // Health said no; the sets are safe on the server regardless.
        }
        reset()
        return summary
    }

    @MainActor
    private func reset() {
        session = nil
        builder = nil
        sessionId = nil
        paused = false
        sentHeartRate = nil
        recentHeartRates = []
    }

    /// Live heart rate for the iPhone's Lock Screen and logger: on a change,
    /// at most every 5 seconds, and every 15 while it holds, so the phone can
    /// tell a steady reading from a stale one. Only while the phone's in reach.
    private func sendHeartRate(_ bpm: Double) {
        guard let sessionId else { return }
        let rounded = Int(bpm.rounded())
        let now = Date()
        if let last = sentHeartRate {
            let since = now.timeIntervalSince(last.at)
            guard since >= 15 || (rounded != last.bpm && since >= 5) else { return }
        }
        sentHeartRate = (rounded, now)
        PhoneLink.shared.sendIfReachable(["heartRate": rounded, "sessionId": sessionId])
    }

    // MARK: HKWorkoutSessionDelegate

    func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {
        DispatchQueue.main.async { self.paused = toState == .paused }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {}

    // MARK: HKLiveWorkoutBuilderDelegate

    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        let bpm = workoutBuilder.statistics(for: HKQuantityType(.heartRate))?
            .mostRecentQuantity()?
            .doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
        let kcal = workoutBuilder.statistics(for: HKQuantityType(.activeEnergyBurned))?
            .sumQuantity()?
            .doubleValue(for: .kilocalorie())
        DispatchQueue.main.async {
            if let bpm {
                self.heartRate = bpm
                let now = Date()
                self.recentHeartRates.append((now, bpm))
                self.recentHeartRates.removeAll { now.timeIntervalSince($0.at) > 60 }
                self.sendHeartRate(bpm)
            }
            if let kcal { self.calories = kcal }
        }
    }
}
