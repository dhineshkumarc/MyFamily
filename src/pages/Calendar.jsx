import { useState, useEffect, useRef } from 'react';
import './Calendar.css';
import {
  loadChecks, saveChecks,
  loadNote, saveNote,
  loadCustomTasks, saveCustomTasks,
} from '../services/gardenData';
import DataManager from '../components/DataManager';

const LOCATION = {
  address: '11627 Laurel Ln, Parker, CO 80138',
  zone: '6a', zoneRange: '-10°F to -5°F (-23°C to -21°C)',
  elevation: '5,869 ft (1,789 m)', lastFrost: 'May 15',
  firstFrost: 'October 1', growingSeason: '~138 days',
  annualRain: '~17 inches', sunnDays: '~300 sunny days/year',
};

const DAILY_ROUTINE = [
  { id: 'r1', text: '💧 Check soil moisture — water deeply if top 2" is dry' },
  { id: 'r2', text: '🐛 Inspect all plants for pests or disease signs' },
  { id: 'r3', text: '🌡️ Check weather forecast for frost / heat / hail' },
  { id: 'r4', text: '✂️ Remove dead leaves or spent blooms' },
  { id: 'r5', text: '📝 Log any changes in plant health or growth' },
];

const WEEKLY_TASKS = {
  Jan:[
    ['Order seeds from catalog','Review last year\'s garden notes','Make crop rotation plan','Check stored root veg for rot'],
    ['Start onion & leek seeds indoors (16 wks before May 15)','Set up grow lights (14–16 hrs/day)','Sterilize seed trays & pots','Inspect any overwintering plants'],
    ['Sharpen pruning shears & hori-hori knife','Inventory compost & fertilizer supplies','Sketch bed layout for the season','Test stored garlic for viability'],
    ['Test seed germination with paper-towel method','Order missing supplies','Clean & re-oil all metal tools','Plan drip irrigation layout for spring'],
  ],
  Feb:[
    ['Start pepper & eggplant seeds indoors (10–12 wks before May 15)','Set heat mat to 75–85°F','Label seed trays with variety and date','Check grow light height (2–4" above seedlings)'],
    ['Pot up onion seedlings if rootbound','Fertilize onions with diluted liquid fertilizer','Check seedling humidity (50–60%)','Pre-amend raised beds with aged compost'],
    ['Start celery seeds indoors','Thin onion seedlings to 1" spacing','Order seed potatoes for April','Review soil pH — target 6.0–7.0'],
    ['Pot up leggy pepper seedlings','Harden off cold-hardy transplants on mild days','Turn compost if temps above 32°F','Plan trellis placements for peas & tomatoes'],
  ],
  Mar:[
    ['Start tomato seeds indoors (6–8 wks before May 15)','Start broccoli & cabbage seeds indoors','Maintain bottom heat for tomatoes (70–75°F)','Fertilize pale onion & leek seedlings'],
    ['Start snapdragons & petunias indoors','Pot up tomatoes to 4" pots at first true leaves','Amend raised beds with compost','Begin hardening off broccoli/cabbage on mild days'],
    ['Start basil seeds indoors','Check bed soil temp (50°F+ needed to direct sow)','Clear winter debris from beds','Test drip irrigation system before spring'],
    ['Direct sow spinach & lettuce under row cover (soil >35°F)','Harden off broccoli & cabbage daily','Top-dress beds with 1–2" compost','Check and repair trellises & stakes'],
  ],
  Apr:[
    ['Direct sow peas outdoors — frost-tolerant','Plant onion sets (frost protection ready)','Sow lettuce & spinach under row cover','Check tomato seedlings — pot up if rootbound'],
    ['Direct sow carrots & beets under row cover','Transplant broccoli & cabbage outdoors with frost cloth on hand','Start cucumber & squash seeds indoors (late week)','Fertilize tomato & pepper seedlings'],
    ['Begin hardening off tomatoes — 2 wks before May 15','Move basil & herb seedlings to cold frame','Weed raised beds thoroughly','Check peas for germination — thin to 2"'],
    ['Prep transplant holes with compost for May planting','Install pea & cucumber trellis','Succession-sow more lettuce','Verify soil temp 60°F+ (beans & squash need this)'],
  ],
  May:[
    ['⚠️ Last frost May 15 — do NOT set warm crops outside before mid-month','Final hardening off: tomatoes & peppers all day outdoors','Prepare transplant holes with compost + slow-release fertilizer','Direct sow beans after May 15'],
    ['🎉 AFTER MAY 15: Transplant tomatoes outdoors!','Transplant peppers & eggplant after May 15','Direct sow cucumbers, squash & corn after May 15','Transplant basil — frost-tender, after May 15 only'],
    ['Stake every tomato at time of planting','Install drip irrigation / soaker hoses','Mulch all beds 2–3" deep — high altitude dries fast','Thin carrot & beet seedlings to 2–3"'],
    ['Water deeply 1"+ per week — never shallow water','Pinch first flower buds on tomatoes to build roots','Monitor for late frost through end of May','Side-dress heavy feeders with balanced fertilizer'],
  ],
  Jun:[
    ['Succession sow beans & zucchini every 2 weeks','Set up drip irrigation timer','Apply balanced fertilizer to tomatoes & peppers','Check brassicas for aphids — treat with neem oil'],
    ['Mulch around tomatoes & peppers (moisture retention)','Thin corn to 12" apart','Prune tomato suckers on indeterminate varieties','Check squash stems for vine borer eggs'],
    ['⛈️ Hailstorm season — install hail netting if possible','Deep water every 2–3 days (not shallow daily watering)','Stake peppers against CO wind','Deadhead annual flowers for continuous bloom'],
    ['Feed heavy feeders: tomatoes, corn, squash','Check drip emitters for clogs','Harvest lettuce & spinach before it bolts','Remove yellowing lower tomato leaves'],
  ],
  Jul:[
    ['Start fall broccoli & cabbage indoors (8–10 wks before Oct 1)','Harvest zucchini every 2 days — overgrown stops production','Deep water during heat waves','Scout for spider mites & squash bug nymphs'],
    ['Fertilize tomatoes with calcium to prevent blossom end rot','Pinch basil tops to prevent flowering','Add drip emitters for struggling plants','Direct sow second carrot crop'],
    ['Collect & dry herb seeds (cilantro, dill)','Prune disease-affected tomato branches','Check soil pH — add lime if below 6.0','Side-dress corn with nitrogen fertilizer'],
    ['⚠️ 8 weeks until Oct 1 frost — plan fall garden NOW','Water consistently — dry spells cause BER in tomatoes','Harvest beans before over-maturity','Note what worked & what did not this season'],
  ],
  Aug:[
    ['⚠️ SOW NOW: Spinach & lettuce direct (deadline ~Aug 15 for Oct 1 harvest)','Transplant fall broccoli & cabbage starts outdoors','Direct sow arugula, radishes & turnips','Order garlic bulbs for October planting'],
    ['Sow more fall greens: kale, Swiss chard','Collect seeds from heirloom tomatoes, peppers, squash','Remove & compost spent bean plants','Water fall seedlings consistently in August heat'],
    ['Apply row cover over fall seedlings to keep cool','Harvest winter squash when stem dries & skin is hard','Dig potatoes once foliage dies back','Reduce nitrogen on tomatoes to encourage ripening'],
    ['⚠️ Oct 1 frost is 4–5 weeks away — all fall crops must be in','Save heirloom seeds: wash, dry, store cool','Begin end-of-season garden journal notes','Check stored squash & potatoes'],
  ],
  Sep:[
    ['Check forecast daily — first frost averages Oct 1 (can be earlier!)','Harvest tomatoes — bring in green ones if frost threatens','Cut & dry herbs: basil, oregano, thyme, rosemary','Plant garlic cloves 2" deep after Sep 15'],
    ['Plant spring bulbs: tulips, daffodils, crocus','Pull spent tomato & bean plants — compost them','Prepare row covers for first frost protection','Harvest & cure winter squash in warm dry area (10 days at 80°F)'],
    ['Dig carrots, beets & potatoes before hard freeze','Sow cover crops (winter rye, clover) in empty beds','Plant cold-tolerant pansies & ornamental kale','Bring tender potted plants indoors before 40°F nights'],
    ['⚠️ Late September — frost possible any night in Parker','Mulch perennials (lavender, roses) for Zone 6a winter','Drain drip irrigation lines before freezing temps','Add fallen leaves to compost pile'],
  ],
  Oct:[
    ['⚠️ First frost has arrived — harvest or protect all tender crops','Plant garlic (before ground freezes)','Continue planting spring bulbs','Rake leaves — add to compost or use as mulch'],
    ['Harvest kale & chard after frost — sweeter!','Dig remaining carrots & parsnips — frost sweetens them','Clean empty beds & top-dress with compost','Drain & store all garden hoses'],
    ['Mulch all perennial beds with 3–4" compost or straw','Cut back dead perennials (leave some for wildlife shelter)','Oil & store all tools','Note best-performing varieties for next year'],
    ['Plant last garlic before ground freezes','Deep water all perennials before winter dryness','Cover strawberry beds with straw mulch','Close down irrigation system completely'],
  ],
  Nov:[
    ['Bring in remaining root vegetables before hard freeze','Deep-clean & oil all hand tools before storage','Spread compost or aged manure on empty beds','Write crop rotation plan for next year'],
    ['Drain all irrigation lines fully','Check stored squash, potatoes & garlic for rot','Add final leaves to compost pile','Add extra mulch to cold-sensitive perennials'],
    ['Clean & store seed trays, pots & labels','Turn compost pile one final time','Prune storm-damaged branches on trees & shrubs','Plan bed layout changes for next season'],
    ['Browse seed catalogs — popular varieties sell out fast!','Check garlic bed — add mulch if bare','Final wellness check on stored root vegetables','Rest & recharge — you have earned it! 🌿'],
  ],
  Dec:[
    ['Browse seed catalogs & make wish list for 2027','Review this year\'s garden journal','Plan Zone 6a crop rotation for next year','Remove any rotting stored vegetables'],
    ['Order seeds early — short-season CO varieties sell out!','Build seed-starting schedule for Zone 6a 2027','Research short-season varieties (<70 days) for CO','Check grow lights — replace any burnt bulbs'],
    ['Inventory saved seeds — check viability dates','Deep-clean indoor growing area','Plan soil amendments needed for spring','Research companion planting combos'],
    ['Finalize seed orders & confirm shipping','Label seed storage containers by start-month','Rest and recharge for the new gardening year','🎄 Happy holidays — seeds of joy ordered!'],
  ],
};

