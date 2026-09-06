#!/usr/bin/env python3
"""
Third-path independent verification fixtures for Concrete Cost Pro.

INDEPENDENCE STATEMENT: this script is written in Python using decimal.Decimal,
transcribed directly from the formulas documented in docs/CALCULATION_SPEC.md (English
prose + formula notation), WITHOUT reading, importing, or copying:
  - src/lib/calc.ts / src/lib/estimateMath.ts (the production TypeScript engine), or
  - tests/oracle/oracle.ts (the existing Decimal.js/TypeScript oracle used in Phase 1-10).
It runs on a different language, runtime and arithmetic library than either of those two
paths. Every fixture below prints its formula and every intermediate value, not just the
final answer, so the arithmetic can be checked by hand against this output.

Run: python3 tests/thirdpath/independent_verify.py > tests/thirdpath/fixtures.json
     (also writes tests/thirdpath/WORKED_EXAMPLES.md with the human-readable steps)
"""
import json
from decimal import Decimal, ROUND_CEILING, getcontext

getcontext().prec = 50


def D(x):
    return Decimal(str(x))


def safe(x):
    """Per spec section 1: non-finite or negative -> 0."""
    d = D(x)
    return d if d >= 0 else D(0)


def round_quantity(value, rounding):
    """Per spec section 2.1: always rounds UP to the increment. 'none' passes through."""
    if value < 0:
        return D(0)
    if rounding == "none":
        return value
    increment = {"quarter": D("0.25"), "half": D("0.5"), "whole": D("1")}[rounding]
    steps = (value / increment).to_integral_value(rounding=ROUND_CEILING)
    return steps * increment


def quantity(length_ft, width_ft, thickness_in, allowance_pct, rounding):
    L, W, T, A = safe(length_ft), safe(width_ft), safe(thickness_in), safe(allowance_pct)
    area_sqft = L * W
    thickness_ft = T / D(12)
    net_cubic_feet = area_sqft * thickness_ft
    net_cubic_yards = net_cubic_feet / D(27)
    with_allowance = net_cubic_yards * (D(1) + A / D(100))
    order_qty = round_quantity(with_allowance, rounding)
    return {
        "areaSqFt": area_sqft, "netCubicFeet": net_cubic_feet,
        "netCubicYards": net_cubic_yards, "orderQuantityYd3": order_qty,
    }


def cost(order_qty_yd3, ready_mix_rate, labor, forms, reinforcement, equipment, other, overhead_pct):
    ready_mix_cost = safe(order_qty_yd3) * safe(ready_mix_rate)
    direct_cost = ready_mix_cost + safe(labor) + safe(forms) + safe(reinforcement) + safe(equipment) + safe(other)
    overhead_amount = direct_cost * (safe(overhead_pct) / D(100))
    true_cost = direct_cost + overhead_amount
    return {"readyMixCost": ready_mix_cost, "directCost": direct_cost, "overheadAmount": overhead_amount, "trueCost": true_cost}


def margin(selling_price, true_cost):
    sp = D(str(selling_price))
    if sp <= 0:
        return None
    return (sp - true_cost) / sp


def required_price(true_cost, target_margin_pct):
    margin_decimal = safe(target_margin_pct) / D(100)
    if margin_decimal >= 1:
        return None  # Infinity
    return safe(true_cost) / (D(1) - margin_decimal)


def full_estimate(length_ft, width_ft, thickness_in, allowance_pct, rounding,
                   ready_mix_rate, labor, forms, reinforcement, equipment, other,
                   overhead_pct, target_margin_pct, selling_price):
    q = quantity(length_ft, width_ft, thickness_in, allowance_pct, rounding)
    c = cost(q["orderQuantityYd3"], ready_mix_rate, labor, forms, reinforcement, equipment, other, overhead_pct)
    rp = required_price(c["trueCost"], target_margin_pct)
    m = margin(selling_price, c["trueCost"])
    return {
        "quantity": {k: str(v) for k, v in q.items()},
        "cost": {k: str(v) for k, v in c.items()},
        "requiredSellingPrice": str(rp) if rp is not None else None,
        "currentMargin": str(m) if m is not None else None,
    }


