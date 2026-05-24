import './About.css';

const values = [
  { icon: '🌱', title: 'Grow Sustainably', desc: 'We champion organic methods, composting, and companion planting to work with nature, not against it.' },
  { icon: '🤝', title: 'Community First', desc: 'Gardening is better together. We share knowledge freely and celebrate every gardener\'s success.' },
  { icon: '📚', title: 'Evidence-Based Tips', desc: 'Our advice is rooted in horticultural science, not just folklore. We test, research, and then recommend.' },
  { icon: '♿', title: 'Accessible Gardening', desc: 'Great gardens can be grown on any scale — from a windowsill to an acre. Everyone deserves to grow.' },
];

const team = [
  { name: 'Dhinesh Kumar', role: 'Founder & Head Gardener', emoji: '🧑‍🌾', bio: 'Passionate about sustainable gardening and sharing knowledge with the gardening community.' },
  { name: 'Priya Sharma', role: 'Plant Botanist', emoji: '👩‍🔬', bio: 'PhD botanist with 15 years studying plant physiology and companion planting systems.' },
  { name: 'Marcus Green', role: 'Soil Specialist', emoji: '👨‍🌾', bio: 'Composting evangelist and certified master gardener helping gardeners build incredible soil.' },
];

export default function About() {
  return (
    <main className="about-page">
      <div className="page-hero about-hero">
        <h1>🌿 Our Story</h1>
        <p>A passion project turned community platform — dedicated to helping everyone grow.</p>
      </div>

      {/* Story section */}
      <section className="about-section story-section">
        <div className="story-text">
          <h2>How It All Began</h2>
          <p>
            MyGardening started as a small notebook of growing tips scribbled down over weekends in a tiny backyard garden.
            What began as personal notes quickly grew into a resource shared with neighbors, then friends, then the world.
          </p>
          <p>
            Today, we're a dedicated team of gardeners, botanists, and soil enthusiasts committed to making gardening knowledge
            accessible to everyone — whether you're growing herbs on a balcony or tending an acre of vegetables.
          </p>
          <p>
            Our mission is simple: <strong>help every person grow something beautiful and delicious</strong>, using methods
            that are good for the gardener, the community, and the planet.
          </p>
        </div>
        <div className="story-visual">
          <div className="story-emoji-stack">
            <span>🌻</span><span>🌿</span><span>🍅</span>
            <span>🌸</span><span>🌱</span><span>🪴</span>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="values-section">
        <div className="values-inner">
          <h2>What We Stand For</h2>
          <div className="values-grid">
            {values.map(v => (
              <div key={v.title} className="value-card">
                <div className="value-icon">{v.icon}</div>
                <h3>{v.title}</h3>
                <p>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="team-section">
        <div className="team-inner">
          <h2>Meet the Team</h2>
          <p className="team-subtitle">A group of plant nerds dedicated to helping your garden thrive.</p>
          <div className="team-grid">
            {team.map(member => (
              <div key={member.name} className="team-card">
                <div className="team-emoji">{member.emoji}</div>
                <h3>{member.name}</h3>
                <span className="team-role">{member.role}</span>
                <p>{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="about-stats">
        {[
          { n: '5+', label: 'Years of Growing' },
          { n: '120+', label: 'Plants Catalogued' },
          { n: '10,000+', label: 'Gardeners Helped' },
          { n: '50+', label: 'Articles Written' },
        ].map(s => (
          <div key={s.label} className="about-stat">
            <strong>{s.n}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
