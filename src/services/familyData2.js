/**
 * familyData2.js — Extended family hub data service
 *
 * Firestore layout (all under /families/{familyId}/...):
 *   shopping/{itemId}        budget/{txId}          meals/{weekKey}
 *   meds/{medId}             vehicles/{vehicleId}   inventory/{itemId}
 *   chores/{choreId}         pets/{petId}           bulletin/{postId}
 *   goals/{goalId}           reading/{bookId}       achievements/{id}
 *   packing/{tripId}         maintenance/{taskId}   documents/{docId}
 *   packages/{pkgId}         watchlist/{itemId}     trips/{tripId}
 */

import { db, firebaseReady } from '../firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

function getFamilyId() {
  let id = localStorage.getItem('family-id');
  if (!id) {
    id = 'family-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('family-id', id);
  }
  return id;
}
export const familyId = getFamilyId();

function lsGet(key)      { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function uid()           { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function col(path)       { return collection(db, 'families', familyId, path); }
function ref(path, id)   { return doc(db, 'families', familyId, path, id); }
const today = () => new Date().toISOString().slice(0, 10);

function makeService(lsKey, colPath, sortFn) {
  const load = () => lsGet(lsKey) || [];
  const save = item => {
    const list = load();
    const idx  = list.findIndex(x => x.id === item.id);
    if (idx >= 0) list[idx] = item; else list.push(item);
    lsSet(lsKey, list);
    if (firebaseReady && db) setDoc(ref(colPath, item.id), { ...item, updatedAt: new Date().toISOString() });
    return item;
  };
  const remove = id => {
    lsSet(lsKey, load().filter(x => x.id !== id));
    if (firebaseReady && db) deleteDoc(ref(colPath, id));
  };
  const subscribe = cb => {
    if (!firebaseReady || !db) { cb(load()); return () => {}; }
    return onSnapshot(col(colPath), snap => {
      if (snap.empty) { const local = load(); cb(local); local.forEach(x => setDoc(ref(colPath, x.id), { ...x, updatedAt: new Date().toISOString() })); return; }
      const data = snap.docs.map(d => d.data());
      if (sortFn) data.sort(sortFn);
      lsSet(lsKey, data);
      cb(data);
    });
  };
  return { load, save, remove, subscribe };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. SHOPPING LIST
// ═══════════════════════════════════════════════════════════════════════
const _shop = makeService('family-shopping', 'shopping', (a,b) => (a.category||'').localeCompare(b.category||'') || (a.name||'').localeCompare(b.name||''));
export const loadShopping     = _shop.load;
export const saveShoppingItem = _shop.save;
export const deleteShoppingItem = _shop.remove;
export const subscribeShopping  = _shop.subscribe;
export const SHOP_CATEGORIES = ['Produce','Meat','Dairy','Bakery','Frozen','Pantry','Beverages','Household','Personal Care','Other'];
export function newShoppingItem(fields = {}) {
  return { id: uid(), name: '', qty: '1', category: 'Other', checked: false, addedBy: '', ...fields, createdAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════
// 2. BUDGET TRACKER
// ═══════════════════════════════════════════════════════════════════════
const _bud = makeService('family-budget', 'budget', (a,b) => (b.date||'').localeCompare(a.date||''));
export const loadBudget       = _bud.load;
export const saveBudgetTx     = _bud.save;
export const deleteBudgetTx   = _bud.remove;
export const subscribeBudget  = _bud.subscribe;
export const BUDGET_CATS_EXPENSE = ['Housing','Food','Transport','Health','Education','Entertainment','Clothing','Savings','Utilities','Other'];
export const BUDGET_CATS_INCOME  = ['Salary','Freelance','Gift','Refund','Other'];
export function newBudgetTx(fields = {}) {
  return { id: uid(), type: 'expense', amount: '', category: 'Other', date: today(), note: '', memberId: '', ...fields, createdAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════
// 3. MEAL PLANNER  (stored per week, doc = weekKey)
// ═══════════════════════════════════════════════════════════════════════
const LS_MEALS = 'family-meals';
export const MEAL_TYPES = ['Breakfast','Lunch','Dinner','Snack'];
export const MEAL_DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

export function loadMeals(weekKey) {
  return (lsGet(LS_MEALS) || {})[weekKey] || [];
}
export function saveMeal(weekKey, meal) {
  const all  = lsGet(LS_MEALS) || {};
  const week = all[weekKey] || [];
  const idx  = week.findIndex(m => m.id === meal.id);
  if (idx >= 0) week[idx] = meal; else week.push(meal);
  all[weekKey] = week;
  lsSet(LS_MEALS, all);
  if (firebaseReady && db) setDoc(ref('meals', weekKey), { meals: week, updatedAt: new Date().toISOString() });
  return meal;
}
export function deleteMeal(weekKey, mealId) {
  const all  = lsGet(LS_MEALS) || {};
  all[weekKey] = (all[weekKey] || []).filter(m => m.id !== mealId);
  lsSet(LS_MEALS, all);
  if (firebaseReady && db) setDoc(ref('meals', weekKey), { meals: all[weekKey], updatedAt: new Date().toISOString() });
}
export function subscribeMeals(weekKey, cb) {
  if (!firebaseReady || !db) { cb(loadMeals(weekKey)); return () => {}; }
  return onSnapshot(ref('meals', weekKey), snap => {
    if (!snap.exists()) { cb(loadMeals(weekKey)); return; }
    const meals = snap.data().meals || [];
    const all   = lsGet(LS_MEALS) || {};
    all[weekKey] = meals;
    lsSet(LS_MEALS, all);
    cb(meals);
  });
}
export function newMeal(fields = {}) {
  return { id: uid(), day: 'Monday', type: 'Dinner', name: '', recipe: '', notes: '', ...fields, createdAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════
// 4. MEDICATIONS
// ═══════════════════════════════════════════════════════════════════════
const _meds = makeService('family-meds', 'meds', (a,b) => (a.name||'').localeCompare(b.name||''));
export const loadMeds       = _meds.load;
export const saveMed        = _meds.save;
export const deleteMed      = _meds.remove;
export const subscribeMeds  = _meds.subscribe;
export const MED_FREQ = ['Once daily','Twice daily','Three times daily','As needed','Weekly','Monthly'];
export function newMed(fields = {}) {
  return { id: uid(), name: '', memberId: '', dosage: '', frequency: 'Once daily', startDate: today(), refillDate: '', notes: '', active: true, ...fields, createdAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════
// 5. VEHICLES
// ═══════════════════════════════════════════════════════════════════════
const _veh = makeService('family-vehicles', 'vehicles', (a,b) => (a.year||0) - (b.year||0));
export const loadVehicles     = _veh.load;
export const saveVehicle      = _veh.save;
export const deleteVehicle    = _veh.remove;
export const subscribeVehicles = _veh.subscribe;
export const VEH_TYPES = ['Car','Truck','SUV','Minivan','Motorcycle','Boat','Other'];
export function newVehicle(fields = {}) {
  return { id: uid(), make: '', model: '', year: new Date().getFullYear(), type: 'Car', plate: '', color: '', mileage: '', notes: '', logs: [], ...fields, createdAt: new Date().toISOString() };
}
export function newVehicleLog(fields = {}) {
  return { id: uid(), type: 'Oil Change', date: today(), mileage: '', cost: '', notes: '' };
}
export const VEHICLE_LOG_TYPES = ['Oil Change','Tire Rotation','Brake Service','Registration','Inspection','Repair','Fuel Up','Other'];

// ═══════════════════════════════════════════════════════════════════════
// 6. INVENTORY / WARRANTIES
// ═══════════════════════════════════════════════════════════════════════
const _inv = makeService('family-inventory', 'inventory', (a,b) => (a.location||'').localeCompare(b.location||'') || (a.name||'').localeCompare(b.name||''));
export const loadInventory      = _inv.load;
export const saveInventoryItem  = _inv.save;
export const deleteInventoryItem = _inv.remove;
export const subscribeInventory  = _inv.subscribe;
export const INV_LOCATIONS = ['Kitchen','Living Room','Bedroom','Garage','Office','Basement','Attic','Other'];
export function newInventoryItem(fields = {}) {
  return { id: uid(), name: '', location: 'Other', serial: '', purchaseDate: '', warrantyExpiry: '', cost: '', notes: '', ...fields, createdAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════
// 7. CHORE CHART
// ═══════════════════════════════════════════════════════════════════════
const _chores = makeService('family-chores', 'chores', (a,b) => (a.name||'').localeCompare(b.name||''));
export const loadChores      = _chores.load;
export const saveChore       = _chores.save;
export const deleteChore     = _chores.remove;
export const subscribeChores = _chores.subscribe;
export const CHORE_FREQ = ['Daily','Every other day','Twice weekly','Weekly','Bi-weekly','Monthly'];
export function newChore(fields = {}) {
  return { id: uid(), name: '', emoji: '🧹', assignedTo: '', frequency: 'Weekly', lastDone: '', notes: '', ...fields, createdAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════
// 8. PETS
// ═══════════════════════════════════════════════════════════════════════
const _pets = makeService('family-pets', 'pets', (a,b) => (a.name||'').localeCompare(b.name||''));
export const loadPets      = _pets.load;
export const savePet       = _pets.save;
export const deletePet     = _pets.remove;
export const subscribePets = _pets.subscribe;
export const PET_SPECIES = ['Dog','Cat','Bird','Fish','Rabbit','Hamster','Guinea Pig','Reptile','Other'];
export function newPet(fields = {}) {
  return { id: uid(), name: '', species: 'Dog', breed: '', birthday: '', color: '', microchip: '', vet: '', vetPhone: '', notes: '', events: [], ...fields, createdAt: new Date().toISOString() };
}
export function newPetEvent(fields = {}) {
  return { id: uid(), type: 'Vet Visit', date: today(), notes: '' };
}
export const PET_EVENT_TYPES = ['Vet Visit','Vaccination','Grooming','Medication','Dental','Boarding','Other'];

// ═══════════════════════════════════════════════════════════════════════
// 9. BULLETIN BOARD
// ═══════════════════════════════════════════════════════════════════════
const _bull = makeService('family-bulletin', 'bulletin', (a,b) => {
  if (a.pinned && !b.pinned) return -1;
  if (!a.pinned && b.pinned) return  1;
  return (b.createdAt||'').localeCompare(a.createdAt||'');
});
export const loadBulletin      = _bull.load;
export const saveBulletinPost  = _bull.save;
export const deleteBulletinPost = _bull.remove;
export const subscribeBulletin  = _bull.subscribe;
export const BULLETIN_COLORS = ['#fef08a','#bbf7d0','#bfdbfe','#fecaca','#e9d5ff','#fed7aa'];
export function newBulletinPost(fields = {}) {
  return { id: uid(), title: '', body: '', authorId: '', pinned: false, color: '#fef08a', ...fields, createdAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════
// 10. FAMILY GOALS
// ═══════════════════════════════════════════════════════════════════════
const _goals = makeService('family-goals', 'goals', (a,b) => (a.dueDate||'').localeCompare(b.dueDate||''));
export const loadGoals      = _goals.load;
export const saveGoal       = _goals.save;
export const deleteGoal     = _goals.remove;
export const subscribeGoals = _goals.subscribe;
export const GOAL_UNITS = ['$','miles','lbs','hours','books','days','%','items','other'];
export function newGoal(fields = {}) {
  return { id: uid(), title: '', emoji: '🎯', target: '', current: '0', unit: '$', dueDate: '', notes: '', ...fields, createdAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════
// 11. READING LOG
// ═══════════════════════════════════════════════════════════════════════
const _read = makeService('family-reading', 'reading', (a,b) => (b.finishDate||b.startDate||'').localeCompare(a.finishDate||a.startDate||''));
export const loadReading      = _read.load;
export const saveBook         = _read.save;
export const deleteBook       = _read.remove;
export const subscribeReading = _read.subscribe;
export const BOOK_GENRES = ['Fiction','Non-Fiction','Fantasy','Mystery','Sci-Fi','Biography','History','Self-Help','Children','Other'];
export function newBook(fields = {}) {
  return { id: uid(), title: '', author: '', genre: 'Fiction', memberId: '', pages: '', startDate: today(), finishDate: '', rating: 0, notes: '', ...fields, createdAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════
// 12. ACHIEVEMENTS
// ═══════════════════════════════════════════════════════════════════════
const _ach = makeService('family-achievements', 'achievements', (a,b) => (b.date||'').localeCompare(a.date||''));
export const loadAchievements      = _ach.load;
export const saveAchievement       = _ach.save;
export const deleteAchievement     = _ach.remove;
export const subscribeAchievements = _ach.subscribe;
export const ACH_CATEGORIES = ['Academic','Sports','Arts','Work','Personal','Family','Other'];
export function newAchievement(fields = {}) {
  return { id: uid(), memberId: '', title: '', emoji: '🏆', category: 'Academic', date: today(), notes: '', ...fields, createdAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════
// 13. PACKING CHECKLIST
// ═══════════════════════════════════════════════════════════════════════
const _pack = makeService('family-packing', 'packing', (a,b) => (b.date||'').localeCompare(a.date||''));
export const loadPackingLists      = _pack.load;
export const savePackingList       = _pack.save;
export const deletePackingList     = _pack.remove;
export const subscribePackingLists = _pack.subscribe;
export const PACK_CATEGORIES = ['Clothing','Toiletries','Electronics','Documents','Medications','Kids','Entertainment','Food','Other'];
export function newPackingList(fields = {}) {
  return { id: uid(), tripName: '', date: today(), destination: '', items: [], ...fields, createdAt: new Date().toISOString() };
}
export function newPackingItem(fields = {}) {
  return { id: uid(), name: '', category: 'Other', done: false, qty: '1' };
}

// ═══════════════════════════════════════════════════════════════════════
// 14. HOME MAINTENANCE
// ═══════════════════════════════════════════════════════════════════════
const _maint = makeService('family-maintenance', 'maintenance', (a,b) => (a.nextDue||'').localeCompare(b.nextDue||''));
export const loadMaintenance      = _maint.load;
export const saveMaintenanceTask  = _maint.save;
export const deleteMaintenanceTask = _maint.remove;
export const subscribeMaintenance  = _maint.subscribe;
export const MAINT_AREAS = ['HVAC','Plumbing','Electrical','Exterior','Interior','Appliances','Lawn','Vehicles','Other'];
export const MAINT_FREQ  = ['Monthly','Quarterly','Bi-annual','Annual','One-time'];
export function newMaintenanceTask(fields = {}) {
  return { id: uid(), task: '', area: 'Other', frequency: 'Annual', lastDone: '', nextDue: '', cost: '', notes: '', done: false, ...fields, createdAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════
// 15. DOCUMENTS VAULT
// ═══════════════════════════════════════════════════════════════════════
const _docs = makeService('family-documents', 'documents', (a,b) => (a.expiryDate||'zzzz').localeCompare(b.expiryDate||'zzzz'));
export const loadDocuments      = _docs.load;
export const saveDocument       = _docs.save;
export const deleteDocument     = _docs.remove;
export const subscribeDocuments = _docs.subscribe;
export const DOC_TYPES = ['Passport','Driver\'s License','Insurance','Birth Certificate','Social Security','Tax Return','Warranty','Deed/Lease','Vehicle Title','Medical Record','Other'];
export function newDocument(fields = {}) {
  return { id: uid(), name: '', type: 'Other', number: '', memberId: '', issueDate: '', expiryDate: '', issuedBy: '', notes: '', ...fields, createdAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════
// 16. PACKAGE TRACKER
// ═══════════════════════════════════════════════════════════════════════
const _pkg = makeService('family-packages', 'packages', (a,b) => (b.orderedDate||'').localeCompare(a.orderedDate||''));
export const loadPackages      = _pkg.load;
export const savePackage       = _pkg.save;
export const deletePackage     = _pkg.remove;
export const subscribePackages = _pkg.subscribe;
export const PKG_CARRIERS  = ['UPS','FedEx','USPS','Amazon','DHL','OnTrac','Other'];
export const PKG_STATUSES  = ['Ordered','Shipped','In Transit','Out for Delivery','Delivered','Returned'];
export function newPackage(fields = {}) {
  return { id: uid(), description: '', carrier: 'Other', trackingNumber: '', orderedDate: today(), expectedDate: '', status: 'Ordered', notes: '', memberId: '', ...fields, createdAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════
// 17. WATCH LIST
// ═══════════════════════════════════════════════════════════════════════
const _watch = makeService('family-watchlist', 'watchlist', (a,b) => {
  if (!a.watched && b.watched) return -1;
  if (a.watched && !b.watched) return  1;
  return (a.title||'').localeCompare(b.title||'');
});
export const loadWatchlist      = _watch.load;
export const saveWatchItem      = _watch.save;
export const deleteWatchItem    = _watch.remove;
export const subscribeWatchlist = _watch.subscribe;
export const WATCH_TYPES  = ['Movie','TV Show','Documentary','Mini-Series','Short','Other'];
export const WATCH_GENRES = ['Action','Comedy','Drama','Horror','Sci-Fi','Romance','Thriller','Animation','Other'];
export function newWatchItem(fields = {}) {
  return { id: uid(), title: '', type: 'Movie', genre: 'Other', suggestedBy: '', watched: false, rating: 0, notes: '', ...fields, createdAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════
// 18. TRIP PLANNER
// ═══════════════════════════════════════════════════════════════════════
const _trips = makeService('family-trips', 'trips', (a,b) => (b.startDate||'').localeCompare(a.startDate||''));
export const loadTrips      = _trips.load;
export const saveTrip       = _trips.save;
export const deleteTrip     = _trips.remove;
export const subscribeTrips = _trips.subscribe;
export const TRIP_STATUS = ['Planning','Booked','In Progress','Completed','Cancelled'];
export function newTrip(fields = {}) {
  return { id: uid(), destination: '', startDate: '', endDate: '', status: 'Planning', memberIds: [], budget: '', notes: '', packing: [], itinerary: [], ...fields, createdAt: new Date().toISOString() };
}
export function newTripPackItem()  { return { id: uid(), name: '', done: false }; }
export function newItineraryDay()  { return { id: uid(), day: '', activity: '', notes: '' }; }

// ═══════════════════════════════════════════════════════════════════════
// 19. LIBRARY TRACKER
// ═══════════════════════════════════════════════════════════════════════
const _lib = makeService('family-library', 'library', (a,b) => (a.dueDate||a.createdAt||'').localeCompare(b.dueDate||b.createdAt||''));
export const loadLibrary       = _lib.load;
export const saveLibraryItem   = _lib.save;
export const deleteLibraryItem = _lib.remove;
export const subscribeLibrary  = _lib.subscribe;
export const LIBRARY_STATUSES  = ['Borrowed', 'On Hold', 'Ready for Pickup', 'Returned', 'Wishlist'];
export const LIBRARY_TYPES     = ['Book', 'eBook', 'Audiobook', 'Magazine', 'DVD', 'Other'];
export function newLibraryItem(fields = {}) {
  const { id, createdAt, ...rest } = fields;
  return {
    id: id || uid(), title: '', author: '', type: 'Book', memberId: '',
    status: 'Wishlist', libraryName: '', checkoutDate: today(),
    dueDate: '', holdPosition: '', notifyDate: '', renewals: 0,
    returnedDate: '', notes: '',
    ...rest, createdAt: createdAt || new Date().toISOString(),
  };
}

// Library Accounts (card number / PIN / login per member)
const _libAcct = makeService('family-library-accounts', 'libraryAccounts', (a,b) => (a.libraryName||'').localeCompare(b.libraryName||''));
export const loadLibraryAccounts        = _libAcct.load;
export const saveLibraryAccount         = _libAcct.save;
export const deleteLibraryAccount       = _libAcct.remove;
export const subscribeLibraryAccounts   = _libAcct.subscribe;
export function newLibraryAccount(fields = {}) {
  const { id, createdAt, ...rest } = fields;
  return {
    id: id || uid(), memberId: '', libraryName: '', cardNumber: '',
    pin: '', username: '', password: '', website: '', notes: '',
    ...rest, createdAt: createdAt || new Date().toISOString(),
  };
}
