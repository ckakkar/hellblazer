import SwiftUI

/// The app's palette, from src/app/globals.css.
enum Brand {
    static let background = Color(red: 0, green: 0, blue: 0)
    static let surface = Color(red: 0x12 / 255, green: 0x12 / 255, blue: 0x14 / 255)
    static let bone = Color(red: 0xF4 / 255, green: 0xF2 / 255, blue: 0xEE / 255)
    static let muted = Color(red: 0x8E / 255, green: 0x8C / 255, blue: 0x88 / 255)
    /// The flame mark's red.
    static let flame = Color(red: 0xDF / 255, green: 0x2D / 255, blue: 0x28 / 255)
}
