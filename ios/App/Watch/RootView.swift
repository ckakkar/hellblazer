import SwiftUI

/// Not connected → connect; a workout in progress → the workout; otherwise
/// what you can start.
struct RootView: View {
    @EnvironmentObject private var model: WatchModel
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if model.token == nil {
                ConnectView()
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

/// The active program's days (next one first), or every template.
struct StartView: View {
    @EnvironmentObject private var model: WatchModel
    let state: WatchState

    var body: some View {
        List {
            if let next = state.next {
                Section {
                    Button {
                        Task { await model.start(next) }
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Next up")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(.tint)
                            Text(next.label)
                                .font(.headline)
                            Text(exerciseCount(next))
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            if !state.options.isEmpty {
                Section("Workouts") {
                    ForEach(state.options) { option in
                        Button {
                            Task { await model.start(option) }
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(option.label)
                                Text(exerciseCount(option))
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            } else if state.next == nil {
                Text("Build a program in Fatty on your iPhone to start workouts here.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if let problem = model.problem {
                Text(problem)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        }
        .navigationTitle("Fatty")
        .disabled(model.busy)
        .overlay {
            if model.busy { ProgressView() }
        }
    }

    private func exerciseCount(_ option: StartOption) -> String {
        "\(option.exercises) \(option.exercises == 1 ? "exercise" : "exercises")"
    }
}
