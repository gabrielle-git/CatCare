export type PetSex = "male" | "female" | "unknown";
export type HouseholdRole = "owner" | "caregiver" | "viewer";
export type HealthRecordType = "vaccine" | "consultation" | "exam" | "medication" | "disease" | "allergy" | "surgery" | "deworming" | "other" | "hygiene";
export type NeonatalRecordType = "feeding" | "weight" | "urine" | "stool" | "temperature" | "observation";
export type ReminderStatus = "pending" | "done" | "snoozed" | "cancelled";
export type ExpenseCategory = "veterinary" | "food" | "medication" | "hygiene" | "accessory" | "transport" | "other";
export type ProductCategory = "dry_food" | "wet_food" | "litter" | "treat" | "hygiene" | "medicine" | "accessory" | "other";
export type PurchaseChannel = "physical_store" | "online_store" | "marketplace" | "delivery" | "veterinary" | "other";
export type HealthCopayServiceType =
  | "consultation"
  | "exam"
  | "surgery"
  | "hospitalization"
  | "vaccine"
  | "deworming"
  | "emergency"
  | "physiotherapy"
  | "other";
export type HealthPlanProvider = "petlove" | "other";
export type HealthPlanCoverageStatus = "covered" | "not_covered" | "partial";
export type BenefitMembershipKind = "petlove_club" | "petz_club" | "other";
export type MemoryType = "diary" | "milestone" | "photo";
export type PetLifeStage = "neonatal" | "kitten" | "adult" | "mature" | "senior" | "unknown";

export type Household = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  petlove_leve_base_fee_cents?: number | null;
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
  neutered_at: string | null;
  neutered_place: string | null;
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
  hygiene_subtype: string | null;
  hygiene_custom_label: string | null;
  created_at: string;
  updated_at: string;
};

export type NeonatalRecord = {
  id: string;
  household_id: string;
  pet_id: string;
  type: NeonatalRecordType;
  occurred_at: string;
  /** Legacy feeding quantity in ml. Prefer feeding_amount_value + feeding_amount_unit for new rows. */
  amount_ml: number | null;
  feeding_subtype: string | null;
  feeding_amount_value: number | null;
  feeding_amount_unit: string | null;
  weight_grams: number | null;
  temperature_c: number | null;
  quality: string | null;
  notes: string | null;
  created_at: string;
};

/** Canonical meal (1 per pet). Household via pets — no household_id column. */
export type FeedingSession = {
  id: string;
  pet_id: string;
  occurred_at: string;
  notes: string | null;
  quality: string | null;
  created_at: string;
  updated_at: string;
};

/** Component of a feeding session (1..N per session). */
export type FeedingItem = {
  id: string;
  session_id: string;
  subtype: string;
  custom_label: string | null;
  amount_value: number | null;
  amount_unit: string | null;
  created_at: string;
  updated_at: string;
};

export type FeedingSessionWithItems = FeedingSession & {
  feeding_items: FeedingItem[];
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
  subtotal_cents: number | null;
  discount_cents: number;
  coupon_code: string | null;
  /** @deprecated Prefer membership_id — kept for legacy rows */
  petlove_club: boolean;
  membership_id: string | null;
  purchased_at: string;
  product_url: string | null;
  notes: string | null;
  created_at: string;
};

export type HealthPlan = {
  id: string;
  household_id: string;
  pet_id: string;
  provider: HealthPlanProvider;
  plan_name: string;
  monthly_fee_cents: number | null;
  started_at: string | null;
  active: boolean;
  notes: string | null;
  coverage_summary: string | null;
  template_id: string | null;
  promo_coupon_code: string | null;
  zero_waiting_consultation: boolean;
  zero_waiting_vaccine: boolean;
  promo_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type HealthPlanCopayRule = {
  id: string;
  health_plan_id: string;
  service_type: HealthCopayServiceType;
  copay_cents: number | null;
  notes: string | null;
  coverage_status: HealthPlanCoverageStatus | null;
  coverage_notes: string | null;
  sort_order: number;
};

export type HealthPlanWithCopays = HealthPlan & { copay_rules: HealthPlanCopayRule[] };

export type HealthPlanTemplate = {
  id: string;
  household_id: string;
  provider: HealthPlanProvider;
  plan_name: string;
  coverage_summary: string | null;
  guide_id: string | null;
  created_at: string;
  updated_at: string;
};

export type HealthPlanGuide = {
  id: string;
  household_id: string;
  slug: string;
  title: string;
  provider: HealthPlanProvider;
  base_monthly_fee_cents: number | null;
  official_url: string | null;
  notes: string | null;
  payment_notes: string | null;
  waiting_notes: string | null;
  show_multi_pet_discount: boolean;
  created_at: string;
  updated_at: string;
};

export type HealthPlanGuideService = {
  id: string;
  guide_id: string;
  group_key: string;
  group_title: string;
  name: string;
  copay_cents: number;
  annual_limit: string | null;
  waiting_days: number;
  notes: string | null;
  sort_order: number;
  created_at: string;
};

export type HealthPlanGuideWithServices = HealthPlanGuide & { services: HealthPlanGuideService[] };

export type BenefitMembership = {
  id: string;
  household_id: string;
  kind: BenefitMembershipKind;
  custom_name: string | null;
  active: boolean;
  monthly_fee_cents: number | null;
  renews_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
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

export type Document = {
  id: string;
  household_id: string;
  pet_id: string | null;
  /** @deprecated Health attachments will use a dedicated link table. */
  health_record_id: string | null;
  category: string;
  title: string;
  /** @deprecated LEGACY — new documents use attachments via document_attachments. */
  storage_path: string | null;
  /** @deprecated LEGACY — prefer attachments.mime_type. */
  mime_type: string | null;
  created_at: string;
};

export type Attachment = {
  id: string;
  household_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
  created_by: string | null;
  created_at: string;
};

export type DocumentAttachment = {
  document_id: string;
  attachment_id: string;
  household_id: string;
  position: number;
  created_at: string;
};

export type AttachmentWithUrl = Attachment & {
  url: string | null;
  position: number;
};

export type DocumentWithAttachments = Document & {
  attachments: AttachmentWithUrl[];
  attachment_count: number;
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

export type CareRoutine = {
  id: string;
  household_id: string;
  title: string;
  icon_key: string;
  instructions: string | null;
  recurrence_days: number | null;
  preferred_time: string | null;
  starts_on: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CareRoutineCompletion = {
  id: string;
  household_id: string;
  routine_id: string;
  pet_id: string;
  completed_at: string;
  completed_by: string | null;
  created_at: string;
};

export type CareRoutineWithPets = CareRoutine & {
  pet_ids: string[];
};

export type TimelineTone = "lavender" | "rose" | "mint" | "peach";

export type RecordSource = "weight" | "health" | "neonatal" | "feeding";

export type TimelineItem = {
  id: string;
  pet_id: string;
  source: RecordSource;
  kind: "weight" | HealthRecordType | NeonatalRecordType | "feeding";
  title: string;
  detail: string | null;
  occurred_at: string;
  tone: TimelineTone;
};
