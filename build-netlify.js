"use strict";

const fs = require("fs-extra");
const bowerFolder = "./bower_components";
const publicFolder = "./public_components";

/*
 * Netlify does not serve ./bower_components from its static hosting.
 * As a workaround, we'll rename to public_components and 301 any requests to bower_components -> public_components
 */
if (fs.existsSync(bowerFolder)) {
  // Delete the public components folder if it already exists
  if (fs.existsSync(publicFolder)) fs.removeSync(publicFolder);
  // Move bower -> public
  fs.moveSync(bowerFolder, publicFolder);
} else {
  if (fs.existsSync(publicFolder))
    throw new Error(
      `${publicFolder} folder already created. If you want to re-create it, run 'bower install' then re-run this script.`
    );
  else
    throw new Error(
      `${bowerFolder} folder missing. Make sure you run 'bower install' first.`
    );
}
