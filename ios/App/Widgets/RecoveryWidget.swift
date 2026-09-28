import SwiftUI
import WidgetKit

/// Today's Recovery call, the card on Home at a glance: ready to push, train
/// as planned, or go lighter, from last night's sleep, HRV and resting heart
/// rate against the lifter's own usual. The app works it out and leaves it
/// here (RecoveryCache); from midnight until the new day's read it says so
/// rather than pass off yesterday's.
struct RecoveryWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: RecoveryCache.widgetKind, provider: RecoveryProvider()) { entry in
            RecoveryView(entry: entry)
                .containerBackground(for: .widget) { Brand.widgetBackground }
                .widgetURL(URL(string: "https://hellblazer.vercel.app/dashboard"))
        }
        .configurationDisplayName("Recovery")
        .description("Whether to push or go lighter today, from your sleep, HRV and resting heart rate.")
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryInline])
    }
}

struct RecoveryEntry: TimelineEntry {
    let date: Date
    let call: RecoveryCache?
}

struct RecoveryProvider: TimelineProvider {
    func placeholder(in context: Context) -> RecoveryEntry {
        RecoveryEntry(
            date: Date(),
            call: RecoveryCache(date: RecoveryCache.dayKey(Date()), verdict: "ready", headline: "Ready to push", sleepMin: 462, hrv: 64, rhr: 51)
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (RecoveryEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : RecoveryEntry(date: Date(), call: RecoveryCache.load()))
    }

    /// Now, then again just after midnight, when the call goes out of date.
    /// The app reloads it whenever it makes a new one.
    func getTimeline(in context: Context, completion: @escaping (Timeline<RecoveryEntry>) -> Void) {
        let now = Date()
        let calendar = Calendar.current
        let midnight = calendar.date(byAdding: .minute, value: 1, to: calendar.startOfDay(for: now).addingTimeInterval(86_400)) ?? now
        let call = RecoveryCache.load()
        completion(Timeline(
            entries: [RecoveryEntry(date: now, call: call), RecoveryEntry(date: midnight, call: call)],
            policy: .never
        ))
    }
}

struct RecoveryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: RecoveryEntry

    /// Today's call, or nil when there's none for today yet.
    private var today: RecoveryCache? {
        entry.call.flatMap { $0.isFor(entry.date) ? $0 : nil }
    }

    var body: some View {
        switch family {
        case .accessoryInline: inline
        case .accessoryRectangular: rectangular
        default: small
        }
    }

    // MARK: Home Screen

    private var small: some View {
        VStack(alignment: .leading, spacing: 0) {
            WidgetHeader(title: "Recovery", symbol: "heart.fill")
            if let call = today {
                Image(systemName: symbol(call.verdict))
                    .font(.title2.weight(.bold))
                    .foregroundStyle(call.verdict == "ready" ? AnyShapeStyle(Brand.flame) : AnyShapeStyle(.secondary))
                    .widgetAccentable(call.verdict == "ready")
                    .padding(.top, 8)
                Text(call.headline)
                    .font(.headline)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                    .padding(.top, 2)
                Spacer(minLength: 4)
                VStack(alignment: .leading, spacing: 2) {
                    if let sleep = call.sleepMin { reading("Sleep", sleepText(sleep)) }
                    if let hrv = call.hrv { reading("HRV", "\(Int(hrv.rounded())) ms") }
                    if let rhr = call.rhr { reading("Resting", "\(Int(rhr.rounded())) bpm") }
                }
            } else {
                Spacer(minLength: 0)
                Text(entry.call == nil
                     ? "Connect Apple Health on Fatty's Home to see how recovered you are."
                     : "Open Fatty for today's read.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func reading(_ label: String, _ value: String) -> some View {
        HStack(spacing: 4) {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer(minLength: 4)
            Text(value)
                .monospacedDigit()
        }
        .font(.caption)
        .lineLimit(1)
    }

    // MARK: Lock Screen

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("Recovery")
                .font(.caption2.weight(.semibold))
                .widgetAccentable()
            if let call = today {
                Label(call.headline, systemImage: symbol(call.verdict))
                    .font(.headline)
                    .lineLimit(1)
                Text(summary(call))
                    .font(.caption2)
                    .lineLimit(1)
            } else {
                Text(entry.call == nil ? "Connect Health in Fatty" : "Open Fatty for today")
                    .font(.caption)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var inline: some View {
        Group {
            if let call = today {
                Label(call.headline, systemImage: symbol(call.verdict))
            } else {
                Label("Recovery: open Fatty", systemImage: "heart.text.square")
            }
        }
    }

    // MARK: Words

    /// The arrow is the call: up to push, level as planned, down to go lighter.
    private func symbol(_ verdict: String) -> String {
        switch verdict {
        case "ready": return "arrow.up.right"
        case "steady": return "arrow.right"
        default: return "arrow.down.right"
        }
    }

    private func sleepText(_ minutes: Double) -> String {
        let m = Int(minutes.rounded())
        return "\(m / 60)h \(String(format: "%02d", m % 60))m"
    }

    /// "7h 42m sleep · HRV 64".
    private func summary(_ call: RecoveryCache) -> String {
        var parts: [String] = []
        if let sleep = call.sleepMin { parts.append("\(sleepText(sleep)) sleep") }
        if let hrv = call.hrv { parts.append("HRV \(Int(hrv.rounded()))") }
        if parts.count < 2, let rhr = call.rhr { parts.append("RHR \(Int(rhr.rounded()))") }
        return parts.joined(separator: " · ")
    }
}
