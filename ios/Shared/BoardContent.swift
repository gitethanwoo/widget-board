import Foundation

/// A canvas keeps every detail. Widget sizes choose a short, ordered summary.
/// The first leaf is the headline; Row groups never turn into extra widget rows.
struct BoardContent {
    struct Block: Identifiable {
        let id: String
        let element: Element
    }

    let title: String?
    let blocks: [Block]

    init(spec: BoardSpec) {
        if case .board(let props) = spec.elements[spec.root]?.kind {
            title = props.title
        } else {
            title = nil
        }
        var result: [Block] = []
        var visited = Set<String>()
        func visit(_ key: String, depth: Int) {
            guard depth <= 8, visited.count < 64, visited.insert(key).inserted,
                  let element = spec.elements[key] else { return }
            switch element.kind {
            case .board, .row:
                for child in element.children { visit(child, depth: depth + 1) }
            case .stat, .progress, .note:
                result.append(Block(id: key, element: element))
            case .unknown:
                break
            }
        }
        visit(spec.root, depth: 0)
        blocks = result
    }

    func summary(includingSupportingDetails: Bool) -> [Block] {
        Array(blocks.prefix(includingSupportingDetails ? 3 : 1))
    }
}
