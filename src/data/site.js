import photoNaga from '../assets/images/team/naga.jpg'
import photoTanmai from '../assets/images/team/tanmai.jpg'
import photoYashwant from '../assets/images/team/yashwant.jpg'
import photoKaushik from '../assets/images/team/kaushik.jpg'
import photoVamsi from '../assets/images/team/vamsi.jpg'
import photoPujith from '../assets/images/team/pujith.jpg'
import photoDivya from '../assets/images/team/divya.jpg'
import photoVallabh from '../assets/images/team/vallabh.jpg'
import photoSuhasG from '../assets/images/team/suhas-g.jpg'
import photoSohit from '../assets/images/team/sohit.jpg'
import photoPemesh from '../assets/images/team/pemesh.jpg'
import photoChakrika from '../assets/images/team/chakrika.jpg'
import photoRasagnya from '../assets/images/team/rasagnya.jpg'
import photoAkshitha from '../assets/images/team/akshitha.jpg'
import photoAshwika from '../assets/images/team/ashwika.jpg'
import photoAnuradha from '../assets/images/team/anuradha.jpg'
import photoParinitha from '../assets/images/team/parinitha.jpg'
import photoSuhasWeb from '../assets/images/team/suhas-web.jpg'
import photoAdithya from '../assets/images/team/adithya.jpg'
import photoSeshank from '../assets/images/team/seshank.jpg'
import photoSreya from '../assets/images/team/sreya.jpg'
import photoKrishnanjaneyulu from '../assets/images/team/krishnanjaneyulu.jpg'
import photoDhanvin from '../assets/images/team/dhanvin.jpg'
import photoMahathi from '../assets/images/team/mahathi.jpg'
import photoSanuhya from '../assets/images/team/sanuhya.jpg'
import photoShreyas from '../assets/images/team/shreyas.jpg'
import photoShareef from '../assets/images/team/shareef.png'
import photoSrikar from '../assets/images/team/srikar.jpg'
import photoTarun from '../assets/images/team/tarun.jpg'

export const nav = [
  { label: 'Theme', to: '/theme' },
  { label: 'Events', to: '/events' },
  { label: 'Speakers', to: '/speakers' },
  { label: 'Team', to: '/team' },
  { label: 'About', to: '/about-tedxklh' },
  { label: 'Contact', to: '/contact' },
]

export const event = {
  edition: 'Edition 01',
  year: 2026,
  date: 'Saturday, August 22, 2026',
  time: '9:30 AM – 3:00 PM',
  timeNote: 'Timings may extend',
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

// Single-page About content (hero + TED/TEDx section + our-chapter section).
export const aboutPage = {
  ted: {
    heading: 'About TED & TEDx',
    paragraphs: [
      'TED is a nonprofit devoted to Ideas Worth Spreading. It started out in 1984 as a conference bringing together people from three worlds — Technology, Entertainment and Design — and its scope has only grown broader since.',
      'TEDx is a grassroots initiative created in the spirit of that mission. TEDx events bring the spirit of TED to local communities around the globe, organized by passionate people who uncover new ideas and spark conversations where they live. Each event combines live speakers with recorded TED Talks, and is organized independently under a free license granted by TED.',
    ],
    stats: [
      { value: '1984', label: 'TED founded' },
      { value: '3,000+', label: 'TEDx events a year' },
      { value: '170+', label: 'Countries' },
      { value: '100k+', label: 'Talks published' },
    ],
  },
  chapter: {
    label: 'About us',
    heading: 'TEDxKLH Bachupally is an independently organized TEDx event.',
    paragraphs: [
      'Hosted on the Bachupally campus of KL University, TEDxKLH is fully student-curated — every speaker scouted, every frame designed and every seat filled by students.',
      'We are staging our first edition and building toward becoming one of South India’s most ambitious independent TEDx programs.',
    ],
    stats: [
      { value: '250', label: 'Seats' },
      { value: '1', label: 'Stage, one day' },
      { value: '100%', label: 'Student-run' },
      { value: '01', label: 'First edition' },
    ],
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

// Leadership shown first on the Team page, one headed row per role.
export const teamLeadership = [
  { name: 'Sreya Tulasi', role: 'Organiser', photo: photoSreya },
  { name: 'Krishnanjaneyulu', role: 'Co-organiser', photo: photoKrishnanjaneyulu },
  { name: 'Akash', role: 'Co-organiser', photo: null },
  { name: 'Shareef', role: 'Head of Department — CS&IT', photo: photoShareef },
]

export const team = [
  // Hospitality
  { name: 'Naga', dept: 'Hospitality', photo: photoNaga },
  { name: 'Mahathi', dept: 'Hospitality', photo: photoMahathi, photoPos: '50% 30%' },
  { name: 'Chervi', dept: 'Hospitality', photo: null },
  { name: 'Tanmai', dept: 'Hospitality', photo: photoTanmai, photoPos: '70% 25%' },
  { name: 'Yashwant', dept: 'Hospitality', photo: photoYashwant },
  { name: 'Dhanvin', dept: 'Hospitality', photo: photoDhanvin },
  { name: 'Tarun', dept: 'Hospitality', photo: photoTarun },
  { name: 'Ganesh', dept: 'Hospitality', photo: null },
  { name: 'Vamsi', dept: 'Hospitality', photo: photoVamsi },
  { name: 'Pujith', dept: 'Hospitality', photo: photoPujith },
  { name: 'Divya', dept: 'Hospitality', photo: photoDivya, photoPos: '50% 15%' },
  { name: 'Sanuhya', dept: 'Hospitality', photo: photoSanuhya, photoPos: '50% 60%' },
  // Sponsorship
  { name: 'Vallabh', dept: 'Sponsorship', photo: photoVallabh },
  { name: 'Kaushik', dept: 'Sponsorship', photo: photoKaushik },
  { name: 'Shreyas', dept: 'Sponsorship', photo: photoShreyas, photoPos: '50% 40%' },
  // Marketing
  { name: 'Suhas G', dept: 'Marketing', photo: photoSuhasG },
  { name: 'Srikar', dept: 'Marketing', photo: photoSrikar },
  { name: 'Sohit', dept: 'Marketing', photo: photoSohit, photoPos: '50% 70%' },
  { name: 'Pemesh', dept: 'Marketing', photo: photoPemesh },
  { name: 'Chakrika', dept: 'Marketing', photo: photoChakrika },
  { name: 'Rasagnya', dept: 'Marketing', photo: photoRasagnya },
  { name: 'Akshitha', dept: 'Marketing', photo: photoAkshitha },
  { name: 'Ashwika', dept: 'Marketing', photo: photoAshwika },
  { name: 'Anuradha', dept: 'Marketing', photo: photoAnuradha },
  { name: 'Parinitha', dept: 'Marketing', photo: photoParinitha },
  // Productions
  { name: 'GBS Team', dept: 'Productions', photo: null },
  // Web Development & Design
  { name: 'Suhas', dept: 'Web Development & Design', photo: photoSuhasWeb },
  { name: 'Senthil', dept: 'Web Development & Design', photo: null },
  { name: 'Adithya', dept: 'Web Development & Design', photo: photoAdithya },
  { name: 'Seshank Yennam', dept: 'Web Development & Design', photo: photoSeshank },
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
