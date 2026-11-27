# Optional VAT payment in employee expense review

The source message's quoted net price and VAT rate no longer force a VAT-inclusive employee payment. The local review has a separate, initially unchecked “KDV de ödendi” checkbox and an independent, unchecked confirmation of the actual payment.

When VAT payment is checked, the existing gross amount and confirmed VAT breakdown are recorded. When unchecked, only the confirmed base payment is recorded as the expense and employee reimbursement. The expense's VAT rate, net and VAT breakdown stay `null`, not zero: the source quote remains in `history_source.original_row`, but payment behavior is not evidence of tax exemption. No unpaid VAT debt is inferred or created. An actual invoice or a separately verified outstanding liability needs its own evidence and normal accounting flow.

A saved expense originating from this review can be corrected locally in the same screen. Its current amount and VAT selection are shown; the owner must change the selection, confirm the actual payment and pass reauthentication before Save. Correction edits the same expense with backup, exact revision check, atomic audit/operation receipt and retry protection. It never adds a second expense, reimbursement event, cash, bank, customer balance or work. Existing source approvals and creation receipts remain historical evidence.

Paid reimbursements, invoice/payment-linked costs and allocated/bank/maintenance-linked expenses are held for separate review. Untouched existing records and legacy full-payment choices preserve their behavior. Normal payroll, personnel reports and cash forecasts continue to read the same single expense amount.

Validation includes native reimbursement calculations, unknown-versus-zero VAT, full-payment compatibility, same-record correction, stale revisions, linked/paid/invoice guards, repeated saves and OP_CONFLICT, transaction rollback and 360px UI. Existing 139 browser coverage still verifies that a payment inconsistent with the explicit VAT choice is held. The full workflow retains all prior gates and adds the new scenario and installed v3.10.39 upgrade preservation.
