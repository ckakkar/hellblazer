import Foundation
import HealthKit
import WatchConnectivity

/// The iPhone's side of the Apple Watch app (ios/App/Watch):
///
/// - Hands the watch its token for /api/watch plus the lifter's unit, accent,
///   rest length and timezone, as the WatchConnectivity application context.
///   The site mints the token (WatchSync); the phone keeps a copy in the
///   keychain so it can answer the watch even when the page isn't open.
/// - Hears from the watch: a set logged or a rest started there updates the
///   Live Activity and tells the page; a workout recorded there keeps the
///   phone from saving a second copy to Apple Health.
/// - Opens the workout on the watch when one starts here, if the lifter wants.
///
/// Activated at launch, so a message from the watch can wake the app.
final class WatchBridge: NSObject, WCSessionDelegate {
    static let shared = WatchBridge()
    /// Posted on the main queue when the watch changed the workout.
    static let changed = Notification.Name("FattyWatchChanged")

    private let defaults = UserDefaults.standard
    private enum Key {
        static let userId = "watch.userId"
        static let disabled = "watch.disabled"
        static let autoOpen = "watch.autoOpen"
        static let settings = "watch.settings"
        static let recorded = "watch.recordedSessions"
        static let opened = "watch.openedSession"
    }

    private var session: WCSession? { WCSession.isSupported() ? WCSession.default : nil }

    func activate() {
        guard let session else { return }
        session.delegate = self
        session.activate()
    }

    /// Runs `done` on the main queue once the session is up, or after two
    /// seconds at most: right after launch it may still be connecting.
    func whenActivated(_ done: @escaping () -> Void) {
        DispatchQueue.main.async {
            guard let session = self.session, session.activationState != .activated else {
                done()
                return
            }
            self.waiting.append(done)
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { self.runWaiting() }
        }
    }

    private var waiting: [() -> Void] = []

    private func runWaiting() {
        let ready = waiting
        waiting = []
        ready.forEach { $0() }
    }

    // MARK: Status and settings (from the page, via HellBlazerNativePlugin)

    var disabled: Bool { defaults.bool(forKey: Key.disabled) }
    var autoOpen: Bool { defaults.object(forKey: Key.autoOpen) as? Bool ?? true }

    func status() -> [String: Any] {
        let session = self.session
        let active = session?.activationState == .activated
        var status: [String: Any] = [
            "paired": active && session?.isPaired == true,
            "installed": active && session?.isWatchAppInstalled == true,
            "disabled": disabled,
            "autoOpen": autoOpen,
        ]
        if Keychain.token != nil, let userId = defaults.string(forKey: Key.userId) {
            status["linkedUserId"] = userId
        }
        return status
    }

    /// Stores the settings (and a new token, if given) and passes them on.
    func sync(token: String?, userId: String, settings: [String: Any]) {
        if let token {
            Keychain.token = token
            defaults.set(userId, forKey: Key.userId)
            defaults.set(false, forKey: Key.disabled)
        }
        defaults.set(settings.merging(["userId": userId]) { _, new in new }, forKey: Key.settings)
        pushContext()
    }

    /// Forgets the token here and on the watch. Returns it so the site can
    /// revoke it. `disable`: the lifter turned the watch off in Settings.
    func unlink(disable: Bool) -> String? {
        let token = Keychain.token
        Keychain.token = nil
        defaults.removeObject(forKey: Key.userId)
        defaults.removeObject(forKey: Key.settings)
        defaults.set(disable, forKey: Key.disabled)
        pushContext()
        return token
    }

    func setAutoOpen(_ on: Bool) {
        defaults.set(on, forKey: Key.autoOpen)
    }

    /// What the watch gets: its token and settings, or an empty token to
    /// make it forget this account.
    private func context() -> [String: Any] {
        guard !disabled, let token = Keychain.token else { return ["token": ""] }
        return ["token": token, "settings": defaults.dictionary(forKey: Key.settings) ?? [:]]
    }

    private func pushContext() {
        guard let session, session.activationState == .activated, session.isPaired, session.isWatchAppInstalled else {
            return
        }
        try? session.updateApplicationContext(context())
    }

