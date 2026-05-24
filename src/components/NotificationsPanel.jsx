import { useState, useEffect } from 'react';
import './NotificationsPanel.css';

export default function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    // seed with some example notifications; real app should subscribe to a service
    setItems([
      { id: '1', title: 'Library hold ready', body: 'Your hold for "The Midnight Library" is ready for pickup.', time: '2h', read: false },
      { id: '2', title: 'Garden reminder', body: 'Water the tomatoes today.', time: '1d', read: false },
      { id: '3', title: 'Package delivered', body: 'Amazon package delivered to porch.', time: '3d', read: true }
    ]);
  }, []);

  const unread = items.filter(i => !i.read).length;

  function markRead(id) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, read: true } : i));
  }

  function clearAll() {
    setItems([]);
  }

  return (
    <div className={"notifications-wrapper" + (open? ' open':'')}>
      <button className="notif-toggle" onClick={()=>setOpen(o=>!o)} aria-label="Toggle notifications">
        <span className="notif-bell">🔔</span>
        {unread>0 && <span className="notif-badge">{unread}</span>}
      </button>

      <aside className="notifications-panel" aria-hidden={!open}>
        <div className="notifications-header">
          <h3>Notifications</h3>
          <div className="notifications-actions">
            <button className="sp-btn sp-btn-ghost" onClick={clearAll}>Clear</button>
          </div>
        </div>

        <div className="notifications-list">
          {items.length === 0 && <div className="notifications-empty">No notifications</div>}
          {items.map(it => (
            <div key={it.id} className={"notification-item" + (it.read? ' read':'')}>
              <div className="notification-main">
                <div className="notification-title">{it.title}</div>
                <div className="notification-body">{it.body}</div>
              </div>
              <div className="notification-meta">
                <div className="notification-time">{it.time}</div>
                {!it.read && <button className="sp-btn sp-btn-sm" onClick={()=>markRead(it.id)}>Mark read</button>}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