const MILESTONES = {
  'Jan-20': '🧅 Start onion & leek seeds TODAY — 16 wks before last frost May 15',
  'Feb-1':  '🌶️ Start peppers today if not yet — 14 wks before May 15',
  'Feb-15': '🌶️ Last window to start peppers on time for May 15 transplant',
  'Mar-1':  '🍅 Start tomato seeds indoors — 10 wks before May 15',
  'Mar-19': '🍅 Final window to start tomatoes for May 15 transplant',
  'Apr-6':  '🌱 TODAY — You are in the April gardening window (Zone 6a)',
  'Apr-15': '🫛 Direct sow peas outdoors now — frost-tolerant & loves cool soil',
  'May-1':  '⚠️ 2 WEEKS TO LAST FROST — Intensify hardening off every day now!',
  'May-15': '🎉 LAST FROST DATE — Safe to plant tomatoes, peppers, basil outdoors!',
  'Jun-1':  '⛈️ Hailstorm season begins in CO — set up hail protection now',
  'Jul-1':  '⏰ 12 weeks to Oct 1 first frost — start fall brassicas indoors TODAY',
  'Aug-1':  '🌱 LAST CHANCE: Sow fall spinach & lettuce direct for pre-frost harvest',
  'Sep-1':  '🧄 Garlic planting window opens — plant Sep 15 to Oct 15',
  'Sep-15': '🧄 Plant garlic TODAY! Hardneck Rocambole/Porcelain excels in Zone 6a',
  'Oct-1':  '❄️ AVERAGE FIRST FROST DATE — Protect all tender plants tonight!',
  'Oct-15': '❄️ Hard freeze likely any night — harvest everything remaining',
  'Nov-1':  '🌿 Growing season over — winterize, rest & plan!',
  'Dec-21': '🎄 Winter solstice — daylight increasing. Start dreaming of spring!',
};

