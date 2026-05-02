/**
 * One-time / dev: fetches dwyl/english-words words_alpha and writes
 * letterbox-supplement.js (3-8 letter a-z only, no API at runtime).
 * Run: node tools/build-letterbox-supplement.mjs
 */
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "..", "letterbox-supplement.js");

const URL =
  "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt";

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 400) {
          reject(new Error("HTTP " + res.statusCode));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      })
      .on("error", reject);
  });
}

const text = await get(URL);
const lines = text.split(/\r?\n/);
const words = [];
for (const line of lines) {
  const w = line.trim().toLowerCase();
  if (/^[a-z]{3,8}$/.test(w)) words.push(w);
}
words.sort();

const json = JSON.stringify(words);
const js = `/* Auto-generated from dwyl/english-words (words_alpha). 3-8 letter words only. ${words.length} entries. Runtime: no network. */
(() => {
  "use strict";
  window.LETTERBOX_SUPPLEMENT = ${json};
})();
`;

fs.writeFileSync(out, js, "utf8");
const kb = (fs.statSync(out).size / 1024).toFixed(1);
console.log("Wrote", out, words.length, "words,", kb, "KB");
