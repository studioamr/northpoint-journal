// NORTHPOINT JOURNAL — app nativa de Mac (WKWebView). Su propia ventana, sin navegador.
// Extra nativo: carpeta vigilada de verdad (NSOpenPanel + sondeo) para que los CSV de
// Tradovate entren solos, y notificaciones del sistema.
import Cocoa
import WebKit
import UserNotifications

class Delegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!
    var timer: Timer?
    var tvWindow: NSWindow?
    var tvWeb: WKWebView?
    var platWeb: WKWebView?
    var platURL: String = ""
    var carpeta: URL?
    let defaults = UserDefaults.standard

    func applicationDidFinishLaunching(_ n: Notification) {
        let rect = NSRect(x: 0, y: 0, width: 1380, height: 900)
        window = NSWindow(contentRect: rect, styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "NORTHPOINT"
        window.center(); window.setFrameAutosaveName("NPJournalMain")
        window.backgroundColor = NSColor(red: 0.02, green: 0.02, blue: 0.024, alpha: 1)
        window.minSize = NSSize(width: 980, height: 640)
        window.titlebarAppearsTransparent = true
        window.appearance = NSAppearance(named: .darkAqua)

        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = WKWebsiteDataStore.default()      // localStorage + IndexedDB persistentes
        cfg.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        cfg.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        let ucc = WKUserContentController()
        ucc.add(self, name: "np")
        // el puente JS: la app web detecta que corre nativa
        ucc.addUserScript(WKUserScript(source: "window.__npNativo = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        cfg.userContentController = ucc
        webView = WKWebView(frame: rect, configuration: cfg)
        webView.navigationDelegate = self; webView.uiDelegate = self
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground")
        window.contentView = webView

        if let res = Bundle.main.resourceURL {
            webView.loadFileURL(res.appendingPathComponent("web/index.html"), allowingReadAccessTo: res)
        }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        menu()
        reconectarCarpeta()
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    func menu() {
        let main = NSMenu()
        let app = NSMenuItem(); main.addItem(app)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Elegir carpeta de Descargas…", action: #selector(elegirCarpeta), keyEquivalent: "o")
        appMenu.addItem(withTitle: "Recargar", action: #selector(recargar), keyEquivalent: "r")
        appMenu.addItem(withTitle: "TradingView · operar", action: #selector(abrirTrading), keyEquivalent: "t")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Salir de NORTHPOINT", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        app.submenu = appMenu
        let edit = NSMenuItem(); main.addItem(edit)
        let editMenu = NSMenu(title: "Edición")
        editMenu.addItem(withTitle: "Deshacer", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Cortar", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copiar", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Pegar", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Seleccionar todo", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        edit.submenu = editMenu
        NSApp.mainMenu = main
    }
    @objc func recargar() { webView.reload() }

    // ---------------------------------------------------------------- puente JS → Swift
    func userContentController(_ u: WKUserContentController, didReceive m: WKScriptMessage) {
        guard let d = m.body as? [String: Any], let cmd = d["cmd"] as? String else { return }
        switch cmd {
        case "elegirCarpeta": elegirCarpeta()
        case "detenerCarpeta": timer?.invalidate(); timer = nil; carpeta = nil; defaults.removeObject(forKey: "carpetaBookmark"); estado()
        case "barrer": barrer()
        case "notificar":
            let c = UNMutableNotificationContent()
            c.title = d["titulo"] as? String ?? "NORTHPOINT"; c.body = d["texto"] as? String ?? ""; c.sound = .default
            UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: c, trigger: nil))
        case "abrir":
            if let s = d["url"] as? String, let u = URL(string: s) { NSWorkspace.shared.open(u) }
        case "guardarPng":
            guard let b64 = d["b64"] as? String, let data = Data(base64Encoded: b64) else { return }
            let p = NSSavePanel(); p.nameFieldStringValue = d["nombre"] as? String ?? "northpoint.png"; p.allowedFileTypes = ["png"]
            p.directoryURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first
            p.begin { r in if r == .OK, let u = p.url { try? data.write(to: u) } }
        case "trading": abrirTrading()
        case "plataforma":
            guard let u = d["url"] as? String, let url = URL(string: u) else { return }
            let x = d["x"] as? Double ?? 0, y = d["y"] as? Double ?? 0, w = d["w"] as? Double ?? 0, h = d["h"] as? Double ?? 0
            colocaPlataforma(url: url, x: x, y: y, w: w, h: h)
        case "plataformaOcultar": platWeb?.isHidden = true
        case "fetch":
            // la web pide un recurso sin CORS (Forex Factory); lo baja Swift y se lo devuelve en base64
            guard let s = d["url"] as? String, let u = URL(string: s), let id = d["id"] as? String else { return }
            URLSession.shared.dataTask(with: u) { data, _, err in
                let b64 = data?.base64EncodedString() ?? ""
                let e = (err?.localizedDescription ?? "").replacingOccurrences(of: "\"", with: "'")
                let js = "window.__npFetch && window.__npFetch(\"\(id)\", \"\(b64)\", \"\(e)\")"
                DispatchQueue.main.async { self.webView.evaluateJavaScript(js, completionHandler: nil) }
            }.resume()
        default: break
        }
    }

    // ---------------------------------------------------------------- Tradovate / TradingView EMBEBIDOS en la ventana
    // Un WKWebView hermano del principal, colocado exactamente sobre el hueco #tvWrap de la vista Trading.
    // Conserva cookies/login (data store por defecto) aunque cambies de vista.
    func colocaPlataforma(url: URL, x: Double, y: Double, w: Double, h: Double) {
        guard let cv = window.contentView else { return }
        if platWeb == nil {
            let cfg = WKWebViewConfiguration(); cfg.websiteDataStore = WKWebsiteDataStore.default()
            cfg.applicationNameForUserAgent = "Version/17.4 Safari/605.1.15"
            let web = WKWebView(frame: .zero, configuration: cfg); web.uiDelegate = self
            web.setValue(false, forKey: "drawsBackground")
            cv.addSubview(web, positioned: .above, relativeTo: webView); platWeb = web
        }
        if platURL != url.absoluteString { platURL = url.absoluteString; platWeb?.load(URLRequest(url: url)) }
        let H = cv.bounds.height
        platWeb?.frame = NSRect(x: x, y: H - y - h, width: w, height: h)
        platWeb?.isHidden = false
    }

    // ---------------------------------------------------------------- TradingView completo, en su ventana
    @objc func abrirTrading() {
        if tvWindow == nil {
            let rect = NSRect(x: 0, y: 0, width: 1400, height: 900)
            let w = NSWindow(contentRect: rect, styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
            w.title = "TradingView · NORTHPOINT"; w.center(); w.setFrameAutosaveName("NPTradingView"); w.isReleasedWhenClosed = false
            w.appearance = NSAppearance(named: .darkAqua)
            let cfg = WKWebViewConfiguration(); cfg.websiteDataStore = WKWebsiteDataStore.default()   // conserva tu login
            cfg.applicationNameForUserAgent = "Version/17.4 Safari/605.1.15"
            let web = WKWebView(frame: rect, configuration: cfg); web.autoresizingMask = [.width, .height]; web.uiDelegate = self
            web.load(URLRequest(url: URL(string: "https://www.tradingview.com/chart/")!))
            w.contentView = web; tvWindow = w; tvWeb = web
        }
        tvWindow?.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    }
    // ventanas emergentes (login con Google/Apple, etc.) se abren en la misma vista
    func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let u = a.request.url { w.load(URLRequest(url: u)) }
        return nil
    }

    // ---------------------------------------------------------------- carpeta vigilada nativa
    @objc func elegirCarpeta() {
        let p = NSOpenPanel()
        p.canChooseDirectories = true; p.canChooseFiles = false; p.allowsMultipleSelection = false
        p.directoryURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first
        p.message = "Elige la carpeta donde Tradovate guarda tus CSV (normalmente Descargas)"
        p.begin { r in
            guard r == .OK, let u = p.url else { return }
            self.carpeta = u
            if let bm = try? u.bookmarkData(options: .withSecurityScope, includingResourceValuesForKeys: nil, relativeTo: nil) { self.defaults.set(bm, forKey: "carpetaBookmark") }
            self.arrancar()
        }
    }
    func reconectarCarpeta() {
        guard let bm = defaults.data(forKey: "carpetaBookmark") else { return }
        var stale = false
        if let u = try? URL(resolvingBookmarkData: bm, options: .withSecurityScope, relativeTo: nil, bookmarkDataIsStale: &stale) {
            _ = u.startAccessingSecurityScopedResource(); carpeta = u; arrancar()
        }
    }
    func arrancar() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 4, repeats: true) { _ in self.barrer() }
        barrer(); estado()
    }
    func estado() {
        let nombre = carpeta?.lastPathComponent ?? ""
        let activo = timer != nil
        let js = "window.__npCarpeta && window.__npCarpeta(\(activo ? "true" : "false"), \"\(nombre.replacingOccurrences(of: "\"", with: "\\\""))\")"
        DispatchQueue.main.async { self.webView.evaluateJavaScript(js, completionHandler: nil) }
    }
    func barrer() {
        guard let dir = carpeta else { return }
        var vistos = defaults.dictionary(forKey: "csvVistos") as? [String: Bool] ?? [:]
        let fm = FileManager.default
        guard let items = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.contentModificationDateKey, .fileSizeKey], options: [.skipsHiddenFiles]) else { return }
        for f in items where ["csv", "tsv", "txt"].contains(f.pathExtension.lowercased()) {
            let attrs = try? f.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey])
            let mod = attrs?.contentModificationDate ?? Date.distantPast
            let clave = "\(f.lastPathComponent)|\(Int(mod.timeIntervalSince1970))|\(attrs?.fileSize ?? 0)"
            if vistos[clave] == true { continue }
            vistos[clave] = true
            if Date().timeIntervalSince(mod) > 3 * 86400 { continue }             // solo lo fresco
            guard let texto = try? String(contentsOf: f, encoding: .utf8) else { continue }
            let b64 = Data(texto.utf8).base64EncodedString()
            let nombre = f.lastPathComponent.replacingOccurrences(of: "\"", with: "")
            let js = "window.__npCsv && window.__npCsv(\"\(nombre)\", \"\(b64)\")"
            DispatchQueue.main.async { self.webView.evaluateJavaScript(js, completionHandler: nil) }
        }
        defaults.set(vistos, forKey: "csvVistos")
        estado()
    }

    // ---------------------------------------------------------------- navegación
    func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let u = a.request.url, let s = u.scheme, s.hasPrefix("http"), a.navigationType == .linkActivated {
            NSWorkspace.shared.open(u); decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }
    func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = NSAlert(); a.messageText = m; a.runModal(); completionHandler()
    }
    func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = NSAlert(); a.messageText = m; a.addButton(withTitle: "Sí"); a.addButton(withTitle: "Cancelar")
        completionHandler(a.runModal() == .alertFirstButtonReturn)
    }
    func webView(_ w: WKWebView, runJavaScriptTextInputPanelWithPrompt p: String, defaultText: String?, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = NSAlert(); a.messageText = p; a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancelar")
        let t = NSTextField(frame: NSRect(x: 0, y: 0, width: 300, height: 24)); t.stringValue = defaultText ?? ""; a.accessoryView = t
        completionHandler(a.runModal() == .alertFirstButtonReturn ? t.stringValue : nil)
    }
    func webView(_ w: WKWebView, runOpenPanelWith p: WKOpenPanelParameters, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let o = NSOpenPanel(); o.allowsMultipleSelection = p.allowsMultipleSelection; o.canChooseDirectories = false
        o.begin { r in completionHandler(r == .OK ? o.urls : nil) }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { false }
}

let app = NSApplication.shared
let delegate = Delegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
