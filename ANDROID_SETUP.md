# ตั้งค่า Android (ทำหลัง `flutter create`)

โค้ดใน `lib/` เขียนไว้ครบแล้ว แต่โฟลเดอร์ platform (`android/`) ยังไม่ถูกสร้าง
เพราะเครื่องยังไม่มี Flutter SDK ตอนเขียน ทำตามลำดับนี้เมื่อ SDK พร้อม

## 1. สร้าง platform folders (ไม่ทับ lib/ ที่มีอยู่)

```powershell
cd D:\claude\ค่าใช้จ่าย
flutter create --platforms=android .
flutter pub get
```

> `flutter create` จะไม่เขียนทับไฟล์ที่มีอยู่แล้ว (lib/, pubspec.yaml) — แค่เติม android/ ให้

## 2. เปิด core library desugaring (จำเป็นสำหรับ flutter_local_notifications v17+)

แก้ `android/app/build.gradle` (หรือ `build.gradle.kts`)

**build.gradle (Groovy):**
```groovy
android {
    compileSdkVersion 34
    defaultConfig {
        minSdkVersion 21
    }
    compileOptions {
        coreLibraryDesugaringEnabled true
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}
dependencies {
    coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.2'
}
```

## 3. เพิ่ม permission ใน AndroidManifest.xml

`android/app/src/main/AndroidManifest.xml` — เพิ่มก่อน `<application>`:

```xml
<!-- แจ้งเตือน (Android 13+) -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<!-- ตั้งเตือนใหม่หลังรีบูต (ถ้าต้องการ) -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
```

> เราใช้ **inexact alarm** (`AndroidScheduleMode.inexactAllowWhileIdle`) จึง **ไม่ต้อง**
> ขอ `SCHEDULE_EXACT_ALARM` — ลดความยุ่งยากเรื่อง permission

### (ตัวเลือก) ตั้งเตือนใหม่อัตโนมัติหลังรีบูต

ใน `<application>` เพิ่ม receiver ของ flutter_local_notifications:

```xml
<receiver android:exported="false"
    android:name="com.dexterous.flutterlocalnotifications.ScheduledNotificationBootReceiver">
    <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED"/>
    </intent-filter>
</receiver>
```

> ถ้าไม่ทำข้อนี้ก็ยังใช้ได้ เพราะแอปสั่ง reschedule ทุกครั้งที่เปิด

## 4. รัน

```powershell
flutter run           # เสียบมือถือเปิด USB debugging หรือเปิด emulator
```

## 5. Build APK ลงเครื่องจริง

```powershell
flutter build apk --release
# ได้ไฟล์ที่ build\app\outputs\flutter-apk\app-release.apk
```

---

## หมายเหตุฟอนต์

ตอนนี้ใช้ `google_fonts` โหลด IBM Plex Sans Thai + Lexend ผ่านเน็ตครั้งแรกแล้วแคชไว้
ถ้าต้องการ **offline 100%** ให้ดาวน์โหลดไฟล์ฟอนต์มาไว้ใน `assets/fonts/`
แล้วประกาศใน `pubspec.yaml` + สลับไปใช้ `TextTheme` แบบ bundle แทน (ทำได้ในเฟสถัดไป)
