import fastCartesian from "fast-cartesian";

export function generateAbbreviations(name: string): string[] {
  const words = name.toLowerCase().split(" ");
  const wordChoices = [];
  for (const word of words) {
    const choices = [word];
    const alt = DIRECTIONS[word] ?? SUFFIXES[word];
    if (alt && alt != word) {
      choices.push(alt);
    }
    wordChoices.push(choices);
  }
  return fastCartesian(wordChoices).map((words) => words.join(" "));
}

// keep quotes around keys
// prettier-ignore
const SUFFIXES: Record<string, string> = {
  "alley": "aly",
  "allee": "aly",
  "anex": "anx",
  "annex": "anx",
  "arcade": "arc",
  "avenue": "ave",
  "bayoo": "byu",
  "bayou": "byu",
  "beach": "bch",
  "bend": "bnd",
  "bluff": "blf",
  "bluffs": "blfs",
  "bottom": "btm",
  "boulevard": "blvd",
  "branch": "br",
  "bridge": "brg",
  "brook": "brk",
  "brooks": "brks",
  "burg": "bg",
  "burgs": "bgs",
  "bypass": "byp",
  "camp": "cp",
  "canyon": "cyn",
  "cape": "cpe",
  "causeway": "cswy",
  "center": "ctr",
  "centre": "ctr",
  "centers": "ctrs",
  "circle": "cir",
  "circles": "cirs",
  "cliff": "clf",
  "cliffs": "clfs",
  "club": "clb",
  "common": "cmn",
  "commons": "cmns",
  "corner": "cor",
  "corners": "cors",
  "course": "crse",
  "cove": "cv",
  "coves": "cvs",
  "creek": "crk",
  "crescent": "cres",
  "crest": "crst",
  "crossing": "xing",
  "crossroad": "xrds",
  "crossroads": "xrds",
  "curve": "curv",
  "dale": "dl",
  "dam": "dm",
  "divide": "div",
  "drive": "dr",
  "drives": "drs",
  "estate": "est",
  "estates": "ests",
  "expressway": "expy",
  "extension": "ext",
  "extensions": "exts",
  "fall": "fall",
  "falls": "fls",
  "ferry": "fry",
  "field": "fld",
  "fields": "flds",
  "flat": "flt",
  "ford": "frd",
  "fords": "frds",
  "forest": "frst",
  "forests": "frst",
  "forge": "frg",
  "forges": "frgs",
  "fork": "frk",
  "forks": "frks",
  "fort": "ft",
  "freeway": "fwy",
  "garden": "gdn",
  "gardens": "gdns",
  "gateway": "gtwy",
  "glen": "gln",
  "glens": "glns",
  "green": "grn",
  "grove": "grv",
  "groves": "grvs",
  "harbor": "hbr",
  "harbors": "hbrs",
  "haven": "hvn",
  "heights": "hts",
  "highway": "hwy",
  "hill": "hl",
  "hills": "hls",
  "hollow": "holw",
  "inlet": "inlt",
  "island": "is",
  "islands": "iss",
  "isle": "isle",
  "junction": "jct",
  "junctions": "jcts",
  "key": "ky",
  "keys": "kys",
  "knoll": "knl",
  "knolls": "knls",
  "lake": "lk",
  "lakes": "lks",
  "land": "land",
  "landing": "lndg",
  "lane": "ln",
  "light": "lgt",
  "lights": "lgts",
  "loaf": "lf",
  "lock": "lck",
  "locks": "lcks",
  "lodge": "ldg",
  "loop": "loop",
  "mall": "mall",
  "manor": "mnr",
  "manors": "mnr",
  "meadow": "mdw",
  "meadows": "mdws",
  "mews": "mews",
  "mill": "ml",
  "mills": "mls",
  "mission": "msn",
  "motorway": "mtwy",
  "mount": "mt",
  "mountain": "mtn",
  "mountains": "mtns",
  "neck": "nck",
  "orchard": "orch",
  "oval": "oval",
  "overpass": "opas",
  "park": "park",
  "parks": "park",
  "parkway": "pkwy",
  "parkways": "pkwy",
  "pass": "pass",
  "passage": "psge",
  "path": "path",
  "pike": "pike",
  "pine": "pne",
  "pines": "pnes",
  "place": "pl",
  "plain": "pln",
  "plains": "plns",
  "plaza": "plz",
  "point": "pt",
  "points": "pts",
  "port": "prt",
  "ports": "prts",
  "prairie": "pr",
  "radial": "radl",
  "ramp": "ramp",
  "ranch": "rnch",
  "rapid": "rpd",
  "rapids": "rpds",
  "rest": "rst",
  "ridge": "rdg",
  "ridges": "rdgs",
  "river": "riv",
  "road": "rd",
  "roads": "rds",
  "route": "rte",
  "row": "row",
  "rue": "rue",
  "run": "run",
  "shoal": "shl",
  "shoals": "shls",
  "shore": "shr",
  "shores": "shrs",
  "skyway": "skwy",
  "spring": "spg",
  "springs": "spgs",
  "spur": "spur",
  "spurs": "spur",
  "square": "sq",
  "squares": "sqs",
  "station": "sta",
  "stravenue": "stra",
  "stream": "strm",
  "street": "st",
  "streets": "sts",
  "summit": "smt",
  "terrace": "ter",
  "throughway": "trwy",
  "trace": "trce",
  "track": "trak",
  "trafficway": "trfy",
  "trail": "trl",
  "trailer": "trlr",
  "tunnel": "tunl",
  "turnpike": "tpke",
  "underpass": "upas",
  "union": "un",
  "unions": "uns",
  "valley": "vly",
  "valleys": "vlys",
  "viaduct": "via",
  "view": "vw",
  "views": "vws",
  "village": "vlg",
  "villages": "vlgs",
  "ville": "vl",
  "vista": "vis",
  "walk": "walk",
  "walks": "walk",
  "wall": "wall",
  "way": "way",
  "ways": "ways",
  "well": "wl",
  "wells": "wls",
};

// prettier-ignore
const DIRECTIONS: Record<string, string> = {
  "north": "n",
  "east": "e",
  "west": "w",
  "south": "s",
  "northeast": "ne",
  "northwest": "nw",
  "southeast": "se",
  "southwest": "sw",
};