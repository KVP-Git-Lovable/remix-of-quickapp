-- Default Units of Measure — ships with the application as FIXED CONFIG.
-- Idempotent (ON CONFLICT DO NOTHING + guarded FK): safe on fresh remix, preprod, and prod.
-- Admins enable/disable units in the Unit Master; enabled units appear in the product unit pickers.

-- 1) Categories
INSERT INTO public.uom_category (id,code,name,is_system,enabled,sort_order,created_at,updated_at) VALUES
('9720abe0-7975-48fd-b6f7-2fde0fd63fbb','Weight','Weight','t','t',10,now(),now()),
('8ed8de9c-7045-4107-b2fe-6ed176793027','Volume','Volume','t','t',20,now(),now()),
('64eeef57-5321-401c-ae1d-dd9c5bbbf45c','Length','Length','t','t',30,now(),now()),
('3707d228-588f-4d42-b509-3b201e7f7c56','Quantity','Quantity','t','t',40,now(),now()),
('75534f99-98dd-4081-8a86-4af3f4c45198','Medication','Medication','t','t',50,now(),now()),
('71d42d6a-44a8-443f-83ad-a0e14b15f5ea','Electronics','Electronics','t','t',60,now(),now()),
('b13adf0b-f917-4959-ac0b-d94f207fe9f9','Packaging','Packaging','t','t',70,now(),now())
ON CONFLICT (id) DO NOTHING;
-- code must equal the capitalized category name to match uom_master.category (grouping key).
UPDATE public.uom_category SET code = name WHERE code <> name;

