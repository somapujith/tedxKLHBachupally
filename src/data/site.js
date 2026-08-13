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
import photoChervi from '../assets/images/team/chervi.jpg'
import photoSreya from '../assets/images/team/sreya.jpg'
import photoKrishnanjaneyulu from '../assets/images/team/krishnanjaneyulu.jpg'
import photoDhanvin from '../assets/images/team/dhanvin.jpg'
import photoMahathi from '../assets/images/team/mahathi.jpg'
import photoSanuhya from '../assets/images/team/sanuhya.jpg'
import photoShreyas from '../assets/images/team/shreyas.jpg'
import photoShareef from '../assets/images/team/shareef.png'
import photoSrikar from '../assets/images/team/srikar.jpg'
import photoTarun from '../assets/images/team/tarun.jpg'
import photoNaveena from '../assets/images/team/naveena.jpg'
import photoGanesh from '../assets/images/team/ganesh.jpg'
import photoLakshmiPrasanna from '../assets/images/team/lakshmi-prasanna.jpg'
import photoSubramanyam from '../assets/images/team/subramanyam.jpg'
import photoVenkateshwarRao from '../assets/images/team/venkateshwar-rao.jpg'
import photoKoteshwarRao from '../assets/images/team/koteshwar-rao.jpg'
import photoAkash from '../assets/images/team/akash.jpg'
import photoVarshita from '../assets/images/team/varshita.jpg'
import photoPoojith from '../assets/images/team/poojith.jpg'
import photoSanjay from '../assets/images/team/sanjay.jpg'
import photoDheeran from '../assets/images/team/dheeran.jpg'
import photoDeepak from '../assets/images/team/deepak.jpg'
import photoPrasanna from '../assets/images/team/prasanna.jpg'
import photoAlekhya from '../assets/images/speakers/alekhya.jpg'
import photoTejaswini from '../assets/images/speakers/tejaswini.jpg'
import photoTezan from '../assets/images/speakers/tezan.jpg'
import photoVinuthna from '../assets/images/speakers/vinuthna.jpg'
import photoSampath from '../assets/images/speakers/sampath.jpg'
import photoSaiKiran from '../assets/images/speakers/saikiran.jpg'
import photoNawab from '../assets/images/speakers/nawab-mir-nasir-ali-khan.jpg'
import { speakers as speakerData } from './event'

export const nav = [
  { label: 'Theme', to: '/theme' },
  { label: 'Speakers', to: '/speakers' },
  { label: 'Team', to: '/team' },
  { label: 'About', to: '/about-tedxklh' },
  { label: 'Contact', to: '/contact' },
]

// Event facts, the speaker roster and public contact details live in a separate,
// asset-free module so the build-time prerenderer (plain Node, no Vite/JSX) can
// import them too. `speakers` there stays photo-free for that reason — real
// headshots are asset imports, which only this (browser-bundled) module can do,
// so they're merged in here by slug and re-exported under the same name every
// existing `from '../data/site'` import already expects.
export { event, contact, isRevealed } from './event'

const speakerPhotos = {
  'alekhya-singapore': photoAlekhya,
  'tejaswini-adada': photoTejaswini,
  'tezan-sahu': photoTezan,
  'vinuthna-jagarlapudi': photoVinuthna,
  'sampath-akondi': photoSampath,
  'katapally-sai-kiran': photoSaiKiran,
  'nawab-mir-nasir-ali-khan': photoNawab,
}

export const speakers = speakerData.map((s) => ({
  ...s,
  photo: speakerPhotos[s.slug] || s.photo,
}))

