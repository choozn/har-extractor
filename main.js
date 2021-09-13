const { app, clipboard, dialog, shell } = require('electron')
const { mkdirSync, writeFileSync, existsSync } = require('fs');
var mimeDB = require('mime-db')

app.whenReady().then(() => {
  main();
});

const main = async () => {

  try {

    try {

      // Grab HAR data from the clipboard.
      var clipboardData = clipboard.readText();
      // Get root of harData
      var harData = (JSON.parse(String(clipboardData)))["log"];
      // Remove illegal characters from subfolder name
      var harTitle = harData["pages"][0]["title"].replace(/(\W+)/gi, '-') || "HAR-Export";

      // Extract all needed information from provided HAR data.
      var parsedHarData = harData["entries"].map((entry) => {

        // Get filename from url
        let name = new URL(entry["request"]["url"])
          .pathname.split('/').pop()

        // Get name without extension
        if (name.includes(".")) name = name.substring(0, name.lastIndexOf("."));

        return ({
          data: entry["response"]["content"]["text"] || "",
          encoding: entry["response"]["content"]["encoding"] || "utf8",
          type: fixMimeTypes((entry["response"]["content"]["mimeType"] || "text/plain").split(';').shift()),
          name: name || "index",
        })

      });

      var nameArray = parsedHarData.map((entry) => entry.name);
      var duplicateRenamedNameList = suffixDuplicates(nameArray);
      var duplicateRenamedObject = parsedHarData.map((entry, index) => ({ ...entry, name: duplicateRenamedNameList[index] }));

    } catch (error) {

      // Try-Catch will throw when the provided data did not match the HAR-JSON structure
      dialog.showErrorBox("", "There was no valid HAR data in your clipboard!");
      app.quit();
      return;

    }

    if (parsedHarData) {

      // Select base path for the extraction
      var baseFolder = (await dialog.showOpenDialog({ properties: ['openDirectory'], buttonLabel: "Extract here" }))["filePaths"][0];

      // If cancel was clicked
      if (!baseFolder) {
        app.quit();
        return;
      }

      var folder = baseFolder + "/" + harTitle;

      mkdirSync(folder, { recursive: true });

      // Await the extraction of all files
      await Promise.all(duplicateRenamedObject.map(async (entry) => {

        if (entry.data) {

          try {

            let buffer = Buffer.from(entry.data, entry.encoding);
            let extension = mimeDB[entry.type].extensions[0];

            return writeFileSync(`${folder}/${entry.name}.${extension}`, buffer);

            // No extension was found for the provided data
          } catch (error) {

            let buffer = Buffer.from(entry.data, entry.encoding);
            return writeFileSync(`${folder}/${entry.name}`, buffer);

          }

        }

      }));

      // Open created folder with explorer
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

  // Helper function to fix export bugs caused by obsolete MIME-Types
  function fixMimeTypes(type) {

    let fixedType = type
      .replace("image/jpg", "image/jpeg")
      .replace("application/x-javascript", "application/javascript")
      .replace("text/javascript", "application/javascript")

    return fixedType;

  }

}

function suffixDuplicates(arrayWithoutSuffixes) {

  var list = arrayWithoutSuffixes;

  // Objects to contain occurrences
  var count = {};
  var firstOccurrences = {};

  var item, itemCount;

  // Loop through the list
  for (var i = 0, c = list.length; i < c; i++) {

    item = list[i];
    itemCount = count[item];
    itemCount = count[item] = (itemCount == null ? 1 : itemCount + 1);

    if (itemCount == 2)
      // First occurrence of an item which has multiple occurrences
      list[firstOccurrences[item]] = `${list[firstOccurrences[item]]}-(1)`;
    if (count[item] > 1)
      // All other occurrences
      list[i] = `${list[i]}-(${count[item]})`;
    else
      // Item without any other occurrences
      firstOccurrences[item] = i;

  }

  return list;

}