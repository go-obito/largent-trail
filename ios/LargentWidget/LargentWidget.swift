import SwiftUI
import WidgetKit

struct DashboardEntry: TimelineEntry {
    let date: Date
    let snapshot: DashboardSnapshot?
}

struct DashboardProvider: TimelineProvider {
    func placeholder(in context: Context) -> DashboardEntry { DashboardEntry(date: .now, snapshot: nil) }
    func getSnapshot(in context: Context, completion: @escaping (DashboardEntry) -> Void) {
        completion(DashboardEntry(date: .now, snapshot: SharedSnapshotStore.load()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<DashboardEntry>) -> Void) {
        let entry = DashboardEntry(date: .now, snapshot: SharedSnapshotStore.load())
        completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(30 * 60))))
    }
}

struct LargentWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DashboardEntry

    var body: some View {
        Group {
            if let data = entry.snapshot {
                switch family {
                case .systemSmall: small(data)
                case .systemMedium: medium(data)
                default: large(data)
                }
            } else { empty }
        }
        .containerBackground(for: .widget) { Color(red: 0.09, green: 0.13, blue: 0.25) }
        .privacySensitive()
        .widgetURL(URL(string: "largent://dashboard"))
    }

    private var empty: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("LARGENT").font(.caption.bold()).foregroundStyle(.white.opacity(0.7))
            Text("Open Largent to load your financial snapshot.").font(.subheadline).foregroundStyle(.white)
        }.padding()
    }

    private func small(_ data: DashboardSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            brand
            Text("Total balance").font(.caption).foregroundStyle(.white.opacity(0.72))
            Text(WidgetMoney.format(data.totalBalanceMinor))
                .font(.system(size: 23, weight: .bold, design: .rounded))
                .minimumScaleFactor(0.65).lineLimit(1).foregroundStyle(.white)
            Spacer(minLength: 0)
            Text("Today: " + WidgetMoney.format(data.dailySpentMinor))
                .font(.caption2.weight(.medium)).foregroundStyle(.white.opacity(0.8)).lineLimit(1)
        }.padding()
    }

    private func medium(_ data: DashboardSnapshot) -> some View {
        HStack(spacing: 18) {
            VStack(alignment: .leading, spacing: 7) {
                brand
                Text("Total balance").font(.caption).foregroundStyle(.white.opacity(0.72))
                Text(WidgetMoney.format(data.totalBalanceMinor))
                    .font(.system(size: 25, weight: .bold, design: .rounded))
                    .minimumScaleFactor(0.65).lineLimit(1).foregroundStyle(.white)
                Text("Today " + WidgetMoney.format(data.dailySpentMinor))
                    .font(.caption).foregroundStyle(.white.opacity(0.8))
            }
            Spacer(minLength: 4)
            VStack(alignment: .leading, spacing: 8) {
                Text("THIS WEEK").font(.caption2.bold()).foregroundStyle(.white.opacity(0.7))
                Text(WidgetMoney.format(data.weekSpentMinor)).font(.headline).foregroundStyle(.white)
                if let budget = data.weekBudgetMinor, budget > 0 {
                    ProgressView(value: min(1, Double(data.weekSpentMinor) / Double(budget))).tint(.mint)
                    Text("of " + WidgetMoney.format(budget)).font(.caption2).foregroundStyle(.white.opacity(0.72))
                } else {
                    Text("No weekly budget").font(.caption2).foregroundStyle(.white.opacity(0.72))
                }
            }.frame(maxWidth: .infinity, alignment: .leading)
        }.padding()
    }

    private func large(_ data: DashboardSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                brand
                Spacer()
                Text("UPDATED " + data.updatedAt.formatted(date: .omitted, time: .shortened).uppercased())
                    .font(.system(size: 8, weight: .medium)).foregroundStyle(.white.opacity(0.6))
            }
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("TOTAL BALANCE").font(.caption2.bold()).foregroundStyle(.white.opacity(0.7))
                    Text(WidgetMoney.format(data.totalBalanceMinor))
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundStyle(.white).minimumScaleFactor(0.7).lineLimit(1)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 3) {
                    Text("SAVINGS PROGRESS").font(.system(size: 8, weight: .bold)).foregroundStyle(.white.opacity(0.7))
                    Text(data.savingsTargetMinor > 0
                         ? "\(min(100, data.savingsAllocatedMinor * 100 / data.savingsTargetMinor))%" : "—")
                        .font(.headline.bold()).foregroundStyle(.mint)
                }
            }
            Divider().overlay(.white.opacity(0.2))
            Text("RECENT ACTIVITY").font(.system(size: 9, weight: .bold)).foregroundStyle(.white.opacity(0.7))
            ForEach(data.recentTransactions.prefix(3)) { transaction in
                HStack(spacing: 8) {
                    Text(transaction.title).font(.caption).foregroundStyle(.white).lineLimit(1)
                    Spacer(minLength: 4)
                    Text((transaction.kind == "income" ? "+" : "−") + WidgetMoney.format(transaction.amountMinor))
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(transaction.kind == "income" ? .mint : .white).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }.padding()
    }

    private var brand: some View {
        Text("LARGENT").font(.system(size: 10, weight: .heavy, design: .rounded))
            .tracking(1.4).foregroundStyle(.white.opacity(0.85))
    }
}

@main
struct LargentWidget: Widget {
    let kind = "LargentDashboardWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DashboardProvider()) { entry in
            LargentWidgetView(entry: entry)
        }
        .configurationDisplayName("Largent dashboard")
        .description("Your balance, daily spending, weekly budget and savings at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
