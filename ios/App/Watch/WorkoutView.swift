import SwiftUI
import WatchKit

/// The workout on the wrist, two pages like Apple's Workout app: swipe right
/// for the controls (time, heart rate, undo, end), left to log. While
/// resting, the log page is the countdown.
struct WorkoutView: View {
    @EnvironmentObject private var model: WatchModel
    let workout: Workout
    @State private var page = 1

    var body: some View {
        TabView(selection: $page) {
            ControlsPage(workout: workout)
                .tag(0)
            Group {
                if let rest = model.rest {
                    RestPage(rest: rest)
                } else if let exercise = model.currentExercise() {
                    LoggerPage(workout: workout, exercise: exercise)
                } else {
                    Text("No exercises yet. Add some in Fatty on your iPhone.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
            }
            .tag(1)
        }
        .tabViewStyle(.page)
    }
}

// MARK: Logging

private struct LoggerPage: View {
    @EnvironmentObject private var model: WatchModel
    let workout: Workout
    let exercise: Exercise

    private enum Field { case weight, reps }

    @State private var weight: Double = 0
    @State private var reps: Double = 0
    @State private var seeded: String?
    @State private var picking = false
    @FocusState private var focus: Field?

    /// Changes whenever the numbers should be refilled: a new exercise, or
    /// a set logged (copy-forward from it).
    private var seedKey: String { "\(exercise.id)#\(exercise.sets.count)" }

    var body: some View {
        VStack(spacing: 6) {
            Button {
                picking = true
            } label: {
                VStack(spacing: 1) {
                    Text(exercise.name)
                        .font(.headline)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text(setLabel)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)

            HStack(spacing: 4) {
                number(trim(weight), unit: model.unit, field: .weight, value: $weight, through: 999, by: model.weightStep)
                Text("×")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                number(String(Int(reps)), unit: "reps", field: .reps, value: $reps, through: 100, by: 1)
            }

            if let hint = lastHint {
                Text(hint)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Button {
                model.log(exerciseId: exercise.id, weight: weight, reps: Int(reps))
            } label: {
                Text("Log set")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(model.accent)
            .disabled(reps < 1)
        }
        .onAppear(perform: seedIfNeeded)
        .onChange(of: seedKey) { _, _ in seedIfNeeded() }
        .sheet(isPresented: $picking) {
            NavigationStack {
                ExercisePicker(workout: workout)
            }
        }
    }

    /// A big number the crown turns once it's tapped (weight is first).
    private func number(
        _ text: String,
        unit: String,
        field: Field,
        value: Binding<Double>,
        through max: Double,
        by step: Double
    ) -> some View {
        VStack(spacing: 0) {
            Text(text)
                .font(.system(.title2, design: .rounded).weight(.semibold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(unit)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.white.opacity(focus == field ? 0.14 : 0.06))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(focus == field ? model.accent : .clear, lineWidth: 2)
        )
        .focusable()
        .digitalCrownRotation(
            value, from: 0, through: max, by: step,
            sensitivity: field == .reps ? .low : .medium,
            isContinuous: false, isHapticFeedbackEnabled: true
        )
        .focused($focus, equals: field)
        .focusEffectDisabled()
        .onTapGesture { focus = field }
    }

    private var setLabel: String {
        let next = exercise.workingSets.count + 1
        var label = exercise.targetSets.map { "Set \(next) of \($0)" } ?? "Set \(next)"
        if let reps = exercise.targetReps, !reps.isEmpty { label += " · \(reps)" }
        return label
    }

    /// "Last time 60 × 5": the same set from the last session.
    private var lastHint: String? {
        guard let past = pastSet else { return nil }
        return "Last time \(trim(past.weight)) × \(past.reps)"
    }

    /// Last session's set in this position, else its final one.
    private var pastSet: PastSet? {
        let done = exercise.workingSets.count
        return done < exercise.last.count ? exercise.last[done] : exercise.last.last
    }

    /// Copy-forward: this session's last set, else the same set last time,
    /// else the bottom of the target rep range.
    private func seedIfNeeded() {
        guard seeded != seedKey else { return }
        seeded = seedKey
        if let previous = exercise.sets.max(by: { $0.n < $1.n }) {
            weight = previous.weight
            reps = Double(previous.reps)
        } else if let past = pastSet {
            weight = past.weight
            reps = Double(past.reps)
        } else {
            weight = 0
            reps = Double(exercise.targetReps.flatMap { Int($0.prefix { $0.isNumber }) } ?? 8)
        }
        if focus == nil { focus = .weight }
    }
}

private func trim(_ value: Double) -> String {
    value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
}

private struct ExercisePicker: View {
    @EnvironmentObject private var model: WatchModel
    @Environment(\.dismiss) private var dismiss
    let workout: Workout

    var body: some View {
        List(workout.exercises) { exercise in
            Button {
                model.selectedExerciseId = exercise.id
                dismiss()
            } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(exercise.name)
                        .lineLimit(2)
                    Text(progress(exercise))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Exercises")
    }

    private func progress(_ exercise: Exercise) -> String {
        let done = exercise.workingSets.count
        if let target = exercise.targetSets { return "\(done) of \(target) sets" }
        return done == 0 ? "Not started" : "\(done) \(done == 1 ? "set" : "sets")"
    }
}

// MARK: Rest

private struct RestPage: View {
    @EnvironmentObject private var model: WatchModel
    let rest: WatchModel.Rest

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let left = max(0, rest.endsAt.timeIntervalSince(context.date))
            VStack(spacing: 8) {
                ZStack {
                    Circle()
                        .stroke(Color.white.opacity(0.12), lineWidth: 7)
                    Circle()
                        .trim(from: 0, to: rest.total > 0 ? min(1, left / rest.total) : 0)
                        .stroke(model.accent, style: StrokeStyle(lineWidth: 7, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 0) {
                        Text(clock(left))
                            .font(.system(size: 30, weight: .semibold, design: .rounded))
                            .monospacedDigit()
                        Text("Rest")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal, 18)
                HStack(spacing: 6) {
                    Button("+30s") { model.extendRest(by: 30) }
                    Button("Skip") { model.skipRest() }
                }
                .font(.footnote.weight(.semibold))
            }
        }
    }

    private func clock(_ seconds: Double) -> String {
        let total = Int(seconds.rounded(.up))
        return "\(total / 60):" + String(format: "%02d", total % 60)
    }
}

// MARK: Controls

private struct ControlsPage: View {
    @EnvironmentObject private var model: WatchModel
    @ObservedObject private var recorder = WorkoutRecorder.shared
    let workout: Workout
    @State private var confirmEnd = false

    private var working: [LoggedSet] { workout.exercises.flatMap(\.workingSets) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text(workout.title)
                    .font(.headline)
                    .lineLimit(2)
                Text(workout.startDate, style: .timer)
                    .font(.system(.title2, design: .rounded).weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(.tint)
                HStack(spacing: 12) {
                    Label(recorder.heartRate.map { "\(Int($0.rounded()))" } ?? "--", systemImage: "heart.fill")
                        .foregroundStyle(.red)
                    Label(recorder.calories.map { "\(Int($0.rounded())) kcal" } ?? "-- kcal", systemImage: "flame.fill")
                        .foregroundStyle(.orange)
                }
                .font(.footnote.weight(.semibold))
                Text("\(working.count) \(working.count == 1 ? "set" : "sets") · \(volume)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                Button {
                    Task { await model.undoLast() }
                } label: {
                    Label("Undo last set", systemImage: "arrow.uturn.backward")
                        .frame(maxWidth: .infinity)
                }
                .disabled(working.isEmpty || model.busy)

                Button(role: .destructive) {
                    confirmEnd = true
                } label: {
                    Label("End workout", systemImage: "xmark")
                        .frame(maxWidth: .infinity)
                }
                .disabled(model.busy)

                if let problem = model.problem {
                    Text(problem)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
        }
        .confirmationDialog("End this workout?", isPresented: $confirmEnd, titleVisibility: .visible) {
            Button("End and save") {
                Task { await model.finish() }
            }
            Button("Keep going", role: .cancel) {}
        }
    }

    private var volume: String {
        let total = working.reduce(0) { $0 + $1.weight * Double($1.reps) }
        return "\(Int(total.rounded()).formatted()) \(model.unit)"
    }
}
