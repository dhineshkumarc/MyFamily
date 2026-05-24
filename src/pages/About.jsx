import './About.css';

const values = [
  { icon: '�', title: 'Family First', desc: 'We build tools that bring family life, home routines, and shared tasks together in one place.' },
  { icon: '🔗', title: 'Connected Home', desc: 'MCP server and Home Assistant data are integrated into the family room dashboard for unified monitoring.' },
  { icon: '🧠', title: 'Smart Simplicity', desc: 'The app turns home, garden, and family management into one easy-to-use experience.' },
  { icon: '♿', title: 'Accessible Living', desc: 'The dashboard is designed to work for every household, whether you are busy or growing at your own pace.' },
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
            MyFamily started as a small notebook of home routines and smart home ideas scribbled down in a family room.
            What began as personal planning notes quickly grew into a dashboard that brings garden care, household tasks,
            and home automation together.
          </p>
          <p>
            Today, we're a dedicated team building a family dashboard that connects garden tracking, meal planning, budget
            management, and smart home status in one place — including MCP server and Home Assistant details right in the
            family room experience.
          </p>
          <p>
            Our mission is simple: <strong>make family life easier and more connected</strong>, with tools that help every
            household stay organized, informed, and in control.
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