const seedGuide = [
  { crop:'Peppers & Eggplant',       icon:'🌶️', startWeeks:'10–12 wks before', startDate:'Mar 4–18',          transplant:'After May 15',                 notes:'Needs warmth to germinate (75–85°F)' },
  { crop:'Tomatoes',                 icon:'🍅', startWeeks:'6–8 wks before',   startDate:'Mar 19 – Apr 2',    transplant:'After May 15',                 notes:'Harden off 1–2 weeks before transplanting' },
  { crop:'Broccoli & Cabbage',       icon:'🥦', startWeeks:'6–8 wks before',   startDate:'Mar 19 – Apr 2',    transplant:'Apr 28 – May 8 (frost-hardy)', notes:'Can tolerate light frost' },
  { crop:'Onions & Leeks',           icon:'🧅', startWeeks:'10–12 wks before', startDate:'Mar 4–18',          transplant:'After May 1 (hardened)',       notes:'Very cold-hardy once established' },
  { crop:'Lettuce & Spinach',        icon:'🥬', startWeeks:'4–6 wks before',   startDate:'Apr 3–17',          transplant:'After Apr 20 (with protection)', notes:'Sow direct outdoors Apr 20+ under row cover' },
  { crop:'Cucumbers & Squash',       icon:'🥒', startWeeks:'3–4 wks before',   startDate:'Apr 17 – May 1',    transplant:'After May 15',                 notes:'Direct sow fine too after May 15' },
  { crop:'Basil',                    icon:'🌿', startWeeks:'4–6 wks before',   startDate:'Apr 3–17',          transplant:'After May 15 (frost-tender)',   notes:'Keep indoors until all frost risk gone' },
  { crop:'Peas',                     icon:'🫛', startWeeks:'Direct sow',        startDate:'Apr 15 – May 1',    transplant:'N/A',                          notes:'Sow direct — tolerates frost' },
  { crop:'Beans & Corn',             icon:'🌽', startWeeks:'Direct sow',        startDate:'After May 15',      transplant:'N/A',                          notes:'Direct sow only after all frost risk gone' },
  { crop:'Carrots & Beets',          icon:'🥕', startWeeks:'Direct sow',        startDate:'After May 10',      transplant:'N/A',                          notes:'Direct sow; thin to 2–3 inches apart' },
  { crop:'Fall Broccoli & Kale',     icon:'🌱', startWeeks:'8–10 wks before Oct 1', startDate:'Jul 23 – Aug 6', transplant:'Aug 13–27',                  notes:'Get fall crops in before first frost Oct 1' },
  { crop:'Spinach & Lettuce (fall)', icon:'🥗', startWeeks:'Direct sow',        startDate:'Aug 1–15',          transplant:'N/A',                          notes:'Sow direct for fall harvest before Oct 1' },
  { crop:'Garlic',                   icon:'🧄', startWeeks:'Plant in fall',     startDate:'Sep 15 – Oct 15',   transplant:'N/A',                          notes:'Plant cloves 2" deep; overwinters for June harvest' },
];

