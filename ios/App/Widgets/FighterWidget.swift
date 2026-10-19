import SwiftUI
import WidgetKit

/// Your rank fighter on the Home Screen: the portrait, the rank, the ladder
/// and who's next, as the rank card on Home has them. The iPad's extra large
/// is the whole fight card: the fighter, and your week, streak, next bout
/// and latest record beside them. Art-led, like the
/// Music and Photos widgets: dark in every look. In Clear and Tinted it
/// shows the see-through portrait (ClearArt), and fades with transparency
/// rather than a dark overlay, which those looks would turn white.
struct FighterWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: FighterArt.widgetKind, provider: FighterProvider()) { entry in
            FighterView(entry: entry)
                .fightCard()
                .widgetURL(URL(string: "https://hellblazer.vercel.app/dashboard"))
        }
        .configurationDisplayName("Your Fighter")
        .description("Your rank fighter, and who's next up the ladder.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemExtraLarge, .accessoryRectangular])
        .contentMarginsDisabled()
    }
}

struct FighterEntry: TimelineEntry {
    let date: Date
    /// False before the app has written a snapshot.
    let known: Bool
    let fighter: WidgetSnapshot.Fighter?
    let portrait: UIImage?
    /// The see-through portrait, for the Clear and Tinted looks, and the
    /// fighter in ink should that be missing.
    let clear: UIImage?
    let ink: UIImage?
    /// The rest of the card, for the extra large size.
    var snapshot: WidgetSnapshot? = nil
}

struct FighterProvider: TimelineProvider {
    private static let sample = WidgetSnapshot.Fighter(
        key: "julius", name: "Julius Reinhold", epithet: "The Monster",
        rank: 5, of: 10, next: "Raian Kure", image: "/art/fighters/julius.webp"
    )

