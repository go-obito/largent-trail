import Foundation

struct DashboardSnapshot: Codable, Sendable {
    let updatedAt: Date
    let totalBalanceMinor: Int
    let weekSpentMinor: Int
    let weekBudgetMinor: Int?
    let dailySpentMinor: Int
    let dailyTargetMinor: Int?
    let dailyLeftMinor: Int?
    let savingsAllocatedMinor: Int
    let savingsTargetMinor: Int
    let recentTransactions: [RecentTransaction]

    struct RecentTransaction: Codable, Sendable, Identifiable {
        let id: String
        let title: String
        let kind: String
        let amountMinor: Int
        let occurredOn: String
    }

    static func fromAPI(_ data: DashboardResponse) -> DashboardSnapshot {
        DashboardSnapshot(
            updatedAt: .now,
            totalBalanceMinor: data.totalBalanceMinor,
            weekSpentMinor: data.week.spentMinor,
            weekBudgetMinor: data.week.budgetTotalMinor,
            dailySpentMinor: data.dailyTarget.spentTodayMinor,
            dailyTargetMinor: data.dailyTarget.targetMinor,
            dailyLeftMinor: data.dailyTarget.leftMinor,
            savingsAllocatedMinor: data.needs.totalAllocatedMinor,
            savingsTargetMinor: data.needs.totalTargetMinor,
            recentTransactions: data.recentTransactions.prefix(4).map {
                RecentTransaction(
                    id: $0.id,
                    title: $0.note?.isEmpty == false ? $0.note! : ($0.categoryName ?? "Transaction"),
                    kind: $0.kind,
                    amountMinor: $0.amountMinor,
                    occurredOn: $0.occurredOn
                )
            }
        )
    }
}

struct DashboardResponse: Decodable {
    let totalBalanceMinor: Int
    let week: Week
    let dailyTarget: DailyTarget
    let needs: Needs
    let recentTransactions: [Transaction]

    enum CodingKeys: String, CodingKey {
        case totalBalanceMinor = "total_balance_minor"
        case week, dailyTarget = "daily_target", needs
        case recentTransactions = "recent_transactions"
    }

    struct Week: Decodable {
        let spentMinor: Int
        let budgetTotalMinor: Int?
        enum CodingKeys: String, CodingKey {
            case spentMinor = "spent_minor", budgetTotalMinor = "budget_total_minor"
        }
    }

    struct DailyTarget: Decodable {
        let spentTodayMinor: Int
        let targetMinor: Int?
        let leftMinor: Int?
        enum CodingKeys: String, CodingKey {
            case spentTodayMinor = "spent_today_minor"
            case targetMinor = "target_minor"
            case leftMinor = "left_minor"
        }
    }

    struct Needs: Decodable {
        let totalAllocatedMinor: Int
        let totalTargetMinor: Int
        enum CodingKeys: String, CodingKey {
            case totalAllocatedMinor = "total_allocated_minor"
            case totalTargetMinor = "total_target_minor"
        }
    }

    struct Transaction: Decodable {
        let id: String
        let kind: String
        let amountMinor: Int
        let categoryName: String?
        let note: String?
        let occurredOn: String
        enum CodingKeys: String, CodingKey {
            case id, kind, note
            case amountMinor = "amount_minor"
            case categoryName = "category_name"
            case occurredOn = "occurred_on"
        }
    }
}

enum WidgetMoney {
    static func format(_ minor: Int) -> String {
        (Double(minor) / 100).formatted(.currency(code: "GHS").locale(Locale(identifier: "en_GH")))
    }
}
