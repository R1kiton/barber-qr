-- Nullable for compatibility: existing shops retain their current opening hours.
ALTER TABLE "shops" ADD COLUMN "weekly_hours" JSONB;
ALTER TABLE "shops" ADD CONSTRAINT "shops_weekly_hours_array"
CHECK (weekly_hours IS NULL OR
  (jsonb_typeof(weekly_hours) = 'array' AND jsonb_array_length(weekly_hours) = 7));
