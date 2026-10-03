/**
 * Seed script for ASIM AUTOS (dev database).
 *
 * Creates: shop ASIM001 + settings, owner + staff users, 20 categories,
 * 15 brands, 30 vehicles, 55 products, 10 suppliers, 30 customers,
 * opening stock, sample purchases & sales (via the REAL transaction
 * functions in src/lib/tx.ts, so stock movements / audit / notifications
 * are exercised), returns and payments.
 *
 * Run:  npx tsx src/db/seed.ts
 * Env:  DATABASE_URL (required), SEED_ADMIN_PASSWORD (optional)
 *
 * The script wipes existing ASIM001 data first so it is safe to re-run.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "./schema";
import {
  createPurchase,
  createSale,
  createCustomerReturn,
  createSupplierReturn,
  adjustStock,
  payPurchase,
} from "../lib/tx";

const SHOP_ID = "ASIM001";

/* deterministic PRNG so seed data is stable across runs */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const CATEGORIES = [
  "Air Filters", "Oil Filters", "Fuel Filters", "Brake Pads", "Brake Discs",
  "Belts", "Spark Plugs", "Suspension", "Engine Parts", "Electrical Parts",
  "Body Parts", "Lights", "Wipers", "Bearings", "Clutches",
  "Radiator Parts", "Steering Parts", "Cooling Parts", "Accessories", "Fuel System",
];

const BRANDS = [
  "Sakura", "Denso", "NGK", "Bosch", "KYB", "Monroe", "Exedy", "Gates",
  "NTN", "KOYO", "Philips", "Osram", "Mann Filter", "Toyota Genuine", "Honda Genuine",
];

const VEHICLES: Array<[string, string, number, number, string, string]> = [
  // make, model, yearFrom, yearTo, engine, fuel
  ["Toyota", "Corolla", 2014, 2018, "1.3L 2NZ-FE", "Petrol"],
  ["Toyota", "Corolla", 2019, 2024, "1.3L 2NR-FE", "Petrol"],
  ["Toyota", "Yaris", 2020, 2024, "1.3L 1NR-FE", "Petrol"],
  ["Toyota", "Hilux", 2016, 2023, "2.8L 1GD-FTV", "Diesel"],
  ["Toyota", "Fortuner", 2017, 2024, "2.8L 1GD-FTV", "Diesel"],
  ["Toyota", "Hiace", 2015, 2023, "2.5L 2KD-FTV", "Diesel"],
  ["Toyota", "Prius", 2012, 2018, "1.8L Hybrid", "Hybrid"],
  ["Honda", "Civic", 2016, 2021, "1.8L R18", "Petrol"],
  ["Honda", "Civic", 2022, 2025, "1.5L Turbo", "Petrol"],
  ["Honda", "City", 2021, 2025, "1.2L", "Petrol"],
  ["Honda", "BR-V", 2017, 2024, "1.5L", "Petrol"],
  ["Honda", "Vezel", 2014, 2020, "1.5L Hybrid", "Hybrid"],
  ["Suzuki", "Mehran", 2000, 2018, "0.8L F8B", "Petrol"],
  ["Suzuki", "Cultus", 2017, 2024, "1.0L K10B", "Petrol"],
  ["Suzuki", "Swift", 2022, 2025, "1.2L K12M", "Petrol"],
  ["Suzuki", "Alto", 2019, 2025, "660cc R06A", "Petrol"],
  ["Suzuki", "Wagon R", 2014, 2024, "1.0L K10B", "Petrol"],
  ["Suzuki", "Bolan", 2012, 2024, "0.8L F8B", "Petrol"],
  ["Suzuki", "Ravi", 2010, 2024, "0.8L F8B", "Petrol"],
  ["Suzuki", "Every", 2016, 2023, "660cc", "Petrol"],
  ["Kia", "Sportage", 2020, 2024, "2.0L Nu", "Petrol"],
  ["Kia", "Picanto", 2020, 2024, "1.0L", "Petrol"],
  ["Hyundai", "Tucson", 2020, 2024, "2.0L Nu", "Petrol"],
  ["Hyundai", "Elantra", 2021, 2024, "1.6L Gamma", "Petrol"],
  ["Daihatsu", "Mira", 2015, 2022, "660cc KF", "Petrol"],
  ["Daihatsu", "Hijet", 2014, 2022, "660cc", "Petrol"],
  ["Nissan", "Dayz", 2016, 2022, "660cc", "Petrol"],
  ["Honda", "Accord", 2013, 2018, "2.4L K24", "Petrol"],
  ["Toyota", "Camry", 2013, 2018, "2.5L 2AR", "Petrol"],
  ["Toyota", "Land Cruiser", 2010, 2020, "4.5L V8", "Diesel"],
];

