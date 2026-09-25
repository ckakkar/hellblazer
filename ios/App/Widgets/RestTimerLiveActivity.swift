import ActivityKit
import SwiftUI
import WidgetKit

/// The rest timer on the Lock Screen and in the Dynamic Island. The countdown
/// is drawn by the system from `endsAt`, so it needs no updates from the app;
/// once the rest is over the activity goes stale and reads "Rest's up".
struct RestTimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestActivityAttributes.self) { context in
            RestLockScreenView(context: context)
                .activityBackgroundTint(Brand.background.opacity(0.9))
                .activitySystemActionForegroundColor(Brand.bone)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(isOver(context) ? "Rest's up" : "Resting", systemImage: "timer")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(isOver(context) ? Brand.flame : Brand.muted)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Countdown(context: context)
                        .font(.system(.title2, design: .rounded).weight(.semibold))
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(context.attributes.label)
                            .font(.subheadline)
                            .foregroundStyle(Brand.bone)
                            .lineLimit(1)
                        RestBar(context: context)
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                Image(systemName: "timer")
                    .foregroundStyle(Brand.flame)
            } compactTrailing: {
                Countdown(context: context)
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .frame(maxWidth: 52)
            } minimal: {
                Image(systemName: isOver(context) ? "flame.fill" : "timer")
                    .foregroundStyle(Brand.flame)
            }
            .keylineTint(Brand.flame)
        }
    }
}

private func isOver(_ context: ActivityViewContext<RestActivityAttributes>) -> Bool {
    context.isStale || context.state.endsAt <= Date()
}

/// "1:23" counting down, or "Go" when the rest is over. A timer text needs a
/// valid range, so an end in the past never reaches it.
private struct Countdown: View {
    let context: ActivityViewContext<RestActivityAttributes>

    var body: some View {
        if isOver(context) {
            Text("Go")
                .foregroundStyle(Brand.flame)
        } else {
            Text(timerInterval: Date()...context.state.endsAt, countsDown: true)
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .foregroundStyle(Brand.bone)
        }
    }
}

private struct RestBar: View {
    let context: ActivityViewContext<RestActivityAttributes>

    var body: some View {
        if isOver(context) {
            ProgressView(value: 1)
                .tint(Brand.flame)
        } else {
            let end = context.state.endsAt
            let start = min(end.addingTimeInterval(-context.state.total), Date())
            ProgressView(timerInterval: start...end, countsDown: false) {
                EmptyView()
            } currentValueLabel: {
                EmptyView()
            }
            .tint(Brand.bone)
        }
    }
}

private struct RestLockScreenView: View {
    let context: ActivityViewContext<RestActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Label(isOver(context) ? "Rest's up" : "Resting", systemImage: "timer")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(isOver(context) ? Brand.flame : Brand.muted)
                    Text(context.attributes.label)
                        .font(.headline)
                        .foregroundStyle(Brand.bone)
                        .lineLimit(1)
                }
                Spacer(minLength: 12)
                Countdown(context: context)
                    .font(.system(size: 40, weight: .semibold, design: .rounded))
                    .frame(maxWidth: 140, alignment: .trailing)
            }
            RestBar(context: context)
        }
        .padding(16)
    }
}
