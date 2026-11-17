Local browser dependencies (no CDN required):

- jsonc-parser 3.3.1, Microsoft, MIT. ESM JavaScript from the npm package;
  relative import specifiers have `.js` appended for native browser modules.
  License: jsonc-parser/LICENSE.md.
- diff 8.0.2, jsdiff authors, BSD-3-Clause. Only the ESM line diff and its
  dependencies are included. License: diff/LICENSE.
Vendored text uses LF line endings; incidental trailing spaces are removed.

- JSZip: see jszip.LICENSE.markdown.

- @babel/standalone 7.26.10, Babel authors, MIT. `babel.min.cjs` is the
  unmodified browser UMD distribution from npm (renamed from babel.min.js so
  Node regression tests can load the same compiler). Loaded lazily as text,
  only when script execution is explicitly started. License: babel/LICENSE.
