// Genera el ícono del Dock a partir del logo real de NorthPoint (logo-fuente.png):
// esquinas redondeadas al estilo macOS y todos los tamaños del iconset → np.icns
import Cocoa
let sizes = [16, 32, 64, 128, 256, 512, 1024]
let dir = "np.iconset"
try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
guard let fuente = NSImage(contentsOfFile: "logo-fuente.png") else { print("falta logo-fuente.png"); exit(1) }
func dibuja(_ px: Int) -> NSImage {
    let img = NSImage(size: NSSize(width: px, height: px))
    img.lockFocus()
    let p = CGFloat(px)
    let r = NSRect(x: p * 0.05, y: p * 0.05, width: p * 0.9, height: p * 0.9)   // margen como los íconos de macOS
    let path = NSBezierPath(roundedRect: r, xRadius: p * 0.2, yRadius: p * 0.2)
    path.addClip()
    fuente.draw(in: r, from: NSRect(origin: .zero, size: fuente.size), operation: .sourceOver, fraction: 1)
    img.unlockFocus()
    return img
}
for s in sizes {
    for (suf, scale) in [("", 1), ("@2x", 2)] {
        let px = s * scale; if px > 1024 { continue }
        let img = dibuja(px)
        guard let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) else { continue }
        try? png.write(to: URL(fileURLWithPath: "\(dir)/icon_\(s)x\(s)\(suf).png"))
    }
}
print("iconset listo")
