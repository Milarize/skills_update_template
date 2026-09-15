#!/usr/bin/env node
// Read-only check: is there a newer template version than the one this
// project last merged, and what did the template actually change?
//
// Does NOT touch the working tree and does NOT merge anything — safe to run
// anytime. Meant to run *before* `git merge --squash <tag>` so a reviewer
// gets a short "what's new in the template" report instead of having to
// read the full squashed diff to figure out which changes are template
// noise vs. real feature work.
//
// How the baseline is found: every past template update in this project's
// history is recorded as a commit whose message mentions the tag that was
// merged (see README.md: "Update Template x.x.x-template"). We scan the
// log for the highest `X.Y.Z-template` mentioned there and treat it as the
// version currently in this project.

import { execFileSync } from "node:child_process";

const TAG_SUFFIX = "-template";
const TAG_RE = /^(\d+)\.(\d+)\.(\d+)-template$/;

function sh(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function getTemplateRemote() {
  try {
    return sh(["remote", "get-url", "template"]);
  } catch {
    console.error(
      'ไม่พบ remote ชื่อ "template" ในโปรเจกต์นี้ — เพิ่มก่อนด้วย `git remote add template {url}`'
    );
    process.exit(1);
  }
}

function semverKey(tag) {
  const m = TAG_RE.exec(tag);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function compareSemver(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function listTemplateTags() {
  const raw = sh(["tag", "--list", `*${TAG_SUFFIX}`]);
  return raw
    .split("\n")
    .filter(Boolean)
    .map((tag) => ({ tag, key: semverKey(tag) }))
    .filter((t) => t.key)
    .sort((a, b) => compareSemver(a.key, b.key));
}

function findBaselineTag(tags) {
  // Use --all, not just the current branch: a feature branch created before
  // the last "Update Template x.x.x-template" commit landed on develop/main
  // won't have that commit in its own history, even though the project as
  // a whole is already on that template version.
  let log;
  try {
    log = sh(["log", "--all", "--pretty=%s"]);
  } catch {
    log = "";
  }
  const mentioned = new Set(log.match(/\d+\.\d+\.\d+-template/g) ?? []);
  const candidates = tags.filter((t) => mentioned.has(t.tag));
  return candidates.length ? candidates[candidates.length - 1] : null;
}

function diffSummary(fromTag, toTag) {
  const stat = sh(["diff", "--stat", `${fromTag}..${toTag}`]);
  const nameStatus = sh(["diff", "--name-status", `${fromTag}..${toTag}`]);
  const fullDiff = sh(["diff", `${fromTag}..${toTag}`]);

  const added = [];
  const modified = [];
  const deleted = [];
  for (const line of nameStatus.split("\n").filter(Boolean)) {
    const [status, ...rest] = line.split("\t");
    const file = rest.join("\t");
    if (status.startsWith("A")) added.push(file);
    else if (status.startsWith("D")) deleted.push(file);
    else modified.push(file);
  }

  const newTodos = [...fullDiff.matchAll(/^\+.*TODO:.*$/gm)].map((m) =>
    m[0].replace(/^\+\s*/, "")
  );

  return { stat, added, modified, deleted, newTodos };
}

console.log("== template-update: ตรวจสอบเวอร์ชัน template ใหม่ ==\n");

const remote = getTemplateRemote();
console.log(`Template remote: ${remote}`);
try {
  execFileSync("git", ["fetch", "template", "--tags"], { stdio: "inherit" });
} catch {
  console.error(
    "\nดึงข้อมูลจาก remote template ไม่สำเร็จ (เช็ค VPN/เครือข่ายภายใน หรือสิทธิ์เข้าถึง repo แล้วลองใหม่)"
  );
  process.exit(1);
}

const tags = listTemplateTags();
if (tags.length === 0) {
  console.log('\nไม่พบ tag รูปแบบ "*-template" บน remote template เลย');
  process.exit(0);
}

const latest = tags[tags.length - 1];
const baseline = findBaselineTag(tags);

if (!baseline) {
  console.log(
    "\nหา baseline (tag ล่าสุดที่โปรเจกต์นี้เคย merge) จาก git log ไม่เจอ"
  );
  console.log(`Tag ล่าสุดที่มีบน template ตอนนี้: ${latest.tag}`);
  console.log(
    "ถ้านี่คือการ merge template ครั้งแรกของโปรเจกต์ ให้ทำตาม README.md หัวข้อ \"การขึ้นโปรเจกต์ใหม่\" แทน"
  );
  process.exit(0);
}

console.log(`\nBaseline (เวอร์ชันที่ใช้อยู่ตอนนี้): ${baseline.tag}`);
console.log(`เวอร์ชันล่าสุดบน template: ${latest.tag}`);

if (compareSemver(baseline.key, latest.key) >= 0) {
  console.log("\nอยู่กับ template เวอร์ชันล่าสุดแล้ว ไม่มีอะไรใหม่ให้ merge");
  process.exit(0);
}

const newer = tags.filter((t) => compareSemver(t.key, baseline.key) > 0);
console.log(
  `\nมี template เวอร์ชันใหม่กว่าที่ใช้อยู่ ${newer.length} เวอร์ชัน: ${newer
    .map((t) => t.tag)
    .join(", ")}`
);

const summary = diffSummary(baseline.tag, latest.tag);

console.log(`\n== สรุปสิ่งที่ template เปลี่ยนแปลง (${baseline.tag} -> ${latest.tag}) ==\n`);
console.log(summary.stat || "(ไม่มีการเปลี่ยนแปลงไฟล์)");

if (summary.added.length) {
  console.log("\nไฟล์ใหม่ที่ template เพิ่มเข้ามา:");
  summary.added.forEach((f) => console.log(`  + ${f}`));
}
if (summary.deleted.length) {
  console.log("\nไฟล์ที่ template ลบออก:");
  summary.deleted.forEach((f) => console.log(`  - ${f}`));
}
if (summary.modified.length) {
  console.log("\nไฟล์ที่ template แก้ไข:");
  summary.modified.forEach((f) => console.log(`  ~ ${f}`));
}
if (summary.newTodos.length) {
  console.log(
    "\n[ควรดูเป็นพิเศษ] TODO ใหม่ที่ template เพิ่มเข้ามา (อาจเป็น config point ใหม่ที่ apply-config.mjs ยังไม่รู้จัก):"
  );
  summary.newTodos.forEach((l) => console.log(`  ${l}`));
}

console.log(
  `\n>>> ยืนยันกับ dev ก่อนทำจริงเสมอ: ต้องการ merge template เวอร์ชัน "${latest.tag}" เข้ามาหรือไม่? <<<\nถ้าใช่ ขั้นตอนถัดไปคือ:\n  git merge --squash ${latest.tag}\nแล้วรัน apply-config.mjs เพื่อ reapply ค่า config เฉพาะโปรเจกต์`
);
