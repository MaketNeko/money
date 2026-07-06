import 'package:flutter/material.dart';

import '../models/bill.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../utils/money.dart';
import '../utils/thai_date.dart';

/// การ์ดบิลใกล้ครบกำหนดบนหน้า Home
class BillCard extends StatelessWidget {
  const BillCard({
    super.key,
    required this.bill,
    required this.month,
    this.onPay,
  });

  final Bill bill;
  final DateTime month;
  final VoidCallback? onPay;

  @override
  Widget build(BuildContext context) {
    final due = bill.dueDateFor(month);
    final today = DateTime.now();
    final daysLeft = DateTime(due.year, due.month, due.day)
        .difference(DateTime(today.year, today.month, today.day))
        .inDays;
    final overdue = daysLeft < 0;

    final statusColor = overdue
        ? AppColors.danger
        : (daysLeft <= 3 ? AppColors.expense : AppColors.muted);
    final statusText = overdue
        ? 'เลยกำหนด ${-daysLeft} วัน'
        : (daysLeft == 0 ? 'ครบกำหนดวันนี้' : 'อีก $daysLeft วัน');

    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Icon(Icons.notifications_active_outlined,
                color: statusColor, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(bill.name,
                      style: const TextStyle(
                          color: AppColors.ink,
                          fontSize: 15,
                          fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text('ครบ ${ThaiDate.dayMonth(due)} · $statusText',
                      style: TextStyle(color: statusColor, fontSize: 13)),
                ],
              ),
            ),
            if (!bill.isVariable)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Text(Money.baht(bill.amount),
                    style:
                        AppTheme.numberStyle(size: 15, color: AppColors.ink)),
              ),
            FilledButton.tonal(
              onPressed: onPay,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.trust,
                foregroundColor: AppColors.onTrust,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                minimumSize: const Size(0, 44),
              ),
              child: const Text('จ่ายแล้ว'),
            ),
          ],
        ),
      ),
    );
  }
}
