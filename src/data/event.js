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
export const speakers = [
  {
    n: 1,
    slug: 'alekhya-singapore',
    name: 'Dr. Alekhya Singapore',
    category: 'Health',
    role: 'Consultant Dermatologist & Trichologist',
    credentials: 'MBBS · DDVL · Healthcare Management, ISB',
    highlight: 'Named India’s first “Dermapreneur” by Times Network',
    bio: 'Dr. Alekhya Singapore is a consultant dermatologist, trichologist, and founder of The Skin Sensé Clinic in Hyderabad, with over 14 years of experience. Named India’s first “Dermapreneur” by Times Network, she focuses on clinical, aesthetic, and pediatric dermatology, holding an MBBS, a DDVL, and a healthcare management degree from ISB.',
    photo: null,
  },
  {
    n: 2,
    slug: 'gopalan-uppiliappan',
    name: 'Gopalan Uppiliappan',
    category: 'Business',
    role: 'Group CEO, RC Manubhai Group',
    credentials: 'B.Tech Chemical Engineering · MBA, IIM Bangalore · Executive Diploma, London Business School',
    highlight: 'Over 25 years of multinational executive experience',
    bio: 'Gopalan Uppiliappan is a business transformation leader with over 25 years of multinational executive experience. His expertise spans turnarounds, operational scaling, and fiscal restructuring of major conglomerates. He holds a B.Tech in Chemical Engineering, an MBA from IIM Bangalore, and an Executive Diploma from London Business School.',
    photo: null,
  },
  {
    n: 3,
    slug: 'tejaswini-adada',
    name: 'Dr. Tejaswini Adada',
    category: 'Health',
    role: 'Consultant Medical Oncologist, Hematologist & Digital Health Innovator',
    credentials: 'Co-founder & CEO, Cancer Conscious Clinics',
    highlight: 'Over 14 years of cross-sector healthcare experience',
    bio: 'Dr. Tejaswini Adada is a physician-scientist, medical oncologist, and healthcare entrepreneur based in Hyderabad. Co-founder and CEO of Cancer Conscious Clinics, she brings over 14 years of cross-sector healthcare experience from premier institutions including Malla Reddy Narayana and HCG Cancer Centre.',
    photo: null,
  },
  {
    n: 4,
    slug: 'tezan-sahu',
    name: 'Tezan Sahu',
    category: 'Technology',
    role: 'Applied Scientist 2, Microsoft',
    credentials: 'IIT Bombay · Multiple US patents in applied AI',
    highlight: 'Author, Beyond Code',
    bio: 'Tezan Sahu is an AI engineer and technical speaker, an IIT Bombay alumnus working on the M365 Copilot Extensibility Platform. He authored the tech career guide Beyond Code and holds multiple US patents in applied AI.',
    photo: null,
  },
  {
    n: 5,
    slug: 'vinuthna-jagarlapudi',
    name: 'Vinuthna Jagarlapudi',
    category: 'Arts',
    role: 'Singer, Content Creator & Creative Director',
    credentials: 'Creative Director, Hyderabad Feed · MA Applied Psychology (in progress)',
    highlight: 'Featured on Zee Telugu’s Sa Re Ga Ma Pa, 2022',
    bio: 'Vinuthna Jagarlapudi is a professional playback singer, independent indie artist, and digital content creator based in Hyderabad. She appeared on Zee Telugu’s Sa Re Ga Ma Pa in 2022 and serves as Creative Director at Hyderabad Feed while pursuing an MA in Applied Psychology.',
    photo: null,
  },
  {
    n: 6,
    slug: 'sampath-akondi',
    name: 'Sampath Akondi',
    category: 'Arts',
    role: 'Writer & Content Creator',
    credentials: '100K+ followers, Instagram · @sampath_akondi',
    highlight: 'Known for comedic, relatable Telugu short-form storytelling',
    bio: 'Sampath Akondi is a Telugu writer and content creator known for short-form videos that turn everyday overthinking, relationships, and modern life into comedic, relatable storytelling. His reels and clips have built an audience of over 100,000 followers across Instagram and YouTube.',
    photo: null,
  },
]

// Public contact + social identity. Used by the footer, the Contact page, and
// the Organization structured data, so all three can never drift apart.
export const contact = {
  email: 'tedxklhb@klh.edu.in',
  instagram: 'https://www.instagram.com/tedxklhbachupally',
  instagramHandle: '@tedxklhbachupally',
}
