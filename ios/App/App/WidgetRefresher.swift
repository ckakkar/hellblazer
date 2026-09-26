import Foundation
import WidgetKit

/// Keeps the widgets, Siri and Spotlight fresh between visits to the
/// dashboard. When a workout is finished anywhere (the website, the app, the
/// watch), the server sends this iPhone a silent push (src/lib/widget-push.ts);
/// the app then fetches a new snapshot from /api/device/snapshot with its own
/// device token, which the site minted for it (DeviceSync → phoneSync).
enum WidgetRefresher {
    private static let defaults = UserDefaults.standard
    private enum Key {
        static let userId = "phone.userId"
        static let unit = "phone.unit"
        static let timeZone = "phone.timeZone"
    }

    /// Whose token this phone holds, or nil.
    static var linkedUserId: String? {
        Keychain.phoneToken != nil ? defaults.string(forKey: Key.userId) : nil
    }

    /// Stores the unit and timezone (sent with each fetch), and the token
    /// when the site minted a new one.
    static func link(token: String?, userId: String, unit: String, timeZone: String) {
        if let token {
            Keychain.phoneToken = token
            defaults.set(userId, forKey: Key.userId)
        }
        defaults.set(unit, forKey: Key.unit)
        defaults.set(timeZone, forKey: Key.timeZone)
    }

    /// Forgets the token (signing out); returns it so the site can revoke it.
    static func unlink() -> String? {
        let token = Keychain.phoneToken
        Keychain.phoneToken = nil
        defaults.removeObject(forKey: Key.userId)
        return token
    }

    /// Stores a snapshot and redraws everything that reads it.
    static func apply(_ data: Data, _ snapshot: WidgetSnapshot) {
        WidgetSnapshot.save(data)
        WidgetCenter.shared.reloadAllTimelines()
        HellBlazerShortcuts.updateAppShortcutParameters()
        SpotlightIndex.update(from: snapshot)
    }

    /// Fetches a fresh snapshot. Calls back with whether it got one.
    static func refresh(completion: @escaping (Bool) -> Void) {
        guard let token = Keychain.phoneToken,
              let url = URL(string: "https://hellblazer.vercel.app/api/device/snapshot")
        else {
            completion(false)
            return
        }
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(defaults.string(forKey: Key.unit) ?? "kg", forHTTPHeaderField: "X-Fatty-Unit")
        request.setValue(defaults.string(forKey: Key.timeZone) ?? TimeZone.current.identifier, forHTTPHeaderField: "X-Fatty-TZ")
        URLSession.shared.dataTask(with: request) { data, response, _ in
            guard (response as? HTTPURLResponse)?.statusCode == 200,
                  let data,
                  let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
            else {
                completion(false)
                return
            }
            DispatchQueue.main.async {
                apply(data, snapshot)
                completion(true)
            }
        }.resume()
    }
}