-- 2) Units
INSERT INTO public.uom_master (id,code,name,category,is_base,is_system,category_id,conversion_to_base,created_at,updated_at) VALUES
('89618a54-7416-46d6-b583-41aed9014217','TRAY','Tray','Quantity','f','t','3707d228-588f-4d42-b509-3b201e7f7c56',NULL,now(),now()),
('7dd1f11f-2184-464b-b23b-5b6ea0bc9a83','TABLET','Tablet','Quantity','f','t','3707d228-588f-4d42-b509-3b201e7f7c56',NULL,now(),now()),
('6c1a403b-7c23-43fb-8651-761582f00a71','STRIP','Strip','Quantity','f','t','3707d228-588f-4d42-b509-3b201e7f7c56',NULL,now(),now()),
('53617afb-7ed9-4f36-ac55-ce257fae9fb3','PACKET','Packet','Quantity','f','t','3707d228-588f-4d42-b509-3b201e7f7c56',NULL,now(),now()),
('284b0920-1006-40ae-928c-99ff7f2576a3','DOZEN','Dozen','Quantity','f','t','3707d228-588f-4d42-b509-3b201e7f7c56',NULL,now(),now()),
('2738ddcb-cb00-4989-a91b-68e7ecf799b6','CARTON','Carton','Quantity','f','t','3707d228-588f-4d42-b509-3b201e7f7c56',NULL,now(),now()),
('19c3710f-16fe-44f4-a844-310a03c7e49a','BOX','Box','Quantity','f','t','3707d228-588f-4d42-b509-3b201e7f7c56',NULL,now(),now()),
('6f346893-6c01-4e4b-b705-b63c3cba9afb','GRAM','Gram','Weight','t','t','9720abe0-7975-48fd-b6f7-2fde0fd63fbb',1,now(),now()),
('e5702c3d-0baa-4428-9188-412d5c0ddcba','ML','Millilitre','Volume','t','t','8ed8de9c-7045-4107-b2fe-6ed176793027',1,now(),now()),
('8411140a-1a64-426d-8bd7-c81e5270eb99','MM','Millimeter','Length','t','t','64eeef57-5321-401c-ae1d-dd9c5bbbf45c',1,now(),now()),
('8ff41049-a84b-408f-86a5-66a7c13cb45f','PIECE','Piece','Quantity','t','t','3707d228-588f-4d42-b509-3b201e7f7c56',1,now(),now()),
('e52389b9-c3bf-436d-90ac-a520c2d78990','KG','Kilogram','Weight','f','t','9720abe0-7975-48fd-b6f7-2fde0fd63fbb',1000,now(),now()),
('1bd80346-da85-4c7e-b595-c12731b73402','MG','Milligram','Weight','f','t','9720abe0-7975-48fd-b6f7-2fde0fd63fbb',0.001,now(),now()),
('23380f0b-e3b8-4b55-bdf8-5f537c0539db','TON','Metric ton','Weight','f','t','9720abe0-7975-48fd-b6f7-2fde0fd63fbb',1000000,now(),now()),
('72075e5b-c9f3-48f1-b8af-d3e813384886','OZ','Ounce','Weight','f','t','9720abe0-7975-48fd-b6f7-2fde0fd63fbb',28.3495,now(),now()),
('82d7cda4-3eda-4db8-8d2a-2e449d3c47ef','LB','Pound','Weight','f','t','9720abe0-7975-48fd-b6f7-2fde0fd63fbb',453.592,now(),now()),
('f9c1591f-adca-43e8-a142-e78c9f5dddf1','LITRE','Litre','Volume','f','t','8ed8de9c-7045-4107-b2fe-6ed176793027',1000,now(),now()),
('ab82658a-3fec-4f89-923c-ca218d290ed9','GAL','Gallon','Volume','f','t','8ed8de9c-7045-4107-b2fe-6ed176793027',3785.41,now(),now()),
('7898d6a7-e3c4-4a69-8be5-5e38019e0ecc','FL_OZ','Fluid ounce','Volume','f','t','8ed8de9c-7045-4107-b2fe-6ed176793027',29.5735,now(),now()),
('a9fe8c57-fac0-43d4-9a82-7bdb2b3a8951','CM','Centimeter','Length','f','t','64eeef57-5321-401c-ae1d-dd9c5bbbf45c',10,now(),now()),
('b536c676-1736-4218-9579-8d75bea126e0','INCH','Inch','Length','f','t','64eeef57-5321-401c-ae1d-dd9c5bbbf45c',25.4,now(),now()),
('bb155bfa-a3e8-48e4-a502-70535fe7cdbd','FT','Foot','Length','f','t','64eeef57-5321-401c-ae1d-dd9c5bbbf45c',304.8,now(),now()),
('ab9c1241-5334-4c09-896c-e2c5caefff8e','M','Meter','Length','f','t','64eeef57-5321-401c-ae1d-dd9c5bbbf45c',1000,now(),now()),
('abe12e6d-66c9-4aeb-ad12-6ffd247397a7','KM','Kilometer','Length','f','t','64eeef57-5321-401c-ae1d-dd9c5bbbf45c',1000000,now(),now()),
('ea7428b2-88a2-43e0-b8d4-90357264566b','VIAL','Vial','Medication','f','t','75534f99-98dd-4081-8a86-4af3f4c45198',NULL,now(),now()),
('e4ce55fd-9469-450b-8a0c-ed7caf006f32','STRIP_M','Strip','Medication','f','t','75534f99-98dd-4081-8a86-4af3f4c45198',NULL,now(),now()),
('e37599da-e030-4d41-bfeb-4fe27325d08b','SACHET','Sachet','Medication','f','t','75534f99-98dd-4081-8a86-4af3f4c45198',NULL,now(),now()),
('e2872d2e-1290-4ad0-8ec3-c4a64fcd7a64','DROP','Drop','Medication','f','t','75534f99-98dd-4081-8a86-4af3f4c45198',NULL,now(),now()),
('d768e366-3aed-4186-853e-959003c86bf7','CAPSULE','Capsule','Medication','f','t','75534f99-98dd-4081-8a86-4af3f4c45198',NULL,now(),now()),
('ccdae0a8-c791-49d9-bbf8-15b3c449123b','BOTTLE','Bottle','Medication','f','t','75534f99-98dd-4081-8a86-4af3f4c45198',NULL,now(),now()),
('cc58989a-6f3f-479c-81e8-0030c487089f','BLISTER','Blister','Medication','f','t','75534f99-98dd-4081-8a86-4af3f4c45198',NULL,now(),now()),
('bc1b5f77-41a9-4777-9357-2b145cd2a2f4','AMPOULE','Ampoule','Medication','f','t','75534f99-98dd-4081-8a86-4af3f4c45198',NULL,now(),now()),
('fc8dde2a-9db5-4030-b4f0-a87240935747','TUBE','Tube','Electronics','f','t','71d42d6a-44a8-443f-83ad-a0e14b15f5ea',NULL,now(),now()),
('f8458c2e-6ce6-44fc-87cb-2aff601d2bf9','TRAY_E','Tray','Electronics','f','t','71d42d6a-44a8-443f-83ad-a0e14b15f5ea',NULL,now(),now()),
('f442462a-8305-4cbf-92ca-88aa7ac59e32','SPOOL','Spool','Electronics','f','t','71d42d6a-44a8-443f-83ad-a0e14b15f5ea',NULL,now(),now()),
('f164a030-519b-4ce5-9383-e0df7ee10af0','REEL','Reel','Electronics','f','t','71d42d6a-44a8-443f-83ad-a0e14b15f5ea',NULL,now(),now()),
('eaeece49-2124-486d-a121-8cd9c6d7bf09','PIECE_E','Piece','Electronics','f','t','71d42d6a-44a8-443f-83ad-a0e14b15f5ea',NULL,now(),now()),
('e65710d4-c681-4dd5-907b-0d17d0714933','ROLL','Roll','Packaging','f','t','b13adf0b-f917-4959-ac0b-d94f207fe9f9',NULL,now(),now()),
('32bcaacf-c9bb-4b53-b881-c5769db9fb75','PALLET','Pallet','Packaging','f','t','b13adf0b-f917-4959-ac0b-d94f207fe9f9',NULL,now(),now()),
('1f67389c-fe9f-4a1c-8e39-b105f017a288','CRATE','Crate','Packaging','f','t','b13adf0b-f917-4959-ac0b-d94f207fe9f9',NULL,now(),now()),
('1f2058be-7b69-4a26-bdab-bb5758ce6bc1','BOLT','Bolt','Packaging','f','t','b13adf0b-f917-4959-ac0b-d94f207fe9f9',NULL,now(),now())
ON CONFLICT (id) DO NOTHING;