const OVERVIEW = {
  Jan:{ sow:['Onions & Leeks (indoors, late Jan)','Perennial herbs (indoors)'], plant:[], harvest:['Stored root vegetables','Kale under row cover'], tasks:['Order seeds & plan layout','Clean and sharpen tools','Test soil pH & nutrients','Review last year\'s garden notes'] },
  Feb:{ sow:['Peppers & Eggplant (indoors, 10–12 wks)','Celery (indoors)','Leeks (indoors)'], plant:[], harvest:['Stored crops','Overwintered greens'], tasks:['Set up seed-starting station','Check grow lights','Stratify perennial seeds','Prep seed-starting mix'] },
  Mar:{ sow:['Tomatoes (indoors, mid-late Mar — 6–8 wks before May 15)','Broccoli & Cabbage (indoors)','Petunias & Snapdragons (indoors)'], plant:['Nothing outdoors yet — last frost still 6+ weeks away'], harvest:['Stored root vegetables'], tasks:['Start tomato seedlings','Pot up onion & leek seedlings','Begin hardening off cold-hardy starts late month','Add compost to raised beds'] },
  Apr:{ sow:['Lettuce & Spinach (indoors or under row cover)','Cucumbers & Squash (indoors, late Apr)','Basil (indoors)','Carrots & Beets (direct, late Apr under cover)'], plant:['Peas (direct sow mid-Apr, frost-tolerant)','Onion sets (with frost protection)'], harvest:['Overwintered spinach & kale','Stored root vegetables'], tasks:['Harden off broccoli/cabbage for outdoor transplant late Apr','Apply row cover to protect from late frost','Set up raised beds & trellises','Begin watering schedule'] },
  May:{ sow:['Beans (direct after May 15)','Corn (direct after May 15)','Squash & Cucumbers (direct after May 15)','Sunflowers (after May 15)'], plant:['Tomatoes (after May 15!)','Peppers & Eggplant (after May 15)','Basil (after May 15)','Broccoli & Cabbage transplants (early May)','Lettuce & Spinach transplants'], harvest:['Lettuce','Spinach','Peas (late May)','Herbs','Asparagus (established beds)'], tasks:['⚠️ Last frost May 15 — keep warm crops in before this','Stake tomatoes at planting','Water deeply 1" per week','Mulch 2–3": high altitude dries fast'] },
  Jun:{ sow:['Second planting of beans','Second planting of salad greens','Zucchini & summer squash'], plant:['Cucumbers','Squash','Corn'], harvest:['Lettuce','Spinach','Peas','Herbs','Radishes','Early beans'], tasks:['Thin seedlings to proper spacing','Mulch beds — high altitude sun dries soil fast','Set up drip irrigation','Watch for aphids & harlequin bugs','Feed tomatoes & peppers'] },
  Jul:{ sow:['Fall broccoli & cabbage (indoors, early Jul)','Fall kale (indoors)','Second carrots (direct)'], plant:[], harvest:['Green beans','Cucumbers','Zucchini','Early tomatoes','Herbs','Peppers'], tasks:['Harvest regularly — overgrown squash stops production','Deep water during heat','Deadhead flowers for continued bloom','Monitor for squash vine borers & spider mites','Start planning fall plantings'] },
  Aug:{ sow:['Spinach (direct, Aug 1–15 for fall harvest)','Lettuce (direct, Aug 1–15)','Arugula & Radishes (direct)','Turnips & Kale (direct)'], plant:['Fall broccoli & cabbage transplants (Aug 13–27)','Fall kale transplants'], harvest:['Tomatoes','Peppers','Eggplant','Corn','Cucumbers','Green beans','Herbs'], tasks:['⚠️ First fall frost Oct 1 — get fall crops in by mid-Aug','Collect & save seeds from heirloom varieties','Begin winding down warm crops','Order garlic for fall planting'] },
  Sep:{ sow:['Cover crops (rye, clover) after clearing beds'], plant:['Garlic (Sep 15–Oct 15)','Spring bulbs (tulips, daffodils)','Pansies & Ornamental kale (frost-tolerant)'], harvest:['Winter squash (cure before frost)','Potatoes','Late tomatoes (pick before first frost Oct 1)','Peppers','Herbs — harvest & dry before frost'], tasks:['Watch forecast — frost can arrive early in Parker','Prepare row covers & frost cloth for Oct 1','Clean spent plants & add to compost','Bring in green tomatoes before hard freeze'] },
  Oct:{ sow:['Garlic (cloves, early Oct)'], plant:['Spring bulbs (tulips, daffodils, crocus)','More garlic'], harvest:['Root vegetables (sweeter after frost)','Winter squash','Kale & Chard (frost-hardy)','Last summer crops before hard freeze'], tasks:['⚠️ Average first frost Oct 1 — protect or harvest remaining crops','Mulch perennials for Zone 6a winters','Drain & store hoses and drip irrigation','Rake leaves into compost pile','Plant garlic before ground freezes'] },
  Nov:{ sow:[], plant:[], harvest:['Kale & Brussels sprouts (frost-sweetened)','Root vegetables still in ground','Stored squash & potatoes'], tasks:['Deep-clean and oil all tools','Spread compost on empty beds','Note bed rotations for next year','Drain irrigation — Parker freezes hard'] },
  Dec:{ sow:[], plant:[], harvest:['Stored root vegetables','Preserved herbs','Stored winter squash'], tasks:['Browse seed catalogs for next season','Review this year\'s successes & failures','Make Zone 6a seed-starting calendar for 2027','Rest — you\'ve earned it! 🌿'] },
};