const SUPPLIERS = [
  ["Al-Noor Auto Store", "Imran Sheikh", "0321-4567890", "Lahore", "Montgomery Road, Lahore"],
  ["Pak Traders", "Asif Mehmood", "0300-1122334", "Lahore", "Badami Bagh, Lahore"],
  ["Shan Auto Parts", "Shan Ali", "0333-9876543", "Faisalabad", "Jhang Road, Faisalabad"],
  ["City Auto Corporation", "Danish Raza", "0301-5566778", "Karachi", "Shershah, Karachi"],
  ["Bilal Motors", "Bilal Ahmed", "0322-3456789", "Lahore", "Montgomery Road, Lahore"],
  ["Usman Auto House", "Usman Tariq", "0345-1234567", "Faisalabad", "Susan Road, Faisalabad"],
  ["Gulberg Auto Parts", "Faisal Khan", "0300-9988776", "Lahore", "Gulberg, Lahore"],
  ["Madina Traders", "Haji Yousuf", "0332-1122334", "Karachi", "Water Pump, Karachi"],
  ["Siddique Auto Store", "Siddique Akbar", "0315-6677889", "Rawalpindi", "Gawalmandi, Rawalpindi"],
  ["Awan Auto Parts", "Malik Awan", "0308-4455667", "Faisalabad", "D Ground, Faisalabad"],
];

const CUSTOMER_NAMES = [
  "Ahmed Raza", "Bilal Hussain", "Usman Ghani", "Faisal Mehmood", "Imran Khan",
  "Shahid Ali", "Nadeem Abbas", "Tariq Javed", "Aslam Pervaiz", "Rashid Mehmood",
  "Kashif Ali", "Adnan Shahid", "Waqas Ahmed", "Sajid Hussain", "Zahid Iqbal",
  "Arslan Tariq", "Hamza Yousuf", "Danish Ali", "Fahad Khan", "Saqib Mehmood",
  "Junaid Akhtar", "Noman Siddique", "Adeel Raza", "Farhan Iqbal", "Salman Butt",
  "Tahir Mehmood", "Yasir Ali", "Majid Hussain", "Rizwan Ahmed", "Khalid Pervaiz",
];
const CUSTOMER_VEHICLES = [
  "Toyota Corolla 2016", "Honda Civic 2019", "Suzuki Mehran 2012", "Toyota Yaris 2021",
  "Suzuki Cultus 2020", "Honda City 2022", "Suzuki Alto 2021", "Kia Sportage 2022",
  "Toyota Hilux 2018", "Suzuki Wagon R 2019",
];

/**
 * [name, sku, partNo, oemNo, barcode, catIdx, brandIdx, purchPKR, salePKR,
 *  stock, min, reorder, rack, shelf, bin, [vehicleIdx...]]
 */
