#if DEBUG
import Foundation

/// Deterministic sample data for previews and layout checks, without network or sign-in.
enum BoardSamples {
    static let weeklySpending = make("""
    {"root":"board","elements":{
      "board":{"type":"Board","props":{"title":null},"children":["budget"]},
      "budget":{"type":"Stat","props":{"label":"This Week","value":"$312.50","supportingText":"Down 18% from last month","caption":null,"tone":"accent"},"children":[]}
    }}
    """)
    static let spending = make("""
    {"root":"board","elements":{
      "board":{"type":"Board","props":{"title":"November spending"},"children":["spent","details","note"]},
      "spent":{"type":"Stat","props":{"label":"November spending","value":"$8,241.56","caption":"USD · Nov 1–10 posted, net credits","tone":"accent"},"children":[]},
      "details":{"type":"Row","props":{},"children":["pending","uncategorized"]},
      "pending":{"type":"Stat","props":{"label":"Pending","value":"$640.21","caption":"Excluded above","tone":"default"},"children":[]},
      "uncategorized":{"type":"Stat","props":{"label":"Uncategorized","value":"$128.04","caption":"Excluded above","tone":"default"},"children":[]},
      "note":{"type":"Note","props":{"text":"All linked accounts · No limit set. Source refresh time is unknown.","loud":false},"children":[]}
    }}
    """)
    static let reminder = make("""
    {"root":"board","elements":{
      "board":{"type":"Board","props":{"title":"Before you leave"},"children":["note"]},
      "note":{"type":"Note","props":{"text":"Take your keys and the package by the door.","loud":true},"children":[]}
    }}
    """)
    static let progress = make("""
    {"root":"board","elements":{
      "board":{"type":"Board","props":{"title":"Reading goal"},"children":["progress"]},
      "progress":{"type":"Progress","props":{"label":"This month","value":0.6,"caption":"3 of 5 books","tone":"good"},"children":[]}
    }}
    """)

    private static func make(_ json: String) -> Board {
        Board(id: "welcome", spec: try! JSONDecoder().decode(BoardSpec.self, from: Data(json.utf8)), updatedAt: Date(timeIntervalSince1970: 1_794_356_400))
    }
}
#endif
