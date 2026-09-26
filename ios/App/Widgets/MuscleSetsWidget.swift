import SwiftUI
import WidgetKit

/// This week's working sets per muscle, the dashboard's main chart: one bar
/// per muscle over the shaded 10–20 set band where most growth comes from. A
/// muscle under the band reads dim, one inside it bright; the lifter's weak
/// points carry the flame. Medium shows the weak points and the most trained
/// muscles; large shows them all. Resets to zero when the week rolls over.
struct MuscleSetsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MuscleSets", provider: NextBoutProvider()) { entry in
            MuscleSetsView(entry: entry)
                .containerBackground(for: .widget) { Brand.background }
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
            let scale = max(Band.high, rows.map(\.sets).max() ?? 0)
            VStack(alignment: .leading, spacing: family == .systemLarge ? 9 : 5) {
                HStack(alignment: .firstTextBaseline) {
                    Label("Sets this week", systemImage: "flame.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Brand.flame)
                    Spacer(minLength: 8)
                    Text("10–20 target")
                        .font(.caption2)
                        .foregroundStyle(Brand.muted)
                }
                ForEach(rows, id: \.key) { row in
                    MuscleBar(row: row, scale: scale)
                }
                if family == .systemLarge { Spacer(minLength: 0) }
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: "flame.fill")
                    .foregroundStyle(Brand.flame)
                Text("Open Fatty to see this week's sets per muscle here.")
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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

private struct MuscleBar: View {
    let row: WidgetSnapshot.MuscleSets
    let scale: Double

    private var inBand: Bool { row.sets >= Band.low }

    var body: some View {
        HStack(spacing: 8) {
            HStack(spacing: 4) {
                Circle()
                    .fill(row.weak ? Brand.flame : Color.clear)
                    .frame(width: 5, height: 5)
                Text(row.label)
                    .font(.caption2)
                    .foregroundStyle(inBand ? Brand.bone : Brand.muted)
                    .lineLimit(1)
            }
            .frame(width: 82, alignment: .leading)

            GeometryReader { geo in
                let width = geo.size.width
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Brand.surface)
                    // The 10–20 band.
                    Rectangle()
                        .fill(Brand.bone.opacity(0.1))
                        .frame(width: width * (Band.high - Band.low) / scale)
                        .offset(x: width * Band.low / scale)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(inBand ? Brand.bone : Brand.muted.opacity(0.75))
                        .frame(width: row.sets > 0 ? max(3, width * min(row.sets, scale) / scale) : 0)
                }
            }
            .frame(height: 7)

            Text(row.sets.rounded() == row.sets ? String(Int(row.sets)) : String(format: "%.1f", row.sets))
                .font(.caption2)
                .monospacedDigit()
                .foregroundStyle(inBand ? Brand.bone : Brand.muted)
                .frame(width: 28, alignment: .trailing)
        }
    }
}