const YEAR = 2026;
const MONTH_IDX = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
const MONTH_FULL = { Jan:'January',Feb:'February',Mar:'March',Apr:'April',May:'May',Jun:'June',Jul:'July',Aug:'August',Sep:'September',Oct:'October',Nov:'November',Dec:'December' };
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getDaysInMonth(m) { return new Date(YEAR, MONTH_IDX[m]+1, 0).getDate(); }
function getFirstDayOfWeek(m) { return new Date(YEAR, MONTH_IDX[m], 1).getDay(); }
function getDayName(m, d) { return DAY_NAMES[new Date(YEAR, MONTH_IDX[m], d).getDay()]; }

function getTasksForDay(m, d) {
  const weekIdx = Math.min(Math.floor((d - 1) / 7), 3);
  const weekly = (WEEKLY_TASKS[m] || [])[weekIdx] || [];
  const ms = MILESTONES[m + '-' + d] ? [MILESTONES[m + '-' + d]] : [];
  return [...ms, ...weekly];
}

function getDayStatus(month, day) {
  const tasks = getTasksForDay(month, day);
  const customTasks = loadCustomTasks(month, day);
  const allIds = [
    ...DAILY_ROUTINE.map(r => r.id),
    ...tasks.map((_, i) => 't' + i),
    ...customTasks.map((_, i) => 'c' + i),
  ];
  const checked = loadChecks(month, day);
  const done = allIds.filter(id => checked[id]).length;
  return { done, total: allIds.length, hasMilestone: !!MILESTONES[month + '-' + day] };
}

