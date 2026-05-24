import { useState } from 'react';
import './Contact.css';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email.';
    if (!form.message.trim()) e.message = 'Message is required.';
    return e;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="contact-page">
        <div className="success-card">
          <div className="success-icon">🌱</div>
          <h2>Message Sent!</h2>
          <p>Thanks for reaching out, <strong>{form.name}</strong>! We'll get back to you at {form.email} soon.</p>
          <button className="btn-primary" onClick={() => { setForm({ name: '', email: '', subject: '', message: '' }); setSubmitted(false); }}>
            Send Another Message
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="contact-page">
      <div className="page-hero" style={{ background: 'linear-gradient(135deg, #1b4332, #52b788)' }}>
        <h1>📬 Get in Touch</h1>
        <p>Questions, suggestions, or just want to share your garden photos? We'd love to hear from you.</p>
      </div>

      <div className="contact-container">
        <div className="contact-info">
          <h2>Let's Connect</h2>
          <p>Whether you're a seasoned gardener or just starting out, our community is here to help.</p>
          <div className="info-items">
            <div className="info-item">
              <span>📧</span>
              <div><strong>Email</strong><p>hello@myfamily.com</p></div>
            </div>
            <div className="info-item">
              <span>📍</span>
              <div><strong>Location</strong><p>Growing everywhere on Earth 🌍</p></div>
            </div>
            <div className="info-item">
              <span>⏰</span>
              <div><strong>Response Time</strong><p>Usually within 24 hours</p></div>
            </div>
          </div>
        </div>

        <form className="contact-form" onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Name *</label>
              <input
                id="name" type="text" placeholder="Your name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className={errors.name ? 'error' : ''}
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                id="email" type="email" placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="subject">Subject</label>
            <input
              id="subject" type="text" placeholder="What's this about?"
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="message">Message *</label>
            <textarea
              id="message" rows={6} placeholder="Share your question or thought..."
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              className={errors.message ? 'error' : ''}
            />
            {errors.message && <span className="field-error">{errors.message}</span>}
          </div>
          <button type="submit" className="btn-primary submit-btn">Send Message 🌿</button>
        </form>
      </div>
    </main>
  );
}
