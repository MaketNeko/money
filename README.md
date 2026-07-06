# เงินของฉัน — แอปบันทึกรายรับ-รายจ่าย (เฟส 1)

แอป Android (Flutter) สำหรับบันทึกรายรับ-รายจ่าย + เตือนบิลประจำ ทำงาน **offline
เก็บข้อมูลในเครื่อง** ไม่มี server ไม่มีค่ารายเดือน

## ฟีเจอร์เฟส 1

- 💸 บันทึกรายรับ/รายจ่ายแบบไว (แป้นตัวเลข → เลือกหมวด → เซฟ)
- 📊 หน้า Home: ยอดคงเหลือเดือนนี้ (ตัวเลขเด่น) · โดนัทรายจ่ายตามหมวด · รายการล่าสุด
- 🔔 บิลประจำ: เตือนล่วงหน้าหลายรอบ + รอบล็อก (ต้นเดือน / วันสุดท้ายของเดือน)
  - กด **"จ่ายแล้ว"** → สร้างรายการรายจ่ายจริงอัตโนมัติ + หยุดเตือนงวดนั้น
- ⏰ เตือนลงรายจ่ายทุกวัน 20:00 (เวลาไทย)
- 💾 สำรอง/กู้คืนข้อมูลเป็นไฟล์ JSON

## ดีไซน์

- Dark mode, teal อุ่น (`#2DD4BF`) เป็นสีแบรนด์
- ฟอนต์: IBM Plex Sans Thai (UI) + Lexend tabular figures (ตัวเลข)
- วันที่เป็น พ.ศ. · เงินหน่วยบาท
- Touch target ≥ 44px, contrast ผ่าน WCAG AA

## โครงสร้าง

```
lib/
├── main.dart
├── theme/     app_colors · app_theme
├── models/    category · transaction · bill
├── data/      app_database (sqflite) · finance_store (state)
├── services/  notification_service · backup_service
├── utils/     thai_date (พ.ศ.) · money (฿)
├── screens/   home · add_transaction_sheet · bills · bill_edit_sheet · settings
└── widgets/   balance_hero · transaction_tile · category_donut · bill_card
```

## เริ่มใช้งาน

ยังไม่มี Flutter SDK ในเครื่อง — ดู **[ANDROID_SETUP.md](ANDROID_SETUP.md)** สำหรับขั้นตอน
ติดตั้ง + สร้าง `android/` + รัน

## ยังไม่ได้ทำ (เฟสถัดไป)

- OCR อ่านสลิปอัตโนมัติ (เฟส 1.5)
- เทรนด์ย้อนหลังหลายเดือน
- เช็คหุ้น / ข่าว / วิเคราะห์ตามแผนการเงิน (ต้องใช้ LLM — เฟสการเงินเต็มตัว)
- ฟอนต์ bundle offline 100%
- cloud sync
