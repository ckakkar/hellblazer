import SwiftUI
import WatchKit

/// Laid out like Apple's Workout app: a list of workouts to start, a 3-2-1
/// countdown, the workout itself, and a summary at the end.
struct RootView: View {
    @EnvironmentObject private var model: WatchModel
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if model.token == nil {
                ConnectView()
            } else if let summary = model.summary {
                NavigationStack {
                    SummaryView(summary: summary)
                }
            } else if let option = model.starting {
                CountdownView(option: option)
            } else if let workout = model.state?.active {
                WorkoutView(workout: workout)
            } else if let state = model.state {
                NavigationStack {
                    StartView(state: state)
                }
            } else if let problem = model.problem {
                MessageView(
                    symbol: model.problemIsOffline ? "wifi.exclamationmark" : "exclamationmark.icloud",
                    title: model.problemIsOffline ? "Offline" : "Server problem",
                    message: problem
                ) {
                    Task { await model.refresh() }
                }
            } else {
                ProgressView()
            }
        }
        .onChange(of: scenePhase, initial: true) { _, phase in
            model.scenePhaseChanged(phase)
        }
    }
}

/// Before the phone has handed over a token.
private struct ConnectView: View {
    var body: some View {
        MessageView(
            symbol: "iphone",
            title: "Open Fatty on your iPhone",
            message: "Your watch connects to your account through it. Keep your iPhone nearby."
        ) {
            PhoneLink.shared.requestContext()
        }
    }
}

struct MessageView: View {
    let symbol: String
    let title: String
    let message: String
    let retry: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Image(systemName: symbol)
                    .font(.title2)
                    .foregroundStyle(.tint)
                Text(title)
                    .font(.headline)
                    .multilineTextAlignment(.center)
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Button("Try again", action: retry)
                    .padding(.top, 4)
            }
            .padding(.horizontal, 4)
        }
    }
}

// MARK: Start

/// A tile per workout, the next programmed day first, as in Workout.
struct StartView: View {
    @EnvironmentObject private var model: WatchModel
    let state: WatchState

    private var others: [StartOption] {
        state.options.filter { $0.templateId != state.next?.templateId }
    }

    var body: some View {
        List {
            if let next = state.next {
                tile(next, isNext: true)
            }
            ForEach(others) { option in
                tile(option, isNext: false)
            }
            if state.options.isEmpty && state.next == nil {
                Text("Build a program in Fatty on your iPhone to start workouts here.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .listRowBackground(Color.clear)
            }
            if let problem = model.problem {
                Text(problem)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .listRowBackground(Color.clear)
            }
        }
        .navigationTitle("Fatty")
    }

    private func tile(_ option: StartOption, isNext: Bool) -> some View {
        Button {
            model.begin(option)
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    Image(systemName: "figure.strengthtraining.traditional")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(model.accent)
                        .frame(width: 40, height: 40)
                        .background(model.accent.opacity(0.22), in: Circle())
                    Spacer()
                    if isNext {
                        Text("NEXT")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundStyle(model.accent)
                    }
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(option.label)
                        .font(.system(.title3, design: .rounded).weight(.semibold))
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                    Text("\(option.exercises) \(option.exercises == 1 ? "exercise" : "exercises")")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 8)
        }
        .disabled(model.starting != nil)
    }
}

/// 3, 2, 1 in a filling ring, a tap on the wrist for each, as Workout does
/// before it starts. The server opens the session meanwhile.
private struct CountdownView: View {
    @EnvironmentObject private var model: WatchModel
    let option: StartOption
    @State private var count = 3
    @State private var progress: CGFloat = 0

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle()
                    .stroke(model.accent.opacity(0.25), lineWidth: 10)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(model.accent, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                if count > 0 {
                    Text("\(count)")
                        .font(.system(size: 64, weight: .bold, design: .rounded))
                        .contentTransition(.numericText(countsDown: true))
                } else {
                    ProgressView()
                }
            }
            .padding(.horizontal, 22)
            Text(count > 0 ? "Ready" : "Starting…")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(option.label)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .task {
            withAnimation(.linear(duration: 3)) { progress = 1 }
            for n in [3, 2, 1] {
                withAnimation { count = n }
                WKInterfaceDevice.current().play(.click)
                try? await Task.sleep(nanoseconds: 1_000_000_000)
            }
            count = 0
            WKInterfaceDevice.current().play(.start)
            model.countdownFinished()
        }
    }
}

// MARK: Summary

/// The workout's numbers once it's over, as Workout's summary shows them.
private struct SummaryView: View {
    @EnvironmentObject private var model: WatchModel
    let summary: WatchModel.Summary

    var body: some View {
        List {
            VStack(alignment: .leading, spacing: 2) {
                Image(systemName: "figure.strengthtraining.traditional")
                    .font(.title3)
                    .foregroundStyle(model.accent)
                Text(summary.title)
                    .font(.headline)
                Text("Strength training")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .listRowBackground(Color.clear)

            stat("Total Time", clock(summary.duration), .yellow)
            stat("Sets", "\(summary.sets)", .white)
            stat("Volume", "\(Int(summary.volume.rounded()).formatted()) \(model.unit)", .white)
            if let calories = summary.calories {
                stat("Active Calories", "\(Int(calories.rounded())) kcal", Color(red: 1, green: 0.25, blue: 0.45))
            }
            if let heartRate = summary.averageHeartRate {
                stat("Avg. Heart Rate", "\(Int(heartRate.rounded())) bpm", .red)
            }

            Button {
                model.summary = nil
            } label: {
                Text("Done")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(model.accent)
            .listRowBackground(Color.clear)
        }
        .navigationTitle("Summary")
    }

    private func stat(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label)
                .font(.footnote)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 26, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .padding(.vertical, 2)
    }
}

/// "1:02:03" or "42:07".
func clock(_ seconds: TimeInterval) -> String {
    let total = max(0, Int(seconds))
    let h = total / 3600
    let m = (total % 3600) / 60
    let s = total % 60
    return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
}
