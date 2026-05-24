import { useState } from 'react';
import './Plants.css';

const allPlants = [
  { id: 1, name: 'Lavender', category: 'Herb', light: 'Full Sun', water: 'Low', difficulty: 'Easy', description: 'Fragrant purple blooms loved by bees and butterflies. Drought-tolerant once established.', icon: '💜' },
  { id: 2, name: 'Sunflower', category: 'Annual', light: 'Full Sun', water: 'Medium', difficulty: 'Easy', description: 'Tall, cheerful flowers that track the sun. Seeds are a favorite of birds.', icon: '🌻' },
  { id: 3, name: 'Basil', category: 'Herb', light: 'Full Sun', water: 'Medium', difficulty: 'Easy', description: 'Essential kitchen herb. Pinch flowers to keep leaves flavorful all season.', icon: '🌿' },
  { id: 4, name: 'Rose', category: 'Perennial', light: 'Full Sun', water: 'Medium', difficulty: 'Medium', description: 'Classic beauty. Hundreds of varieties range from climbing to miniature.', icon: '🌹' },
  { id: 5, name: 'Mint', category: 'Herb', light: 'Partial Shade', water: 'High', difficulty: 'Easy', description: 'Vigorous spreader — grow in containers to contain it. Great for teas.', icon: '🍃' },
  { id: 6, name: 'Tomato', category: 'Vegetable', light: 'Full Sun', water: 'High', difficulty: 'Medium', description: 'Nothing beats a homegrown tomato. Needs staking and consistent watering.', icon: '🍅' },
  { id: 7, name: 'Fern', category: 'Perennial', light: 'Shade', water: 'High', difficulty: 'Easy', description: 'Lush, feathery fronds that thrive in shady, moist spots.', icon: '🌿' },
  { id: 8, name: 'Marigold', category: 'Annual', light: 'Full Sun', water: 'Low', difficulty: 'Easy', description: 'Pest-repelling powerhouse. Plant near vegetables to deter aphids and whiteflies.', icon: '🌼' },
  { id: 9, name: 'Pepper', category: 'Vegetable', light: 'Full Sun', water: 'Medium', difficulty: 'Medium', description: 'Versatile vegetable from mild bell peppers to fiery chilis. Loves heat.', icon: '🌶️' },
  { id: 10, name: 'Hydrangea', category: 'Perennial', light: 'Partial Shade', water: 'High', difficulty: 'Medium', description: 'Showy clusters of flowers that change color based on soil pH.', icon: '💙' },
  { id: 11, name: 'Rosemary', category: 'Herb', light: 'Full Sun', water: 'Low', difficulty: 'Easy', description: 'Woody Mediterranean herb. Drought-tolerant and deer-resistant.', icon: '🌱' },
  { id: 12, name: 'Zucchini', category: 'Vegetable', light: 'Full Sun', water: 'High', difficulty: 'Easy', description: 'Prolific producer. One or two plants yield more than most families can eat.', icon: '🥒' },
];

const categories = ['All', 'Herb', 'Annual', 'Perennial', 'Vegetable'];
const difficulties = ['All', 'Easy', 'Medium', 'Hard'];

export default function Plants() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [difficulty, setDifficulty] = useState('All');

  const filtered = allPlants.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || p.category === category;
    const matchDiff = difficulty === 'All' || p.difficulty === difficulty;
    return matchSearch && matchCat && matchDiff;
  });

  return (
    <main className="plants-page">
      <div className="page-hero green-hero">
        <h1>🌿 Plant Catalog</h1>
        <p>Browse our collection of {allPlants.length} plants — from herbs to vegetables and beyond.</p>
      </div>

      <div className="plants-container">
        {/* Filters */}
        <aside className="filters">
          <h3>Filter Plants</h3>
          <input
            type="search"
            placeholder="Search plants..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="search-input"
          />
          <div className="filter-group">
            <label>Category</label>
            {categories.map(c => (
              <button key={c} className={`filter-btn ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
            ))}
          </div>
          <div className="filter-group">
            <label>Difficulty</label>
            {difficulties.map(d => (
              <button key={d} className={`filter-btn ${difficulty === d ? 'active' : ''}`} onClick={() => setDifficulty(d)}>{d}</button>
            ))}
          </div>
          <p className="result-count">{filtered.length} plant{filtered.length !== 1 ? 's' : ''} found</p>
        </aside>

        {/* Grid */}
        <div className="plants-grid">
          {filtered.length === 0 ? (
            <p className="no-results">No plants match your filters. Try a different search.</p>
          ) : filtered.map(plant => (
            <div key={plant.id} className="plant-full-card">
              <div className="pfc-top">
                <span className="pfc-icon">{plant.icon}</span>
                <div>
                  <h3>{plant.name}</h3>
                  <span className="tag">{plant.category}</span>
                </div>
              </div>
              <p className="pfc-desc">{plant.description}</p>
              <div className="pfc-meta">
                <span>☀️ {plant.light}</span>
                <span>💧 {plant.water}</span>
                <span className={`difficulty diff-${plant.difficulty.toLowerCase()}`}>{plant.difficulty}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
