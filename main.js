const { app, clipboard, dialog, shell } = require('electron')
const { mkdirSync, writeFileSync, existsSync } = require('fs');
var db = require('mime-db')

app.whenReady().then(() => {
  main();
})

const main = async () => {

  try {

    try {

      // Grab HAR data from the clipboard.
      var clipboardData = clipboard.readText();
      var harData = (JSON.parse(String(clipboardData)))["log"];

      // Extract all needed information from provided HAR data.
      var parsedHarData = harData["entries"].map((entry) => (
        {
          data: entry["response"]["content"]["text"] || "",
          encoding: entry["response"]["content"]["encoding"] || "utf8",
          type: entry["response"]["content"]["mimeType"] || "text/plain",
          name: entry["request"]["url"].split("/").pop().split('?').shift().split('.').shift() || "index",
        }
      ));

    } catch (error) {

      // Try-Catch will throw when the provided data did not match the HAR-JSON structure.
      dialog.showErrorBox("", "There was no valid HAR data in your clipboard!");
      app.quit();
      return;

    }

    if (parsedHarData) {

      // Select base path for the extraction.
      var baseFolder = (await dialog.showOpenDialog({ properties: ['openDirectory'] }))["filePaths"][0];

      // If cancel was clicked
      if (!baseFolder) {
        app.quit();
        return;
      }

      // Remove illegal characters from subfolder name.
      var folder = baseFolder + "/" + (harData["pages"][0]["title"]).replace(/(\W+)/gi, '-');

      mkdirSync(folder, { recursive: true });

      // Await the extraction of all files.
      await Promise.all(parsedHarData.map(async (entry) => {

        if (entry.data) {

          try {

            let buffer = Buffer.from(entry.data, entry.encoding);
            let extension = db[entry.type.split(';').shift()].extensions[0];
            return writeFileSync(`${folder}/${entry.name}.${extension}`, buffer);

            // No extension was found for the provided data
          } catch (error) {

            let buffer = Buffer.from(entry.data, "utf8");
            return writeFileSync(`${folder}/${entry.name}`, buffer);

          }

        }

      }));

      // Open created folder with explorer.
      if (existsSync(folder)) shell.openPath(folder);
      app.quit();
      return;

    } else {
      app.quit();
      return;
    }

  } catch (error) {

    dialog.showErrorBox("", "There was a problem while extracting the data!\n" + error);
    app.quit();
    return;

  }

}