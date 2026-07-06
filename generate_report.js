"use strict";
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageBreak, LevelFormat,
  TableOfContents, Bookmark
} = require("docx");
const fs = require("fs");

// ── constants ────────────────────────────────────────────────────────────────
const W = 9026; // content width DXA (A4 with 1200 margins each side)
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

// ── bookmark ID counter (must be globally unique integers) ───────────────────
let _bmId = 0;
const _bmMap = {};
function getBmId(key) {
  if (!_bmMap[key]) _bmMap[key] = ++_bmId;
  return _bmMap[key];
}

// ── helpers ──────────────────────────────────────────────────────────────────
function h1(text, bookmarkKey) {
  const children = bookmarkKey
    ? [new Bookmark({ id: getBmId(bookmarkKey), children: [new TextRun(text)] })]
    : [new TextRun(text)];
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children });
}
function h2(text, bookmarkKey) {
  const children = bookmarkKey
    ? [new Bookmark({ id: getBmId(bookmarkKey), children: [new TextRun(text)] })]
    : [new TextRun(text)];
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
}
function para(text, opts = {}) {
  return new Paragraph({
    style: "Normal",
    alignment: opts.center ? AlignmentType.CENTER : undefined,
    children: [new TextRun({ text, bold: opts.bold, size: opts.size })],
  });
}
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}
function bullet(text) {
  return new Paragraph({
    numbering: { reference: "main-bullets", level: 0 },
    children: [new TextRun(text)],
  });
}
function numbered(text) {
  return new Paragraph({
    numbering: { reference: "main-numbers", level: 0 },
    children: [new TextRun(text)],
  });
}
function spacer() {
  return new Paragraph({ style: "Normal", children: [new TextRun("")] });
}

// ── table helpers ─────────────────────────────────────────────────────────────
function cell(text, opts = {}) {
  const fill = opts.fill || "FFFFFF";
  const bold = opts.bold || false;
  const textColor = opts.textColor; // only set for white-on-dark header cells
  return new TableCell({
    width: { size: opts.width || 1000, type: WidthType.DXA },
    borders,
    margins: cellMargins,
    shading: { fill, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : undefined,
      children: [new TextRun({ text: String(text), bold, color: textColor, size: 20 })],
    })],
  });
}

function headerRow(cols, widths) {
  return new TableRow({
    tableHeader: true,
    children: cols.map((c, i) => cell(c, { fill: "1F4E79", textColor: "FFFFFF", bold: true, width: widths[i] })),
  });
}

function dataRow(cols, widths, rowIndex) {
  const fill = rowIndex % 2 === 0 ? "EBF3FB" : "FFFFFF";
  return new TableRow({
    children: cols.map((c, i) => cell(c, { fill, width: widths[i] })),
  });
}

function simpleTable(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      headerRow(headers, widths),
      ...rows.map((r, i) => dataRow(r, widths, i)),
    ],
  });
}

// ── feature matrix cell (color-coded) ────────────────────────────────────────
function matrixCell(text, width, isHeader, rowIndex) {
  let fill = rowIndex % 2 === 0 ? "EBF3FB" : "FFFFFF";

  if (!isHeader) {
    if (text === "✓") fill = "C6EFCE";
    else if (text === "Partial") fill = "FFEB9C";
    else if (text === "✗") fill = "FFC7CE";
    else if (text === "Unverified") fill = "D9D9D9";
  }

  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    margins: cellMargins,
    shading: { fill, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: isHeader ? undefined : AlignmentType.CENTER,
      children: [new TextRun({
        text: String(text),
        bold: isHeader,
        color: isHeader ? "FFFFFF" : undefined,
        size: 18,
      })],
    })],
  });
}

