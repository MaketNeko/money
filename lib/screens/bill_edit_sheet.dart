import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/finance_store.dart';
import '../models/bill.dart';
import '../models/category.dart';
import '../theme/app_colors.dart';

/// ฟอร์มเพิ่ม/แก้บิล
class BillEditSheet extends StatefulWidget {
  const BillEditSheet({super.key, this.bill});

  final Bill? bill;

  @override
  State<BillEditSheet> createState() => _BillEditSheetState();
}

class _BillEditSheetState extends State<BillEditSheet> {
  late final TextEditingController _name;
  late final TextEditingController _amount;
  late String _categoryId;
  late int _dueDay;
  late bool _variable;
  late bool _active;
  late Set<int> _reminders;

  static const _reminderOptions = [7, 5, 3, 1];

  @override
  void initState() {
    super.initState();
    final b = widget.bill;
    _name = TextEditingController(text: b?.name ?? '');
    _amount =
        TextEditingController(text: b == null || b.amount <= 0 ? '' : '${b.amount}');
    _categoryId = b?.categoryId ?? 'bills';
    _dueDay = b?.dueDay ?? 1;
    _variable = b?.isVariable ?? false;
    _active = b?.active ?? true;
    _reminders = {...(b?.reminderDaysBefore ?? const [3, 1])};
  }

  @override
  void dispose() {
    _name.dispose();
    _amount.dispose();
    super.dispose();
  }

  bool get _canSave =>
      _name.text.trim().isNotEmpty &&
      (_variable || (double.tryParse(_amount.text.trim()) ?? 0) > 0);

  Future<void> _save() async {
    final store = context.read<FinanceStore>();
    final amount = _variable ? 0.0 : (double.tryParse(_amount.text.trim()) ?? 0);
    final bill = (widget.bill ??
            Bill(
              name: '',
              amount: 0,
              categoryId: _categoryId,
              dueDay: _dueDay,
            ))
        .copyWith(
      name: _name.text.trim(),
      amount: amount,
      categoryId: _categoryId,
      dueDay: _dueDay,
      reminderDaysBefore: (_reminders.toList()..sort((a, b) => b.compareTo(a))),
      active: _active,
    );
    await store.upsertBill(bill);
    if (mounted) Navigator.pop(context);
  }

  Future<void> _delete() async {
    final store = context.read<FinanceStore>();
    if (widget.bill?.id != null) await store.deleteBill(widget.bill!.id!);
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Text(widget.bill == null ? 'เพิ่มบิล' : 'แก้ไขบิล',
                      style: const TextStyle(
                          color: AppColors.ink,
                          fontSize: 18,
                          fontWeight: FontWeight.w600)),
                  const Spacer(),
                  if (widget.bill != null)
                    IconButton(
                      onPressed: _delete,
                      icon: const Icon(Icons.delete_outline,
                          color: AppColors.danger),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _name,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                    labelText: 'ชื่อบิล', hintText: 'เช่น ค่าเน็ต AIS'),
              ),
              const SizedBox(height: 16),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _variable,
                activeColor: AppColors.trust,
                onChanged: (v) => setState(() => _variable = v),
                title: const Text('จำนวนผันแปร (กรอกตอนจ่าย)',
                    style: TextStyle(color: AppColors.ink, fontSize: 15)),
                subtitle: const Text('เช่น ค่าไฟ ค่าน้ำ ที่ไม่เท่ากันทุกเดือน',
                    style: TextStyle(color: AppColors.muted, fontSize: 12)),
              ),
              if (!_variable) ...[
                const SizedBox(height: 8),
                TextField(
                  controller: _amount,
                  onChanged: (_) => setState(() {}),
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                      labelText: 'จำนวนเงิน', prefixText: '฿ '),
                ),
              ],
              const SizedBox(height: 16),
              const _FieldLabel('หมวดหมู่'),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final c in Categories.expense)
                    ChoiceChip(
                      label: Text(c.label),
                      selected: _categoryId == c.id,
                      onSelected: (_) => setState(() => _categoryId = c.id),
                      selectedColor: AppColors.trust.withValues(alpha: 0.25),
                      backgroundColor: AppColors.surface,
                      labelStyle: TextStyle(
                        color: _categoryId == c.id
                            ? AppColors.ink
                            : AppColors.muted,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              _FieldLabel('ครบกำหนดทุกวันที่ $_dueDay ของเดือน'),
              Slider(
                value: _dueDay.toDouble(),
                min: 1,
                max: 31,
                divisions: 30,
                activeColor: AppColors.trust,
                label: '$_dueDay',
                onChanged: (v) => setState(() => _dueDay = v.round()),
              ),
              const SizedBox(height: 8),
              const _FieldLabel('เตือนล่วงหน้า (นอกเหนือจากรอบล็อกต้นเดือน/สิ้นเดือน)'),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  for (final d in _reminderOptions)
                    FilterChip(
                      label: Text('$d วัน'),
                      selected: _reminders.contains(d),
                      onSelected: (s) => setState(() {
                        if (s) {
                          _reminders.add(d);
                        } else {
                          _reminders.remove(d);
                        }
                      }),
                      selectedColor: AppColors.trust.withValues(alpha: 0.25),
                      backgroundColor: AppColors.surface,
                      labelStyle: TextStyle(
                        color: _reminders.contains(d)
                            ? AppColors.ink
                            : AppColors.muted,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _active,
                activeColor: AppColors.trust,
                onChanged: (v) => setState(() => _active = v),
                title: const Text('เปิดใช้งานบิลนี้',
                    style: TextStyle(color: AppColors.ink, fontSize: 15)),
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: _canSave ? _save : null,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.trust,
                  foregroundColor: AppColors.onTrust,
                  minimumSize: const Size(0, 52),
                ),
                child: const Text('บันทึกบิล',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(color: AppColors.muted, fontSize: 13));
}
