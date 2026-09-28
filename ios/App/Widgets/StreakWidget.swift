import SwiftUI
import WidgetKit

/// Weeks in a row you've hit your plan (a workout a week without one), and
/// on the medium size, the last twelve weeks of training as a calendar. The
/// server works the streak out into the snapshot; the widget keeps it true
/// as weeks end without the app (WidgetSnapshot.streakWeeks).
struct StreakWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Streak", provider: StreakProvider()) { entry in
            StreakView(entry: entry)
                .fightCard()
                .widgetURL(URL(string: "https://hellblazer.vercel.app/history"))
        }
        .configurationDisplayName("Streak")
        .description("Weeks in a row you've hit your plan, and the days you trained.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
    }
}

struct StreakEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?

    /// The lifter's fighter in ink, for behind the card.
    var ink: UIImage? { snapshot?.fighter.flatMap { FighterArt.loadInk(for: $0.key) } }
}

struct StreakProvider: TimelineProvider {
    private static var sample: WidgetSnapshot {
        let calendar = Calendar(identifier: .iso8601)
        let today = Date()
        let days = (0..<84).compactMap { (offset: Int) -> String? in
            guard offset % 7 != 2, offset % 7 != 5, offset % 11 != 0,
                  let day = calendar.date(byAdding: .day, value: -offset, to: today)
            else { return nil }
            return RecoveryCache.dayKey(day)
        }
        var snapshot = WidgetSnapshot(
            sessionsThisWeek: 3, sessionsPlanned: 4, setsThisWeek: 58,
            weekStart: RecoveryCache.dayKey(calendar.dateInterval(of: .weekOfYear, for: today)?.start ?? today),
            updatedAt: 0
        )
        snapshot.streak = WidgetSnapshot.Streak(weeks: 7, planned: 4)
        snapshot.trainingDays = days.sorted()
        return snapshot
    }

