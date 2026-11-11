import Foundation

/// A canvas keeps every detail. Widget sizes choose a short, ordered summary.
/// The first leaf is the headline; Row groups never turn into extra widget rows.
struct BoardContent {
    struct Block: Identifiable {
        let id: String
        let element: Element
    }

    let title: String?
    /// The agent asked for the whole widget to be painted as an alert.
    let alert: Bool
    /// The agent asked for an "Updated" footer drawn from the save time.
    let showUpdated: Bool
    let blocks: [Block]

    init(spec: BoardSpec) {
        if case .board(let props) = spec.elements[spec.root]?.kind {
            title = props.title
            alert = props.alert ?? false
            showUpdated = props.showUpdated ?? false
        } else {
            title = nil
            alert = false
            showUpdated = false
        }
        var result: [Block] = []
        var visited = Set<String>()
        func visit(_ key: String, depth: Int) {
            guard depth <= 8, visited.count < 64, visited.insert(key).inserted,
                  let element = spec.elements[key] else { return }
            switch element.kind {
            case .board, .row:
                for child in element.children { visit(child, depth: depth + 1) }
            case .unknown:
                break
            case .stat, .progress, .ring, .trend, .columns, .barList, .split, .rows,
                 .agenda, .dots, .grid, .checklist, .steps, .note:
                result.append(Block(id: key, element: element))
            }
        }
        visit(spec.root, depth: 0)
        blocks = result
    }

    /// Small shows the first leaf. Medium adds at most the next two.
    func summary(includingSupportingDetails: Bool) -> [Block] {
        Array(blocks.prefix(includingSupportingDetails ? 3 : 1))
    }
}
