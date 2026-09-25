import HealthKit
import SwiftUI
import WatchKit

/// Fatty on Apple Watch (watchOS 10+, so the first Apple Watch SE too): start
/// a workout day, log sets with the Digital Crown, rest with a countdown that
/// taps your wrist, and record it all to Apple Health with heart rate. It
/// talks to the server itself (/api/watch) with a token the iPhone app hands
/// over, so it works while the phone stays in your bag.
@main
struct FattyWatchApp: App {
    @WKApplicationDelegateAdaptor(WatchAppDelegate.self) private var appDelegate
    @StateObject private var model = WatchModel.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .tint(model.accent)
        }
    }
}

final class WatchAppDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() {
        Task { @MainActor in WatchModel.shared.boot() }
    }

    /// The iPhone app started a workout and opened this one to record it.
    func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
        Task { @MainActor in await WatchModel.shared.phoneStartedWorkout() }
    }
}
