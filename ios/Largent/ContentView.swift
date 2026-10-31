import SwiftUI
import WidgetKit
import ClerkKit

struct ContentView: View {
    @Environment(Clerk.self) private var clerk
    @Environment(\.scenePhase) private var scenePhase
    @State private var snapshot: DashboardSnapshot?
    @State private var isRefreshing = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if clerk.user == nil { signedOut } else { dashboard }
            }
            .navigationTitle("Largent")
            .toolbar {
                if clerk.user != nil {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Refresh", systemImage: "arrow.clockwise") {
                            Task { await refresh() }
                        }
                        .disabled(isRefreshing)
                    }
                }
            }
        }
        .task(id: clerk.user?.id) {
            if clerk.user != nil { await refresh() }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, clerk.user != nil { Task { await refresh() } }
        }
    }

    private var signedOut: some View {
        VStack(spacing: 18) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 42, weight: .medium)).foregroundStyle(.blue)
            Text("Your money, at a glance.").font(.title2.bold())
            Text("Sign in to Largent to add balance and spending widgets to your Home Screen.")
                .multilineTextAlignment(.center).foregroundStyle(.secondary)
            Button("Sign in") {
                Task { try? await clerk.auth.startHostedAuth(mode: .signIn) }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(28)
    }

    private var dashboard: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let snapshot {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Total balance").foregroundStyle(.white.opacity(0.8))
                        Text(WidgetMoney.format(snapshot.totalBalanceMinor))
                            .font(.system(size: 34, weight: .bold, design: .rounded)).foregroundStyle(.white)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading).padding(22)
                    .background(Color(red: 0.09, green: 0.13, blue: 0.25), in: RoundedRectangle(cornerRadius: 22))

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Today's spending").font(.headline)
                        Text(WidgetMoney.format(snapshot.dailySpentMinor)).font(.title.bold())
                        if let left = snapshot.dailyLeftMinor {
                            Text(left >= 0 ? "\(WidgetMoney.format(left)) left today" : "\(WidgetMoney.format(abs(left))) over today's target")
                                .foregroundStyle(.secondary)
                        } else {
                            Text("Set a budget to create a daily target").foregroundStyle(.secondary)
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Weekly budget").font(.headline)
                        Text(WidgetMoney.format(snapshot.weekSpentMinor) + " spent")
                        if let budget = snapshot.weekBudgetMinor, budget > 0 {
                            ProgressView(value: min(1, Double(snapshot.weekSpentMinor) / Double(budget)))
                            Text("of " + WidgetMoney.format(budget)).foregroundStyle(.secondary)
                        }
                    }

                    Label("Add Largent widgets from your Home Screen's edit menu.", systemImage: "widget.small")
                        .font(.footnote).foregroundStyle(.secondary)
                } else if isRefreshing {
                    ProgressView("Loading your dashboard…")
                } else {
                    ContentUnavailableView("No dashboard yet", systemImage: "chart.bar",
                        description: Text("Refresh to load your Largent data."))
                }
                if let errorMessage { Text(errorMessage).font(.footnote).foregroundStyle(.red) }
            }
            .padding()
        }
        .refreshable { await refresh() }
    }

    @MainActor
    private func refresh() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            let latest = try await APIClient().refreshDashboard()
            try SharedSnapshotStore.save(latest)
            snapshot = latest
            errorMessage = nil
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            snapshot = SharedSnapshotStore.load()
            errorMessage = "Couldn't refresh. Open Largent while online and try again."
        }
    }
}
