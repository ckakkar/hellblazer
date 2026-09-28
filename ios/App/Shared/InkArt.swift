import CoreImage
import CoreImage.CIFilterBuiltins

/// The fighter's portrait as ink: white lines traced from the art's edges,
/// as opaque as the edge is strong, nothing else. It's the fighter in the
/// Home Screen's Clear and Tinted looks (where iOS draws from transparency
/// alone, so the full-colour portrait comes out a solid white block), and
/// the sketch behind the other widgets, red on black in full colour.
enum InkArt {
    static func make(from image: CGImage) -> CGImage? {
        let input = CIImage(cgImage: image)
        let mono = CIFilter.colorControls()
        mono.inputImage = input
        mono.saturation = 0
        mono.contrast = 1.1
        // Shadows lifted first, so dark portraits have lines to find.
        let lift = CIFilter.gammaAdjust()
        lift.inputImage = mono.outputImage
        lift.power = 0.45
        let edges = CIFilter.edges()
        edges.inputImage = lift.outputImage
        edges.intensity = 4
        let firm = CIFilter.gammaAdjust()
        firm.inputImage = edges.outputImage?.cropped(to: input.extent)
        firm.power = 0.7
        let ink = CIFilter.maskToAlpha()
        ink.inputImage = firm.outputImage
        guard let output = ink.outputImage else { return nil }
        return context.createCGImage(output, from: input.extent)
    }

    /// On the CPU: iOS refuses GPU work from an app in the background (a
    /// widget refresh after a workout) and from a widget, where this also runs.
    private static let context = CIContext(options: [.useSoftwareRenderer: true])
}
