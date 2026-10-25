-- NGO directory: provenance, coverage and precision columns, reports table, sourced data.
-- Every record carries the public source it came from and the date it was checked, and the
-- UI tells teachers to confirm details before relying on them. Coordinates are suburb- or
-- city-level centroids (location_precision), not exact street positions.

ALTER TABLE ngos ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS last_checked DATE;
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS coverage VARCHAR(20) NOT NULL DEFAULT 'local'
    CHECK (coverage IN ('local', 'national'));
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS location_precision VARCHAR(20) NOT NULL DEFAULT 'address'
    CHECK (location_precision IN ('address', 'suburb', 'city', 'none'));
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS description TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ngos_name ON ngos(name);

-- The old seed rows had placeholder-looking addresses and phone numbers. Hide them.
UPDATE ngos SET verified = false
WHERE name IN ('Autism SA - Johannesburg', 'KZN Autism Centre', 'Cape Autism Network');

INSERT INTO ngos (name, province, city, address, latitude, longitude, services, contact_phone,
                  contact_email, website, rating, verified, source_url, last_checked, coverage,
                  location_precision, description)
VALUES
('Autism Western Cape', 'Western Cape', 'Cape Town (Mowbray)', '94 Durban Road, Mowbray, 7700',
 -33.9460, 18.4750, ARRAY['Autism', 'Parent support groups', 'School support programmes', 'Counselling'],
 '021 685 9581', 'admin@awc.org.za', NULL, 0, true,
 'https://westerncape.gov.za/facility/autism-western-cape', '2026-10-25', 'local', 'suburb',
 'Non-profit founded in 1967 supporting children with autism and their families; services free of charge.'),
('Centre for Autism Research in Africa (UCT)', 'Western Cape', 'Cape Town (Rondebosch)', NULL,
 -33.9600, 18.4760, ARRAY['Autism', 'Assessment', 'Research clinic'],
 '021 685 4103', NULL, NULL, 0, true,
 'https://health.uct.ac.za/node/288800', '2026-10-25', 'local', 'suburb',
 'University of Cape Town research and clinical programme on autism.'),
('Autism Connect', 'Western Cape', 'Cape Town (Strandfontein)', NULL,
 -34.0810, 18.5640, ARRAY['Autism', 'Day care'],
 '079 226 0063', 'info@autismconnect.org.za', NULL, 0, true,
 'https://d7.westerncape.gov.za/facility/autism-connect-0', '2026-10-25', 'local', 'suburb',
 'Day care centre for children with autism.'),
('Western Cape Cerebral Palsy Association', 'Western Cape', 'Cape Town (Mowbray)', 'St. Giles Building, 71 Klipfontein Road, Mowbray',
 -33.9480, 18.4800, ARRAY['Cerebral palsy', 'Occupational therapy', 'Family support'],
 '021 685 4150', 'info@wccpa.org.za', 'https://wccpa.org.za/', 0, true,
 'https://d7.westerncape.gov.za/your_gov/70/facilities/1747/43038', '2026-10-25', 'local', 'suburb',
 'Support for children and adults with cerebral palsy.'),
('Red Cross War Memorial Children''s Hospital: Cerebral Palsy Clinic', 'Western Cape', 'Cape Town (Rondebosch)', NULL,
 -33.9550, 18.4870, ARRAY['Cerebral palsy', 'Assessment', 'Speech therapy', 'Occupational therapy', 'Physiotherapy'],
 '021 658 5033', NULL, NULL, 0, true,
 'https://d7.westerncape.gov.za/dept/health/services/730/17437', '2026-10-25', 'local', 'suburb',
 'Multidisciplinary public clinic assessing and managing children with cerebral palsy (by appointment).'),
