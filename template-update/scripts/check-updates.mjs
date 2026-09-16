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

// Files apply-config.mjs already knows how to reapply project-specific
// values for (see its `fileConfigs`) — no need to dump their full diff,
// the stat/name-status line is enough. Keep this in sync with that list.
const KNOWN_CONFIG_FILES = new Set([".gitlab-ci.yml", "package.json", "bun.lock"]);

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

// findBaselineTag() trusts commit *messages* ("Update Template
// X.Y.Z-template") to know which version this project is on. That trust can
// be wrong in practice — e.g. a project's own PR/MR squash-merge flow can
// rewrite or drop the individual commit message that recorded a past
// template update, even though the file content from that update landed
// just fine. That would make this script think the project is further
// behind than it really is (and squash-merging the "missing" version again
// would double-apply changes / conflict, not silently lose anything — but
// better to catch the mismatch and say so than to let a dev be confused by
// it).
//
// This is a content-based cross-check: for a given tag, count how many
// lines differ between HEAD and that tag, restricted to the paths that
// exist in the tag's tree (so the project's own business-logic files, which
// the raw template doesn't have at all, don't drown out the comparison).
// The tag with the fewest differing lines is our best guess at what the
// project's real content currently matches.
function pathsAtTag(tag) {
  try {
    return sh(["ls-tree", "-r", "--name-only", tag]).split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function linesChangedSince(tag, paths) {
  if (!paths.length) return null;
  let shortstat;
  try {
    shortstat = sh(["diff", "--shortstat", `${tag}..HEAD`, "--", ...paths]);
  } catch {
    return null;
  }
  if (!shortstat) return 0;
  const insertions = /(\d+) insertions?\(\+\)/.exec(shortstat);
  const deletions = /(\d+) deletions?\(-\)/.exec(shortstat);
  return (insertions ? Number(insertions[1]) : 0) + (deletions ? Number(deletions[1]) : 0);
}

function bestContentMatch(tags) {
  const scored = tags
    .map((t) => ({ tag: t.tag, lines: linesChangedSince(t.tag, pathsAtTag(t.tag)) }))
    .filter((s) => s.lines !== null);
  if (!scored.length) return { best: null, scored };
  const best = scored.reduce((a, b) => (b.lines < a.lines ? b : a));
  return { best, scored };
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
  const { best } = bestContentMatch(tags);
  if (best) {
    console.log(
      `\n[เดาจากเนื้อไฟล์จริง] เทียบไฟล์จริงของโปรเจกต์นี้กับแต่ละ tag ของ template แล้ว ` +
        `ใกล้เคียงกับ ${best.tag} มากที่สุด (diff เหลือ ${best.lines} บรรทัด) ` +
        `ถ้าตัวเลขนี้น้อย แปลว่าโปรเจกต์นี้น่าจะเคย merge template มาแล้วจริง ๆ เพียงแต่ commit message ` +
        `ไม่ตรงรูปแบบ "X.Y.Z-template" ที่ script หาอยู่ (เช่น ถูก squash-merge ทับตอน merge PR ในโปรเจกต์นี้เอง)`
    );
  }
  console.log(
    "ถ้านี่คือการ merge template ครั้งแรกของโปรเจกต์ (หรือตัวเลขด้านบนสูงมาก) ให้ทำตาม README.md หัวข้อ \"การขึ้นโปรเจกต์ใหม่\" แทน"
  );
  process.exit(0);
}

console.log(`\nBaseline (เวอร์ชันที่ใช้อยู่ตอนนี้): ${baseline.tag}`);
console.log(`เวอร์ชันล่าสุดบน template: ${latest.tag}`);

{
  const { best, scored } = bestContentMatch(tags);
  const baselineScore = scored.find((s) => s.tag === baseline.tag);
  if (best && best.tag !== baseline.tag && baselineScore && best.lines < baselineScore.lines) {
    console.log(
      `\n[ตรวจสอบเพิ่มเติม] คำเตือน: commit message บอกว่าโปรเจกต์นี้อยู่ที่ ${baseline.tag} ` +
        `(diff เหลือ ${baselineScore.lines} บรรทัดเทียบไฟล์ template) แต่เทียบเนื้อไฟล์จริงแล้ว ` +
        `ใกล้เคียงกับ ${best.tag} มากกว่า (diff เหลือ ${best.lines} บรรทัด)\nอาจมีการ merge เวอร์ชัน ` +
        `ระหว่างทางไปแล้วจริง ๆ แต่ commit message ไม่ตรงรูปแบบ "X.Y.Z-template" (เช่น ถูก squash-merge ` +
        `ทับตอน merge PR ในโปรเจกต์นี้เอง) ก่อนตัดสินใจ merge ต่อ แนะนำให้ตรวจสอบเองว่าจริง ๆ ใช้เวอร์ชันไหนอยู่ ` +
        `ไม่ควรเชื่อแค่ baseline ที่เจอจาก commit message ด้านบนอย่างเดียว`
    );
  }
}

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

// For modified files apply-config.mjs does NOT already handle, dump the
// actual diff content (not just the filename) so the reviewer can see what
// changed structurally (e.g. a new base class, a changed function
// signature) instead of just "this file was touched".
//
// Deliberately diff HEAD..latest here, NOT baseline..latest: baseline..latest
// only shows how the *template itself* evolved, assuming this project's copy
// of the file still matches baseline exactly. If the project already
// customized or hotfixed this file since the last template merge, that
// assumption is wrong — HEAD..latest shows what a merge would *actually*
// change in this project's real file right now, project drift included.
// (baseline..latest above is still the right diff for deciding *which*
// files to list as "touched by template" — using HEAD there instead would
// flood that list with every project-only file that doesn't exist in the
// template tree at all.)
const filesNeedingContentReview = summary.modified.filter(
  (f) => !KNOWN_CONFIG_FILES.has(f)
);
if (filesNeedingContentReview.length) {
  console.log(
    "\n== เนื้อการเปลี่ยนแปลงของไฟล์ที่ไม่ใช่ config point ที่ apply-config.mjs รู้จัก =="
  );
  console.log(
    "(เทียบไฟล์จริงของโปรเจกต์นี้ตอนนี้ (HEAD) กับ template เวอร์ชันล่าสุด — ไม่ใช่ template เทียบกับ template — เพื่อให้เห็นของจริงที่จะเปลี่ยน รวมถึงกรณีโปรเจกต์เคยแก้ไฟล์นี้เองไปแล้วด้วย)"
  );
  for (const file of filesNeedingContentReview) {
    console.log(`\n--- ${file} ---`);
    console.log(sh(["diff", `HEAD..${latest.tag}`, "--", file]));
  }
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

if (filesNeedingContentReview.length) {
  console.log(
    "\n>>> ก่อนถามเรื่อง merge: อ่าน diff เนื้อไฟล์ด้านบนแล้วสรุปเป็นภาษาคนว่าแต่ละไฟล์เปลี่ยนอะไรเชิงโครงสร้าง/โค้ด (เช่น extend class ใหม่, เปลี่ยน signature, เพิ่ม dependency) ถ้าพบว่าโปรเจกต์นี้น่าจะมีโค้ดของตัวเองที่เกี่ยวข้องอยู่แล้ว ให้เสนอแนะและถามผู้ใช้อย่างชัดเจนว่าต้องการปรับโค้ดของโปรเจกต์ให้สอดคล้องด้วยหรือไม่ ก่อนจะไปถามเรื่อง merge <<<"
  );
}
