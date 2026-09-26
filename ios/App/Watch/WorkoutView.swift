import SwiftUI
import WatchKit

/// The workout on the wrist, paged like Apple's Workout app: swipe right for
/// the controls, left for the metrics and then Now Playing. It opens on the
/// logger, since logging sets is the job; while resting, that page is the
/// rest countdown.
struct WorkoutView: View {
    @EnvironmentObject private var model: WatchModel
    let workout: Workout
    @State private var page = Page.log

    enum Page { case controls, log, metrics, media }

    var body: some View {
        TabView(selection: $page) {
            ControlsPage(workout: workout, page: $page)
                .tag(Page.controls)
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
            .tag(Page.log)
            MetricsPage(workout: workout)
                .tag(Page.metrics)
            NowPlayingView()
                .tag(Page.media)
        }
        .tabViewStyle(.page)
    }
}

/// Workout's colours: time in yellow, heart rate in red, energy in pink.
private enum Metric {
    static let time = Color.yellow
    static let heart = Color.red
    static let energy = Color(red: 1, green: 0.25, blue: 0.45)
}

/// Time recorded so far: Health's clock (which stops while paused) when
/// recording, else since the session started.
private func elapsed(_ workout: Workout, at date: Date) -> TimeInterval {
    WorkoutRecorder.shared.elapsed(at: date) ?? date.timeIntervalSince(workout.startDate)
}

/// "12:34.56" (or "1:02:03" past the hour), hundredths when the screen's awake.
private func stopwatch(_ seconds: TimeInterval, hundredths: Bool) -> String {
    let t = max(0, seconds)
    let whole = Int(t)
    if whole >= 3600 || !hundredths { return clock(t) }
    let centi = Int((t - Double(whole)) * 100)
    return String(format: "%d:%02d.%02d", whole / 60, whole % 60, centi)
}

// MARK: Logging

