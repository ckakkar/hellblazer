import ActivityKit
import SwiftUI
import WidgetKit

/// The workout in progress on the Lock Screen and in the Dynamic Island: the
/// session clock, the exercise you're on, the running totals, and the rest
/// countdown while you rest. The clock and countdown are drawn by the system
/// from dates, so they need no updates from the app; when a rest runs out the
/// activity goes stale and reads "Rest's up" until the app says otherwise.
/// While resting, +30s and Skip work without opening the app (RestControl).
/// Tapping anywhere else opens the session.
struct WorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            LockScreenView(context: context)
                .activityBackgroundTint(Brand.background.opacity(0.9))
                .activitySystemActionForegroundColor(Brand.bone)
                .widgetURL(sessionURL(context))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(phase(context).title)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(phase(context) == .restOver ? Brand.flame : Brand.muted)
                        Text(context.state.exercise ?? context.state.title)
                            .font(.headline)
                            .foregroundStyle(Brand.bone)
                            .lineLimit(1)
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    MainClock(context: context)
                        .font(.system(.title2, design: .rounded).weight(.semibold))
                        .frame(maxWidth: 110, alignment: .trailing)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        if context.state.hasRest {
                            RestBar(context: context)
                        }
                        Totals(context: context)
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                Image(systemName: context.state.hasRest ? "timer" : "figure.strengthtraining.traditional")
                    .foregroundStyle(Brand.flame)
            } compactTrailing: {
                MainClock(context: context)
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .frame(maxWidth: 56)
            } minimal: {
                Image(systemName: phase(context) == .restOver ? "flame.fill" : context.state.hasRest ? "timer" : "figure.strengthtraining.traditional")
                    .foregroundStyle(Brand.flame)
            }
            .widgetURL(sessionURL(context))
            .keylineTint(Brand.flame)
        }
    }
}

private func sessionURL(_ context: ActivityViewContext<WorkoutActivityAttributes>) -> URL? {
    URL(string: "https://hellblazer.vercel.app/log/\(context.attributes.sessionId)")
}

private enum Phase {
    case training, resting, restOver

    var title: String {
        switch self {
        case .training: return "Workout"
        case .resting: return "Resting"
        case .restOver: return "Rest's up"
        }
    }
}

private func phase(_ context: ActivityViewContext<WorkoutActivityAttributes>) -> Phase {
    guard let end = context.state.restEndsAt else { return .training }
    return context.isStale || end <= Date() ? .restOver : .resting
}

/// The one number that's moving: the rest countdown while resting ("Go" once
/// it's over), otherwise the workout clock counting up. A timer text needs a
/// valid range, so an end in the past never reaches it.
private struct MainClock: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    var body: some View {
        let now = Date()
        switch phase(context) {
        case .resting:
            // max() keeps the range valid if the rest ends between the two reads.
            Text(timerInterval: now...max(now, context.state.restEndsAt ?? now), countsDown: true)
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .foregroundStyle(Brand.bone)
        case .restOver:
            Text("Go")
                .foregroundStyle(Brand.flame)
        case .training:
            Text(context.attributes.startedAt, style: .timer)
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .foregroundStyle(Brand.bone)
        }
    }
}

private struct RestBar: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    var body: some View {
        if phase(context) == .resting, let end = context.state.restEndsAt {
            let start = min(end.addingTimeInterval(-(context.state.restTotal ?? 90)), Date())
            ProgressView(timerInterval: start...end, countsDown: false) {
                EmptyView()
            } currentValueLabel: {
                EmptyView()
            }
            .tint(Brand.bone)
        } else {
            ProgressView(value: 1)
                .tint(Brand.flame)
        }
    }
}

/// "12 sets, 4,210 kg". While resting, the rest's buttons sit beside it.
private struct Totals: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    var body: some View {
        HStack(alignment: .center) {
            Text("\(context.state.sets) \(context.state.sets == 1 ? "set" : "sets"), \(context.state.volume)")
                .font(.subheadline)
                .foregroundStyle(Brand.muted)
                .lineLimit(1)
            Spacer(minLength: 8)
            if context.state.hasRest {
                RestButtons(context: context)
            }
        }
    }
}

/// +30s and Skip ("Done" once the rest is over). They run in the app's
/// process without opening it; the page catches up when it's next open.
private struct RestButtons: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    var body: some View {
        HStack(spacing: 6) {
            Button(intent: ExtendRestIntent(sessionId: context.attributes.sessionId)) {
                Label("30s", systemImage: "plus")
                    .labelStyle(.titleAndIcon)
                    .foregroundStyle(Brand.bone)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Brand.bone.opacity(0.14), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            Button(intent: SkipRestIntent(sessionId: context.attributes.sessionId)) {
                Text(phase(context) == .restOver ? "Done" : "Skip")
                    .foregroundStyle(phase(context) == .restOver ? Brand.bone : Brand.muted)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(
                        (phase(context) == .restOver ? Brand.flame : Brand.bone.opacity(0.08)),
                        in: RoundedRectangle(cornerRadius: 10, style: .continuous)
                    )
            }
        }
        .buttonStyle(.plain)
        .font(.subheadline.weight(.semibold))
        .fixedSize()
    }
}

private struct LockScreenView: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: context.state.hasRest ? 10 : 12) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Label(phase(context) == .training ? context.state.title : phase(context).title,
                          systemImage: context.state.hasRest ? "timer" : "flame.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(phase(context) == .restOver ? Brand.flame : Brand.muted)
                        .lineLimit(1)
                    Text(context.state.exercise ?? "Warming up")
                        .font(.headline)
                        .foregroundStyle(Brand.bone)
                        .lineLimit(1)
                    if let detail = context.state.detail, !context.state.hasRest {
                        Text(detail)
                            .font(.subheadline)
                            .foregroundStyle(Brand.muted)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 12)
                MainClock(context: context)
                    .font(.system(size: 40, weight: .semibold, design: .rounded))
                    .frame(maxWidth: 150, alignment: .trailing)
            }
            if context.state.hasRest {
                RestBar(context: context)
            }
            Totals(context: context)
        }
        .padding(context.state.hasRest ? 14 : 16)
    }
}
