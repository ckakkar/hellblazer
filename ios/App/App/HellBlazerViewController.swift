import UIKit
import WebKit
import Capacitor

/// The app's root screen: Capacitor's web view showing the live site, plus
/// the app's own native plugin (see HellBlazerNativePlugin).
class HellBlazerViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(HellBlazerNativePlugin())
        NativeRouter.shared.attach(self)
    }

    /// Loads a page of the live site, e.g. "/log".
    func open(_ url: URL) {
        webView?.load(URLRequest(url: url))
    }
}

/// Where quick actions, Siri and Shortcuts, and universal links turn into a
/// page load. On a cold launch the web view doesn't exist yet, so the path
/// waits here until it does.
final class NativeRouter {
    static let shared = NativeRouter()
    static let host = "hellblazer.vercel.app"

    private weak var controller: HellBlazerViewController?
    private var pending: URL?

    /// A same-site URL for a path like "/progress", or nil for anything else.
    static func url(forPath path: String) -> URL? {
        guard path.hasPrefix("/"), !path.hasPrefix("//") else { return nil }
        return URL(string: "https://\(host)\(path)")
    }

    /// Accepts only links to the site itself; anything else is ignored.
    func open(_ url: URL) {
        guard url.scheme == "https", url.host == Self.host else { return }
        DispatchQueue.main.async {
            if let controller = self.controller {
                controller.open(url)
            } else {
                self.pending = url
            }
        }
    }

    func open(path: String) {
        if let url = Self.url(forPath: path) { open(url) }
    }

    func attach(_ controller: HellBlazerViewController) {
        self.controller = controller
        guard let url = pending else { return }
        pending = nil
        // After this run-loop turn, so it replaces Capacitor's first page load
        // instead of being replaced by it.
        DispatchQueue.main.async { controller.open(url) }
    }
}
