import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/finance_store.dart';
import '../models/category.dart';
import '../models/transaction.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// bottom sheet ลงเงินแบบไว: พิมพ์จำนวน -> เลือกหมวด -> เซฟ
class AddTransactionSheet extends StatefulWidget {
  const AddTransactionSheet({super.key});

  @override
  State<AddTransactionSheet> createState() => _AddTransactionSheetState();
}

class _AddTransactionSheetState extends State<AddTransactionSheet> {
  TxType _type = TxType.expense;
  String _amount = '';
  String? _categoryId;

  double get _value => double.tryParse(_amount) ?? 0;
  bool get _canSave => _value > 0 && _categoryId != null;

  void _tap(String key) {
    setState(() {
      if (key == '⌫') {
        if (_amount.isNotEmpty) {
          _amount = _amount.substring(0, _amount.length - 1);
        }
      } else if (key == '.') {
        if (!_amount.contains('.') && _amount.isNotEmpty) _amount += '.';
      } else {
        // จำกัดทศนิยม 2 ตำแหน่ง
        if (_amount.contains('.') && _amount.split('.').last.length >= 2) return;
        if (_amount == '0') _amount = key;
        else _amount += key;
      }
    });
  }

  void _switchType(TxType t) {
    setState(() {
      _type = t;
      _categoryId = null; // หมวดคนละชุด
    });
  }

  Future<void> _save() async {
    final store = context.read<FinanceStore>();
    await store.addTransaction(TxRecord(
      amount: _value,
      date: DateTime.now(),
      categoryId: _categoryId!,
      type: _type,
    ));
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final accent =
        _type == TxType.income ? AppColors.income : AppColors.expense;
    final categories = Categories.of(_type);

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ตัวสลับ รับ/จ่าย
              _TypeToggle(type: _type, onChanged: _switchType),
              const SizedBox(height: 16),

              // จำนวนเงินตัวใหญ่
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text('฿ ',
                      style: AppTheme.numberStyle(
                          size: 28, color: AppColors.muted)),
                  Text(
                    _amount.isEmpty ? '0' : _amount,
                    style: AppTheme.numberStyle(
                      size: 48,
                      weight: FontWeight.w700,
                      color: _amount.isEmpty ? AppColors.muted : accent,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // หมวดหมู่
              SizedBox(
                height: 92,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    for (final c in categories)
                      _CategoryChip(
                        category: c,
                        selected: _categoryId == c.id,
                        accent: accent,
                        onTap: () => setState(() => _categoryId = c.id),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 8),

              // แป้นตัวเลข
              _NumPad(onTap: _tap),
              const SizedBox(height: 12),

              FilledButton(
                onPressed: _canSave ? _save : null,
                style: FilledButton.styleFrom(
                  backgroundColor: accent,
                  foregroundColor: AppColors.base,
                  disabledBackgroundColor: AppColors.surfaceHigh,
                  minimumSize: const Size(0, 52),
                ),
                child: const Text('บันทึก',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TypeToggle extends StatelessWidget {
  const _TypeToggle({required this.type, required this.onChanged});

  final TxType type;
  final ValueChanged<TxType> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          _seg('จ่าย', TxType.expense, AppColors.expense),
          _seg('รับ', TxType.income, AppColors.income),
        ],
      ),
    );
  }

  Widget _seg(String label, TxType t, Color color) {
    final selected = type == t;
    return Expanded(
      child: GestureDetector(
        onTap: () => onChanged(t),
        child: Container(
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? color.withValues(alpha: 0.18) : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
          ),
          child: Text(label,
              style: TextStyle(
                color: selected ? color : AppColors.muted,
                fontWeight: FontWeight.w600,
                fontSize: 15,
              )),
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.category,
    required this.selected,
    required this.accent,
    required this.onTap,
  });

  final Category category;
  final bool selected;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 76,
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        decoration: BoxDecoration(
          color: selected ? accent.withValues(alpha: 0.18) : AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? accent : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(category.icon,
                color: selected ? accent : AppColors.muted, size: 24),
            const SizedBox(height: 6),
            Text(
              category.label,
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: selected ? AppColors.ink : AppColors.muted,
                fontSize: 11,
                height: 1.1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NumPad extends StatelessWidget {
  const _NumPad({required this.onTap});
  final ValueChanged<String> onTap;

  static const _keys = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '.', '0', '⌫',
  ];

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 2.1,
      mainAxisSpacing: 4,
      children: [
        for (final k in _keys)
          InkWell(
            onTap: () => onTap(k),
            borderRadius: BorderRadius.circular(12),
            child: Center(
              child: k == '⌫'
                  ? const Icon(Icons.backspace_outlined,
                      color: AppColors.ink, size: 22)
                  : Text(k,
                      style: AppTheme.numberStyle(
                          size: 24, color: AppColors.ink)),
            ),
          ),
      ],
    );
  }
}
