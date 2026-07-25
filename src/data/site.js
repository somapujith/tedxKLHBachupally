export const nav = [
  { label: 'Theme', to: '/theme' },
  { label: 'Events', to: '/events' },
  { label: 'Speakers', to: '/speakers' },
  { label: 'Team', to: '/team' },
  { label: 'About', to: '/about-tedxklh' },
]

export const event = {
  edition: 'Edition 01',
  year: 2026,
  date: 'Saturday, August 22, 2026',
  isoDate: '2026-08-22T09:30:00+05:30',
  venue: 'KLH Bachupally Campus',
  city: 'Hyderabad, Telangana',
  address: 'KLH Bachupally Campus, Hyderabad, Telangana 500090',
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

export const schedule = [
  { time: '09:30', label: 'Doors Open & Registration' },
  { time: '10:00', label: 'Opening — Theme Reveal' },
  { time: '10:20', label: 'Session I · Signals', slugs: ['ananya-rao', 'vikram-iyer', 'meher-shaik', 'rohit-naidu'] },
  { time: '11:40', label: 'Interval — Idea Lounge & Networking' },
  { time: '12:10', label: 'Session II · Roots', slugs: ['siri-pranati', 'arjun-deshpande', 'kavya-menon', 'imran-qureshi'] },
  { time: '13:30', label: 'Lunch & Speaker Salons' },
  { time: '14:30', label: 'Session III · Futures', slugs: ['nithya-raman', 'karan-malhotra', 'aisha-rahman', 'siddharth-mehta'] },
  { time: '15:50', label: 'Closing Remarks' },
]

export const theme = {
  eyebrow: 'Theme · 2026',
  h1: ['Technology EVOLVES.', 'Humanity LEADS.'],
  chapters: [
    {
      n: '001/003',
      title: 'The machine learned to dream.',
      body: "In a single decade the line between tool and collaborator dissolved. Models write our prose, render our cities, fold our proteins. The question is no longer what can it do — but what should we still want to do ourselves.",
    },
    {
      n: '002/003',
      title: 'Leadership is not a feature you ship.',
      body: 'Evolution is the easy half. The hard half is the choice — to slow down, to refuse a default, to keep a child in a classroom, to keep a hand on a steering wheel, to keep a name on a song. Leading is taste, exercised in public.',
    },
    {
      n: '003/003',
      title: 'Twelve speakers. One question.',
      body: 'We invited twelve people who have already had to make that choice — in a lab, on a stage, in an operating theatre, in a courtroom, in a slum, in a studio. They will not tell you what to think. They will tell you what it cost them to think it.',
    },
  ],
}

export const aboutTabs = {
  ted: {
    eyebrow: '01 / About · The mothership',
    h1: 'About TED.',
    paragraphs: [
      'TED is a nonprofit, nonpartisan organization dedicated to discovering, debating and spreading ideas that spark conversation, deepen understanding and drive meaningful change.',
      'Our organization is devoted to curiosity, reason, wonder and the pursuit of knowledge — without an agenda. We welcome people from every discipline and culture who seek a deeper understanding of the world and connection with others, and we invite everyone to engage with ideas and activate them in your community.',
      'TED began in 1984 as a conference where Technology, Entertainment and Design converged, but today it spans a multitude of worldwide communities and initiatives exploring everything from science and business to education, arts and global issues.',
    ],
    social: [
      { label: 'Facebook', href: 'https://facebook.com/TED' },
      { label: 'Instagram', href: 'https://instagram.com/ted' },
      { label: 'LinkedIn', href: 'https://linkedin.com/company/ted-conferences' },
      { label: 'X', href: 'https://x.com/TEDTalks' },
    ],
  },
  tedx: {
    eyebrow: '02 / About · The x stands for independent',
    h1: 'About TEDx.',
    intro: 'TEDx is a program of local, self-organized events that bring people together to share a TED-like experience.',
    body: 'At a TEDx event, TED Talks video and live speakers combine to spark deep discussion and connection. These local, self-organized events are branded TEDx, where x = independently organized TED event. The TED Conference provides general guidance for the TEDx program, but individual TEDx events are self-organized.',
    stats: [
      { value: '3,000+', label: 'Events every year' },
      { value: '170+', label: 'Countries' },
      { value: '100k+', label: 'Talks published' },
      { value: '1', label: 'License per event' },
    ],
  },
  tedxklh: {
    eyebrow: '03 / About · Our chapter',
    h1: 'Built by students.',
    body: "TEDxKLH Bachupally is a fully student-curated TEDx licensee, hosted on the Bachupally campus of KL University. We're staging our first edition and building toward becoming one of South India's most ambitious independent TEDx programs.",
  },
}

// Real TEDxKLH Bachupally crew, grouped by department.
// `photo` optional — drop a headshot URL/import to replace the generated monogram tile.
// `dept` drives the department filter on the Team page.
export const teamDepartments = [
  'Hospitality',
  'Sponsorship',
  'Marketing',
  'Productions',
  'Web Development & Design',
]

export const team = [
  // Hospitality
  { name: 'Naga', dept: 'Hospitality', photo: null },
  { name: 'Chervi', dept: 'Hospitality', photo: null },
  { name: 'Tanmai', dept: 'Hospitality', photo: null },
  { name: 'Yashwant', dept: 'Hospitality', photo: null },
  { name: 'Dinesh', dept: 'Hospitality', photo: null },
  { name: 'Tarun', dept: 'Hospitality', photo: null },
  { name: 'Kaushik', dept: 'Hospitality', photo: null },
  { name: 'Ganesh', dept: 'Hospitality', photo: null },
  { name: 'Vamsi', dept: 'Hospitality', photo: null },
  { name: 'Pujith', dept: 'Hospitality', photo: null },
  { name: 'Divya', dept: 'Hospitality', photo: null },
  // Sponsorship
  { name: 'Vallabh', dept: 'Sponsorship', photo: null },
  { name: 'Subramanyam', dept: 'Sponsorship', photo: null },
  { name: 'Pranav', dept: 'Sponsorship', photo: null },
  // Marketing
  { name: 'Suhas G', dept: 'Marketing', photo: null },
  { name: 'Srikar', dept: 'Marketing', photo: null },
  { name: 'Sohit', dept: 'Marketing', photo: null },
  { name: 'Pemesh', dept: 'Marketing', photo: null },
  { name: 'Chakrika', dept: 'Marketing', photo: null },
  { name: 'Rasagnya', dept: 'Marketing', photo: null },
  { name: 'Akshitha', dept: 'Marketing', photo: null },
  { name: 'Ashwika', dept: 'Marketing', photo: null },
  { name: 'Anuradha', dept: 'Marketing', photo: null },
  { name: 'Parinitha', dept: 'Marketing', photo: null },
  // Productions
  { name: 'GBS', dept: 'Productions', photo: null },
  // Web Development & Design
  { name: 'Suhas', dept: 'Web Development & Design', photo: null },
  { name: 'Senthil', dept: 'Web Development & Design', photo: null },
  { name: 'Adithya', dept: 'Web Development & Design', photo: null },
  { name: 'Seshank Yennam', dept: 'Web Development & Design', photo: null },
]

export const blogPosts = [
  { slug: 'behind-the-theme', title: 'Behind the Theme: Technology Evolves. Humanity Leads.', category: 'Curation', readTime: '5 min read', excerpt: 'How we landed on the theme for our 2026 edition and why negotiating with intelligence itself is the defining problem of our generation.', author: 'Karthik Verma', date: '2026-07-12' },
  { slug: 'curating-twelve-voices', title: 'Curating Twelve Voices: The Rehearsal Process', category: 'Behind The Scenes', readTime: '7 min read', excerpt: 'What happens when you bring an AI researcher, a spoken word poet, and a climate engineer into the same room? A look inside our curation process.', author: 'Sneha Reddy', date: '2026-06-28' },
  { slug: 'the-anatomy-of-a-red-dot', title: 'The Anatomy of a Red Dot: Stage Design', category: 'Production', readTime: '4 min read', excerpt: 'Designing a cinematic stage environment at the KL University auditorium. Balancing projection design, lighting grids, and speakers’ comfort.', author: 'Pranav Bose', date: '2026-06-15' },
  { slug: 'how-to-nominate-a-speaker', title: 'How to Nominate a Speaker for TEDxKLH 2026', category: 'Guide', readTime: '3 min read', excerpt: 'We look for ideas, not resumes. Here is a breakdown of what makes a proposal catch our curation team’s attention.', author: 'Aditi Sharma', date: '2026-05-30' },
]

export const galleryTiles = ['STAGE', 'AUDIENCE', 'GREEN ROOM', 'LOBBY', 'PORTRAIT', 'AFTER-PARTY', 'INSTALL', 'CREW']

export const experience = [
  { title: 'Idea Lounge', body: 'A curated lobby of installations, interactive demos, and zines from local labs.' },
  { title: 'Speaker Salons', body: 'Twenty-minute round tables with each speaker between sessions. First come, first seated.' },
  { title: 'Red Dot Studio', body: 'A pop-up portrait studio shooting every guest on a single roll of medium format film.' },
]

export const partners = {
  presenting: { name: 'KL University' },
  supporting: ['T-Hub', 'Atlassian', 'Razorpay', 'Notion', 'Figma', 'Zoho', 'BookMyShow'],
}

export const sponsorTiers = [
  { tier: 'Tier 1 — Presenting', subtitle: 'Single partner. Whole event.', price: '₹6,00,000', benefits: ['Logo lockup with TEDxKLH on every surface', 'On-stage thank-you', '20 reserved seats', 'Custom activation in Idea Lounge', 'Six talk videos co-branded on release'] },
  { tier: 'Tier 2 — Idea', subtitle: 'Up to four partners.', price: '₹2,50,000', benefits: ['Logo on website, badges, signage', '10 reserved seats', 'Activation booth in lobby', 'Acknowledgement on social'] },
  { tier: 'Tier 3 — Friend', subtitle: 'Up to eight partners.', price: '₹75,000', benefits: ['Logo on website + program', '4 reserved seats', 'Mention in opening reel'] },
]

export const volunteerRoles = [
  { title: 'Curation', body: 'Scout, brief, and rehearse the next year’s speakers.' },
  { title: 'Production', body: 'Run-of-show, lighting, sound, livestream, stage.' },
  { title: 'Design', body: 'Identity, motion, set design, signage, social.' },
  { title: 'Experience', body: 'Idea Lounge, salons, hospitality, after-party.' },
  { title: 'Partnerships', body: 'Sponsor outreach, decks, fulfilment, reporting.' },
  { title: 'Tech', body: 'Website, registration, badge printing, archives.' },
]
