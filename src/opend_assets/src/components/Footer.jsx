import React from "react";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

function Footer() {
  const year = new Date().getFullYear();

  return (
    <div id="footer">
      <footer>
        <Container fluid="md">
          <Row className="align-items-center justify-content-between g-4">
            <Col md={7}>
              <p className="footer-tagline mb-0" style={{ color: "var(--gray-text)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                The Internet Computer&apos;s digital marketplace for crypto collectibles and NFTs.
                Buy, sell, and discover exclusive digital items with originality verification.
              </p>
            </Col>
            <Col md="auto">
              <p className="mb-0" style={{ color: "var(--gray-text)", fontSize: "0.85rem" }}>
                © {year} MintVault
              </p>
            </Col>
          </Row>
        </Container>
      </footer>
    </div>
  );
}

export default Footer;
