import Foundation
import UIKit
import WebKit
import Capacitor
import ActivityKit
import HealthKit
import UserNotifications
import WidgetKit

/// The app's own bridge to iOS, called from the site through
/// `src/lib/native-plugins.ts` (registered as "HellBlazerNative"):
///
/// - Workout: a Live Activity on the Lock Screen and in the Dynamic Island
///   for the session in progress, rest countdown included, plus a "Rest's
///   up" alert for when the phone is locked.
/// - Apple Health: finished workouts and logged bodyweight.
/// - Widgets: the snapshot the Home and Lock Screen widgets draw.
/// - The share sheet, for files the site builds (share card, CSV export).
/// - Web view chrome: lifting the launch screen, the edge swipe back.
@objc(HellBlazerNativePlugin)
public class HellBlazerNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HellBlazerNativePlugin"
    public let jsName = "HellBlazerNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "workoutActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endWorkoutActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleRestAlert", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelRestAlert", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "healthStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestHealth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveWorkout", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveBodyweight", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateWidget", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "share", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ready", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBackGesture", returnType: CAPPluginReturnPromise),
    ]

    // MARK: Workout Live Activity

    /// Starts or updates the Live Activity for a session. The site sends the
    /// whole state each time; `startedAt` and `restEndsAt` are epoch ms.
    @objc func workoutActivity(_ call: CAPPluginCall) {
        guard let sessionId = call.getString("sessionId"),
              let startedAtMs = call.getDouble("startedAt"),
              let title = call.getString("title")
        else {
            call.reject("sessionId, startedAt and title are required")
            return
        }
        let state = WorkoutActivityAttributes.ContentState(
            title: title,
            exercise: call.getString("exercise"),
            detail: call.getString("detail"),
            sets: call.getInt("sets") ?? 0,
            volume: call.getString("volume") ?? "",
            restEndsAt: call.getDouble("restEndsAt").map { Date(timeIntervalSince1970: $0 / 1000) },
            restTotal: call.getDouble("restTotal")
        )
        WorkoutActivity.upsert(
            sessionId: sessionId,
            startedAt: Date(timeIntervalSince1970: startedAtMs / 1000),
            state: state
        )
        call.resolve()
    }

    /// Ends the workout's Live Activity: the session was finished or
    /// discarded. With `except`, keeps that session's (it's still live).
    @objc func endWorkoutActivity(_ call: CAPPluginCall) {
        WorkoutActivity.end(except: call.getString("except"))
        call.resolve()
    }

    // MARK: Rest alert

    private static let restAlertId = "rest-over"

    /// A local notification at the end of the rest, so a locked phone still
    /// says when to lift. `endsAt` is epoch ms. Asks for permission the first
    /// time. It never shows while the app is open: the page says it there.
    @objc func scheduleRestAlert(_ call: CAPPluginCall) {
        guard let endsAtMs = call.getDouble("endsAt") else {
            call.reject("endsAt is required")
            return
        }
        let label = call.getString("label") ?? "Next set"
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [Self.restAlertId])
        center.removeDeliveredNotifications(withIdentifiers: [Self.restAlertId])
        let interval = Date(timeIntervalSince1970: endsAtMs / 1000).timeIntervalSinceNow
        guard interval >= 1 else {
            call.resolve()
            return
        }
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            guard granted else { return }
            let content = UNMutableNotificationContent()
            content.title = "Rest's up"
            content.body = "\(label). Time to lift."
            content.sound = .default
            content.interruptionLevel = .active
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
            center.add(UNNotificationRequest(identifier: Self.restAlertId, content: content, trigger: trigger))
        }
        call.resolve()
    }

    /// Clears the alert: the rest was skipped, reset, or finished in the app.
    @objc func cancelRestAlert(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [Self.restAlertId])
        center.removeDeliveredNotifications(withIdentifiers: [Self.restAlertId])
        call.resolve()
    }

    // MARK: Apple Health

    private lazy var healthStore = HKHealthStore()
    private let bodyMass = HKQuantityType(.bodyMass)
    private var shareTypes: Set<HKSampleType> { [HKObjectType.workoutType(), bodyMass] }

    private func status(of type: HKObjectType) -> String {
        switch healthStore.authorizationStatus(for: type) {
        case .sharingAuthorized: return "authorized"
        case .sharingDenied: return "denied"
        default: return "notDetermined"
        }
    }

    /// Whether Health is available here, and what we may write.
    @objc func healthStatus(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["available": false])
            return
        }
        call.resolve([
            "available": true,
            "workouts": status(of: HKObjectType.workoutType()),
            "bodyweight": status(of: bodyMass),
        ])
    }

    /// Shows Apple's Health permission sheet (only the first time; after
    /// that, changes happen in the Health app).
    @objc func requestHealth(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["available": false])
            return
        }
        healthStore.requestAuthorization(toShare: shareTypes, read: nil) { _, _ in
            call.resolve([
                "available": true,
                "workouts": self.status(of: HKObjectType.workoutType()),
                "bodyweight": self.status(of: self.bodyMass),
            ])
        }
    }

    /// Saves a finished session as a strength-training workout. `start` and
    /// `end` are epoch milliseconds; `sessionId` tags it so it can be traced.
    @objc func saveWorkout(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(),
              healthStore.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized
        else {
            call.resolve(["saved": false])
            return
        }
        guard let startMs = call.getDouble("start"), let endMs = call.getDouble("end"), endMs > startMs else {
            call.reject("start and end are required, and end must be after start")
            return
        }
        let start = Date(timeIntervalSince1970: startMs / 1000)
        let end = Date(timeIntervalSince1970: endMs / 1000)

        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        configuration.locationType = .indoor
        let builder = HKWorkoutBuilder(healthStore: healthStore, configuration: configuration, device: .local())
        var metadata: [String: Any] = [HKMetadataKeyIndoorWorkout: true]
        if let sessionId = call.getString("sessionId") {
            metadata[HKMetadataKeyExternalUUID] = sessionId
        }

        builder.beginCollection(withStart: start) { began, error in
            guard began else {
                call.reject(error?.localizedDescription ?? "Couldn't start the workout")
                return
            }
            builder.addMetadata(metadata) { _, _ in
                builder.endCollection(withEnd: end) { ended, error in
                    guard ended else {
                        call.reject(error?.localizedDescription ?? "Couldn't end the workout")
                        return
                    }
                    builder.finishWorkout { workout, error in
                        if let error = error {
                            call.reject(error.localizedDescription)
                        } else {
                            call.resolve(["saved": workout != nil])
                        }
                    }
                }
            }
        }
    }

    /// Saves a bodyweight entry. `kg` in kilograms, `date` epoch milliseconds.
    @objc func saveBodyweight(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(),
              healthStore.authorizationStatus(for: bodyMass) == .sharingAuthorized
        else {
            call.resolve(["saved": false])
            return
        }
        guard let kg = call.getDouble("kg"), kg > 0, let dateMs = call.getDouble("date") else {
            call.reject("kg and date are required")
            return
        }
        let date = Date(timeIntervalSince1970: dateMs / 1000)
        let quantity = HKQuantity(unit: .gramUnit(with: .kilo), doubleValue: kg)
        let sample = HKQuantitySample(type: bodyMass, quantity: quantity, start: date, end: date)
        healthStore.save(sample) { saved, error in
            if let error = error {
                call.reject(error.localizedDescription)
            } else {
                call.resolve(["saved": saved])
            }
        }
    }

    // MARK: Widgets

    /// Stores the widgets' snapshot (a JSON string) in the App Group and asks
    /// WidgetKit to redraw.
    @objc func updateWidget(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), let data = json.data(using: .utf8) else {
            call.reject("json is required")
            return
        }
        guard (try? JSONDecoder().decode(WidgetSnapshot.self, from: data)) != nil else {
            call.reject("The widget snapshot didn't match the expected shape")
            return
        }
        UserDefaults(suiteName: WidgetSnapshot.appGroup)?.set(data, forKey: WidgetSnapshot.storageKey)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    // MARK: Share sheet

    /// Hands a file the site built (base64 `data`, saved as `fileName`) to
    /// the iOS share sheet: Save Image, Messages, AirDrop, Save to Files.
    /// Resolves with whether the lifter went through with it.
    @objc func share(_ call: CAPPluginCall) {
        guard let rawName = call.getString("fileName"),
              let base64 = call.getString("data"),
              let data = Data(base64Encoded: base64)
        else {
            call.reject("fileName and base64 data are required")
            return
        }
        // A bare file name only: nothing the page sends can write elsewhere.
        let name = (rawName as NSString).lastPathComponent
        guard !name.isEmpty, name != ".", name != ".." else {
            call.reject("Invalid file name")
            return
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        do {
            try data.write(to: url, options: .atomic)
        } catch {
            call.reject("Couldn't prepare the file")
            return
        }
        var items: [Any] = [url]
        if let text = call.getString("text") { items.append(text) }

        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("Nothing to present from")
                return
            }
            let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
            sheet.completionWithItemsHandler = { _, completed, _, _ in
                call.resolve(["completed": completed])
            }
            sheet.popoverPresentationController?.sourceView = presenter.view
            presenter.present(sheet, animated: true)
        }
    }

    // MARK: Web view chrome

    /// The page is up: lift the launch screen that's been covering it.
    @objc func ready(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            (self.bridge?.viewController as? HellBlazerViewController)?.hideLaunchCover()
        }
        call.resolve()
    }

    /// Turns the edge swipe back on for pages pushed onto a stack (a session
    /// in History, a program) and off everywhere else, as in any iOS app.
    @objc func setBackGesture(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        DispatchQueue.main.async {
            self.bridge?.webView?.allowsBackForwardNavigationGestures = enabled
        }
        call.resolve()
    }
}

