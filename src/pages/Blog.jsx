import { useState } from 'react';
import './Blog.css';

const posts = [
  {
    id: 1, title: 'Watering Wisely: Morning vs Evening', category: 'Watering',
    date: 'March 12, 2026', readTime: '4 min',
    excerpt: 'The time you water your plants can make a surprising difference. Morning watering gives plants the moisture they need for the day while leaves dry quickly, preventing fungal diseases.',
    content: 'Water in the morning between 6–10 AM. This lets soil absorb water before the heat of the day causes evaporation. Foliage dries quickly which reduces disease risk. Evening watering leaves leaves wet overnight — perfect conditions for fungi and mildew.',
    icon: '💧', tags: ['watering', 'tips', 'beginners'],
  },
  {
    id: 2, title: 'Building a Compost Pile from Scratch', category: 'Soil',
    date: 'March 5, 2026', readTime: '6 min',
    excerpt: 'Turn your kitchen scraps and yard waste into rich, dark compost that will supercharge your garden soil. It\'s easier than you think!',
    content: 'Composting requires greens (nitrogen-rich materials like kitchen scraps, grass clippings) and browns (carbon-rich materials like dried leaves, cardboard). Layer them, keep it moist, and turn it every few weeks. In 2–3 months you\'ll have black gold.',
    icon: '♻️', tags: ['compost', 'soil', 'sustainability'],
  },
  {
    id: 3, title: 'Companion Planting: Strategic Plant Pairings', category: 'Planning',
    date: 'February 28, 2026', readTime: '5 min',
    excerpt: 'Some plants are best friends in the garden. Learn which combinations boost growth, deter pests, and improve flavor.',
    content: 'Classic companions: Tomatoes & Basil (basil repels aphids and improves tomato flavor). Three Sisters: Corn, beans, and squash planted together — corn provides a trellis, beans fix nitrogen, squash shades the ground. Marigolds with almost anything repel many pests.',
    icon: '🤝', tags: ['companion planting', 'organic', 'planning'],
  },
  {
    id: 4, title: 'Dealing with Common Garden Pests Naturally', category: 'Pest Control',
    date: 'February 20, 2026', readTime: '7 min',
    excerpt: 'Before reaching for chemical pesticides, try these effective natural methods to keep pests at bay while protecting beneficial insects.',
    content: 'Neem oil spray works on aphids, spider mites, and whiteflies. Diatomaceous earth around plant bases deters slugs and beetles. Hand-pick larger pests like caterpillars in the evening. Introduce beneficial insects like ladybugs and lacewings that feed on pest insects.',
    icon: '🐛', tags: ['pest control', 'organic', 'natural'],
  },
  {
    id: 5, title: 'Starting Seeds Indoors: A Complete Guide', category: 'Propagation',
    date: 'February 10, 2026', readTime: '8 min',
    excerpt: 'Get a head start on the growing season by starting seeds indoors 6–8 weeks before the last frost date. Here\'s everything you need to know.',
    content: 'Use a quality seed-starting mix, not garden soil. Sow at the depth indicated on the seed packet — usually 2× the seed diameter. Maintain warmth (65–75°F) and consistent moisture. Once sprouted, provide 14–16 hours of light daily. Harden off seedlings before transplanting outside.',
    icon: '🌱', tags: ['seeds', 'propagation', 'indoor'],
  },
  {
    id: 6, title: 'The Secret to Lush, Green Lawns', category: 'Lawn Care',
    date: 'January 30, 2026', readTime: '5 min',
    excerpt: 'Achieve the lawn of your dreams with these tried-and-true techniques covering mowing, feeding, and aeration.',
    content: 'Never cut more than 1/3 of grass blade height at once. Keep mower blades sharp. Feed with a balanced fertilizer in spring and fall. Aerate compacted soil every 1–2 years. Water deeply but infrequently (1 inch per week) rather than shallow daily watering.',
    icon: '🌾', tags: ['lawn', 'grass', 'maintenance'],
  },
];

const categories = ['All', 'Watering', 'Soil', 'Planning', 'Pest Control', 'Propagation', 'Lawn Care'];

export default function Blog() {
  const [active, setActive] = useState(null);
  const [cat, setCat] = useState('All');

  const filtered = cat === 'All' ? posts : posts.filter(p => p.category === cat);

  if (active) {
    const post = posts.find(p => p.id === active);
    return (
      <main className="blog-page">
        <div className="back-bar">
          <button className="back-btn" onClick={() => setActive(null)}>← Back to Blog</button>
        </div>
        <article className="full-post">
          <span className="post-cat">{post.category}</span>
          <h1>{post.icon} {post.title}</h1>
          <div className="post-meta">{post.date} · {post.readTime} read</div>
          <p className="post-excerpt">{post.excerpt}</p>
          <hr />
          <p className="post-body">{post.content}</p>
          <div className="post-tags">
            {post.tags.map(t => <span key={t} className="post-tag">#{t}</span>)}
          </div>
        </article>
      </main>
    );
  }

  return (
    <main className="blog-page">
      <div className="page-hero" style={{ background: 'linear-gradient(135deg, #1b4332, #52b788)' }}>
        <h1>📝 Tips & Blog</h1>
        <p>Practical gardening advice for every skill level.</p>
      </div>

      <div className="blog-container">
        {/* Category tabs */}
        <div className="cat-tabs">
          {categories.map(c => (
            <button key={c} className={`cat-tab ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>

        {/* Post grid */}
        <div className="posts-grid">
          {filtered.map(post => (
            <article key={post.id} className="post-card" onClick={() => setActive(post.id)}>
              <div className="post-card-icon">{post.icon}</div>
              <span className="post-cat">{post.category}</span>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
              <div className="post-card-footer">
                <span>{post.date}</span>
                <span>{post.readTime} read</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
