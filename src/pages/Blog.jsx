import { blogPosts } from '../data/site'
import { SectionLabel, Reveal } from '../components/ui'

export default function Blog() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-24">
      <SectionLabel n="14" label="Blog · Inside the machine" />
      <h1 className="font-display text-4xl mb-16">Notes from behind the red dot.</h1>
      <div className="divide-y divide-paper/10 border-y border-paper/10">
        {blogPosts.map((post) => (
          <Reveal key={post.slug} className="py-8">
            <div className="font-mono text-xs uppercase tracking-widest text-red mb-2">
              {post.category} · {post.readTime}
            </div>
            <h2 className="font-display text-2xl mb-3">{post.title}</h2>
            <p className="text-paper/70 mb-3">{post.excerpt}</p>
            <div className="text-xs text-paper/50">
              {post.author} · {new Date(post.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  )
}
