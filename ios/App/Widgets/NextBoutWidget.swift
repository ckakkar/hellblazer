import SwiftUI
import WidgetKit

/// Home Screen and Lock Screen widget: the next programmed workout and how
/// the week is going. The app writes the snapshot whenever the dashboard
/// loads; when the week rolls over, the widget starts the new week at zero.
struct NextBoutWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NextBout", provider: NextBoutProvider()) { entry in
            NextBoutView(entry: entry)
                .containerBackground(for: .widget) { Brand.background }
        }
        .configurationDisplayName("Next Bout")
        .description("Your next workout and this week's training.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular, .accessoryInline])
    }
}

struct NextBoutEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

struct NextBoutProvider: TimelineProvider {
    private static let sample = WidgetSnapshot(
        nextBout: "Upper A",
        programName: "Upper/Lower + Arms",
        sessionsThisWeek: 3,
        sessionsPlanned: 5,
        setsThisWeek: 62,
        weekStart: "2026-01-05",
        updatedAt: 0
    )

    func placeholder(in context: Context) -> NextBoutEntry {
        NextBoutEntry(date: Date(), snapshot: Self.sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (NextBoutEntry) -> Void) {
        let stored = WidgetSnapshot.load()
        completion(NextBoutEntry(date: Date(), snapshot: context.isPreview ? (stored ?? Self.sample) : stored))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextBoutEntry>) -> Void) {
        let snapshot = WidgetSnapshot.load()
        var entries = [NextBoutEntry(date: Date(), snapshot: snapshot)]
        // Redraw when the week rolls over, so "this week" resets on its own.
        if let weekEnd = snapshot?.weekEnd(), weekEnd > Date() {
            entries.append(NextBoutEntry(date: weekEnd, snapshot: snapshot))
        }
        completion(Timeline(entries: entries, policy: .never))
    }
}

/// The week's numbers as of the entry's date: zero once the week has passed.
private struct Week {
    let sessions: Int
    let planned: Int?
    let sets: Int

    init(_ snapshot: WidgetSnapshot, at date: Date) {
        let stale = snapshot.isFromPastWeek(now: date)
        sessions = stale ? 0 : snapshot.sessionsThisWeek
        sets = stale ? 0 : snapshot.setsThisWeek
        planned = snapshot.sessionsPlanned
    }

    var sessionsText: String {
        if let planned { return "\(sessions)/\(planned)" }
        return "\(sessions)"
    }

    var fraction: Double {
        guard let planned, planned > 0 else { return sessions > 0 ? 1 : 0 }
        return min(1, Double(sessions) / Double(planned))
    }
}

struct NextBoutView: View {
    @Environment(\.widgetFamily) private var family
    let entry: NextBoutEntry

    var body: some View {
        if let snapshot = entry.snapshot {
            let week = Week(snapshot, at: entry.date)
            switch family {
            case .accessoryCircular:
                Gauge(value: week.fraction) {
                    Image(systemName: "flame")
                } currentValueLabel: {
                    Text("\(week.sessions)")
                }
                .gaugeStyle(.accessoryCircularCapacity)
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 2) {
                    Label("Hell Blazer", systemImage: "flame")
                        .font(.caption2.weight(.semibold))
                        .widgetAccentable()
                    Text(snapshot.nextBout.map { "Next: \($0)" } ?? "No program")
                        .font(.headline)
                        .lineLimit(1)
                    Text("\(week.sessionsText) sessions · \(week.sets) sets")
                        .font(.caption)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            case .accessoryInline:
                Label(snapshot.nextBout.map { "Next: \($0)" } ?? "\(week.sessionsText) sessions this week", systemImage: "flame")
            case .systemMedium:
                HStack(spacing: 16) {
                    NextBoutBlock(snapshot: snapshot)
                    Spacer(minLength: 0)
                    WeekRing(week: week)
                }
            default:
                VStack(alignment: .leading, spacing: 0) {
                    NextBoutBlock(snapshot: snapshot)
                    Spacer(minLength: 8)
                    WeekLine(week: week)
                }
            }
        } else {
            EmptyWidget(family: family)
        }
    }
}

private struct NextBoutBlock: View {
    let snapshot: WidgetSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("Next bout", systemImage: "flame.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.flame)
            Text(snapshot.nextBout ?? "Pick a program")
                .font(.system(.title3, design: .rounded).weight(.bold))
                .foregroundStyle(Brand.bone)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
            if let program = snapshot.programName {
                Text(program)
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
                    .lineLimit(1)
            }
        }
    }
}

/// Small widget footer: sessions against the plan, as a bar.
private struct WeekLine: View {
    let week: Week

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(week.sessionsText)
                    .font(.system(.headline, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Brand.bone)
                Text("this week")
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
            }
            ProgressView(value: week.fraction)
                .tint(Brand.bone)
        }
    }
}

/// Medium widget: sessions as a ring, working sets underneath.
private struct WeekRing: View {
    let week: Week

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .stroke(Brand.surface, lineWidth: 8)
                Circle()
                    .trim(from: 0, to: week.fraction)
                    .stroke(Brand.bone, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text(week.sessionsText)
                    .font(.system(.title3, design: .rounded).weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(Brand.bone)
            }
            .frame(width: 72, height: 72)
            Text("\(week.sets) sets")
                .font(.caption)
                .monospacedDigit()
                .foregroundStyle(Brand.muted)
        }
    }
}

private struct EmptyWidget: View {
    let family: WidgetFamily

    var body: some View {
        switch family {
        case .accessoryCircular:
            Image(systemName: "flame")
        case .accessoryInline:
            Label("Open Hell Blazer", systemImage: "flame")
        default:
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: "flame.fill")
                    .foregroundStyle(Brand.flame)
                Text("Open Hell Blazer to see your next bout here.")
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}
