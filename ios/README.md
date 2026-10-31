# Largent iOS widgets

This directory contains a native SwiftUI companion app and WidgetKit extension. The Next.js PWA remains the primary Largent application. The companion authenticates with the same Clerk account, fetches the existing dashboard endpoint, and publishes a protected snapshot to the iOS widget extension.

## Requirements

- macOS with Xcode 16 or later (the selected Clerk SDK release may require a newer toolchain).
- XcodeGen 2.41+ (install with Homebrew).
- A Clerk application with Native API enabled and an iOS native application registered.
- An Apple Developer App Group matching the configured identifier.

## Configure

1. In Clerk Dashboard, enable Native API and register the iOS app with bundle identifier site.largent.ios.
2. Set the Clerk publishable key and API base URL in Config/Defaults.xcconfig. Do not commit production secrets.
3. Create the App Group group.site.largent.shared in the Apple Developer portal and enable it for both targets. Update the xcconfig if your team uses another identifier.
4. Generate the Xcode project with xcodegen generate from this directory, then open Largent.xcodeproj.
5. Select your development team for both targets and build/run on an iPhone.

## Data flow and privacy

- The app signs in through Clerk hosted authentication and requests GET /v1/dashboard?balance_range=all_time with a short-lived Clerk session token.
- Only widget-required fields are copied into an App Group JSON snapshot. No token is written to the shared container.
- The snapshot uses iOS file protection until the first device unlock after restart.
- Widget content is marked privacySensitive so iOS can redact it in privacy-sensitive contexts such as the Lock Screen.
- The widget extension makes no network requests. It renders the last snapshot fetched by the companion app. Opening or foregrounding the companion app while signed in refreshes the snapshot and reloads widget timelines.
- WidgetKit controls actual refresh frequency; the requested 30-minute timeline is advisory and iOS may delay updates. Open Largent to force a fresh snapshot.
- The PWA remains unchanged and works independently.

## Widget sizes

- Small: total balance and today's spending.
- Medium: balance, today's spending and weekly budget progress.
- Large: balance, savings allocation progress and recent transactions.

Widgets are read-only. Tapping one opens the companion app. Money remains integer pesewas in the API and is formatted as GHS at the display layer.
