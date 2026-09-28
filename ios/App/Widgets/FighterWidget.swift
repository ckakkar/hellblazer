import SwiftUI
import WidgetKit

/// Your rank fighter on the Home Screen: the portrait, the rank, the ladder
/// and who's next, as the rank card on Home has them. The app keeps the
/// portrait (FighterArt) and the rank in the snapshot; the rank only moves
/// when the judge rules, so it redraws when the app says.
struct FighterWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: FighterArt.widgetKind, provider: FighterProvider()) { entry in
            FighterView(entry: entry)
                .containerBackground(for: .widget) { Brand.background }
                .widgetURL(URL(string: "https://hellblazer.vercel.app/dashboard"))
        }
        .configurationDisplayName("Your Fighter")
        .description("Your rank fighter, and who's next up the ladder.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
        .contentMarginsDisabled()
    }
}

struct FighterEntry: TimelineEntry {
    let date: Date
    /// False before the app has written a snapshot.
    let known: Bool
    let fighter: WidgetSnapshot.Fighter?
    let portrait: UIImage?
}

struct FighterProvider: TimelineProvider {
    private static let sample = WidgetSnapshot.Fighter(
        key: "julius", name: "Julius Reinhold", epithet: "The Monster",
        rank: 5, of: 10, next: "Raian Kure", image: "/art/fighters/julius.webp"
    )

    func placeholder(in context: Context) -> FighterEntry {
        FighterEntry(date: Date(), known: true, fighter: Self.sample, portrait: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (FighterEntry) -> Void) {
        let entry = current()
        completion(context.isPreview && entry.fighter == nil ? placeholder(in: context) : entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FighterEntry>) -> Void) {
        completion(Timeline(entries: [current()], policy: .never))
    }

    private func current() -> FighterEntry {
        let snapshot = WidgetSnapshot.load()
        let fighter = snapshot?.fighter
        return FighterEntry(
            date: Date(),
            known: snapshot != nil,
            fighter: fighter,
            portrait: fighter.flatMap { FighterArt.load(for: $0.key) }
        )
    }
}

struct FighterView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FighterEntry

    var body: some View {
        if let fighter = entry.fighter {
            switch family {
            case .accessoryRectangular: rectangular(fighter)
            case .systemMedium: medium(fighter)
            default: small(fighter)
            }
        } else {
            unranked
        }
    }

    // MARK: Home Screen

    private func small(_ fighter: WidgetSnapshot.Fighter) -> some View {
        ZStack(alignment: .bottomLeading) {
            portrait
            LinearGradient(
                colors: [.clear, Brand.background.opacity(0.85), Brand.background],
                startPoint: UnitPoint(x: 0.5, y: 0.35),
                endPoint: .bottom
            )
            VStack(alignment: .leading, spacing: 3) {
                rankLine(fighter)
                Text(firstName(fighter))
                    .font(.system(size: 24, weight: .black).width(.expanded))
                    .foregroundStyle(Brand.bone)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Text(fighter.epithet)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(Brand.muted)
                    .lineLimit(1)
                Ladder(rank: fighter.rank, of: fighter.of)
                    .padding(.top, 4)
            }
            .padding(14)
        }
    }

    private func medium(_ fighter: WidgetSnapshot.Fighter) -> some View {
        HStack(spacing: 0) {
            ZStack(alignment: .trailing) {
                portrait
                LinearGradient(colors: [.clear, Brand.background], startPoint: UnitPoint(x: 0.55, y: 0.5), endPoint: .trailing)
            }
            .frame(width: 140)
            .clipped()

            VStack(alignment: .leading, spacing: 4) {
                rankLine(fighter)
                Text(fighter.name)
                    .font(.system(size: 22, weight: .black).width(.expanded))
                    .foregroundStyle(Brand.bone)
                    .lineLimit(2)
                    .minimumScaleFactor(0.6)
                Text(fighter.epithet)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Brand.muted)
                    .lineLimit(1)
                Spacer(minLength: 6)
                Ladder(rank: fighter.rank, of: fighter.of)
                Text(fighter.next.map { "Next, \($0)" } ?? "Top of the ladder")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(Brand.muted)
                    .lineLimit(1)
                    .padding(.top, 2)
            }
            .padding(.vertical, 16)
            .padding(.trailing, 16)
            .padding(.leading, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private var portrait: some View {
        if let image = entry.portrait {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .clipped()
        } else {
            // The portrait's still on its way from the site.
            Image(systemName: "figure.martial.arts")
                .font(.system(size: 54, weight: .light))
                .foregroundStyle(Brand.muted.opacity(0.35))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func rankLine(_ fighter: WidgetSnapshot.Fighter) -> some View {
        Text("Rank \(fighter.rank) of \(fighter.of)")
            .font(.caption2.weight(.bold))
            .foregroundStyle(Brand.flame)
            .monospacedDigit()
    }

    private func firstName(_ fighter: WidgetSnapshot.Fighter) -> String {
        fighter.name.split(separator: " ").first.map(String.init) ?? fighter.name
    }

    // MARK: Lock Screen

    private func rectangular(_ fighter: WidgetSnapshot.Fighter) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("Rank \(fighter.rank) of \(fighter.of)")
                .font(.caption2.weight(.semibold))
                .widgetAccentable()
            Text(fighter.name)
                .font(.headline)
                .lineLimit(1)
            Text(fighter.next.map { "Next, \($0)" } ?? "Top of the ladder")
                .font(.caption2)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: No rank yet

    @ViewBuilder
    private var unranked: some View {
        let message = entry.known ? "Log a workout, then ask the judge." : "Open Fatty to meet your fighter."
        if family == .accessoryRectangular {
            VStack(alignment: .leading, spacing: 1) {
                Text("Your fighter")
                    .font(.caption2.weight(.semibold))
                    .widgetAccentable()
                Text("No rank yet")
                    .font(.headline)
                Text(message)
                    .font(.caption2)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            VStack(alignment: .leading, spacing: 4) {
                Image(systemName: "figure.martial.arts")
                    .font(.title2)
                    .foregroundStyle(Brand.muted)
                Spacer(minLength: 0)
                Text("No rank yet")
                    .font(.system(size: 20, weight: .black).width(.expanded))
                    .foregroundStyle(Brand.bone)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(message)
                    .font(.caption)
                    .foregroundStyle(Brand.muted)
                Ladder(rank: 0, of: 10)
                    .padding(.top, 4)
            }
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

/// The ladder, as on Home: a step per rank, lit up to yours.
private struct Ladder: View {
    let rank: Int
    let of: Int

    var body: some View {
        HStack(spacing: 3) {
            ForEach(1...max(1, of), id: \.self) { step in
                Capsule()
                    .fill(step <= rank ? Brand.flame : Brand.bone.opacity(0.16))
                    .frame(height: 4)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Rank \(rank) of \(of)")
    }
}
