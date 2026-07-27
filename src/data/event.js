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

export const speakers = [
  { n: 1, slug: 'ananya-rao', name: 'Ananya Rao', category: 'Technology', role: 'AI Researcher', talk: 'The Quiet Intelligence' },
  { n: 2, slug: 'vikram-iyer', name: 'Vikram Iyer', category: 'Science', role: 'Astrophysicist', talk: 'Listening to the Dark' },
  { n: 3, slug: 'meher-shaik', name: 'Meher Shaik', category: 'Arts', role: 'Spoken Word Poet', talk: 'Mother Tongue, Machine Tongue' },
  { n: 4, slug: 'rohit-naidu', name: 'Rohit Naidu', category: 'Climate', role: 'Climate Engineer', talk: 'Carbon, Concrete, Conscience' },
  { n: 5, slug: 'siri-pranati', name: 'Siri Pranati', category: 'Health', role: 'Neurosurgeon', talk: 'Hands That Read Minds' },
  { n: 6, slug: 'arjun-deshpande', name: 'Arjun Deshpande', category: 'Society', role: 'Founder, Aadhaar Health Collective', talk: 'Medicine As a Right' },
  { n: 7, slug: 'kavya-menon', name: 'Kavya Menon', category: 'Technology', role: 'Robotics Engineer', talk: 'Soft Machines' },
  { n: 8, slug: 'imran-qureshi', name: 'Imran Qureshi', category: 'Arts', role: 'Documentary Filmmaker', talk: 'Frames of Resistance' },
  { n: 9, slug: 'nithya-raman', name: 'Dr. Nithya Raman', category: 'Climate', role: 'Marine Biologist', talk: 'Voice of the Oceans' },
  { n: 10, slug: 'karan-malhotra', name: 'Karan Malhotra', category: 'Society', role: 'Urban Architect', talk: 'Vertical Forests' },
  { n: 11, slug: 'aisha-rahman', name: 'Dr. Aisha Rahman', category: 'Technology', role: 'AI Ethicist', talk: 'The Code of Empathy' },
  { n: 12, slug: 'siddharth-mehta', name: 'Siddharth Mehta', category: 'Science', role: 'Renewable Energy Pioneer', talk: 'Power of the Soil' },
]

// Public contact + social identity. Used by the footer, the Contact page, and
// the Organization structured data, so all three can never drift apart.
export const contact = {
  email: 'tedxklhb@klh.edu.in',
  instagram: 'https://www.instagram.com/tedxklhbachupally',
  instagramHandle: '@tedxklhbachupally',
}
