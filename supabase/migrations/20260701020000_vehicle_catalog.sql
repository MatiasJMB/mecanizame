-- ============================================================================
-- Mecanízame · Catálogo global de marcas y modelos de vehículos (referencia)
-- Tablas de solo lectura para todos (evitan errores de tipeo del mecánico).
-- Idempotente.
-- ============================================================================
create table if not exists public.vehicle_makes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int not null default 100
);
create table if not exists public.vehicle_models (
  id       uuid primary key default gen_random_uuid(),
  make_id  uuid not null references public.vehicle_makes(id) on delete cascade,
  name     text not null,
  unique (make_id, name)
);
create index if not exists idx_vehicle_models_make on public.vehicle_models(make_id);

alter table public.vehicle_makes  enable row level security;
alter table public.vehicle_models enable row level security;
drop policy if exists vehicle_makes_read  on public.vehicle_makes;
drop policy if exists vehicle_models_read on public.vehicle_models;
create policy vehicle_makes_read  on public.vehicle_makes  for select using (true);
create policy vehicle_models_read on public.vehicle_models for select using (true);
grant select on public.vehicle_makes, public.vehicle_models to anon, authenticated;

-- Marcas (las más comunes en Chile primero)
insert into public.vehicle_makes (name, sort_order) values
  ('Toyota',1),('Chevrolet',2),('Nissan',3),('Hyundai',4),('Kia',5),('Suzuki',6),('Mitsubishi',7),
  ('Ford',8),('Mazda',9),('Peugeot',10),('Volkswagen',11),('Honda',12),('Renault',13),('MG',14),
  ('Chery',15),('Great Wall',16),('Haval',17),('Ssangyong',18),('JAC',19),('Maxus',20),('Citroën',21),
  ('Fiat',22),('Jeep',23),('RAM',24),('Subaru',25),('Mercedes-Benz',26),('BMW',27),('Audi',28),
  ('Isuzu',29),('Foton',30),('Changan',31),('Dongfeng',32),('BYD',33),('Geely',34),('BAIC',35),
  ('DFSK',36),('Jetour',37),('Volvo',38),('Opel',39),('Dodge',40)
on conflict (name) do nothing;

