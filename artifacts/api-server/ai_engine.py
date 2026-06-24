"""
AI Engine — 5 algorithms implemented FROM SCRATCH in pure Python (no ML libraries):
  1. Linear Regression   (gradient descent, 1 000 epochs)
  2. K-Means Clustering  (k=4, k-means++ initialisation)
  3. Naive Bayes         (separate batter + bowler models, Laplace smoothing)
  4. Decision Tree CART  (Gini impurity, max depth 6)
  5. Genetic Algorithm   (team optimizer, pop=40, gen=80, elitism, tournament)
"""

import math
import random
from data_loader import load_dataset

# ── Config ────────────────────────────────────────────────────────────────────

BLACKLISTED = {"Bilawal Bhatti", "Nahid Rana", "Amad Butt", "Mohammad Imran (1)"}
MIN_MATCHES = 5

VENUE_COMPOSITION = {
    "karachi":    {"openers": 2, "middleOrder": 1, "allRounders": 3, "fastBowlers": 2, "spinBowlers": 2},
    "lahore":     {"openers": 2, "middleOrder": 2, "allRounders": 2, "fastBowlers": 3, "spinBowlers": 1},
    "multan":     {"openers": 2, "middleOrder": 2, "allRounders": 2, "fastBowlers": 3, "spinBowlers": 1},
    "rawalpindi": {"openers": 2, "middleOrder": 2, "allRounders": 2, "fastBowlers": 4, "spinBowlers": 0},
}
PSL_VENUES = list(VENUE_COMPOSITION.keys())

# ── 1. LINEAR REGRESSION (gradient descent, from scratch) ─────────────────────

def _normalise(values: list[float]) -> list[float]:
    lo, hi = min(values), max(values)
    r = hi - lo or 1.0
    return [(v - lo) / r for v in values]


def _lr_predict(X: list[list[float]], w: list[float], b: float) -> list[float]:
    return [sum(x * wi for x, wi in zip(row, w)) + b for row in X]


def _lr_train(X: list[list[float]], y: list[float], lr: float = 0.05, epochs: int = 1000):
    m, n = len(X), len(X[0])
    w = [0.0] * n
    b = 0.0
    for _ in range(epochs):
        pred = _lr_predict(X, w, b)
        err = [p - yi for p, yi in zip(pred, y)]
        for j in range(n):
            grad = sum(e * X[i][j] for i, e in enumerate(err)) / m
            w[j] -= lr * grad
        b -= lr * sum(err) / m
    # R² score
    y_mean = sum(y) / m
    ss_tot = sum((yi - y_mean) ** 2 for yi in y) or 1.0
    pred = _lr_predict(X, w, b)
    ss_res = sum((p - yi) ** 2 for p, yi in zip(pred, y))
    r2 = 1.0 - ss_res / ss_tot
    return w, b, r2


# ── 2. K-MEANS CLUSTERING (k-means++, from scratch) ───────────────────────────

