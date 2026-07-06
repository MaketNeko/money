import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/finance_store.dart';
import '../services/backup_service.dart';
import '../theme/app_colors.dart';
import 'bills_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ตั้งค่า')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: [
            const _SectionHeader('จัดการ'),
            ListTile(
              leading: const Icon(Icons.notifications_outlined,
                  color: AppColors.trust),
              title: const Text('บิลประจำ',
                  style: TextStyle(color: AppColors.ink)),
              subtitle: const Text('เพิ่ม/แก้บิล และตั้งการเตือน',
                  style: TextStyle(color: AppColors.muted)),
              trailing: const Icon(Icons.chevron_right, color: AppColors.muted),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const BillsScreen()),
              ),
            ),
            const Divider(height: 1),
            const _SectionHeader('สำรองข้อมูล'),
            ListTile(
              leading: const Icon(Icons.upload_file, color: AppColors.trust),
              title: const Text('ส่งออกข้อมูล (JSON)',
                  style: TextStyle(color: AppColors.ink)),
              subtitle: const Text('บันทึกไฟล์สำรองไว้เอง',
                  style: TextStyle(color: AppColors.muted)),
              onTap: () => _export(context),
            ),
            ListTile(
              leading:
                  const Icon(Icons.download_for_offline, color: AppColors.trust),
              title: const Text('นำเข้าข้อมูล (JSON)',
                  style: TextStyle(color: AppColors.ink)),
              subtitle: const Text('แทนที่ข้อมูลปัจจุบันด้วยไฟล์สำรอง',
                  style: TextStyle(color: AppColors.muted)),
              onTap: () => _import(context),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _export(BuildContext context) async {
    final store = context.read<FinanceStore>();
    final messenger = ScaffoldMessenger.of(context);
    try {
      await BackupService.instance.export(store);
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('ส่งออกไม่สำเร็จ: $e')));
    }
  }

  Future<void> _import(BuildContext context) async {
    final store = context.read<FinanceStore>();
    final messenger = ScaffoldMessenger.of(context);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceHigh,
        title: const Text('นำเข้าข้อมูล'),
        content: const Text(
            'ข้อมูลปัจจุบันทั้งหมดจะถูกแทนที่ด้วยไฟล์ที่เลือก ยืนยันหรือไม่?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('ยกเลิก')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('แทนที่')),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      final ok = await BackupService.instance.import(store);
      if (ok) {
        messenger.showSnackBar(
            const SnackBar(content: Text('นำเข้าข้อมูลสำเร็จ')));
      }
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('นำเข้าไม่สำเร็จ: $e')));
    }
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(text.toUpperCase(),
          style: const TextStyle(
              color: AppColors.muted,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5)),
    );
  }
}
