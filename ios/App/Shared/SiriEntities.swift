import AppIntents

/// The lifter's workout days and lifts as App Intents entities, from the
/// snapshot the site hands the app (WidgetSnapshot). Shared by the app (Siri,
/// Shortcuts) and the widget extension (the Lift Trend widget's lift picker).

/// One of the days /log offers, e.g. "Day 2: Upper".
struct WorkoutDayEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Workout"
    static let defaultQuery = WorkoutDayQuery()

    /// The template id.
    let id: String
    let label: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(label)")
    }
}

struct WorkoutDayQuery: EntityStringQuery {
    private func all() -> [WorkoutDayEntity] {
        (WidgetSnapshot.load()?.workouts ?? []).map { WorkoutDayEntity(id: $0.templateId, label: $0.label) }
    }

    func entities(for identifiers: [String]) async throws -> [WorkoutDayEntity] {
        all().filter { identifiers.contains($0.id) }
    }

    func entities(matching string: String) async throws -> [WorkoutDayEntity] {
        all().filter { $0.label.localizedCaseInsensitiveContains(string) }
    }

    func suggestedEntities() async throws -> [WorkoutDayEntity] {
        all()
    }
}

/// An exercise the lifter has logged, with its bests.
struct LiftEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Lift"
    static let defaultQuery = LiftQuery()

    /// The exercise id.
    let id: String
    let name: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }
}

struct LiftQuery: EntityStringQuery {
    private func all() -> [LiftEntity] {
        (WidgetSnapshot.load()?.lifts ?? []).map { LiftEntity(id: $0.id, name: $0.name) }
    }

    func entities(for identifiers: [String]) async throws -> [LiftEntity] {
        all().filter { identifiers.contains($0.id) }
    }

    func entities(matching string: String) async throws -> [LiftEntity] {
        all().filter { $0.name.localizedCaseInsensitiveContains(string) }
    }

    func suggestedEntities() async throws -> [LiftEntity] {
        all()
    }
}
