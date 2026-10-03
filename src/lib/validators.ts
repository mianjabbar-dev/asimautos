import { z } from "zod";

/** Accepts "1,250.50", "PKR 1250", 1250 etc. -> validated PKR number string for parsePaisaInput */
const moneyInput = z.union([z.string(), z.number()]);

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(200),
  sku: optionalText,
  partNumber: optionalText,
  oemNumber: optionalText,
  barcode: optionalText,
  categoryId: optionalText,
  brandId: optionalText,
  supplierId: optionalText,
  purchasePrice: moneyInput,
  salePrice: moneyInput,
  currentStock: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(0),
  maxStock: z.coerce.number().int().min(0).optional(),
  reorderQty: z.coerce.number().int().min(0).default(0),
  rack: optionalText,
  shelf: optionalText,
  bin: optionalText,
  imageUrl: optionalText,
  description: optionalText,
  active: z.coerce.boolean().default(true),
  vehicleIds: z.array(z.string()).default([]),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: optionalText,
});

export const brandSchema = categorySchema;

export const vehicleSchema = z.object({
  make: z.string().trim().min(1, "Make is required").max(100),
  model: z.string().trim().min(1, "Model is required").max(100),
  variant: optionalText,
  yearFrom: z.coerce.number().int().min(1950).max(2100).optional(),
  yearTo: z.coerce.number().int().min(1950).max(2100).optional(),
  engine: optionalText,
  fuelType: optionalText,
  notes: optionalText,
});

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Supplier name is required").max(200),
  contactPerson: optionalText,
  phone: optionalText,
  whatsapp: optionalText,
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
  address: optionalText,
  city: optionalText,
  paymentTerms: optionalText,
  notes: optionalText,
});

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(200),
  phone: optionalText,
  address: optionalText,
  vehicle: optionalText,
  notes: optionalText,
});

export const purchaseItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive("Quantity must be positive"),
  purchasePrice: moneyInput,
  discount: moneyInput.optional().default(0),
});

export const purchaseSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  invoiceNumber: z.string().trim().min(1, "Invoice number is required").max(100),
  purchaseDate: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1, "Add at least one product"),
  paidAmount: moneyInput.optional().default(0),
  notes: optionalText,
});

export const saleItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive("Quantity must be positive"),
  salePrice: moneyInput.optional(),
  discount: moneyInput.optional().default(0),
});

export const saleSchema = z.object({
  customerId: z.string().optional(),
  items: z.array(saleItemSchema).min(1, "Add at least one product"),
  discount: moneyInput.optional().default(0),
  paidAmount: moneyInput.optional(),
  paymentMethod: z.enum(["CASH", "BANK", "CREDIT", "OTHER"]).default("CASH"),
  notes: optionalText,
});

export const returnItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive("Quantity must be positive"),
  unitPrice: moneyInput,
});

export const customerReturnSchema = z.object({
  saleId: z.string().optional(),
  customerId: z.string().optional(),
  items: z.array(returnItemSchema).min(1, "Add at least one product"),
  notes: optionalText,
});

export const supplierReturnSchema = z.object({
  purchaseId: z.string().optional(),
  supplierId: z.string().min(1, "Supplier is required"),
  items: z.array(returnItemSchema).min(1, "Add at least one product"),
  notes: optionalText,
});

export const stockAdjustSchema = z.object({
  productId: z.string().min(1),
  newQty: z.coerce.number().int().min(0, "Quantity cannot be negative"),
  reason: z.enum(["DAMAGE", "LOST", "ADJUSTMENT", "INITIAL"]),
  note: optionalText,
});

export const userSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["OWNER", "STAFF"]).default("STAFF"),
});

export const settingsSchema = z.object({
  shopName: z.string().trim().min(1).max(100),
  phone: optionalText,
  address: optionalText,
  city: z.string().trim().min(1).max(100),
  invoicePrefix: z.string().trim().min(1).max(10),
  taxRateBps: z.coerce.number().int().min(0).max(10000).default(0),
  defaultMinStock: z.coerce.number().int().min(0).default(5),
  defaultReorderQty: z.coerce.number().int().min(0).default(10),
  businessHours: optionalText,
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
