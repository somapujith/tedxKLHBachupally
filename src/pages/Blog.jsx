import { blogPosts } from '../data/site'
import { Eyebrow, Reveal } from '../components/ui'

export default function Blog() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24 md:py-32">
      <Eyebrow className="mb-5">Blog</Eyebrow>
      <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-20">
        Notes from behind the red dot.
      </h1>

      <div className="border-t border-paper/10">
        {blogPosts.map((post) => (
          <Reveal key={post.slug} className="py-10 border-b border-paper/10">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/40 mb-3">
              {post.category} · {post.readTime}
            </div>
            <h2 className="font-display text-2xl tracking-tight mb-3">{post.title}</h2>
            <p className="text-lg text-paper/70 leading-relaxed mb-4">{post.excerpt}</p>
            <div className="text-[11px] uppercase tracking-[0.2em] text-paper/40">
              {post.author} · {new Date(post.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  )
}
