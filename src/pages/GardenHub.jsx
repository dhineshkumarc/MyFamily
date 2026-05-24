import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const LOC = {
  name: 'Parker, CO', zone: '6a',
  lat: 39.5186, lon: -104.7614,
  lastFrost:  { month: 4, day: 15 },
  firstFrost: { month: 9, day: 1  },
};

const MILESTONES = [
  { month: 0,  day: 20, text: '🧅 Start onion & leek seeds — 16 wks before last frost' },
  { month: 1,  day: 1,  text: '🌶️ Start peppers indoors — 14 wks before May 15' },
  { month: 2,  day: 1,  text: '🍅 Start tomato seeds indoors — 10 wks before May 15' },
  { month: 3,  day: 15, text: '🫛 Direct sow peas outdoors — frost-tolerant' },
  { month: 4,  day: 1,  text: '⚠️ 2 WEEKS TO LAST FROST — Intensify hardening off!' },
  { month: 4,  day: 15, text: '🎉 LAST FROST DATE — Safe to plant tomatoes, peppers, basil!' },
  { month: 5,  day: 1,  text: '⛈️ Hailstorm season begins in CO — set up hail protection' },
  { month: 6,  day: 1,  text: '⏰ 12 wks to Oct 1 frost — start fall brassicas indoors' },
  { month: 7,  day: 1,  text: '🌱 LAST CHANCE: Sow fall spinach & lettuce for pre-frost harvest' },
  { month: 8,  day: 1,  text: '🧄 Garlic planting window opens — plant Sep 15 to Oct 15' },
  { month: 8,  day: 15, text: '🧄 Plant garlic TODAY! Hardneck Rocambole excels in Zone 6a' },
  { month: 9,  day: 1,  text: '❄️ AVERAGE FIRST FROST DATE — Protect all tender plants!' },
  { month: 9,  day: 15, text: '❄️ Hard freeze likely — harvest everything remaining' },
  { month: 10, day: 1,  text: '🌿 Growing season over — winterize, rest & plan!' },
  { month: 11, day: 21, text: '🎄 Winter solstice — daylight increasing. Dream of spring!' },
];

