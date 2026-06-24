import XLSX from "xlsx";
import path from "path";

// Use process.cwd() which resolves to artifacts/api-server when the server runs,
// so ../../attached_assets correctly points to workspace/attached_assets
const DATA_DIR = path.join(process.cwd(), "../../attached_assets");

export interface MasterRecord {
  player: string;
  role: string;
  bowlingType: string;
  date: string;
  venue: string;
  opposition: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  overs: number;
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  battingStrikeRate: number;
  economy: number;
  battingPosition: number;
}

export interface PlayerRoleMaster {
  player: string;
  role: string;
  span: string;
  batMatches: number;
  batInnings: number;
  notOut: number;
  runs: number;
  highestScore: string;
  batAverage: number;
  ballsFaced: number;
  batStrikeRate: number;
  hundreds: number;
  fifties: number;
  ducks: number;
  fours: number;
  sixes: number;
  bowlMatches: number;
  bowlInnings: number;
  overs: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  bowlAverage: number;
  economyRate: number;
  bowlStrikeRate: number;
}

export interface GroundBowlingRecord {
  ground: string;
  player: string;
  span: string;
  matches: number;
  innings: number;
  overs: number;
  wickets: number;
  average: number;
  economy: number;
  strikeRate: number;
}

export interface GroundBattingRecord {
  venue: string;
  player: string;
  matches: number;
  innings: number;
  notOut: number;
  runs: number;
  highestScore: string;
  average: number;
  ballsFaced: number;
  strikeRate: number;
  hundreds: number;
  fifties: number;
  ducks: number;
}

export interface AllRounderRecord {
  player: string;
  span: string;
  matches: number;
  runs: number;
  highestScore: string;
  batAvg: number;
  batSR: number;
  wickets: number;
  best: string;
  bowlAvg: number;
  bowlEco: number;
}

export interface WKRecord {
  player: string;
  span: string;
  matches: number;
  innings: number;
  notOut: number;
  runs: number;
  highestScore: string;
  average: number;
  ballsFaced: number;
  strikeRate: number;
}

export interface CombinedBowlerRecord {
  player: string;
  bowlerType: string;
  span: string;
  matches: number;
  innings: number;
  overs: number;
  wickets: number;
  average: number;
  economy: number;
  strikeRate: number;
}

export interface PSLDataset {
  masterRecords: MasterRecord[];
  playerRoles: PlayerRoleMaster[];
  groundBowling: GroundBowlingRecord[];
  groundBatting: Map<string, GroundBattingRecord[]>; // venue -> records
  allRounders: AllRounderRecord[];
  wicketkeepers: WKRecord[];
  bowlers: CombinedBowlerRecord[];
}

function readFile(filename: string): XLSX.WorkBook {
  return XLSX.readFile(path.join(DATA_DIR, filename));
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "" || v === "-") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

let cachedDataset: PSLDataset | null = null;

