# School of Public Health — M.Sc. Health Data Science
## Student Talent Showcase (Batch 2025–2027)

> **SRM Institute of Science and Technology — Kattankulathur, Chengalpattu**

An interactive, high-performance web application showcasing the student cohort, research projects, industry immersion deliverables, and technical capabilities of the M.Sc. Health Data Science (Batch 2025–2027) programme.

---

## ✨ Features

- 🎓 **Student Directory**: Detailed candidate profiles featuring academic background, technical skills, domain interests, industry immersion experience, certifications, and direct contact options (LinkedIn, GitHub, Email, Mobile).
- 🔬 **Project Showcase**: Searchable and filterable repository of academic research projects and industry deliverables across Clinical AI, Healthcare Analytics, NLP, Computer Vision, and Electronic Medical Records.
- 📊 **Interactive Skills & Talent Matrix**: Cohort-wide capability map sorted by proficiency or alphabetical order, categorized into:
  - **Core Data & Stats**: Python, R, SQL, Biostatistics, EDA, Data Cleaning.
  - **AI, ML & GenAI**: Deep Learning, LLMs, RAG, Prompt Engineering, Computer Vision.
  - **Clinical & Health**: Clinical Data Management, GCP, EMR/HIS, Pharmacovigilance.
  - **BI & Domain**: Power BI, Tableau, Excel, Healthcare Business Intelligence.
- 🏢 **Industry Immersion Tracker**: Highlights real-world projects completed at top healthcare, pharmaceutical, and technology organizations (e.g., Orbiton Life Sciences, Prediscan Medtech, MSMF, Suvij IT Services, MDRF, NIEPMD).
- 🎯 **Recruiter Talent Finder**: Interactive multi-parameter search engine allowing placement officers and recruiters to quickly discover candidates matching specific technical and domain criteria.
- 📱 **Modern & Responsive Aesthetic**: Dark luxury glassmorphism theme, smooth modal popups, slide-in detail drawers, and micro-animations.
- ⚡ **Zero-Dependency Architecture**: Built purely using HTML5, Vanilla CSS3, and ES6+ JavaScript for optimal speed and reliability.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Glassmorphic Layouts), Modern JavaScript (ES6+ async/await engine)
- **Data Stores**: Structured JSON data engines (`students.json`, `brochure_pages.json`)
- **Graphics & Assets**: High-resolution image optimization & SVG icon metrics
- **Server**: Lightweight Python HTTP server (`serve.py`) with no-cache header configuration

---

## 📂 Project Structure

```
.
├── assets/
│   └── brochure_extract/
│       ├── students.json          # Primary dataset of candidate profiles, skills & projects
│       ├── brochure_pages.json    # Cached brochure text extracts for deep search
│       └── page_*_img_*.png/.jpeg # Profile photographs and institution logos
├── index.html                     # Main single-page application entry point
├── site-style.css                 # Full design system, dark mode glassmorphism, responsive styles
├── app.js                         # Main application engine (filters, pagination, modals, skills map)
├── serve.py                       # Python HTTP server script with cache-control headers
├── .gitignore                     # Git ignore file
└── README.md                      # Comprehensive project documentation
```

---

## 🚀 Getting Started

### Prerequisites
Any modern web browser (Google Chrome, Mozilla Firefox, Microsoft Edge, Safari).

### Local Execution
1. Clone the repository:
   ```bash
   git clone https://github.com/Rikdebmandal/Website-for-M.Sc.-Health-Data-Science-showcase.git
   cd Website-for-M.Sc.-Health-Data-Science-showcase
   ```

2. Start the local server:
   ```bash
   python serve.py
   ```
   *(Alternatively, run `python -m http.server 5500`)*

3. Open your browser and navigate to:
   ```
   http://localhost:5500
   ```

---

## 📬 Placement & Institutional Contacts

- **Institution**: School of Public Health, SRM Institute of Science and Technology, Kattankulathur, Chengalpattu – 603203
- **Placement Officer**: Dr. Prakash M — Associate Professor & In-charge Student Placement
- **Email**: [Prakashm6@srmist.edu.in](mailto:Prakashm6@srmist.edu.in)
- **Contact Number**: +91 99946 98007

---

## 👨‍💻 Developer & Maintainer

Designed and developed by **[Rikdeb Mandal](https://github.com/Rikdebmandal)** (M.Sc. Health Data Science, SRM Institute of Science and Technology).

© 2026 SRM Institute of Science and Technology — School of Public Health.