-- 3) Default enabled set (admins can change this later in the Unit Master)
INSERT INTO public.enabled_units (uom_id,enabled,is_default,display_order,is_default_sales,is_default_purchase,updated_at) VALUES
('7dd1f11f-2184-464b-b23b-5b6ea0bc9a83','f','f',2,'f','f',now()),('8411140a-1a64-426d-8bd7-c81e5270eb99','f','f',1,'f','f',now()),
('b536c676-1736-4218-9579-8d75bea126e0','f','f',4,'f','f',now()),('e65710d4-c681-4dd5-907b-0d17d0714933','f','f',1,'f','f',now()),
('1f2058be-7b69-4a26-bdab-bb5758ce6bc1','f','f',6,'f','f',now()),('72075e5b-c9f3-48f1-b8af-d3e813384886','f','f',7,'f','f',now()),
('fc8dde2a-9db5-4030-b4f0-a87240935747','f','f',2,'f','f',now()),('bb155bfa-a3e8-48e4-a502-70535fe7cdbd','f','f',1,'f','f',now()),
('32bcaacf-c9bb-4b53-b881-c5769db9fb75','f','f',4,'f','f',now()),('f8458c2e-6ce6-44fc-87cb-2aff601d2bf9','f','f',6,'f','f',now()),
('ea7428b2-88a2-43e0-b8d4-90357264566b','f','f',5,'f','f',now()),('ab9c1241-5334-4c09-896c-e2c5caefff8e','f','f',3,'f','f',now()),
('e2872d2e-1290-4ad0-8ec3-c4a64fcd7a64','f','f',3,'f','f',now()),('89618a54-7416-46d6-b583-41aed9014217','f','f',4,'f','f',now()),
('ab82658a-3fec-4f89-923c-ca218d290ed9','f','f',6,'f','f',now()),('6f346893-6c01-4e4b-b705-b63c3cba9afb','t','f',2,'f','f',now()),
('f9c1591f-adca-43e8-a142-e78c9f5dddf1','t','f',5,'f','f',now()),('2738ddcb-cb00-4989-a91b-68e7ecf799b6','t','f',4,'f','f',now()),
('19c3710f-16fe-44f4-a844-310a03c7e49a','t','f',2,'f','f',now()),('53617afb-7ed9-4f36-ac55-ce257fae9fb3','t','f',5,'f','f',now()),
('8ff41049-a84b-408f-86a5-66a7c13cb45f','t','f',4,'f','f',now()),('e5702c3d-0baa-4428-9188-412d5c0ddcba','t','f',1,'f','f',now()),
('284b0920-1006-40ae-928c-99ff7f2576a3','t','f',0,'f','f',now()),('6c1a403b-7c23-43fb-8651-761582f00a71','t','f',0,'f','f',now()),
('e52389b9-c3bf-436d-90ac-a520c2d78990','t','f',1,'t','f',now()),('e4ce55fd-9469-450b-8a0c-ed7caf006f32','f','f',3,'f','f',now()),
('eaeece49-2124-486d-a121-8cd9c6d7bf09','f','f',0,'f','f',now()),('ccdae0a8-c791-49d9-bbf8-15b3c449123b','f','f',0,'f','f',now()),
('a9fe8c57-fac0-43d4-9a82-7bdb2b3a8951','f','f',0,'f','f',now()),('abe12e6d-66c9-4aeb-ad12-6ffd247397a7','f','f',0,'f','f',now()),
('cc58989a-6f3f-479c-81e8-0030c487089f','f','f',0,'f','f',now()),('d768e366-3aed-4186-853e-959003c86bf7','f','f',0,'f','f',now()),
('f164a030-519b-4ce5-9383-e0df7ee10af0','f','f',0,'f','f',now()),('7898d6a7-e3c4-4a69-8be5-5e38019e0ecc','f','f',0,'f','f',now()),
('f442462a-8305-4cbf-92ca-88aa7ac59e32','f','f',0,'f','f',now()),('bc1b5f77-41a9-4777-9357-2b145cd2a2f4','f','f',0,'f','f',now()),
('23380f0b-e3b8-4b55-bdf8-5f537c0539db','f','f',0,'f','f',now()),('1f67389c-fe9f-4a1c-8e39-b105f017a288','f','f',0,'f','f',now()),
('e37599da-e030-4d41-bfeb-4fe27325d08b','f','f',0,'f','f',now()),('1bd80346-da85-4c7e-b595-c12731b73402','f','f',0,'f','f',now()),
('82d7cda4-3eda-4db8-8d2a-2e449d3c47ef','f','f',0,'f','f',now())
ON CONFLICT (uom_id) DO NOTHING;

-- 4) FK the app's enabled_units!inner(...) embeds depend on (guarded)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enabled_units_uom_id_fkey'
      AND conrelid = 'public.enabled_units'::regclass
  ) THEN
    ALTER TABLE public.enabled_units
      ADD CONSTRAINT enabled_units_uom_id_fkey
      FOREIGN KEY (uom_id) REFERENCES public.uom_master(id) ON DELETE CASCADE;
  END IF;
END $$;