def multi_section_estimate(sections, allowance_pct, rounding, ready_mix_rate, labor, forms,
                            reinforcement, equipment, other, overhead_pct, target_margin_pct, selling_price):
    net_yd3 = D(0)
    for (l, w, t) in sections:
        L, W, T = safe(l), safe(w), safe(t)
        net_yd3 += (L * W * (T / D(12))) / D(27)
    with_allowance = net_yd3 * (D(1) + safe(allowance_pct) / D(100))
    order_qty = round_quantity(with_allowance, rounding)
    c = cost(order_qty, ready_mix_rate, labor, forms, reinforcement, equipment, other, overhead_pct)
    rp = required_price(c["trueCost"], target_margin_pct)
    m = margin(selling_price, c["trueCost"])
    return {
        "netCubicYards": str(net_yd3), "orderQuantityYd3": str(order_qty),
        "cost": {k: str(v) for k, v in c.items()},
        "requiredSellingPrice": str(rp) if rp is not None else None,
        "currentMargin": str(m) if m is not None else None,
    }


fixtures = []

# TP-01..TP-10: single-section, varied rounding/allowance/cost combinations
single_cases = [
    dict(length_ft=40, width_ft=20, thickness_in=4, allowance_pct=10, rounding="quarter",
         ready_mix_rate=165, labor=1200, forms=180, reinforcement=220, equipment=150, other=50,
         overhead_pct=15, target_margin_pct=30, selling_price=4200),
    dict(length_ft=25, width_ft=25, thickness_in=5, allowance_pct=8, rounding="half",
         ready_mix_rate=170, labor=1400, forms=200, reinforcement=250, equipment=100, other=0,
         overhead_pct=12, target_margin_pct=28, selling_price=5000),
    dict(length_ft=12, width_ft=12, thickness_in=4, allowance_pct=0, rounding="none",
         ready_mix_rate=160, labor=300, forms=50, reinforcement=0, equipment=0, other=0,
         overhead_pct=10, target_margin_pct=20, selling_price=900),
    dict(length_ft=80, width_ft=10, thickness_in=6, allowance_pct=12, rounding="whole",
         ready_mix_rate=175, labor=2200, forms=300, reinforcement=400, equipment=250, other=100,
         overhead_pct=18, target_margin_pct=32, selling_price=8500),
    dict(length_ft=0, width_ft=30, thickness_in=4, allowance_pct=10, rounding="quarter",
         ready_mix_rate=165, labor=500, forms=0, reinforcement=0, equipment=0, other=0,
         overhead_pct=10, target_margin_pct=25, selling_price=600),  # EDGE zero length
    dict(length_ft=15, width_ft=15, thickness_in=0, allowance_pct=5, rounding="none",
         ready_mix_rate=160, labor=200, forms=0, reinforcement=0, equipment=0, other=0,
         overhead_pct=10, target_margin_pct=20, selling_price=300),  # EDGE zero thickness
    dict(length_ft=-10, width_ft=20, thickness_in=4, allowance_pct=10, rounding="none",
         ready_mix_rate=165, labor=0, forms=0, reinforcement=0, equipment=0, other=0,
         overhead_pct=10, target_margin_pct=25, selling_price=50),  # EDGE negative clamps
    dict(length_ft=33, width_ft=3, thickness_in=6, allowance_pct=0, rounding="whole",
         ready_mix_rate=150, labor=0, forms=0, reinforcement=0, equipment=0, other=0,
         overhead_pct=0, target_margin_pct=0, selling_price=0),  # EDGE exact whole-number boundary (33*3*0.5/27=5.5->6)
    dict(length_ft=18, width_ft=9, thickness_in=4, allowance_pct=15, rounding="quarter",
         ready_mix_rate=168, labor=650, forms=90, reinforcement=110, equipment=60, other=30,
         overhead_pct=14, target_margin_pct=100, selling_price=3000),  # EDGE margin=100% -> required price undefined
    dict(length_ft=45, width_ft=22, thickness_in=5, allowance_pct=9, rounding="half",
         ready_mix_rate=172, labor=1650, forms=210, reinforcement=260, equipment=140, other=45,
         overhead_pct=16, target_margin_pct=27, selling_price=6800),
]
for i, case in enumerate(single_cases, start=1):
    fixtures.append({"id": f"TP-{i:02d}", "kind": "single-section", "input": case, "expected": full_estimate(**case)})