function DayChecklist({ month, day, onClose }) {
  const tasks = getTasksForDay(month, day);
  const [checked,     setChecked]     = useState(() => loadChecks(month, day));
  const [note,        setNote]        = useState(() => loadNote(month, day));
  const [customTasks, setCustomTasks] = useState(() => loadCustomTasks(month, day));
  const [newTask,     setNewTask]     = useState('');
  const noteTimer = useRef(null);
  const milestone = MILESTONES[month + '-' + day];

  const allIds = [
    ...DAILY_ROUTINE.map(r => r.id),
    ...tasks.map((_, i) => 't' + i),
    ...customTasks.map((_, i) => 'c' + i),
  ];

  const toggle = (id) => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    saveChecks(month, day, next);
  };
  const markAll = () => {
    const next = Object.fromEntries(allIds.map(id => [id, true]));
    setChecked(next);
    saveChecks(month, day, next);
  };
  const resetDay = () => { setChecked({}); saveChecks(month, day, {}); };

  const handleNoteChange = (e) => {
    const val = e.target.value;
    setNote(val);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => saveNote(month, day, val), 600);
  };

  const addCustomTask = () => {
    const trimmed = newTask.trim();
    if (!trimmed) return;
    const next = [...customTasks, trimmed];
    setCustomTasks(next);
    saveCustomTasks(month, day, next);
    setNewTask('');
  };
  const removeCustomTask = (idx) => {
    const next = customTasks.filter((_, i) => i !== idx);
    // also clear its checkbox
    const nextChecked = { ...checked };
    delete nextChecked['c' + idx];
    next.forEach((_, ni) => { if (checked['c' + (ni + (ni >= idx ? 1 : 0))]) nextChecked['c' + ni] = true; });
    setCustomTasks(next);
    saveCustomTasks(month, day, next);
    setChecked(nextChecked);
    saveChecks(month, day, nextChecked);
  };

  const done = allIds.filter(id => checked[id]).length;
  const pct = allIds.length ? Math.round((done / allIds.length) * 100) : 0;

  return (
    <div className="day-panel">
      <div className="day-panel-header">
        <div>
          <div className="day-panel-date">{getDayName(month, day)}, {MONTH_FULL[month]} {day}, {YEAR}</div>
          <div className="day-panel-sub">Parker, CO · Zone 6a · {done}/{allIds.length} done</div>
        </div>
        <button className="day-panel-close" onClick={onClose}>✕</button>
      </div>

      {milestone && <div className="milestone-alert">{milestone}</div>}

      <div className="progress-bar-wrap">
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{width: pct + '%', background: pct===100?'#22c55e':pct>0?'#f59e0b':'#d1fae5'}} />
        </div>
        <span className="progress-label">{done} of {allIds.length} tasks complete — {pct}%</span>
      </div>

      <div className="day-actions">
        <button className="day-act-btn mark-all" onClick={markAll}>✅ Mark All Done</button>
        <button className="day-act-btn reset" onClick={resetDay}>↺ Reset Day</button>
      </div>

      {/* Daily Routine */}
      <div className="checklist-section">
        <h4 className="checklist-section-title routine-title">📋 Daily Routine <span className="section-badge">Every day</span></h4>
        {DAILY_ROUTINE.map(r => (
          <label key={r.id} className={'checklist-item' + (checked[r.id] ? ' checked' : '')}>
            <input type="checkbox" checked={!!checked[r.id]} onChange={() => toggle(r.id)} />
            <span>{r.text}</span>
          </label>
        ))}
      </div>

      {/* Weekly tasks */}
      {tasks.length > 0 && (
        <div className="checklist-section">
          <h4 className="checklist-section-title special-title">🌱 Today's Garden Tasks <span className="section-badge">Week {Math.min(Math.floor((day-1)/7)+1, 4)}</span></h4>
          {tasks.map((t, i) => (
            <label key={'t'+i} className={'checklist-item' + (checked['t'+i] ? ' checked' : '')}>
              <input type="checkbox" checked={!!checked['t'+i]} onChange={() => toggle('t'+i)} />
              <span>{t}</span>
            </label>
          ))}
        </div>
      )}

      {/* Custom tasks */}
      <div className="checklist-section">
        <h4 className="checklist-section-title custom-title">⚙️ My Custom Tasks <span className="section-badge">Saved locally + cloud</span></h4>
        {customTasks.map((t, i) => (
          <div key={'c'+i} className={'checklist-item custom-item' + (checked['c'+i] ? ' checked' : '')}>
            <label style={{flex:1, display:'flex', alignItems:'center', gap:'0.5rem'}}>
              <input type="checkbox" checked={!!checked['c'+i]} onChange={() => toggle('c'+i)} />
              <span>{t}</span>
            </label>
            <button className="remove-task-btn" title="Remove" onClick={() => removeCustomTask(i)}>✕</button>
          </div>
        ))}
        <div className="add-task-row">
          <input
            className="add-task-input"
            type="text"
            value={newTask}
            placeholder="+ Add a custom task for this day..."
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomTask()}
          />
          <button className="add-task-btn" onClick={addCustomTask}>Add</button>
        </div>
      </div>

      {/* Notes */}
      <div className="checklist-section">
        <h4 className="checklist-section-title note-title">📓 Garden Journal Note <span className="section-badge">Saved locally + cloud</span></h4>
        <textarea
          className="day-note-area"
          value={note}
          onChange={handleNoteChange}
          placeholder="Record observations, plant health notes, what you harvested, weather, etc..."
          rows={4}
        />
      </div>
    </div>
  );
}