('Epilepsy South Africa: Western Cape Branch', 'Western Cape', 'Cape Town (Wetton)', NULL,
 -34.0000, 18.5300, ARRAY['Epilepsy', 'Family support'],
 NULL, NULL, NULL, 0, true,
 'https://westerncape.gov.za/dept/296/facilities/1747', '2026-10-25', 'local', 'suburb',
 'Branch of Epilepsy South Africa listed in the Western Cape Government facility directory.'),
('Down Syndrome Association Western Cape', 'Western Cape', 'Cape Town (Bellville)', NULL,
 -33.9000, 18.6290, ARRAY['Down syndrome', 'Family support'],
 NULL, NULL, NULL, 0, true,
 'https://westerncape.gov.za/dept/296/facilities/1747', '2026-10-25', 'local', 'suburb',
 'Regional Down syndrome association listed in the Western Cape Government facility directory.'),
('Action in Autism', 'KwaZulu-Natal', 'Durban (Durban North)', '105 Haig Road, Park Hill, Durban North, 4051',
 -29.7960, 31.0250, ARRAY['Autism', 'Diagnostic clinic', 'Family support', 'Training'],
 NULL, NULL, 'https://actioninautism.org.za/', 0, true,
 'https://www.forgood.co.za/za/en/causes/action-in-autism-4', '2026-10-25', 'local', 'suburb',
 'Parent-founded non-profit (2005) with services across the lifespan, including a free monthly diagnostic clinic.'),
('VelaNjabulo Foundation', 'KwaZulu-Natal', 'Durban (Umlazi)', NULL,
 -29.9700, 30.8830, ARRAY['Dyslexia', 'Peer counselling', 'Educational support', 'Advocacy'],
 NULL, NULL, NULL, 0, true,
 'https://www.sanews.gov.za/node/43089', '2026-10-25', 'local', 'suburb',
 'Advocacy organisation offering peer counselling and educational support to young people with dyslexia.'),
('Zululand Remedial Centre', 'KwaZulu-Natal', 'Empangeni', NULL,
 -28.7620, 31.8930, ARRAY['Remedial education', 'ADHD', 'Autism', 'Learning difficulties'],
 NULL, NULL, NULL, 0, true,
 'https://www.zoominfo.com/c/zululandremedialcentre/540636480', '2026-10-25', 'local', 'city',
 'Remedial school for learners in Grades 1-7 with specific learning difficulties, ADHD and autism.'),
('Autism Association of South Africa', 'Gauteng', 'Pretoria', NULL,
 -25.7460, 28.1880, ARRAY['Autism', 'Developmental disabilities'],
 NULL, 'afautism@iafrica.com', NULL, 0, true,
 'https://disabilityconnect.co.za/category/association/page/2/', '2026-10-25', 'local', 'city',
 'Association for people with autism and related developmental and neurological disabilities.'),
('SA Federation for Mental Health', 'Gauteng', 'Johannesburg', NULL,
 -26.2040, 28.0470, ARRAY['Mental health', 'Advocacy', 'Referrals'],
 NULL, 'info@safmh.org', 'https://www.safmh.org/', 0, true,
 'https://disabilityconnect.co.za/sa-federation-for-mental-health-safmh/', '2026-10-25', 'national', 'city',
 'National mental health organisation; advocacy and referrals.'),
('Free State Autism Support Centre (UFS)', 'Free State', 'Bloemfontein', 'University of the Free State, Bloemfontein Campus',
 -29.1090, 26.1880, ARRAY['Autism', 'Information', 'Referrals'],
 '051 405 3181', NULL, NULL, 0, true,
 'https://www.ufs.ac.za/templates/news-archive/campus-news/2019/may/wheelchair-donation-allows-david-to-pursue-his-athletic-dream?NewsItemID=2348', '2026-10-25', 'local', 'city',
 'Autism information and support centre on the UFS Bloemfontein campus.'),
('Childline South Africa', NULL, NULL, NULL,
 NULL, NULL, ARRAY['Child protection', 'Counselling', 'Helpline'],
 '116', NULL, NULL, 0, true,
 'https://www.vukuzenzele.gov.za/book/export/html/6872', '2026-10-25', 'national', 'none',
 'Free 24-hour helpline for children and for adults worried about a child. Call 116 from any network.'),
