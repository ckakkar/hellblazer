import UIKit
import WidgetKit

/// The rank fighter's portrait, for the Fighter widget, and two copies made
/// from it: the fighter in red ink (InkArt), behind the other widgets in full
/// colour, and see-through (ClearArt), for the Clear and Tinted looks. A
/// widget can't fetch, so the app keeps all three in the App Group: the
/// portrait fetched from the site when the snapshot names a fighter not kept
/// yet (WidgetRefresher.apply, and each time the app comes to the front),
/// the copies made from the kept portrait whenever one's missing, by the app
/// or by a widget, whichever needs it first. Each is saved on its own, so
/// one failing never costs the others. Small, because a widget refuses big
/// images.
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
    private static var clearURL: URL? { fileURL("fighter-clear.png") }

    /// A copy made from the portrait: its file, and how it's made.
    private enum Copy: CaseIterable {
        case ink, clear

        var url: URL? { self == .ink ? FighterArt.inkURL : FighterArt.clearURL }

        func make(_ portrait: CGImage) -> CGImage? {
            self == .ink ? InkArt.make(from: portrait) : ClearArt.make(from: portrait)
        }
    }

    private static var defaults: UserDefaults? { UserDefaults(suiteName: WidgetSnapshot.appGroup) }

    private static func isKept(_ key: String) -> Bool {
        defaults?.string(forKey: keyKey) == key
    }

    /// The kept portrait, when it's this fighter's.
    static func load(for key: String) -> UIImage? {
        guard isKept(key), let url = portraitURL else { return nil }
        return UIImage(contentsOfFile: url.path)
    }

    /// The fighter in ink, white lines on nothing, when it's this fighter's.
    static func loadInk(for key: String) -> UIImage? { load(.ink, for: key) }

    /// The see-through portrait, when it's this fighter's.
    static func loadClear(for key: String) -> UIImage? { load(.clear, for: key) }

    /// A copy, made from the kept portrait on the spot if it isn't there yet.
    private static func load(_ copy: Copy, for key: String) -> UIImage? {
        guard isKept(key), let url = copy.url else { return nil }
        return UIImage(contentsOfFile: url.path) ?? make(copy)
    }

    /// Makes a copy from the kept portrait and keeps it.
    @discardableResult
    private static func make(_ copy: Copy) -> UIImage? {
        guard let portraitURL, let url = copy.url,
              let portrait = UIImage(contentsOfFile: portraitURL.path)?.cgImage,
              let made = copy.make(portrait)
        else { return nil }
        let image = UIImage(cgImage: made)
        if let png = image.pngData() {
            try? png.write(to: url, options: .atomic)
        }
        return image
    }

    /// Makes sure the fighter's portrait and its copies are kept (the app
    /// only): a missing copy from the portrait already here, everything from
    /// the site when the fighter isn't the one kept.
    static func update(for fighter: WidgetSnapshot.Fighter?) {
        guard let fighter, let portraitURL else { return }
        let files = FileManager.default
        if isKept(fighter.key) && files.fileExists(atPath: portraitURL.path) {
            let missing = Copy.allCases.filter { copy in
                copy.url.map { !files.fileExists(atPath: $0.path) } ?? false
            }
            // The copies are behind the other widgets too.
            if !missing.isEmpty, missing.map({ make($0) != nil }).contains(true) {
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
            // The last fighter's copies aren't this one's.
            for copy in Copy.allCases {
                if let url = copy.url { try? files.removeItem(at: url) }
            }
            defaults?.set(fighter.key, forKey: keyKey)
            for copy in Copy.allCases { make(copy) }
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
