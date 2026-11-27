# Approved internal movements and actual expense review

Version 3.10.43 keeps schema 8 and existing data stores.

Internal work requires a currently active internal customer and the native own-depot price marker. An explicit material receipt additionally requires an active own-yard destination, material and trip quantity. The receipt contributes to incoming yard stock once; ordinary internal outbound trips remain outgoing. Donor names do not change the receipt material classification. Both internal movement types produce no customer sales debt.

Personal expense review V2 accepts an actual paid amount with explicitly unknown VAT. It rejects quoted net amounts or tax rates in that format. Staging writes review metadata only. The local form starts with blank payment, unchecked confirmation and no selected VAT, and requires the existing local PIN and Save. Saving creates one ordinary employee-paid expense and its existing reimbursement claim, with unknown tax fields left null; it never invents a company cash payment or a VAT rate. V1 quoted-cost and optional-VAT correction behavior remains supported.

Stable source keys, content conflicts, backup, atomic rollback and native replay protection remain mandatory. Tests use synthetic records only. The release adds a 360px browser scenario, Node guards and an exact installed v3.10.41 data/offline upgrade check while retaining the existing validation suite.
