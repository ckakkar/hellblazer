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
                .fightCard()
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
                    TrendChart(points: trend.points, color: .primary, area: false)
                        .frame(height: 14)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            case .systemMedium:
                HStack(alignment: .top, spacing: 14) {
                    VStack(alignment: .leading, spacing: 0) {
                        WidgetHeader(title: trend.name, symbol: "chart.line.uptrend.xyaxis")
                        figure(last.e1rm, size: 34)
                            .padding(.top, 4)
                        Text("Estimated max")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer(minLength: 4)
                        changeLabel(change, sessions: trend.points.count)
                    }
                    .frame(width: 130, alignment: .leading)
                    TrendChart(points: trend.points, color: Brand.flame, area: true)
                        .padding(.vertical, 6)
                }
            default:
                VStack(alignment: .leading, spacing: 0) {
                    WidgetHeader(title: trend.name, symbol: "chart.line.uptrend.xyaxis")
                    figure(last.e1rm, size: 28)
                        .padding(.top, 2)
                    changeLabel(change, sessions: trend.points.count)
                    TrendChart(points: trend.points, color: Brand.flame, area: true)
                        .padding(.top, 8)
                }
            }
        } else {
            WidgetEmpty(
                title: "Lift Trend",
                symbol: "chart.line.uptrend.xyaxis",
                message: entry.missing.map { "Log \($0) to see its trend here." } ?? "Open Fatty and log a lift to see its trend here."
            )
        }
    }

    private func figure(_ value: Double, size: CGFloat) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text(number(value))
                .font(WidgetStyle.figure(size))
                .monospacedDigit()
                .contentTransition(.numericText(value: value))
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(entry.unit)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }

    private func changeLabel(_ change: Double, sessions: Int) -> some View {
        HStack(spacing: 3) {
            if sessions > 1 {
                Image(systemName: change > 0 ? "arrow.up.right" : change < 0 ? "arrow.down.right" : "arrow.right")
            }
            Text(changeText(change, sessions: sessions))
        }
        .font(.caption.weight(.medium))
        .monospacedDigit()
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .minimumScaleFactor(0.85)
    }

    private func number(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
    }

    private func changeText(_ change: Double, sessions: Int) -> String {
        guard sessions > 1 else { return "First session" }
        let sign = change > 0 ? "+" : change < 0 ? "−" : "±"
        return "\(sign)\(number(abs(change))) \(entry.unit) in \(sessions) sessions"
    }
}

/// The estimated max per session, evenly spaced, the latest one marked, over
/// a fade of the tint (see-through, so it keeps its shape in Clear and Tinted).
private struct TrendChart: View {
    let points: [WidgetSnapshot.Trend.Point]
    let color: Color
    let area: Bool

    var body: some View {
        let values = points.map(\.e1rm)
        let low = values.min() ?? 0
        let high = values.max() ?? 1
        let pad = max(1, (high - low) * 0.2)
        Chart {
            ForEach(Array(points.enumerated()), id: \.offset) { index, point in
                if area {
                    AreaMark(
                        x: .value("Session", index),
                        yStart: .value("Floor", low - pad),
                        yEnd: .value("Est. max", point.e1rm)
                    )
                    .interpolationMethod(.monotone)
                    .foregroundStyle(LinearGradient(colors: [color.opacity(0.28), color.opacity(0)], startPoint: .top, endPoint: .bottom))
                }
                LineMark(x: .value("Session", index), y: .value("Est. max", point.e1rm))
                    .interpolationMethod(.monotone)
                    .foregroundStyle(color)
                    .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
            }
            if let last = points.last {
                PointMark(x: .value("Session", points.count - 1), y: .value("Est. max", last.e1rm))
                    .foregroundStyle(color)
                    .symbolSize(36)
            }
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartLegend(.hidden)
        .chartYScale(domain: (low - pad)...(high + pad))
        .glow(radius: 5)
        .widgetAccentable()
    }
}
