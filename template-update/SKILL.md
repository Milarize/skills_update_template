---
name: template-update
description: ใช้เมื่อผู้ใช้ต้องการเช็คว่า template repo กลาง (remote ชื่อ "template" — api-gateway/api-internal/ฯลฯ แล้วแต่ประเภทโปรเจกต์) มีเวอร์ชันใหม่กว่าที่โปรเจกต์นี้ใช้อยู่หรือไม่, อยากรู้ว่า template implement อะไรใหม่บ้างก่อนตัดสินใจ merge, หรือเพิ่งรัน `git merge --squash {tag}` จาก template แล้วต้องแก้ config เฉพาะโปรเจกต์ที่ถูกเขียนทับกลับเป็น placeholder. Trigger เมื่อผู้ใช้พูดถึง "เช็ค template", "template มีอัปเดตไหม", "merge template", "sync template", "อัปเดต template เวอร์ชันล่าสุด" หรือ "แก้ TODO หลัง merge template".
---

# Template Update

## กฎตายตัว: ไม่ commit/push ขึ้น template repo เด็ดขาด

Skill นี้**อ่านจาก template repo เท่านั้น** (`git fetch`, `git diff` กับ
tag ของ template) ไม่ว่ากรณีใดก็ตาม **ห้ามรัน `git push` ไปยัง remote
`template` หรือ commit/push อะไรเข้า template repo โดยเด็ดขาด** แม้ผู้ใช้
จะพูดถึงเรื่อง "อัป skill เข้า template" ก็ให้ตอบว่าเป็นขั้นตอนที่ผู้ดูแล
template ต้องทำเองแยกต่างหาก (มนุษย์ clone/commit/push เข้า template repo
เอง ไม่ใช่สิ่งที่ Claude หรือ skill นี้ทำให้อัตโนมัติ) — scope ของ skill นี้มีแค่ 2 อย่าง
คือเช็คว่าโปรเจกต์ที่เปิดอยู่ตามหลัง template ล่าสุดแค่ไหน และช่วย reapply
ค่า config ให้หลัง merge เพื่อลดเวลา manual ของ dev เท่านั้น

## ปัญหาที่ skill นี้แก้

โปรเจกต์นี้ derive มาจาก template repo กลาง (remote ชื่อ `template` — คนละ
URL กันตามประเภทโปรเจกต์ เช่น api-gateway ใช้ template repo หนึ่ง, api-internal
ใช้อีก repo หนึ่ง แต่ทุกโปรเจกต์จะมี remote ชื่อ `template` ชี้ไปยัง repo ที่
ถูกต้องของตัวเองเสมอ) ตามขั้นตอนใน [README.md](../../../README.md)
หัวข้อ "ใช้ template เวอร์ชันล่าสุด":

```bash
git merge --squash {tag from template}
```

Skill นี้มี 2 ขั้นตอนที่แก้ 2 ปัญหาคนละแบบ:

1. **ก่อน merge** — เวลา template repo กลางมีการอัปเดตไปเรื่อย ๆ (เช่น
   โปรเจกต์นี้ merge ล่าสุดไว้ที่ `0.5.0-template` แต่ template ตอนนี้ไปถึง
   `0.7.0-template` แล้ว) dev ไม่รู้ว่า 2 เวอร์ชันนี้ต่างกันตรงไหนบ้างโดยไม่
   ต้องไล่อ่าน diff เองทั้งหมด — script `check-updates.mjs` จะสรุปให้ว่า
   template implement อะไรใหม่บ้าง (ไฟล์ใหม่, ไฟล์ที่แก้, TODO ใหม่) ช่วยให้
   dev/reviewer อ่าน MR ที่จะเกิดขึ้นได้ไวขึ้น เพราะรู้ล่วงหน้าว่าอะไรคือ
   "ของจาก template" ไม่ใช่ฟีเจอร์ของตัวเอง
2. **หลัง merge** — ไฟล์ที่ template ดูแล เช่น `.gitlab-ci.yml`,
   `package.json`, `bun.lock` มีค่าที่เฉพาะโปรเจกต์นี้ฝังอยู่ (ชื่อระบบใน
   `DOCKER_IMAGE`, `SONAR_PROJECT_KEY`, `SONAR_PROJECT_NAME`, ชื่อ package)
   ซึ่งจะถูกเขียนทับกลับไปเป็น placeholder ทุกครั้งที่ merge จาก template —
   script `apply-config.mjs` reapply ค่าพวกนี้กลับให้อัตโนมัติ

## ขั้นตอนที่ต้องทำ

### Stage A — เช็คว่ามีอัปเดตไหม (ปลอดภัย รันได้ตลอดเวลา ไม่แก้ไฟล์ใด ๆ)

```bash
node .claude/skills/template-update/scripts/check-updates.mjs
```

(ถ้าไม่มี `node` ใน PATH ใช้ `bun` แทนได้ — script ไม่ได้ใช้ฟีเจอร์เฉพาะของ
Bun หรือ Node)

Script จะ:
- `git fetch template --tags` เพื่อดึง tag ล่าสุดจาก remote `template`
- หา baseline (tag ล่าสุดที่โปรเจกต์นี้เคย merge) จาก commit message ที่มี
  รูปแบบ `X.Y.Z-template` ใน `git log --all`
- ถ้ามีเวอร์ชันใหม่กว่า ให้สรุป diff ระหว่าง baseline กับเวอร์ชันล่าสุด:
  ไฟล์ใหม่ / ไฟล์ที่แก้ / ไฟล์ที่ลบ / TODO ใหม่ที่ template เพิ่มเข้ามา

