import Foundation
import Capacitor
import ActivityKit
import HealthKit
import UserNotifications
import WidgetKit

/// The app's own bridge to iOS, called from the site through
/// `src/lib/native-plugins.ts` (registered as "HellBlazerNative"):
///
/// - Rest timer: a Live Activity on the Lock Screen and in the Dynamic Island,
///   plus a "Rest's up" alert for when the phone is locked.
/// - Apple Health: finished workouts and logged bodyweight.
/// - Widgets: the snapshot the Home and Lock Screen widgets draw.
@objc(HellBlazerNativePlugin)
public class HellBlazerNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HellBlazerNativePlugin"
    public let jsName = "HellBlazerNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startRest", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRest", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "healthStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestHealth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveWorkout", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveBodyweight", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateWidget", returnType: CAPPluginReturnPromise),
    ]

    // MARK: Rest timer

    private static let restAlertId = "rest-over"

    /// Starts (or moves) the rest countdown. `endsAt` is epoch milliseconds,
    /// `total` the rest's length in seconds.
    @objc func startRest(_ call: CAPPluginCall) {
        guard let endsAtMs = call.getDouble("endsAt"), let total = call.getDouble("total") else {
            call.reject("endsAt and total are required")
            return
        }
        let endsAt = Date(timeIntervalSince1970: endsAtMs / 1000)
        let label = call.getString("label") ?? "Next set"
        scheduleRestAlert(at: endsAt, label: label)
        RestActivity.start(endsAt: endsAt, total: total, label: label)
        call.resolve()
    }

    /// Clears the countdown: rest paused, reset, or finished in the app.
    @objc func stopRest(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [Self.restAlertId])
        center.removeDeliveredNotifications(withIdentifiers: [Self.restAlertId])
        RestActivity.end()
        call.resolve()
    }

    /// A local notification at the end of the rest, so a locked phone still
    /// says when to lift. Asks for permission the first time a rest starts.
    private func scheduleRestAlert(at date: Date, label: String) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [Self.restAlertId])
        center.removeDeliveredNotifications(withIdentifiers: [Self.restAlertId])
        let interval = date.timeIntervalSinceNow
        guard interval >= 1 else { return }
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
}

/// Starts, moves and ends the rest timer's Live Activity.
enum RestActivity {
    static func start(endsAt: Date, total: Double, label: String) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let state = RestActivityAttributes.ContentState(endsAt: endsAt, total: total)
        // Stale at the end of the rest: the widget then shows "Rest's up"
        // even if the app is suspended and can't update it.
        let content = ActivityContent(state: state, staleDate: endsAt)
        let running = Activity<RestActivityAttributes>.activities

        // Same exercise: move the countdown instead of stacking a new card.
        if let current = running.first, current.attributes.label == label {
            Task { await current.update(content) }
            return
        }
        Task {
            for activity in running {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            _ = try? Activity.request(
                attributes: RestActivityAttributes(label: label),
                content: content,
                pushType: nil
            )
        }
    }

    static func end() {
        let running = Activity<RestActivityAttributes>.activities
        guard !running.isEmpty else { return }
        Task {
            for activity in running {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }
}
