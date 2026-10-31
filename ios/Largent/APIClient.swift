import Foundation
import ClerkKit

struct APIClient {
    func refreshDashboard() async throws -> DashboardSnapshot {
        guard let baseURL = Bundle.main.object(forInfoDictionaryKey: "LARGENT_API_BASE_URL") as? String,
              let url = URL(string: baseURL + "/v1/dashboard?balance_range=all_time") else {
            throw APIError.invalidConfiguration
        }
        guard let token = try await Clerk.shared.auth.getToken() else {
            throw APIError.notAuthenticated
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 20

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard http.statusCode == 200 else { throw APIError.server(http.statusCode) }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let dashboard = try decoder.decode(DashboardResponse.self, from: data)
        return DashboardSnapshot.fromAPI(dashboard)
    }

    enum APIError: Error {
        case invalidConfiguration, notAuthenticated, invalidResponse
        case server(Int)
    }
}
