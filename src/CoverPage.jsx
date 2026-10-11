import { useState } from "react";
import { ShieldCheck, Lightbulb, Store, Siren, ArrowRight, User } from "lucide-react";
import "./CoverPage.css";

const FEATURES = [
  { icon: Lightbulb, title: "Well-lit routes", text: "Prefers streets with working streetlights" },
  { icon: Store, title: "Active corridors", text: "Passes open shops and busy areas" },
  { icon: Siren, title: "Safe refuges", text: "Police stations and hospitals nearby" },
];

export default function CoverPage({ onEnter }) {
  const [name, setName] = useState("");
  const [leaving, setLeaving] = useState(false);

  const enter = (displayName) => {
    if (leaving) return;
    setLeaving(true);
    // Let the fade-out finish before the map mounts
    setTimeout(() => onEnter(displayName), 450);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    enter(name.trim() || "Traveller");
  };

  return (
    <div className={`cover ${leaving ? "cover--leaving" : ""}`}>
      {/* Decorative background: grid, glowing route and waypoints */}
      <div className="cover__grid" aria-hidden="true" />
      <svg className="cover__route" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="routeGlow" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <path d="M -40 640 C 180 600, 220 420, 420 430 S 640 600, 820 470 S 1000 180, 1240 200" className="cover__route-shadow" />
        <path d="M -40 640 C 180 600, 220 420, 420 430 S 640 600, 820 470 S 1000 180, 1240 200" className="cover__route-line" stroke="url(#routeGlow)" />
        <circle cx="420" cy="430" r="6" className="cover__dot" />
        <circle cx="820" cy="470" r="6" className="cover__dot cover__dot--delay" />
        <circle cx="1080" cy="215" r="6" className="cover__dot cover__dot--delay2" />
      </svg>

      <main className="cover__content">
        <section className="cover__hero">
          <div className="cover__brand">
            <span className="cover__logo"><ShieldCheck size={26} strokeWidth={2.2} /></span>
            <span className="cover__brand-name">ShadowPath</span>
          </div>

          <h1 className="cover__title">
            Walk the <span className="cover__accent">safer</span> way home,
            even after dark.
          </h1>
          <p className="cover__subtitle">
            Safety-aware navigation for night-shift workers, students and pedestrians.
            Routes are ranked by lighting, nearby activity and access to help, not just distance.
          </p>

          <ul className="cover__features">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="cover__feature">
                <span className="cover__feature-icon"><Icon size={18} /></span>
                <div>
                  <div className="cover__feature-title">{title}</div>
                  <div className="cover__feature-text">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="cover__card">
          <h2 className="cover__card-title">Welcome</h2>
          <p className="cover__card-sub">Enter your name to start live navigation.</p>

          <form onSubmit={handleSubmit} className="cover__form">
            <label htmlFor="cover-name" className="cover__label">Your name</label>
            <div className="cover__input-wrap">
              <User size={17} className="cover__input-icon" />
              <input
                id="cover-name"
                className="cover__input"
                type="text"
                placeholder="e.g. Sahasra"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="given-name"
                autoFocus
              />
            </div>

            <button type="submit" className="cover__btn">
              Start Navigating <ArrowRight size={18} />
            </button>
          </form>

          <div className="cover__divider"><span>or</span></div>

          <button type="button" className="cover__btn cover__btn--ghost" onClick={() => enter("Guest")}>
            Continue as guest
          </button>

          <p className="cover__note">
            Location access is requested on the next screen to show your live position.
          </p>
        </section>
      </main>

      <footer className="cover__footer">ShadowPath · Safety-aware route recommendation</footer>
    </div>
  );
}