('South African Depression and Anxiety Group (SADAG)', NULL, NULL, NULL,
 NULL, NULL, ARRAY['Mental health', 'Counselling', 'Support groups', 'Helpline'],
 NULL, NULL, NULL, 0, true,
 'https://iocdf.org/organizations/the-south-african-depression-and-anxiety-group/', '2026-10-25', 'national', 'none',
 'Network of support groups and telephone counselling across South Africa.'),
('Down Syndrome South Africa', NULL, NULL, NULL,
 NULL, NULL, ARRAY['Down syndrome', 'Family support', 'Referrals'],
 NULL, 'dssaoffice@icon.co.za', NULL, 0, true,
 'https://disabilityconnect.co.za/down-syndrome-south-africa-dssa/', '2026-10-25', 'national', 'none',
 'National umbrella body for Down syndrome associations.')
ON CONFLICT (name) DO NOTHING;

-- Teachers can flag outdated or wrong directory information.
CREATE TABLE IF NOT EXISTS ngo_reports (
    id SERIAL PRIMARY KEY,
    ngo_id INTEGER NOT NULL REFERENCES ngos(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issue TEXT NOT NULL CHECK (char_length(issue) BETWEEN 3 AND 1000),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Training resources moved from a hard-coded list into the database, with real course pages.
CREATE TABLE IF NOT EXISTS training_resources (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL UNIQUE,
    provider VARCHAR(255) NOT NULL,
    topic VARCHAR(100) NOT NULL,
    duration VARCHAR(100),
    cost VARCHAR(50),
    url TEXT NOT NULL,
    description TEXT,
    last_checked DATE,
    is_active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO training_resources (title, provider, topic, duration, cost, url, description, last_checked)
VALUES
('Understanding Autism', 'University of Kent (FutureLearn)', 'Autism', '4 weeks', 'Free to join',
 'https://www.futurelearn.com/courses/autism',
 'What autism is, social communication, sensory differences and lived experience.', '2026-10-25'),
('Good Practice in Autism Education', 'University of Bath (FutureLearn)', 'Autism', '4 weeks', 'Free to join',
 'https://www.futurelearn.com/courses/autism-education',
 'Practical classroom approaches for teachers and parents.', '2026-10-25'),
('Autism Spectrum Disorder', 'UC Davis (Coursera)', 'Autism', 'Self-paced', 'Check enrolment options',
 'https://continue.cpe.ucdavis.edu/course/autism-spectrum-disorder-coursera',
 'What ASD is, how it is diagnosed and the main areas of support.', '2026-10-25'),
('Dyslexia and inclusive practice (OpenLearn Create)', 'The Open University', 'Dyslexia', 'About 3 hours per module', 'Free',
 'https://www.open.edu/openlearncreate/course/search.php?search=dyslexia',
 'Free self-paced modules on identifying and supporting dyslexia in school.', '2026-10-25'),
('ADHD courses on FutureLearn', 'FutureLearn', 'ADHD', 'Varies', 'Varies',
 'https://www.futurelearn.com/search?q=adhd',
 'Current ADHD courses for educators (availability changes, so this links to the live search).', '2026-10-25'),
('Policy on Screening, Identification, Assessment and Support (SIAS)', 'Department of Basic Education', 'Inclusive education', 'Policy', 'Free',
 'https://www.education.gov.za/Programmes/InclusiveEducation.aspx',
 'The 2014 DBE policy that standardises how learners needing extra support are identified and supported.', '2026-10-25'),
('Free autism courses directory', 'Class Central', 'Autism', 'Varies', 'Free / audit',
 'https://classcentral.com/subject/autism',
 'Directory of current free and audit-able autism courses from several universities.', '2026-10-25')
ON CONFLICT (title) DO NOTHING;