const WEEKLY_TASKS_BY_MONTH = {
  0: [['Order seeds','Review last year\'s notes','Make crop rotation plan','Check stored root veg'],
      ['Start onion seeds indoors','Set up grow lights','Sterilize seed trays','Inspect overwintering plants'],
      ['Sharpen pruning shears','Inventory compost supplies','Sketch bed layout','Test stored garlic'],
      ['Test seed germination','Order missing supplies','Clean & oil all tools','Plan drip irrigation']],
  1: [['Start pepper & eggplant seeds indoors (10–12 wks)','Set heat mat to 75–85°F','Label seed trays','Check grow light height'],
      ['Pot up onion seedlings if rootbound','Fertilize onions','Check seedling humidity','Pre-amend raised beds'],
      ['Start celery seeds','Thin onion seedlings','Order seed potatoes','Review soil pH (target 6.0–7.0)'],
      ['Pot up leggy pepper seedlings','Harden off cold-hardy transplants','Turn compost','Plan trellis placements']],
  2: [['Start tomato seeds indoors (6–8 wks before May 15)','Start broccoli & cabbage','Maintain bottom heat for tomatoes','Fertilize onion seedlings'],
      ['Pot up tomatoes at first true leaf','Amend raised beds with compost','Begin hardening off brassicas','Start snapdragons indoors'],
      ['Start basil seeds indoors','Check soil temp (50°F+ for direct sow)','Clear winter debris','Test drip irrigation'],
      ['Direct sow spinach & lettuce under row cover','Harden off broccoli daily','Top-dress beds with compost','Check and repair trellises']],
  3: [['Direct sow peas outdoors — frost-tolerant','Plant onion sets (frost protection ready)','Sow lettuce under row cover','Check tomato seedlings'],
      ['Direct sow carrots & beets','Transplant broccoli & cabbage with frost cloth','Fertilize tomato seedlings','Start cucumber seeds indoors'],
      ['Begin hardening off tomatoes — 2 wks before May 15','Move basil to cold frame','Weed raised beds','Check pea germination'],
      ['Prep transplant holes with compost','Install pea & cucumber trellis','Succession-sow more lettuce','Verify soil temp 60°F+ for beans']],
  4: [['⚠️ Last frost May 15 — do NOT set warm crops outside before mid-month','Final hardening off tomatoes & peppers','Prepare transplant holes','Direct sow beans after May 15'],
      ['🎉 AFTER MAY 15: Transplant tomatoes!','Transplant peppers & eggplant','Direct sow cucumbers & squash','Transplant basil'],
      ['Stake every tomato at planting','Install drip irrigation','Mulch all beds 2–3" deep','Thin carrot & beet seedlings'],
      ['Water deeply 1"+ per week','Pinch first flower buds on tomatoes','Monitor for late frost','Side-dress heavy feeders']],
  5: [['Succession sow beans & zucchini every 2 weeks','Set up drip irrigation timer','Fertilize tomatoes','Check brassicas for aphids'],
      ['Mulch around tomatoes & peppers','Thin corn to 12" apart','Prune tomato suckers','Check squash for vine borer'],
      ['⛈️ Hailstorm season — install hail netting','Deep water every 2–3 days','Stake peppers against CO wind','Deadhead annual flowers'],
      ['Feed heavy feeders: tomatoes, corn, squash','Check drip emitters for clogs','Harvest lettuce before it bolts','Remove yellowing lower tomato leaves']],
  6: [['Start fall broccoli & cabbage indoors (8–10 wks before Oct 1)','Harvest zucchini every 2 days','Deep water during heat','Scout for spider mites'],
      ['Fertilize tomatoes with calcium','Pinch basil tops','Add drip emitters for struggling plants','Direct sow second carrot crop'],
      ['Collect & dry herb seeds','Prune disease-affected tomato branches','Check soil pH','Side-dress corn with nitrogen'],
      ['⚠️ 8 weeks until Oct 1 frost — plan fall garden NOW','Water consistently','Harvest beans before over-maturity','Note what worked this season']],
  7: [['SOW NOW: Spinach & lettuce direct (deadline ~Aug 15)','Transplant fall broccoli & cabbage','Direct sow arugula & radishes','Order garlic for October planting'],
      ['Sow fall kale & Swiss chard','Collect seeds from heirloom varieties','Remove spent bean plants','Water fall seedlings in August heat'],
      ['Apply row cover over fall seedlings','Harvest winter squash when stem dries','Dig potatoes','Reduce nitrogen on tomatoes'],
      ['⚠️ Oct 1 frost is 4–5 weeks away — all fall crops must be in','Save heirloom seeds','Begin end-of-season notes','Check stored squash & potatoes']],
  8: [['Check forecast daily — frost averages Oct 1','Harvest tomatoes — bring in green ones if frost threatens','Cut & dry herbs','Plant garlic cloves 2" deep after Sep 15'],
      ['Plant spring bulbs: tulips, daffodils, crocus','Pull spent tomato & bean plants','Prepare row covers for first frost','Harvest & cure winter squash'],
      ['Dig carrots, beets & potatoes before hard freeze','Sow cover crops (winter rye, clover)','Plant cold-tolerant pansies','Bring tender potted plants indoors'],
      ['⚠️ Late September — frost possible any night in Parker','Mulch perennials for Zone 6a winter','Drain drip irrigation lines','Add fallen leaves to compost']],
  9: [['⚠️ First frost has arrived — harvest or protect tender crops','Plant garlic','Continue planting spring bulbs','Rake leaves — add to compost'],
      ['Harvest kale & chard after frost — sweeter!','Dig remaining carrots & parsnips','Clean empty beds & top-dress','Drain & store all garden hoses'],
      ['Mulch all perennial beds with 3–4" straw','Cut back dead perennials','Oil & store all tools','Note best-performing varieties'],
      ['Plant last garlic before ground freezes','Deep water all perennials','Cover strawberry beds with straw mulch','Close down irrigation system']],
  10:[['Bring in remaining root vegetables','Deep-clean & oil all hand tools','Spread compost on empty beds','Write crop rotation plan'],
      ['Drain all irrigation lines fully','Check stored squash & potatoes for rot','Add final leaves to compost pile','Add mulch to cold-sensitive perennials'],
      ['Clean & store seed trays & pots','Turn compost pile one final time','Prune storm-damaged branches','Plan bed layout changes for next season'],
      ['Browse seed catalogs — popular varieties sell out fast!','Check garlic bed for mulch coverage','Final wellness check on stored root vegetables','Rest & recharge 🌿']],
  11:[['Browse seed catalogs & make wish list','Review this year\'s garden journal','Plan crop rotation for next year','Remove rotting stored vegetables'],
      ['Order seeds early — short-season CO varieties sell out!','Build seed-starting schedule for 2027','Research short-season varieties (<70 days)','Check grow lights'],
      ['Inventory saved seeds','Deep-clean indoor growing area','Plan soil amendments needed','Research companion planting'],
      ['Finalize seed orders','Label seed storage containers by start-month','Rest and recharge for the new year','🎄 Happy holidays — seeds of joy ordered!']],
};

