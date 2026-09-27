import AppIntents
import SwiftUI
import WidgetKit

/// A Start Workout button for Control Center, the Lock Screen's controls and
/// the Action button (iOS 18 and later). Opens Fatty on the Log screen.
@available(iOS 18.0, *)
struct StartWorkoutControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.kkrwhofrags.hellblazer.start-workout") {
            ControlWidgetButton(action: StartWorkoutIntent()) {
                Label("Start Workout", systemImage: "figure.strengthtraining.traditional")
            }
        }
        .displayName("Start Workout")
        .description("Opens Fatty ready to log a session.")
    }
}

/// Logs the next set of the workout in progress, same weight and reps as
/// the last, without opening Fatty (LogNextSetIntent). For the Lock Screen
/// and the Action button, mid-workout; the Live Activity shows it land.
@available(iOS 18.0, *)
struct LogSetControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.kkrwhofrags.hellblazer.log-set") {
            ControlWidgetButton(action: LogNextSetIntent()) {
                Label("Log Set", systemImage: "checkmark.circle")
            }
        }
        .displayName("Log Next Set")
        .description("Logs your next set, same weight and reps as the last.")
    }
}
