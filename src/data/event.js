// Pure event facts — deliberately free of asset imports so this module can be
// read by plain Node (scripts/prerender.mjs) as well as by the Vite bundle.
// `src/data/site.js` re-exports everything here, so app code keeps importing
// from './data/site' as before.

export const event = {
  edition: 'Edition 01',
  year: 2026,
  date: 'Saturday, August 22, 2026',
  time: '9:30 AM – 4:00 PM',
  timeNote: 'Timings may extend',
  isoDate: '2026-08-22T09:30:00+05:30',
  isoEndDate: '2026-08-22T16:00:00+05:30',
  venue: 'KLH Bachupally Campus',
  city: 'Hyderabad, Telangana',
  address: 'KLH Bachupally Campus, Hyderabad, Telangana 500090',
  streetAddress: 'KL University, Bachupally, Nizampet Road',
  locality: 'Hyderabad',
  region: 'Telangana',
  postalCode: '500090',
  country: 'IN',
  latitude: 17.5449,
  longitude: 78.3822,
  capacity: 250,
  guests: 300,
  mapsUrl: 'https://maps.app.goo.gl/4XNEfijzH9evJFnj7',
  title: 'Understanding what makes us uniquely human in a rapidly changing world.',
  tagline: 'Technology evolves. Humanity leads.',
  description:
    'An inquiry into our shared essence. Exploring what keeps us uniquely human in a world reshaped by accelerating technology, automation, and shifting cultural landscapes.',
}

