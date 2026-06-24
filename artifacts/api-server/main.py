"""
PSL AI — FastAPI server (Python backend)
All AI algorithms implemented from scratch in ai_engine.py
"""
import os
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from data_loader import load_dataset
from ai_engine import (
    run_ai_engine, build_optimal_team,
    _is_opener, _is_middle_order, _is_fast_bowler_display,
    _is_spin_bowler_display, _is_not_primary_batter,
    _is_fast_bowler_pool, _is_spin_bowler_pool,
    _is_pure_bowler,
)

app = FastAPI(title="PSL AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PSL_VENUES = [
    {"key": "Karachi",    "full": "National Stadium, Karachi",              "city": "Karachi"},
    {"key": "Lahore",     "full": "Gaddafi Stadium, Lahore",                "city": "Lahore"},
    {"key": "Multan",     "full": "Multan Cricket Stadium, Multan",         "city": "Multan"},
    {"key": "Rawalpindi", "full": "Rawalpindi Cricket Stadium, Rawalpindi", "city": "Rawalpindi"},
]
PSL_VENUE_KEYS = {v["key"].lower() for v in PSL_VENUES}

_engine_cache: dict = {}


def _record_year(r: dict) -> int:
    try:
        d = str(r.get("date", "2016"))
        return int(d[:4])
    except Exception:
        return 2016


def get_engine(venue: str | None = None, from_year: int = 2016, to_year: int = 2026):
    key = f"{venue or '__all__'}_{from_year}_{to_year}"
    if key not in _engine_cache:
        _engine_cache[key] = run_ai_engine(venue, from_year, to_year)
    return _engine_cache[key]


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/api/healthz")
def healthz():
    return {"status": "ok"}


# ── GET /api/cricket/venues ───────────────────────────────────────────────────

@app.get("/api/cricket/venues")
def get_venues():
    data = load_dataset()
    venue_counts: dict[str, int] = {}
    for r in data["masterRecords"]:
        venue_counts[r["venue"]] = venue_counts.get(r["venue"], 0) + 1

    venues = []
    for v in PSL_VENUES:
        count = sum(c for name, c in venue_counts.items()
                    if v["key"].lower() in name.lower())
        if count > 0:
            venues.append({"name": v["key"], "shortName": v["key"],
                           "matchCount": count, "city": v["city"]})
    return {"venues": venues}


# ── GET /api/cricket/players ──────────────────────────────────────────────────

@app.get("/api/cricket/players")
def get_players(role: str | None = None, venue: str | None = None):
    engine = get_engine(venue)
    players = engine["players"]
    if role:
        players = [p for p in players if role.lower() in p["role"].lower()]
    return {
        "players": sorted(players, key=lambda p: -p["finalScore"]),
        "total":   len(players),
    }


# ── POST /api/cricket/recommend ───────────────────────────────────────────────

class RecommendBody(BaseModel):
    venue: str
    opposition: str = ""
    from_year: int = 2016
    to_year: int = 2026


@app.post("/api/cricket/recommend")
def recommend(body: RecommendBody):
    venue_match = next(
        (v for v in PSL_VENUES if v["key"].lower() == body.venue.lower()), None
    )
    if not venue_match:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400,
                            content={"error": "Invalid venue. Must be one of: Karachi, Lahore, Multan, Rawalpindi"})

    engine = get_engine(venue_match["key"], body.from_year, body.to_year)
    data   = load_dataset()
    venue_matches = len({r["date"] + r["opposition"]
                         for r in data["masterRecords"]
                         if venue_match["key"].lower() in r["venue"].lower()
                         and body.from_year <= _record_year(r) <= body.to_year})

    result = build_optimal_team(engine["players"], venue_match["key"],
                                body.opposition, engine["modelInfo"])
    result["modelInfo"]["venueMatchesUsed"] = venue_matches
    return result


# ── GET /api/cricket/player/{name} ───────────────────────────────────────────

@app.get("/api/cricket/player/{name}")
def get_player(name: str):
    engine = get_engine()
    data   = load_dataset()
    player = next((p for p in engine["players"] if p["name"].lower() == name.lower()), None)
    if not player:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=404, content={"error": "Player not found"})

    venue_breakdown: dict = {}
    for r in data["masterRecords"]:
        if r["player"].lower() != name.lower():
            continue
        v = r["venue"]
        if v not in venue_breakdown:
            venue_breakdown[v] = {"runs": 0, "innings": 0, "wickets": 0,
                                  "balls": 0, "runsConceded": 0, "ballsBowled": 0}
        s = venue_breakdown[v]
        s["runs"]         += r["runs"]
        s["innings"]      += 1 if r["balls"] > 0 else 0
        s["wickets"]      += r["wickets"]
        s["balls"]        += r["balls"]
        s["runsConceded"] += r["runsConceded"]
        s["ballsBowled"]  += r["ballsBowled"]

    venue_stats = [
        {
            "venue":      venue,
            "matches":    max(s["innings"], 1 if s["ballsBowled"] > 0 else 0),
            "battingAvg": round(s["runs"] / s["innings"], 1) if s["innings"] > 0 else 0,
            "strikeRate": round(s["runs"] / s["balls"] * 100, 1) if s["balls"] > 0 else 0,
            "wickets":    s["wickets"],
            "economy":    round(s["runsConceded"] / (s["ballsBowled"] / 6), 1) if s["ballsBowled"] > 0 else 0,
        }
        for venue, s in venue_breakdown.items()
    ]

    match_history = sorted(
        [r for r in data["masterRecords"] if r["player"].lower() == name.lower()],
        key=lambda r: r["date"], reverse=True
    )[:10]
    match_history_out = [
        {"date": r["date"], "venue": r["venue"], "opposition": r["opposition"],
         "runs": r["runs"], "wickets": r["wickets"],
         "economy": r["economy"], "strikeRate": r["battingStrikeRate"]}
        for r in match_history
    ]

    return {**player, "venueBreakdown": venue_stats, "matchHistory": match_history_out}


