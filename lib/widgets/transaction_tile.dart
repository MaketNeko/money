import 'package:flutter/material.dart';

import '../models/category.dart';
import '../models/transaction.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../utils/money.dart';
import '../utils/thai_date.dart';

class TransactionTile extends StatelessWidget {
  const TransactionTile({super.key, required this.tx, this.onDelete});

  final TxRecord tx;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final isIncome = tx.type == TxType.income;
    final color = isIncome ? AppColors.income : AppColors.expense;
    final cat = tx.category;
    final title = tx.note.isNotEmpty ? tx.note : cat.label;

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      leading: CircleAvatar(
        backgroundColor: AppColors.surfaceHigh,
        child: Icon(cat.icon, color: color, size: 20),
      ),
      title: Text(title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: AppColors.ink, fontSize: 15)),
      subtitle: Text('${cat.label} · ${ThaiDate.dayMonth(tx.date)}',
          style: const TextStyle(color: AppColors.muted, fontSize: 13)),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(isIncome ? Icons.arrow_upward : Icons.arrow_downward,
              size: 14, color: color),
          const SizedBox(width: 2),
          Text(Money.format(tx.amount),
              style: AppTheme.numberStyle(size: 16, color: color)),
        ],
      ),
      onLongPress: onDelete,
    );
  }
}