// Real TEDxKLH Bachupally 2026 line-up. Sourced from the official TED event
// page (ted.com/tedx/events/69686) — bios kept close to that copy so the site
// never claims a credential TED itself doesn't list.
// `photo` is deliberately null until real headshots land: Speakers.jsx and
// SpeakerDetail.jsx both fall back to a monogram tile, same pattern as `team`.
// `revealDate` drives the daily reveal — two speakers unlock at 9 AM IST per
// day, in roster order, starting Aug 8 2026. `isRevealed` below is the single
// place that reads "now"; Speakers.jsx and SpeakerDetail.jsx both filter
// through it so a speaker can never appear on one page before the other.
export const speakers = [
  {
    n: 1,
    slug: 'alekhya-singapore',
    name: 'Dr. Alekhya Singapore',
    category: 'Health',
    role: 'Consultant Dermatologist & Trichologist',
    credentials: 'MBBS · DDVL · Healthcare Management, ISB',
    highlight: 'Named India’s first “Dermapreneur” by Times Network',
    revealDate: '2026-08-08T09:00:00+05:30',
    bio: 'Dr. Alekhya Singapore is a consultant dermatologist, trichologist, and founder of The Skin Sensé Clinic in Hyderabad, with over 14 years of experience. Named India’s first “Dermapreneur” by Times Network, she focuses on clinical, aesthetic, and pediatric dermatology, holding an MBBS, a DDVL, and a healthcare management degree from ISB.',
    photo: null,
  },
  {
    n: 2,
    slug: 'tejaswini-adada',
    name: 'Dr. Tejaswini Adada',
    category: 'Health',
    role: 'Consultant Medical Oncologist, Hematologist & Digital Health Innovator',
    credentials: 'Co-founder & CEO, Cancer Conscious Clinics',
    highlight: 'Over 14 years of cross-sector healthcare experience',
    revealDate: '2026-08-09T09:00:00+05:30',
    bio: 'Dr. Tejaswini Adada is a physician-scientist, medical oncologist, and healthcare entrepreneur based in Hyderabad. Co-founder and CEO of Cancer Conscious Clinics, she brings over 14 years of cross-sector healthcare experience from premier institutions including Malla Reddy Narayana and HCG Cancer Centre.',
    photo: null,
  },
  {
    n: 3,
    slug: 'tezan-sahu',
    name: 'Tezan Sahu',
    category: 'Technology',
    role: 'Applied Scientist 2, Microsoft',
    credentials: 'IIT Bombay · Multiple US patents in applied AI',
    highlight: 'Author, Beyond Code',
    revealDate: '2026-08-09T09:00:00+05:30',
    bio: 'Tezan Sahu is an AI engineer and technical speaker, an IIT Bombay alumnus working on the M365 Copilot Extensibility Platform. He authored the tech career guide Beyond Code and holds multiple US patents in applied AI.',
    photo: null,
  },
  {
    n: 4,
    slug: 'vinuthna-jagarlapudi',
    name: 'Vinuthna Jagarlapudi',
    category: 'Arts',
    role: 'Singer, Content Creator & Creative Director',
    credentials: 'Creative Director, Hyderabad Feed · MA Applied Psychology (in progress)',
    highlight: 'Featured on Zee Telugu’s Sa Re Ga Ma Pa, 2022',
    revealDate: '2026-08-10T09:00:00+05:30',
    bio: 'Vinuthna Jagarlapudi is a professional playback singer, independent indie artist, and digital content creator based in Hyderabad. She appeared on Zee Telugu’s Sa Re Ga Ma Pa in 2022 and serves as Creative Director at Hyderabad Feed while pursuing an MA in Applied Psychology.',
    photo: null,
  },
  {
    n: 5,
    slug: 'sampath-akondi',
    name: 'Sampath Akondi',
    category: 'Arts',
    role: 'Writer & Content Creator',
    credentials: '100K+ followers, Instagram · @sampath_akondi',
    highlight: 'Known for comedic, relatable Telugu short-form storytelling',
    revealDate: '2026-08-10T09:00:00+05:30',
    bio: 'Sampath Akondi is a Telugu writer and content creator known for short-form videos that turn everyday overthinking, relationships, and modern life into comedic, relatable storytelling. His reels and clips have built an audience of over 100,000 followers across Instagram and YouTube.',
    photo: null,
  },
  {
    n: 6,
    slug: 'katapally-sai-kiran',
    name: 'Katapally Sai Kiran',
    category: 'Technology',
    role: 'Founder & Director, Space App India',
    credentials: 'Engineering alumnus, Osmania University',
    highlight: 'Lead organizer, NASA International Space Apps Challenge India',
    revealDate: '2026-08-12T00:00:00+05:30',
    bio: 'Katapally Sai Kiran is a space-tech entrepreneur, tech ecosystem enabler, and startup leader based in Hyderabad. An engineering alumnus of Osmania University, he founded SUMVN and Space App India to democratize aerospace education and technological innovation. He serves as a lead organizer for the NASA International Space Apps Challenge in India, collaborating with national incubation hubs like T-Hub to mentor and empower thousands of young space-tech enthusiasts.',
    photo: null,
  },
  {
    n: 7,
    slug: 'nawab-mir-nasir-ali-khan',
    name: 'Dr. Nawab Mir Nasir Ali Khan',
    category: 'Business',
    role: 'Honorary Consul of the Republic of Kazakhstan, Hyderabad',
    credentials: 'Managing Director, MAK Projects Pvt. Ltd.',
    highlight: 'Diplomat of the Year 2025, conferred at Capitol Hill, Washington D.C.',
    revealDate: '2026-08-12T00:00:00+05:30',
    bio: 'Dr. Nawab Mir Nasir Ali Khan is the Honorary Consul of the Republic of Kazakhstan in Hyderabad for Telangana and Andhra Pradesh, appointed by Kazakhstan’s Ministry of Foreign Affairs and formally recognized by the President of India. He also serves as Promoter and Managing Director of MAK Projects Pvt. Ltd., Hyderabad, where he led the Canadian Wood Villas — a sustainable luxury residential project developed with Canadian Woods, Government of British Columbia. His honors include the Jubilee Medal from the Republic of Kazakhstan, the Congressional Medallion and Proclamation at Capitol Hill, and the Diplomat of the Year Award 2025.',
    photo: null,
  },
  {
    n: 8,
    slug: 'anand-singh',
    name: 'Anand Singh',
    category: 'Business',
    role: 'Founder, Hanswahini Group of Institutions',
    credentials: 'Director, Centre for Distance & Online Education, Integral University, Lucknow',
    highlight: 'Founded Hanswahini Group of Institutions in 1997',
    revealDate: '2026-08-13T09:00:00+05:30',
    bio: 'Mr. Anand Singh is an educationist, institution builder, and academic administrator with more than three decades of leadership in higher education and institutional governance. Since founding the Hanswahini Group of Institutions in 1997, he has expanded access to quality education and strengthened institutional governance across the group, which also includes Surendra Educational Society (1997), Hanswahini Institute of Science & Technology (2004), and Hanswahini Foundation (2014). Since 2016, he has served as Director of the Centre for Distance and Online Education (CDOE) at Integral University, Lucknow, driving the modernization of open, distance, and online learning. He has represented India at national and international conferences on leadership, corporate governance, and higher education.',
    photo: null,
  },
  {
    n: 9,
    slug: 'sathwika-sama',
    name: 'Sathwika Sama',
    category: 'Society',
    role: 'Deputy Superintendent of Police, Telangana State Police',
    credentials: 'Former Tennis Player · Topped TGPSC Group 1 Exams',
    highlight: "Women's Singles Gold, 2019 South Asian Games",
    revealDate: '2026-08-14T09:00:00+05:30',
    bio: "Sathwika Sama is a former professional tennis player turned civil servant. Now 25, she serves as Deputy Superintendent of Police in the Telangana State Police after topping the TGPSC Group 1 exams. On court, she won the Women's Singles Gold Medal at the 2019 South Asian Games and reached a career-high WTA singles ranking of 809 in 2020. She was also a guest columnist at ITD, writing the popular column 'Sammy Speaks'.",
    photo: null,
  },
  {
    n: 10,
    slug: 'moiz-s-master',
    name: 'Moiz S. Master',
    category: 'Business',
    role: 'Founder, Alister Equipments',
    credentials: 'Commercial Kitchen Equipment & Solutions',
    highlight: 'Trusted supplier to hotels, restaurants, cafes & bakeries across sectors',
    revealDate: '2026-08-15T09:00:00+05:30',
    bio: "Moiz S. Master is the founder of Alister Equipments, a premier provider of commercial kitchen equipment and solutions. Under his leadership, the company has built a reputation for high-quality, reliable, and technologically advanced products, delivering customized solutions for hotels, restaurants, cafes, and bakeries that optimize efficiency and productivity. His commitment to sustainability, customer satisfaction, and continuous innovation has set industry benchmarks and established him as a respected leader in the commercial kitchen equipment sector.",
    photo: null,
  },
  {
    n: 11,
    slug: 'akshay-pabba',
    name: 'Akshay Pabba',
    category: 'Arts',
    role: 'Podcaster',
    revealDate: '2026-08-17T09:00:00+05:30',
    photo: null,
  },
  {
    n: 12,
    slug: 'kamakshi-bhaskarla',
    name: 'Kamakshi Bhaskarla',
    category: 'Arts',
    role: 'Actress',
    revealDate: '2026-08-18T09:00:00+05:30',
    photo: null,
  },
]

