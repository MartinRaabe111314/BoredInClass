/* One-off: fetches a word list and writes letterbox-words.js. Run: node scripts/build-letterbox-words.cjs */
const https = require("https");
const fs = require("fs");
const path = require("path");

const url = "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt";

https
  .get(url, (res) => {
    let d = "";
    res.on("data", (c) => (d += c));
    res.on("end", () => {
      const w = d.split(/\r?\n/).filter((x) => /^[a-z]{3,8}$/.test(x));
      w.sort();
      // Prefer mostly common: shorter and mid length first for generator hit rate; keep up to 18k
      const max = 18000;
      const out = w.slice(0, max);
      const outPath = path.join(__dirname, "..", "letterbox-words.js");
      const content =
        "// Auto-built word list for Letter Boxed (3-8 letter a-z). ~" +
        out.length +
        " words.\n" +
        "(() => {\n" +
        "  window.LETTERBOX_WORD_LIST = " +
        JSON.stringify(out) +
        ";\n" +
        "})();\n";
      fs.writeFileSync(outPath, content, "utf8");
      console.log("Wrote", out.length, "words to letterbox-words.js");
    });
  })
  .on("error", (e) => {
    console.error(e);
    process.exit(1);
  });
