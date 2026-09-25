import CoreSpotlight
import UniformTypeIdentifiers

/// Your workout days and lifts in Spotlight search: a day starts it
/// (/log?start=…), a lift opens its progress. Each item's identifier is the
/// page it opens; SceneDelegate routes the tap.
enum SpotlightIndex {
    private static let domains = ["workouts", "lifts"]

    static func update(from snapshot: WidgetSnapshot) {
        let unit = snapshot.unit ?? "kg"
        var items: [CSSearchableItem] = []
        for workout in snapshot.workouts ?? [] {
            let attributes = CSSearchableItemAttributeSet(contentType: .content)
            attributes.title = workout.label
            attributes.contentDescription = "Start this workout in Fatty"
            attributes.keywords = ["workout", "start", "train", "gym"]
            items.append(CSSearchableItem(
                uniqueIdentifier: "/log?start=\(workout.templateId)",
                domainIdentifier: "workouts",
                attributeSet: attributes
            ))
        }
        for lift in snapshot.lifts ?? [] {
            let attributes = CSSearchableItemAttributeSet(contentType: .content)
            attributes.title = lift.name
            let weight = lift.bestWeight.rounded() == lift.bestWeight
                ? String(Int(lift.bestWeight))
                : String(format: "%.1f", lift.bestWeight)
            attributes.contentDescription =
                "Best \(weight) \(unit) × \(lift.bestReps) · est. max \(Int(lift.estimatedMax.rounded())) \(unit)"
            attributes.keywords = ["progress", "max", "record", "PR"]
            items.append(CSSearchableItem(
                uniqueIdentifier: "/progress?exercise=\(lift.id)",
                domainIdentifier: "lifts",
                attributeSet: attributes
            ))
        }
        let index = CSSearchableIndex.default()
        index.deleteSearchableItems(withDomainIdentifiers: domains) { _ in
            index.indexSearchableItems(items)
        }
    }

    /// Signed out: nothing of theirs stays searchable.
    static func clear() {
        CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: domains)
    }
}
