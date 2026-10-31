import SwiftUI
import ClerkKit

@main
struct LargentApp: App {
    init() {
        let key = Bundle.main.object(forInfoDictionaryKey: "LARGENT_CLERK_PUBLISHABLE_KEY") as? String ?? ""
        Clerk.configure(publishableKey: key)
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(Clerk.shared)
                .task { try? await Clerk.shared.load() }
        }
    }
}
