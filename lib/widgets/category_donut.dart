import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../data/finance_store.dart';
import '../models/category.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../utils/money.dart';

/// โดนัทรายจ่ายแยกตามหมวด + legend หมวดที่จ่ายเยอะสุด
class CategoryDonut extends StatelessWidget {
  const CategoryDonut({super.key, required this.summary});

  final MonthSummary summary;

  // จานสีที่แยกออกจากกันได้ชัดบนพื้นมืด
  static const List<Color> _palette = [
    AppColors.trust,
    AppColors.expense,
    Color(0xFF60A5FA),
    Color(0xFFA78BFA),
    Color(0xFFF472B6),
    Color(0xFFFBBF24),
    Color(0xFF34D399),
    Color(0xFF94A3B8),
  ];

  @override
  Widget build(BuildContext context) {
    if (summary.expense <= 0) {
      return const SizedBox.shrink();
    }

    final entries = summary.byCategory.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    final sections = <PieChartSectionData>[
      for (var i = 0; i < entries.length; i++)
        PieChartSectionData(
          value: entries[i].value,
          color: _palette[i % _palette.length],
          radius: 16,
          showTitle: false,
        ),
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            SizedBox(
              width: 96,
              height: 96,
              child: PieChart(
                PieChartData(
                  sections: sections,
                  centerSpaceRadius: 30,
                  sectionsSpace: 2,
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('รายจ่ายตามหมวด',
                      style: TextStyle(color: AppColors.muted, fontSize: 13)),
                  const SizedBox(height: 8),
                  for (var i = 0; i < entries.length && i < 4; i++)
                    _LegendRow(
                      color: _palette[i % _palette.length],
                      label: Categories.resolve(entries[i].key, TxType.expense)
                          .label,
                      value: entries[i].value,
                      pct: entries[i].value / summary.expense * 100,
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LegendRow extends StatelessWidget {
  const _LegendRow({
    required this.color,
    required this.label,
    required this.value,
    required this.pct,
  });

  final Color color;
  final String label;
  final double value;
  final double pct;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppColors.ink, fontSize: 13)),
          ),
          Text('${pct.round()}%  ',
              style: const TextStyle(color: AppColors.muted, fontSize: 12)),
          Text(Money.format(value),
              style: AppTheme.numberStyle(size: 13, color: AppColors.ink)),
        ],
      ),
    );
  }
}