const PRODUCTS: Array<[string, string, string, string, string, number, number, number, number, number, number, number, string, string, string, number[]]> = [
  ["Toyota Corolla Air Filter", "AF-001", "AF-001", "TOY-17801", "8964001010011", 0, 0, 1200, 1600, 3, 5, 10, "B", "04", "12", [0, 1]],
  ["Honda Civic Air Filter", "AF-002", "AF-002", "HON-17220", "8964001010028", 0, 13, 1350, 1750, 8, 5, 10, "B", "04", "13", [7, 8]],
  ["Suzuki Mehran Air Filter", "AF-003", "AF-003", "SUZ-13780", "8964001010035", 0, 0, 650, 900, 12, 5, 12, "B", "04", "14", [12]],
  ["Toyota Corolla Oil Filter", "OF-101", "OF-101", "TOY-90915", "8964001020010", 1, 13, 850, 1150, 2, 6, 12, "A", "02", "05", [0, 1, 2]],
  ["Honda Civic Oil Filter", "OF-102", "OF-102", "HON-15400", "8964001020027", 1, 14, 900, 1200, 15, 6, 12, "A", "02", "06", [7, 8, 9]],
  ["Suzuki Cultus Oil Filter", "OF-103", "OF-103", "SUZ-16510", "8964001020034", 1, 0, 550, 800, 0, 6, 12, "A", "02", "07", [13]],
  ["Toyota Hilux Fuel Filter", "FF-201", "FF-201", "TOY-23390", "8964001030019", 2, 1, 2800, 3500, 6, 4, 8, "C", "01", "02", [3]],
  ["Honda City Fuel Filter", "FF-202", "FF-202", "HON-17048", "8964001030026", 2, 14, 1900, 2400, 4, 4, 8, "C", "01", "03", [9]],
  ["Corolla Brake Pad (Front)", "BP-301", "BP-301", "TOY-04465", "8964001040018", 3, 3, 3200, 4200, 5, 5, 10, "D", "03", "08", [0, 1]],
  ["Civic Brake Pad (Front)", "BP-302", "BP-302", "HON-45022", "8964001040025", 3, 3, 3400, 4400, 1, 5, 10, "D", "03", "09", [7, 8]],
  ["Mehran Brake Pad", "BP-303", "BP-303", "SUZ-55810", "8964001040032", 3, 0, 1500, 2000, 9, 5, 10, "D", "03", "10", [12]],
  ["Corolla Brake Disc (Pair)", "BD-401", "BD-401", "TOY-43512", "8964001050017", 4, 4, 6500, 8200, 4, 3, 6, "E", "01", "01", [0, 1]],
  ["Yaris Fan Belt", "BT-501", "BT-501", "TOY-90916", "8964001060016", 5, 7, 1100, 1500, 11, 5, 10, "F", "02", "04", [2]],
  ["Cultus Timing Belt Kit", "BT-502", "BT-502", "SUZ-12761", "8964001060023", 5, 7, 4500, 5800, 3, 4, 8, "F", "02", "05", [13]],
  ["NGK Spark Plug (4pc)", "SP-601", "SP-601", "NGK-BKR6E", "8964001070015", 6, 2, 1800, 2400, 20, 8, 16, "G", "05", "11", [0, 1, 7, 12]],
  ["Denso Iridium Plug (4pc)", "SP-602", "SP-602", "DEN-IK20", "8964001070022", 6, 1, 4200, 5400, 7, 4, 8, "G", "05", "12", [3, 4, 20]],
  ["Corolla Shock Absorber (Rear)", "SH-701", "SH-701", "TOY-48531", "8964001080014", 7, 4, 7500, 9500, 2, 3, 6, "H", "01", "06", [0, 1]],
  ["Civic Shock Absorber (Front)", "SH-702", "SH-702", "HON-51605", "8964001080021", 7, 5, 8200, 10500, 5, 3, 6, "H", "01", "07", [7]],
  ["Mehran Clutch Plate Set", "CL-801", "CL-801", "SUZ-22100", "8964001090013", 14, 6, 5500, 7000, 6, 4, 8, "I", "03", "02", [12]],
  ["Corolla Clutch Plate Set", "CL-802", "CL-802", "TOY-31210", "8964001090020", 14, 6, 9800, 12500, 3, 3, 6, "I", "03", "03", [0, 1]],
  ["NTN Wheel Bearing (Front)", "BR-901", "BR-901", "NTN-AU0930", "8964001100010", 13, 8, 2600, 3400, 10, 5, 10, "J", "04", "09", [0, 1, 7]],
  ["KOYO Wheel Bearing (Rear)", "BR-902", "BR-902", "KOY-DAC2552", "8964001100027", 13, 9, 2400, 3100, 0, 5, 10, "J", "04", "10", [7, 8]],
  ["Philips Headlight Bulb H4", "LT-1001", "LT-1001", "PHI-12342", "8964001110019", 11, 10, 950, 1300, 25, 10, 20, "K", "02", "01", [0, 1, 2, 7, 12]],
  ["Osram LED Headlight H11", "LT-1002", "LT-1002", "OSR-64211", "8964001110026", 11, 11, 3800, 4800, 8, 4, 8, "K", "02", "02", [20, 22]],
  ["Corolla Wiper Blade 22in", "WP-1101", "WP-1101", "TOY-85222", "8964001120018", 12, 3, 700, 1000, 30, 10, 20, "L", "01", "05", [0, 1]],
  ["Civic Wiper Blade 26in", "WP-1102", "WP-1102", "HON-76620", "8964001120025", 12, 3, 750, 1050, 18, 10, 20, "L", "01", "06", [7, 8]],
  ["Toyota Genuine Engine Oil 4L", "EO-1201", "EO-1201", "TOY-08880", "8964001130017", 8, 13, 5200, 6400, 14, 6, 12, "M", "05", "03", [0, 1, 2, 3]],
  ["Honda Genuine Coolant 4L", "CL-1202", "CL-1202", "HON-08C50", "8964001130024", 17, 14, 2800, 3500, 9, 5, 10, "M", "05", "04", [7, 8, 9]],
  ["Corolla Radiator", "RD-1301", "RD-1301", "TOY-16400", "8964001140016", 15, 1, 12500, 15800, 2, 2, 4, "N", "02", "08", [0, 1]],
  ["Mehran Radiator Fan Motor", "RD-1302", "RD-1302", "SUZ-17120", "8964001140023", 17, 3, 3200, 4100, 5, 3, 6, "N", "02", "09", [12]],
  ["Civic Alternator Belt", "BT-503", "BT-503", "HON-31110", "8964001060030", 5, 7, 1400, 1850, 7, 4, 8, "F", "02", "06", [7, 8]],
  ["Swift Air Filter", "AF-004", "AF-004", "SUZ-13780S", "8964001010042", 0, 0, 900, 1250, 6, 5, 10, "B", "04", "15", [14]],
  ["Alto Oil Filter", "OF-104", "OF-104", "SUZ-16510A", "8964001020041", 1, 12, 600, 850, 16, 6, 12, "A", "02", "08", [15]],
  ["Sportage Brake Pad (Front)", "BP-304", "BP-304", "KIA-58101", "8964001040049", 3, 3, 4800, 6100, 4, 4, 8, "D", "03", "11", [20]],
  ["Tucson Cabin Filter", "AF-005", "AF-005", "HYU-97133", "8964001010059", 0, 12, 1100, 1500, 10, 5, 10, "B", "04", "16", [22]],
  ["Picanto Spark Plug Set", "SP-603", "SP-603", "NGK-LKR7B", "8964001070039", 6, 2, 2200, 2900, 12, 6, 12, "G", "05", "13", [21]],
  ["City Brake Disc (Pair)", "BD-402", "BD-402", "HON-45251", "8964001050024", 4, 4, 6800, 8600, 3, 3, 6, "E", "01", "02", [9]],
  ["Wagon R Clutch Cable", "CL-803", "CL-803", "SUZ-23710", "8964001090037", 14, 0, 850, 1200, 14, 6, 12, "I", "03", "04", [16]],
  ["Bolan Leaf Spring Bush Kit", "SU-704", "SU-704", "SUZ-09319", "8964001080038", 7, 0, 1200, 1650, 8, 4, 8, "H", "01", "08", [17]],
  ["Hiace Diesel Filter", "FF-203", "FF-203", "TOY-23348", "8964001030033", 2, 1, 2400, 3100, 5, 4, 8, "C", "01", "04", [5]],
  ["Vezel Hybrid Battery Fan", "EL-1401", "EL-1401", "HON-1A101", "8964001150015", 9, 14, 8500, 10800, 1, 2, 4, "O", "03", "01", [11]],
  ["Prius Inverter Coolant Pump", "EL-1402", "EL-1402", "TOY-G9020", "8964001150022", 9, 1, 14500, 18200, 2, 2, 4, "O", "03", "02", [6]],
  ["Corolla Side Mirror (RH)", "BO-1501", "BO-1501", "TOY-87910", "8964001160014", 10, 13, 4800, 6200, 4, 3, 6, "P", "04", "03", [0, 1]],
  ["Civic Front Bumper", "BO-1502", "BO-1502", "HON-71101", "8964001160021", 10, 14, 11500, 14500, 2, 2, 4, "P", "04", "04", [7]],
  ["Mehran Headlight Assembly", "LT-1003", "LT-1003", "SUZ-35300", "8964001110033", 11, 0, 2900, 3700, 6, 4, 8, "K", "02", "03", [12]],
  ["Yaris Tail Light (LH)", "LT-1004", "LT-1004", "TOY-81560", "8964001110040", 11, 13, 5200, 6600, 3, 3, 6, "K", "02", "04", [2]],
  ["Camry Engine Mount", "EN-1601", "EN-1601", "TOY-12361", "8964001170013", 8, 3, 6800, 8600, 2, 2, 4, "Q", "01", "07", [28]],
  ["Accord Control Arm", "SU-705", "SU-705", "HON-51360", "8964001080045", 7, 3, 9200, 11600, 3, 2, 4, "H", "01", "09", [27]],
  ["Fortuner Tie Rod End", "ST-1701", "ST-1701", "TOY-45046", "8964001180012", 16, 9, 2100, 2800, 9, 5, 10, "R", "05", "05", [4]],
  ["Land Cruiser Oil Cooler Hose", "EN-1602", "EN-1602", "TOY-15767", "8964001170020", 8, 13, 3400, 4300, 4, 3, 6, "Q", "01", "08", [29]],
  ["Elantra Cabin Air Filter", "AF-006", "AF-006", "HYU-97133E", "8964001010066", 0, 12, 1050, 1400, 11, 5, 10, "B", "04", "17", [23]],
  ["BR-V Rear Brake Shoe", "BP-305", "BP-305", "HON-43153", "8964001040056", 3, 0, 2600, 3300, 7, 4, 8, "D", "03", "12", [10]],
  ["Dayz CVT Belt", "BT-504", "BT-504", "NIS-11720", "8964001060047", 5, 7, 5200, 6600, 2, 3, 6, "F", "02", "07", [26]],
  ["Mira AC Compressor", "CL-1203", "CL-1203", "DAI-88320", "8964001130031", 17, 1, 18500, 23000, 1, 2, 4, "M", "05", "05", [24]],
];