export const schedule = [
  { time: '09:30', label: 'Doors Open & Registration' },
  { time: '10:00', label: 'Opening — Theme Reveal' },
  { time: '10:20', label: 'Session I · Signals', slugs: ['alekhya-singapore', 'tezan-sahu'] },
  { time: '11:40', label: 'Interval — Idea Lounge & Networking' },
  { time: '12:10', label: 'Session II · Roots', slugs: ['tejaswini-adada', 'sampath-akondi'] },
  { time: '13:30', label: 'Lunch & Speaker Salons' },
  { time: '14:30', label: 'Session III · Futures', slugs: ['katapally-sai-kiran', 'vinuthna-jagarlapudi'] },
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
      title: 'Seven speakers. One question.',
      body: 'We invited seven people who have already had to make that choice — in a clinic, in a boardroom, in an oncology ward, in a lab, on a stage, on a screen, at a negotiating table. They will not tell you what to think. They will tell you what it cost them to think it.',
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
      { value: '6', label: 'Speakers' },
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
  'Web Development',
]

// Leadership shown first on the Team page, one headed row per role. The
// Organiser (matched by exact role text in Team.jsx) gets the large featured
// card; everyone else here — including the Principal, the institution's
// patron rather than part of the student organizing team — shares the
// co-lead row.
export const teamLeadership = [
  { name: 'Dr Koteshwar Rao', role: 'Principal', photo: photoKoteshwarRao },
  {
    name: 'Sreya Tulasi',
    role: 'Organiser',
    photo: photoSreya,
    socials: { linkedin: 'https://www.linkedin.com/in/sreyatulasikolasani/' },
  },
  { name: 'Krishnanjaneyulu', role: 'Co-organiser', photo: photoKrishnanjaneyulu },
  { name: 'Akash', role: 'Curator', photo: photoAkash },
  { name: 'Shareef', role: 'Head of Department — CS&IT', photo: photoShareef },
]

export const team = [
  // Hospitality
  { name: 'Yashwant', dept: 'Hospitality', role: 'Leader', photo: photoYashwant },
  { name: 'Divya', dept: 'Hospitality', role: 'Co Leader', photo: photoDivya, photoPos: '50% 15%' },
  { name: 'Lakshmi Prasanna', dept: 'Hospitality', role: 'Faculty Member of Hospitality', photo: photoLakshmiPrasanna, photoPos: '50% 20%' },
  { name: 'Naga', dept: 'Hospitality', photo: photoNaga },
  { name: 'Mahathi', dept: 'Hospitality', photo: photoMahathi, photoPos: '50% 30%' },
  { name: 'Chervi', dept: 'Hospitality', photo: photoChervi, photoPos: '50% 30%' },
  { name: 'Tanmai', dept: 'Hospitality', photo: photoTanmai, photoPos: '70% 25%' },
  { name: 'Dhanvin', dept: 'Hospitality', photo: photoDhanvin },
  { name: 'Tarun', dept: 'Hospitality', photo: photoTarun },
  { name: 'Ganesh', dept: 'Hospitality', photo: photoGanesh },
  { name: 'Vamsi', dept: 'Hospitality', photo: photoVamsi },
  { name: 'Sanuhya', dept: 'Hospitality', photo: photoSanuhya, photoPos: '50% 60%' },
  { name: 'Subramanyam', dept: 'Hospitality', photo: photoSubramanyam },
  { name: 'Naveena', dept: 'Hospitality', photo: photoNaveena, photoPos: '50% 30%' },
  // photoPos on Varshita only: hers is a full-body shot cropped to head and
  // torso, so cover still needs biasing upward. The other four arrived as
  // head-and-shoulders portraits and sit correctly at the default centre.
  { name: 'Varshita', dept: 'Hospitality', photo: photoVarshita, photoPos: '50% 12%' },
  { name: 'Poojith', dept: 'Hospitality', photo: photoPoojith },
  { name: 'Sanjay', dept: 'Hospitality', photo: photoSanjay },
  { name: 'Dheeran', dept: 'Hospitality', photo: photoDheeran },
  { name: 'Deepak', dept: 'Hospitality', photo: photoDeepak },
  // Full-length seated portrait, so bias the crop upward to keep the face in frame.
  { name: 'Prasanna', dept: 'Hospitality', photo: photoPrasanna, photoPos: '50% 20%' },
  // Sponsorship
  { name: 'Vallabh', dept: 'Sponsorship', photo: photoVallabh },
  { name: 'Kaushik', dept: 'Sponsorship', photo: photoKaushik },
  { name: 'Shreyas', dept: 'Sponsorship', photo: photoShreyas, photoPos: '50% 40%' },
  // Marketing
  { name: 'Suhas G', dept: 'Marketing', role: 'Leader', photo: photoSuhasG },
  { name: 'Pemesh', dept: 'Marketing', role: 'Co Leader', photo: photoPemesh },
  { name: 'Venkateshwar Rao', dept: 'Marketing', role: 'Faculty Member of Marketing', photo: photoVenkateshwarRao },
  { name: 'Sohith', dept: 'Marketing', photo: photoSohit, photoPos: '50% 70%' },
  { name: 'Chakrika', dept: 'Marketing', photo: photoChakrika },
  { name: 'Rasagnya', dept: 'Marketing', photo: photoRasagnya },
  { name: 'Akshitha', dept: 'Marketing', photo: photoAkshitha },
  { name: 'Ashwika', dept: 'Marketing', photo: photoAshwika },
  { name: 'Anuradha', dept: 'Marketing', photo: photoAnuradha },
  { name: 'Parinitha', dept: 'Marketing', photo: photoParinitha },
  // Productions
  { name: 'Suhas', dept: 'Productions', photo: photoSuhasWeb },
  { name: 'Srikar', dept: 'Productions', photo: photoSrikar },
  // Web Development
  {
    name: 'Pujith',
    dept: 'Web Development',
    photo: photoPujith,
    socials: {
      linkedin: 'https://www.linkedin.com/in/somapujith10/',
      github: 'https://github.com/somapujith',
    },
  },
]

