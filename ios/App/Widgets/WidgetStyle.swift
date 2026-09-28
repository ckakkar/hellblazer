import SwiftUI
import WidgetKit

/// What every Home Screen widget shares: a fight card. Black, with the
/// flame's red glowing in from a corner, the lifter's fighter sketched in
/// red ink behind (InkArt), and wide, heavy figures.
///
/// In the Clear and Tinted looks iOS drops the background and draws the rest
/// from transparency alone, one colour for the accentable parts and another
/// for everything else. So tracks are see-through rather than solid (solid
/// would come out white), the marks that carry the number are accentable,
/// glows are left out, and the ink, being lines on nothing, turns to glass.
enum WidgetStyle {
    /// Behind a bar or a ring.
    static let track = Color.white.opacity(0.13)

    /// A number that leads a widget: wide and heavy, like the app's own.
    static func figure(_ size: CGFloat) -> Font {
        .system(size: size, weight: .black).width(.expanded)
    }

    /// A widget's title line: the thing it's about.
    static func title(_ size: CGFloat = 17) -> Font {
        .system(size: size, weight: .heavy).width(.expanded)
    }
}

/// The card behind every widget: black, the red glowing in from the top
/// right. Gone in the Clear and Tinted looks, as iOS removes backgrounds.
struct WidgetBackdrop: View {
    var body: some View {
        ZStack {
            Color.black
            RadialGradient(
                colors: [Brand.flame.opacity(0.34), Brand.flame.opacity(0.08), .clear],
                center: .topTrailing,
                startRadius: 0,
                endRadius: 260
            )
        }
    }
}

extension View {
    /// The fight-card look: the backdrop, and dark whatever the phone's
    /// appearance, like the app.
    func fightCard() -> some View {
        containerBackground(for: .widget) { WidgetBackdrop() }
            .environment(\.colorScheme, .dark)
    }

    /// The red glow on what's lit, in full colour only (elsewhere a glow
    /// would come out as a grey haze).
    func glow(_ on: Bool = true, radius: CGFloat = 6) -> some View {
        modifier(Glow(on: on, radius: radius))
    }
}

private struct Glow: ViewModifier {
    @Environment(\.widgetRenderingMode) private var renderingMode
    let on: Bool
    let radius: CGFloat

    func body(content: Content) -> some View {
        if on && renderingMode == .fullColor {
            content.shadow(color: Brand.flame.opacity(0.75), radius: radius)
        } else {
            content
        }
    }
}

/// The lifter's fighter in ink, behind a widget's content: red lines on the
/// black in full colour, glass in Clear and Tinted. Anchored to the trailing
/// edge and faded out towards the text.
struct InkBackdrop: View {
    @Environment(\.widgetRenderingMode) private var renderingMode
    let ink: UIImage?
    var strength: Double = 0.55
    /// How much of the widget's width it takes, from the trailing edge.
    var width: CGFloat = 0.62

    var body: some View {
        if let ink {
            GeometryReader { geo in
                Image(uiImage: ink)
                    .resizable()
                    .renderingMode(.template)
                    .scaledToFill()
                    .foregroundStyle(renderingMode == .fullColor ? Brand.flame : Color.white)
                    .frame(width: geo.size.width * width, height: geo.size.height, alignment: .top)
                    .clipped()
                    .mask(LinearGradient(
                        stops: [.init(color: .clear, location: 0), .init(color: .black, location: 0.45)],
                        startPoint: .leading,
                        endPoint: .trailing
                    ))
                    .opacity(renderingMode == .fullColor ? strength : strength * 0.6)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
    }
}

/// The tinted label a widget opens with.
struct WidgetHeader: View {
    let title: String
    let symbol: String
    var trailing: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: symbol)
                Text(title)
            }
            .font(.caption.weight(.bold))
            .foregroundStyle(Brand.flame)
            .widgetAccentable()
            .lineLimit(1)
            Spacer(minLength: 4)
            if let trailing {
                Text(trailing)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
    }
}

/// A capsule filled to `value` (0-1) on a see-through track.
struct CapsuleBar: View {
    let value: Double
    var tint: Color = Brand.flame
    var height: CGFloat = 6

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(WidgetStyle.track)
                if value > 0 {
                    Capsule()
                        .fill(tint)
                        .frame(width: max(height, geo.size.width * min(1, value)))
                        .glow(radius: 4)
                        .widgetAccentable()
                }
            }
        }
        .frame(height: height)
    }
}

/// A ring filled to `value` (0-1).
struct ProgressRing: View {
    let value: Double
    var lineWidth: CGFloat = 8

    var body: some View {
        ZStack {
            Circle().stroke(WidgetStyle.track, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0.001, min(1, value)))
                .stroke(Brand.flame, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .glow()
                .widgetAccentable()
        }
        .padding(lineWidth / 2)
    }
}

/// What a widget says before the app has given it anything to show.
struct WidgetEmpty: View {
    let title: String
    let symbol: String
    let message: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            WidgetHeader(title: title, symbol: symbol)
            Spacer(minLength: 0)
            Text(message)
                .font(.footnote.weight(.medium))
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

/// A button on a widget: red and glowing in full colour; glass in the Clear
/// and Tinted looks, where a filled capsule would swallow its label.
struct WidgetButtonLabel: View {
    @Environment(\.widgetRenderingMode) private var renderingMode
    let title: String
    let symbol: String

    var body: some View {
        let full = renderingMode == .fullColor
        HStack(spacing: 5) {
            Image(systemName: symbol)
            Text(title)
        }
        .font(.system(size: 15, weight: .heavy).width(.expanded))
        .foregroundStyle(full ? Color.white : Color.primary)
        .padding(.horizontal, 15)
        .padding(.vertical, 8)
        .background(full ? AnyShapeStyle(Brand.flame) : AnyShapeStyle(Color.white.opacity(0.18)), in: Capsule())
        .glow(radius: 8)
    }
}