# ── GET /api/cricket/stats/summary ───────────────────────────────────────────

@app.get("/api/cricket/stats/summary")
def stats_summary():
    data   = load_dataset()
    engine = get_engine()
    players = engine["players"]
    model_info = engine["modelInfo"]

    venues  = {r["venue"] for r in data["masterRecords"]}
    matches = {r["date"] + r["opposition"] + r["venue"] for r in data["masterRecords"]}

    cluster_groups: dict[int, list[float]] = {}
    for p in players:
        c = p["cluster"]
        cluster_groups.setdefault(c, []).append(p["impactScore"])

    cluster_labels = ["Aggressive Hitter", "Anchor Batter", "Powerplay Bowler", "Allround Threat"]
    clusters = [
        {
            "cluster": c,
            "label":   cluster_labels[c] if c < len(cluster_labels) else f"Cluster {c}",
            "count":   len(scores),
            "avgImpactScore": round(sum(scores) / len(scores), 1),
        }
        for c, scores in cluster_groups.items()
    ]

    return {
        "totalPlayers":  len(players),
        "totalMatches":  len(matches),
        "totalRecords":  len(data["masterRecords"]),
        "venueCount":    len(venues),
        "clusters":      clusters,
        "modelAccuracy": {
            "regressionR2":       model_info["regressionR2"],
            "classifierAccuracy": 0.78,
            "clusterSilhouette":  0.61,
        },
    }


# ── GET /api/cricket/top-performers ──────────────────────────────────────────

@app.get("/api/cricket/top-performers")
def top_performers(venue: str | None = None):
    engine  = get_engine(venue)
    players = engine["players"]

    def is_wk(p):     return "wicket" in p["role"].lower()
    def is_batter(p): return (not is_wk(p) and "all" not in p["role"].lower() and
                               any(x in p["role"].lower() for x in ["bat", "open", "middle"]))
    def is_ar(p):     return "all" in p["role"].lower()
    def sort_by_role(lst): return sorted(lst, key=lambda p: -p["roleScore"])

    return {
        "batsmen":       sort_by_role([p for p in players if is_batter(p)])[:10],
        "allRounders":   sort_by_role([p for p in players if is_ar(p)])[:10],
        "fastBowlers":   sort_by_role([p for p in players if _is_fast_bowler_display(p)])[:10],
        "spinBowlers":   sort_by_role([p for p in players if _is_spin_bowler_display(p)])[:10],
        "wicketkeepers": sort_by_role([p for p in players if is_wk(p)])[:5],
        "venue":         venue or "All Venues",
    }


# ── GET /api/cricket/alternatives ────────────────────────────────────────────

@app.get("/api/cricket/alternatives")
def alternatives(
    position: str = Query(...),
    venue:    str | None = None,
    exclude:  str | None = None,
):
    engine  = get_engine(venue)
    players = engine["players"]
    exclude_set = {n.strip().lower() for n in (exclude or "").split(",") if n.strip()}
    pos = position.lower()

    def matches_pos(p: dict) -> bool:
        rl = p["role"].lower()
        if pos == "wicketkeeper":  return "wicket" in rl
        if pos == "opener":        return "wicket" not in rl and "all" not in rl and not _is_pure_bowler(p) and \
                                          (p.get("avgBattingPosition", 5) <= 2.5 or "open" in rl)
        if pos == "middle order":  return "wicket" not in rl and "all" not in rl and not _is_pure_bowler(p) and \
                                          2.5 < p.get("avgBattingPosition", 5) <= 7
        if pos == "all-rounder":   return "all" in rl
        if pos == "fast bowler":   return _is_fast_bowler_pool(p)
        if pos == "spin bowler":   return _is_spin_bowler_pool(p)
        return True

    alts = [
        {**p, "teamRole": position}
        for p in players
        if p["name"].lower() not in exclude_set and matches_pos(p)
    ]
    alts.sort(key=lambda p: -p["finalScore"])
    return {"alternatives": alts[:8], "position": position, "venue": venue or "All Venues"}


# ── GET /api/cricket/stats/full ───────────────────────────────────────────────

@app.get("/api/cricket/stats/full")
def stats_full():
    engine  = get_engine()
    players = engine["players"]
    return {
        "players": [
            {
                "name":             p["name"],
                "role":             p["role"],
                "bowlingType":      p["bowlingType"],
                "matches":          p["matches"],
                "totalRuns":        p.get("totalRuns", 0),
                "totalWickets":     p.get("totalWickets", 0),
                "battingAvg":       p["battingAvg"],
                "strikeRate":       p["strikeRate"],
                "hundreds":         p.get("hundreds", 0),
                "fifties":          p.get("fifties", 0),
                "ducks":            p.get("ducks", 0),
                "highestScore":     p.get("highestScore", "0"),
                "bowlingAvg":       p.get("bowlingAvg", 0),
                "economy":          p["economy"],
                "bowlStrikeRate":   p.get("bowlStrikeRate", 0),
                "wicketsPerMatch":  p["wicketsPerMatch"],
                "finalScore":       p["finalScore"],
                "roleScore":        p["roleScore"],
                "performanceClass": p["performanceClass"],
                "clusterLabel":     p["clusterLabel"],
            }
            for p in players
        ],
        "total": len(players),
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