export const blogPosts = [
  { slug: 'behind-the-theme', title: 'Behind the Theme: Technology Evolves. Humanity Leads.', category: 'Curation', readTime: '5 min read', excerpt: 'How we landed on the theme for our 2026 edition and why negotiating with intelligence itself is the defining problem of our generation.', author: 'Karthik Verma', date: '2026-07-12' },
  { slug: 'curating-six-voices', title: 'Curating Six Voices: The Rehearsal Process', category: 'Behind The Scenes', readTime: '7 min read', excerpt: 'What happens when you bring a dermatologist, a business leader, an oncologist, an AI scientist, a singer, and a comedy writer into the same room? A look inside our curation process.', author: 'Sneha Reddy', date: '2026-06-28' },
  { slug: 'the-anatomy-of-a-red-dot', title: 'The Anatomy of a Red Circle: Stage Design', category: 'Production', readTime: '4 min read', excerpt: 'Designing a cinematic stage environment at the KL University auditorium. Balancing projection design, lighting grids, and speakers’ comfort.', author: 'Pranav Bose', date: '2026-06-15' },
  { slug: 'how-to-nominate-a-speaker', title: 'How to Nominate a Speaker for TEDxKLH 2026', category: 'Guide', readTime: '3 min read', excerpt: 'We look for ideas, not resumes. Here is a breakdown of what makes a proposal catch our curation team’s attention.', author: 'Aditi Sharma', date: '2026-05-30' },
]

export const galleryTiles = ['STAGE', 'AUDIENCE', 'GREEN ROOM', 'LOBBY', 'PORTRAIT', 'AFTER-PARTY', 'INSTALL', 'CREW']

export const experience = [
  { title: 'Idea Lounge', body: 'A curated lobby of installations, interactive demos, and zines from local labs.' },
  { title: 'Speaker Salons', body: 'Twenty-minute round tables with each speaker between sessions. First come, first seated.' },
  { title: 'Red Circle Studio', body: 'A pop-up portrait studio shooting every guest on a single roll of medium format film.' },
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
