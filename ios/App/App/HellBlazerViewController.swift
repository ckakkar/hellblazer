import UIKit
import WebKit
import Capacitor

/// The app's root screen: Capacitor's web view showing the live site, tuned
/// to behave like an iOS app rather than a web page, plus the app's own
/// native plugin (see HellBlazerNativePlugin).
class HellBlazerViewController: CAPBridgeViewController {
    /// A copy of the launch screen, held over the web view until the page is
    /// up, so a cold start goes launch screen → app with no blank frame.
    private var launchCover: UIView?
    private var loadingObservation: NSKeyValueObservation?

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(HellBlazerNativePlugin())
        configureWebView()
        NativeRouter.shared.attach(self)
        // Capacitor's bridge just took over the notification center; put the
        // rest alert's handler back in front of it (it forwards the rest).
        RestNotificationDelegate.shared.install()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        coverUntilReady()
    }

    private func configureWebView() {
        guard let webView = webView else { return }
        let scroll = webView.scrollView
        // Capacitor turns bouncing off. iOS lists rubber-band at the ends,
        // including short ones, so the page does too.
        scroll.bounces = true
        scroll.alwaysBounceVertical = true
        scroll.alwaysBounceHorizontal = false
        // Drag the page down to put the keyboard away, as in Messages.
        scroll.keyboardDismissMode = .interactive
        // Off until a pushed page turns it on (see setBackGesture).
        webView.allowsBackForwardNavigationGestures = false
        // An app's interface doesn't pinch-zoom or double-tap-zoom. The
        // website keeps zoom; this only runs inside the app.
        webView.configuration.userContentController.addUserScript(
            WKUserScript(source: Self.viewportLock, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        )
    }

    private static let viewportLock = """
    (function () {
      var m = document.querySelector('meta[name="viewport"]');
      if (m && m.content.indexOf('user-scalable') === -1) {
        m.setAttribute('content', m.content + ', maximum-scale=1, user-scalable=no');
      }
    })();
    """

    // MARK: Launch cover

    private func coverUntilReady() {
        guard let cover = UIStoryboard(name: "LaunchScreen", bundle: nil).instantiateInitialViewController()?.view else {
            return
        }
        cover.frame = view.bounds
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(cover)
        launchCover = cover

        // The page calls ready() once it's interactive. In case it never
        // does (the offline page, a script error), lift the cover shortly
        // after the load finishes, and in any case after a few seconds.
        loadingObservation = webView?.observe(\.isLoading, options: [.new]) { [weak self] webView, _ in
            guard !webView.isLoading else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { self?.hideLaunchCover() }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in
            self?.hideLaunchCover()
        }
    }

    func hideLaunchCover() {
        guard let cover = launchCover else { return }
        launchCover = nil
        loadingObservation = nil
        UIView.animate(withDuration: 0.25, delay: 0, options: [.curveEaseOut, .beginFromCurrentState]) {
            cover.alpha = 0
        } completion: { _ in
            cover.removeFromSuperview()
        }
    }

    // MARK: Navigation

    /// Shows a page of the live site, e.g. "/log/<id>". When the site is
    /// already running it navigates in place, as a tap inside the app would,
    /// keeping whatever's on screen alive; otherwise it loads the page.
    func open(_ url: URL) {
        guard let webView = webView else { return }
        var target = url.path.isEmpty ? "/" : url.path
        if let query = url.query { target += "?\(query)" }
        guard webView.url?.host == url.host,
              let data = try? JSONEncoder().encode(target),
              let literal = String(data: data, encoding: .utf8)
        else {
            webView.load(URLRequest(url: url))
            return
        }
        webView.evaluateJavaScript("window.__hbNavigate ? window.__hbNavigate(\(literal)) : false") { result, _ in
            if (result as? Bool) != true {
                webView.load(URLRequest(url: url))
            }
        }
    }
}

/// Where quick actions, Siri and Shortcuts, universal links and Live Activity
/// taps turn into a page. On a cold launch the web view doesn't exist yet,
/// so the path waits here until it does.
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
