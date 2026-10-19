-- Onboarding de Owner Operator desde la landing: nuevo, driver nuevo o camión nuevo para un OO existente
alter table onboarding_tokens add column if not exists oo_mode text;                 -- new | add_driver | add_truck
alter table onboarding_tokens add column if not exists existing_owner_driver_id uuid; -- OO que es su propio driver (sin ficha de investor)
