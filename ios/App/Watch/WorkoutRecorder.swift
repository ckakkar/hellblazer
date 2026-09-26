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
        let read: Set<HKObjectType> = [HKQuantityType(.heartRate), HKQuantityType(.activeEnergyBurned)]
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
            if let bpm { self.heartRate = bpm }
            if let kcal { self.calories = kcal }
        }
    }
}
