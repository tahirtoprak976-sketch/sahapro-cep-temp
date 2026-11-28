# Included loading activity

A typed historical loading row can link to exactly one already saved transport source for the same date/customer. The personnel and machine remain native work-record references. Unknown hours, trucks and trips stay unknown; the activity is displayed as “Süre belirtilmedi”. It creates no separate charge, tax, cash, expense, payroll claim or tank movement.

Internally quantity 1 / Adet identifies one activity occurrence, never a reported hour/truck/trip. This occurrence is excluded from measured unit summaries and cannot be repriced, claimed or financially edited. Its snapshot states “Nakliye bedeline dahil”, unknown VAT and no additional amount. Existing transport records and their immutable source evidence remain unchanged. The activity is not employee attendance or overtime evidence.

Native source replay, packet conflict, backup and atomic receipt handling remain in force. A second loading for the same day/customer/person/machine requires review rather than silent duplicate creation. Existing financial review cards, original attachment requirements and schema8 upgrade preservation remain deployed.

Validation: synthetic linked parent and personnel, unknown duration, unchanged units/finance, parent and duplicate guards, native IndexedDB replay/edit protection and 360px detail; installed v3.10.45 upgrade and offline preservation; existing regression suite.
