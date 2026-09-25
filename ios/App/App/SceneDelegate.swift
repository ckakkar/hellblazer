import UIKit
import Capacitor
import CoreSpotlight

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = HellBlazerViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)

        // Cold launch from a quick action, a universal link, a Spotlight
        // result or a widget tap.
        if let item = connectionOptions.shortcutItem {
            handle(item)
        } else if let url = connectionOptions.userActivities.first(where: { $0.activityType == NSUserActivityTypeBrowsingWeb })?.webpageURL {
            NativeRouter.shared.open(url)
        } else if let path = connectionOptions.userActivities.lazy.compactMap(Self.spotlightPath).first {
            NativeRouter.shared.open(path: path)
        } else if let url = connectionOptions.urlContexts.first?.url {
            NativeRouter.shared.open(url)
        }
    }

    /// A page an intent left while the app wasn't running it (IntentRouter).
    func sceneDidBecomeActive(_ scene: UIScene) {
        if let path = IntentRouter.takePending() {
            NativeRouter.shared.open(path: path)
        }
    }

    /// A tapped Spotlight result's page (SpotlightIndex names items by path).
    private static func spotlightPath(_ activity: NSUserActivity) -> String? {
        guard activity.activityType == CSSearchableItemActionType else { return nil }
        return activity.userInfo?[CSSearchableItemActivityIdentifier] as? String
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
        if let url = URLContexts.first?.url {
            NativeRouter.shared.open(url)
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
        if userActivity.activityType == NSUserActivityTypeBrowsingWeb, let url = userActivity.webpageURL {
            NativeRouter.shared.open(url)
        } else if let path = Self.spotlightPath(userActivity) {
            NativeRouter.shared.open(path: path)
        }
    }

    /// Home Screen quick actions (long-press the icon). Their paths live in
    /// Info.plist under UIApplicationShortcutItems.
    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        completionHandler(handle(shortcutItem))
    }

    @discardableResult
    private func handle(_ item: UIApplicationShortcutItem) -> Bool {
        guard let path = item.userInfo?["path"] as? String else { return false }
        NativeRouter.shared.open(path: path)
        return true
    }
}
