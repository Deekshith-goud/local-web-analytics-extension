#if os(iOS)
import UIKit
import MobileCoreServices

typealias PlatformViewController = UIViewController
#elseif os(macOS)
import Cocoa
import SafariServices

typealias PlatformViewController = NSViewController
#endif

let extensionBundleIdentifier = "com.yourdomain.local-web-analytics.Extension"

class ViewController: PlatformViewController {

    #if os(macOS)
    @IBOutlet var openSafariButton: NSButton?

    override func viewDidLoad() {
        super.viewDidLoad()
        self.title = "Local Web Analytics"
    }

    @IBAction func openSafariPreferencesAction(_ sender: AnyObject?) {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            if let _ = error {
                // Extension preferences opened or logged
            }
        }
    }
    #elseif os(iOS)
    override func viewDidLoad() {
        super.viewDidLoad()
        self.title = "Local Web Analytics"
    }
    #endif

}