private struct LoggerPage: View {
    @EnvironmentObject private var model: WatchModel
    @ObservedObject private var recorder = WorkoutRecorder.shared
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
        VStack(alignment: .leading, spacing: 4) {
            // The Workout app's top line: the clock, and your heart rate.
            HStack(alignment: .firstTextBaseline) {
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    Text(clock(elapsed(workout, at: context.date)))
                        .font(.system(size: 16, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(recorder.paused ? Metric.time.opacity(0.5) : Metric.time)
                }
                Spacer(minLength: 4)
                if let bpm = recorder.heartRate {
                    HStack(spacing: 2) {
                        Text("\(Int(bpm.rounded()))")
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                            .monospacedDigit()
                        Image(systemName: "heart.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(Metric.heart)
                    }
                }
            }

            Button {
                picking = true
            } label: {
                VStack(alignment: .leading, spacing: 0) {
                    Text(exercise.name)
                        .font(.system(.headline, design: .rounded))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text(setLabel)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)

            HStack(spacing: 4) {
                number(trim(weight), unit: model.unit, field: .weight, value: $weight, through: 999, by: model.weightStep)
                Text("×")
                    .font(.system(.title3, design: .rounded))
                    .foregroundStyle(.secondary)
                number(String(Int(reps)), unit: "reps", field: .reps, value: $reps, through: 100, by: 1)
            }

            Button {
                model.log(exerciseId: exercise.id, weight: weight, reps: Int(reps))
            } label: {
                Text("Log Set")
                    .font(.system(.headline, design: .rounded))
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
                .font(.system(size: 26, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(unit.uppercased())
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.white.opacity(focus == field ? 0.16 : 0.07))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
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

    /// "Set 3 of 4 · last 60×5" (or the target reps before any history).
    private var setLabel: String {
        let next = exercise.workingSets.count + 1
        var label = exercise.targetSets.map { "Set \(next) of \($0)" } ?? "Set \(next)"
        if let past = pastSet {
            label += " · last \(trim(past.weight))×\(past.reps)"
        } else if let reps = exercise.targetReps, !reps.isEmpty {
            label += " · \(reps)"
        }
        return label
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
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(exercise.name)
                            .lineLimit(2)
                        Text(progress(exercise))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 4)
                    if exercise.id == model.currentExercise()?.id {
                        Image(systemName: "checkmark")
                            .foregroundStyle(model.accent)
                    }
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

/// The rest countdown: a ring as large as the screen allows, the time and
/// label sized to sit inside it on any watch (the first SE's 40 mm included),
/// what's next underneath, and slim +30s and Skip buttons.
private struct RestPage: View {
    @EnvironmentObject private var model: WatchModel
    let rest: WatchModel.Rest

    private let buttonHeight: CGFloat = 34

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let left = max(0, rest.endsAt.timeIntervalSince(context.date))
            GeometryReader { geo in
                let next = model.currentExercise()?.name
                // Whatever the label and buttons leave, the ring takes, keeping
                // clear of the page dots at the bottom.
                let reserved = buttonHeight + 10 + (next == nil ? 6 : 26)
                let ring = max(60, min(geo.size.width, geo.size.height - reserved))
                let stroke = ring * 0.085
                VStack(spacing: 6) {
                    ZStack {
                        Circle()
                            .stroke(model.accent.opacity(0.22), lineWidth: stroke)
                        Circle()
                            .trim(from: 0, to: rest.total > 0 ? min(1, left / rest.total) : 0)
                            .stroke(model.accent, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                            .animation(.linear(duration: 1), value: left)
                        VStack(spacing: ring * 0.01) {
                            Text("REST")
                                .font(.system(size: ring * 0.1, weight: .bold, design: .rounded))
                                .foregroundStyle(.secondary)
                            Text(clock(left.rounded(.up)))
                                .font(.system(size: ring * 0.27, weight: .semibold, design: .rounded))
                                .monospacedDigit()
                                .lineLimit(1)
                                .minimumScaleFactor(0.5)
                                .contentTransition(.numericText(countsDown: true))
                        }
                        // Inside the ring's hole, never on the ring.
                        .padding(stroke + ring * 0.1)
                    }
                    .frame(width: ring, height: ring)

                    if let next {
                        Text("Next: \(next)")
                            .font(.system(.footnote, design: .rounded))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }

                    HStack(spacing: 6) {
                        restButton("+30s") { model.extendRest(by: 30) }
                        restButton("Skip") { model.skipRest() }
                    }
                }
                .frame(width: geo.size.width, height: geo.size.height, alignment: .top)
            }
        }
    }

    private func restButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(.footnote, design: .rounded).weight(.semibold))
                .frame(maxWidth: .infinity, minHeight: buttonHeight)
                .background(Color.white.opacity(0.14), in: Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: Metrics

/// The Workout app's metrics: the running clock with hundredths in yellow,
/// then energy, heart rate, and the lifting totals.
private struct MetricsPage: View {
    @EnvironmentObject private var model: WatchModel
    @ObservedObject private var recorder = WorkoutRecorder.shared
    @Environment(\.isLuminanceReduced) private var dimmed
    let workout: Workout

    private var working: [LoggedSet] { workout.exercises.flatMap(\.workingSets) }

    var body: some View {
        TimelineView(.periodic(from: .now, by: dimmed ? 1 : 0.05)) { context in
            VStack(alignment: .leading, spacing: 1) {
                Text(stopwatch(elapsed(workout, at: context.date), hundredths: !dimmed && !recorder.paused))
                    .font(.system(size: 32, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Metric.time)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                if recorder.paused {
                    Text("PAUSED")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundStyle(Metric.time)
                }
                metric(recorder.calories.map { "\(Int($0.rounded()))" } ?? "--", unit: "ACTIVE CAL")
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    metric(recorder.heartRate.map { "\(Int($0.rounded()))" } ?? "--", unit: "BPM")
                    Image(systemName: "heart.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(Metric.heart)
                }
                metric("\(working.count)", unit: working.count == 1 ? "SET" : "SETS")
                metric(
                    Int(working.reduce(0) { $0 + $1.weight * Double($1.reps) }.rounded()).formatted(),
                    unit: model.unit.uppercased()
                )
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func metric(_ value: String, unit: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(value)
                .font(.system(size: 24, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(unit)
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: Controls

/// Workout's controls: big rounded buttons, each labelled underneath.
private struct ControlsPage: View {
    @EnvironmentObject private var model: WatchModel
    @ObservedObject private var recorder = WorkoutRecorder.shared
    let workout: Workout
    @Binding var page: WorkoutView.Page
    @State private var picking = false

    var body: some View {
        VStack(spacing: 8) {
            Text(workout.title)
                .font(.system(.footnote, design: .rounded).weight(.semibold))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            Grid(horizontalSpacing: 8, verticalSpacing: 8) {
                GridRow {
                    control("End", symbol: "xmark", color: .red) {
                        Task { await model.finish() }
                    }
                    .disabled(model.busy)
                    if recorder.paused {
                        control("Resume", symbol: "arrow.clockwise", color: .green) {
                            recorder.resume()
                            WKInterfaceDevice.current().play(.start)
                            page = .metrics
                        }
                    } else {
                        control("Pause", symbol: "pause.fill", color: .yellow) {
                            recorder.pause()
                            WKInterfaceDevice.current().play(.stop)
                        }
                        .disabled(!recorder.isRecording)
                    }
                }
                GridRow {
                    control("Undo Set", symbol: "arrow.uturn.backward", color: .white) {
                        Task { await model.undoLast() }
                        page = .log
                    }
                    .disabled(workout.exercises.allSatisfy { $0.sets.isEmpty } || model.busy)
                    control("Exercises", symbol: "list.bullet", color: .white) {
                        picking = true
                    }
                }
            }
            if let problem = model.problem {
                Text(problem)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .lineLimit(2)
            }
        }
        .sheet(isPresented: $picking) {
            NavigationStack {
                ExercisePicker(workout: workout)
            }
        }
        .onChange(of: model.selectedExerciseId) { _, _ in
            // Picked an exercise from here: go log it.
            if picking { page = .log }
        }
    }

    private func control(_ title: String, symbol: String, color: Color, action: @escaping () -> Void) -> some View {
        VStack(spacing: 3) {
            Button(action: action) {
                Image(systemName: symbol)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(color)
                    .frame(maxWidth: .infinity, minHeight: 46)
                    .background(color.opacity(0.22), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .buttonStyle(.plain)
            Text(title)
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .lineLimit(1)
        }
    }
}
