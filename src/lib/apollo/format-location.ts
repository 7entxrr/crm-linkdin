const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

/** Sentinel: search all cities in the selected state (no city filter). */
export const ALL_CITIES = "__all_cities__";

/** Sentinel: search all US states (no state/city filter beyond country). */
export const ALL_STATES = "__any__";

/** Apollo expects locations like "Texas, US" or "Houston, Texas, US". */
export function formatApolloLocation(city: string, stateCode: string): string[] {
  const locations: string[] = [];
  const cityTrim = city === ALL_CITIES ? "" : city.trim();
  const stateTrim = stateCode === ALL_STATES ? "" : stateCode.trim();

  if (cityTrim && stateTrim) {
    const stateName = STATE_NAMES[stateTrim] ?? stateTrim;
    locations.push(`${cityTrim}, ${stateName}, US`);
    return locations;
  }

  if (stateTrim) {
    const stateName = STATE_NAMES[stateTrim] ?? stateTrim;
    locations.push(`${stateName}, US`);
    return locations;
  }

  if (cityTrim) {
    locations.push(cityTrim);
  }

  return locations;
}
