import SwiftUI
import WidgetKit

/// Weeks in a row you've hit your plan (a workout a week without one), and
/// on the medium size, the last twelve weeks of training as a calendar; the
/// iPad's extra large spreads half a year across it. The
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
        .supportedFamilies([.systemSmall, .systemMedium, .systemExtraLarge, .accessoryCircular, .accessoryRectangular])
    }
}

struct StreakEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?

    /// The lifter's fighter, for behind the card: in ink, and see-through.
    var ink: UIImage? { snapshot?.fighter.flatMap { FighterArt.loadInk(for: $0.key) } }
    var clear: UIImage? { snapshot?.fighter.flatMap { FighterArt.loadClear(for: $0.key) } }

    /// A streak on the line rises in the Smart Stack: the week's last days
    /// with the plan not yet met. Otherwise it waits its turn.
    var relevance: TimelineEntryRelevance? {
        guard let snapshot, let planned = snapshot.sessionsPlanned, planned > 0,
              snapshot.sessionsThisWeek < planned,
              let weekday = Calendar(identifier: .iso8601).dateComponents([.weekday], from: date).weekday
        else { return nil }
        // Friday, Saturday, Sunday (Sunday is 1).
        return weekday == 1 || weekday >= 6 ? TimelineEntryRelevance(score: 50) : nil
    }
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
            case .systemExtraLarge:
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .top, spacing: 16) {
                        VStack(alignment: .leading, spacing: 2) {
                            WidgetHeader(title: "Streak", symbol: "flame.fill")
                            HStack(alignment: .firstTextBaseline, spacing: 6) {
                                Text("\(weeks)")
                                    .font(WidgetStyle.figure(54))
                                    .monospacedDigit()
                                    .contentTransition(.numericText(value: Double(weeks)))
                                    .lineLimit(1)
                                Text(weeks == 1 ? "week" : "weeks")
                                    .font(WidgetStyle.title(17))
                                    .foregroundStyle(.secondary)
                                Text(weeks == 0 ? "Hit your plan to start one" : "unbeaten, on plan")
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                                    .padding(.leading, 6)
                            }
                            .padding(.top, 2)
                        }
                        Spacer(minLength: 0)
                        VStack(alignment: .trailing, spacing: 6) {
                            Text(thisWeek(snapshot))
                                .font(.subheadline.weight(.semibold))
                                .monospacedDigit()
                                .lineLimit(1)
                            Text("\(trained(snapshot)) days in 26 weeks")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                                .lineLimit(1)
                            CapsuleBar(value: weekFraction(snapshot), height: 5)
                                .frame(width: 150)
                        }
                    }
                    TrainingCalendar(days: Set(snapshot.trainingDays ?? []), today: entry.date, weeks: 26, months: true)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                        .padding(.top, 14)
                }
            case .systemMedium:
                HStack(alignment: .top, spacing: 12) {
                    count(weeks, snapshot)
                    Spacer(minLength: 0)
                    TrainingCalendar(days: Set(snapshot.trainingDays ?? []), today: entry.date)
                        .frame(maxHeight: .infinity)
                }
            default:
                ZStack {
                    InkBackdrop(ink: entry.ink, clear: entry.clear, strength: 0.4, width: 0.7)
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
                    .contentTransition(.numericText(value: Double(weeks)))
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

    private func trained(_ snapshot: WidgetSnapshot) -> Int {
        snapshot.trainingDays?.count ?? 0
    }

    private func weekFraction(_ snapshot: WidgetSnapshot) -> Double {
        let goal = Double(max(1, need(snapshot) ?? 1))
        return min(1, Double(done(snapshot)) / goal)
    }
}

/// Weeks of training (twelve, or half a year on the iPad), Monday at the
/// top, this week on the right: a filled square for each day trained, today
/// ringed. See-through where empty, so it keeps its shape in the Clear and
/// Tinted looks. `months` labels the columns where a month starts.
private struct TrainingCalendar: View {
    let days: Set<String>
    let today: Date
    var weeks = 12
    var months = false

    private static let monthFormat: DateFormatter = {
        let format = DateFormatter()
        format.setLocalizedDateFormatFromTemplate("MMM")
        return format
    }()

    var body: some View {
        let calendar = Calendar(identifier: .iso8601)
        let monday = calendar.dateInterval(of: .weekOfYear, for: today)?.start ?? today
        let todayKey = RecoveryCache.dayKey(today)
        let label: CGFloat = months ? 16 : 0
        GeometryReader { geo in
            let gap: CGFloat = 3
            let cell = min((geo.size.width - gap * CGFloat(weeks - 1)) / CGFloat(weeks), (geo.size.height - label - gap * 6) / 7)
            VStack(alignment: .leading, spacing: 0) {
                if months {
                    HStack(spacing: gap) {
                        ForEach(0..<weeks, id: \.self) { column in
                            // Over the week a month starts in.
                            let start = calendar.date(byAdding: .day, value: (column - (weeks - 1)) * 7, to: monday) ?? monday
                            let sunday = calendar.date(byAdding: .day, value: 6, to: start) ?? start
                            let opens = calendar.component(.day, from: sunday) <= 7
                            Text(opens ? Self.monthFormat.string(from: sunday) : "")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(.secondary)
                                .fixedSize()
                                .frame(width: cell, height: label, alignment: .topLeading)
                        }
                    }
                }
                HStack(spacing: gap) {
                    ForEach(0..<weeks, id: \.self) { column in
                        VStack(spacing: gap) {
                            ForEach(0..<7, id: \.self) { row in
                                let offset = (column - (weeks - 1)) * 7 + row
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
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: months ? .bottomLeading : .trailing)
        }
        // Wider than tall by its weeks to its days (plus the month labels).
        .aspectRatio(CGFloat(weeks) / (months ? 7.9 : 7), contentMode: .fit)
        .accessibilityElement()
        .accessibilityLabel("\(trainedInView) days trained in the last \(weeks) weeks")
    }

    /// Days trained within the weeks shown (the snapshot holds 26).
    private var trainedInView: Int {
        let calendar = Calendar(identifier: .iso8601)
        let monday = calendar.dateInterval(of: .weekOfYear, for: today)?.start ?? today
        guard let first = calendar.date(byAdding: .day, value: -(weeks - 1) * 7, to: monday) else { return days.count }
        let from = RecoveryCache.dayKey(first)
        return days.filter { $0 >= from }.count
    }
}
