import SwiftUI
import WidgetKit

@main
struct FattyWatchWidgets: WidgetBundle {
    var body: some Widget {
        FattyComplication()
    }
}

/// Fatty on the watch face and in the Smart Stack: the next programmed day
/// and the week against the plan, or the workout in progress with its clock.
/// Tapping it opens the app. The watch app keeps the data current
/// (ComplicationData); the clock runs on its own.
struct FattyComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FattyComplication", provider: ComplicationProvider()) { entry in
            ComplicationView(entry: entry)
                .containerBackground(for: .widget) { Color.black }
        }
        .configurationDisplayName("Fatty")
        .description("Your next workout and this week's training, or the workout you're in.")
        .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline, .accessoryRectangular])
    }
}

struct ComplicationEntry: TimelineEntry {
    let date: Date
    let data: ComplicationData?
}

struct ComplicationProvider: TimelineProvider {
    private static let sample = ComplicationData(
        nextLabel: "Day 2: Upper",
        weekStart: "2026-01-05",
        sessions: 3,
        planned: 5,
        sets: 58
    )

    func placeholder(in context: Context) -> ComplicationEntry {
        ComplicationEntry(date: Date(), data: Self.sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (ComplicationEntry) -> Void) {
        let data = ComplicationData.load()
        completion(ComplicationEntry(date: Date(), data: context.isPreview ? (data ?? Self.sample) : data))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ComplicationEntry>) -> Void) {
        let data = ComplicationData.load()
        var entries = [ComplicationEntry(date: Date(), data: data)]
        // A new week starts at zero on its own.
        if let end = data?.weekEnd, end > Date() {
            entries.append(ComplicationEntry(date: end, data: data))
        }
        completion(Timeline(entries: entries, policy: .never))
    }
}

struct ComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ComplicationEntry

    var body: some View {
        let data = entry.data?.asOf(entry.date)
        switch family {
        case .accessoryCircular:
            circular(data)
        case .accessoryCorner:
            Image(systemName: data?.activeTitle != nil ? "figure.strengthtraining.traditional" : "flame.fill")
                .font(.title2)
                .widgetAccentable()
                .widgetLabel {
                    if let start = data?.activeStartDate, data?.activeTitle != nil {
                        Text(start, style: .timer)
                    } else if let data, let planned = data.planned, planned > 0 {
                        Gauge(value: Double(min(data.sessions, planned)), in: 0...Double(planned)) {
                            Text("Fatty")
                        } currentValueLabel: {
                            Text("\(data.sessions)")
                        }
                    } else {
                        Text(data.map { "\($0.sessions) this week" } ?? "Fatty")
                    }
                }
        case .accessoryInline:
            if let data, data.activeTitle != nil, let start = data.activeStartDate {
                Label {
                    Text(start, style: .timer)
                } icon: {
                    Image(systemName: "figure.strengthtraining.traditional")
                }
            } else {
                Label(data?.nextLabel.map { "Next: \($0)" } ?? "Fatty", systemImage: "flame.fill")
            }
        default:
            rectangular(data)
        }
    }

    @ViewBuilder
    private func circular(_ data: ComplicationData?) -> some View {
        if let data, data.activeTitle != nil {
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "figure.strengthtraining.traditional")
                    .font(.title3)
                    .widgetAccentable()
            }
        } else if let data, let planned = data.planned, planned > 0 {
            Gauge(value: Double(min(data.sessions, planned)), in: 0...Double(planned)) {
                Image(systemName: "flame.fill")
            } currentValueLabel: {
                Text("\(data.sessions)")
            }
            .gaugeStyle(.accessoryCircularCapacity)
            .widgetAccentable()
        } else {
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "flame.fill")
                    .font(.title3)
                    .widgetAccentable()
            }
        }
    }

    private func rectangular(_ data: ComplicationData?) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Label("Fatty", systemImage: "flame.fill")
                .font(.system(.footnote, design: .rounded).weight(.semibold))
                .foregroundStyle(Brand.flame)
                .widgetAccentable()
            if let data, let title = data.activeTitle {
                Text(title)
                    .font(.system(.headline, design: .rounded))
                    .lineLimit(1)
                if let start = data.activeStartDate {
                    Text(start, style: .timer)
                        .font(.system(.body, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(.yellow)
                }
            } else if let data {
                Text(data.nextLabel.map { "Next: \($0)" } ?? "No program")
                    .font(.system(.headline, design: .rounded))
                    .lineLimit(1)
                Text(weekLine(data))
                    .font(.system(.footnote, design: .rounded))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            } else {
                Text("Open Fatty to set up")
                    .font(.system(.footnote, design: .rounded))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func weekLine(_ data: ComplicationData) -> String {
        let sessions = data.planned.map { "\(data.sessions)/\($0)" } ?? "\(data.sessions)"
        return "\(sessions) this week, \(data.sets) sets"
    }
}