const SEASON_PHASES = [
  { monthStart:0,  monthEnd:1,  name:'Winter Planning', emoji:'❄️',  color:'#3b82f6', desc:'Order seeds, plan layout, start onions indoors' },
  { monthStart:2,  monthEnd:2,  name:'Seed Starting',   emoji:'🌱',  color:'#22c55e', desc:'Start tomatoes, peppers, broccoli indoors' },
  { monthStart:3,  monthEnd:3,  name:'Transplant Prep', emoji:'🪴',  color:'#4ade80', desc:'Harden off starts, sow peas, prep beds for May' },
  { monthStart:4,  monthEnd:4,  name:'Main Planting',   emoji:'🌿',  color:'#16a34a', desc:'Transplant after May 15 last frost' },
  { monthStart:5,  monthEnd:6,  name:'Peak Growing',    emoji:'☀️',  color:'#f59e0b', desc:'Full harvest mode, succession sow, watch for hail' },
  { monthStart:7,  monthEnd:8,  name:'Fall Transition', emoji:'🍂',  color:'#ea580c', desc:'Sow fall crops, save seeds, plant garlic' },
  { monthStart:9,  monthEnd:9,  name:'First Frost',     emoji:'🍁',  color:'#dc2626', desc:'Harvest everything, mulch perennials, winterize' },
  { monthStart:10, monthEnd:11, name:'Winter Rest',     emoji:'🌙',  color:'#6366f1', desc:'Clean up, plan next year, order seeds early' },
];

const WEATHER_CODES = {
  0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
  45:'Foggy',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',
  80:'Rain showers',81:'Heavy showers',82:'Violent showers',
  95:'Thunderstorm',96:'Thunderstorm w/ hail',99:'Thunderstorm w/ heavy hail',
};
const WEATHER_EMOJI = {
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌧️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',
  71:'🌨️',73:'❄️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',
  95:'⛈️',96:'⛈️',99:'⛈️',
};

function daysUntil(m, day, now) {
  const t = new Date(now.getFullYear(), m, day);
  if (t < now) t.setFullYear(now.getFullYear() + 1);
  return Math.ceil((t - now) / 86400000);
}
function daysSince(m, day, now) {
  const t = new Date(now.getFullYear(), m, day);
  if (t > now) t.setFullYear(now.getFullYear() - 1);
  return Math.floor((now - t) / 86400000);
}
function getSeasonPhase(month) {
  return SEASON_PHASES.find(p => month >= p.monthStart && month <= p.monthEnd) || SEASON_PHASES[0];
}
function getTodayTasks(month, day) {
  const wi = Math.min(Math.floor((day - 1) / 7), 3);
  return (WEEKLY_TASKS_BY_MONTH[month] || [])[wi] || [];
}
function getNextMilestones(now) {
  return MILESTONES.map(m => {
    const t = new Date(now.getFullYear(), m.month, m.day);
    if (t < now) t.setFullYear(now.getFullYear() + 1);
    return { ...m, days: Math.ceil((t - now) / 86400000) };
  }).filter(m => m.days >= 0).sort((a, b) => a.days - b.days).slice(0, 2);
}

const FEATURED_PLANTS = [
  { id:1, name:'Lavender',  category:'Herb',      description:'Aromatic purple blooms, pollinator magnet, drought-tolerant in Zone 6a.', icon:'💜' },
  { id:2, name:'Sunflower', category:'Annual',    description:'Bright giants that follow the sun and produce edible seeds.', icon:'🌻' },
  { id:3, name:'Basil',     category:'Herb',      description:'Fragrant kitchen herb — plant outdoors only after May 15 in Parker.', icon:'🌿' },
  { id:4, name:'Tomato',    category:'Vegetable', description:'Choose ≤70-day varieties for Parker\'s short growing season.', icon:'🍅' },
  { id:5, name:'Kale',      category:'Vegetable', description:'Cold-hardy CO favorite — sweetens after the first frost!', icon:'🥬' },
  { id:6, name:'Garlic',    category:'Vegetable', description:'Plant Sep–Oct for a June harvest. Thrives at Parker\'s elevation.', icon:'🧄' },
];