    func placeholder(in context: Context) -> StreakEntry {
        StreakEntry(date: Date(), snapshot: Self.sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (StreakEntry) -> Void) {
        let stored = WidgetSnapshot.load()
        completion(StreakEntry(date: Date(), snapshot: context.isPreview ? (stored ?? Self.sample) : stored))
    }

    /// Now, then each midnight for a week (the calendar's "today" moves),
    /// which also covers the week rolling over.
    func getTimeline(in context: Context, completion: @escaping (Timeline<StreakEntry>) -> Void) {
        let snapshot = WidgetSnapshot.load()
        let calendar = Calendar.current
        let now = Date()
        var entries = [StreakEntry(date: now, snapshot: snapshot)]
        for day in 1...7 {
            if let midnight = calendar.date(byAdding: .day, value: day, to: calendar.startOfDay(for: now)) {
                entries.append(StreakEntry(date: midnight, snapshot: snapshot))
            }
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

struct StreakView: View {
    @Environment(\.widgetFamily) private var family
    let entry: StreakEntry

    var body: some View {
        if let snapshot = entry.snapshot {
            let weeks = snapshot.streakWeeks(at: entry.date)
            switch family {
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: 0) {
                        Image(systemName: "flame.fill")
                            .font(.caption)
                        Text("\(weeks)")
                            .font(.system(.title3, design: .rounded).weight(.bold))
                            .monospacedDigit()
                    }
                }
                .widgetAccentable()
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Label("Streak", systemImage: "flame.fill")
                        .font(.caption2.weight(.semibold))
                        .widgetAccentable()
                    Text(weeksText(weeks))
                        .font(.headline)
                        .lineLimit(1)
                    Text(thisWeek(snapshot))
                        .font(.caption2)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            case .systemMedium:
                HStack(alignment: .top, spacing: 12) {
                    count(weeks, snapshot)
                    Spacer(minLength: 0)
                    TrainingCalendar(days: Set(snapshot.trainingDays ?? []), today: entry.date)
                        .frame(maxHeight: .infinity)
                }
            default:
                ZStack {
                    InkBackdrop(ink: entry.ink, strength: 0.4, width: 0.7)
                        .padding(-16)
                    count(weeks, snapshot)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        } else {
            WidgetEmpty(title: "Streak", symbol: "flame.fill", message: "Open Fatty to start your streak.")
        }
    }

    private func count(_ weeks: Int, _ snapshot: WidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            WidgetHeader(title: "Streak", symbol: "flame.fill")
            Spacer(minLength: 4)
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text("\(weeks)")
                    .font(WidgetStyle.figure(46))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Text(weeks == 1 ? "week" : "weeks")
                    .font(WidgetStyle.title(15))
                    .foregroundStyle(.secondary)
            }
            Text(weeks == 0 ? "Hit your plan to start one" : "unbeaten, on plan")
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Spacer(minLength: 6)
            Text(thisWeek(snapshot))
                .font(.caption.weight(.medium))
                .monospacedDigit()
                .lineLimit(1)
            CapsuleBar(value: weekFraction(snapshot), height: 5)
                .padding(.top, 4)
        }
        .frame(maxHeight: .infinity, alignment: .topLeading)
    }

    private func weeksText(_ weeks: Int) -> String {
        weeks == 0 ? "No streak yet" : "\(weeks) \(weeks == 1 ? "week" : "weeks") in a row"
    }

    private func done(_ snapshot: WidgetSnapshot) -> Int {
        snapshot.isFromPastWeek(now: entry.date) ? 0 : snapshot.sessionsThisWeek
    }

    private func need(_ snapshot: WidgetSnapshot) -> Int? {
        snapshot.streak?.planned ?? snapshot.sessionsPlanned
    }

    /// "3 of 4 this week", zero once the snapshot's week is over.
    private func thisWeek(_ snapshot: WidgetSnapshot) -> String {
        let done = done(snapshot)
        if let need = need(snapshot) { return "\(done) of \(need) this week" }
        return done == 1 ? "1 workout this week" : "\(done) workouts this week"
    }

    private func weekFraction(_ snapshot: WidgetSnapshot) -> Double {
        let goal = Double(max(1, need(snapshot) ?? 1))
        return min(1, Double(done(snapshot)) / goal)
    }
}

/// Twelve weeks, Monday at the top, this week on the right: a filled square
/// for each day trained, today ringed. See-through where empty, so it keeps
/// its shape in the Clear and Tinted looks.
private struct TrainingCalendar: View {
    let days: Set<String>
    let today: Date

    private static let weeks = 12

    var body: some View {
        let calendar = Calendar(identifier: .iso8601)
        let monday = calendar.dateInterval(of: .weekOfYear, for: today)?.start ?? today
        let todayKey = RecoveryCache.dayKey(today)
        GeometryReader { geo in
            let gap: CGFloat = 3
            let cell = min((geo.size.width - gap * CGFloat(Self.weeks - 1)) / CGFloat(Self.weeks), (geo.size.height - gap * 6) / 7)
            HStack(spacing: gap) {
                ForEach(0..<Self.weeks, id: \.self) { column in
                    VStack(spacing: gap) {
                        ForEach(0..<7, id: \.self) { row in
                            let offset = (column - (Self.weeks - 1)) * 7 + row
                            let day = calendar.date(byAdding: .day, value: offset, to: monday) ?? monday
                            let key = RecoveryCache.dayKey(day)
                            let trained = days.contains(key)
                            RoundedRectangle(cornerRadius: cell * 0.28, style: .continuous)
                                .fill(trained ? AnyShapeStyle(Brand.flame) : AnyShapeStyle(day > today ? Color.clear : WidgetStyle.track))
                                .glow(trained, radius: 3)
                                .widgetAccentable(trained)
                                .overlay {
                                    if key == todayKey {
                                        RoundedRectangle(cornerRadius: cell * 0.28, style: .continuous)
                                            .strokeBorder(Color.primary, lineWidth: 1.2)
                                    }
                                }
                                .frame(width: cell, height: cell)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
        }
        .aspectRatio(CGFloat(Self.weeks) / 7, contentMode: .fit)
        .accessibilityElement()
        .accessibilityLabel("\(days.count) days trained in the last twelve weeks")
    }
}
