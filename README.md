# Project 4 — Claude Code Skills

รวม Claude Code Skills ที่ใช้ร่วมกันได้ทุกโปรเจกต์ที่ derive มาจาก template
กลางของ Project 4 (api-gateway, api-internal, ฯลฯ) โฟลเดอร์นี้เป็น
"ต้นทาง" สำหรับ copy skill เข้า template repo หรือโปรเจกต์ใดโปรเจกต์หนึ่ง
โดยตรง ไม่ใช่โปรเจกต์ที่รันแอปจริง จึงไม่มี `package.json`/source code อื่น

**(สำหรับคนที่ไม่เคยใช้ Claude Code Skills มาก่อนเลย อ่านตั้งแต่ต้นจนจบแล้วทำตามได้เลย)**

---

## มี skill อะไรอยู่บ้าง

| Skill | หน้าที่ |
|---|---|
| [`template-update/`](./template-update/SKILL.md) | เช็คว่า template repo กลางมีเวอร์ชันใหม่กว่าที่โปรเจกต์ใช้อยู่หรือไม่ พร้อมสรุปว่า implement อะไรใหม่บ้าง (รวมถึงรีวิวเนื้อ diff ของไฟล์ที่ไม่ใช่ config point แล้วเสนอแนะ/ถามก่อนว่าควรปรับโค้ดโปรเจกต์ตามไหม) และ reapply ค่า config เฉพาะโปรเจกต์ (เช่น `DOCKER_IMAGE`, `SONAR_PROJECT_KEY`) หลัง merge ให้อัตโนมัติ |

> **ขอบเขตสำคัญของทุก skill ในนี้:** อ่าน/ตรวจสอบเท่านั้น **ไม่มี skill ไหน
> commit หรือ push ขึ้น git repo ใด ๆ เองโดยอัตโนมัติ** (รวมถึงไม่ push ขึ้น
> template repo ด้วย) ทุกครั้งที่มีการแก้ไฟล์ ต้องให้ผู้ใช้ตรวจ `git diff`
> แล้ว commit เองเสมอ

---

## 0. ความรู้พื้นฐานที่ต้องมีก่อนเริ่ม

| สิ่งที่ต้องมี | เช็คยังไง |
|---|---|
| ติดตั้ง Claude Code แล้ว | เปิดโปรเจกต์ด้วย Claude Code ได้ (desktop app หรือ CLI) |
| Git ใช้งานได้ | รัน `git --version` แล้วไม่ error |

ไม่จำเป็นต้องรู้จัก Claude Code Skill มาก่อน — โฟลเดอร์ `.claude/skills/` คือ
"ชุดคำสั่งสำเร็จรูป" ที่วางไว้ในโปรเจกต์ เวลาเปิดโปรเจกต์ด้วย Claude Code
ตัว Claude จะอ่านไฟล์ `SKILL.md` ในนั้นเองโดยอัตโนมัติ ไม่ต้องติดตั้งอะไรเพิ่ม

---

## 1. สำหรับผู้ดูแล template — อัป skill ขึ้น template repo กลาง

ทำครั้งเดียวต่อ skill ที่สร้างใหม่ หรือทุกครั้งที่แก้ไข skill เดิมในโฟลเดอร์นี้
ถ้ามี template repo หลายตัว (api-gateway, api-internal, ...) ต้องทำซ้ำ
ขั้นตอนนี้กับทุกตัวที่ต้องการให้มี skill นี้

### ขั้นตอน

1. **Clone (หรือเปิด) template repo ที่ใช้เป็นต้นแบบ** (เช่น `api-internal`)
   คนละ working directory กับโฟลเดอร์ skills นี้และกับโปรเจกต์ลูกใด ๆ —
   **ห้าม** push ตรง ๆ จากโปรเจกต์ลูก เพราะจะดึง history ของโปรเจกต์ลูก
   ติดไปด้วย

   ```bash
   git clone {template-repository-url}
   cd {template-project-directory}
   git checkout develop
   ```

