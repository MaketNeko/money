import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../data/finance_store.dart';

/// export/import ข้อมูลเป็นไฟล์ JSON (backup ด้วยตัวเอง — ไม่มี cloud)
class BackupService {
  BackupService._();
  static final BackupService instance = BackupService._();

  /// เขียนไฟล์ JSON แล้วเปิด share sheet ให้ผู้ใช้เลือกที่เก็บ/ส่งต่อ
  Future<void> export(FinanceStore store) async {
    final json = const JsonEncoder.withIndent('  ').convert(store.exportData());
    final dir = await getTemporaryDirectory();
    final stamp = DateTime.now().toIso8601String().split('T').first;
    final file = File('${dir.path}/money_backup_$stamp.json');
    await file.writeAsString(json);
    await Share.shareXFiles([XFile(file.path)], subject: 'สำรองข้อมูลการเงิน');
  }

  /// เลือกไฟล์ JSON แล้วนำเข้า (แทนที่ข้อมูลเดิมทั้งหมด)
  /// คืน true ถ้าสำเร็จ, false ถ้ายกเลิก
  Future<bool> import(FinanceStore store) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['json'],
    );
    final path = result?.files.single.path;
    if (path == null) return false;

    final raw = await File(path).readAsString();
    final data = jsonDecode(raw) as Map<String, Object?>;
    await store.importReplace(data);
    return true;
  }
}
