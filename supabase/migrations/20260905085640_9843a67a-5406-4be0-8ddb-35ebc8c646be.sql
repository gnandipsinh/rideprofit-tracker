insert into public.vehicles (name, type, model, vehicle_number, notes)
select * from (values
  ('Eicher Pro 2049', 'Truck', 'Pro 2049', 'GJ 01 AB 4521', 'City distribution'),
  ('Eicher Pro 3015', 'Truck', 'Pro 3015', 'GJ 05 CD 7788', 'Long haul'),
  ('Eicher Pro 6028', 'Trailer', 'Pro 6028', 'GJ 18 EF 1090', 'Heavy load')
) as v(name, type, model, vehicle_number, notes)
where not exists (select 1 from public.vehicles x where x.vehicle_number = v.vehicle_number);

update public.vehicles set vehicle_number = 'GJ 27 XY 1122', type = coalesce(nullif(type,''),'Truck'), model = coalesce(nullif(model,''),'Pro 2114')
where vehicle_number = '' or vehicle_number is null;

insert into public.trips (vehicle_id, date, income, diesel, driver_payment, emi_share, other_expense_items, notes)
select v.id,
       (current_date - ((g * 3)::int))::date,
       12000 + (g * 137) % 9000,
       4000 + (g * 91) % 2500,
       800 + (g * 37) % 700,
       1500,
       jsonb_build_array(
         jsonb_build_object('name','Toll','amount', 300 + (g * 17) % 400),
         jsonb_build_object('name','Loading','amount', 200 + (g * 23) % 300)
       ),
       'Demo trip'
from public.vehicles v
cross join generate_series(0, 39) g
where not exists (select 1 from public.trips t where t.vehicle_id = v.id and t.notes = 'Demo trip');