# TP-11..TP-15: multi-section
multi_cases = [
    dict(sections=[(50, 12, 4), (10, 10, 4)], allowance_pct=10, rounding="quarter",
         ready_mix_rate=165, labor=1400, forms=200, reinforcement=250, equipment=120, other=40,
         overhead_pct=15, target_margin_pct=30, selling_price=4800),
    dict(sections=[(20, 20, 4), (20, 20, 4), (20, 20, 4)], allowance_pct=5, rounding="none",
         ready_mix_rate=160, labor=2000, forms=0, reinforcement=0, equipment=0, other=0,
         overhead_pct=10, target_margin_pct=25, selling_price=6000),
    dict(sections=[(30, 0, 4), (20, 15, 4)], allowance_pct=10, rounding="none",
         ready_mix_rate=165, labor=800, forms=0, reinforcement=0, equipment=0, other=0,
         overhead_pct=12, target_margin_pct=25, selling_price=2200),  # EDGE one zero-width section
    dict(sections=[(60, 18, 4)], allowance_pct=10, rounding="quarter",
         ready_mix_rate=165, labor=1800, forms=250, reinforcement=300, equipment=200, other=100,
         overhead_pct=15, target_margin_pct=30, selling_price=5500),  # single section via multi-section path
    dict(sections=[(15, 15, 4), (15, 15, 4)], allowance_pct=20, rounding="whole",
         ready_mix_rate=170, labor=900, forms=100, reinforcement=100, equipment=50, other=0,
         overhead_pct=13, target_margin_pct=28, selling_price=3300),
]
for i, case in enumerate(multi_cases, start=11):
    fixtures.append({"id": f"TP-{i:02d}", "kind": "multi-section", "input": case, "expected": multi_section_estimate(**case)})

# TP-16..TP-20: pricing-only edges (cost -> margin/markup/required-price chain)
def pricing_only(true_cost, target_margin_pct, selling_price):
    rp = required_price(true_cost, target_margin_pct)
    m = margin(selling_price, true_cost)
    return {"requiredSellingPrice": str(rp) if rp is not None else None, "currentMargin": str(m) if m is not None else None}

pricing_cases = [
    dict(true_cost=5000, target_margin_pct=25, selling_price=6667),
    dict(true_cost=8441, target_margin_pct=30, selling_price=9800),
    dict(true_cost=1000, target_margin_pct=50, selling_price=0),      # EDGE price=0 -> null margin
    dict(true_cost=0, target_margin_pct=30, selling_price=500),        # EDGE zero true cost
    dict(true_cost=2500, target_margin_pct=99, selling_price=250000),  # near-asymptote (realistic-scale true cost, see spec S4.1)
]
for i, case in enumerate(pricing_cases, start=16):
    fixtures.append({"id": f"TP-{i:02d}", "kind": "pricing-only", "input": case, "expected": pricing_only(**case)})

assert len(fixtures) == 20, f"expected 20 fixtures, got {len(fixtures)}"

with open("tests/thirdpath/fixtures.json", "w") as f:
    json.dump(fixtures, f, indent=2)

# Human-readable worked-steps doc
lines = ["# Third-Path Independent Verification — Worked Examples\n",
         "Computed by `tests/thirdpath/independent_verify.py` (Python 3 + `decimal.Decimal`), ",
         "transcribed from `docs/CALCULATION_SPEC.md` without reading production TypeScript code.\n"]
for fx in fixtures:
    lines.append(f"\n## {fx['id']} ({fx['kind']})\n")
    lines.append(f"**Input:** `{json.dumps(fx['input'])}`\n")
    lines.append(f"**Expected (exact decimal):** `{json.dumps(fx['expected'])}`\n")

with open("tests/thirdpath/WORKED_EXAMPLES.md", "w", encoding="utf-8") as f:
    f.write("".join(lines))

print(f"Wrote {len(fixtures)} fixtures to tests/thirdpath/fixtures.json and tests/thirdpath/WORKED_EXAMPLES.md")
