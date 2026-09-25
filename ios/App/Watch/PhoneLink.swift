import Foundation
import WatchConnectivity

/// The watch's side of the link to the iPhone app (App/WatchBridge.swift).
/// The phone hands over the token and settings as the application context,
/// which arrives even if this app wasn't running; the watch tells the phone
/// what it did, for the Live Activity and the page.
final class PhoneLink: NSObject, WCSessionDelegate {
    static let shared = PhoneLink()

    /// The phone's context: ["token": String ("" means signed out), "settings": [String: Any]].
    var onContext: (([String: Any]) -> Void)?
    /// The phone changed the workout (a set logged there, say).
    var onPhoneChanged: (() -> Void)?

    private var session: WCSession? { WCSession.isSupported() ? WCSession.default : nil }

    func activate() {
        guard let session else { return }
        session.delegate = self
        session.activate()
    }

    /// Asks the phone for the context directly: a fresh install, or one
    /// that hasn't arrived yet. Needs the phone nearby.
    func requestContext() {
        guard let session, session.activationState == .activated, session.isReachable else { return }
        session.sendMessage(["want": "context"], replyHandler: { [weak self] reply in
            self?.deliver(reply)
        }, errorHandler: nil)
    }

    /// Now if the phone's awake, else dropped: for things only worth saying
    /// live, like the workout's state for the Lock Screen.
    func sendIfReachable(_ message: [String: Any]) {
        guard let session, session.activationState == .activated, session.isReachable else { return }
        session.sendMessage(message, replyHandler: nil, errorHandler: nil)
    }

    /// Delivered for sure, now or when the phone's back in range.
    func sendGuaranteed(_ message: [String: Any]) {
        guard let session, session.activationState == .activated else { return }
        session.transferUserInfo(message)
    }

    private func deliver(_ context: [String: Any]) {
        guard !context.isEmpty else { return }
        DispatchQueue.main.async { self.onContext?(context) }
    }

    // MARK: WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        guard activationState == .activated else { return }
        deliver(session.receivedApplicationContext)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        deliver(applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        if message["changed"] != nil {
            DispatchQueue.main.async { self.onPhoneChanged?() }
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {}
}
