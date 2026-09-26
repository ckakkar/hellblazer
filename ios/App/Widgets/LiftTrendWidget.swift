import AppIntents
import Charts
import SwiftUI
import WidgetKit

/// One lift's estimated max over its recent sessions. Long-press the widget,
/// Edit, and pick the lift; until then it shows the lift you train most.
/// Tapping it opens that lift's progress.
struct LiftTrendWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "LiftTrend", intent: SelectLiftIntent.self, provider: LiftTrendProvider()) { entry in
            LiftTrendView(entry: entry)
                .containerBackground(for: .widget) { Brand.background }
                .widgetURL(URL(string: "https://hellblazer.vercel.app/progress" + (entry.trend.map { "?exercise=\($0.id)" } ?? "")))
        }
        .configurationDisplayName("Lift Trend")
        .description("One lift's estimated max over your recent sessions.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

/// The widget's one setting: which lift.
struct SelectLiftIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Choose a Lift"
    static let description = IntentDescription("The lift whose estimated max to chart.")

    @Parameter(title: "Lift")
    var lift: LiftEntity?

    init() {}
}

struct LiftTrendEntry: TimelineEntry {
    let date: Date
    let trend: WidgetSnapshot.Trend?
    let unit: String
    /// A lift was picked that has no history (yet).
    let missing: String?
}

struct LiftTrendProvider: AppIntentTimelineProvider {
    private static let sample = WidgetSnapshot.Trend(
        id: "sample",
        name: "Barbell Bench Press",
        points: [92.5, 95, 94, 97.5, 99, 100.5, 102, 104.5].enumerated().map { index, value in
            WidgetSnapshot.Trend.Point(date: "2026-0\(1 + index / 4)-1\(index % 4)", e1rm: value)
        }
    )

    func placeholder(in context: Context) -> LiftTrendEntry {
        LiftTrendEntry(date: Date(), trend: Self.sample, unit: "kg", missing: nil)
    }

    func snapshot(for configuration: SelectLiftIntent, in context: Context) async -> LiftTrendEntry {
        let entry = entry(for: configuration)
        return context.isPreview && entry.trend == nil ? placeholder(in: context) : entry
    }

    func timeline(for configuration: SelectLiftIntent, in context: Context) async -> Timeline<LiftTrendEntry> {
        // Redrawn when the app writes a new snapshot (reloadAllTimelines).
        Timeline(entries: [entry(for: configuration)], policy: .never)
    }

    private func entry(for configuration: SelectLiftIntent) -> LiftTrendEntry {
        let snapshot = WidgetSnapshot.load()
        let trends = snapshot?.trends ?? []
        let unit = snapshot?.unit ?? "kg"
        guard let lift = configuration.lift else {
            return LiftTrendEntry(date: Date(), trend: trends.first, unit: unit, missing: nil)
        }
        let trend = trends.first { $0.id == lift.id }
        return LiftTrendEntry(date: Date(), trend: trend, unit: unit, missing: trend == nil ? lift.name : nil)
    }
}

struct LiftTrendView: View {
    @Environment(\.widgetFamily) private var family
    let entry: LiftTrendEntry

    var body: some View {
        if let trend = entry.trend, let first = trend.points.first, let last = trend.points.last {
            let change = last.e1rm - first.e1rm
            switch family {
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text(trend.name)
                        .font(.caption2.weight(.semibold))
                        .lineLimit(1)
                        .widgetAccentable()
                    Text("\(number(last.e1rm)) \(entry.unit) est. max")
                        .font(.headline)
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    TrendChart(points: trend.points, color: .primary)
                        .frame(height: 14)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            default:
                VStack(alignment: .leading, spacing: 3) {
                    Text(trend.name)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Brand.muted)
                        .lineLimit(1)
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text(number(last.e1rm))
                            .font(.system(family == .systemSmall ? .title2 : .title, design: .rounded).weight(.bold))
                            .monospacedDigit()
                            .foregroundStyle(Brand.bone)
                        Text("\(entry.unit) est. max")
                            .font(.caption2)
                            .foregroundStyle(Brand.muted)
                            .lineLimit(1)
                    }
                    Text(changeText(change, sessions: trend.points.count))
                        .font(.caption2)
                        .monospacedDigit()
                        .foregroundStyle(change > 0 ? Brand.bone : Brand.muted)
                        .lineLimit(1)
                    TrendChart(points: trend.points, color: Brand.flame)
                        .padding(.top, 4)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 4) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .foregroundStyle(Brand.flame)
                Text(entry.missing.map { "Log \($0) to see its trend here." } ?? "Open Fatty and log a lift to see its trend here.")
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    private func number(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
    }

    private func changeText(_ change: Double, sessions: Int) -> String {
        guard sessions > 1 else { return "First session" }
        let sign = change > 0 ? "+" : change < 0 ? "−" : "±"
        return "\(sign)\(number(abs(change))) \(entry.unit) over \(sessions) sessions"
    }
}

/// The estimated max per session, evenly spaced, the latest one marked.
private struct TrendChart: View {
    let points: [WidgetSnapshot.Trend.Point]
    let color: Color

    var body: some View {
        let values = points.map(\.e1rm)
        let low = values.min() ?? 0
        let high = values.max() ?? 1
        let pad = max(1, (high - low) * 0.2)
        Chart {
            ForEach(Array(points.enumerated()), id: \.offset) { index, point in
                LineMark(x: .value("Session", index), y: .value("Est. max", point.e1rm))
                    .interpolationMethod(.monotone)
                    .foregroundStyle(color)
                    .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
            }
            if let last = points.last {
                PointMark(x: .value("Session", points.count - 1), y: .value("Est. max", last.e1rm))
                    .foregroundStyle(color)
                    .symbolSize(28)
            }
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartLegend(.hidden)
        .chartYScale(domain: (low - pad)...(high + pad))
    }
}
