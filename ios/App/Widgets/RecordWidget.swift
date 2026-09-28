import SwiftUI
import WidgetKit

/// Your latest record, a Removal as the logger calls one: the lift, the set
/// behind it, the estimated max, and how long ago. From the snapshot
/// (src/lib/widget-moments.ts latestRecord).
struct RecordWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Record", provider: RecordProvider()) { entry in
            RecordView(entry: entry)
                .containerBackground(for: .widget) { Brand.background }
                .widgetURL(URL(string: "https://hellblazer.vercel.app/progress"))
        }
        .configurationDisplayName("Last PR")
        .description("Your latest record, and how long ago you set it.")
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryInline])
    }
}

struct RecordEntry: TimelineEntry {
    let date: Date
    /// False before the app has written a snapshot.
    let known: Bool
    let record: WidgetSnapshot.Record?
    let unit: String
}

struct RecordProvider: TimelineProvider {
    func placeholder(in context: Context) -> RecordEntry {
        RecordEntry(
            date: Date(),
            known: true,
            record: WidgetSnapshot.Record(
                name: "Barbell Bench Press", weight: 100, reps: 3, estimatedMax: 110,
                date: RecoveryCache.dayKey(Date().addingTimeInterval(-2 * 86_400))
            ),
            unit: "kg"
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (RecordEntry) -> Void) {
        let entry = makeEntry(at: Date())
        completion(context.isPreview && entry.record == nil ? placeholder(in: context) : entry)
    }

    /// Now, then each midnight for a week, so "2 days ago" stays right.
    func getTimeline(in context: Context, completion: @escaping (Timeline<RecordEntry>) -> Void) {
        let calendar = Calendar.current
        let now = Date()
        var entries = [makeEntry(at: now)]
        for day in 1...7 {
            if let midnight = calendar.date(byAdding: .day, value: day, to: calendar.startOfDay(for: now)) {
                entries.append(makeEntry(at: midnight))
            }
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    private func makeEntry(at date: Date) -> RecordEntry {
        let snapshot = WidgetSnapshot.load()
        return RecordEntry(date: date, known: snapshot != nil, record: snapshot?.record, unit: snapshot?.unit ?? "kg")
    }
}

struct RecordView: View {
    @Environment(\.widgetFamily) private var family
    let entry: RecordEntry

    var body: some View {
        if let record = entry.record {
            switch family {
            case .accessoryInline:
                Label("PR: \(record.name), \(setText(record))", systemImage: "bolt.fill")
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Label("Last PR", systemImage: "bolt.fill")
                        .font(.caption2.weight(.semibold))
                        .widgetAccentable()
                    Text(record.name)
                        .font(.headline)
                        .lineLimit(1)
                    Text("\(setText(record)), \(ago(record).lowercased())")
                        .font(.caption2)
                        .monospacedDigit()
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            default:
                small(record)
            }
        } else {
            empty
        }
    }

    private func small(_ record: WidgetSnapshot.Record) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Label("Removal", systemImage: "bolt.fill")
                .font(.caption.weight(.bold))
                .foregroundStyle(Brand.flame)
            Text(record.name)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Brand.bone)
                .lineLimit(2)
                .padding(.top, 4)
            Spacer(minLength: 4)
            Text(setText(record))
                .font(.system(size: 24, weight: .black).width(.expanded))
                .foregroundStyle(Brand.bone)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            Text("Est. max \(number(record.estimatedMax)) \(entry.unit)")
                .font(.caption2.weight(.medium))
                .foregroundStyle(Brand.muted)
                .monospacedDigit()
                .lineLimit(1)
            Text(ago(record))
                .font(.caption2)
                .foregroundStyle(Brand.muted)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    private var empty: some View {
        let message = entry.known ? "Beat a best and it shows up here." : "Open Fatty to see your records."
        switch family {
        case .accessoryInline:
            Label("No PR yet", systemImage: "bolt")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Label("Last PR", systemImage: "bolt")
                    .font(.caption2.weight(.semibold))
                    .widgetAccentable()
                Text("None yet")
                    .font(.headline)
                Text(message)
                    .font(.caption2)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        default:
            VStack(alignment: .leading, spacing: 6) {
                Label("Removal", systemImage: "bolt")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Brand.muted)
                Spacer(minLength: 0)
                Text(message)
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    /// "100 kg × 3", "Bodyweight × 12".
    private func setText(_ record: WidgetSnapshot.Record) -> String {
        let load = record.weight == 0 ? "Bodyweight" : "\(number(record.weight)) \(entry.unit)"
        return "\(load) × \(record.reps)"
    }

    private func number(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
    }

    /// "Today", "Yesterday", "3 days ago", "2 weeks ago", "12 Aug".
    private func ago(_ record: WidgetSnapshot.Record) -> String {
        let parser = DateFormatter()
        parser.calendar = Calendar(identifier: .gregorian)
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd"
        guard let day = parser.date(from: record.date) else { return "" }
        let calendar = Calendar.current
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: day), to: calendar.startOfDay(for: entry.date)).day ?? 0
        switch days {
        case ..<1: return "Today"
        case 1: return "Yesterday"
        case 2..<14: return "\(days) days ago"
        case 14..<56: return "\(days / 7) weeks ago"
        default:
            let out = DateFormatter()
            out.dateFormat = "d MMM"
            return out.string(from: day)
        }
    }
}