export default function GardenHub() {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LOC.lat}&longitude=${LOC.lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FDenver`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const c = data.current;
        setWeather({
          temp:      Math.round(c.temperature_2m),
          feelsLike: Math.round(c.apparent_temperature),
          code:      c.weather_code,
          wind:      Math.round(c.wind_speed_10m),
          humidity:  c.relative_humidity_2m,
          desc:      WEATHER_CODES[c.weather_code] ?? 'Unknown',
          emoji:     WEATHER_EMOJI[c.weather_code] ?? '🌡️',
        });
      })
      .catch(() => setWeatherError(true));
  }, []);

  const month = now.getMonth();
  const day   = now.getDate();
  const phase      = getSeasonPhase(month);
  const todayTasks = getTodayTasks(month, day);
  const nextMs     = getNextMilestones(now);

  const lastFrostDate  = new Date(now.getFullYear(), LOC.lastFrost.month,  LOC.lastFrost.day);
  const firstFrostDate = new Date(now.getFullYear(), LOC.firstFrost.month, LOC.firstFrost.day);
  const isBeforeLastFrost = now < lastFrostDate;
  const isGrowingSeason   = now >= lastFrostDate && now < firstFrostDate;

  const daysToLastFrost    = daysUntil(LOC.lastFrost.month,  LOC.lastFrost.day,  now);
  const daysSinceLastFrost = daysSince(LOC.lastFrost.month,  LOC.lastFrost.day,  now);
  const daysToFirstFrost   = daysUntil(LOC.firstFrost.month, LOC.firstFrost.day, now);

  const seasonPct = isGrowingSeason
    ? Math.min(100, Math.round((daysSinceLastFrost / 138) * 100))
    : isBeforeLastFrost ? 0 : 100;

  const frostWarning =
    (weather && weather.temp <= 36 && isGrowingSeason)
      ? `⚠️ Frost risk tonight (${weather.temp}°F) — protect tender plants!`
    : (isBeforeLastFrost && daysToLastFrost <= 7)
      ? `⚠️ Last frost in ${daysToLastFrost} day${daysToLastFrost===1?'':'s'} — keep warm crops indoors!`
    : (isGrowingSeason && daysToFirstFrost <= 7)
      ? `❄️ First frost in ${daysToFirstFrost} day${daysToFirstFrost===1?'':'s'} — protect tender plants!`
    : null;

  const timeStr = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });

  return (
    <main className="home">
      {/* Garden section header */}
      <section className="garden-section-header" style={{ marginBottom: 0 }}>
        <div className="garden-section-inner">
          <h2>🌿 MyFamily</h2>
          <p style={{ color: '#bbf7d0', margin: '0.25rem 0 1rem' }}>Family room dashboard · unified home and lifestyle tools</p>
          <div className="garden-header-links">
            <Link to="/calendar" className="garden-pill">📆 Calendar</Link>
            <Link to="/harvest"  className="garden-pill">🥬 Harvest</Link>
            <Link to="/map"      className="garden-pill">🌱 Map</Link>
            <Link to="/plants"   className="garden-pill">🌻 Plants</Link>
            <Link to="/blog"     className="garden-pill">📝 Tips</Link>
          </div>
        </div>
      </section>

      {/* Daily Dashboard */}
      <section className="daily-dashboard">
        <div className="dashboard-inner">

          {/* Date & Clock */}
          <div className="dash-card dash-clock">
            <div className="dash-card-label">📅 Today</div>
            <div className="dash-time">{timeStr}</div>
            <div className="dash-date">{dateStr}</div>
            <div className="dash-zone-badge">Zone 6a · Parker, CO</div>
          </div>

          {/* Weather */}
          <div className="dash-card dash-weather">
            <div className="dash-card-label">🌡️ Current Weather</div>
            {weather ? (
              <>
                <div className="weather-main">
                  <span className="weather-emoji-big">{weather.emoji}</span>
                  <span className="weather-temp">{weather.temp}°F</span>
                </div>
                <div className="weather-desc">{weather.desc}</div>
                <div className="weather-meta">
                  <span>Feels {weather.feelsLike}°F</span>
                  <span>💨 {weather.wind} mph</span>
                  <span>💧 {weather.humidity}%</span>
                </div>
                {frostWarning && <div className="frost-warning">{frostWarning}</div>}
              </>
            ) : weatherError ? (
              <div className="weather-offline">📡 Weather unavailable<br/><small>Check weather.gov for Parker, CO</small></div>
            ) : (
              <div className="weather-loading">Loading weather…</div>
            )}
          </div>

          {/* Season status */}
          <div className="dash-card dash-season">
            <div className="dash-card-label">🌿 Growing Season</div>
            <div className="season-phase-row">
              <span className="season-phase-icon">{phase.emoji}</span>
              <div>
                <div className="season-phase-name">{phase.name}</div>
                <div className="season-phase-desc">{phase.desc}</div>
              </div>
            </div>
            <div className="season-bar-wrap">
              <div className="season-bar-track">
                <div className="season-bar-fill" style={{ width: seasonPct + '%' }} />
              </div>
              <div className="season-bar-labels">
                <span>May 15</span>
                <span>{seasonPct}%</span>
                <span>Oct 1</span>
              </div>
            </div>
            <div className="frost-dates-row">
              {isBeforeLastFrost ? (
                <span className="frost-chip frost-upcoming">🌸 Last frost in {daysToLastFrost} day{daysToLastFrost===1?'':'s'}</span>
              ) : (
                <span className="frost-chip frost-past">✅ Last frost {daysSinceLastFrost}d ago</span>
              )}
              {isGrowingSeason && (
                <span className="frost-chip frost-warn">❄️ First frost in {daysToFirstFrost}d</span>
              )}
            </div>
          </div>

          {/* Today's tasks */}
          <div className="dash-card dash-tasks">
            <div className="dash-card-label">✅ Today's Top Tasks</div>
            <ul className="task-preview-list">
              {todayTasks.slice(0, 4).map((t, i) => (
                <li key={i} className="task-preview-item">{t}</li>
              ))}
            </ul>
            <Link to="/calendar" className="dash-more-link">Open daily checklist →</Link>
          </div>

          {/* Upcoming milestones */}
          <div className="dash-card dash-milestones">
            <div className="dash-card-label">⭐ Coming Up</div>
            {nextMs.map((m, i) => (
              <div key={i} className="milestone-item">
                <div className="milestone-days">{m.days === 0 ? 'TODAY' : `In ${m.days}d`}</div>
                <div className="milestone-text">{m.text}</div>
              </div>
            ))}
            <Link to="/calendar" className="dash-more-link">Full calendar →</Link>
          </div>

        </div>
      </section>

      {/* Stats bar */}
      <section className="stats-bar">
        <div className="stat"><strong>120+</strong> Plants Catalogued</div>
        <div className="stat"><strong>50+</strong> Gardening Tips</div>
        <div className="stat"><strong>138</strong> Growing-Season Days</div>
        <div className="stat"><strong>Zone 6a</strong> Parker, CO</div>
      </section>

      {/* Featured Plants */}
      <section className="section">
        <div className="section-header">
          <h2>Featured Plants</h2>
          <Link to="/plants" className="see-all">View all plants →</Link>
        </div>
        <div className="plant-grid">
          {FEATURED_PLANTS.map(plant => (
            <div key={plant.id} className="plant-card">
              <div className="plant-icon">{plant.icon}</div>
              <span className="plant-category">{plant.category}</span>
              <h3>{plant.name}</h3>
              <p>{plant.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tips Preview */}
      <section className="section tips-section">
        <div className="section-header">
          <h2>Quick Gardening Tips</h2>
          <Link to="/blog" className="see-all">All tips →</Link>
        </div>
        <div className="tips-grid">
          {[
            { title:'Water in the Morning', excerpt:'Morning watering reduces evaporation and prevents fungal diseases by letting foliage dry before evening.', icon:'💧' },
            { title:'Composting Basics', excerpt:'Turn kitchen scraps into garden gold. Balance greens (nitrogen) and browns (carbon) in equal parts.', icon:'♻️' },
            { title:'Companion Planting', excerpt:'Pair plants strategically to deter pests and improve yields — tomatoes love basil, carrots love onions.', icon:'🤝' },
          ].map((tip, i) => (
            <div key={i} className="tip-card">
              <span className="tip-icon">{tip.icon}</span>
              <div>
                <h3>{tip.title}</h3>
                <p>{tip.excerpt}</p>
                <Link to="/blog" className="read-more">Read more →</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="cta-banner">
        <h2>Ready to Start Growing?</h2>
        <p>Check your daily checklist to know exactly what to do in Parker today.</p>
        <Link to="/calendar" className="btn-primary">Open Daily Checklist</Link>
      </section>
    </main>
  );
}
