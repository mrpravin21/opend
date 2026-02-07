import React from "react";

/**
 * Wrapper that adds the same 3D gradient background (blobs + particles) used on the landing page.
 * Use for Minter, TokenWallet, Quiz, Discover and other interior pages.
 */
function PageWithGradient({ children }) {
  return (
    <div className="page-with-gradient">
      {/* Background blobs - same as landing page */}
      <div className="landing-blob landing-blob-1" aria-hidden="true" />
      <div className="landing-blob landing-blob-2" aria-hidden="true" />
      {/* Floating particles */}
      <div className="landing-particles" aria-hidden="true">
        <span className="landing-particle landing-particle-1" />
        <span className="landing-particle landing-particle-2" />
        <span className="landing-particle landing-particle-3" />
        <span className="landing-particle landing-particle-4" />
        <span className="landing-particle landing-particle-5" />
        <span className="landing-particle landing-particle-6" />
      </div>
      <div className="page-with-gradient-content">{children}</div>
    </div>
  );
}

export default PageWithGradient;