อ่านผลลัพธ์ให้ผู้ใช้ฟังเป็นภาษาที่เข้าใจง่าย ไม่ใช่แค่แปะ raw output — เน้น
ว่าไฟล์ไหนเป็นของใหม่ (feature ใหม่ของ template) และมี TODO ใหม่ที่ต้อง
ระวังหรือไม่

**ถ้าไม่มีเวอร์ชันใหม่** ให้แจ้งผู้ใช้แล้วจบตรงนี้ ไม่ต้องทำ Stage B/C

### Stage B — Merge (ต้องขอ confirm จากผู้ใช้ก่อนเสมอ)

`git merge` แก้ working tree และอาจ conflict ได้ — **ห้ามรันเองโดยไม่ถาม**
ให้สรุปสิ่งที่พบใน Stage A ให้ผู้ใช้ตัดสินใจก่อนว่าจะ merge เวอร์ชันล่าสุด
จริงหรือไม่ เมื่อได้รับการยืนยันแล้วจึงรัน:

```bash
git fetch --all
git merge --squash {tag ล่าสุดจาก Stage A}
```

### Stage C — Reapply config เฉพาะโปรเจกต์ (รันหลังจาก merge เสร็จ ก่อน commit)

```bash
node .claude/skills/template-update/scripts/apply-config.mjs
```

หลักการ: `git merge --squash` stage ไฟล์ที่ merge แล้วแต่ **ไม่ขยับ HEAD**
ดังนั้น `git show HEAD:<path>` ยังให้ไฟล์เวอร์ชันก่อน merge (ค่าที่โปรเจกต์
custom ไว้) เทียบกับไฟล์ใน working tree ที่เป็นเวอร์ชันหลัง merge (template
เขียนทับ) script จะดึงค่าที่เคย custom แล้วเขียนกลับเข้าไปตำแหน่งเดิม โดย
match ด้วย pattern ของตัวแปร ไม่ได้ผูกกับ comment `# TODO:` จึงยังทำงานได้
แม้ template จะย้าย/แก้คำอธิบาย TODO ไปแล้ว

อ่าน output:
- `[reapplied]` = แก้ค่ากลับให้อัตโนมัติแล้ว
- `[ok]` = ค่าตรงกับของเดิมอยู่แล้ว ไม่ต้องทำอะไร
- `[MANUAL]` = ต้องแก้เอง (ค่าก่อนหน้ายังเป็น placeholder เอง หรือ template
  เปลี่ยนโครงสร้างจนหา pattern เดิมไม่เจอ) — แจ้งผู้ใช้เป็นรายการชัดเจนว่า
  เหลืออะไรที่ต้องแก้ด้วยมือ พร้อมพิกัดไฟล์

### หลังจากนั้น

```bash
git diff
```

สรุปให้ผู้ใช้ดูทั้งส่วนที่ script แก้ให้และส่วนที่ template เปลี่ยนแปลงจริง
(อ้างอิงกับสรุปจาก Stage A ได้เลยว่าไฟล์ไหนคือของ template)

**ห้าม commit หรือ push เอง** — ให้ผู้ใช้ตรวจ diff แล้วสั่ง commit เอง
ตามรูปแบบใน README (`Update Template x.x.x-template`) เว้นแต่ผู้ใช้จะขอให้
commit ให้ชัดเจน

## ขอบเขต

- `apply-config.mjs` ดูแลเฉพาะ 5 จุดที่ระบุใน README (`DOCKER_IMAGE`,
  `SONAR_PROJECT_KEY`, `SONAR_PROJECT_NAME`, `package.json` name,
  `bun.lock` workspace name) ถ้าต้องการเพิ่ม field อื่นที่ template เขียนทับ
  ซ้ำ ๆ ให้แก้ `fileConfigs` ใน
  [scripts/apply-config.mjs](scripts/apply-config.mjs)
- `check-updates.mjs` หา baseline จาก commit message ที่มีคำว่า
  `X.Y.Z-template` เท่านั้น ถ้าโปรเจกต์ commit message ไม่ตรง pattern นี้เลย
  (เช่น merge ครั้งแรกที่ยังไม่เคยมี commit แบบนี้มาก่อน) script จะบอกว่าหา
  baseline ไม่เจอ — กรณีนี้เป็นการ merge ครั้งแรก ให้ทำตาม README.md ปกติ

## การกระจาย skill นี้ไปโปรเจกต์อื่น

Skill นี้อยู่ใน `.claude/skills/` ซึ่งไม่ถูก `.gitignore` กัน — ถ้าต้องการให้
โปรเจกต์ใหม่ทุกตัวที่ clone จาก template ได้ skill นี้ติดไปด้วยโดยอัตโนมัติ
ให้ copy โฟลเดอร์ `.claude/skills/template-update/` ไปไว้ใน template repo
ที่เกี่ยวข้อง (แต่ละประเภทโปรเจกต์มี template repo ของตัวเอง เช่น
api-gateway, api-internal — copy เข้าไปทุก template repo ที่ต้องการใช้)
แล้ว push ขึ้นเป็น tag ใหม่ — เป็นขั้นตอนที่ผู้ดูแล template ทำเองด้วยมือ
(ไม่ใช่สิ่งที่ skill นี้ทำอัตโนมัติ ดูรายละเอียดในเอกสารประจำ skills
collection ที่ต้นทางของ skill นี้)