    // MARK: The workout

    /// The page changed the workout (a set, a rest): the watch refreshes now
    /// rather than at its next poll. Only while it's awake to hear it.
    func phoneChanged() {
        guard let session, session.activationState == .activated, session.isReachable else { return }
        session.sendMessage(["changed": true], replyHandler: nil, errorHandler: nil)
    }

    /// Whether the watch is recording this session to Apple Health.
    func recordedOnWatch(_ sessionId: String) -> Bool {
        (defaults.stringArray(forKey: Key.recorded) ?? []).contains(sessionId)
    }

    private func markRecorded(_ sessionId: String) {
        let recent = (defaults.stringArray(forKey: Key.recorded) ?? []).suffix(19)
        defaults.set(Array(recent) + [sessionId], forKey: Key.recorded)
    }

    /// A workout just started on the phone: open it on the watch, which then
    /// records it to Apple Health with heart rate. Once per session, only
    /// right after it starts, and not for one the watch started itself.
    func openOnWatch(sessionId: String, startedAt: Date) {
        guard autoOpen, !disabled, Keychain.token != nil,
              let session, session.activationState == .activated,
              session.isPaired, session.isWatchAppInstalled,
              Date().timeIntervalSince(startedAt) < 10 * 60,
              defaults.string(forKey: Key.opened) != sessionId,
              !recordedOnWatch(sessionId)
        else { return }
        defaults.set(sessionId, forKey: Key.opened)
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        configuration.locationType = .indoor
        HKHealthStore().startWatchApp(with: configuration) { _, _ in }
    }

    /// A message or queued transfer from the watch.
    private func handle(_ message: [String: Any]) {
        if let sessionId = message["workoutStarted"] as? String {
            markRecorded(sessionId)
        }
        if let activity = message["activity"] as? [String: Any] {
            applyActivity(activity)
        }
        if let sessionId = message["finished"] as? String {
            WorkoutActivity.end()
            RestAlert.cancel()
            RestControl.post(.init(sessionId: sessionId, endsAt: nil, total: 0, alert: false))
        }
        if message["activity"] != nil || message["finished"] != nil {
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: Self.changed, object: nil)
            }
        }
    }

    /// The watch's view of the workout onto the Lock Screen, and its rest
    /// to the page. The watch says when the rest is over, so the phone
    /// doesn't also buzz.
    private func applyActivity(_ a: [String: Any]) {
        guard let sessionId = a["sessionId"] as? String,
              let startedAt = (a["startedAt"] as? NSNumber)?.doubleValue,
              let title = a["title"] as? String
        else { return }
        let restEndsAt = (a["restEndsAt"] as? NSNumber)?.doubleValue
        let restTotal = (a["restTotal"] as? NSNumber)?.doubleValue
        let state = WorkoutActivityAttributes.ContentState(
            title: title,
            exercise: a["exercise"] as? String,
            detail: a["detail"] as? String,
            sets: (a["sets"] as? NSNumber)?.intValue ?? 0,
            volume: a["volume"] as? String ?? "",
            restEndsAt: restEndsAt.map { Date(timeIntervalSince1970: $0 / 1000) },
            restTotal: restTotal
        )
        WorkoutActivity.upsert(sessionId: sessionId, startedAt: Date(timeIntervalSince1970: startedAt / 1000), state: state)
        RestAlert.cancel()
        RestControl.post(.init(sessionId: sessionId, endsAt: restEndsAt, total: restTotal ?? 0, alert: false))
    }

    // MARK: WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if activationState == .activated { pushContext() }
        DispatchQueue.main.async { self.runWaiting() }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        // Switched to another watch: start over with that one.
        session.activate()
    }

    /// Installed, removed, or a different watch: bring it up to date.
    func sessionWatchStateDidChange(_ session: WCSession) {
        pushContext()
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handle(message)
    }

    /// The watch asking for its token (a fresh install), or anything else
    /// that wants an answer: reply with the context.
    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        handle(message)
        replyHandler(context())
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        handle(userInfo)
    }
}
