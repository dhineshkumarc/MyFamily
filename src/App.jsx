import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import NotificationsPanel from './components/NotificationsPanel';
import Footer from './components/Footer';
import Home from './pages/Home';
import Plants from './pages/Plants';
import Blog from './pages/Blog';
import Calendar from './pages/Calendar';
import Harvest from './pages/Harvest';
import GardenMap from './pages/GardenMap';
import Contact from './pages/Contact';
import About from './pages/About';
import Display from './pages/Display';
import Family from './pages/Family';
import Appointments from './pages/Appointments';
import Schedule from './pages/Schedule';
import Todo from './pages/Todo';
import School from './pages/School';
import Gallery from './pages/Gallery';
import Thermostat from './pages/Thermostat';
import Shopping from './pages/Shopping';
import Budget from './pages/Budget';
import Meals from './pages/Meals';
import Medications from './pages/Medications';
import Vehicles from './pages/Vehicles';
import Inventory from './pages/Inventory';
import Chores from './pages/Chores';
import Pets from './pages/Pets';
import Bulletin from './pages/Bulletin';
import Goals from './pages/Goals';
import Reading from './pages/Reading';
import Library from './pages/Library';
import Achievements from './pages/Achievements';
import Packing from './pages/Packing';
import Maintenance from './pages/Maintenance';
import Documents from './pages/Documents';
import Packages from './pages/Packages';
import Watchlist from './pages/Watchlist';
import GardenHub from './pages/GardenHub';
import Trips from './pages/Trips';
import Mail from './pages/Mail';
import BankConnect from './pages/BankConnect';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Fullscreen kiosk — no Navbar or Footer */}
        <Route path="/display" element={<Display />} />

        {/* All other pages with Navbar + Footer */}
        <Route path="/*" element={
          <div className="app-wrapper">
            <Navbar />
            <div className="page-content">
              <Routes>
                <Route path="/" element={<Home />} />
                {/* Family */}
                <Route path="/family" element={<Family />} />
                <Route path="/appointments" element={<Appointments />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/todo" element={<Todo />} />
                <Route path="/school" element={<School />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/thermostat" element={<Thermostat />} />
                <Route path="/shopping" element={<Shopping />} />
                <Route path="/budget" element={<Budget />} />
                <Route path="/meals" element={<Meals />} />
                <Route path="/medications" element={<Medications />} />
                <Route path="/vehicles" element={<Vehicles />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/chores" element={<Chores />} />
                <Route path="/pets" element={<Pets />} />
                <Route path="/bulletin" element={<Bulletin />} />
                <Route path="/goals" element={<Goals />} />
                <Route path="/reading" element={<Reading />} />
                <Route path="/library" element={<Library />} />
                <Route path="/achievements" element={<Achievements />} />
                <Route path="/packing" element={<Packing />} />
                <Route path="/maintenance" element={<Maintenance />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/packages" element={<Packages />} />
                <Route path="/watchlist" element={<Watchlist />} />
                <Route path="/trips" element={<Trips />} />
                <Route path="/garden" element={<GardenHub />} />
                {/* Garden */}
                <Route path="/plants" element={<Plants />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/harvest" element={<Harvest />} />
                <Route path="/map" element={<GardenMap />} />
                <Route path="/mail" element={<Mail />} />
                <Route path="/bank" element={<BankConnect />} />
                <Route path="/credit" element={<BankConnect />} />
                {/* General */}
                <Route path="/contact" element={<Contact />} />
                <Route path="/about" element={<About />} />
              </Routes>
            </div>
            <NotificationsPanel />
            <Footer />
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
