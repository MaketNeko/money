import 'package:flutter/material.dart';

import '../data/finance_store.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../utils/money.dart';

/// signature element — ยอดคงเหลือเดือนนี้เป็นตัวเลขยักษ์
class BalanceHero extends StatelessWidget {
  const BalanceHero({super.key, required this.summary});

  final MonthSummary summary;

  @override
  Widget build(BuildContext context) {
    final positive = summary.balance >= 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('คงเหลือเดือนนี้',
            style: TextStyle(color: AppColors.muted, fontSize: 15)),
        const SizedBox(height: 4),
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text('฿',
                style: AppTheme.numberStyle(
                    size: 30, color: AppColors.muted, weight: FontWeight.w500)),
            const SizedBox(width: 4),
            Text(
              Money.format(summary.balance.abs()),
              style: AppTheme.numberStyle(
                size: 52,
                weight: FontWeight.w700,
                color: positive ? AppColors.ink : AppColors.expense,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            _Pill(
              icon: Icons.arrow_upward,
              color: AppColors.income,
              label: 'รับ',
              value: summary.income,
            ),
            const SizedBox(width: 12),
            _Pill(
              icon: Icons.arrow_downward,
              color: AppColors.expense,
              label: 'จ่าย',
              value: summary.expense,
            ),
          ],
        ),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color color;
  final String label;
  final double value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 6),
          Text('$label ',
              style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          Text(Money.format(value),
              style: AppTheme.numberStyle(size: 15, color: AppColors.ink)),
        ],
      ),
    );
  }
}
