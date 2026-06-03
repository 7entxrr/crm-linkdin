import type { CandidateStatus, SequenceStep } from "@/types";

export const APP_NAME = "Nightingale Recruit";

export const CANDIDATE_STATUSES: { value: CandidateStatus; label: string }[] = [
  { value: "new_lead", label: "New Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "replied", label: "Replied" },
  { value: "interested", label: "Interested" },
  { value: "interview_scheduled", label: "Interview Scheduled" },
  { value: "closed", label: "Closed" },
];

export const HEALTHCARE_ROLES = [
  "Registered Nurse",
  "Licensed Practical Nurse",
  "Nurse Practitioner",
  "Physician Assistant",
  "Physical Therapist",
  "Occupational Therapist",
  "Medical Technologist",
  "Radiologic Technologist",
  "Respiratory Therapist",
  "Pharmacist",
  "Medical Assistant",
  "Healthcare Administrator",
];

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

/** Full state names keyed by their 2-letter code. */
export const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/** State dropdown options with full names. */
export const US_STATE_OPTIONS = US_STATES.map((code) => ({
  code,
  name: US_STATE_NAMES[code] ?? code,
}));

/** Major cities per state for the city picker (curated, healthcare-relevant metros). */
export const CITIES_BY_STATE: Record<string, string[]> = {
  AL: ["Birmingham", "Montgomery", "Mobile", "Huntsville", "Tuscaloosa", "Auburn", "Dothan", "Hoover"],
  AK: ["Anchorage", "Fairbanks", "Juneau", "Wasilla", "Sitka", "Ketchikan"],
  AZ: ["Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale", "Glendale", "Gilbert", "Tempe", "Flagstaff", "Yuma"],
  AR: ["Little Rock", "Fayetteville", "Fort Smith", "Springdale", "Jonesboro", "Conway", "Rogers"],
  CA: ["Los Angeles", "San Diego", "San Jose", "San Francisco", "Fresno", "Sacramento", "Long Beach", "Oakland", "Bakersfield", "Anaheim", "Santa Ana", "Riverside", "Irvine", "Stockton"],
  CO: ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Lakewood", "Boulder", "Pueblo", "Greeley"],
  CT: ["Bridgeport", "New Haven", "Hartford", "Stamford", "Waterbury", "Norwalk", "Danbury"],
  DE: ["Wilmington", "Dover", "Newark", "Middletown", "Bear"],
  FL: ["Jacksonville", "Miami", "Tampa", "Orlando", "St. Petersburg", "Fort Lauderdale", "Tallahassee", "Cape Coral", "Gainesville", "Sarasota", "West Palm Beach"],
  GA: ["Atlanta", "Augusta", "Columbus", "Savannah", "Athens", "Macon", "Sandy Springs", "Roswell"],
  HI: ["Honolulu", "Hilo", "Kailua", "Kapolei", "Pearl City", "Waipahu"],
  ID: ["Boise", "Meridian", "Nampa", "Idaho Falls", "Pocatello", "Caldwell", "Coeur d'Alene"],
  IL: ["Chicago", "Aurora", "Naperville", "Joliet", "Rockford", "Springfield", "Peoria", "Elgin", "Champaign"],
  IN: ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel", "Fishers", "Bloomington", "Gary"],
  IA: ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City", "Iowa City", "Waterloo", "Ames"],
  KS: ["Wichita", "Overland Park", "Kansas City", "Olathe", "Topeka", "Lawrence", "Manhattan"],
  KY: ["Louisville", "Lexington", "Bowling Green", "Owensboro", "Covington", "Frankfort"],
  LA: ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette", "Lake Charles", "Metairie"],
  ME: ["Portland", "Lewiston", "Bangor", "Auburn", "South Portland", "Augusta"],
  MD: ["Baltimore", "Columbia", "Germantown", "Silver Spring", "Rockville", "Annapolis", "Frederick"],
  MA: ["Boston", "Worcester", "Springfield", "Cambridge", "Lowell", "Brockton", "Quincy", "Newton"],
  MI: ["Detroit", "Grand Rapids", "Ann Arbor", "Lansing", "Flint", "Sterling Heights", "Warren", "Kalamazoo"],
  MN: ["Minneapolis", "St. Paul", "Rochester", "Duluth", "Bloomington", "Plymouth", "St. Cloud"],
  MS: ["Jackson", "Gulfport", "Southaven", "Hattiesburg", "Biloxi", "Tupelo", "Meridian"],
  MO: ["Kansas City", "St. Louis", "Springfield", "Columbia", "Independence", "Lee's Summit", "Jefferson City"],
  MT: ["Billings", "Missoula", "Great Falls", "Bozeman", "Helena", "Kalispell"],
  NE: ["Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney", "Fremont"],
  NV: ["Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks", "Carson City"],
  NH: ["Manchester", "Nashua", "Concord", "Dover", "Rochester", "Portsmouth"],
  NJ: ["Newark", "Jersey City", "Paterson", "Elizabeth", "Edison", "Trenton", "Camden", "Princeton"],
  NM: ["Albuquerque", "Las Cruces", "Rio Rancho", "Santa Fe", "Roswell", "Farmington"],
  NY: ["New York City", "Buffalo", "Rochester", "Yonkers", "Syracuse", "Albany", "New Rochelle", "White Plains"],
  NC: ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem", "Fayetteville", "Cary", "Wilmington", "Asheville"],
  ND: ["Fargo", "Bismarck", "Grand Forks", "Minot", "West Fargo", "Mandan"],
  OH: ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton", "Canton", "Youngstown"],
  OK: ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow", "Edmond", "Lawton", "Stillwater"],
  OR: ["Portland", "Salem", "Eugene", "Gresham", "Hillsboro", "Beaverton", "Bend", "Medford"],
  PA: ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading", "Scranton", "Bethlehem", "Harrisburg"],
  RI: ["Providence", "Warwick", "Cranston", "Pawtucket", "Newport", "Woonsocket"],
  SC: ["Columbia", "Charleston", "North Charleston", "Greenville", "Rock Hill", "Mount Pleasant", "Myrtle Beach"],
  SD: ["Sioux Falls", "Rapid City", "Aberdeen", "Brookings", "Watertown", "Pierre"],
  TN: ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville", "Murfreesboro", "Franklin"],
  TX: ["Houston", "San Antonio", "Dallas", "Austin", "Fort Worth", "El Paso", "Arlington", "Corpus Christi", "Plano", "Lubbock", "Irving", "Laredo"],
  UT: ["Salt Lake City", "West Valley City", "Provo", "Ogden", "Sandy", "Orem", "St. George"],
  VT: ["Burlington", "South Burlington", "Rutland", "Montpelier", "Barre", "Essex"],
  VA: ["Virginia Beach", "Richmond", "Norfolk", "Arlington", "Chesapeake", "Alexandria", "Roanoke", "Charlottesville"],
  WA: ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue", "Everett", "Kent", "Olympia", "Yakima"],
  WV: ["Charleston", "Huntington", "Morgantown", "Parkersburg", "Wheeling", "Beckley"],
  WI: ["Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine", "Appleton", "Eau Claire", "Oshkosh"],
  WY: ["Cheyenne", "Casper", "Laramie", "Gillette", "Rock Springs", "Sheridan"],
};

export const SEQUENCE_STEPS: {
  step: SequenceStep;
  day: number;
  label: string;
  defaultSubject: string;
}[] = [
  {
    step: "day_1",
    day: 1,
    label: "Initial Email",
    defaultSubject: "Healthcare opportunity at {{company}}",
  },
  {
    step: "day_3",
    day: 3,
    label: "Follow-up #1",
    defaultSubject: "Following up — {{role}} opportunity",
  },
  {
    step: "day_7",
    day: 7,
    label: "Follow-up #2",
    defaultSubject: "Quick check-in regarding your {{role}} role",
  },
  {
    step: "day_14",
    day: 14,
    label: "Final Follow-up",
    defaultSubject: "Last note — healthcare role in {{location}}",
  },
];

export const TEMPLATE_VARIABLES = [
  "{{firstName}}",
  "{{role}}",
  "{{location}}",
  "{{company}}",
] as const;

export const COLLECTIONS = {
  users: "users",
  candidates: "candidates",
  outreachs: "outreachs",
  followups: "followups",
  activities: "activities",
  notes: "notes",
  templates: "templates",
  settings: "settings",
  sourcingRules: "sourcingRules",
  notifications: "notifications",
  tasks: "tasks",
  savedViews: "savedViews",
  messages: "messages",
} as const;

export const SETTINGS_DOC_ID = "app";
