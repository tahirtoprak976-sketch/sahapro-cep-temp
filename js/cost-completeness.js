// Pure shared completeness decision. An absent company cost is not an unknown cost;
// a present projection with unknown amount/coverage must never become numeric profit.
export function dumpCostIncomplete(fee) {
  return !!fee && !!(fee.unverified || fee.missing || fee.coverage_unknown ||
    fee.amount == null || fee.remaining_estimated_amount === null);
}

export function costCompleteness({ pendingFuel = 0, dumpUnknown = 0 } = {}) {
  const reasons = [];
  if (pendingFuel > 0) reasons.push({ code: 'fuel_pending', count: pendingFuel, label: 'yakıt mutabakat bekliyor' });
  if (dumpUnknown > 0) reasons.push({ code: 'dump_unknown', count: dumpUnknown, label: 'döküm maliyeti eksik' });
  return {
    costIncomplete: reasons.length > 0,
    costIncompleteReasons: reasons,
    costIncompleteReason: reasons.map(r => r.label).join('; '),
  };
}
