// Ícono = el logo de NorthPoint: la palabra NORTHPOINT en blanco sobre negro (igual que su imagen, pero nítido a 1024px)
import Cocoa
let sizes = [16, 32, 64, 128, 256, 512, 1024]
let dir = "np.iconset"
try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
func dibuja(_ px: Int) -> NSImage {
    let img = NSImage(size: NSSize(width: px, height: px))
    img.lockFocus()
    let p = CGFloat(px)
    let r = NSRect(x: p * 0.05, y: p * 0.05, width: p * 0.9, height: p * 0.9)
    let path = NSBezierPath(roundedRect: r, xRadius: p * 0.2, yRadius: p * 0.2)
    NSColor(white: 0.04, alpha: 1).setFill(); path.fill()
    let f = NSFont.systemFont(ofSize: p * 0.105, weight: .medium)
    let s = NSAttributedString(string: "NORTHPOINT", attributes: [.font: f, .foregroundColor: NSColor(white: 0.94, alpha: 1), .kern: p * 0.002])
    let sz = s.size(); s.draw(at: NSPoint(x: (p - sz.width) / 2, y: (p - sz.height) / 2))
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
