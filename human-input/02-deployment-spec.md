# The "Template Copy" Method
This is the closest thing to an installable bundle in the Google ecosystem. Scripts can be "bound" to a specific Google Sheet. If a user copies the Sheet, the code goes with it.

How it works: You create a polished "Master Template" Google Sheet and attach your Code.gs and Sidebar.html to it. You share the file as "View Only," or better yet, change the end of the URL from /edit to /copy.

The User Experience: The user clicks your link, and Google prompts them to "Make a copy." This creates a fresh Google Sheet in their private Google Drive, containing all your script files.

Why it bypasses IT: The script is now technically owned by the user, running in their environment as a private script. They will still get a standard Google warning ("Google hasn't verified this app") the first time they click the menu, but it does not require Marketplace admin approval.