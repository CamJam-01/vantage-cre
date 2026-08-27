/** CoStar land-sale export headers — these are also the land_sales column names. */

/** Exact CoStar CSV template header row — also the canonical land_sales column order. */
export const COSTAR_HEADER_ROW =
  'Property Address,Property City,Property State,Property Type,Land Area AC,Land Area SF,Star Rating,Sale Price,Sale Date,Sale Status,Asking Price,Price Per AC Land,Price Per SF Land,Sale Type,Property Name,Buyer (True) Company,Buyer (True) Type,Buyer (True) Secondary Type,Buyer (True) Origin,Acquisition Fund Name,Buyers Broker Company,Seller (True) Company,Seller (True) Type,Seller (True) Secondary Type,Seller (True) Origin,Listing Broker Company,Hold Period,Secondary Type,Proposed Use,Zoning,Market,Disposition Fund Name,Submarket Name,Location Type,Property County,Country,Subcontinent,Continent,Property Zip Code,Corner,Map Code,Actual Cap Rate,Affordable Type,Age,All-Inclusive,All-Suites,Amenities,Anchor Tenants,Assessed Improved,Assessed Land,Assessed Value,Assessed Year,Average Rental Rate Per kW,Avg Unit SF,Brand,Building Class,Building Condition,Building Materials,Building Operating Expenses,Building Park,Building SF,Building Tax Expenses,Buyer (Contact) Address,Buyer (Contact) City,Buyer (Contact) Company,Buyer (Contact) Contact Name,Buyer (Contact) Phone,Buyer (Contact) State,Buyer (Contact) Zip Code,Buyer (Recorded) Address,Buyer (Recorded) City,Buyer (Recorded) Company,Buyer (Recorded) Contact Name,Buyer (Recorded) Phone,Buyer (Recorded) State,Buyer (Recorded) Street Name,Buyer (Recorded) Street Number,Buyer (Recorded) Street Post-Direction,Buyer (Recorded) Street Pre-Direction,Buyer (Recorded) Zip Code,Buyer (True) Address,Buyer (True) City,Buyer (True) Contact Name,Buyer (True) Phone,Buyer (True) Post-Direction,Buyer (True) Pre-Direction,Buyer (True) State,Buyer (True) Street Name,Buyer (True) Street Number,Buyer (True) Zip Code,Buyers Broker Address,Buyers Broker Agent First Name,Buyers Broker Agent Last Name,Buyers Broker City,Buyers Broker Phone,Buyers Broker State,Buyers Broker Street Name,Buyers Broker Street Number,Buyers Broker Street Post-Direction,Buyers Broker Street Pre-Direction,Buyers Broker Zip Code,Capacity - Available kW,Capacity - Critical IT kW,Capacity - Total Utility kW,Ceiling Height,Column Spacing,Comp ID,Comps Number,Construction Begin,Construction Material,Cooling Redundancy,Coverage,Cross Street,Data Center Tier,Data Center Type,Data Hall Area SF,Data Hall Count,Density kW/rack,Density kW/SF,Description Text,Document Number,Down Payment,Drive Ins,Electric Utility,Fips Code,Fire Sprinkler,First Trust Deed Balance,First Trust Deed Lender,First Trust Deed Payment,First Trust Deed Terms,Flood Risk,Flood Zone,Floor Area Ratio,Frontage,GIM,GRM,Gross Income,Has Lab Space,Heating,Hotel Class,Hotel Location Type,Hotel Operator,Improvement Ratio,Lab Space (SF),Lab Space Percent Composition,Land Improvements,Land SF Gross,Land SF Net,Latitude,Legal Description,Listing Broker Address,Listing Broker Agent First Name,Listing Broker Agent Last Name,Listing Broker City,Listing Broker Phone,Listing Broker State,Listing Broker Street Name,Listing Broker Street Number,Listing Broker Street Post-Direction,Listing Broker Street Pre-Direction,Listing Broker Zip Code,Loading Docks,Longitude,Lot Dimensions,Map Page,Map X,Map Y,Market Time,Multi-Sale Name,Net Income,Non-Arms Length Reasons,Number of 1 Bedroom Units,Number of 2 Bedroom Units,Number of 3 Bedroom Units,Number of Beds,Number of Cranes,Number of Floors,Number of Other Bedroom Units,Number of Parking Spaces,Number of Rooms,Number of Studio Units,Number of Tenants,Number of Units,Office Space,One Bedroom Mix,Other Mix,Parcel Number 1 (Min),Parcel Number 2 (Max),Parent Company,Parking Ratio,Percent Leased,Percent Office,Portfolio City,Portfolio County,Portfolio Name,Portfolio State,Portfolio Zip,Power,Power Redundancy,Power Usage Effectiveness,Pre-Leasing,Price Per AC Land Net,Price Per Room,Price Per SF,Price Per SF (Net),Price Per SF Land Net,Price Per Total kW,Price Per Unit,Pro Forma Cap Rate,Property Street Name,Property Street Number,Property Street Post-Direction,Property Street Pre-Direction,PropertyID,Publication Date,Rail Served,Recording Date,Region,Research Status,Roof Type,Sale Category,Sale Condition,Sale Price Comment,Scale,Second Trust Deed Balance,Second Trust Deed Lender,Second Trust Deed Payment,Second Trust Deed Terms,Seller (Contact) Address,Seller (Contact) City,Seller (Contact) Company,Seller (Contact) Contact Name,Seller (Contact) Phone,Seller (Contact) State,Seller (Contact) Zip Code,Seller (Recorded) Address,Seller (Recorded) City,Seller (Recorded) Company,Seller (Recorded) Contact Name,Seller (Recorded) Phone,Seller (Recorded) State,Seller (Recorded) Street Name,Seller (Recorded) Street Number,Seller (Recorded) Street Post-Direction,Seller (Recorded) Street Pre-Direction,Seller (Recorded) Zip Code,Seller (True) Address,Seller (True) City,Seller (True) Contact Name,Seller (True) Phone,Seller (True) Post-Direction,Seller (True) Pre-Direction,Seller (True) State,Seller (True) Street Name,Seller (True) Street Number,Seller (True) Zip Code,Sewer,Size,Sprinklers,Sprinklers,Stamp,Studio Mix,Submarket Cluster,Submarket Code,Tenancy,Three Bedroom Mix,Title Company,Total Expense Amount,Transaction Notes,Transfer Tax,Two Bedroom Mix,Typical Floor (SF),Units Per Acre,University,Vacancy,Water,Year Built,Year Renovated';

export const COSTAR_HEADERS = COSTAR_HEADER_ROW.split(',') as readonly string[];

export type CostarHeader = (typeof COSTAR_HEADERS)[number];

/** Postgres cannot have two columns named Sprinklers; both CSV headers share this column. */
export function costarFields(headers: readonly string[] = COSTAR_HEADERS): ReadonlyArray<{ header: string; column: string }> {
  return headers.map(header => ({ header, column: header }));
}

export function costarColumnNames(headers: readonly string[] = COSTAR_HEADERS): string[] {
  return [...new Set(headers)];
}

/** CoStar headers that back the app's existing core land-sale fields. */
export const COSTAR_CORE_HEADER_MAP = {
  'Property Address': 'address',
  'Property City': 'city',
  'Property State': 'state',
  'Property Type': 'property_type',
  'Land Area AC': 'acreage',
  'Land Area SF': 'square_feet',
  'Sale Price': 'sale_price',
  'Sale Date': 'sale_date',
  'Buyer (True) Company': 'buyer',
  'Property County': 'county',
  'Market': 'msa',
  'Parcel Number 1 (Min)': 'parcel_id',
} as const;
