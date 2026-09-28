import SwiftUI
import WidgetKit

/// This week's working sets per muscle, the dashboard's main chart, laid out
/// like Screen Time's bars: a row per muscle, its bar on a see-through track
/// with the 10–20 set range marked, and the count. A bar inside the range
/// takes the tint; the lifter's weak points carry a dot. Medium shows the
/// weak points and the most trained muscles; large shows them all. Resets to
/// zero when the week rolls over.
struct MuscleSetsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MuscleSets", provider: NextBoutProvider()) { entry in
            MuscleSetsView(entry: entry)
                .containerBackground(for: .widget) { Brand.widgetBackground }
                .widgetURL(URL(string: "https://hellblazer.vercel.app/dashboard"))
        }
        .configurationDisplayName("Sets per Muscle")
        .description("This week's working sets for each muscle, against the 10–20 set range.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

private enum Band {
    static let low = 10.0
    static let high = 20.0
}

struct MuscleSetsView: View {
    @Environment(\.widgetFamily) private var family
    let entry: NextBoutEntry

    var body: some View {
        if let snapshot = entry.snapshot, let muscles = snapshot.muscles, !muscles.isEmpty {
            let rows = visibleRows(muscles, stale: snapshot.isFromPastWeek(now: entry.date))
            let scale = max(Band.high + 4, rows.map(\.sets).max() ?? 0)
            let total = rows.reduce(0) { $0 + $1.sets }
            VStack(alignment: .leading, spacing: 0) {
                WidgetHeader(title: "Sets this week", symbol: "flame.fill", trailing: "Goal 10–20")
                if family == .systemLarge {
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(number(total))
                            .font(WidgetStyle.figure(28))
                            .monospacedDigit()
                        Text("working sets")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 2)
                    .padding(.bottom, 6)
                }
                VStack(spacing: 0) {
                    ForEach(rows, id: \.key) { row in
                        MuscleRow(row: row, scale: scale)
                            .frame(maxHeight: .infinity)
                    }
                }
                .padding(.top, family == .systemLarge ? 0 : 4)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else {
            WidgetEmpty(title: "Sets this week", symbol: "flame.fill", message: "Open Fatty to see this week's sets per muscle here.")
        }
    }

    /// Large: every muscle, in the chart's order. Medium has room for five:
    /// the weak points first, then whatever's been trained most.
    private func visibleRows(_ muscles: [WidgetSnapshot.MuscleSets], stale: Bool) -> [WidgetSnapshot.MuscleSets] {
        let rows = stale ? muscles.map { row in
            var zeroed = row
            zeroed.sets = 0
            return zeroed
        } : muscles
        guard family != .systemLarge else { return rows }
        let weak = rows.filter(\.weak)
        let rest = rows.filter { !$0.weak }.sorted { $0.sets > $1.sets }
        return Array((weak + rest).prefix(5))
    }
}

private func number(_ value: Double) -> String {
    value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
}

private struct MuscleRow: View {
    let row: WidgetSnapshot.MuscleSets
    let scale: Double

    private var inBand: Bool { row.sets >= Band.low }

    var body: some View {
        HStack(spacing: 8) {
            HStack(spacing: 5) {
                Text(row.label)
                    .font(.caption)
                    .foregroundStyle(inBand ? .primary : .secondary)
                    .lineLimit(1)
                if row.weak {
                    Circle()
                        .fill(Brand.flame)
                        .frame(width: 5, height: 5)
                        .widgetAccentable()
                        .accessibilityLabel("Weak point")
                }
            }
            .frame(width: 88, alignment: .leading)

            GeometryReader { geo in
                let width = geo.size.width
                ZStack(alignment: .leading) {
                    Capsule().fill(WidgetStyle.track)
                    if row.sets > 0 {
                        Capsule()
                            .fill(inBand ? AnyShapeStyle(Brand.flame) : AnyShapeStyle(Color.primary.opacity(0.45)))
                            .frame(width: max(6, width * min(row.sets, scale) / scale))
                            .widgetAccentable(inBand)
                    }
                    // The goal: a tick at 10 sets and one at 20.
                    ForEach([Band.low, Band.high], id: \.self) { mark in
                        Capsule()
                            .fill(Color.primary.opacity(0.35))
                            .frame(width: 1.5, height: 10)
                            .offset(x: width * mark / scale - 0.75)
                    }
                }
            }
            .frame(height: 10)

            Text(number(row.sets))
                .font(.caption.weight(.medium))
                .monospacedDigit()
                .foregroundStyle(inBand ? .primary : .secondary)
                .frame(width: 26, alignment: .trailing)
        }
    }
}