async function main() {
  // db module reads DATABASE_URL from env (dotenv loaded above).
  const { db } = await import("./index");

  console.log("Wiping existing ASIM001 data...");
  const t = schema;
  await db.delete(t.returnItems);
  await db.delete(t.returns);
  await db.delete(t.stockMovements);
  await db.delete(t.saleItems);
  await db.delete(t.sales);
  await db.delete(t.purchaseItems);
  await db.delete(t.purchases);
  await db.delete(t.productVehicles);
  await db.delete(t.products);
  await db.delete(t.vehicles);
  await db.delete(t.categories);
  await db.delete(t.brands);
  await db.delete(t.suppliers);
  await db.delete(t.customers);
  await db.delete(t.notifications);
  await db.delete(t.auditLogs);
  await db.delete(t.users);
  await db.delete(t.settings);
  await db.delete(t.shops);

  console.log("Creating shop + settings...");
  await db.insert(t.shops).values({
    id: SHOP_ID,
    name: "Asim Autos",
    city: "Faisalabad",
    phone: "041-8712345",
    address: "Main Jhang Road, Faisalabad, Punjab, Pakistan",
    currency: "PKR",
    invoicePrefix: "INV",
  });
  await db.insert(t.settings).values({
    shopId: SHOP_ID,
    shopName: "Asim Autos",
    phone: "041-8712345",
    address: "Main Jhang Road, Faisalabad, Punjab, Pakistan",
    city: "Faisalabad",
    currency: "PKR",
    invoicePrefix: "INV",
    taxRateBps: 0,
    defaultMinStock: 5,
    defaultReorderQty: 10,
    nextSaleInvoice: 1,
    businessHours: "Mon–Sat 9:00 AM – 9:00 PM",
  });

  console.log("Creating users...");
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
  const ownerHash = await bcrypt.hash(adminPass, 12);
  const staffHash = await bcrypt.hash("Staff@12345", 12);
  const [owner] = await db
    .insert(t.users)
    .values({
      shopId: SHOP_ID,
      name: "Asim (Owner)",
      email: "admin@asimautos.pk",
      passwordHash: ownerHash,
      role: "OWNER",
    })
    .returning();
  const [staff] = await db
    .insert(t.users)
    .values({
      shopId: SHOP_ID,
      name: "Shop Staff",
      email: "staff@asimautos.pk",
      passwordHash: staffHash,
      role: "STAFF",
    })
    .returning();
  const actor = { id: owner.id, shopId: SHOP_ID, role: "OWNER" as const };

  console.log("Creating catalog...");
  const catIds: string[] = [];
  for (const name of CATEGORIES) {
    const [c] = await db.insert(t.categories).values({ shopId: SHOP_ID, name }).returning();
    catIds.push(c.id);
  }
  const brandIds: string[] = [];
  for (const name of BRANDS) {
    const [b] = await db.insert(t.brands).values({ shopId: SHOP_ID, name }).returning();
    brandIds.push(b.id);
  }
  const vehicleIds: string[] = [];
  for (const [make, model, yearFrom, yearTo, engine, fuelType] of VEHICLES) {
    const [v] = await db
      .insert(t.vehicles)
      .values({ shopId: SHOP_ID, make, model, yearFrom, yearTo, engine, fuelType })
      .returning();
    vehicleIds.push(v.id);
  }
  const supplierIds: string[] = [];
  for (const [name, contactPerson, phone, city, address] of SUPPLIERS) {
    const [s] = await db
      .insert(t.suppliers)
      .values({ shopId: SHOP_ID, name, contactPerson, phone, city, address, paymentTerms: "Net 30" })
      .returning();
    supplierIds.push(s.id);
  }
  const customerIds: string[] = [];
  for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
    const [c] = await db
      .insert(t.customers)
      .values({
        shopId: SHOP_ID,
        name: CUSTOMER_NAMES[i],
        phone: `0300-${String(1000000 + int(0, 8999999))}`,
        address: pick(["Ghulam Muhammad Abad", "D Ground", "Satiana Road", "Jaranwala Road", "Millat Town"]) + ", Faisalabad",
        vehicle: i % 3 === 0 ? pick(CUSTOMER_VEHICLES) : undefined,
      })
      .returning();
    customerIds.push(c.id);
  }

  console.log("Creating products + opening stock...");
  const productIds: string[] = [];
  const productMeta: Array<{ id: string; salePrice: number }> = [];
  for (const p of PRODUCTS) {
    const [name, sku, partNumber, oemNumber, barcode, catIdx, brandIdx, purchPKR, salePKR, stock, min, reorder, rack, shelf, bin, vehIdx] = p;
    const [prod] = await db
      .insert(t.products)
      .values({
        shopId: SHOP_ID,
        name,
        sku,
        partNumber,
        oemNumber,
        barcode,
        categoryId: catIds[catIdx],
        brandId: brandIds[brandIdx],
        supplierId: pick(supplierIds),
        purchasePrice: purchPKR * 100,
        salePrice: salePKR * 100,
        minStock: min,
        reorderQty: reorder,
        rack, shelf, bin,
        description: `${name} — ${BRANDS[brandIdx]}. Fits: ${vehIdx.map((i) => `${VEHICLES[i][0]} ${VEHICLES[i][1]}`).join(", ")}.`,
      })
      .returning();
    for (const vi of vehIdx) {
      await db.insert(t.productVehicles).values({ productId: prod.id, vehicleId: vehicleIds[vi], shopId: SHOP_ID });
    }
    if (stock > 0) {
      await adjustStock(actor, prod.id, stock, "INITIAL", "Opening stock (seed)");
    }
    productIds.push(prod.id);
    productMeta.push({ id: prod.id, salePrice: salePKR * 100 });
  }

  console.log("Creating sample purchases...");
  for (let i = 0; i < 10; i++) {
    const nItems = int(2, 5);
    const items: Array<{ productId: string; quantity: number; purchasePrice: number; discount: number }> = [];
    const used = new Set<number>();
    for (let j = 0; j < nItems; j++) {
      let idx = int(0, productIds.length - 1);
      while (used.has(idx)) idx = int(0, productIds.length - 1);
      used.add(idx);
      const p = PRODUCTS[idx];
      items.push({
        productId: productIds[idx],
        quantity: int(4, 20),
        purchasePrice: p[7] * 100,
        discount: 0,
      });
    }
    const subtotal = items.reduce((s, it) => s + it.quantity * it.purchasePrice, 0);
    const paid = rand() < 0.6 ? subtotal : Math.round(subtotal * 0.5);
    try {
      const pur = await createPurchase(actor, {
        supplierId: pick(supplierIds),
        invoiceNumber: `SUP-2026-${String(101 + i)}`,
        purchaseDate: daysAgo(int(1, 55)),
        items,
        paidAmount: paid,
        notes: "Seed purchase",
      });
      void pur;
    } catch (e) {
      console.log("purchase seed note:", (e as Error).message);
    }
  }

  console.log("Creating sample sales...");
  let creditSales = 0;
  for (let i = 0; i < 30; i++) {
    const nItems = int(1, 4);
    const items: Array<{ productId: string; quantity: number }> = [];
    const used = new Set<number>();
    for (let j = 0; j < nItems; j++) {
      let idx = int(0, productIds.length - 1);
      while (used.has(idx)) idx = int(0, productIds.length - 1);
      used.add(idx);
      items.push({ productId: productIds[idx], quantity: int(1, 3) });
    }
    const isCredit = rand() < 0.3;
    try {
      await createSale(
        { id: i % 4 === 0 ? staff.id : owner.id, shopId: SHOP_ID, role: i % 4 === 0 ? "STAFF" : "OWNER" },
        {
          customerId: pick(customerIds),
          items,
          paymentMethod: isCredit ? "CREDIT" : pick(["CASH", "CASH", "BANK"] as const),
          paidAmount: undefined, // let tx decide (credit -> 0, else full)
          saleDate: daysAgo(int(0, 55)),
          notes: "Seed sale",
        }
      );
      if (isCredit) creditSales++;
    } catch (e) {
      // oversell on random data is fine — skip
    }
  }

  console.log("Creating sample returns...");
  try {
    await createCustomerReturn(actor, {
      customerId: customerIds[0],
      items: [{ productId: productIds[0], quantity: 1, unitPrice: PRODUCTS[0][8] * 100 }],
      notes: "Seed customer return",
    });
  } catch (e) { console.log("return seed note:", (e as Error).message); }
  try {
    await createSupplierReturn(actor, {
      supplierId: supplierIds[0],
      items: [{ productId: productIds[3], quantity: 2, unitPrice: PRODUCTS[3][7] * 100 }],
      notes: "Seed supplier return (damaged)",
    });
  } catch (e) { console.log("return seed note:", (e as Error).message); }

  console.log("Recording a supplier payment...");
  const openPurchases = await db
    .select()
    .from(t.purchases)
    .where(eq(t.purchases.shopId, SHOP_ID));
  const partial = openPurchases.find((p) => p.remaining > 0);
  if (partial) {
    try {
      await payPurchase(actor, partial.id, Math.min(partial.remaining, 5000 * 100));
    } catch (e) { console.log("pay seed note:", (e as Error).message); }
  }

  const counts = {
    products: productIds.length,
    categories: catIds.length,
    brands: brandIds.length,
    vehicles: vehicleIds.length,
    suppliers: supplierIds.length,
    customers: customerIds.length,
    creditSales,
  };
  console.log("SEED COMPLETE:", JSON.stringify(counts));
  console.log(`Owner login: admin@asimautos.pk / (SEED_ADMIN_PASSWORD or "Admin@12345")`);
  console.log(`Staff login: staff@asimautos.pk / "Staff@12345"`);
  process.exit(0);
}

main().catch((e) => {
  console.error("SEED FAILED:", e);
  process.exit(1);
});
