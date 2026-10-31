import Foundation

enum SharedSnapshotStore {
    static let appGroupID = Bundle.main.object(forInfoDictionaryKey: "LARGENT_APP_GROUP_ID") as? String
        ?? "group.site.largent.shared"
    static let fileName = "dashboard-snapshot.json"

    static var snapshotURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID)?
            .appendingPathComponent(fileName)
    }

    static func save(_ snapshot: DashboardSnapshot) throws {
        guard let url = snapshotURL else { throw StoreError.appGroupUnavailable }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(snapshot)
        try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    static func load() -> DashboardSnapshot? {
        guard let url = snapshotURL, let data = try? Data(contentsOf: url) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(DashboardSnapshot.self, from: data)
    }

    enum StoreError: Error { case appGroupUnavailable }
}
