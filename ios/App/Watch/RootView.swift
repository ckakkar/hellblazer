import Charts
import SwiftUI
import WatchKit

/// Laid out like Apple's Workout app: a list of workouts to start, a 3-2-1
/// countdown, the workout itself, and a summary at the end.
struct RootView: View {
    @EnvironmentObject private var model: WatchModel
    @Environment(\.scenePhase) private var scenePhase

    /// Which screen is up, so moving between them crossfades instead of
    /// cutting (the countdown grows into the workout, as in Workout).
    private var stage: String {
        if model.token == nil { return "connect" }
        if model.summary != nil { return "summary" }
        if model.starting != nil { return "countdown" }
        if model.state?.active != nil { return "workout" }
        if model.state != nil { return "start" }
        return model.problem != nil ? "problem" : "loading"
    }

    var body: some View {
        Group {
            if model.token == nil {
                ConnectView()
                    .transition(.opacity)
            } else if let summary = model.summary {
                NavigationStack {
                    SummaryView(summary: summary)
                }
                .transition(.opacity.combined(with: .scale(scale: 1.04)))
            } else if let option = model.starting {
                CountdownView(option: option)
                    .transition(.opacity.combined(with: .scale(scale: 0.92)))
            } else if let workout = model.state?.active {
                WorkoutView(workout: workout)
                    .transition(.opacity.combined(with: .scale(scale: 1.06)))
            } else if let state = model.state {
                NavigationStack {
                    StartView(state: state)
                }
                .transition(.opacity)
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
        .animation(.smooth(duration: 0.32), value: stage)
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

/// The home: today's Recovery call, the next workout, the week so far with
/// the last eight weeks behind it, every other workout, and the lifter's
/// rank and streak. Starting a workout stays one tap from the top.
struct StartView: View {
    @EnvironmentObject private var model: WatchModel
    let state: WatchState

    private var others: [StartOption] {
        state.options.filter { $0.templateId != state.next?.templateId }
    }

    var body: some View {
        List {
            if let call = model.recovery, call.isToday {
                NavigationLink {
                    RecoveryDetail(call: call)
                } label: {
                    RecoveryTile(call: call)
                }
            }
            if let next = state.next {
                tile(next, isNext: true)
            }
            if let you = state.you, let week = state.week {
                WeekTile(week: week, you: you)
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
            if let you = state.you, you.rank != nil || you.streakWeeks > 0 || you.last != nil {
                YouTile(you: you)
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

/// Today's call at a glance: the arrow, the words, two weeks of HRV with
/// today's point, and the one thing it rests on most.
private struct RecoveryTile: View {
    @EnvironmentObject private var model: WatchModel
    let call: WatchRecovery

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 5) {
                Image(systemName: call.symbol)
                    .font(.system(size: 14, weight: .black))
                    .foregroundStyle(call.verdict == "ready" ? model.accent : .secondary)
                Text("Recovery")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer(minLength: 2)
                if let hrv = call.hrv {
                    Text("\(Int(hrv.rounded())) ms")
                        .font(.footnote)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
            }
            Text(call.headline)
                .font(.system(.headline, design: .rounded))
                .lineLimit(2)
                .minimumScaleFactor(0.8)
            if let trend = call.hrvTrend {
                TrendLine(values: trend, accent: call.verdict == "ready" ? model.accent : .white)
                    .frame(height: 30)
            }
            if let reason = call.reasons?.first {
                Text(reason)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 6)
    }
}

/// A reading over two weeks, no axes: the line, and today's point on it.
private struct TrendLine: View {
    let values: [Double?]
    let accent: Color

    private var points: [(day: Int, value: Double)] {
        values.enumerated().compactMap { i, v in v.map { (i, $0) } }
    }

    var body: some View {
        if points.count >= 3 {
            Chart {
                ForEach(points, id: \.day) { p in
                    LineMark(x: .value("Day", p.day), y: .value("HRV", p.value))
                        .interpolationMethod(.catmullRom)
                        .foregroundStyle(Color.white.opacity(0.55))
                        .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round))
                }
                if let last = points.last {
                    PointMark(x: .value("Day", last.day), y: .value("HRV", last.value))
                        .foregroundStyle(accent)
                        .symbolSize(30)
                }
            }
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .chartXScale(domain: 0...max(1, values.count - 1))
            .chartYScale(domain: .automatic(includesZero: false))
            .accessibilityLabel("Heart rate variability, the last two weeks")
        }
    }
}

/// Everything today's call rests on, and what to do about it.
private struct RecoveryDetail: View {
    @EnvironmentObject private var model: WatchModel
    let call: WatchRecovery

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Label(call.headline, systemImage: call.symbol)
                    .font(.system(.headline, design: .rounded))
                    .foregroundStyle(call.verdict == "ready" ? model.accent : .primary)
                if let advice = call.advice {
                    Text(advice)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                HStack(alignment: .top, spacing: 8) {
                    if let sleep = call.sleepMin { reading("Sleep", sleepText(sleep)) }
                    if let hrv = call.hrv { reading("HRV", "\(Int(hrv.rounded()))") }
                    if let rhr = call.rhr { reading("Resting", "\(Int(rhr.rounded()))") }
                }
                if let trend = call.hrvTrend {
                    TrendLine(values: trend, accent: model.accent)
                        .frame(height: 44)
                }
                if let reasons = call.reasons, !reasons.isEmpty {
                    Divider()
                    ForEach(reasons, id: \.self) { reason in
                        Text(reason)
                            .font(.footnote)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                if let readAt = call.readAt {
                    Text("From your iPhone at \(Date(timeIntervalSince1970: readAt).formatted(date: .omitted, time: .shortened))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Recovery")
    }

    private func reading(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(.body, design: .rounded).weight(.semibold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func sleepText(_ minutes: Double) -> String {
        let m = Int(minutes.rounded())
        return "\(m / 60)h \(String(format: "%02d", m % 60))"
    }
}

/// The week so far: a dot for each day trained, the count against the plan,
/// and the last eight weeks' sets as bars, this week's lit.
private struct WeekTile: View {
    @EnvironmentObject private var model: WatchModel
    let week: WatchState.Week
    let you: WatchState.You

    private static let letters = ["M", "T", "W", "T", "F", "S", "S"]

    /// Monday first, as the server counts the week.
    private var todayIndex: Int {
        (Calendar(identifier: .iso8601).component(.weekday, from: Date()) + 5) % 7
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("This week")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer(minLength: 2)
                Text(week.planned.map { "\(week.sessions) of \($0)" } ?? "\(week.sessions)")
                    .font(.footnote.weight(.semibold))
                    .monospacedDigit()
            }
            HStack(spacing: 0) {
                ForEach(0..<7, id: \.self) { i in
                    let trained = i < you.days.count && you.days[i]
                    VStack(spacing: 2) {
                        Circle()
                            .fill(trained ? AnyShapeStyle(model.accent) : AnyShapeStyle(Color.white.opacity(0.15)))
                            .overlay(Circle().stroke(Color.white.opacity(i == todayIndex ? 0.8 : 0), lineWidth: 1.5))
                            .frame(width: 10, height: 10)
                        Text(Self.letters[i])
                            .font(.system(size: 10, weight: .medium, design: .rounded))
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(you.days.filter { $0 }.count) days trained this week")
            if you.weeklySets.contains(where: { $0 > 0 }) {
                Chart {
                    ForEach(Array(you.weeklySets.enumerated()), id: \.offset) { i, sets in
                        BarMark(x: .value("Week", i), y: .value("Sets", sets))
                            .foregroundStyle(i == you.weeklySets.count - 1 ? AnyShapeStyle(model.accent) : AnyShapeStyle(Color.white.opacity(0.35)))
                            .cornerRadius(2)
                    }
                }
                .chartXAxis(.hidden)
                .chartYAxis(.hidden)
                .frame(height: 34)
                .accessibilityLabel("Working sets a week, the last eight weeks")
                Text("\(week.sets) sets this week")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 6)
    }
}

/// The lifter: rank, streak, and the last workout.
private struct YouTile: View {
    let you: WatchState.You

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let rank = you.rank {
                Text("Rank \(rank.rank) of \(rank.of)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(rank.name)
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            if you.streakWeeks > 0 {
                Label("\(you.streakWeeks)-week streak", systemImage: "flame.fill")
                    .font(.footnote)
            }
            if let last = you.last {
                Text("Last: \(last.title), \(when(last.date)), \(last.sets) sets")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 4)
    }

    /// "today", "yesterday" or "Tue".
    private func when(_ date: String) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        guard let day = formatter.date(from: date) else { return date }
        let calendar = Calendar.current
        if calendar.isDateInToday(day) { return "today" }
        if calendar.isDateInYesterday(day) { return "yesterday" }
        let out = DateFormatter()
        out.setLocalizedDateFormatFromTemplate("EEE d MMM")
        return out.string(from: day)
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
