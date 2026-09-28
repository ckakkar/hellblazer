import SwiftUI
import WidgetKit

/// Home Screen and Lock Screen widget: the next programmed workout and how
/// the week is going, with a Start button on the medium size. The app writes
/// the snapshot whenever the dashboard loads, and after a workout's finished
/// anywhere (a silent push); when the week rolls over, it starts at zero.
struct NextBoutWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NextBout", provider: NextBoutProvider()) { entry in
            NextBoutView(entry: entry)
                .fightCard()
                // Tapping it starts the next bout: the Log screen.
                .widgetURL(URL(string: "https://hellblazer.vercel.app/log"))
        }
        .configurationDisplayName("Next Bout")
        .description("Your next workout and this week's training.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular, .accessoryInline])
    }
}

struct NextBoutEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?

    /// The lifter's fighter in ink, for behind the card.
    var ink: UIImage? { snapshot?.fighter.flatMap { FighterArt.loadInk(for: $0.key) } }
}

struct NextBoutProvider: TimelineProvider {
    private static let sample = WidgetSnapshot(
        nextBout: "Upper A",
        programName: "Upper/Lower + Arms",
        sessionsThisWeek: 3,
        sessionsPlanned: 5,
        setsThisWeek: 62,
        weekStart: "2026-01-05",
        updatedAt: 0,
        muscles: [
            ("chest", "Chest", 12, false), ("front_delt", "Front Delt", 6, false),
            ("side_delt", "Side Delt", 14, true), ("rear_delt", "Rear Delt", 8, false),
            ("triceps", "Triceps", 11, true), ("back", "Back", 16, true),
            ("biceps", "Biceps", 9, true), ("quads", "Quads", 10, false),
            ("hamstrings", "Hamstrings", 7, false), ("glutes", "Glutes", 6, false),
            ("calves", "Calves", 4, false),
        ].map { WidgetSnapshot.MuscleSets(key: $0.0, label: $0.1, sets: $0.2, weak: $0.3) }
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
                    Label("Fatty", systemImage: "flame")
                        .font(.caption2.weight(.semibold))
                        .widgetAccentable()
                    Text(snapshot.nextBout.map { "Next: \($0)" } ?? "No program")
                        .font(.headline)
                        .lineLimit(1)
                    Text("\(week.sessionsText) sessions, \(week.sets) sets")
                        .font(.caption)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            case .accessoryInline:
                Label(snapshot.nextBout.map { "Next: \($0)" } ?? "\(week.sessionsText) sessions this week", systemImage: "flame")
            case .systemMedium:
                ZStack {
                    InkBackdrop(ink: entry.ink, strength: 0.75, width: 0.5)
                        .padding(-16)
                    VStack(alignment: .leading, spacing: 0) {
                        NextBoutBlock(snapshot: snapshot, titleSize: 22)
                            .padding(.trailing, 110)
                        Spacer(minLength: 6)
                        HStack(alignment: .bottom, spacing: 12) {
                            WeekLine(week: week)
                                .frame(maxWidth: 150)
                            Spacer(minLength: 0)
                            // Starts that day in the app, straight into the logger.
                            if let start = snapshot.startURL {
                                Link(destination: start) {
                                    WidgetButtonLabel(title: "Start", symbol: "play.fill")
                                }
                            }
                        }
                    }
                }
            default:
                ZStack {
                    InkBackdrop(ink: entry.ink, strength: 0.45, width: 0.8)
                        .padding(-16)
                    VStack(alignment: .leading, spacing: 0) {
                        NextBoutBlock(snapshot: snapshot, titleSize: 17)
                        Spacer(minLength: 6)
                        WeekLine(week: week)
                    }
                }
            }
        } else {
            EmptyWidget(family: family)
        }
    }
}

private struct NextBoutBlock: View {
    let snapshot: WidgetSnapshot
    let titleSize: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            WidgetHeader(title: "Next bout", symbol: "flame.fill")
            Text(snapshot.nextBout ?? "Pick a program")
                .font(WidgetStyle.title(titleSize))
                .lineLimit(2)
                .minimumScaleFactor(0.75)
                .padding(.top, 3)
            if let program = snapshot.programName {
                Text(program)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
    }
}

/// Small widget footer: the week so far, a segment per planned workout.
private struct WeekLine: View {
    let week: Week

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("\(week.sessions)")
                    .font(WidgetStyle.figure(24))
                    .monospacedDigit()
                Text(week.planned.map { "of \($0) this week" } ?? "this week")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            if let planned = week.planned, planned > 0, planned <= 7 {
                HStack(spacing: 3) {
                    ForEach(0..<planned, id: \.self) { index in
                        Capsule()
                            .fill(index < week.sessions ? AnyShapeStyle(Brand.flame) : AnyShapeStyle(WidgetStyle.track))
                            .frame(height: 5)
                            .glow(index < week.sessions, radius: 4)
                            .widgetAccentable(index < week.sessions)
                    }
                }
            } else {
                CapsuleBar(value: week.fraction, height: 5)
            }
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
            Label("Open Fatty", systemImage: "flame")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Label("Fatty", systemImage: "flame")
                    .font(.caption2.weight(.semibold))
                    .widgetAccentable()
                Text("Open Fatty to see your next bout")
                    .font(.caption)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        default:
            WidgetEmpty(title: "Next Bout", symbol: "flame.fill", message: "Open Fatty to see your next bout here.")
        }
    }
}
