import SafariServices
import os.log

let SFExtensionMessageKey = "message"

class SafariExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems[0] as! NSExtensionItem
        let message = item.userInfo?[SFExtensionMessageKey]
        os_log(.default, "Received message from browser extension: %@", String(describing: message))

        let response = NSExtensionItem()
        response.userInfo = [ SFExtensionMessageKey: [ "status": "acknowledged" ] ]

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

}
