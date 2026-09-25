import UserNotifications

/// Handles the "Rest's up" alert, and hands every other notification to
/// whoever had the notification center before (Capacitor's router, which
/// passes pushes to the site). The alert's +30s works without opening the
/// app; tapping it opens the workout. While the app is open it stays
/// silent: the page says it there.
///
/// Installed at launch, so an action can be handled when the tap launches
/// the app in the background, and again once Capacitor has claimed the
/// delegate, so its router is the one we forward to.
final class RestNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = RestNotificationDelegate()
    private weak var forward: UNUserNotificationCenterDelegate?

    func install() {
        let center = UNUserNotificationCenter.current()
        guard center.delegate !== self else { return }
        forward = center.delegate
        center.delegate = self
    }

    private static func isRestAlert(_ notification: UNNotification) -> Bool {
        notification.request.content.categoryIdentifier == RestAlert.category
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if Self.isRestAlert(notification) {
            completionHandler([])
            return
        }
        let handled: Void? = forward?.userNotificationCenter?(
            center, willPresent: notification, withCompletionHandler: completionHandler
        )
        if handled == nil { completionHandler([]) }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        guard Self.isRestAlert(response.notification) else {
            let handled: Void? = forward?.userNotificationCenter?(
                center, didReceive: response, withCompletionHandler: completionHandler
            )
            if handled == nil { completionHandler() }
            return
        }
        let sessionId = response.notification.request.content.userInfo["sessionId"] as? String
        switch response.actionIdentifier {
        case RestAlert.extendAction:
            guard let sessionId else {
                completionHandler()
                return
            }
            Task {
                await RestControl.extend(sessionId: sessionId, by: 30)
                completionHandler()
            }
        default:
            if let sessionId { NativeRouter.shared.open(path: "/log/\(sessionId)") }
            completionHandler()
        }
    }
}