2. **Copy โฟลเดอร์ skill ทั้งโฟลเดอร์** จาก `skills_2569/` ไปวางที่ root ของ
   template repo โดยให้ path ตรงกันเป๊ะ เช่นสำหรับ `template-update`:

   ```
   .claude/skills/template-update/SKILL.md
   .claude/skills/template-update/scripts/check-updates.mjs
   .claude/skills/template-update/scripts/apply-config.mjs
   ```

3. **Commit และ push ขึ้น branch พัฒนาของ template** (เช่น `develop`)

   ```bash
   git add .claude/skills/template-update
   git commit -m "Add template-update skill"
   git push origin develop
   ```

4. **สร้าง tag เวอร์ชันใหม่ผ่าน GitLab UI เท่านั้น** (ตามกติกาเดิมของ
   template repo: *"ไม่ควร push tag จาก Git local repository เพื่อป้องกัน
   การเผลอ push tag ของ template ให้สร้าง tag บน Git remote repository
   เท่านั้น"*) เช่นตั้งชื่อ tag ใหม่ต่อจาก tag ล่าสุดที่มีอยู่

5. **แจ้งทีม** ว่ามี template version ใหม่ และมี skill อะไรใหม่เพิ่มเข้ามา
   (จะได้ไม่ต้องมานั่งงมว่าทำไม repo ตัวเองมีโฟลเดอร์ `.claude/skills/`
   โผล่มาตอน merge)

> **หมายเหตุ:** ขั้นตอนนี้เหมือนกับการอัปเดตไฟล์อื่น ๆ ของ template ทุก
> ประการ เพราะ skill ก็เป็นแค่ไฟล์ในโปรเจกต์ ไม่มีขั้นตอน "publish" พิเศษ
> แยกต่างหาก — สิ่งที่ทำให้มันกลายเป็น "skill" คือ Claude Code อ่านไฟล์
> `.claude/skills/*/SKILL.md` เองอัตโนมัติเมื่อเปิดโปรเจกต์ และขั้นตอนนี้
> เป็นสิ่งที่ **มนุษย์ทำเองด้วยมือ** ไม่ใช่สิ่งที่ตัว skill สั่งให้ Claude
> ทำอัตโนมัติ (ดู "ขอบเขตสำคัญ" ด้านบน)

### อยากให้ทีมทดลองก่อน โดยยังไม่เข้า template repo กลาง

ถ้ายังไม่อยากแตะ template repo กลาง ให้ทำแบบ "ทดสอบก่อน" แทน — เลือกวิธี
ใดวิธีหนึ่ง:

- **Push โฟลเดอร์นี้ขึ้น git repo ของตัวเอง** (เช่น repo `skills_2569` แยก
  ต่างหาก หรือ branch ทดลองในโปรเจกต์ใดโปรเจกต์หนึ่ง) แล้วให้ทีม
  `git clone`/`git pull` มาลอง โดย copy โฟลเดอร์ skill เข้า
  `.claude/skills/` ของโปรเจกต์ที่จะทดสอบเอง
- หรือส่งโฟลเดอร์ `template-update/` ให้เพื่อนร่วมทีม copy วางใน
  `.claude/skills/` ของโปรเจกต์ทดสอบตรง ๆ โดยไม่ต้องผ่าน git เลยก็ได้
  (skill เป็นแค่ text file ไม่ต้อง build/install)

---

## 2. สำหรับทีมพัฒนา — pull skill มาใช้ในโปรเจกต์ตัวเอง

ทำตามนี้ทุกครั้งที่ต้องการเช็ค/อัปเดต template เวอร์ชันล่าสุดในโปรเจกต์ที่
กำลังพัฒนาอยู่ (skill จะติดมาพร้อมกับการ merge template ปกติ ไม่ต้องทำ
อะไรเพิ่มถ้า template repo มี skill นี้อยู่แล้ว)

### ขั้นตอน

1. **เช็คว่าโปรเจกต์มี remote ชื่อ `template` หรือยัง**

   ```bash
   git remote -v
   ```

   ถ้ายังไม่มีบรรทัดที่ขึ้นต้นด้วย `template` ให้เพิ่มก่อน (ใช้ URL ของ
   template repo ที่ตรงกับประเภทโปรเจกต์ เช่น api-internal, api-gateway):

   ```bash
   git remote add template {api-template-repository-url}
   ```

2. **เปิดโปรเจกต์ด้วย Claude Code แล้วพิมพ์ เพื่อเช็คว่ามีของใหม่ไหม:**

   ```
   /template-update
   ```

   หรือพิมพ์บอกเป็นภาษาปกติก็ได้ เช่น

   > "เช็คหน่อยว่า template มีอัปเดตใหม่ไหม"

   ขั้นตอนนี้ **ไม่แก้ไฟล์อะไรในโปรเจกต์เลย** ปลอดภัย เรียกได้ตลอดเวลา
   Claude จะดึง tag ล่าสุดจาก template แล้วสรุปให้ฟังว่า:
   - ตอนนี้โปรเจกต์อยู่ template เวอร์ชันไหน เทียบกับเวอร์ชันล่าสุด
   - ถ้ามีของใหม่ — ไฟล์ไหนถูกเพิ่ม/แก้/ลบ และมี TODO ใหม่ที่ต้องระวังไหม

   ถ้าไม่มีเวอร์ชันใหม่ ก็จบแค่นี้ ไม่ต้องทำขั้นตอนถัดไป

3. **ตัดสินใจว่าจะ merge หรือยัง** — อ่านสรุปจากข้อ 2 แล้วบอก Claude ว่า
   "merge เลย" Claude จะขอ confirm อีกครั้งก่อนรันจริง (เพราะ merge แก้
   working tree และอาจ conflict ได้) เมื่อยืนยันแล้วจะรัน:

   ```bash
   git fetch --all
   git merge --squash {tag ล่าสุด}
   ```

   (ยังไม่ commit ให้อัตโนมัติ — เป็นเรื่องปกติ)

4. **บอก Claude ให้ reapply ค่า config** เช่น "reapply config ให้หน่อย"
   Claude จะรัน script แล้วสรุปผลออกมาเป็น 3 แบบ:

   | สัญลักษณ์ | ความหมาย | ต้องทำอะไรต่อ |
   |---|---|---|
   | `[ok]` | ค่าตรงกับเดิมอยู่แล้ว | ไม่ต้องทำอะไร |
   | `[reapplied]` | แก้ค่ากลับให้อัตโนมัติแล้ว | ตรวจสอบผ่าน ๆ ก็พอ |
   | `[MANUAL]` | ต้องแก้เอง (เช่น เพิ่ง merge template ครั้งแรก หรือ template เปลี่ยนโครงสร้างไฟล์) | ไปแก้ไฟล์ตามที่ Claude บอกด้วยมือ |

5. **ตรวจสอบการเปลี่ยนแปลงทั้งหมดก่อน commit**

   ```bash
   git diff
   ```

   ดูทั้งส่วนที่ skill แก้ให้ และส่วนที่ template เปลี่ยนแปลงจริง ๆ
   (เทียบกับสรุปที่ได้จากข้อ 2 ได้เลยว่าไฟล์ไหนคือของ template)

6. **Commit และ push ตามรูปแบบของ template repo แต่ละโปรเจกต์**

   ```bash
   git commit
   ```

   ใส่ message บรรทัดบนสุดตามรูปแบบที่ README.md ของโปรเจกต์กำหนด (เช่น
   `Update Template x.x.x-template`)

   ```bash
   git push origin develop
   ```

---

## 3. คำถามที่พบบ่อย (FAQ)

**Q: พิมพ์ `/template-update` แล้ว Claude บอกว่าไม่รู้จัก command นี้**
A: แปลว่าโปรเจกต์นั้นยังไม่มีโฟลเดอร์ `.claude/skills/template-update/`
ให้เช็คว่ามีอยู่จริงในโปรเจกต์หรือไม่ ถ้าไม่มี ให้ merge template เวอร์ชัน
ที่มี skill นี้เข้ามาก่อน หรือ copy โฟลเดอร์ skill เข้าไปเองตามข้อ 1

**Q: เครื่องไม่มี `bun` ติดตั้งไว้ script จะรันได้ไหม**
A: ได้ script เขียนด้วย Node.js API ธรรมดา ไม่ได้ใช้ฟีเจอร์เฉพาะของ Bun
รันด้วย `node .claude/skills/template-update/scripts/check-updates.mjs`
หรือ `node .claude/skills/template-update/scripts/apply-config.mjs`
ได้เหมือนกัน

**Q: เช็คของใหม่ (Stage A) แล้วขึ้นว่า "หา baseline ไม่เจอ" ทำไม**
A: script หาว่าโปรเจกต์นั้นเคย merge template เวอร์ชันไหนล่าสุด จาก commit
message ที่มีคำว่า `x.x.x-template` ถ้าไม่เจอเลย (เช่น โปรเจกต์เพิ่งขึ้นใหม่
ยังไม่เคย merge template หลัง scaffold ครั้งแรก) ให้ทำตาม README.md ของ
โปรเจกต์นั้น หัวข้อ "การขึ้นโปรเจกต์ใหม่" แทน ไม่ต้องใช้ skill นี้

**Q: เจอ `[MANUAL]` เยอะมาก ทำอะไรผิดหรือเปล่า**
A: ไม่ผิด ถ้าเป็นการ merge template ครั้งแรกของโปรเจกต์ (ยังไม่เคย custom
ค่าอะไรมาก่อน) ทุกจุดจะขึ้น `[MANUAL]` ทั้งหมด เพราะ script ไม่มีค่าตั้งต้น
ให้เทียบ — กรณีนี้ให้แก้ตาม `TODO:` ในไฟล์ตามขั้นตอนปกติของ README.md
ของโปรเจกต์ได้เลย

**Q: กลัวว่า skill จะไป merge/commit/push อะไรโดยไม่ถาม**
A: ไม่ทำ — Stage A (เช็คของใหม่) อ่านอย่างเดียว ไม่แก้อะไร, Stage B (merge)
Claude ต้องขอ confirm ก่อนเสมอ, Stage C (reapply config) แค่แก้ไฟล์ใน
working tree ไม่มีการ `git add`, `git commit`, หรือ `git push` ในตัว skill
เลย ต้องตรวจ `git diff` แล้ว commit เองเสมอ

**Q: อยากเพิ่ม config point ใหม่ที่ template เขียนทับซ้ำ ๆ (นอกเหนือจาก 5 จุดเดิม)**
A: แก้ที่ `fileConfigs` ใน
[`template-update/scripts/apply-config.mjs`](./template-update/scripts/apply-config.mjs)
เพิ่ม pattern ใหม่ แล้วทำตามขั้นตอนข้อ 1 (อัปขึ้น template repo) อีกครั้ง

---

## 4. สรุปภาพรวม (สำหรับคนรีบ)

```
ผู้ดูแล skills_2569:  แก้/เพิ่ม skill -> copy เข้า template repo -> commit
                       -> push -> สร้าง tag ใหม่บน GitLab
                                                              |
                                                              v
ทีมพัฒนา:  พิมพ์ /template-update (เช็คของใหม่ ไม่แก้ไฟล์) -> อ่านสรุป
           -> ยืนยัน merge -> git merge --squash {tag} -> ขอให้ reapply config
           -> ตรวจ git diff -> commit -> push
```
