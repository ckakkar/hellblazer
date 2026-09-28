import SwiftUI
import WidgetKit

/// What every Home Screen widget shares, after Apple's own: the system's
/// background, SF type in primary and secondary, and the flame red as the
/// one tint. In the Clear and Tinted looks iOS draws a widget from its
/// transparency alone, one colour for the accentable parts and another for
/// the rest, so tracks are drawn with opacity, never a solid dark colour
/// (that would come out as solid white), and the marks that carry the
/// number are accentable.
enum WidgetStyle {
    /// Behind a bar or a ring.
    static let track = Color.primary.opacity(0.12)
    /// A number that leads a widget.
    static func figure(_ size: CGFloat) -> Font {
        .system(size: size, weight: .semibold, design: .rounded)
    }
}

/// The tinted title a widget opens with, like Fitness's and Screen Time's.
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
            .font(.caption.weight(.semibold))
            .foregroundStyle(Brand.flame)
            .widgetAccentable()
            .lineLimit(1)
            Spacer(minLength: 4)
            if let trailing {
                Text(trailing)
                    .font(.caption2)
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
                        .widgetAccentable()
                }
            }
        }
        .frame(height: height)
    }
}

/// A ring filled to `value` (0-1), like the Fitness rings.
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
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

/// A button on a widget: filled with the tint in full colour; in the Clear
/// and Tinted looks, where a filled capsule would swallow its label, glass.
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
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(full ? Color.white : Color.primary)
        .padding(.horizontal, 14)
        .padding(.vertical, 7)
        .background(full ? AnyShapeStyle(Brand.flame) : AnyShapeStyle(Color.primary.opacity(0.18)), in: Capsule())
    }
}