-- Modelos
insert into public.vehicle_models (make_id, name)
select m.id, v.model
from (values
  ('Toyota','Hilux'),('Toyota','Land Cruiser'),('Toyota','Land Cruiser Prado'),('Toyota','Fortuner'),('Toyota','RAV4'),('Toyota','Corolla'),('Toyota','Corolla Cross'),('Toyota','Yaris'),('Toyota','Yaris Cross'),('Toyota','Hiace'),('Toyota','Tacoma'),('Toyota','4Runner'),('Toyota','Rush'),('Toyota','Camry'),('Toyota','Highlander'),('Toyota','Prius'),
  ('Chevrolet','D-Max'),('Chevrolet','Colorado'),('Chevrolet','Montana'),('Chevrolet','Tracker'),('Chevrolet','Captiva'),('Chevrolet','Trailblazer'),('Chevrolet','Groove'),('Chevrolet','Onix'),('Chevrolet','Sail'),('Chevrolet','Spark'),('Chevrolet','N300'),('Chevrolet','N400'),('Chevrolet','Silverado'),('Chevrolet','Suburban'),('Chevrolet','Cruze'),
  ('Nissan','Navara'),('Nissan','Frontier'),('Nissan','NP300'),('Nissan','Terra'),('Nissan','X-Trail'),('Nissan','Qashqai'),('Nissan','Kicks'),('Nissan','Versa'),('Nissan','Sentra'),('Nissan','March'),('Nissan','Note'),('Nissan','Pathfinder'),('Nissan','Murano'),('Nissan','Urvan'),('Nissan','V16'),
  ('Hyundai','Tucson'),('Hyundai','Santa Fe'),('Hyundai','Creta'),('Hyundai','Kona'),('Hyundai','Venue'),('Hyundai','Accent'),('Hyundai','Elantra'),('Hyundai','Grand i10'),('Hyundai','i10'),('Hyundai','i20'),('Hyundai','Porter'),('Hyundai','H100'),('Hyundai','H1'),('Hyundai','HR'),('Hyundai','Staria'),('Hyundai','Palisade'),
  ('Kia','Sportage'),('Kia','Sorento'),('Kia','Seltos'),('Kia','Stonic'),('Kia','Rio'),('Kia','Morning'),('Kia','Picanto'),('Kia','Cerato'),('Kia','Soul'),('Kia','Carnival'),('Kia','Frontier'),('Kia','K2500'),('Kia','Niro'),
  ('Suzuki','Swift'),('Suzuki','Baleno'),('Suzuki','Dzire'),('Suzuki','Ciaz'),('Suzuki','Celerio'),('Suzuki','Vitara'),('Suzuki','Grand Vitara'),('Suzuki','S-Cross'),('Suzuki','Jimny'),('Suzuki','Ertiga'),('Suzuki','Fronx'),('Suzuki','Baleno Cross'),
  ('Mitsubishi','L200'),('Mitsubishi','Montero'),('Mitsubishi','Montero Sport'),('Mitsubishi','Outlander'),('Mitsubishi','ASX'),('Mitsubishi','Eclipse Cross'),('Mitsubishi','Xpander'),('Mitsubishi','Mirage'),('Mitsubishi','Colt'),('Mitsubishi','Canter'),
  ('Ford','Ranger'),('Ford','F-150'),('Ford','Maverick'),('Ford','Everest'),('Ford','Territory'),('Ford','Escape'),('Ford','EcoSport'),('Ford','Bronco'),('Ford','Bronco Sport'),('Ford','Explorer'),('Ford','Edge'),('Ford','Focus'),('Ford','Fiesta'),('Ford','Transit'),
  ('Mazda','BT-50'),('Mazda','CX-3'),('Mazda','CX-30'),('Mazda','CX-5'),('Mazda','CX-60'),('Mazda','CX-9'),('Mazda','CX-90'),('Mazda','Mazda2'),('Mazda','Mazda3'),('Mazda','Mazda6'),
  ('Peugeot','Landtrek'),('Peugeot','Partner'),('Peugeot','Expert'),('Peugeot','Boxer'),('Peugeot','208'),('Peugeot','2008'),('Peugeot','3008'),('Peugeot','5008'),('Peugeot','301'),('Peugeot','308'),('Peugeot','408'),
  ('Volkswagen','Amarok'),('Volkswagen','Saveiro'),('Volkswagen','Tiguan'),('Volkswagen','T-Cross'),('Volkswagen','Taos'),('Volkswagen','Nivus'),('Volkswagen','Gol'),('Volkswagen','Polo'),('Volkswagen','Virtus'),('Volkswagen','Vento'),('Volkswagen','Transporter'),('Volkswagen','Crafter'),
  ('Honda','Civic'),('Honda','City'),('Honda','CR-V'),('Honda','HR-V'),('Honda','WR-V'),('Honda','BR-V'),('Honda','Fit'),('Honda','Accord'),('Honda','Pilot'),
  ('Renault','Duster'),('Renault','Oroch'),('Renault','Alaskan'),('Renault','Koleos'),('Renault','Captur'),('Renault','Stepway'),('Renault','Kwid'),('Renault','Sandero'),('Renault','Logan'),('Renault','Kangoo'),('Renault','Master'),('Renault','Trafic'),
  ('MG','MG3'),('MG','MG5'),('MG','ZS'),('MG','HS'),('MG','RX5'),('MG','One'),('MG','GT'),('MG','MG4'),
  ('Chery','Tiggo 2'),('Chery','Tiggo 2 Pro'),('Chery','Tiggo 3'),('Chery','Tiggo 4'),('Chery','Tiggo 7'),('Chery','Tiggo 8'),('Chery','Arrizo 5'),('Chery','Arrizo 6'),
  ('Great Wall','Wingle 5'),('Great Wall','Wingle 7'),('Great Wall','Poer'),('Great Wall','Steed'),
  ('Haval','H6'),('Haval','Jolion'),('Haval','H2'),('Haval','Dargo'),
  ('Ssangyong','Actyon'),('Ssangyong','Musso'),('Ssangyong','Korando'),('Ssangyong','Rexton'),('Ssangyong','Tivoli'),('Ssangyong','Torres'),('Ssangyong','Rodius'),
  ('JAC','T6'),('JAC','T8'),('JAC','T9'),('JAC','Sunray'),('JAC','S2'),('JAC','S3'),('JAC','JS3'),('JAC','JS4'),
  ('Maxus','T60'),('Maxus','T70'),('Maxus','T90'),('Maxus','G10'),('Maxus','V80'),('Maxus','D60'),
  ('Citroën','C3'),('Citroën','C3 Aircross'),('Citroën','C4 Cactus'),('Citroën','C5 Aircross'),('Citroën','Berlingo'),('Citroën','Jumpy'),('Citroën','Jumper'),
  ('Fiat','Toro'),('Fiat','Strada'),('Fiat','Titano'),('Fiat','Cronos'),('Fiat','Argo'),('Fiat','Mobi'),('Fiat','Pulse'),('Fiat','Fastback'),('Fiat','Ducato'),('Fiat','Fiorino'),
  ('Jeep','Renegade'),('Jeep','Compass'),('Jeep','Commander'),('Jeep','Cherokee'),('Jeep','Grand Cherokee'),('Jeep','Wrangler'),('Jeep','Gladiator'),
  ('RAM','700'),('RAM','1000'),('RAM','1500'),('RAM','2500'),('RAM','Rampage'),
  ('Subaru','Forester'),('Subaru','XV'),('Subaru','Crosstrek'),('Subaru','Outback'),('Subaru','Impreza'),('Subaru','Legacy'),('Subaru','WRX'),
  ('Mercedes-Benz','Sprinter'),('Mercedes-Benz','Vito'),('Mercedes-Benz','Clase A'),('Mercedes-Benz','Clase C'),('Mercedes-Benz','Clase E'),('Mercedes-Benz','GLA'),('Mercedes-Benz','GLC'),('Mercedes-Benz','GLE'),
  ('BMW','Serie 1'),('BMW','Serie 2'),('BMW','Serie 3'),('BMW','Serie 5'),('BMW','X1'),('BMW','X3'),('BMW','X5'),('BMW','X6'),
  ('Audi','A1'),('Audi','A3'),('Audi','A4'),('Audi','Q2'),('Audi','Q3'),('Audi','Q5'),('Audi','Q7'),
  ('Isuzu','D-Max'),('Isuzu','MU-X'),('Isuzu','N-Series'),
  ('Foton','Tunland'),('Foton','Terracota'),('Foton','View'),('Foton','Aumark'),('Foton','Toano'),
  ('Changan','CS15'),('Changan','CS35 Plus'),('Changan','CS55 Plus'),('Changan','Alsvin'),('Changan','Hunter'),('Changan','Uni-T'),
  ('Dongfeng','Rich 6'),('Dongfeng','DX3'),('Dongfeng','DX5'),('Dongfeng','DX7'),('Dongfeng','T5 Evo'),
  ('BYD','Dolphin'),('BYD','Yuan Plus'),('BYD','Song Plus'),('BYD','Han'),('BYD','Tang'),('BYD','Seal'),('BYD','Shark'),
  ('Geely','Coolray'),('Geely','Azkarra'),('Geely','Emgrand'),('Geely','Starray'),
  ('BAIC','X25'),('BAIC','X35'),('BAIC','X55'),('BAIC','BJ40'),
  ('DFSK','Glory 580'),('DFSK','C31'),('DFSK','C35'),('DFSK','K01'),
  ('Jetour','X70'),('Jetour','Dashing'),('Jetour','X90'),
  ('Volvo','XC40'),('Volvo','XC60'),('Volvo','XC90'),('Volvo','S60'),
  ('Opel','Corsa'),('Opel','Astra'),('Opel','Mokka'),('Opel','Grandland'),
  ('Dodge','Journey'),('Dodge','Durango'),('Dodge','RAM')
) as v(make, model)
join public.vehicle_makes m on m.name = v.make
on conflict (make_id, name) do nothing;