    func placeholder(in context: Context) -> FighterEntry {
        FighterEntry(date: Date(), known: true, fighter: Self.sample, portrait: nil, clear: nil, ink: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (FighterEntry) -> Void) {
        let entry = current()
        completion(context.isPreview && entry.fighter == nil ? placeholder(in: context) : entry)
    }

    /// Now, and again when the week rolls over, so the fight card's week
    /// starts at zero on its own.
    func getTimeline(in context: Context, completion: @escaping (Timeline<FighterEntry>) -> Void) {
        let now = current()
        var entries = [now]
        if let weekEnd = now.snapshot?.weekEnd(), weekEnd > now.date {
            entries.append(FighterEntry(
                date: weekEnd, known: now.known, fighter: now.fighter, portrait: now.portrait,
                clear: now.clear, ink: now.ink, snapshot: now.snapshot
            ))
        }
        completion(Timeline(entries: entries, policy: .never))
    }

    private func current() -> FighterEntry {
        let snapshot = WidgetSnapshot.load()
        let fighter = snapshot?.fighter
        return FighterEntry(
            date: Date(),
            known: snapshot != nil,
            fighter: fighter,
            portrait: fighter.flatMap { FighterArt.load(for: $0.key) },
            clear: fighter.flatMap { FighterArt.loadClear(for: $0.key) },
            ink: fighter.flatMap { FighterArt.loadInk(for: $0.key) },
            snapshot: snapshot
        )
    }
}

struct FighterView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetRenderingMode) private var renderingMode
    let entry: FighterEntry

    var body: some View {
        Group {
            if let fighter = entry.fighter {
                switch family {
                case .accessoryRectangular: rectangular(fighter)
                case .systemMedium: medium(fighter)
                case .systemExtraLarge: extraLarge(fighter)
                default: small(fighter)
                }
            } else {
                unranked
            }
        }
        .environment(\.colorScheme, .dark)
    }

    // MARK: Home Screen

    private func small(_ fighter: WidgetSnapshot.Fighter) -> some View {
        ZStack(alignment: .bottomLeading) {
            portrait
                .mask(LinearGradient(
                    stops: [.init(color: .black, location: 0.2), .init(color: .clear, location: 0.78)],
                    startPoint: .top,
                    endPoint: .bottom
                ))
            VStack(alignment: .leading, spacing: 1) {
                rankLine(fighter)
                Text(firstName(fighter))
                    .font(WidgetStyle.title(20))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(fighter.epithet)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Ladder(rank: fighter.rank, of: fighter.of)
                    .padding(.top, 6)
            }
            .padding(14)
        }
    }

    private func medium(_ fighter: WidgetSnapshot.Fighter) -> some View {
        HStack(spacing: 0) {
            portrait
                .frame(width: 150)
                .mask(LinearGradient(
                    stops: [.init(color: .black, location: 0.55), .init(color: .clear, location: 1)],
                    startPoint: .leading,
                    endPoint: .trailing
                ))
            VStack(alignment: .leading, spacing: 2) {
                rankLine(fighter)
                Text(fighter.name)
                    .font(WidgetStyle.title(22))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)
                Text(fighter.epithet)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Spacer(minLength: 6)
                Ladder(rank: fighter.rank, of: fighter.of)
                Text(fighter.next.map { "Next: \($0)" } ?? "Top of the ladder")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .padding(.top, 4)
            }
            .padding(.vertical, 16)
            .padding(.trailing, 16)
            .padding(.leading, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// The fight card (iPad): the portrait down the left, fading into the
    /// black; the name at poster size, the ladder, then the week ruled off
    /// beneath like the tale of the tape on Home.
    private func extraLarge(_ fighter: WidgetSnapshot.Fighter) -> some View {
        GeometryReader { geo in
            HStack(spacing: 0) {
                portrait
                    .frame(width: geo.size.width * 0.42)
                    .mask(LinearGradient(
                        stops: [.init(color: .black, location: 0.62), .init(color: .clear, location: 1)],
                        startPoint: .leading,
                        endPoint: .trailing
                    ))
                VStack(alignment: .leading, spacing: 0) {
                    rankLine(fighter)
                    Text(fighter.name)
                        .font(WidgetStyle.figure(46))
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                        .minimumScaleFactor(0.55)
                        .padding(.top, 6)
                    Text(fighter.epithet)
                        .font(.title2.weight(.medium))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Ladder(rank: fighter.rank, of: fighter.of, height: 6)
                        .padding(.top, 14)
                    Text(fighter.next.map { "Next up the ladder: \($0)" } ?? "Top of the ladder")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .padding(.top, 6)
                    Spacer(minLength: 10)
                    if let snapshot = entry.snapshot {
                        CardTape(snapshot: snapshot, date: entry.date)
                    }
                }
                .padding(.vertical, 22)
                .padding(.trailing, 24)
                .padding(.leading, 4)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    /// The portrait for this look: full colour, or see-through in Clear and
    /// Tinted, where a solid image would come out a white block. Should that
    /// be missing there, the ink, else the portrait greyed, as iOS offers.
    @ViewBuilder
    private var portrait: some View {
        let full = renderingMode == .fullColor
        if full, let image = entry.portrait {
            art(Image(uiImage: image).resizable())
        } else if !full, let see = entry.clear ?? entry.ink {
            art(Image(uiImage: see).resizable().renderingMode(.template))
        } else if !full, let image = entry.portrait {
            art(greyed(Image(uiImage: image).resizable()))
        } else {
            // The portrait's still on its way from the site.
            Image(systemName: "figure.martial.arts")
                .font(.system(size: 56, weight: .light))
                .foregroundStyle(.tertiary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    /// Laid over an empty frame, so a tall portrait can't make the widget
    /// taller than it is and push the text off the bottom.
    private func art<Art: View>(_ image: Art) -> some View {
        Color.clear
            .overlay(alignment: .top) {
                image
                    .scaledToFill()
                    .foregroundStyle(Color.white)
            }
            .clipped()
    }

    @ViewBuilder
    private func greyed(_ image: Image) -> some View {
        if #available(iOS 18.0, *) {
            image.widgetAccentedRenderingMode(.desaturated)
        } else {
            image
        }
    }

    private func rankLine(_ fighter: WidgetSnapshot.Fighter) -> some View {
        Text("Rank \(fighter.rank) of \(fighter.of)")
            .font(.caption.weight(.semibold))
            .foregroundStyle(Brand.flame)
            .monospacedDigit()
            .widgetAccentable()
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
            // The ladder, as on the Home Screen widget.
            Ladder(rank: fighter.rank, of: fighter.of)
                .padding(.vertical, 2)
            Text(fighter.next.map { "Next: \($0)" } ?? "Top of the ladder")
                .font(.caption2)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: No rank yet

    @ViewBuilder
    private var unranked: some View {
        let message = entry.known ? "Log a workout, then ask the judge for your rank." : "Open Fatty to meet your fighter."
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
            VStack(alignment: .leading, spacing: 2) {
                WidgetHeader(title: "Your Fighter", symbol: "figure.martial.arts")
                Spacer(minLength: 0)
                Text("No rank yet")
                    .font(.title3.weight(.bold))
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Ladder(rank: 0, of: 10)
                    .padding(.top, 6)
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

/// The fight card's lower half: the week's numbers ruled off, then the next
/// bout and the latest record.
private struct CardTape: View {
    let snapshot: WidgetSnapshot
    let date: Date

    var body: some View {
        let stale = snapshot.isFromPastWeek(now: date)
        let sessions = stale ? 0 : snapshot.sessionsThisWeek
        let sets = stale ? 0 : snapshot.setsThisWeek
        let streak = snapshot.streakWeeks(at: date)
        VStack(alignment: .leading, spacing: 0) {
            Rectangle()
                .fill(WidgetStyle.track)
                .frame(height: 1)
            HStack(alignment: .top, spacing: 0) {
                stat(snapshot.sessionsPlanned.map { "\(sessions)/\($0)" } ?? "\(sessions)", "Workouts")
                stat("\(sets)", "Sets")
                stat("\(streak)", "Week streak", lit: streak > 0)
            }
            .padding(.top, 10)
            VStack(alignment: .leading, spacing: 3) {
                if let next = snapshot.nextBout {
                    line("Next bout", next)
                }
                if let record = snapshot.record {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Label("Removal", systemImage: "bolt.fill")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Brand.flame)
                            .widgetAccentable()
                        Text("\(record.name), \(weight(record.weight)) \(snapshot.unit ?? "kg") × \(record.reps)")
                            .font(.caption.weight(.medium))
                            .lineLimit(1)
                    }
                }
            }
            .padding(.top, 10)
        }
    }

    private func stat(_ value: String, _ label: String, lit: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value)
                .font(WidgetStyle.figure(32))
                .monospacedDigit()
                .foregroundStyle(lit ? AnyShapeStyle(Brand.flame) : AnyShapeStyle(.primary))
                .glow(lit, radius: 5)
                .widgetAccentable(lit)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(label)
                .font(.caption2.weight(.medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func line(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.caption.weight(.medium))
                .lineLimit(1)
        }
    }

    private func weight(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
    }
}

/// The ladder, as on Home: a step per rank, lit up to yours.
private struct Ladder: View {
    let rank: Int
    let of: Int
    var height: CGFloat = 4

    var body: some View {
        HStack(spacing: 3) {
            ForEach(1...max(1, of), id: \.self) { step in
                Capsule()
                    .fill(step <= rank ? AnyShapeStyle(Brand.flame) : AnyShapeStyle(Color.white.opacity(0.2)))
                    .frame(height: height)
                    .glow(step <= rank, radius: 3)
                    .widgetAccentable(step <= rank)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Rank \(rank) of \(of)")
    }
}
