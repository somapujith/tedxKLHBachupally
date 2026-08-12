// Pure event facts — deliberately free of asset imports so this module can be
// read by plain Node (scripts/prerender.mjs) as well as by the Vite bundle.
// `src/data/site.js` re-exports everything here, so app code keeps importing
// from './data/site' as before.

export const event = {
  edition: 'Edition 01',
  year: 2026,
  date: 'Saturday, August 22, 2026',
  time: '9:30 AM – 3:00 PM',
  timeNote: 'Timings may extend',
  isoDate: '2026-08-22T09:30:00+05:30',
  isoEndDate: '2026-08-22T15:00:00+05:30',
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
    role: 'Founder, SUMVN & Space App India',
    credentials: 'Engineering alumnus, Osmania University',
    highlight: 'Leads the NASA International Space Apps Challenge in India',
    revealDate: '2026-08-12T00:00:00+05:30',
    bio: 'Katapally Sai Kiran is a space-tech entrepreneur and ecosystem builder from Hyderabad, and the founder of SUMVN and Space App India. He leads the NASA International Space Apps Challenge in India, convening students, researchers, startups, and domain experts around space technology — and works to put space education and entrepreneurship within reach of the next generation of innovators.',
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
]

// True once a speaker's reveal moment has passed. `now` is injectable for
// tests; every real call site (Speakers.jsx, SpeakerDetail.jsx) leaves it at
// the default so the check always runs against the visitor's own clock.
export function isRevealed(speaker, now = new Date()) {
  return new Date(speaker.revealDate).getTime() <= now.getTime()
}

// Public contact + social identity. Used by the footer, the Contact page, and
// the Organization structured data, so all three can never drift apart.
export const contact = {
  email: 'tedxklhb@klh.edu.in',
  instagram: 'https://www.instagram.com/tedxklhbachupally',
  instagramHandle: '@tedxklhbachupally',
}