function MonthGrid({ month, selectedDay, onSelectDay }) {
  const daysInMonth = getDaysInMonth(month);
  const firstDow = getFirstDayOfWeek(month);
  const todayDate = new Date();
  const isCurrentMonth = todayDate.getFullYear() === YEAR && months[todayDate.getMonth()] === month;
  const todayDay = todayDate.getDate();

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="month-cal-grid">
      {DAY_NAMES.map(n => <div key={n} className="cal-dow">{n}</div>)}
      {cells.map((d, i) => {
        if (!d) return <div key={'e'+i} className="cal-empty" />;
        const { done, total, hasMilestone } = getDayStatus(month, d);
        const isToday = isCurrentMonth && d === todayDay;
        const isSelected = d === selectedDay;
        const pct = total ? done / total : 0;
        const progColor = pct === 1 ? '#22c55e' : pct > 0 ? '#f59e0b' : '#e5e7eb';
        return (
          <button
            key={d}
            title={`${MONTH_FULL[month]} ${d} — ${done}/${total} tasks`}
            className={'cal-day-cell' + (isToday?' today':'') + (isSelected?' selected':'') + (hasMilestone?' has-milestone':'')}
            onClick={() => onSelectDay(d === selectedDay ? null : d)}
          >
            <span className="cal-day-num">{d}</span>
            <div className="cal-day-prog-bar">
              <div style={{width:(pct*100)+'%', background:progColor, height:'100%', borderRadius:2, transition:'width 0.3s'}} />
            </div>
            {hasMilestone && <span className="cal-star">★</span>}
          </button>
        );
      })}
    </div>
  );
}

const TABS = ['Daily Checklist', 'Monthly Overview', 'Seed Starting Guide', 'Backup & Sync'];
const currentMonth = months[new Date().getMonth()];

