#!/usr/bin/env node
// Reapplies project-specific config values onto files that a
// `git merge --squash <tag>` from the shared template just overwrote
// with template placeholders.
//
// How it works: `git merge --squash` stages the merged content but never
// moves HEAD, so `git show HEAD:<path>` still returns the file exactly as
// it was on this project's branch *before* the merge (i.e. the
// project-customized version). The working tree copy is the *new*
// template-merged version. We diff the two, pull the project-specific
// values out of the "before" copy, and write them back into the "after"
// copy at the same structural position — regardless of whether the
// template kept, moved, or reworded its `# TODO:` comments.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PLACEHOLDER_RE = /system[\s-]?name|\btemplate\b/i;

function gitShowHead(path) {
  try {
    return execFileSync("git", ["show", `HEAD:${path}`], {
      encoding: "utf8",
    });
  } catch {
    return null; // file didn't exist before the merge
  }
}

function extract(re, text) {
  if (text == null) return null;
  const m = re.exec(text);
  return m ? m[2] : null;
}

function reapply(re, oldText, newText, label, results) {
  const oldValue = extract(re, oldText);
  const newValue = extract(re, newText);

  if (oldValue === null) {
    results.push({ label, status: "no-previous-value" });
    return newText;
  }
  if (newValue === null) {
    results.push({ label, status: "pattern-not-found-in-merged-file" });
    return newText;
  }
  if (PLACEHOLDER_RE.test(oldValue)) {
    results.push({ label, status: "still-placeholder", value: oldValue });
    return newText;
  }
  if (oldValue === newValue) {
    results.push({ label, status: "already-correct", value: oldValue });
    return newText;
  }

  results.push({
    label,
    status: "reapplied",
    from: newValue,
    to: oldValue,
  });
  return newText.replace(re, (_, pre, _val, post) => `${pre}${oldValue}${post}`);
}

function processFile(path, patterns) {
  if (!existsSync(path)) return { path, skipped: "file not found" };
  const oldText = gitShowHead(path);
  let newText = readFileSync(path, "utf8");
  const results = [];

  for (const { label, re } of patterns) {
    newText = reapply(re, oldText, newText, label, results);
  }

  const changed = results.some((r) => r.status === "reapplied");
  if (changed) writeFileSync(path, newText, "utf8");

  return { path, results, changed };
}

const fileConfigs = [
  {
    path: ".gitlab-ci.yml",
    patterns: [
      {
        label: "DOCKER_IMAGE",
        re: /(- DOCKER_IMAGE=")([^"]*)(")/,
      },
      {
        label: "SONAR_PROJECT_KEY",
        re: /(SONAR_PROJECT_KEY:\s*")([^"]*)(")/,
      },
      {
        label: "SONAR_PROJECT_NAME",
        re: /(SONAR_PROJECT_NAME:\s*")([^"]*)(")/,
      },
    ],
  },
  {
    path: "package.json",
    patterns: [{ label: 'package.json "name"', re: /("name":\s*")([^"]*)(")/ }],
  },
  {
    path: "bun.lock",
    patterns: [
      {
        label: 'bun.lock workspace "name"',
        re: /("":\s*\{\s*"name":\s*")([^"]*)(")/,
      },
    ],
  },
];

const report = fileConfigs.map((fc) => processFile(fc.path, fc.patterns));

console.log("== sync-template-config: reapply project values after template merge ==\n");

let needsManualFix = false;

for (const file of report) {
  if (file.skipped) {
    console.log(`- ${file.path}: skipped (${file.skipped})`);
    continue;
  }
  console.log(`- ${file.path}`);
  for (const r of file.results) {
    if (r.status === "reapplied") {
      console.log(`    [reapplied]  ${r.label}: "${r.from}" -> "${r.to}"`);
    } else if (r.status === "already-correct") {
      console.log(`    [ok]         ${r.label}: already "${r.value}"`);
    } else if (r.status === "still-placeholder") {
      console.log(`    [MANUAL]     ${r.label}: previous value looks like a template placeholder ("${r.value}") - fill this in by hand`);
      needsManualFix = true;
    } else if (r.status === "no-previous-value") {
      console.log(`    [MANUAL]     ${r.label}: no previous value found (first time using template on this project?) - fill this in by hand`);
      needsManualFix = true;
    } else if (r.status === "pattern-not-found-in-merged-file") {
      console.log(`    [MANUAL]     ${r.label}: pattern not found in merged file - template structure may have changed, check by hand`);
      needsManualFix = true;
    }
  }
}

console.log("\n" + (needsManualFix
  ? "Some values need manual attention (see [MANUAL] lines above)."
  : "All tracked config values were verified / reapplied automatically."));
console.log("Nothing was committed. Run `git diff` to review before committing.");
