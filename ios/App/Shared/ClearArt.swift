import CoreImage
import CoreImage.CIFilterBuiltins

/// A see-through copy of the fighter's portrait, for the Home Screen's Clear
/// and Tinted looks. There iOS draws a widget from its transparency alone, so
/// the full-colour portrait, opaque edge to edge, comes out as a solid white
/// block. This one is white wherever the art is bright and fades to nothing
/// where it's dark, with the art's ink lines kept, so it reads as the
/// portrait etched into the glass, dark portraits included.
enum ClearArt {
    static func make(from image: CGImage) -> CGImage? {
        let input = CIImage(cgImage: image)

        // Light: bright parts opaque, lifted so shadowed skin still shows.
        let mono = CIFilter.colorControls()
        mono.inputImage = input
        mono.saturation = 0
        mono.contrast = 1.15
        mono.brightness = 0.04
        let lift = CIFilter.gammaAdjust()
        lift.inputImage = mono.outputImage
        lift.power = 0.5
        let light = CIFilter.maskToAlpha()
        light.inputImage = lift.outputImage

        // Ink: the art's edges, for the outline and detail in the dark.
        let edges = CIFilter.edges()
        edges.inputImage = mono.outputImage
        edges.intensity = 2
        let ink = CIFilter.maskToAlpha()
        ink.inputImage = edges.outputImage?.cropped(to: input.extent)

        let both = CIFilter.maximumCompositing()
        both.inputImage = light.outputImage
        both.backgroundImage = ink.outputImage
        guard let output = both.outputImage else { return nil }
        return CIContext().createCGImage(output, from: input.extent)
    }
}