/// Starts, updates and ends the workout's Live Activity. One at a time: a
/// different session's activity is ended when a new one starts.
enum WorkoutActivity {
    private static func isLive(_ activity: Activity<WorkoutActivityAttributes>) -> Bool {
        activity.activityState == .active || activity.activityState == .stale
    }

    static func upsert(sessionId: String, startedAt: Date, state: WorkoutActivityAttributes.ContentState) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        // Stale when the rest runs out, so the Lock Screen flips to "Rest's
        // up" even while the app is suspended and can't update it.
        let staleDate = state.restEndsAt.flatMap { $0 > Date() ? $0 : nil }
        let content = ActivityContent(state: state, staleDate: staleDate)

        let running = Activity<WorkoutActivityAttributes>.activities
        let current = running.first { $0.attributes.sessionId == sessionId && isLive($0) }
        for other in running where other.id != current?.id {
            Task { await other.end(nil, dismissalPolicy: .immediate) }
        }
        if let current {
            Task { await current.update(content) }
        } else {
            _ = try? Activity.request(
                attributes: WorkoutActivityAttributes(sessionId: sessionId, startedAt: startedAt),
                content: content,
                pushType: nil
            )
        }
    }

    static func end(except sessionId: String? = nil) {
        for activity in Activity<WorkoutActivityAttributes>.activities
        where activity.attributes.sessionId != sessionId {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
    }
}
