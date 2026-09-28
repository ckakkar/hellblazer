import UIKit
import WidgetKit

/// The rank fighter's portrait, for the Fighter widget, and the same fighter
/// in ink (InkArt), for the Clear and Tinted looks and behind the other
/// widgets. A widget can't fetch, so the app keeps both in the App Group:
/// the portrait fetched from the site when the snapshot names a fighter not
/// kept yet (WidgetRefresher.apply, and each time the app comes to the
/// front), the ink made from the kept portrait whenever it's missing, by the
/// app or by a widget, whichever needs it first. The two are saved on their
/// own, so one failing never costs the other. Small, because a widget
/// refuses big images.
enum FighterArt {
    static let widgetKind = "Fighter"
    private static let keyKey = "fighter-art-key"
    /// Long side, in pixels: sharp enough on the widget, well under its limit.
    private static let maxSide: CGFloat = 400

    private static func fileURL(_ name: String) -> URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: WidgetSnapshot.appGroup)?
            .appendingPathComponent(name)
    }

    private static var portraitURL: URL? { fileURL("fighter.png") }
    private static var inkURL: URL? { fileURL("fighter-ink.png") }

    private static var defaults: UserDefaults? { UserDefaults(suiteName: WidgetSnapshot.appGroup) }

    private static func isKept(_ key: String) -> Bool {
        defaults?.string(forKey: keyKey) == key
    }

    /// The kept portrait, when it's this fighter's.
    static func load(for key: String) -> UIImage? {
        guard isKept(key), let url = portraitURL else { return nil }
        return UIImage(contentsOfFile: url.path)
    }

    /// The fighter in ink, white lines on nothing, when it's this fighter's:
    /// made from the kept portrait on the spot if it isn't there yet.
    static func loadInk(for key: String) -> UIImage? {
        guard isKept(key), let url = inkURL else { return nil }
        return UIImage(contentsOfFile: url.path) ?? makeInk()
    }

    /// Traces the kept portrait into ink and keeps it.
    @discardableResult
    private static func makeInk() -> UIImage? {
        guard let portraitURL, let inkURL,
              let portrait = UIImage(contentsOfFile: portraitURL.path)?.cgImage,
              let traced = InkArt.make(from: portrait)
        else { return nil }
        let ink = UIImage(cgImage: traced)
        if let png = ink.pngData() {
            try? png.write(to: inkURL, options: .atomic)
        }
        return ink
    }

    /// Makes sure the fighter's portrait and ink are kept (the app only):
    /// the ink from the portrait already here when only it is missing, both
    /// from the site when the fighter isn't the one kept.
    static func update(for fighter: WidgetSnapshot.Fighter?) {
        guard let fighter, let portraitURL, let inkURL else { return }
        let files = FileManager.default
        if isKept(fighter.key) && files.fileExists(atPath: portraitURL.path) {
            if !files.fileExists(atPath: inkURL.path), makeInk() != nil {
                // The ink is behind the other widgets too.
                WidgetCenter.shared.reloadAllTimelines()
            }
            return
        }
        guard let url = URL(string: "https://hellblazer.vercel.app\(fighter.image)") else { return }
        URLSession.shared.dataTask(with: url) { data, response, _ in
            guard (response as? HTTPURLResponse)?.statusCode == 200,
                  let data,
                  let image = UIImage(data: data),
                  let png = shrink(image).pngData(),
                  (try? png.write(to: portraitURL, options: .atomic)) != nil
            else { return }
            // The last fighter's ink isn't this one's.
            try? files.removeItem(at: inkURL)
            defaults?.set(fighter.key, forKey: keyKey)
            makeInk()
            WidgetCenter.shared.reloadAllTimelines()
        }.resume()
    }

    private static func shrink(_ image: UIImage) -> UIImage {
        let side = max(image.size.width, image.size.height)
        guard side > maxSide else { return image }
        let scale = maxSide / side
        let size = CGSize(width: (image.size.width * scale).rounded(), height: (image.size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
