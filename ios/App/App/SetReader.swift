import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Sets said in the lifter's own words ("3 sets of 8 at 80 on incline, last
/// one was a grinder"), read on the phone by Apple's on-device model, for the
/// logger's "Say it" and for "Log a set" to Siri. Nothing leaves the phone to
/// be read, and it works with no signal.
///
/// The model only pulls out what was said, run by run of like sets; which
/// exercise it means, the numbers left out and every limit are decided by
/// src/lib/spoken-sets.ts (on the page, and on the server for Siri).
///
/// Only where Apple's model runs: an iPhone 15 Pro or newer, on iOS 26, with
/// Apple Intelligence on. Everywhere else it says so and nothing offers it.
enum SetReader {
    enum ReadError: Error {
        case unavailable
        case failed
    }

    /// "available", or why not: "ineligible" (an iPhone before the 15 Pro),
    /// "off" (Apple Intelligence is off in Settings), "downloading" (the
    /// model isn't on the phone yet), "unsupported" (before iOS 26).
    static var status: String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            switch SystemLanguageModel.default.availability {
            case .available:
                return "available"
            case .unavailable(let reason):
                switch reason {
                case .deviceNotEligible: return "ineligible"
                case .appleIntelligenceNotEnabled: return "off"
                case .modelNotReady: return "downloading"
                @unknown default: return "unavailable"
                }
            }
        }
        #endif
        return "unsupported"
    }

    static var available: Bool { status == "available" }

    /// The runs of like sets in `text`, as spoken-sets.ts's HeardGroup
    /// (a number that wasn't said is left out). `exercises` is the workout's,
    /// for the model to name them as the workout does.
    static func read(_ text: String, exercises: [String], unit: String) async throws -> [[String: Any]] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            guard available else { throw ReadError.unavailable }
            do {
                return try await ModelSetReader.read(text, exercises: exercises, unit: unit)
            } catch {
                throw ReadError.failed
            }
        }
        #endif
        throw ReadError.unavailable
    }
}

#if canImport(FoundationModels)

/// What the model fills in. Zero stands for "not said": a small model keeps
/// to a fixed shape better than it leaves things out.
@available(iOS 26.0, *)
@Generable
struct HeardSets {
    @Guide(description: "Each run of like sets, in the order the lifter said them", .maximumCount(12))
    var runs: [HeardRun]
}

@available(iOS 26.0, *)
@Generable
struct HeardRun {
    @Guide(description: "The exercise, written as in today's list when it's one of those, else in the lifter's words. Empty when they didn't say which.")
    var exercise: String

    @Guide(description: "How many sets in this run", .range(1...10))
    var sets: Int

    @Guide(description: "Reps in each set. 0 when they didn't say.", .range(0...100))
    var reps: Int

    @Guide(description: "The weight of each set, the number they said. 0 when they didn't say a weight.")
    var weight: Double

    @Guide(description: "The unit said with the weight", .anyOf(["kg", "lb", "none"]))
    var unit: String

    @Guide(description: "How hard it was, out of 10. 0 when they didn't say.", .range(0...10))
    var rpe: Double

    @Guide(description: "Whether these were warm-up sets")
    var warmup: Bool
}

@available(iOS 26.0, *)
enum ModelSetReader {
    static func read(_ text: String, exercises: [String], unit: String) async throws -> [[String: Any]] {
        let session = LanguageModelSession(instructions: instructions(exercises: exercises, unit: unit))
        let response = try await session.respond(
            to: text,
            generating: HeardSets.self,
            options: GenerationOptions(sampling: .greedy)
        )
        return response.content.runs.map { run in
            var out: [String: Any] = ["sets": run.sets, "warmup": run.warmup]
            let name = run.exercise.trimmingCharacters(in: .whitespacesAndNewlines)
            if !name.isEmpty { out["exercise"] = name }
            if run.reps > 0 { out["reps"] = run.reps }
            if run.weight > 0 { out["weight"] = run.weight }
            if run.unit == "kg" || run.unit == "lb" { out["unit"] = run.unit }
            if run.rpe > 0 { out["rpe"] = run.rpe }
            return out
        }
    }

    private static func instructions(exercises: [String], unit: String) -> String {
        let list = exercises.isEmpty ? "(not known)" : exercises.map { "- \($0)" }.joined(separator: "\n")
        return """
        You write down the sets a lifter says they just did at the gym. Their weights are in \(unit) unless they say kg or lb.

        Today's exercises:
        \(list)

        How to write them down:
        - A run is sets with the same exercise, reps, weight and effort. "3 sets of 8 at 80" is one run of 3 sets of 8 reps at 80.
        - A set that was different gets its own run. "3 sets of 8 at 80, the last one was a grinder" is a run of 2 sets of 8 at 80, then a run of 1 set of 8 at 80 with effort 9.
        - "80 for 8", "8 at 80" and "8 reps with 80" are all 8 reps at 80. "3x8 at 80" and "3 by 8 at 80" are 3 sets of 8 reps at 80.
        - Write the exercise as it's written in today's list when they mean one of those. Leave it empty when they don't say which.
        - Effort: failure or nothing left is 10, a grinder or one left is 9, two left is 8, moderate is 7, easy is 6. 0 when they don't say how it felt.
        - Write 0 for any reps or weight they don't say. Never make numbers up.
        """
    }
}

#endif