def _dist(a: list[float], b: list[float]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def _kmeans(X: list[list[float]], k: int = 4, max_iter: int = 100):
    m, n = len(X), len(X[0])
    # k-means++ init: pick seed farthest from mean, then farthest from existing centroids
    mean = [sum(X[i][j] for i in range(m)) / m for j in range(n)]
    first = max(range(m), key=lambda i: _dist(X[i], mean))
    centroids = [X[first][:]]
    used = {first}
    for _ in range(1, k):
        best_i, best_d = 0, -1.0
        for i in range(m):
            if i in used:
                continue
            d = min(_dist(X[i], c) for c in centroids)
            if d > best_d:
                best_d, best_i = d, i
        centroids.append(X[best_i][:])
        used.add(best_i)

    assignments = [0] * m
    for _ in range(max_iter):
        new_assign = []
        for pt in X:
            dists = [_dist(pt, c) for c in centroids]
            new_assign.append(dists.index(min(dists)))
        if new_assign == assignments:
            break
        assignments = new_assign
        for c in range(k):
            members = [X[i] for i in range(m) if assignments[i] == c]
            if not members:
                continue
            centroids[c] = [sum(row[j] for row in members) / len(members) for j in range(n)]
    return assignments, centroids


# ── 3. NAIVE BAYES (separate batter/bowler models, Laplace smoothing) ─────────

def _train_nb(records: list[dict]) -> dict:
    total = len(records) or 1
    good  = [r for r in records if r["isGood"]]
    avg   = [r for r in records if not r["isGood"] and not r["isPoor"]]
    poor  = [r for r in records if r["isPoor"]]
    venues = list({r["venue"] for r in records})
    S = 1  # Laplace smoothing factor

    def cond_probs(subset):
        n = len(subset)
        return {v: (sum(1 for r in subset if r["venue"] == v) + S) / (n + len(venues) * S)
                for v in venues}

    metrics = sorted(r["perfMetric"] for r in records if r["perfMetric"] > 0)
    n_m = len(metrics)
    thresh_good = metrics[int(n_m * 0.67)] if n_m else 20.0
    thresh_poor = metrics[int(n_m * 0.33)] if n_m else 5.0

    return {
        "priorGood": len(good) / total,
        "priorAvg":  len(avg)  / total,
        "priorPoor": len(poor) / total,
        "condGood":  cond_probs(good),
        "condAvg":   cond_probs(avg),
        "condPoor":  cond_probs(poor),
        "threshGood": thresh_good,
        "threshPoor": thresh_poor,
        "venues": venues,
    }


def _train_batter_nb(master_records: list[dict]) -> dict:
    return _train_nb([
        {"venue": r["venue"], "perfMetric": r["runs"],
         "isGood": r["runs"] >= 30, "isPoor": r["runs"] < 10}
        for r in master_records
    ])


def _train_bowler_nb(master_records: list[dict]) -> dict:
    bowl = [r for r in master_records if r["ballsBowled"] > 0]
    return _train_nb([
        {"venue": r["venue"], "perfMetric": r["wickets"],
         "isGood": r["wickets"] >= 2 or (r["wickets"] >= 1 and r["economy"] <= 7),
         "isPoor": r["wickets"] == 0 and r["economy"] > 9}
        for r in bowl
    ])


def _nb_predict(model: dict, venue: str, form_val: float) -> float:
    tg, tp = model["threshGood"], model["threshPoor"]
    f_good = 0.7 if form_val >= tg else (0.4 if form_val >= tp else 0.2)
    f_avg  = 0.2 if form_val >= tg else (0.4 if form_val >= tp else 0.3)
    vg = model["condGood"].get(venue, 0.05)
    va = model["condAvg"].get(venue,  0.05)
    vp = model["condPoor"].get(venue, 0.05)
    sg = model["priorGood"] * vg * f_good
    sa = model["priorAvg"]  * va * f_avg
    sp = model["priorPoor"] * vp * (1 - f_good - f_avg + 0.1)
    return sg / (sg + sa + sp or 1.0)


# ── 4. DECISION TREE — CART (Gini impurity, from scratch) ─────────────────────

def _gini(labels: list[str]) -> float:
    total = len(labels) or 1
    counts: dict[str, int] = {}
    for l in labels:
        counts[l] = counts.get(l, 0) + 1
    return 1.0 - sum((c / total) ** 2 for c in counts.values())


def _majority(labels: list[str]) -> str:
    counts: dict[str, int] = {}
    for l in labels:
        counts[l] = counts.get(l, 0) + 1
    return max(counts, key=counts.get) if counts else "Average"


def _build_tree(X: list[list[float]], y: list[str], depth: int = 0, max_depth: int = 6):
    if not y:
        return {"label": "Average"}
    if len(set(y)) == 1 or depth >= max_depth or len(y) < 3:
        return {"label": _majority(y)}

    n_feat = len(X[0]) if X else 0
    best_gini, best_feat, best_thresh = float("inf"), -1, 0.0

    for f in range(n_feat):
        vals = sorted(set(row[f] for row in X))
        for ti in range(len(vals) - 1):
            thresh = (vals[ti] + vals[ti + 1]) / 2
            left_y  = [y[i] for i in range(len(y)) if X[i][f] <= thresh]
            right_y = [y[i] for i in range(len(y)) if X[i][f] > thresh]
            if not left_y or not right_y:
                continue
            g = (len(left_y) * _gini(left_y) + len(right_y) * _gini(right_y)) / len(y)
            if g < best_gini:
                best_gini, best_feat, best_thresh = g, f, thresh

    if best_feat == -1:
        return {"label": _majority(y)}

    left_idx  = [i for i in range(len(y)) if X[i][best_feat] <= best_thresh]
    right_idx = [i for i in range(len(y)) if X[i][best_feat] > best_thresh]
    return {
        "feature": best_feat, "threshold": best_thresh,
        "left":  _build_tree([X[i] for i in left_idx],  [y[i] for i in left_idx],  depth + 1, max_depth),
        "right": _build_tree([X[i] for i in right_idx], [y[i] for i in right_idx], depth + 1, max_depth),
    }


def _dt_predict(node: dict, x: list[float]) -> str:
    if "label" in node:
        return node["label"]
    if x[node["feature"]] <= node["threshold"]:
        return _dt_predict(node["left"], x)
    return _dt_predict(node["right"], x)


# ── 5. GENETIC ALGORITHM — Team Optimizer (from scratch) ──────────────────────

def _ga_optimize(players: list[dict], comp: dict, pop_size: int = 40, generations: int = 80) -> list[int]:
    n = len(players)
    all_idx = list(range(n))

    def pool(fn) -> list[int]:
        return [i for i, p in enumerate(players) if fn(p)] or all_idx

    wk_pool = pool(lambda p: "wicket" in p["role"].lower())
    op_pool = pool(lambda p: _is_opener(p))
    mo_pool = pool(lambda p: _is_middle_order(p))
    ar_pool = pool(lambda p: "all" in p["role"].lower())
    fb_pool = pool(lambda p: _is_fast_bowler_pool(p))
    sb_pool = pool(lambda p: _is_spin_bowler_pool(p))

    pools: list[list[int]] = (
        [wk_pool]
        + [op_pool] * comp["openers"]
        + [mo_pool] * comp["middleOrder"]
        + [ar_pool] * comp["allRounders"]
        + [fb_pool] * comp["fastBowlers"]
        + [sb_pool] * comp["spinBowlers"]
    )
    n_slots = len(pools)

    def fitness(slots: list[int]) -> float:
        if len(set(slots)) < n_slots:
            return -9999.0
        return sum(players[i]["finalScore"] for i in slots)

    def random_chrom() -> list[int]:
        used: set[int] = set()
        chrom = []
        for p in pools:
            avail = [i for i in p if i not in used]
            if not avail:
                avail = [i for i in all_idx if i not in used]
            idx = random.choice(avail) if avail else 0
            used.add(idx)
            chrom.append(idx)
        return chrom

    def fix_chrom(slots: list[int]) -> list[int]:
        seen: set[int] = set()
        out = list(slots)
        for s in range(n_slots):
            if out[s] not in seen:
                seen.add(out[s])
                continue
            avail = [i for i in pools[s] if i not in seen] or \
                    [i for i in all_idx if i not in seen]
            replacement = random.choice(avail) if avail else out[s]
            out[s] = replacement
            seen.add(replacement)
        return out

    pop = [{"slots": random_chrom(), "fit": 0.0} for _ in range(pop_size)]
    for ind in pop:
        ind["fit"] = fitness(ind["slots"])

    MUTATION_RATE = 0.15
    for _ in range(generations):
        pop.sort(key=lambda x: -x["fit"])
        next_pop = pop[:2]  # elitism: keep top 2

        while len(next_pop) < pop_size:
            # Tournament selection from top 8
            top = pop[:min(8, len(pop))]
            p1 = random.choice(top)["slots"]
            p2 = random.choice(top)["slots"]
            pt = random.randint(1, n_slots - 1)
            child = fix_chrom(p1[:pt] + p2[pt:])
            # Mutation
            if random.random() < MUTATION_RATE:
                s = random.randint(0, n_slots - 1)
                others = set(child[:s] + child[s + 1:])
                avail = [i for i in pools[s] if i not in others]
                if avail:
                    child[s] = random.choice(avail)
            next_pop.append({"slots": child, "fit": fitness(child)})

        pop = next_pop

    pop.sort(key=lambda x: -x["fit"])
    return pop[0]["slots"]


# ── Role classifiers (strict — primary role takes precedence) ─────────────────

def _is_not_primary_batter(p: dict) -> bool:
    """True if the player is NOT primarily a batter/opener/middle-order/WK.
    Batters who bowl part-time have bowlingType set but must NOT fill bowling slots."""
    rl = p["role"].lower()
    return not any(x in rl for x in ["bat", "open", "middle", "finisher", "wicket"])


def _is_fast_bowler_pool(p: dict) -> bool:
    rl = p["role"].lower()
    if any(x in rl for x in ["wicket", "all"]):
        return False
    # KEY FIX: primary batters (even part-time fast bowlers) must NOT enter this pool
    if not _is_not_primary_batter(p):
        return False
    bt = p["bowlingType"].lower()
    return (any(x in bt for x in ["fast", "medium", "pace"]) or
            any(x in rl for x in ["fast", "medium", "pace", "bowl"]))


def _is_spin_bowler_pool(p: dict) -> bool:
    rl = p["role"].lower()
    if any(x in rl for x in ["wicket", "all"]):
        return False
    # KEY FIX: primary batters (even part-time spinners like Babar Azam) must NOT enter this pool
    if not _is_not_primary_batter(p):
        return False
    bt = p["bowlingType"].lower()
    return (any(x in bt for x in ["spin", "off", "leg", "slow"]) or
            any(x in rl for x in ["spin", "off break", "leg break"]))


def _is_opener(p: dict) -> bool:
    rl = p["role"].lower()
    return ("wicket" not in rl and "all" not in rl and not _is_pure_bowler(p) and
            (p.get("avgBattingPosition", 5) <= 2.5 or "open" in rl))


def _is_middle_order(p: dict) -> bool:
    rl = p["role"].lower()
    return ("wicket" not in rl and "all" not in rl and not _is_pure_bowler(p) and
            not _is_opener(p) and
            ("bat" in rl or "middle" in rl or "finisher" in rl or
             2.5 < p.get("avgBattingPosition", 5) <= 7))


def _is_pure_bowler(p: dict) -> bool:
    """Used only to EXCLUDE pure bowlers from batting slots."""
    rl = p["role"].lower()
    bt = p["bowlingType"].lower()
    return (any(x in rl for x in ["fast", "pace", "spin", "bowl", "medium"]) and
            not any(x in rl for x in ["all", "bat", "wicket", "open", "middle"]) and
            bool(bt))


def _is_fast_bowler_display(p: dict) -> bool:
    """For top-performers / player display — identifies specialist fast bowlers."""
    rl, bt = p["role"].lower(), p["bowlingType"].lower()
    return ("wicket" not in rl and "all" not in rl and
            _is_not_primary_batter(p) and
            (any(x in bt for x in ["fast", "medium", "pace"]) or
             any(x in rl for x in ["fast", "medium", "pace"])))


def _is_spin_bowler_display(p: dict) -> bool:
    """For top-performers / player display — identifies specialist spinners."""
    rl, bt = p["role"].lower(), p["bowlingType"].lower()
    return ("wicket" not in rl and "all" not in rl and
            _is_not_primary_batter(p) and
            (any(x in bt for x in ["spin", "off", "leg", "slow"]) or
             any(x in rl for x in ["spin", "off break", "leg break"])))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _norm_to_100(values: list[float]) -> list[float]:
    lo, hi = min(values), max(values)
    r = hi - lo or 1.0
    return [((v - lo) / r) * 100 for v in values]


def _recent_form(master_records: list[dict], player_name: str, is_batter: bool) -> float:
    recs = sorted(
        [r for r in master_records if r["player"] == player_name],
        key=lambda r: r["date"], reverse=True
    )[:5]
    if not recs:
        return 0.0
    if is_batter:
        return sum(r["runs"] for r in recs) / len(recs)
    bowl = [r for r in recs if r["ballsBowled"] > 0]
    return sum(r["wickets"] for r in bowl) / len(bowl) if bowl else 0.0


def _avg_batting_position(master_records: list[dict], player_name: str) -> float:
    positions = [r["battingPosition"] for r in master_records
                 if r["player"] == player_name and r["battingPosition"] > 0 and r["balls"] > 0]
    return sum(positions) / len(positions) if positions else 5.0


def _map_venue_key(venue: str) -> str:
    l = venue.lower()
    if "karachi"    in l: return "Karachi"
    if "multan"     in l: return "Multan"
    if "lahore"     in l: return "Lahore"
    if "rawalpindi" in l: return "Rawalpindi"
    return venue


def _get_cluster_label(cluster: int, centroids: list[list[float]], feature_names: list[str]) -> str:
    sr_idx  = feature_names.index("strikeRate")  if "strikeRate"      in feature_names else 1
    wpm_idx = feature_names.index("wicketsPerMatch") if "wicketsPerMatch" in feature_names else 3
    c = centroids[cluster]
    sr  = c[sr_idx]  if sr_idx  < len(c) else 0.0
    wpm = c[wpm_idx] if wpm_idx < len(c) else 0.0
    if wpm > 0.6 and sr < 0.4:  return "Powerplay Bowler"
    if sr  > 0.6 and wpm < 0.3: return "Aggressive Hitter"
    if wpm > 0.4 and sr  > 0.4: return "Allround Threat"
    return "Anchor Batter"


def _build_reason(p: dict, venue: str, team_role: str) -> str:
    is_bowler_slot = team_role in ("Fast Bowler", "Spin Bowler")
    parts = []
    if is_bowler_slot:
        if p.get("venueBowlingAvg", 0) > 0 and p["venueBowlingAvg"] < 35:
            parts.append(f"Bowl avg {p['venueBowlingAvg']:.1f} at {venue}")
        if p.get("venueBowlingSR", 0) > 0 and p["venueBowlingSR"] < 20:
            parts.append(f"Bowl SR {p['venueBowlingSR']:.1f} at {venue}")
        if p.get("venueEconomy", 0) > 0 and p["venueEconomy"] < 8:
            parts.append(f"Eco {p['venueEconomy']:.1f} at {venue}")
        if p.get("venueWickets", 0) > 1:
            parts.append(f"{p['venueWickets']:.1f} wkts/match at {venue}")
        if p.get("wicketsPerMatch", 0) > 1.2:
            parts.append(f"{p['wicketsPerMatch']:.1f} wkts/game overall")
        if p.get("economy", 0) > 0 and p["economy"] < 7.5 and p.get("wicketsPerMatch", 0) > 0.5:
            parts.append(f"{p['economy']:.1f} career eco")
    else:
        if p.get("venueBattingAvg", 0) > 25:
            parts.append(f"Avg {p['venueBattingAvg']:.0f} at {venue}")
        if p.get("venueStrikeRate", 0) > 130:
            parts.append(f"SR {p['venueStrikeRate']:.0f} at {venue}")
        if p.get("battingAvg", 0) > 30:
            parts.append(f"{p['battingAvg']:.1f} career avg")
        if p.get("strikeRate", 0) > 135:
            parts.append(f"{p['strikeRate']:.0f} career SR")
        if team_role == "All-Rounder" and p.get("wicketsPerMatch", 0) > 0.5:
            parts.append(f"{p['wicketsPerMatch']:.1f} wkts/game")
    if p.get("finalScore", 0) >= 60:
        parts.append(f"AI score {p['finalScore']:.1f}")
    if not parts:
        parts.append(f"Strong {team_role} — AI rated {p.get('finalScore', 0):.1f}")
    return " · ".join(parts)


def _compute_role_scores(players: list[dict], is_bowler_flags: list[bool]) -> list[float]:
    raw = []
    for p, is_b in zip(players, is_bowler_flags):
        is_ar = "all" in p["role"].lower()
        bat_raw = (p.get("battingAvg", 0) * 0.45 +
                   p.get("strikeRate", 0) * 0.35 +
                   p.get("recentForm", 0) * 0.20)
        eco_score = max(0.0, 12 - p.get("economy", 0)) if p.get("economy", 0) > 0 else 0.0
        bowl_raw = (p.get("wicketsPerMatch", 0) * 30 +
                    eco_score * 4 +
                    p.get("recentBowlingForm", 0) * 8)
        if is_ar:
            raw.append(bat_raw * 0.5 + bowl_raw * 0.5)
        elif is_b:
            raw.append(bowl_raw)
        else:
            raw.append(bat_raw)
    return _norm_to_100(raw) if raw else []


# ── Main engine ───────────────────────────────────────────────────────────────

_engine_cache: dict = {}


def _parse_year(date_str: str) -> int:
    try:
        return int(str(date_str)[:4])
    except Exception:
        return 2016


def _parse_span(span_str: str) -> tuple[int, int]:
    """Parse '2016-2022' into (2016, 2022). Returns (2016, 2026) if unparseable."""
    try:
        parts = str(span_str).strip().split("-")
        if len(parts) == 2:
            return int(parts[0]), int(parts[1])
    except Exception:
        pass
    return 2016, 2026


def run_ai_engine(venue_filter: str | None = None, from_year: int = 2016, to_year: int = 2026) -> dict:
    key = f"{venue_filter or '__all__'}_{from_year}_{to_year}"
    if key in _engine_cache:
        return _engine_cache[key]

    data = load_dataset()
    # Filter master records by era (from_year onwards)
    all_records = data["masterRecords"]
    master_records = [
        r for r in all_records
        if from_year <= _parse_year(r.get("date", "")) <= to_year
    ]
    player_roles   = data["playerRoles"]
    ground_bowling = data["groundBowling"]
    ground_batting = data["groundBatting"]
    all_rounders   = data["allRounders"]
    wicketkeepers  = data["wicketkeepers"]
    bowlers        = data["bowlers"]

    # Build player map — only include players whose span overlaps the selected year range
    player_map: dict[str, dict] = {}
    for pr in player_roles:
        name = pr["player"]
        if not name:
            continue
        span_start, span_end = _parse_span(pr.get("span", ""))
        # Overlap check: player span must intersect [from_year, to_year]
        if span_start > to_year or span_end < from_year:
            continue
        rl = pr["role"].lower()
        is_batter = "bat" in rl or "wicket" in rl
        recent_form = _recent_form(master_records, name, is_batter)
        recent_bowl_form = _recent_form(master_records, name, False)
        avg_bat_pos = _avg_batting_position(master_records, name)
        total_balls = pr["ballsFaced"] or 1
        boundary_rate = (pr["fours"] * 4 + pr["sixes"] * 6) / total_balls
        bat_matches = pr["batMatches"] or 1
        player_map[name] = {
            "name":              name,
            "role":              pr["role"],
            "bowlingType":       "",
            "battingAvg":        pr["batAverage"],
            "strikeRate":        pr["batStrikeRate"],
            "recentForm":        recent_form,
            "boundaryRate":      boundary_rate,
            "wicketsPerMatch":   pr["wickets"] / bat_matches if bat_matches > 0 else 0.0,
            "economy":           pr["economyRate"],
            "recentBowlingForm": recent_bowl_form,
            "matches":           max(pr["batMatches"], pr["bowlMatches"]),
            "avgBattingPosition":avg_bat_pos,
            "venueBattingAvg":   0.0,
            "venueStrikeRate":   0.0,
            "venueWickets":      0.0,
            "venueEconomy":      0.0,
            "venueBowlingAvg":   0.0,
            "venueBowlingSR":    0.0,
            # Extra fields for full stats
            "totalRuns":     int(pr["runs"]),
            "totalWickets":  int(pr["wickets"]),
            "hundreds":      int(pr["hundreds"]),
            "fifties":       int(pr["fifties"]),
            "ducks":         int(pr["ducks"]),
            "highestScore":  pr["highestScore"],
            "bowlingAvg":    pr["bowlAverage"],
            "bowlStrikeRate":pr["bowlStrikeRate"],
        }

    # Enrich from bowlers dataset
    bowler_names: set[str] = set()
    for b in bowlers:
        p = player_map.get(b["player"])
        if p:
            p["bowlingType"] = b["bowlerType"]
            bowler_names.add(b["player"])
            if b["wickets"] > 0:
                p["economy"] = b["economy"]
                p["wicketsPerMatch"] = b["wickets"] / b["matches"] if b["matches"] > 0 else 0.0

    # WK override
    for wk in wicketkeepers:
        p = player_map.get(wk["player"])
        if p and "wicket" not in p["role"].lower():
            p["role"] = "Wicketkeeper Batter"

    # AR override
    for ar in all_rounders:
        p = player_map.get(ar["player"])
        if p:
            if "all" not in p["role"].lower():
                p["role"] = "All-Rounder"
            if ar["wickets"] > 0 and ar["matches"] > 0:
                ar_wpm = ar["wickets"] / ar["matches"]
                if ar_wpm > p["wicketsPerMatch"]:
                    p["wicketsPerMatch"] = ar_wpm
                    p["economy"] = ar["bowlEco"]

    # Fill bowlingType from master records

    # ── Data corrections ──────────────────────────────────────────────────────
    # Ali Raza is a fast bowler, not a spinner — correct the role
    for name, p in player_map.items():
        if "ali raza" in name.lower():
            p["role"] = "Fast Bowler"
    # Remove Sandeep Lamichhane — not a Pakistani player
    player_map = {k: v for k, v in player_map.items() if "lamichhane" not in k.lower()}

    for r in master_records:
        p = player_map.get(r["player"])
        if p and not p["bowlingType"] and r["bowlingType"]:
            p["bowlingType"] = r["bowlingType"]

    # Venue stats
    if venue_filter:
        venue_key = _map_venue_key(venue_filter)
        bat_recs = ground_batting.get(venue_key, [])
        for rec in bat_recs:
            p = player_map.get(rec["player"])
            if p and rec["innings"] >= 2:
                p["venueBattingAvg"] = rec["average"]
                p["venueStrikeRate"] = rec["strikeRate"]

        vk_lower = venue_key.lower()
        for rec in ground_bowling:
            gl = rec["ground"].lower()
            if vk_lower in gl or gl.split(",")[0].strip() in vk_lower:
                p = player_map.get(rec["player"])
                if p and rec["matches"] >= 2:
                    p["venueWickets"]    = rec["wickets"] / rec["matches"] if rec["matches"] > 0 else 0.0
                    p["venueEconomy"]    = rec["economy"]
                    p["venueBowlingAvg"] = rec["average"]
                    p["venueBowlingSR"]  = rec["strikeRate"]

    # Filter
    players = [p for p in player_map.values()
               if p["matches"] >= MIN_MATCHES and p["name"] not in BLACKLISTED]

    # ── LINEAR REGRESSION ─────────────────────────────────────────────────────
    feature_names = ["battingAvg", "strikeRate", "recentForm", "wicketsPerMatch", "economyInv", "boundaryRate"]
    raw_feats = [
        [p["battingAvg"], p["strikeRate"], p["recentForm"], p["wicketsPerMatch"],
         1 / p["economy"] if p["economy"] > 0 else 0.0, p["boundaryRate"]]
        for p in players
    ]
    # Column-wise normalisation
    n_feat = len(raw_feats[0])
    norm_cols = [_normalise([row[j] for row in raw_feats]) for j in range(n_feat)]
    X = [[norm_cols[j][i] for j in range(n_feat)] for i in range(len(players))]

    raw_targets = []
    for p in players:
        rl = p["role"].lower()
        bat_s  = p["battingAvg"] * 0.4 + p["strikeRate"] * 0.3 + p["recentForm"] * 0.3
        bowl_s = p["wicketsPerMatch"] * 30 + ((12 - p["economy"]) * 2 if p["economy"] > 0 else 0)
        is_ar  = "all" in rl
        is_bowler_r = (not any(x in rl for x in ["bat", "wicket", "all", "open", "middle"]) and
                       any(x in rl for x in ["bowl", "fast", "pace", "spin"]) or
                       any(x in p["bowlingType"].lower() for x in ["fast", "medium"]))
        if is_ar:
            raw_targets.append((bat_s + bowl_s) / 2)
        elif is_bowler_r:
            raw_targets.append(bat_s * 0.25 + bowl_s * 0.75)
        else:
            raw_targets.append(bat_s * 0.85 + bowl_s * 0.15)

    lr_w, lr_b, r2 = _lr_train(X, raw_targets, lr=0.05, epochs=1000)
    raw_preds = _lr_predict(X, lr_w, lr_b)
    impact_scores = _norm_to_100(raw_preds)

    # ── K-MEANS ──────────────────────────────────────────────────────────────
    K = 4
    assignments, centroids = _kmeans(X, K)

    # ── NAIVE BAYES ───────────────────────────────────────────────────────────
    batter_nb = _train_batter_nb(master_records)
    bowler_nb = _train_bowler_nb(master_records)
    psl_venues = list({r["venue"] for r in master_records})
    if venue_filter:
        venue_for_nb = next((v for v in psl_venues if venue_filter.lower() in v.lower()), psl_venues[0] if psl_venues else "")
    else:
        venue_for_nb = psl_venues[0] if psl_venues else ""

    # ── Venue scores ──────────────────────────────────────────────────────────
    is_bowler_flags = []
    for p in players:
        rl = p["role"].lower()
        is_bowler_flags.append(
            not any(x in rl for x in ["bat", "wicket", "all", "open", "middle"]) and
            (any(x in rl for x in ["bowl", "fast", "pace", "spin"]) or
             any(x in p["bowlingType"].lower() for x in ["fast", "medium"]))
        )

    raw_venue_scores = []
    for i, p in enumerate(players):
        if is_bowler_flags[i]:
            if p["venueWickets"] > 0 or p["venueEconomy"] > 0:
                raw_venue_scores.append(
                    p["venueWickets"] * 25 + max(0, (10 - p["venueEconomy"]) * 4)
                )
            else:
                raw_venue_scores.append(-1.0)
        else:
            if p["venueBattingAvg"] > 0 or p["venueStrikeRate"] > 0:
                raw_venue_scores.append(p["venueBattingAvg"] * 0.6 + p["venueStrikeRate"] * 0.15)
            else:
                raw_venue_scores.append(-1.0)

    with_venue_idx = [i for i, v in enumerate(raw_venue_scores) if v >= 0]
    venue_scores_norm = [0.0] * len(players)
    if len(with_venue_idx) > 1:
        sub = [raw_venue_scores[i] for i in with_venue_idx]
        normed = _norm_to_100(sub)
        for sub_idx, player_idx in enumerate(with_venue_idx):
            venue_scores_norm[player_idx] = normed[sub_idx]

    # ── Final scoring ─────────────────────────────────────────────────────────
    W = {"impactScore": 0.45, "bayesianScore": 0.25, "venueScore": 0.30}
    scored = []
    for i, p in enumerate(players):
        rl = p["role"].lower()
        is_bowler_r = is_bowler_flags[i]
        form_for_nb = p["recentBowlingForm"] if is_bowler_r else p["recentForm"]
        nb_model = bowler_nb if is_bowler_r else batter_nb
        bayesian = _nb_predict(nb_model, venue_for_nb, form_for_nb) * 100
        venue_s  = venue_scores_norm[i]
        has_venue = raw_venue_scores[i] >= 0

        if has_venue and venue_filter and venue_filter.lower() in PSL_VENUES:
            final = W["venueScore"] * venue_s + W["impactScore"] * impact_scores[i] + W["bayesianScore"] * bayesian
        else:
            final = (W["impactScore"] + W["venueScore"] * 0.5) * impact_scores[i] + \
                    (W["bayesianScore"] + W["venueScore"] * 0.5) * bayesian

        scored.append({
            **p,
            "impactScore":    round(impact_scores[i], 1),
            "bayesianScore":  round(bayesian, 1),
            "finalScore":     round(final, 1),
            "venueScore":     round(venue_s, 1),
            "roleScore":      0.0,
            "cluster":        assignments[i],
            "clusterLabel":   _get_cluster_label(assignments[i], centroids, feature_names),
            "performanceClass": "",
        })

    # ── Role scores ───────────────────────────────────────────────────────────
    role_scores = _compute_role_scores(players, is_bowler_flags)
    for i, p in enumerate(scored):
        p["roleScore"] = round(role_scores[i], 1)

    # ── Decision Tree: performance tier ───────────────────────────────────────
    final_scores = [p["finalScore"] for p in scored]
    fs_sorted = sorted(final_scores)
    n_p = len(fs_sorted)
    p80 = fs_sorted[int(n_p * 0.80)]
    p50 = fs_sorted[int(n_p * 0.50)]
    p20 = fs_sorted[int(n_p * 0.20)]
    train_labels = [
        "Great" if p["finalScore"] >= p80 else
        "Good"  if p["finalScore"] >= p50 else
        "Average" if p["finalScore"] >= p20 else "Poor"
        for p in scored
    ]
    dt_tree = _build_tree(X, train_labels, depth=0, max_depth=6)
    for i, p in enumerate(scored):
        p["performanceClass"] = _dt_predict(dt_tree, X[i])

    result = {
        "players": scored,
        "modelInfo": {
            "regressionR2":        round(r2, 3),
            "clusterCount":        K,
            "totalPlayersAnalyzed":len(scored),
            "weights":             W,
        },
    }
    _engine_cache[key] = result
    return result


def build_optimal_team(scored_players: list[dict], venue: str, opposition: str, model_info: dict) -> dict:
    venue_key = venue.lower().strip()
    comp = VENUE_COMPOSITION.get(venue_key, VENUE_COMPOSITION["karachi"])

    role_labels = (
        ["Wicketkeeper"]
        + ["Opener"]       * comp["openers"]
        + ["Middle Order"] * comp["middleOrder"]
        + ["All-Rounder"]  * comp["allRounders"]
        + ["Fast Bowler"]  * comp["fastBowlers"]
        + (["Spin Bowler"] * comp["spinBowlers"] if comp["spinBowlers"] > 0 else [])
    )

    selected_idxs = _ga_optimize(scored_players, comp)
    selected = []
    for slot_idx, player_idx in enumerate(selected_idxs):
        p = dict(scored_players[player_idx])
        team_role = role_labels[slot_idx] if slot_idx < len(role_labels) else "Middle Order"
        p["teamRole"] = team_role
        p["selectionReason"] = _build_reason(p, venue, team_role)
        selected.append(p)

    balance = {
        "batsmen":      sum(1 for p in selected if p["teamRole"] in ("Wicketkeeper", "Opener", "Middle Order")),
        "allRounders":  sum(1 for p in selected if p["teamRole"] == "All-Rounder"),
        "fastBowlers":  sum(1 for p in selected if p["teamRole"] == "Fast Bowler"),
        "spinBowlers":  sum(1 for p in selected if p["teamRole"] == "Spin Bowler"),
        "wicketkeeper": sum(1 for p in selected if p["teamRole"] == "Wicketkeeper"),
    }

    return {
        "team":        selected,
        "venue":       venue,
        "opposition":  opposition,
        "teamBalance": balance,
        "modelInfo":   {**model_info, "venueMatchesUsed": 0},
    }
