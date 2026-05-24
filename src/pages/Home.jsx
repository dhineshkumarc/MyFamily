import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

function getGreeting(h) {
  if (h < 5)  return { text: 'Good night',     emoji: '🌙' };
  if (h < 12) return { text: 'Good morning',   emoji: '🌅' };
  if (h < 17) return { text: 'Good afternoon', emoji: '☀️' };
  return       { text: 'Good evening',         emoji: '🌇' };
}


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
  }).filter(m => m.days >= 0).sort((a,b) => a.days - b.days).slice(0, 2);
}

const FEATURED_PLANTS = [
  { id:1, name:'Lavender',  category:'Herb',      description:'Aromatic purple blooms, pollinator magnet, drought-tolerant in Zone 6a.', icon:'💜' },
  { id:2, name:'Sunflower', category:'Annual',    description:'Bright giants that follow the sun and produce edible seeds.', icon:'🌻' },
  { id:3, name:'Basil',     category:'Herb',      description:'Fragrant kitchen herb — plant outdoors only after May 15 in Parker.', icon:'🌿' },
  { id:4, name:'Tomato',    category:'Vegetable', description:'Choose ≤70-day varieties for Parker\'s short growing season.', icon:'🍅' },
  { id:5, name:'Kale',      category:'Vegetable', description:'Cold-hardy CO favorite — sweetens after the first frost!', icon:'🥬' },
  { id:6, name:'Garlic',    category:'Vegetable', description:'Plant Sep–Oct for a June harvest. Thrives at Parker\'s elevation.', icon:'🧄' },
];

export default function Home() {
  const [now, setNow] = useState(new Date());
  const [gardenOpen, setGardenOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const greeting = getGreeting(now.getHours());

  const ALL_APPS = [
        { group: 'Family',
      items: [
        { to:'/library',     emoji:'🏛️', label:'Library' },
        { to:'/mail',        emoji:'✉️', label:'Mail' },
        { to:'/bank',        emoji:'🏦', label:'Bank' },
        { to:'/credit',      emoji:'💳', label:'Credit' },
        { to:'/family',       emoji:'👤', label:'Members'      },
        { to:'/appointments', emoji:'📅', label:'Appointments' },
        { to:'/schedule',     emoji:'🗓', label:'Schedule'     },
        { to:'/todo',         emoji:'✅', label:'Lists'        },
        { to:'/school',       emoji:'🏫', label:'School'       },
        { to:'/gallery',      emoji:'📸', label:'Gallery'      },
        { to:'/thermostat',   emoji:'🌡️', label:'Thermostat'  },
        { to:'/shopping',     emoji:'🛒', label:'Shopping'     },
        { to:'/budget',       emoji:'💰', label:'Budget'       },
        { to:'/meals',        emoji:'🍽️', label:'Meals'       },
        { to:'/medications',  emoji:'💊', label:'Medications'  },
        { to:'/vehicles',     emoji:'🚗', label:'Vehicles'     },
        { to:'/inventory',    emoji:'📦', label:'Inventory'    },
        { to:'/chores',       emoji:'🧹', label:'Chores'       },
        { to:'/pets',         emoji:'🐾', label:'Pets'         },
        { to:'/bulletin',     emoji:'📌', label:'Bulletin'     },
        { to:'/goals',        emoji:'🎯', label:'Goals'        },
        { to:'/reading',      emoji:'📚', label:'Reading'      },
        { to:'/achievements', emoji:'🏆', label:'Achievements' },
        { to:'/packing',      emoji:'🎒', label:'Packing'      },
        { to:'/maintenance',  emoji:'🔧', label:'Maintenance'  },
        { to:'/documents',    emoji:'📄', label:'Documents'    },
        { to:'/packages',     emoji:'📬', label:'Packages'     },
        { to:'/watchlist',    emoji:'🎬', label:'Watchlist'    },
        { to:'/trips',        emoji:'✈️', label:'Trips'       },
      ]
    },
    { group: 'Garden',
      items: [
        { to:'/garden',   emoji:'🌿', label:'Garden Hub' },
        { to:'/calendar', emoji:'📆', label:'Calendar'   },
        { to:'/harvest',  emoji:'🥬', label:'Harvest'    },
        { to:'/map',      emoji:'🌱', label:'Map'        },
        { to:'/plants',   emoji:'🌻', label:'Plants'     },
        { to:'/blog',     emoji:'📝', label:'Tips'       },
      ]
    },
  ];

  return (
    <main className="home">
      {/* ── Greeting bar ── */}
      <div className="home-greeting-bar">
        <span className="greeting-emoji">{greeting.emoji}</span>
        <span className="greeting-text">{greeting.text}!</span>
      </div>

      {/* ── App icon grid ── */}
      {ALL_APPS.map(group => (
        <section key={group.group} className="app-group">
          <div className="app-group-label">{group.group}</div>
          <div className="app-icon-grid">
            {group.items.map(app => (
              <Link key={app.to} to={app.to} className="app-icon-item" aria-label={app.label} title={app.label}>
                <span className="app-icon-emoji">{app.emoji}</span>
                <span className="app-icon-label">{app.label}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* end icon grid */}
    </main>
  );
}


