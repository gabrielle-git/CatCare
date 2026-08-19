export type PetSex = "male" | "female" | "unknown";
export type HouseholdRole = "owner" | "caregiver" | "viewer";
export type HealthRecordType = "vaccine" | "consultation" | "exam" | "medication" | "disease" | "allergy" | "surgery" | "other";
export type NeonatalRecordType = "feeding" | "weight" | "urine" | "stool" | "temperature" | "observation";
export type ReminderStatus = "pending" | "done" | "snoozed" | "cancelled";
export type ExpenseCategory = "veterinary" | "food" | "medication" | "hygiene" | "accessory" | "transport" | "other";
export type ProductCategory = "dry_food" | "wet_food" | "litter" | "treat" | "hygiene" | "medicine" | "accessory" | "other";
export type PurchaseChannel = "physical_store" | "online_store" | "marketplace" | "delivery" | "veterinary" | "other";
export type MemoryType = "diary" | "milestone" | "photo";
export type PetLifeStage = "neonatal" | "kitten" | "adult" | "mature" | "senior" | "unknown";

export type Household = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
};

export type Pet = {
  id: string;
  household_id: string;
  name: string;
  sex: PetSex;
  birth_date: string | null;
  birth_date_estimated: boolean;
  species: string;
  breed: string | null;
  color: string | null;
  photo_path: string | null;
  current_weight_grams: number | null;
  neutered: boolean;
  has_microchip: boolean;
  microchip_number: string | null;
  microchip_implanted_at: string | null;
  microchip_location: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PetWithPhotoUrl = Pet & { photo_url: string | null };

export type WeightRecord = {
  id: string;
  household_id: string;
  pet_id: string;
  weight_grams: number;
  measured_at: string;
  notes: string | null;
  created_at: string;
};

export type HealthRecord = {
  id: string;
  household_id: string;
  pet_id: string;
  type: HealthRecordType;
  title: string;
  occurred_at: string;
  clinic_or_vet: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NeonatalRecord = {
  id: string;
  household_id: string;
  pet_id: string;
  type: NeonatalRecordType;
  occurred_at: string;
  amount_ml: number | null;
  weight_grams: number | null;
  temperature_c: number | null;
  quality: string | null;
  notes: string | null;
  created_at: string;
};

export type Reminder = {
  id: string;
  household_id: string;
  pet_id: string | null;
  health_record_id: string | null;
  title: string;
  category: string;
  due_at: string;
  recurrence_rule: string | null;
  status: ReminderStatus;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: string;
  household_id: string;
  pet_id: string | null;
  pet_ids?: string[];
  purchase_id?: string | null;
  health_record_id: string | null;
  category: ExpenseCategory;
  description: string;
  amount_cents: number;
  occurred_at: string;
  shared: boolean;
  receipt_path: string | null;
  notes: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  household_id: string;
  name: string;
  brand: string | null;
  category: ProductCategory;
  package_size: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Purchase = {
  id: string;
  household_id: string;
  product_id: string;
  pet_id: string | null;
  pet_ids?: string[];
  expense_id: string | null;
  store_name: string;
  channel: PurchaseChannel;
  quantity: number;
  amount_cents: number;
  purchased_at: string;
  product_url: string | null;
  notes: string | null;
  created_at: string;
};

export type ProductReview = {
  id: string;
  household_id: string;
  product_id: string;
  pet_id: string | null;
  pet_ids?: string[];
  quality_score: number;
  acceptance_score: number;
  cost_benefit_score: number;
  would_buy_again: boolean;
  notes: string | null;
  reviewed_at: string;
  created_at: string;
  updated_at: string;
};

export type Memory = {
  id: string;
  household_id: string;
  pet_id: string | null;
  type: MemoryType;
  title: string;
  body: string | null;
  occurred_at: string;
  media_path: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MemoryMedia = {
  id: string;
  household_id: string;
  memory_id: string;
  storage_path: string;
  position: number;
  created_at: string;
};

export type MemoryMediaWithUrl = MemoryMedia & { url: string | null };

export type MemoryWithMediaUrl = Memory & {
  media_url: string | null;
  media: MemoryMediaWithUrl[];
  pet_ids: string[];
};

export type TimelineTone = "lavender" | "rose" | "mint" | "peach";

export type RecordSource = "weight" | "health" | "neonatal";

export type TimelineItem = {
  id: string;
  pet_id: string;
  source: RecordSource;
  kind: "weight" | HealthRecordType | NeonatalRecordType;
  title: string;
  detail: string | null;
  occurred_at: string;
  tone: TimelineTone;
};
