import Foundation
import HealthKit
#if canImport(FoundationModels)
import FoundationModels
#endif

/// A finished workout's heart rate, for the heart-rate read on the session
/// page (src/components/workout/heart-card.tsx): the Apple Watch's readings
/// from Health, and the lifter's resting heart rate. They go to the page in
/// the app's own web view and nowhere else; the analysis is
/// src/lib/heart-insights.ts. Asked for on its own sheet, so Recovery's
/// connection isn't asked again.
enum WorkoutHeartRate {
    static let heartRate = HKQuantityType(.heartRate)
    static let restingHeartRate = HKQuantityType(.restingHeartRate)
    private static let bpm = HKUnit.count().unitDivided(by: .minute())

    private static var readTypes: Set<HKObjectType> { [heartRate, restingHeartRate] }

    /// Whether Health's sheet still has heart rate to ask about.
    static func shouldRequest(_ store: HKHealthStore) async -> Bool {
        await withCheckedContinuation { continuation in
            store.getRequestStatusForAuthorization(toShare: [], read: readTypes) { status, _ in
                continuation.resume(returning: status == .shouldRequest)
            }
        }
    }

    static func request(_ store: HKHealthStore) async {
        try? await store.requestAuthorization(toShare: [], read: readTypes)
    }

    /// The average reading in each five seconds from `start` to `end`, oldest
    /// first, as `t` (epoch ms) and `bpm`. Statistics rather than samples, so
    /// a watch's series of readings in one sample is counted properly.
    static func readings(from start: Date, to end: Date, store: HKHealthStore) async -> [[String: Double]] {
        let descriptor = HKStatisticsCollectionQueryDescriptor(
            predicate: .quantitySample(type: heartRate, predicate: HKQuery.predicateForSamples(withStart: start, end: end)),
            options: .discreteAverage,
            anchorDate: start,
            intervalComponents: DateComponents(second: 5)
        )
        guard let collection = try? await descriptor.result(for: store) else { return [] }
        var out: [[String: Double]] = []
        collection.enumerateStatistics(from: start, to: end) { statistics, _ in
            guard let value = statistics.averageQuantity()?.doubleValue(for: bpm) else { return }
            out.append(["t": statistics.startDate.timeIntervalSince1970 * 1000, "bpm": value.rounded()])
        }
        return out
    }

    /// The latest resting heart rate from the fortnight before `date`.
    static func resting(before date: Date, store: HKHealthStore) async -> Double? {
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.quantitySample(
                type: restingHeartRate,
                predicate: HKQuery.predicateForSamples(withStart: date.addingTimeInterval(-14 * 86_400), end: date)
            )],
            sortDescriptors: [SortDescriptor(\.endDate, order: .reverse)],
            limit: 1
        )
        guard let sample = try? await descriptor.result(for: store).first else { return nil }
        return sample.quantity.doubleValue(for: bpm).rounded()
    }
}

/// Two sentences about the workout's heart rate, written on the phone by
/// Apple's on-device model from facts the page worked out (heartFacts in
/// heart-insights.ts): it rewords them, it doesn't read the heart rate.
enum HeartSummary {
    enum WriteError: Error {
        case unavailable
        case failed
    }

    static func write(_ facts: String) async throws -> String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            guard SetReader.available else { throw WriteError.unavailable }
            do {
                let text = try await ModelHeartSummary.write(facts)
                guard !text.isEmpty else { throw WriteError.failed }
                return text
            } catch {
                throw WriteError.failed
            }
        }
        #endif
        throw WriteError.unavailable
    }
}

#if canImport(FoundationModels)

@available(iOS 26.0, *)
enum ModelHeartSummary {
    static func write(_ facts: String) async throws -> String {
        let session = LanguageModelSession(instructions: """
        You sum up a lifter's workout from heart-rate facts their Apple Watch measured. \
        Write two short sentences, at most 40 words, speaking to the lifter as "you", \
        like a coach in their corner: direct and a little fired up. \
        Use only the facts given, with every number exactly as written. \
        Lead with the hardest exercise, then the single most telling of the rest. \
        No health or medical advice, no greetings, no emoji, no lists.
        """)
        let response = try await session.respond(
            to: facts,
            options: GenerationOptions(sampling: .greedy, maximumResponseTokens: 120)
        )
        return response.content.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

#endif
