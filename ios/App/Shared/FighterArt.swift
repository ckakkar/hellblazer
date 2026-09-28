import UIKit
import WidgetKit

/// The rank fighter's portrait, for the Fighter widget. A widget can't fetch
/// it itself, so the app keeps a small copy in the App Group, fetched from
/// the site whenever the snapshot names a fighter it doesn't have yet
/// (WidgetRefresher.apply), and beside it a see-through copy for the Clear
/// and Tinted looks (ClearArt). Small, because a widget refuses big images.
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

    private static var fileURL: URL? { fileURL("fighter.png") }
    private static var clearURL: URL? { fileURL("fighter-clear.png") }

    private static var defaults: UserDefaults? { UserDefaults(suiteName: WidgetSnapshot.appGroup) }

    /// The kept portrait, when it's this fighter's.
    static func load(for key: String) -> UIImage? {
        guard defaults?.string(forKey: keyKey) == key, let url = fileURL else { return nil }
        return UIImage(contentsOfFile: url.path)
    }

    /// Its see-through copy, for the Clear and Tinted looks.
    static func loadClear(for key: String) -> UIImage? {
        guard defaults?.string(forKey: keyKey) == key, let url = clearURL else { return nil }
        return UIImage(contentsOfFile: url.path)
    }

    /// Fetches the fighter's portrait when it isn't the one kept (the app only).
    static func update(for fighter: WidgetSnapshot.Fighter?) {
        guard let fighter, let file = fileURL, let clearFile = clearURL else { return }
        let kept = defaults?.string(forKey: keyKey) == fighter.key
            && FileManager.default.fileExists(atPath: file.path)
            && FileManager.default.fileExists(atPath: clearFile.path)
        guard !kept, let url = URL(string: "https://hellblazer.vercel.app\(fighter.image)") else { return }
        URLSession.shared.dataTask(with: url) { data, response, _ in
            guard (response as? HTTPURLResponse)?.statusCode == 200,
                  let data,
                  let image = UIImage(data: data),
                  case let small = shrink(image),
                  let png = small.pngData(),
                  let clearArt = small.cgImage.flatMap(ClearArt.make),
                  let clear = UIImage(cgImage: clearArt).pngData(),
                  (try? png.write(to: file, options: .atomic)) != nil,
                  (try? clear.write(to: clearFile, options: .atomic)) != nil
            else { return }
            defaults?.set(fighter.key, forKey: keyKey)
            WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
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
