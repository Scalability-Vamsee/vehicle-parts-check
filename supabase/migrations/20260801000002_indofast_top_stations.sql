-- indofast_top_stations — top 5 Indofast swap stations per city (BLR + NCR)
-- Synced daily at 8 AM IST by edge function indofast-station-sync
-- 2026-08-01

CREATE TABLE IF NOT EXISTS indofast_top_stations (
  id            serial PRIMARY KEY,
  city          text NOT NULL CHECK (city IN ('BLR', 'NCR')),
  rank          int  NOT NULL CHECK (rank BETWEEN 1 AND 5),
  location      text NOT NULL,
  short_address text,
  address       text,
  cabinets      int,
  station_ids   text,
  lat           double precision,
  lng           double precision,
  total_bikes_visited int,
  home_bikes    int,
  stat_date     date,
  synced_at     timestamptz DEFAULT now(),
  UNIQUE(city, location)
);

ALTER TABLE indofast_top_stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read" ON indofast_top_stations
  FOR SELECT USING (auth.role() = 'authenticated');

-- Seed: top 5 BLR stations (coords from DS_DATA['in'] embedded in fw-map.html)
-- and top 5 NCR stations (coords from known metro/area locations)
INSERT INTO indofast_top_stations (city, rank, location, short_address, address, cabinets, station_ids, lat, lng) VALUES
  -- BLR
  ('BLR', 1, 'Marathahalli_Pvt_8 QIS',              'Marathahalli',        'BLR_PVT_Hub_ Marathahalli_Hub',                  8,  'WMQISXM1V1-00318,WMQISXM1V1-00883,WMQISXM1V1-00884,WMQISXM1V1-00885,WMQISXM1V1-01166,WMQISXM1V1-01167,WMQISXM1V1-01168,WMQISXM1V1-01170', 12.955365, 77.702537),
  ('BLR', 2, 'KSR Bengaluru city Railway station',   'Majestic',            'BLR_IRS_KSR,Railway station',                    4,  'WMQISXM1V1-00013,WMQISXM1V1-00750,WMQISXM1V1-00759,WMQISXM1V1-00763',                                                                     12.976799, 77.571213),
  ('BLR', 3, 'Powerpod- Yeswantpur-8',              'Yeshwanthpura',        'BLR_PPD_Industrial Suburb, Yeswanthpur',          8,  'WMQISXM1V1-00140,WMQISXM1V1-00529,WMQISXM1V1-00845,WMQISXM1V1-00877,WMQISXM1V1-02019,WMQISXM1V1-02270,WMQISXM1V1-02443,WMQISXM1V1-02476', 13.023495, 77.541252),
  ('BLR', 4, 'JP Nagar 1st Phase',                  'Shakambari Nagar',    'BLR_FRN_JP Nagar 1st Phase,9th cross',           10,  'WMQISXM1V1-00626,WMQISXM1V1-00959,WMQISXM1V1-00960,WMQISXM1V1-00963,WMQISXM1V1-00965,WMQISXM1V1-00966,WMQISXM1V1-00967,WMQISXM1V1-00968,WMQISXM1V1-00969,WMQISXM1V1-00970', 12.911071, 77.577518),
  ('BLR', 5, 'RR Nagar PVT_ 8 QIS',                'RR Nagar',             'BLR_PVT_Hub_Hammigepura,Pattanagere Village',     8,  'WMQISXM1V1-00846,WMQISXM1V1-00848,WMQISXM1V1-00858,WMQISXM1V1-00863,WMQISXM1V1-00864,WMQISXM1V1-00866,WMQISXM1V1-00867,WMQISXM1V1-00896', 12.924152, 77.502879),
  -- NCR
  ('NCR', 1, 'Patparganj Market 3',                 'Patparganj',           'DEL_BYPL_Patparganj Market',                      3,  'WMQISXM1V1-01047,WMQISXM1V1-01081,WMQISXM1V1-01082',                                                                                      28.623700, 77.296500),
  ('NCR', 2, 'Okhla Vihar',                         'Okhla Vihar',          'DEL_STQ_Okhla_Vihar',                             3,  'WMQISXM1V1-01367,WMQISXM1V1-01368,WMQISXM1V1-01369',                                                                                      28.543300, 77.271900),
  ('NCR', 3, 'Rithala',                             'Rithala',              'DEL_DMR_NVN_Rithala Metro Station',               3,  'WMQISXM1V1-01421,WMQISXM1V1-01422,WMQISXM1V1-01492',                                                                                      28.725700, 77.107400),
  ('NCR', 4, 'Ghitorni 3',                          'Ghitorni Metro Station','DEL_STQ_Ghitorni',                               3,  'WMQISXM1V1-00286,WMQISXM1V1-00321,WMQISXM1V1-00361',                                                                                      28.497800, 77.146800),
  ('NCR', 5, 'BRPL- Nehru Place 3',                 'Nehru Place',          'DEL_BRP_Nehru Place',                             3,  'WMQISXM1V1-00380,WMQISXM1V1-00383,WMQISXM1V1-00419',                                                                                      28.547700, 77.251200)
ON CONFLICT (city, location) DO NOTHING;
