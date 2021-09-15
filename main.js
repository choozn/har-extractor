const { app, clipboard, dialog, shell } = require('electron')
const { mkdirSync, writeFileSync, existsSync } = require('fs');
const mimeDB = require('mime-db');
const config = require('./config/config.json');

app.whenReady().then(() => {

  try {

    // Main Thread
    main();

  } catch (error) {

    // Unknown error in the main thread
    dialog.showErrorBox("", "There was a problem while extracting the data!\n" + error);
    app.quit();
    return;

  }

});

/* Main Thread */
async function main() {

  try {

    // Grab HAR data from the clipboard.
    var clipboardData = clipboard.readText();
    var { entries: harEntries, title: harTitle } = await extractHarData(clipboardData);

    // The provided data did not match the HAR-JSON structure
  } catch (error) {

    dialog.showErrorBox("", "There was no valid HAR data in your clipboard!");
    app.quit();
    return;

  }

  // Select base path for the extraction
  var baseFolder = (await dialog.showOpenDialog({ properties: ['openDirectory'], buttonLabel: "Extract here" }))["filePaths"][0];

  // Cancel was clicked
  if (!baseFolder) {
    app.quit();
    return;
  }

  var folder = `${baseFolder}/${harTitle}`;

  mkdirSync(folder, { recursive: true });

  // Await the extraction of all files
  await Promise.all(harEntries.map(async (entry) => {

    if (entry.data) {

      let buffer = Buffer.from(entry.data, entry.encoding);
      return writeFileSync(`${folder}/${entry.fileName}`, buffer);

    }

  }));

  // Open created folder with explorer
  if (existsSync(folder)) shell.openPath(folder);
  app.quit();
  return;


  /*  Functions */

  /* 
  
    Main extraction function 
  
  */

  async function extractHarData(data) {

    // Get root of HAR data
    var harData = (JSON.parse(String(data)))["log"];
    // Get HAR title and remove illegal characters from it
    var harTitle = (harData["pages"][0]["title"] || config.defaultFolderName).replace(/(\W+)/gi, '-');

    // Reduce entries to base information
    var parsedHarData = harData["entries"].map((entry) => {

      var content = entry["response"]["content"];

      // Get filename from url without extension
      var name = (new URL(entry["request"]["url"]).pathname.split('/').pop()) || config.defaultFileName;
      if (name.includes(".")) name = name.substring(0, name.lastIndexOf("."));

      // Get MIME type
      var mimeType = fixMimeTypes((content["mimeType"] || config.defaultMimeType).split(';').shift());
      var mimeLookup = mimeDB[mimeType];

      // Get MIME extension
      var extension = (mimeLookup) ? mimeLookup.extensions[0] : config.defaultExtension;

      var fileName = `${name}.${extension}`;

      // Get HAR entry's data
      var data = content["text"];

      // Get HAR entry's encoding
      var encoding = content["encoding"] || config.defaultEncoding;

      return ({
        name: name,
        fileName: fileName,
        type: mimeType,
        extension: extension,
        encoding: encoding,
        data: data,
      })

    });

    // Suffixing items with multiple occurrences
    var nameArray = parsedHarData.map((entry) => entry.fileName);
    var suffixArray = createSuffixArray(nameArray);
    var suffixedHarEntries = parsedHarData.map((entry, index) => (
      {
        ...entry,
        fileName: `${entry.name}${suffixArray[index] || ""}${(entry.extension) ? `.${entry.extension}` : `${config.defaultExtension}`}`
      }
    ));

    return {
      title: harTitle,
      entries: suffixedHarEntries
    };

  }


  /* 
  
    Helper function to fix export bugs caused by obsolete MIME types 
  
  */

  function fixMimeTypes(type) {

    let workingType = type;

    // Replace obsolete MIME-Types with fixed types
    config.obsoleteMimeTypes.forEach(obsoleteType => {
      workingType = workingType.replace(obsoleteType[0], obsoleteType[1]);
    });

    let fixedType = workingType;

    return fixedType;

  }


  /* 

    Helper function to suffix duplicates in an array - returns an array containing only suffixes

  */

  function createSuffixArray(arrayWithoutSuffixes) {

    var list = arrayWithoutSuffixes;
    var suffixArray = [];

    // Objects to collect occurrences
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
        suffixArray[firstOccurrences[item]] = `-(1)`;
      if (count[item] > 1)
        // All other occurrences of an item which has multiple occurrences
        suffixArray[i] = `-(${count[item]})`;
      else
        // Item without any other occurrences
        firstOccurrences[item] = i;

    }

    return suffixArray;

  }

}