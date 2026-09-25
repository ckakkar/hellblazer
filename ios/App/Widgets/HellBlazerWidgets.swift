import SwiftUI
import WidgetKit

@main
struct HellBlazerWidgets: WidgetBundle {
    var body: some Widget {
        NextBoutWidget()
        WorkoutLiveActivity()
        if #available(iOSApplicationExtension 18.0, *) {
            StartWorkoutControl()
        }
    }
}
