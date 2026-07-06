import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/finance_store.dart';
import '../models/bill.dart';
import '../models/category.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../utils/money.dart';
import '../utils/thai_date.dart';
import 'bill_edit_sheet.dart';

class BillsScreen extends StatelessWidget {
  const BillsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = context.watch<FinanceStore>();
    final now = DateTime.now();
    final bills = store.bills;

    return Scaffold(
      appBar: AppBar(title: const Text('บิลประจำ')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openEdit(context, null),
        icon: const Icon(Icons.add),
        label: const Text('เพิ่มบิล'),
      ),
      body: SafeArea(
        child: bills.isEmpty
            ? const _Empty()
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                itemCount: bills.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final b = bills[i];
                  final paid = b.isPaidFor(now);
                  final cat = Categories.resolve(b.categoryId, TxType.expense);
                  return Card(
                    child: ListTile(
                      onTap: () => _openEdit(context, b),
                      leading: CircleAvatar(
                        backgroundColor: AppColors.surfaceHigh,
                        child: Icon(cat.icon,
                            color: b.active ? AppColors.trust : AppColors.muted,
                            size: 20),
                      ),
                      title: Text(b.name,
                          style: TextStyle(
                              color: b.active
                                  ? AppColors.ink
                                  : AppColors.muted,
                              fontSize: 15)),
                      subtitle: Text(
                        'ทุกวันที่ ${b.dueDay} · ${paid ? "จ่ายแล้วเดือนนี้" : "ยังไม่จ่าย"}'
                        '${b.active ? "" : " · ปิดอยู่"}',
                        style: TextStyle(
                            color: paid ? AppColors.income : AppColors.muted,
                            fontSize: 13),
                      ),
                      trailing: Text(
                        b.isVariable ? 'ผันแปร' : Money.baht(b.amount),
                        style: AppTheme.numberStyle(
                            size: 14, color: AppColors.ink),
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }

  void _openEdit(BuildContext context, Bill? bill) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => BillEditSheet(bill: bill),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.notifications_none, size: 44, color: AppColors.muted),
          const SizedBox(height: 12),
          const Text('ยังไม่มีบิล',
              style: TextStyle(color: AppColors.ink, fontSize: 16)),
          const SizedBox(height: 4),
          Text('เพิ่มบิล เช่น ค่าเน็ต ค่าไฟ ค่างวด เพื่อให้แอปเตือน',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted.withValues(alpha: 0.9))),
        ],
      ),
    );
  }
}
