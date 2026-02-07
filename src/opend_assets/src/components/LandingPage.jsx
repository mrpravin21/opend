import React, { useEffect, useRef, useContext } from "react";
import { Link, useHistory } from "react-router-dom";
import { gsap } from "gsap";
import { AuthContext } from "../index";

function LandingPage() {
  const history = useHistory();
  const heroRef = useRef(null);
  const headlineRef = useRef(null);
  const taglineRef = useRef(null);
  const subheadRef = useRef(null);
  const ctaRef = useRef(null);
  const blob1Ref = useRef(null);
  const blob2Ref = useRef(null);
  const featuresRef = useRef(null);
  const featureCardsRef = useRef([]);
  const { login } = useContext(AuthContext);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Initial states
      gsap.set([blob1Ref.current, blob2Ref.current], { scale: 0.8, opacity: 0 });
      gsap.set(headlineRef.current, { y: 80, opacity: 0 });
      gsap.set(taglineRef.current, { filter: "blur(10px)", opacity: 0 });
      gsap.set(subheadRef.current, { y: 30, opacity: 0 });
      gsap.set(".landing-cta", { scale: 0.95, opacity: 0 });
      gsap.set(".landing-particle", { y: 20, opacity: 0 });

      const tl = gsap.timeline({ delay: 0.2 });

      // Blobs
      tl.to([blob1Ref.current, blob2Ref.current], {
        scale: 1,
        opacity: 1,
        duration: 1.2,
        ease: "power2.out",
        stagger: 0.15,
      });

      // Headline
      tl.to(headlineRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.9,
        ease: "power2.out",
      }, "-=0.8");

      // Tagline
      tl.to(taglineRef.current, {
        filter: "blur(0px)",
        opacity: 1,
        duration: 0.7,
        ease: "power2.out",
      }, "-=0.5");

      // Subhead
      tl.to(subheadRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.6,
        ease: "power2.out",
      }, "-=0.4");

      // CTAs
      tl.to(".landing-cta", {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: "back.out(1.4)",
        stagger: 0.1,
      }, "-=0.3");

      // Particles
      tl.to(".landing-particle", {
        y: 0,
        opacity: 1,
        duration: 0.5,
        stagger: 0.05,
      }, "-=0.2");

      // Floating animation for blobs
      gsap.to(blob1Ref.current, {
        y: -25,
        rotation: 3,
        duration: 7,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
      gsap.to(blob2Ref.current, {
        y: 20,
        rotation: -2,
        duration: 6,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        delay: -2,
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  // Scroll-triggered feature card animations
  useEffect(() => {
    const cards = featureCardsRef.current.filter(Boolean);
    if (cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            gsap.to(entry.target, {
              y: 0,
              opacity: 1,
              duration: 0.8,
              ease: "power2.out",
            });
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
    );

    cards.forEach((card, i) => {
      gsap.set(card, { y: 60, opacity: 0 });
      observer.observe(card);
    });

    return () => cards.forEach((c) => observer.unobserve(c));
  }, []);

  const handleExplore = () => history.push("/discover");
  const handleLogin = () => login();

  const features = [
    {
      icon: "◆",
      title: "Mint NFTs",
      desc: "Create unique digital collectibles directly on the Internet Computer. Full ownership, no intermediaries.",
    },
    {
      icon: "✓",
      title: "Originality Verified",
      desc: "AI-powered 3-layer verification blocks duplicates and derivatives before minting. SHA-256, pHash & CLIP embeddings.",
    },
    {
      icon: "⇄",
      title: "Trade Securely",
      desc: "Buy and sell NFTs with DANG tokens. Decentralized marketplace with transparent ownership.",
    },
  ];

  return (
    <div className="landing-page" ref={heroRef}>
      {/* Background blobs */}
      <div
        ref={blob1Ref}
        className="landing-blob landing-blob-1"
        aria-hidden="true"
      />
      <div
        ref={blob2Ref}
        className="landing-blob landing-blob-2"
        aria-hidden="true"
      />

      {/* Floating particles */}
      <div className="landing-particles" aria-hidden="true">
        <span className="landing-particle landing-particle-1" />
        <span className="landing-particle landing-particle-2" />
        <span className="landing-particle landing-particle-3" />
        <span className="landing-particle landing-particle-4" />
        <span className="landing-particle landing-particle-5" />
        <span className="landing-particle landing-particle-6" />
      </div>

      {/* Hero content */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <p className="landing-label">Decentralized NFT Marketplace</p>
          <h1 ref={headlineRef} className="landing-headline">
            MintVault
          </h1>
          <p ref={taglineRef} className="landing-tagline">
            Verified Original NFTs on the Internet Computer
          </p>
          <p ref={subheadRef} className="landing-subhead">
            Mint, buy, and sell digital collectibles with AI-powered originality
            checks. Derivatives and duplicates are blocked before minting—only
            true originals make it through.
          </p>
          <div ref={ctaRef} className="landing-ctas">
            <button
              className="landing-cta landing-cta-primary"
              onClick={handleExplore}
            >
              Explore NFTs
              <span className="landing-cta-arrow">→</span>
            </button>
            <button
              className="landing-cta landing-cta-secondary"
              onClick={handleLogin}
            >
              Login to Mint
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section ref={featuresRef} className="landing-features">
        <div className="landing-features-inner">
          <p className="landing-features-label">Why MintVault</p>
          <h2 className="landing-features-headline">
            Trusted Originality <span className="landing-features-accent">Every Time</span>
          </h2>
          <div className="landing-features-grid">
            {features.map((f, i) => (
              <div
                key={i}
                ref={(el) => (featureCardsRef.current[i] = el)}
                className="landing-feature-card"
              >
                <div className="landing-feature-icon">{f.icon}</div>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="landing-cta-section">
        <div className="landing-cta-section-inner">
          <h2 className="landing-cta-headline">Ready to mint?</h2>
          <p className="landing-cta-sub">Connect with Internet Identity to get started.</p>
          <Link to="/minter" className="landing-cta-link">
            Go to Minter →
          </Link>
        </div>
      </section>

      <div className="landing-fade" />
    </div>
  );
}

export default LandingPage;