export function loadDataset(): PSLDataset {
  if (cachedDataset) return cachedDataset;

  // --- Master Dataset ---
  const masterWb = readFile("PSL_Master_Dataset_1777931713613.xlsx");
  const masterSheet = masterWb.Sheets["Master Dataset"];
  const masterRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(masterSheet, { header: 1 });
  // Row 0 is title, row 1 is headers, rows 2+ are data
  const masterHeaders = masterRaw[1] as string[];
  const masterRecords: MasterRecord[] = [];
  for (let i = 2; i < masterRaw.length; i++) {
    const row = masterRaw[i] as unknown[];
    if (!row || !row[0]) continue;
    const getCol = (name: string) => row[masterHeaders.indexOf(name)];
    masterRecords.push({
      player: toStr(getCol("player")),
      role: toStr(getCol("role")),
      bowlingType: toStr(getCol("bowling_type")),
      date: toStr(getCol("date")),
      venue: toStr(getCol("venue")),
      opposition: toStr(getCol("opposition")),
      runs: toNum(getCol("runs")),
      balls: toNum(getCol("balls")),
      fours: toNum(getCol("fours")),
      sixes: toNum(getCol("sixes")),
      overs: toNum(getCol("overs")),
      ballsBowled: toNum(getCol("balls_bowled")),
      runsConceded: toNum(getCol("runs_conceded")),
      wickets: toNum(getCol("wickets")),
      battingStrikeRate: toNum(getCol("batting_strike_rate")),
      economy: toNum(getCol("economy")),
      battingPosition: toNum(getCol("batting_position")),
    });
  }

  // --- Player Roles Master ---
  const rolesWb = readFile("PSL_Pakistani_Players_Roles_Master_1777931713617.xlsx");
  const rolesSheet = rolesWb.Sheets[rolesWb.SheetNames[0]];
  const rolesRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(rolesSheet);
  const playerRoles: PlayerRoleMaster[] = rolesRaw
    .filter((r) => r["Player"])
    .map((r) => ({
      player: toStr(r["Player"]),
      role: toStr(r["Role"]),
      span: toStr(r["Span"]),
      batMatches: toNum(r["Bat Matches"]),
      batInnings: toNum(r["Bat Innings"]),
      notOut: toNum(r["Not Out"]),
      runs: toNum(r["Runs"]),
      highestScore: toStr(r["Highest Score"]),
      batAverage: toNum(r["Bat Average"]),
      ballsFaced: toNum(r["Balls Faced"]),
      batStrikeRate: toNum(r["Bat Strike Rate"]),
      hundreds: toNum(r["100s"]),
      fifties: toNum(r["50s"]),
      ducks: toNum(r["Ducks"]),
      fours: toNum(r["4s"]),
      sixes: toNum(r["6s"]),
      bowlMatches: toNum(r["Bowl Matches"]),
      bowlInnings: toNum(r["Bowl Innings"]),
      overs: toNum(r["Overs"]),
      maidens: toNum(r["Maidens"]),
      runsConceded: toNum(r["Runs Conceded"]),
      wickets: toNum(r["Wickets"]),
      bowlAverage: toNum(r["Bowl Average"]),
      economyRate: toNum(r["Economy Rate"]),
      bowlStrikeRate: toNum(r["Bowl Strike Rate"]),
    }));

  // --- Ground Bowling Stats ---
  const groundBowlWb = readFile("PSL_Pakistani_Ground_Bowling_1777931713615.xlsx");
  const groundBowlSheet = groundBowlWb.Sheets[groundBowlWb.SheetNames[0]];
  const groundBowlRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(groundBowlSheet);
  const groundBowling: GroundBowlingRecord[] = groundBowlRaw
    .filter((r) => r["Ground/Venue"] && r["Player"])
    .map((r) => ({
      ground: toStr(r["Ground/Venue"]),
      player: toStr(r["Player"]),
      span: toStr(r["Span"]),
      matches: toNum(r["Matches"]),
      innings: toNum(r["Innings"]),
      overs: toNum(r["Overs"]),
      wickets: toNum(r["Wickets"]),
      average: toNum(r["Average"]),
      economy: toNum(r["Economy"]),
      strikeRate: toNum(r["Strike Rate"]),
    }));

  // --- Ground Batting Stats (multiple sheets: Karachi, Multan, Lahore, Rawalpindi) ---
  const groundBattingWb = readFile("psl_batters_ground_stats_1777931713609.xlsx");
  const groundBatting = new Map<string, GroundBattingRecord[]>();
  for (const sheetName of groundBattingWb.SheetNames) {
    const sheet = groundBattingWb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][];
    // Row 0 is title, row 1 is headers, rows 2+ are data
    const headers = raw[1] as string[];
    if (!headers) continue;
    const records: GroundBattingRecord[] = [];
    for (let i = 2; i < raw.length; i++) {
      const row = raw[i] as unknown[];
      if (!row || !row[0]) continue;
      const g = (name: string) => row[headers.indexOf(name)];
      records.push({
        venue: sheetName,
        player: toStr(g("Player")),
        matches: toNum(g("Mat")),
        innings: toNum(g("Inns")),
        notOut: toNum(g("NO")),
        runs: toNum(g("Runs")),
        highestScore: toStr(g("HS")),
        average: toNum(g("Ave")),
        ballsFaced: toNum(g("BF")),
        strikeRate: toNum(g("SR")),
        hundreds: toNum(g("100")),
        fifties: toNum(g("50")),
        ducks: toNum(g("0")),
      });
    }
    groundBatting.set(sheetName, records);
  }

  // --- All-Rounders ---
  const wkWb = readFile("psl_wicketkeepers_fielders_and_allrounder_1777931713618.xlsx");
  const arSheet = wkWb.Sheets["All-rounders"];
  const arRaw = XLSX.utils.sheet_to_json<unknown[]>(arSheet, { header: 1 }) as unknown[][];
  const arHeaders = arRaw[1] as string[];
  const allRounders: AllRounderRecord[] = [];
  for (let i = 2; i < arRaw.length; i++) {
    const row = arRaw[i] as unknown[];
    if (!row || !row[0]) continue;
    const g = (name: string) => row[arHeaders.indexOf(name)];
    allRounders.push({
      player: toStr(g("Player")),
      span: toStr(g("Span")),
      matches: toNum(g("Mat")),
      runs: toNum(g("Runs")),
      highestScore: toStr(g("HS")),
      batAvg: toNum(g("Bat Avg")),
      batSR: toNum(g("Bat SR")),
      wickets: toNum(g("Wkts")),
      best: toStr(g("Best")),
      bowlAvg: toNum(g("Bowl Avg")),
      bowlEco: toNum(g("Bowl Eco")),
    });
  }

  // --- Wicketkeepers ---
  const wkSheet = wkWb.Sheets["WK Batting"];
  const wkRaw = XLSX.utils.sheet_to_json<unknown[]>(wkSheet, { header: 1 }) as unknown[][];
  const wkHeaders = wkRaw[1] as string[];
  const wicketkeepers: WKRecord[] = [];
  for (let i = 2; i < wkRaw.length; i++) {
    const row = wkRaw[i] as unknown[];
    if (!row || !row[0]) continue;
    const g = (name: string) => row[wkHeaders.indexOf(name)];
    wicketkeepers.push({
      player: toStr(g("Player")),
      span: toStr(g("Span")),
      matches: toNum(g("Mat")),
      innings: toNum(g("Inns")),
      notOut: toNum(g("NO")),
      runs: toNum(g("Runs")),
      highestScore: toStr(g("HS")),
      average: toNum(g("Ave")),
      ballsFaced: toNum(g("BF")),
      strikeRate: toNum(g("SR")),
    });
  }

  // --- Combined Bowlers ---
  const bowlersWb = readFile("PSL_Pakistani_Bowlers_Combined_1777931713614.xlsx");
  const bowlersSheet = bowlersWb.Sheets[bowlersWb.SheetNames[0]];
  const bowlersRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(bowlersSheet);
  const bowlers: CombinedBowlerRecord[] = bowlersRaw
    .filter((r) => r["Player"])
    .map((r) => ({
      player: toStr(r["Player"]),
      bowlerType: toStr(r["Bowler Type"]),
      span: toStr(r["Span"]),
      matches: toNum(r["Matches"]),
      innings: toNum(r["Innings"]),
      overs: toNum(r["Overs"]),
      wickets: toNum(r["Wickets"]),
      average: toNum(r["Average"]),
      economy: toNum(r["Economy"]),
      strikeRate: toNum(r["Strike Rate"]),
    }));

  cachedDataset = {
    masterRecords,
    playerRoles,
    groundBowling,
    groundBatting,
    allRounders,
    wicketkeepers,
    bowlers,
  };

  return cachedDataset;
}