// ── gap analysis table row ────────────────────────────────────────────────────
function gapRow(cells, widths, rowIndex) {
  const fill = rowIndex % 2 === 0 ? "EBF3FB" : "FFFFFF";
  return new TableRow({
    children: cells.map((c, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      borders,
      margins: cellMargins,
      shading: { fill, type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.TOP,
      children: [new Paragraph({
        children: [new TextRun({ text: String(c), size: 18 })],
      })],
    })),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// COVER PAGE paragraphs
// ══════════════════════════════════════════════════════════════════════════════
function makeCoverPage() {
  const titleBanner = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    rows: [
      new TableRow({
        children: [new TableCell({
          width: { size: W, type: WidthType.DXA },
          borders: { top: border, bottom: border, left: border, right: border },
          margins: { top: 300, bottom: 300, left: 200, right: 200 },
          shading: { fill: "1F4E79", type: ShadingType.CLEAR },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "COMPETITIVE MARKET ANALYSIS REPORT", bold: true, color: "FFFFFF", size: 44 })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Farm2Market", bold: true, color: "FFFFFF", size: 52 })] }),
          ],
        })],
      }),
    ],
  });

  return [
    spacer(), spacer(), spacer(),
    titleBanner,
    spacer(),
    para("Feature Benchmarking Across 3 Websites and 3 Mobile Apps", { center: true, color: "2E75B6", size: 26 }),
    para("for Scopus Conference Preparation", { center: true, color: "2E75B6", size: 26 }),
    spacer(), spacer(),
    para("Prepared by:", { center: true, bold: true }),
    para("DIU-WISE-AI Research Group", { center: true, bold: true, color: "1F4E79", size: 28 }),
    para("Daffodil International University, Dhaka, Bangladesh", { center: true }),
    spacer(),
    para("Date: June 2026", { center: true }),
    para("Version: 1.0", { center: true }),
    spacer(), spacer(),
    para("CONFIDENTIAL - Academic Research Use Only", { center: true, color: "595959", size: 18 }),
    pageBreak(),
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 - Executive Summary
// ══════════════════════════════════════════════════════════════════════════════
function makeSection1() {
  return [
    h1("Section 1 - Executive Summary", "sec1"),
    spacer(),
    para("This competitive market analysis was conducted as part of the academic development process for Farm2Market, a Django-based agricultural e-commerce platform built by students at Daffodil International University (DIU), Bangladesh, under the DIU-WISE-AI Research Group. The primary purpose of this report is to benchmark Farm2Market against six existing platforms - three websites and three mobile applications - to identify feature gaps, validate the platform's unique research contribution, and inform the final feature roadmap before a Scopus-indexed conference submission."),
    spacer(),
    para("Farm2Market is a Django 6 MVT web application designed for the Bangladesh agricultural context. It implements a three-role marketplace architecture comprising farmers (produce sellers), buyers (consumers and bulk purchasers), and delivery organizations (logistics providers). The platform supports product listing with images and categories, a cart and checkout system, an eight-stage order lifecycle, and an in-app notification system. At present, the platform does not include a mobile application, AI/ML integration, payment gateway, or bilingual (Bangla/English) support."),
    spacer(),
    para("Top 3 Findings from this Analysis:"),
    spacer(),
    numbered("Delivery organization portal is a critical gap: Among all six platforms analyzed, those that include a dedicated logistics/delivery portal demonstrate significantly better end-to-end order fulfillment. Farm2Market currently stores only the logistic provider's name and contact - no login, dashboard, or assignment workflow exists for the delivery actor. This is the highest-priority addition."),
    numbered("AI-powered pricing and advisory is becoming a baseline expectation: Platforms such as DeHaat and iFarmer (Folon) already deploy AI-driven price prediction, crop advisory, and demand forecasting. For a Scopus submission, integrating even a single LLM-based pricing recommendation (via Groq API / LLaMA 3.3 70B) would substantially differentiate Farm2Market."),
    numbered("Bilingual support is essential for the Bangladesh context: Both iFarmer's Folon app and Krishi Bazar demonstrate that Bangla-language interfaces dramatically increase farmer adoption. Farm2Market's English-only UI is a recognized limitation against a target user base with varying literacy levels in English."),
    pageBreak(),
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 - Farm2Market Feature Inventory
// ══════════════════════════════════════════════════════════════════════════════
function makeSection2() {
  const rows = [
    ["Unified Profile Model", "A single profile model supports both farmer and buyer roles with role-based access control, enabling a shared authentication system."],
    ["Product Listing", "Farmers can list agricultural products with categories, images, pricing, and stock quantity. Buyers can browse and filter listings."],
    ["Cart & Checkout System", "Buyers can add products to a cart and proceed through a checkout flow to place orders."],
    ["8-Stage Order Lifecycle", "Orders progress through: PENDING → CONFIRMED → ASSIGNED → OUT_FOR_DELIVERY → DELIVERED → COMPLETED → REJECTED → CANCELLED."],
    ["Logistic Model (Basic)", "A Logistic model stores the delivery organization's name and contact number only. No portal login or dashboard exists for delivery actors."],
    ["In-App Notification System", "Users receive system notifications within the platform for key order events and status changes."],
    ["Django Admin Panel (Basic)", "The default Django admin panel is available for backend management. No customization or role-specific admin views have been implemented."],
    ["No AI/ML Integration", "No artificial intelligence or machine learning features are currently present in the platform."],
    ["No Payment Gateway", "Transactions are cash-on-delivery only. No SSLCommerz, bKash, or other digital payment integration exists."],
    ["No Mobile Application", "Farm2Market is a web-only platform. No Android or iOS application has been developed."],
    ["No Bilingual Support", "The platform is currently English-only. No Bangla language interface or localization has been implemented."],
  ];

  return [
    h1("Section 2 - Farm2Market: Current Feature Inventory", "sec2"),
    spacer(),
    para("The following table documents the complete known feature set of Farm2Market as of June 2026. This inventory serves as the baseline for comparison in Sections 3–5."),
    spacer(),
    simpleTable(
      ["Feature", "Description"],
      rows,
      [2800, 6226]
    ),
    pageBreak(),
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 - Website Competitor Analysis
// ══════════════════════════════════════════════════════════════════════════════
function makeSection3() {
  // 3.1 iFarmer
  const ifarmerFeatures = [
    ["Agri-Input Supply", "Digital procurement of seeds, fertilizers, and crop-protection products directly to farmers.", "Validates need for farmer-side supply features beyond just produce selling."],
    ["Agricultural Financing", "Loan and credit access facilitated through partnerships with banks and NBFIs for smallholder farmers.", "Highlights potential microfinance integration as a future Farm2Market extension."],
    ["Market Linkage", "Direct sales channel connecting farmers to institutional and retail buyers via the platform.", "Confirms Farm2Market's core buyer-farmer marketplace model is on the right track."],
    ["Farmer Advisory", "Crop-specific advisory content and expert consultation accessible through the platform.", "Suggests value of AI-powered advisory module for Farm2Market."],
    ["Produce Collection Hubs", "Offline network of physical collection points where farmers deposit produce for distribution.", "Not directly relevant to Farm2Market's web-based model."],
    ["Cashless Farmer Card", "Partnership with Visa and United Commercial Bank for digital payment card for farmers (launched 2024).", "Supports case for payment gateway integration in Farm2Market."],
    ["Weather & Climate Tools", "Real-time weather forecasts and climate risk alerts via mobile app (Folon).", "Validates addition of weather-aware smart alerts for Farm2Market."],
    ["Insurance Products", "Crop insurance options available through the platform's financial services arm.", "Unverified - requires manual confirmation before submission."],
  ];

  const krishiFeatures = [
    ["Bangla-Language UI", "Platform interface is available in Bengali language, targeting Bangladeshi farmers with low English literacy.", "Directly supports case for bilingual (English + Bangla) support in Farm2Market."],
    ["Online Shopping Mall Model", "Described as Bangladesh's only agriculture-based online shopping mall with multi-vendor capabilities.", "Validates multi-vendor marketplace model similar to Farm2Market."],
    ["Seeds & Gardening Products", "Comprehensive catalog of seeds, soil mixes, fertilizers, plant care products, and gardening tools.", "Farm2Market's product category model should include similar agricultural input categories."],
    ["Delivery Across Bangladesh", "Nationwide delivery management from a central operational hub in Rangpur.", "Highlights importance of logistics network coverage - a gap in Farm2Market."],
    ["Mobile Ordering", "Products can be ordered online from any location in Bangladesh via mobile browser.", "Confirms responsive web design or mobile app is a priority."],
    ["NM Group Integration", "Operates under NM Group umbrella (as of 2023), enabling wider product sourcing and distribution network.", "Not directly applicable but suggests value of institutional partnerships."],
  ];

  const agriUdaanFeatures = [
    ["Startup Mentorship Program", "Government of India-backed program mentoring agri-startups and connecting them with investors.", "Validates government-partnership angle for Farm2Market's academic positioning."],
    ["Market Access Facilitation", "Helps farmers access markets by connecting produce with buyers and institutional distributors.", "Confirms Farm2Market's core value proposition is aligned with regional best practices."],
    ["Cold Storage & Packhouse Integration", "Integration with cold storage and packhouse facilities for perishable crop management (via Krishi Udaan 2.0).", "Highlights post-harvest infrastructure as a longer-term feature consideration."],
    ["e-NAM Portal Integration", "Linked to the electronic National Agriculture Market (e-NAM) for real-time price discovery.", "Supports inclusion of price discovery and market rate display in Farm2Market."],
    ["Air Logistics for Remote Farmers", "Subsidized air transport program for farmers in North-East India and remote regions.", "Not applicable to Bangladesh context but relevant to logistics diversity concept."],
    ["Real-Time Price Discovery", "Farmers can view live mandi (market) rates to optimize selling timing.", "Directly supports AI-powered price recommendation feature for Farm2Market."],
  ];

  return [
    h1("Section 3 - Competitor Analysis: 3 Websites", "sec3"),
    spacer(),
    para("This section provides an in-depth analysis of three agricultural web platforms: iFarmer (Bangladesh), Krishi Bazar (Bangladesh), and AgriUdaan (India). Each platform is evaluated on features, UI/UX observations, strengths, weaknesses, and novelty factor relative to Farm2Market."),

    // 3.1
    pageBreak(),
    h2("3.1 iFarmer (ifarmer.com.bd)", "sec31"),
    spacer(),
    h3("Overview"),
    para("iFarmer is a Dhaka-based full-stack agri-fintech platform founded in 2018 by Fahad Ifaz and Jamil Akbar. It targets smallholder farmers across Bangladesh, providing an integrated ecosystem of agricultural inputs, financing, market linkage, and advisory services. As of 2025, iFarmer works with over 300,000 farmers and 24,000 agricultural retailers. The platform has received investments from Symbiotics ($1.5M, 2026), Pioneer Facility ($500K, 2025), and previously raised a $2.1M pre-Series A."),
    spacer(),
    h3("Key Features"),
    simpleTable(
      ["Feature", "Description", "Relevance to Farm2Market"],
      ifarmerFeatures,
      [1800, 3813, 3413]
    ),
    spacer(),
    h3("UI/UX Observations"),
    bullet("The website is professionally designed with a clean, investor-facing aesthetic; however, farmer-facing UI is primarily delivered through the Folon mobile app rather than the website."),
    bullet("Navigation is structured around stakeholder type (farmers, investors, retailers), which is a strong role-based design pattern applicable to Farm2Market."),
    bullet("The website lacks a Bangla-language toggle on the main site; Bangla support is present in the Folon app only."),
    bullet("Content is dense with partnership logos and funding milestones - more suitable for investor relations than daily farmer use."),
    spacer(),
    h3("Strengths"),
    bullet("First mover in Bangladesh agri-fintech with a comprehensive full-stack model combining inputs, finance, and market access."),
    bullet("Strong institutional partnerships (Visa, UCB, Symbiotics) provide credibility and scalability."),
    bullet("Dedicated farmer-facing mobile app (Folon) with Bangla UI and offline capability demonstrates user-centric design thinking."),
    spacer(),
    h3("Weaknesses / Gaps"),
    bullet("Website is investor- and partner-oriented rather than transactional for farmers or buyers; the marketplace function is primarily app-based."),
    bullet("No buyer-facing public product listing or cart system visible on the main website - focus is on B2B and input supply."),
    bullet("Platform does not support a peer-to-peer farmer-to-farmer purchasing model."),
    spacer(),
    h3("Novelty Factor"),
    para("iFarmer's academic novelty lies in its embedded finance model - integrating agricultural credit, insurance, and cashless payments into a single agri-platform in a low-income country context. This represents a fintech-in-agriculture innovation that is distinct from Farm2Market's marketplace focus."),

    // 3.2
    pageBreak(),
    h2("3.2 Krishi Bazar (krishibazar.com.bd)", "sec32"),
    spacer(),
    h3("Overview"),
    para("Krishi Bazar is a Bangladesh-based online agricultural marketplace founded in 2017 and headquartered in Rangpur. It operates as the country's only agriculture-based online shopping mall in the Bangla language, offering a wide range of products including seeds, fertilizers, gardening tools, pesticides, and plant care items. As of 2023, Krishi Bazar operates under the NM Group umbrella, enabling broader product sourcing."),
    spacer(),
    h3("Key Features"),
    simpleTable(
      ["Feature", "Description", "Relevance to Farm2Market"],
      krishiFeatures,
      [1800, 3813, 3413]
    ),
    spacer(),
    h3("UI/UX Observations"),
    bullet("The platform is Bangla-first, making it accessible to farmers and rural buyers with limited English proficiency - a significant UX advantage in the Bangladesh market."),
    bullet("Product browsing and categorization follow standard e-commerce patterns (by product type, brand, price range), which is familiar to smartphone users."),
    bullet("Mobile-responsive design allows ordering from any device without a dedicated app, lowering the barrier to entry for rural users."),
    bullet("The visual design is functional but dated compared to modern e-commerce platforms; product photography quality is inconsistent across listings."),
    spacer(),
    h3("Strengths"),
    bullet("Bangla-language interface lowers adoption barriers for the core target demographic - smallholder farmers with limited English literacy."),
    bullet("Broad product range covering both agricultural inputs (seeds, fertilizers) and tools makes it a one-stop shop for farmers."),
    bullet("Nationwide delivery managed centrally reduces the logistical burden on individual sellers."),
    spacer(),
    h3("Weaknesses / Gaps"),
    bullet("Platform focuses on agricultural input selling (to farmers) rather than produce selling (by farmers) - the opposite direction from Farm2Market."),
    bullet("No visible farmer profile, order lifecycle tracking, or multi-role authentication system."),
    bullet("No AI-based price recommendation, demand forecasting, or smart advisory features."),
    spacer(),
    h3("Novelty Factor"),
    para("Krishi Bazar's novelty is its Bangla-first e-commerce model for agricultural inputs in Bangladesh - proving that language-localized agricultural platforms can achieve significant market penetration without a dedicated mobile app. This is directly instructive for Farm2Market's bilingual UI roadmap."),

    // 3.3
    pageBreak(),
    h2("3.3 AgriUdaan (agriudaan.com)", "sec33"),
    spacer(),
    h3("Overview"),
    para("AgriUdaan is an India-based agricultural initiative and platform supporting farm-to-market connectivity, particularly for perishable and high-value crops. The platform is associated with a Government of India mentorship program (AGRIUDAAN) for agri-startups and integrates with the electronic National Agriculture Market (e-NAM) for price discovery and logistics. Note: Specific website feature details for agriudaan.com could not be fully verified through public sources - sections marked accordingly."),
    spacer(),
    h3("Key Features"),
    simpleTable(
      ["Feature", "Description", "Relevance to Farm2Market"],
      agriUdaanFeatures,
      [1800, 3813, 3413]
    ),
    spacer(),
    h3("UI/UX Observations"),
    bullet("Unverified - requires manual confirmation before submission (website access was not confirmed during research)."),
    bullet("Government-backed platforms in India typically follow GIGW (Guidelines for Indian Government Websites) accessibility standards, including multilingual support."),
    bullet("Integration with e-NAM suggests a data-driven, API-connected interface rather than a standalone marketplace."),
    bullet("The platform appears to serve as a connector/directory rather than a transactional marketplace with cart and checkout."),
    spacer(),
    h3("Strengths"),
    bullet("Government backing provides institutional credibility and ensures adoption among formally registered farming cooperatives and FPOs."),
    bullet("Integration with e-NAM enables real-time price discovery across hundreds of agricultural markets."),
    bullet("Logistics subsidy program (air freight for remote farmers) demonstrates innovative last-mile delivery thinking."),
    spacer(),
    h3("Weaknesses / Gaps"),
    bullet("Platform scope is India-specific and does not directly address Bangladesh's agricultural supply chain characteristics."),
    bullet("No evident buyer-facing e-commerce cart or individual farmer product listing system."),
    bullet("Heavy reliance on government infrastructure makes it less applicable as a standalone open-market model."),
    spacer(),
    h3("Novelty Factor"),
    para("AgriUdaan's novelty is its government-ecosystem integration model - connecting agri-startups with investors, mentors, and national market infrastructure (e-NAM). This public-private hybrid approach offers an academic reference point for Farm2Market's potential future integration with Bangladesh's Department of Agricultural Marketing (DAM)."),
    pageBreak(),
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 - Mobile App Competitor Analysis
// ══════════════════════════════════════════════════════════════════════════════
function makeSection4() {
  const folonFeatures = [
    ["Bangla-Language Interface", "Full Bangla UI with intuitive icons and offline learning modules for low-literacy farmers.", "Directly supports Farm2Market's bilingual UI roadmap."],
    ["Smart Advisory Content Library", "Farmers select crop categories to receive personalized, relevant agronomic advisory content.", "Validates AI-advisory integration concept for Farm2Market."],
    ["Direct Chat with Agri-Experts", "In-app messaging with agricultural experts, supporting image and audio sharing for precise problem diagnosis.", "Suggests value of a chat/helpdesk feature in Farm2Market."],
    ["Finance & Market Access", "Farmers can apply for agricultural funding and list produce for sale directly through the app.", "Confirms that combined finance-marketplace model has user demand."],
    ["Weather & Disease Alerts", "Climate resilience tools providing weather forecasts and crop disease early-warning notifications.", "Supports smart stock/demand alert feature for Farm2Market."],
    ["Offline Learning Modules", "Content accessible without continuous internet connectivity - critical for rural Bangladesh.", "Highlights the need for Farm2Market to consider low-bandwidth optimization."],
    ["Role-Based Access", "Separate investor and farmer apps (iFarmer investor app + Folon farmer app) demonstrate role segmentation.", "Validates Farm2Market's multi-role authentication architecture."],
  ];

  const agroShiftFeatures = [
    ["Supply Chain Management", "End-to-end supply chain covering demand aggregation, produce sourcing, packaging, and last-mile delivery.", "Validates the need for a logistics/delivery dashboard in Farm2Market."],
    ["Price & Demand Prediction", "Algorithmic price and demand forecasting to optimize procurement and reduce wastage.", "Directly supports AI price recommendation feature for Farm2Market."],
    ["Inventory Management", "Digital inventory tracking across collection hubs and distribution centres.", "Suggests a farmer stock management dashboard as a useful Farm2Market feature."],
    ["Optimized Route Planning", "AI-powered delivery route optimization for efficiency and speed.", "Validates delivery organization portal concept in Farm2Market."],
    ["Farmer SMS Notifications", "Farmers receive SMS or phone call notifications to deliver produce to nearby collection hubs.", "Supports SMS/push notification feature addition for Farm2Market."],
    ["Digital Order Platform", "Workers and buyers can place orders through a mobile app or tablet-based ordering kiosks.", "Confirms digital ordering UX is feasible for low-tech users."],
    ["12-18 Hour Delivery Cycle", "Direct farm-to-customer delivery within 12-18 hours of farm sourcing.", "Sets a benchmark for delivery performance that Farm2Market's logistics model should aspire to."],
    ["Instant Farmer Payments", "Farmers receive immediate payment upon produce delivery at collection hubs.", "Highlights payment gateway integration as a business-critical feature."],
  ];

  const deHaatFeatures = [
    ["AI-Powered Crop Advisory", "Satellite imagery, soil profiles, pest records, and weather data drive customized crop recommendations.", "Validates LLM/AI advisory integration for Farm2Market's Scopus submission."],
    ["Regional Language Support", "App available in multiple Indian regional languages with voice call advisory in local languages.", "Directly supports Bangla language UI and voice feature roadmap for Farm2Market."],
    ["Disease Detection & Alerts", "Automated pest outbreak and nutrient deficiency detection with real-time farmer alerts.", "Supports smart stock/demand alert and disease notification features."],
    ["Input Supply (Seeds, Fertilizer)", "Direct purchase of agricultural inputs through the app from verified suppliers.", "Validates agricultural input category in Farm2Market's product listing."],
    ["Financing & Insurance", "Microfinance and crop insurance products accessible directly through the app.", "Suggests longer-term financial services integration for Farm2Market."],
    ["Market Linkages", "Direct sales to institutional buyers through DeHaat's network of 11,000+ DeHaat Centres.", "Confirms B2B market linkage as a valuable feature for Farm2Market."],
    ["Farmer Analytics", "Revenue tracking, order history, and performance dashboards for registered farmers.", "Directly supports farmer analytics dashboard addition in Farm2Market."],
    ["Rating & Review System", "Unverified - requires manual confirmation before submission."],
    ["Push Notifications", "Real-time push notifications for weather alerts, price changes, and advisory updates.", "Validates in-app and push notification system in Farm2Market."],
  ];

  return [
    h1("Section 4 - Competitor Analysis: 3 Mobile Apps", "sec4"),
    spacer(),
    para("This section analyses three agricultural mobile applications: iFarmer's Folon app (Bangladesh), AgroShift (Bangladesh/South Asia), and DeHaat (India). Each is evaluated against the same framework as Section 3."),

    // 4.1
    pageBreak(),
    h2("4.1 iFarmer App - Folon (ifarmer.asia/product-folon)", "sec41"),
    spacer(),
    h3("Overview"),
    para("Folon is the farmer-facing mobile application launched by iFarmer in November 2024 in Jashore, Bangladesh. It was designed as an all-in-one farming support app to bring iFarmer's full ecosystem directly into farmers' hands. Folon is available on the Google Play Store and focuses on advisory, market access, and financial services. A separate iFarmer Investor App exists for the investment side of the platform."),
    spacer(),
    h3("Key Features"),
    simpleTable(["Feature", "Description", "Relevance to Farm2Market"], folonFeatures, [1800, 3813, 3413]),
    spacer(),
    h3("UI/UX Observations"),
    bullet("Bangla-first UI with icon-based navigation reduces dependency on text literacy - an important design decision for Bangladesh rural users."),
    bullet("Offline module availability demonstrates awareness of patchy rural internet connectivity, a key UX challenge in Bangladesh."),
    bullet("Separation of investor and farmer apps (two distinct apps) is a strong architectural pattern that validates Farm2Market's role-based design."),
    bullet("App ratings and reviews on the Play Store indicate positive user reception, though specific metrics require manual verification."),
    spacer(),
    h3("Strengths"),
    bullet("First agri-app in Bangladesh with integrated advisory, finance, and market access in a single Bangla-language interface."),
    bullet("Offline capability removes connectivity as a barrier - critical for deep-rural adoption."),
    bullet("Backed by a well-funded company with institutional credibility, ensuring long-term maintenance and feature development."),
    spacer(),
    h3("Weaknesses / Gaps"),
    bullet("No buyer-facing interface or e-commerce cart - the app is farmer-centric only, not a two-sided marketplace."),
    bullet("No delivery organization role or logistics tracking visible in available feature documentation."),
    bullet("Heavy reliance on iFarmer's own procurement network limits scalability as an open marketplace."),
    spacer(),
    h3("Novelty Factor"),
    para("Folon's novelty is the Bangla-native, offline-capable, farmer-first super-app model in Bangladesh - demonstrating that a single app can serve advisory, commerce, and finance needs for digitally underserved agricultural communities."),

    // 4.2
    pageBreak(),
    h2("4.2 AgroShift", "sec42"),
    spacer(),
    h3("Overview"),
    para("AgroShift is a supply-chain-focused agricultural platform operating in Bangladesh and the broader South Asian region. It employs a 'phy-gital' (physical + digital) business model that merges offline collection hubs with a digital ordering and logistics management system. AgroShift focuses on aggregating farmer produce, managing distribution centre operations, and enabling fast (12-18 hour) farm-to-consumer delivery."),
    spacer(),
    h3("Key Features"),
    simpleTable(["Feature", "Description", "Relevance to Farm2Market"], agroShiftFeatures, [1800, 3813, 3413]),
    spacer(),
    h3("UI/UX Observations"),
    bullet("The digital ordering interface supports both mobile app and tablet-based kiosk ordering, accommodating a range of device types and user literacy levels."),
    bullet("SMS notification system for farmers (rather than app-push) demonstrates pragmatic design for users without smartphones."),
    bullet("Route planning and inventory management features suggest a data-rich operations dashboard rather than a simple listing interface."),
    bullet("Buyer-facing UX details are limited in public documentation - requires manual confirmation before submission."),
    spacer(),
    h3("Strengths"),
    bullet("Fastest farm-to-consumer delivery benchmark in the Bangladesh market (12-18 hours), setting a high logistics performance standard."),
    bullet("AI-powered demand and price prediction is deployed in production, validating the technical feasibility of such features for the region."),
    bullet("Physical collection hub network creates a hybrid model that works even when farmers lack smartphone access."),
    spacer(),
    h3("Weaknesses / Gaps"),
    bullet("Closed supply chain model (AgroShift-owned hubs) rather than an open marketplace limits seller diversity."),
    bullet("No visible buyer-to-farmer direct communication or peer review/rating system."),
    bullet("No farmer-to-farmer purchasing model or peer marketplace functionality."),
    spacer(),
    h3("Novelty Factor"),
    para("AgroShift's novelty is its phy-gital supply chain architecture - proving that AI-powered logistics optimization and demand prediction can be deployed at scale in the Bangladesh context. Its instant farmer payment model is also academically interesting as a financial inclusion mechanism."),

    // 4.3
    pageBreak(),
    h2("4.3 DeHaat (dehaat.com)", "sec43"),
    spacer(),
    h3("Overview"),
    para("DeHaat is India's largest full-stack agricultural platform (as of 2025, following the acquisition of AgriCentral), operating across 12 agrarian states with over 11,000 DeHaat Centres and serving 1.8 million+ farmers. The DeHaat app offers AI-powered crop advisory, input supply, financing, insurance, and market linkages. Following the AgriCentral acquisition in January 2025, DeHaat now serves over 12 million farmers. The platform operates as a true agricultural super-app."),
    spacer(),
    h3("Key Features"),
    simpleTable(["Feature", "Description", "Relevance to Farm2Market"], deHaatFeatures, [1800, 3813, 3413]),
    spacer(),
    h3("UI/UX Observations"),
    bullet("Multi-language support (12+ Indian regional languages) with voice call advisory demonstrates advanced localization - a strong reference for Farm2Market's Bangla UI requirement."),
    bullet("AI-powered disease detection with satellite imagery represents a technologically advanced feature tier beyond what Farm2Market targets, but validates AI integration as academically significant."),
    bullet("The farmer dashboard (revenue tracking, order history) provides a benchmark UI pattern for Farm2Market's planned analytics dashboard."),
    bullet("App is highly polished with significant investment in UX - sets a high standard for agricultural mobile app design."),
    spacer(),
    h3("Strengths"),
    bullet("Most comprehensive feature set among all platforms analyzed - serves as the aspirational benchmark for full-stack agri-platform development."),
    bullet("AI-first architecture with satellite, soil, and weather data integration demonstrates production-grade ML deployment in agriculture."),
    bullet("Scale (12M+ farmers) proves commercial viability of the multi-service agri-platform model."),
    spacer(),
    h3("Weaknesses / Gaps"),
    bullet("India-specific context (state-level regulations, MSP pricing, FPO structures) means many features are not directly portable to Bangladesh."),
    bullet("Complexity of the platform makes it a difficult benchmark for a student-built academic project - risk of over-scoping."),
    bullet("No evidence of a three-actor marketplace (farmer/buyer/delivery) as a unified web platform - DeHaat is app-first and relies on its physical centre network."),
    spacer(),
    h3("Novelty Factor"),
    para("DeHaat's novelty is its AI-enabled full-stack super-app architecture deployed at national scale in India, integrating satellite imagery, soil sensors, and LLM-style advisory into a single farmer-facing mobile app. For Farm2Market's Scopus paper, DeHaat serves as the state-of-the-art reference against which the simpler, web-based three-actor Bangladesh marketplace model is positioned."),
    pageBreak(),
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 - Comparative Feature Matrix
// ══════════════════════════════════════════════════════════════════════════════
function makeSection5() {
  // col widths: Feature=2000, 7 platforms * 1003 = 7021, total = 9021 → adjust last to 1005
  const colWidths = [2000, 1003, 1003, 1003, 1003, 1003, 1003, 1008];

  const headers = ["Feature", "Farm2Market\n(Current)", "iFarmer\nWeb", "Krishi\nBazar", "AgriUdaan", "iFarmer\nApp (Folon)", "AgroShift", "DeHaat"];

  // [feature, F2M, iFarmerWeb, KrishiBazar, AgriUdaan, iFarmerApp, AgroShift, DeHaat]
  const matrixData = [
    ["Multi-role auth (farmer/buyer/delivery)", "✓", "Partial", "✗", "✗", "Partial", "Partial", "Partial"],
    ["Product listing with images", "✓", "Partial", "✓", "Unverified", "✓", "Partial", "✓"],
    ["Cart & checkout", "✓", "✗", "✓", "✗", "Partial", "✓", "✓"],
    ["Order tracking / lifecycle", "✓", "Partial", "✗", "✗", "Partial", "✓", "✓"],
    ["Delivery org portal / login", "✗", "✗", "✗", "✗", "✗", "✓", "✗"],
    ["Farmer-to-farmer peer purchasing", "✗", "✗", "✗", "✗", "✗", "✗", "✗"],
    ["AI / ML feature", "✗", "Partial", "✗", "Partial", "Partial", "✓", "✓"],
    ["Bilingual / local language support", "✗", "Partial", "✓", "Unverified", "✓", "Partial", "✓"],
    ["Payment gateway integration", "✗", "✓", "✓", "Unverified", "✓", "✓", "✓"],
    ["In-app notifications", "✓", "✓", "Partial", "✗", "✓", "✓", "✓"],
    ["Admin panel (customized)", "✗", "Unverified", "Unverified", "Unverified", "Unverified", "Unverified", "Unverified"],
    ["Farmer analytics dashboard", "✗", "Partial", "✗", "✗", "Partial", "Partial", "✓"],
    ["Rating & review system", "✗", "✗", "Partial", "✗", "✗", "✗", "Unverified"],
    ["Mobile application", "✗", "✓", "✗", "Unverified", "✓", "✓", "✓"],
    ["SMS / push notification", "✗", "✓", "✗", "✗", "✓", "✓", "✓"],
    ["Logistics / delivery tracking", "✗", "Partial", "✗", "Partial", "✗", "✓", "Partial"],
  ];

  const matrixRows = matrixData.map((row, ri) => {
    return new TableRow({
      children: row.map((val, ci) => {
        const isFeatureCol = ci === 0;
        return matrixCell(val, colWidths[ci], false, ri + (isFeatureCol ? 0 : 0));
      }),
    });
  });

  // header row for matrix
  const matrixHeaderRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.DXA },
      borders,
      margins: cellMargins,
      shading: { fill: "1F4E79", type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        children: [new TextRun({ text: h.replace("\n", " "), bold: true, color: "FFFFFF", size: 16 })],
      })],
    })),
  });

  const matrixTable = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [matrixHeaderRow, ...matrixRows],
  });

  return [
    h1("Section 5 - Comparative Feature Matrix", "sec5"),
    spacer(),
    para("The table below compares Farm2Market (current state) against all six competitor platforms across 16 key features. Color coding: green (✓ = present), yellow (Partial), red (✗ = absent), gray (Unverified)."),
    spacer(),
    matrixTable,
    spacer(),
    para("Legend: ✓ = Feature confirmed present | Partial = Feature present but incomplete or limited | ✗ = Feature absent | Unverified = Could not be confirmed through public sources - requires manual verification before submission.", { color: "595959" }),
    pageBreak(),
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6 - Gap Analysis: Features to ADD
// ══════════════════════════════════════════════════════════════════════════════
function makeSection6() {
  const gaps = [
    ["1", "Delivery Organization Login Portal & Dashboard",
      "AgroShift has a fully operational delivery management system. Farm2Market's current Logistic model stores only name and contact - no login, dashboard, or assignment workflow. This is a core actor in the 3-role architecture and its absence weakens the marketplace's end-to-end functionality.",
      "A three-actor marketplace is the primary academic contribution of Farm2Market. Without a delivery portal, the 'delivery organization' role is incomplete, undermining the paper's core claim. Including a delivery dashboard validates the three-actor model in production.",
      "Medium", "Must-have"],
    ["2", "Farmer-to-Farmer Peer Purchasing",
      "None of the six competitors offer this feature - making it a genuine innovation. Farmers could act as both sellers and buyers within the same platform (e.g., a vegetable farmer buying seeds from another farmer).",
      "Peer-to-peer marketplace dynamics in agricultural contexts are understudied. This feature creates a novel research angle for the Scopus paper -'intra-community agricultural trading' in a developing-country digital marketplace.",
      "Medium", "Must-have"],
    ["3", "AI-Powered Price Recommendation (Groq API / LLaMA 3.3 70B)",
      "AgroShift and DeHaat both deploy demand/price prediction in production. Farm2Market has zero AI/ML features. Integrating an LLM-based price suggestion (using Groq API with LLaMA 3.3 70B) would use public market data to recommend fair listing prices for farmers.",
      "AI/ML integration in agricultural platforms is a high-impact research topic. A production LLM integration in a Bangladesh marketplace, using open-source models via Groq, is a novel and publishable contribution. It directly addresses the paper's research gap in AI-for-agriculture.",
      "Medium", "Must-have"],
    ["4", "Customized Django Admin Panel (django-unfold or jazzmin)",
      "Farm2Market currently uses the default Django admin - no role-specific views, no analytics, no custom branding. Competitors with operational admin panels demonstrate the importance of role-specific backend management.",
      "A well-designed admin panel demonstrates system maturity and operational readiness. For a Scopus paper, showing a custom admin with role-based views strengthens the system architecture section and demonstrates professional software engineering practice.",
      "Low", "Must-have"],
    ["5", "Bilingual UI (English + Bangla)",
      "Krishi Bazar and iFarmer's Folon app demonstrate that Bangla-language interfaces are essential for Bangladesh farmer adoption. Farm2Market's English-only UI excludes a significant portion of its target users.",
      "Language localization in digital agricultural platforms is a validated research area. Demonstrating a bilingual interface in the Scopus paper directly addresses the digital divide and farmer accessibility aspects of the platform's research narrative.",
      "Medium", "Must-have"],
    ["6", "Farmer Analytics Dashboard (Revenue, Orders, Top Products)",
      "DeHaat offers farmer performance dashboards. AgroShift provides demand analytics. Farm2Market currently provides no data visualization or performance metrics for farmer users.",
      "Data-driven farmer empowerment is a key theme in agricultural technology research. A farmer analytics dashboard provides evidence of platform utility beyond basic transaction processing, strengthening the paper's impact narrative.",
      "Medium", "Should-have"],
    ["7", "Rating & Review System",
      "Krishi Bazar shows partial review capability. None of the Bangladesh competitors have a robust review system. Adding buyer reviews for products and farmer profiles would build marketplace trust.",
      "Trust mechanisms in peer-to-peer and B2C digital marketplaces are a well-established research topic. A rating system in Farm2Market provides a trust-building mechanism to analyze - adding an empirical layer to the paper's evaluation section.",
      "Low", "Should-have"],
    ["8", "Smart Stock & Demand Alerts",
      "DeHaat's AI system generates pest and supply alerts. AgroShift uses demand prediction. Farm2Market has no alerting system beyond order status notifications.",
      "Proactive notification systems in agricultural commerce reduce information asymmetry - a documented challenge in smallholder farming. An automated alert system (e.g., 'Your stock is low based on recent demand patterns') adds an intelligent layer to the platform.",
      "Medium", "Should-have"],
    ["9", "SMS Notification Integration",
      "AgroShift and DeHaat use SMS to reach farmers without smartphones. iFarmer uses SMS/call for collection hub notifications. Farm2Market's in-app notification system only reaches users who are logged in.",
      "SMS reach in low-connectivity rural contexts is a practical contribution that broadens the platform's applicability. In the Bangladesh context, SMS remains the most reliable communication channel for smallholder farmers.",
      "Low", "Nice-to-have"],
  ];

  const gapWidths = [300, 1800, 2842, 1984, 900, 1200];
  const total = gapWidths.reduce((a, b) => a + b, 0); // 9026

  return [
    h1("Section 6 - Gap Analysis: Features to Add to Farm2Market", "sec6"),
    spacer(),
    para("Based on the competitive analysis in Sections 3–5, the following features are recommended for addition to Farm2Market. Each recommendation includes justification, academic value, implementation complexity, and priority for the Scopus conference timeline."),
    spacer(),
    new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: gapWidths,
      rows: [
        headerRow(["#", "Feature Name", "Justification", "Academic Value", "Complexity", "Priority"], gapWidths),
        ...gaps.map((g, i) => gapRow(g, gapWidths, i)),
      ],
    }),
    pageBreak(),
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 7 - Features to REMOVE or DEFER
// ══════════════════════════════════════════════════════════════════════════════
function makeSection7() {
  const deferRows = [
    ["Payment Gateway (SSLCommerz / bKash)", "Integration with SSLCommerz or bKash requires merchant account setup, SSL certificate, and extensive security testing. The risk of introducing financial transaction bugs or compliance issues in an academic project timeline outweighs the benefit.", "Post-conference (Q1 2027 or after formal deployment)"],
    ["Mobile Application (Android/iOS)", "Building a dedicated mobile app is a separate project scope requiring different technology stack (React Native / Flutter) and significant additional development time. The current web-responsive approach is sufficient for the Scopus submission.", "Separate project phase - not part of conference scope"],
    ["Crop Insurance Integration", "Insurance product integration requires regulatory compliance, third-party insurer APIs, and legal agreements. This is well beyond the scope of a student project and conference timeline.", "Long-term commercial development phase"],
    ["Satellite / IoT Sensor Integration", "Features like satellite-based crop monitoring (as seen in DeHaat) require specialized APIs, significant data infrastructure, and domain expertise beyond the current team's scope.", "Future research collaboration opportunity"],
    ["Multi-Vendor / Multi-Warehouse Fulfillment", "Complex inventory routing across multiple warehouse nodes (as in AgroShift's hub model) requires advanced logistics infrastructure not feasible for the current academic project scope.", "Deferred to commercial deployment phase"],
  ];

  return [
    h1("Section 7 - Features to Remove or Defer", "sec7"),
    spacer(),
    para("The following features have been identified as out of scope for the current Scopus conference submission timeline. Deferring these features reduces implementation risk and allows the team to focus on high-impact, academically differentiated additions (Section 6)."),
    spacer(),
    simpleTable(
      ["Feature", "Reason to Defer", "Suggested Timeline"],
      deferRows,
      [2200, 4326, 2500]
    ),
    pageBreak(),
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 8 - Recommendations Summary
// ══════════════════════════════════════════════════════════════════════════════
function makeSection8() {
  const recRows = [
    ["1", "Delivery Organization Login Portal & Dashboard", "10–15", "Backend developer", "Sprint 1 - July 2026"],
    ["2", "AI Price Recommendation (Groq / LLaMA 3.3 70B)", "7–10", "ML/AI developer", "Sprint 1 - July 2026"],
    ["3", "Bilingual UI (English + Bangla)", "8–12", "Frontend developer", "Sprint 1 - July 2026"],
    ["4", "Farmer-to-Farmer Peer Purchasing", "8–12", "Full-stack developer", "Sprint 2 - August 2026"],
    ["5", "Customized Django Admin (django-unfold)", "3–5", "Backend developer", "Sprint 2 - August 2026"],
    ["6", "Farmer Analytics Dashboard", "5–8", "Frontend developer", "Sprint 2 - August 2026"],
    ["7", "Rating & Review System", "4–6", "Full-stack developer", "Sprint 3 - September 2026"],
    ["8", "Smart Stock & Demand Alerts", "4–6", "Backend developer", "Sprint 3 - September 2026"],
    ["9", "SMS Notification Integration", "3–4", "Backend developer", "Sprint 3 - September 2026"],
    ["10", "UI/UX Polish & Accessibility Audit", "5–7", "All team members", "Sprint 4 - October 2026"],
  ];

  return [
    h1("Section 8 - Recommendations Summary", "sec8"),
    spacer(),
    para("The table below provides a prioritized action plan for Farm2Market's feature development, ordered by implementation priority for the Scopus conference submission. All features are scoped for the web platform only (no mobile app)."),
    spacer(),
    simpleTable(
      ["Rank", "Feature", "Effort (Days)", "Responsible", "Target Milestone"],
      recRows,
      [500, 3000, 1300, 1900, 2326]
    ),
    spacer(),
    para("Note: Effort estimates assume a team of 3–4 student developers familiar with Django and basic JavaScript. Estimates should be reviewed against actual team capacity before sprint planning.", { color: "595959" }),
    pageBreak(),
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 9 - Conclusion
// ══════════════════════════════════════════════════════════════════════════════
function makeSection9() {
  return [
    h1("Section 9 - Conclusion", "sec9"),
    spacer(),
    para("Farm2Market already demonstrates a well-structured three-actor marketplace architecture that is functionally ahead of several competitors analyzed in this report. Its eight-stage order lifecycle, unified profile model, and in-app notification system provide a solid operational foundation. Compared to Krishi Bazar - the closest Bangladesh-based competitor - Farm2Market uniquely supports buyer-side e-commerce (cart and checkout) alongside farmer produce listing, which Krishi Bazar does not. The three-role architecture (farmer, buyer, delivery organization) is a distinct structural differentiator that none of the six platforms reviewed replicate in their full form on a web platform. This architectural novelty is the strongest foundation for the team's Scopus conference submission."),
    spacer(),
    para("The platform's unique research contribution lies at the intersection of three dimensions: (1) a three-actor digital marketplace (farmer, buyer, delivery organization) on a single web platform; (2) intra-community peer trading (farmer-to-farmer purchasing) - a feature absent from all six competitors analyzed; and (3) LLM-powered price recommendation using open-source models (LLaMA 3.3 70B via Groq API) in a Bangladesh agricultural context. Together, these three elements constitute a publishable, novel contribution to the agricultural e-commerce and AI-in-agriculture literature - particularly within the South Asian and developing-country technology context. The three-actor model addresses a documented gap in existing platforms, which typically serve either farmers (as in iFarmer and DeHaat) or buyers (as in Krishi Bazar), but rarely both simultaneously with a functional delivery organization layer."),
    spacer(),
    para("The immediate next steps for the team are: (1) implement the delivery organization login portal and dashboard to complete the three-actor architecture; (2) integrate the Groq API with LLaMA 3.3 70B for AI-powered price recommendations to add the AI/ML dimension; (3) implement a Bangla-language UI toggle to address the language accessibility gap identified in all Bangladesh competitors; and (4) customize the Django admin panel using django-unfold or jazzmin to demonstrate system maturity. With these four additions, Farm2Market will have a demonstrably novel, functional, and academically rigorous platform ready for the Scopus conference submission. The team should allocate approximately 6–8 weeks (July–August 2026) for these sprint tasks before beginning the paper writing and evaluation phase."),
    pageBreak(),
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// APPENDIX A
// ══════════════════════════════════════════════════════════════════════════════
function makeAppendix() {
  return [
    h1("Appendix A - Platform Screenshots Reference List", "appendixA"),
    spacer(),
    para("The following screenshots should be taken manually and inserted into this section before final submission of the report. Each screenshot should be annotated with the feature it demonstrates."),
    spacer(),
    numbered("iFarmer (ifarmer.asia) - Homepage showing role-based navigation and platform overview"),
    numbered("iFarmer (ifarmer.asia) - Folon app product page or farmer registration screen"),
    numbered("Krishi Bazar (krishibazar.com.bd) - Homepage showing Bangla-language UI and product categories"),
    numbered("Krishi Bazar (krishibazar.com.bd) - Product listing page with cart functionality"),
    numbered("AgriUdaan (agriudaan.com) - Homepage and market access feature overview"),
    numbered("iFarmer Folon App (Google Play) - App store listing and key feature screenshots"),
    numbered("AgroShift (agroshift.com) - Platform overview and supply chain diagram"),
    numbered("DeHaat App - AI advisory interface, farmer dashboard, and regional language selection screen"),
    numbered("Farm2Market - Current homepage and product listing (for comparison baseline)"),
    numbered("Farm2Market - Order lifecycle management interface (8-stage tracking)"),
    spacer(),
    para("Note: All screenshots must be taken from publicly accessible URLs. Avoid capturing any user account data, personal information, or proprietary business data. Include the access date and URL for each screenshot in the caption.", { color: "595959" }),
    spacer(),
    para("Screenshots should be embedded at a resolution of at least 96 DPI and sized to fill the full text width (approximately 16cm / 6.3 inches) to ensure readability when printed.", { color: "595959" }),
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENT ASSEMBLY
// ══════════════════════════════════════════════════════════════════════════════
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "main-bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "main-numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: "Arial", size: 24 } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 40, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 },
      },
      {
        id: "Normal", name: "Normal", quickFormat: true,
        run: { size: 24, font: "Arial" },
        paragraph: { spacing: { after: 160, line: 276, lineRule: "auto" } },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1200, bottom: 1440, left: 1200 },
        },
      },
      children: [
        ...makeCoverPage(),
        // TOC page
        h1("Table of Contents"),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
        pageBreak(),
        ...makeSection1(),
        ...makeSection2(),
        ...makeSection3(),
        ...makeSection4(),
        ...makeSection5(),
        ...makeSection6(),
        ...makeSection7(),
        ...makeSection8(),
        ...makeSection9(),
        ...makeAppendix(),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("Farm2Market_Market_Analysis_Report_June2026.docx", buffer);
  console.log("Done: Farm2Market_Market_Analysis_Report_June2026.docx");
});
