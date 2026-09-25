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