// True once a speaker's reveal moment has passed. `now` is injectable for
// tests; every real call site (Speakers.jsx, SpeakerDetail.jsx) leaves it at
// the default so the check always runs against the visitor's own clock.
export function isRevealed(speaker, now = new Date()) {
  return new Date(speaker.revealDate).getTime() <= now.getTime()
}

// Official running order, 9:30 AM – 4:00 PM. `slug` links a talk row to its
// entry in `speakers` above (and drives the /speakers/:slug link on Schedule.jsx).
// `kind` drives Schedule.jsx's visual treatment: 'talk' gets the numbered
// TED-style card, everything else (ceremony/break/performance/interaction/
// valedictory) gets the plain program-note treatment.
export const schedule = [
  {
    time: '9:30 AM – 10:00 AM',
    kind: 'ceremony',
    title: 'Opening Ceremony',
    people: [
      { name: 'Dr. Koteshwar Rao', role: 'Principal, KLH Bachupally' },
      { name: 'Sreya Tulasi', role: 'Organizer, TEDxKLH Bachupally' },
      { name: 'Krishnanjaneyulu', role: 'Co-Organizer, TEDxKLH Bachupally' },
    ],
  },
  { time: '10:00 AM – 10:20 AM', kind: 'talk', n: 1, slug: 'tezan-sahu', name: 'Tezan Sahu', role: 'Applied Scientist 2, Microsoft' },
  { time: '10:20 AM – 10:40 AM', kind: 'talk', n: 2, slug: 'alekhya-singapore', name: 'Dr. Alekhya Singapore', role: 'Founder & Chief Dermatologist, The Skin Sensé Clinics' },
  { time: '10:40 AM – 11:00 AM', kind: 'talk', n: 3, slug: 'vinuthna-jagarlapudi', name: 'Vinuthna Jagarlapudi', role: 'Singer, Content Creator & Creative Director, Hyderabad Feed' },
  { time: '11:00 AM – 11:20 AM', kind: 'talk', n: 4, slug: 'anand-singh', name: 'Anand Singh', role: 'Founder, Hanswahini Group' },
  { time: '11:20 AM – 11:40 AM', kind: 'talk', n: 5, slug: 'tejaswini-adada', name: 'Dr. Tejaswini Adada', role: 'Clinician & Research Scientist in Oncology, Cancer Conscious Clinic' },
  { time: '11:40 AM – 12:00 PM', kind: 'talk', n: 6, slug: 'nawab-mir-nasir-ali-khan', name: 'Dr. Nawab Mir Nasir Ali Khan', role: 'Honorary Consul of the Republic of Kazakhstan, Hyderabad' },
  { time: '12:00 PM – 12:20 PM', kind: 'talk', n: 7, slug: 'sathwika-sama', name: 'Sathwika Sama Surakanti', role: 'Deputy Superintendent of Police (DSP)' },
  { time: '12:20 PM – 12:40 PM', kind: 'talk', n: 8, slug: 'kamakshi-bhaskarla', name: 'Kamakshi Bhaskarla', role: 'Actress' },
  { time: '12:40 PM – 1:00 PM', kind: 'interaction', title: 'Speaker – Student Interaction' },
  { time: '1:00 PM – 2:00 PM', kind: 'break', title: 'Lunch Break' },
  { time: '2:00 PM – 2:10 PM', kind: 'performance', title: 'Band / Dance' },
  { time: '2:10 PM – 2:30 PM', kind: 'talk', n: 9, slug: 'sampath-akondi', name: 'Sampath Akondi', role: 'Content Creator' },
  { time: '2:30 PM – 2:50 PM', kind: 'talk', n: 10, slug: 'katapally-sai-kiran', name: 'Katapally Sai Kiran', role: 'Founder & Director, Space App India' },
  { time: '2:50 PM – 3:10 PM', kind: 'talk', n: 11, slug: 'moiz-s-master', name: 'Moiz S. Master', role: 'Founder, Alister Equipments' },
  { time: '3:10 PM – 3:30 PM', kind: 'talk', n: 12, slug: 'akshay-pabba', name: 'Akshay Pabba', role: 'Podcaster' },
  { time: '3:30 PM – 4:00 PM', kind: 'valedictory', title: 'Valedictory Ceremony' },
]

// Public contact + social identity. Used by the footer, the Contact page, and
// the Organization structured data, so all three can never drift apart.
export const contact = {
  email: 'tedxklhb@klh.edu.in',
  instagram: 'https://www.instagram.com/tedxklhbachupally',
  instagramHandle: '@tedxklhbachupally',
}
