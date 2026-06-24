"""
Data loader — reads all PSL Excel files from attached_assets/.
Uses pandas + openpyxl; no AI logic here.
"""
import os
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "attached_assets")

_cached: dict | None = None


def _p(fname: str) -> str:
    return os.path.join(DATA_DIR, fname)


def _to_num(v) -> float:
    if v is None or (isinstance(v, float) and str(v) == "nan"):
        return 0.0
    try:
        return float(str(v).strip().replace("-", "0") or "0")
    except Exception:
        return 0.0


def _to_str(v) -> str:
    if v is None or (isinstance(v, float) and str(v) == "nan"):
        return ""
    return str(v).strip()


def load_dataset() -> dict:
    global _cached
    if _cached is not None:
        return _cached

    # ── Master Dataset ────────────────────────────────────────────────────────
    master_df = pd.read_excel(
        _p("PSL_Master_Dataset_1777931713613.xlsx"),
        sheet_name="Master Dataset",
        header=1,   # row 0 is title, row 1 is headers
        dtype=str,
    )
    master_records = []
    for _, row in master_df.iterrows():
        player = _to_str(row.get("player", ""))
        if not player:
            continue
        master_records.append({
            "player":            player,
            "role":              _to_str(row.get("role", "")),
            "bowlingType":       _to_str(row.get("bowling_type", "")),
            "date":              _to_str(row.get("date", "")),
            "venue":             _to_str(row.get("venue", "")),
            "opposition":        _to_str(row.get("opposition", "")),
            "runs":              _to_num(row.get("runs", 0)),
            "balls":             _to_num(row.get("balls", 0)),
            "fours":             _to_num(row.get("fours", 0)),
            "sixes":             _to_num(row.get("sixes", 0)),
            "overs":             _to_num(row.get("overs", 0)),
            "ballsBowled":       _to_num(row.get("balls_bowled", 0)),
            "runsConceded":      _to_num(row.get("runs_conceded", 0)),
            "wickets":           _to_num(row.get("wickets", 0)),
            "battingStrikeRate": _to_num(row.get("batting_strike_rate", 0)),
            "economy":           _to_num(row.get("economy", 0)),
            "battingPosition":   _to_num(row.get("batting_position", 0)),
        })

    # ── Player Roles Master ───────────────────────────────────────────────────
    roles_df = pd.read_excel(
        _p("PSL_Pakistani_Players_Roles_Master_1777931713617.xlsx"),
        sheet_name=0,
        dtype=str,
    )
    player_roles = []
    for _, row in roles_df.iterrows():
        player = _to_str(row.get("Player", ""))
        if not player:
            continue
        player_roles.append({
            "player":        player,
            "role":          _to_str(row.get("Role", "")),
            "span":          _to_str(row.get("Span", "")),
            "batMatches":    _to_num(row.get("Bat Matches", 0)),
            "batInnings":    _to_num(row.get("Bat Innings", 0)),
            "notOut":        _to_num(row.get("Not Out", 0)),
            "runs":          _to_num(row.get("Runs", 0)),
            "highestScore":  _to_str(row.get("Highest Score", "0")),
            "batAverage":    _to_num(row.get("Bat Average", 0)),
            "ballsFaced":    _to_num(row.get("Balls Faced", 0)),
            "batStrikeRate": _to_num(row.get("Bat Strike Rate", 0)),
            "hundreds":      _to_num(row.get("100s", 0)),
            "fifties":       _to_num(row.get("50s", 0)),
            "ducks":         _to_num(row.get("Ducks", 0)),
            "fours":         _to_num(row.get("4s", 0)),
            "sixes":         _to_num(row.get("6s", 0)),
            "bowlMatches":   _to_num(row.get("Bowl Matches", 0)),
            "bowlInnings":   _to_num(row.get("Bowl Innings", 0)),
            "overs":         _to_num(row.get("Overs", 0)),
            "maidens":       _to_num(row.get("Maidens", 0)),
            "runsConceded":  _to_num(row.get("Runs Conceded", 0)),
            "wickets":       _to_num(row.get("Wickets", 0)),
            "bowlAverage":   _to_num(row.get("Bowl Average", 0)),
            "economyRate":   _to_num(row.get("Economy Rate", 0)),
            "bowlStrikeRate":_to_num(row.get("Bowl Strike Rate", 0)),
        })

    # ── Ground Bowling Stats ──────────────────────────────────────────────────
    gbowl_df = pd.read_excel(
        _p("PSL_Pakistani_Ground_Bowling_1777931713615.xlsx"),
        sheet_name=0,
        dtype=str,
    )
    ground_bowling = []
    for _, row in gbowl_df.iterrows():
        ground = _to_str(row.get("Ground/Venue", ""))
        player = _to_str(row.get("Player", ""))
        if not ground or not player:
            continue
        ground_bowling.append({
            "ground":     ground,
            "player":     player,
            "span":       _to_str(row.get("Span", "")),
            "matches":    _to_num(row.get("Matches", 0)),
            "innings":    _to_num(row.get("Innings", 0)),
            "overs":      _to_num(row.get("Overs", 0)),
            "wickets":    _to_num(row.get("Wickets", 0)),
            "average":    _to_num(row.get("Average", 0)),
            "economy":    _to_num(row.get("Economy", 0)),
            "strikeRate": _to_num(row.get("Strike Rate", 0)),
        })

    # ── Ground Batting Stats (4 sheets) ──────────────────────────────────────
    ground_batting: dict[str, list] = {}
    xl = pd.ExcelFile(_p("psl_batters_ground_stats_1777931713609.xlsx"))
    for sheet in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name=sheet, header=1, dtype=str)
        records = []
        for _, row in df.iterrows():
            player = _to_str(row.get("Player", ""))
            if not player:
                continue
            records.append({
                "venue":        sheet,
                "player":       player,
                "matches":      _to_num(row.get("Mat", 0)),
                "innings":      _to_num(row.get("Inns", 0)),
                "notOut":       _to_num(row.get("NO", 0)),
                "runs":         _to_num(row.get("Runs", 0)),
                "highestScore": _to_str(row.get("HS", "0")),
                "average":      _to_num(row.get("Ave", 0)),
                "ballsFaced":   _to_num(row.get("BF", 0)),
                "strikeRate":   _to_num(row.get("SR", 0)),
                "hundreds":     _to_num(row.get("100", 0)),
                "fifties":      _to_num(row.get("50", 0)),
                "ducks":        _to_num(row.get("0", 0)),
            })
        ground_batting[sheet] = records

    # ── All-Rounders ──────────────────────────────────────────────────────────
    wk_xl = pd.ExcelFile(_p("psl_wicketkeepers_fielders_and_allrounder_1777931713618.xlsx"))
    ar_df = pd.read_excel(wk_xl, sheet_name="All-rounders", header=1, dtype=str)
    all_rounders = []
    for _, row in ar_df.iterrows():
        player = _to_str(row.get("Player", ""))
        if not player:
            continue
        all_rounders.append({
            "player":       player,
            "span":         _to_str(row.get("Span", "")),
            "matches":      _to_num(row.get("Mat", 0)),
            "runs":         _to_num(row.get("Runs", 0)),
            "highestScore": _to_str(row.get("HS", "0")),
            "batAvg":       _to_num(row.get("Bat Avg", 0)),
            "batSR":        _to_num(row.get("Bat SR", 0)),
            "wickets":      _to_num(row.get("Wkts", 0)),
            "best":         _to_str(row.get("Best", "")),
            "bowlAvg":      _to_num(row.get("Bowl Avg", 0)),
            "bowlEco":      _to_num(row.get("Bowl Eco", 0)),
        })

    # ── Wicketkeepers ─────────────────────────────────────────────────────────
    wk_df = pd.read_excel(wk_xl, sheet_name="WK Batting", header=1, dtype=str)
    wicketkeepers = []
    for _, row in wk_df.iterrows():
        player = _to_str(row.get("Player", ""))
        if not player:
            continue
        wicketkeepers.append({
            "player":       player,
            "span":         _to_str(row.get("Span", "")),
            "matches":      _to_num(row.get("Mat", 0)),
            "innings":      _to_num(row.get("Inns", 0)),
            "notOut":       _to_num(row.get("NO", 0)),
            "runs":         _to_num(row.get("Runs", 0)),
            "highestScore": _to_str(row.get("HS", "0")),
            "average":      _to_num(row.get("Ave", 0)),
            "ballsFaced":   _to_num(row.get("BF", 0)),
            "strikeRate":   _to_num(row.get("SR", 0)),
        })

    # ── Combined Bowlers ──────────────────────────────────────────────────────
    bowlers_df = pd.read_excel(
        _p("PSL_Pakistani_Bowlers_Combined_1777931713614.xlsx"),
        sheet_name=0,
        dtype=str,
    )
    bowlers = []
    for _, row in bowlers_df.iterrows():
        player = _to_str(row.get("Player", ""))
        if not player:
            continue
        bowlers.append({
            "player":      player,
            "bowlerType":  _to_str(row.get("Bowler Type", "")),
            "span":        _to_str(row.get("Span", "")),
            "matches":     _to_num(row.get("Matches", 0)),
            "innings":     _to_num(row.get("Innings", 0)),
            "overs":       _to_num(row.get("Overs", 0)),
            "wickets":     _to_num(row.get("Wickets", 0)),
            "average":     _to_num(row.get("Average", 0)),
            "economy":     _to_num(row.get("Economy", 0)),
            "strikeRate":  _to_num(row.get("Strike Rate", 0)),
        })

    _cached = {
        "masterRecords": master_records,
        "playerRoles":   player_roles,
        "groundBowling": ground_bowling,
        "groundBatting": ground_batting,
        "allRounders":   all_rounders,
        "wicketkeepers": wicketkeepers,
        "bowlers":       bowlers,
    }
    return _cached