export default function Calendar() {
  const [tab, setTab] = useState('Daily Checklist');
  const [selMonth, setSelMonth] = useState(currentMonth);
  const [selDay, setSelDay] = useState(new Date().getDate());
  const [overMonth, setOverMonth] = useState(currentMonth);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const h = () => setTick(n => n+1);
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }, []);

  const od = OVERVIEW[overMonth];

  return (
    <main className="calendar-page">
      <div className="page-hero cal-hero">
        <h1>📅 Planting Calendar</h1>
        <p>Parker, CO 80138 · Zone 6a · Click any date for your daily checklist</p>
      </div>

      <div className="zone-banner">
        <div className="zone-banner-inner">
          <div className="zone-stat"><span className="zone-label">📍 Location</span><span className="zone-value">Parker, CO 80138</span></div>
          <div className="zone-stat"><span className="zone-label">🗺️ USDA Zone</span><span className="zone-value zone-badge">Zone 6a</span></div>
          <div className="zone-stat"><span className="zone-label">❄️ Min Temp</span><span className="zone-value">{LOCATION.zoneRange}</span></div>
          <div className="zone-stat"><span className="zone-label">🌸 Last Frost</span><span className="zone-value frost-last">{LOCATION.lastFrost}</span></div>
          <div className="zone-stat"><span className="zone-label">🍂 First Frost</span><span className="zone-value frost-first">{LOCATION.firstFrost}</span></div>
          <div className="zone-stat"><span className="zone-label">📆 Season</span><span className="zone-value">{LOCATION.growingSeason}</span></div>
          <div className="zone-stat"><span className="zone-label">⛰️ Elevation</span><span className="zone-value">{LOCATION.elevation}</span></div>
          <div className="zone-stat"><span className="zone-label">☀️ Sunny Days</span><span className="zone-value">{LOCATION.sunnDays}</span></div>
        </div>
      </div>

      <div className="cal-container">
        <div className="tab-bar">
          {TABS.map(t => <button key={t} className={'tab-btn'+(tab===t?' active':'')} onClick={() => setTab(t)}>{t}</button>)}
        </div>

        {tab === 'Daily Checklist' && (
          <div>
            <div className="month-strip">
              {months.map(m => (
                <button key={m} className={'mstrip-btn'+(selMonth===m?' active':'')+(m===currentMonth?' current':'')}
                  onClick={() => { setSelMonth(m); setSelDay(null); }}>
                  {m}{m===currentMonth && <span className="now-badge">Now</span>}
                </button>
              ))}
            </div>
            <div className="cal-layout">
              <div className="cal-grid-wrap">
                <div className="cal-grid-top">
                  <h3 className="cal-month-heading">{MONTH_FULL[selMonth]} {YEAR}</h3>
                  <div className="cal-legend">
                    <span><span className="legend-dot" style={{background:'#22c55e'}} /> All done</span>
                    <span><span className="legend-dot" style={{background:'#f59e0b'}} /> In progress</span>
                    <span><span className="legend-dot" style={{background:'#e5e7eb'}} /> Not started</span>
                    <span>★ Special date</span>
                  </div>
                </div>
                <MonthGrid key={selMonth+tick} month={selMonth} selectedDay={selDay} onSelectDay={setSelDay} />
                {!selDay && <p className="tap-hint">👆 Tap any date to open its daily checklist</p>}
              </div>
              {selDay && (
                <DayChecklist key={selMonth+'-'+selDay} month={selMonth} day={selDay} onClose={() => setSelDay(null)} />
              )}
            </div>
          </div>
        )}

        {tab === 'Monthly Overview' && (
          <>
            <div className="month-grid">
              {months.map(m => (
                <button key={m} className={'month-btn'+(overMonth===m?' active':'')+(m===currentMonth?' current':'')} onClick={() => setOverMonth(m)}>
                  {m}{m===currentMonth && <span className="now-badge">Now</span>}
                </button>
              ))}
            </div>
            <div className="month-detail">
              <h2>{overMonth} — What to Do in Parker, CO (Zone 6a)</h2>
              <div className="cal-sections">
                <div className="cal-section sow"><h3>🌱 Sow Indoors / Direct</h3>
                  {od.sow.length ? <ul>{od.sow.map(i=><li key={i}>{i}</li>)}</ul> : <p className="empty">Nothing to sow.</p>}
                </div>
                <div className="cal-section plant"><h3>🪴 Plant Outdoors</h3>
                  {od.plant.length ? <ul>{od.plant.map(i=><li key={i}>{i}</li>)}</ul> : <p className="empty">Nothing to plant out.</p>}
                </div>
                <div className="cal-section harvest"><h3>🧺 Harvest</h3>
                  {od.harvest.length ? <ul>{od.harvest.map(i=><li key={i}>{i}</li>)}</ul> : <p className="empty">Nothing to harvest.</p>}
                </div>
                <div className="cal-section tasks"><h3>✅ Garden Tasks</h3>
                  {od.tasks.length ? <ul>{od.tasks.map(i=><li key={i}>{i}</li>)}</ul> : <p className="empty">No specific tasks.</p>}
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'Seed Starting Guide' && (
          <div className="seed-guide">
            <div className="seed-guide-header">
              <h2>🌱 Seed Starting Schedule — Parker, CO (Zone 6a)</h2>
              <p>Based on last frost <strong>May 15</strong> and first fall frost <strong>October 1</strong></p>
            </div>
            <div className="seed-table-wrapper">
              <table className="seed-table">
                <thead><tr><th>Crop</th><th>When to Start</th><th>Target Dates</th><th>Transplant / Sow Outside</th><th>Zone 6a Notes</th></tr></thead>
                <tbody>{seedGuide.map(r=>(
                  <tr key={r.crop}>
                    <td><span className="seed-icon">{r.icon}</span> {r.crop}</td>
                    <td>{r.startWeeks}</td><td><strong>{r.startDate}</strong></td>
                    <td>{r.transplant}</td><td className="seed-notes">{r.notes}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="zone-tips">
              <h3>🏔️ High-Altitude Zone 6a Tips for Parker, CO</h3>
              <ul>
                <li><strong>Intense UV at 5,869 ft</strong> — use shade cloth for seedlings in June/July to prevent sunburn.</li>
                <li><strong>Last frost May 15</strong> — frosts have hit as late as early June. Always have frost cloth handy.</li>
                <li><strong>Short season (~138 days)</strong> — choose varieties labeled 'early' or under 70 days to maturity.</li>
                <li><strong>Dry climate (17" rain/year)</strong> — drip irrigation and 2–3" mulch are essential; high winds dry soil fast.</li>
                <li><strong>Hailstorms</strong> common in June/July — use hail netting or row covers during storm season.</li>
                <li><strong>Fall frosts arrive early</strong> — monitor daily from Sep 15 and keep frost cloth ready.</li>
                <li><strong>Garlic</strong> thrives here — plant hardneck Rocambole or Porcelain in September/October.</li>
                <li><strong>Water deeply and infrequently</strong> — deep roots handle Colorado dry spells far better.</li>
              </ul>
            </div>
          </div>
        )}
        {tab === 'Backup & Sync' && <DataManager />}
      </div>
    </main>
  );
}
