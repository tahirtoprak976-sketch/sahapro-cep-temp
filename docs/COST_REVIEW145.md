# Local cost review

Version 3.10.45 adds one explicit approved format with bounded native company fuel/cash and supplier open-account rows. No money is written during staging. The existing owner session, local checkbox, separately entered exact amount, PIN reauthentication and Save are required.

Company pump fuel writes one fuel cost and its linked company cash disbursement atomically. Reference prices remain visibly references, not actual station receipts or tax invoices. VAT stays unknown; no own-tank stock, customer offset or employee claim is created. Single-side amount/date/owner edits on this new linked pair are rejected.

Supplier credit writes one native payable only, using the existing unknown-VAT credit-item calculation. It requires the original local receipt file and saves its payable attachment in the same transaction. No company payment, supplier payment, employee claim or second expense is posted.

Sources and record bindings are rechecked at Save. Identical replay returns the saved receipt, changed content conflicts, missing saved records are never recreated, and duplicates are held. Old packet formats, business schema 8, deployed customer/site and finance flows remain unchanged. Synthetic Node and 360px browser coverage includes local defaults, money and tax counts, source guards, photo linking, atomic rollback and exact installed v3.10.44 offline data preservation.
