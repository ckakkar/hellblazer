import Foundation
import UIKit
import WebKit
import Capacitor
import ActivityKit
import HealthKit
import UserNotifications
import WidgetKit
import AppIntents

/// The app's own bridge to iOS, called from the site through
/// `src/lib/native-plugins.ts` (registered as "HellBlazerNative"):
///
/// - Workout: a Live Activity on the Lock Screen and in the Dynamic Island
///   for the session in progress, rest countdown included, plus a "Rest's
///   up" alert for when the phone is locked. Rest changes made outside the
///   page (the activity's buttons, the watch) wait here for the page.
/// - Apple Watch: linking it, and its settings (WatchBridge).
/// - Apple Health: finished workouts (with their effort) and logged
///   bodyweight; sleep, heart rate variability and resting heart rate for
///   Recovery on Home, read on the phone only (HealthExtras.swift).
/// - Widgets, Siri and Spotlight: the snapshot they read.
/// - The share sheet, for files the site builds (share card, CSV export).
/// - Web view chrome: lifting the launch screen, the edge swipe back, and
///   keeping the screen on during a workout.
/// - Voice logging (VoiceSetLogger): the rest settings it goes by.
/// - Sets said in your own words (SetReader), read by Apple's on-device
///   model, for the logger's "Say it".
/// - A finished workout's heart rate from the watch (WorkoutHeartRate), and
///   its summary written by that model (HeartSummary), for the session page.
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
        CAPPluginMethod(name: "takeRestCommand", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "watchStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "watchSync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "watchUnlink", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setWatchAutoOpen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "phoneStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "phoneSync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "phoneUnlink", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "keepAwake", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setRestDefaults", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recoveryStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recoveryData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeRemovedSets", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "donateWorkoutStart", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setHealthSync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setReaderStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readSets", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "workoutHeartRate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestHeartRate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "heartSummary", returnType: CAPPluginReturnPromise),
    ]

    private var observers: [NSObjectProtocol] = []

    /// Tells the page when something outside it changed the workout: it
    /// then asks for the details (takeRestCommand) or reloads the sets.
    override public func load() {
        let center = NotificationCenter.default
        observers = [
            center.addObserver(forName: RestControl.commandPosted, object: nil, queue: .main) { [weak self] _ in
                self?.notifyListeners("restCommand", data: [:])
            },
            center.addObserver(forName: WatchBridge.changed, object: nil, queue: .main) { [weak self] _ in
                self?.notifyListeners("watchChanged", data: [:])
            },
            center.addObserver(forName: WatchBridge.heartRateChanged, object: nil, queue: .main) { [weak self] note in
                self?.notifyListeners("heartRate", data: note.userInfo as? [String: Any] ?? [:])
            },
            center.addObserver(forName: RemovedSets.posted, object: nil, queue: .main) { [weak self] _ in
                self?.notifyListeners("setsRemoved", data: [:])
            },
        ]
    }

    deinit {
        for observer in observers {
            NotificationCenter.default.removeObserver(observer)
        }
    }

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
            restTotal: call.getDouble("restTotal"),
            next: WorkoutActivityAttributes.NextSet(call.options["next"])
        )
        let startedAt = Date(timeIntervalSince1970: startedAtMs / 1000)
        WorkoutActivity.upsert(sessionId: sessionId, startedAt: startedAt, state: state)
        WatchBridge.shared.phoneChanged()
        WatchBridge.shared.openOnWatch(sessionId: sessionId, startedAt: startedAt)
        call.resolve()
    }

    /// Ends the workout's Live Activity: the session was finished or
    /// discarded. With `except`, keeps that session's (it's still live).
    @objc func endWorkoutActivity(_ call: CAPPluginCall) {
        WorkoutActivity.end(except: call.getString("except"))
        WatchBridge.shared.phoneChanged()
        call.resolve()
    }

    // MARK: Rest alert

    /// A local notification at the end of the rest, so a locked phone still
    /// says when to lift (see RestAlert). `endsAt` is epoch ms. It never
    /// shows while the app is open: the page says it there.
    @objc func scheduleRestAlert(_ call: CAPPluginCall) {
        guard let endsAtMs = call.getDouble("endsAt") else {
            call.reject("endsAt is required")
            return
        }
        RestAlert.schedule(
            sessionId: call.getString("sessionId"),
            endsAt: Date(timeIntervalSince1970: endsAtMs / 1000),
            label: call.getString("label")
        )
        call.resolve()
    }

    /// Clears the alert: the rest was skipped, reset, or finished in the app.
    @objc func cancelRestAlert(_ call: CAPPluginCall) {
        RestAlert.cancel()
        call.resolve()
    }

    /// The rest change made outside the page for this session, if one is
    /// waiting (RestControl). Handed over once.
    @objc func takeRestCommand(_ call: CAPPluginCall) {
        guard let sessionId = call.getString("sessionId"),
              let command = RestControl.take(sessionId: sessionId)
        else {
            call.resolve([:])
            return
        }
        var result: [String: Any] = [
            "sessionId": command.sessionId,
            "total": command.total,
            "alert": command.alert,
        ]
        result["endsAt"] = command.endsAt.map { $0 as Any } ?? NSNull()
        call.resolve(result)
    }

    // MARK: Apple Health

    private lazy var healthStore = HKHealthStore()
    private let bodyMass = HealthAccess.bodyMass

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

    /// Shows Apple's Health permission sheet, for everything Fatty saves and
    /// reads (HealthAccess). It only appears while something's unasked;
    /// after that, changes happen in the Health app.
    @objc func requestHealth(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["available": false])
            return
        }
        healthStore.requestAuthorization(toShare: HealthAccess.shareTypes, read: HealthAccess.readTypes) { _, _ in
            call.resolve([
                "available": true,
                "workouts": self.status(of: HKObjectType.workoutType()),
                "bodyweight": self.status(of: self.bodyMass),
            ])
        }
    }

    /// Saves a finished session as a strength-training workout. `start` and
    /// `end` are epoch milliseconds; `sessionId` tags it so it can be traced.
    /// `effort` (1-10, the session's average RPE) becomes its Effort rating
    /// on iOS 18, the watch's copy included when the watch recorded it.
    @objc func saveWorkout(_ call: CAPPluginCall) {
        let effort = call.getDouble("effort").flatMap { (1...10).contains($0) ? $0 : nil }
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
        // The watch recorded this one, heart rate and all: one copy is enough.
        if let sessionId = call.getString("sessionId"), WatchBridge.shared.recordedOnWatch(sessionId) {
            if let effort {
                WorkoutEffort.rateWatchWorkout(sessionId: sessionId, score: effort, store: healthStore)
            }
            call.resolve(["saved": false, "skipped": "watch"])
            return
        }
        HealthWorkouts.save(
            start: Date(timeIntervalSince1970: startMs / 1000),
            end: Date(timeIntervalSince1970: endMs / 1000),
            sessionId: call.getString("sessionId"),
            effort: effort,
            store: healthStore
        ) { result in
            switch result {
            case .success(let saved): call.resolve(["saved": saved])
            case .failure(let error): call.reject(error.localizedDescription)
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

    /// Recovery on Home: whether Health's sheet has anything left to ask.
    @objc func recoveryStatus(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["available": false, "shouldRequest": false])
            return
        }
        Task {
            let ask = await RecoveryReadings.shouldRequest(self.healthStore)
            call.resolve(["available": true, "shouldRequest": ask])
        }
    }

    /// Recovery on Home: four weeks of sleep, HRV and resting heart rate.
    @objc func recoveryData(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["days": []])
            return
        }
        Task {
            let days = await RecoveryReadings.read(self.healthStore)
            call.resolve(["days": days.map(\.dictionary)])
            // The widget shows the same call as the card.
            await RecoveryRefresher.refresh(store: self.healthStore, days: days)
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
        guard let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data) else {
            call.reject("The widget snapshot didn't match the expected shape")
            return
        }
        // Widgets redraw; Siri's phrases name the days and lifts; Spotlight finds them.
        WidgetRefresher.apply(data, snapshot)
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

    // MARK: Apple Watch

    /// Whether a watch is paired, has Fatty, and whose account it's on.
    @objc func watchStatus(_ call: CAPPluginCall) {
        WatchBridge.shared.whenActivated {
            call.resolve(WatchBridge.shared.status())
        }
    }

    /// The lifter's settings for the watch, and a token when it needs one.
    @objc func watchSync(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("userId is required")
            return
        }
        let settings: [String: Any] = [
            "unit": call.getString("unit") == "lb" ? "lb" : "kg",
            "accent": call.getString("accent") ?? "#df2d28",
            "restSeconds": call.getDouble("restSeconds") ?? 90,
            "hrRest": call.getBool("hrRest") ?? true,
            "timeZone": call.getString("timeZone") ?? TimeZone.current.identifier,
        ]
        WatchBridge.shared.whenActivated {
            WatchBridge.shared.sync(token: call.getString("token"), userId: userId, settings: settings)
            call.resolve()
        }
    }

    /// Disconnects the watch; resolves with its token for the site to revoke.
    @objc func watchUnlink(_ call: CAPPluginCall) {
        let disable = call.getBool("disable") ?? false
        WatchBridge.shared.whenActivated {
            let token = WatchBridge.shared.unlink(disable: disable)
            // Not a Settings switch but signing out: their lifts leave Spotlight too.
            if !disable { SpotlightIndex.clear() }
            call.resolve(["token": token.map { $0 as Any } ?? NSNull()])
        }
    }

    @objc func setWatchAutoOpen(_ call: CAPPluginCall) {
        WatchBridge.shared.setAutoOpen(call.getBool("on") ?? true)
        call.resolve()
    }

    // MARK: Background widget refresh

    /// Whose device token this phone holds (WidgetRefresher).
    @objc func phoneStatus(_ call: CAPPluginCall) {
        var status: [String: Any] = [:]
        if let userId = WidgetRefresher.linkedUserId { status["linkedUserId"] = userId }
        call.resolve(status)
    }

    /// The unit and timezone for background fetches, and a token when new.
    @objc func phoneSync(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("userId is required")
            return
        }
        WidgetRefresher.link(
            token: call.getString("token"),
            userId: userId,
            unit: call.getString("unit") == "lb" ? "lb" : "kg",
            timeZone: call.getString("timeZone") ?? TimeZone.current.identifier
        )
        call.resolve()
    }

    /// Signing out: forgets the token; resolves with it for the site to revoke.
    @objc func phoneUnlink(_ call: CAPPluginCall) {
        let token = WidgetRefresher.unlink()
        call.resolve(["token": token.map { $0 as Any } ?? NSNull()])
    }

    // MARK: Voice logging

    /// Sets "Undo my last set" took back for this session, once (RemovedSets).
    @objc func takeRemovedSets(_ call: CAPPluginCall) {
        guard let sessionId = call.getString("sessionId") else {
            call.resolve(["setIds": []])
            return
        }
        call.resolve(["setIds": RemovedSets.take(sessionId: sessionId)])
    }

    /// Whether this iPhone can read sets said in words: "available", or why
    /// not (SetReader.status). The logger only offers "Say it" when it can.
    @objc func setReaderStatus(_ call: CAPPluginCall) {
        call.resolve(["status": SetReader.status])
    }

    /// The runs of sets in what the lifter typed or dictated, as Apple's
    /// on-device model reads them; the page matches and fills them in
    /// (src/lib/spoken-sets.ts). Rejects "unavailable" or "failed".
    @objc func readSets(_ call: CAPPluginCall) {
        let text = (call.getString("text") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            call.reject("Nothing to read", "failed")
            return
        }
        let exercises = ((call.options["exercises"] as? [Any]) ?? []).compactMap { $0 as? String }
        let unit = call.getString("unit") == "lb" ? "lb" : "kg"
        Task {
            do {
                let runs = try await SetReader.read(
                    String(text.prefix(500)),
                    exercises: Array(exercises.prefix(40)),
                    unit: unit
                )
                call.resolve(["runs": runs])
            } catch SetReader.ReadError.unavailable {
                call.reject("Apple's on-device model isn't available", "unavailable")
            } catch {
                call.reject("Couldn't read that", "failed")
            }
        }
    }

    /// A workout's heart rate from Health: the watch's readings every five
    /// seconds from `start` to `end` (epoch ms), the resting heart rate
    /// before it, and whether Health's sheet has heart rate still to ask.
    @objc func workoutHeartRate(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(),
              let startMs = call.getDouble("start"),
              let endMs = call.getDouble("end"),
              endMs > startMs, endMs - startMs <= 6 * 3_600_000
        else {
            call.resolve(["ask": false, "samples": []])
            return
        }
        let start = Date(timeIntervalSince1970: startMs / 1000)
        let end = Date(timeIntervalSince1970: endMs / 1000)
        Task {
            async let ask = WorkoutHeartRate.shouldRequest(self.healthStore)
            async let samples = WorkoutHeartRate.readings(from: start, to: end, store: self.healthStore)
            async let resting = WorkoutHeartRate.resting(before: start, store: self.healthStore)
            var reply: [String: Any] = ["ask": await ask, "samples": await samples]
            if let resting = await resting { reply["resting"] = resting }
            call.resolve(reply)
        }
    }

    /// Health's sheet for heart rate (and resting heart rate) alone.
    @objc func requestHeartRate(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve()
            return
        }
        Task {
            await WorkoutHeartRate.request(self.healthStore)
            call.resolve()
        }
    }

    /// Two sentences from the heart-rate facts the page worked out, written
    /// by Apple's on-device model. Rejects "unavailable" or "failed".
    @objc func heartSummary(_ call: CAPPluginCall) {
        let facts = (call.getString("facts") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !facts.isEmpty else {
            call.reject("No facts to write from", "failed")
            return
        }
        Task {
            do {
                call.resolve(["text": try await HeartSummary.write(String(facts.prefix(1500)))])
            } catch HeartSummary.WriteError.unavailable {
                call.reject("Apple's on-device model isn't available", "unavailable")
            } catch {
                call.reject("Couldn't write a summary", "failed")
            }
        }
    }

    /// Whether the lifter saves workouts to Health (the Settings switch), for
    /// a workout finished by voice.
    @objc func setHealthSync(_ call: CAPPluginCall) {
        HealthSync.set(call.getBool("on") ?? false)
        call.resolve()
    }

    /// A workout day started: Siri learns when it's trained, and suggests it
    /// on the Lock Screen and in Spotlight around then. Once per session.
    @objc func donateWorkoutStart(_ call: CAPPluginCall) {
        guard let sessionId = call.getString("sessionId"),
              let templateId = call.getString("templateId"),
              let label = call.getString("label"),
              UserDefaults.standard.string(forKey: "siri.donatedSession") != sessionId
        else {
            call.resolve()
            return
        }
        UserDefaults.standard.set(sessionId, forKey: "siri.donatedSession")
        let intent = StartWorkoutDayIntent()
        intent.workout = WorkoutDayEntity(id: templateId, label: label)
        let donation = intent
        Task {
            _ = try? await IntentDonationManager.shared.donate(intent: donation)
        }
        call.resolve()
    }

    /// The rest length and whether a set starts one, for sets logged by
    /// voice while the page is asleep (VoiceSetLogger).
    @objc func setRestDefaults(_ call: CAPPluginCall) {
        RestDefaults.save(seconds: call.getDouble("seconds"), auto: call.getBool("auto"))
        call.resolve()
    }

    // MARK: Web view chrome

    /// Keeps the screen from locking while a workout's open (and lets it
    /// lock again after).
    @objc func keepAwake(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = on
        }
        call.resolve()
    }

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

    static func upsert(sessionId: String, startedAt: Date, state incoming: WorkoutActivityAttributes.ContentState) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        // Whoever sends the state (the page, the watch, a set said to Siri),
        // the heart rate is the watch's latest.
        var state = incoming
        if state.heartRate == nil { state.heartRate = WatchBridge.shared.heartRate(for: sessionId) }
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

    private static var heartRateShown: (bpm: Int, at: Date)?

    /// A new reading from the watch onto the Lock Screen: every 10 seconds
    /// at most, sooner for a jump of 5 or more.
    static func showHeartRate(_ bpm: Int, sessionId: String) {
        guard let current = Activity<WorkoutActivityAttributes>.activities.first(where: {
            $0.attributes.sessionId == sessionId && isLive($0)
        }) else { return }
        if let shown = heartRateShown,
           Date().timeIntervalSince(shown.at) < 10, abs(shown.bpm - bpm) < 5 {
            return
        }
        heartRateShown = (bpm, Date())
        var state = current.content.state
        state.heartRate = bpm
        let content = ActivityContent(state: state, staleDate: current.content.staleDate)
        Task { await current.update(content) }
    }

    static func end(except sessionId: String? = nil) {
        for activity in Activity<WorkoutActivityAttributes>.activities
        where activity.attributes.sessionId != sessionId {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
    }
}
