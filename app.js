async function loadStudents(){
  const res = await fetch('assets/brochure_extract/students.json');
  const data = await res.json();
  return data.students || [];
}

// cache brochure pages so missing fields can be recovered when needed
let _brochureCache = null;
async function ensureBrochureCache(){
  if(_brochureCache) return _brochureCache;
  try{
    const res = await fetch('assets/brochure_extract/brochure_pages.json');
    const data = await res.json();
    _brochureCache = data.pages || [];
    return _brochureCache;
  }catch(e){
    _brochureCache = [];
    return _brochureCache;
  }
}

function extractProjectsFromBrochureText(text){
  if(!text) return '';
  // try common headings
  const m = text.match(/PROJECTS?(?: UNDERTAKEN| UNDERTAKEN:| UNDERTAKEN\s*\n|S UNDERTAKEN|S\s*\n)?[:\s\n]*([\s\S]*?)(?:TECHNICAL SKILLS|CERTIFICATIONS|LANGUAGE|LANGUAGES|AREA OF INTEREST|INDUSTRY IMMERSION|KEY CONTRIBUTION)/i);
  if(m && m[1]){
    return m[1].trim();
  }
  // fallback: look for lines that start with a digit and a dot
  const lines = text.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const items = lines.filter(l=>/^\d+\./.test(l) || /^\d+\u2022/.test(l));
  if(items.length) return items.join('\n');
  return '';
}

function extractLanguagesFromBrochureText(text){
  if(!text) return '';
  const m = text.match(/LANGUAGES?\s*[:\-]?\s*([^\n]+)/i) || text.match(/LANGUAGE\s*[:\-]?\s*([^\n]+)/i);
  if(m && m[1]) return m[1].trim();
  return '';
}

async function findBrochureDataForName(name){
  if(!name) return {};
  const pages = await ensureBrochureCache();
  const lower = name.toLowerCase();
  for(const p of pages){
    if(!p || !p.text) continue;
    const txt = p.text;
    if(txt.toLowerCase().includes(lower)){
      const projects = extractProjectsFromBrochureText(txt);
      const languages = extractLanguagesFromBrochureText(txt);
      return {projects, languages};
    }
  }
  return {};
}

function ensureUrl(url){
  if(!url) return null;
  url = url.trim();
  if(url.startsWith('http') || url.startsWith('mailto:')) return url;
  if(url.includes('linkedin.com') && !url.startsWith('http')) return 'https://' + url.replace('\u200b','');
  if(url.includes('github.com') && !url.startsWith('http')) return 'https://' + url.replace('\u200b','');
  if(url.includes('@')) return 'mailto:' + url;
  return (url.startsWith('www.') ? 'https://' + url : 'https://' + url);
}

function shortFocusFromArea(area){
  if(!area) return '';
  return area.split(',').slice(0,2).map(s=>s.trim()).join(' • ');
}

function splitLines(txt){
  if(!txt) return [];
  return txt.split(/\n+/).map(s=>s.trim()).filter(Boolean);
}

function cleanText(txt){
  if(!txt) return '';
  return txt.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

function splitNumberedItems(txt){
  if(!txt) return [];
  const text = cleanText(txt);
  const firstNumMatch = text.search(/(?:^|\n+)\s*1[\.\)\-]\s*/);
  if (firstNumMatch === -1) {
    const anyNumMatch = text.search(/(?:^|\n+)\s*\d+[\.\)\-]\s*/);
    if (anyNumMatch === -1) return [];
    const numberedPart = text.slice(anyNumMatch);
    const parts = numberedPart.split(/(?:^|\n+)\s*\d+[\.\)\-]\s*/).map(p=>cleanText(p)).filter(Boolean);
    return parts.map(p => {
      const singleLine = p.split(/\n+/).map(l=>l.trim()).join(' ');
      return singleLine.replace(/^[\.\,\-\–\—\s]+/, '').replace(/[\.\s]+$/, '');
    }).filter(p => p.length > 5);
  }
  const numberedPart = text.slice(firstNumMatch);
  const parts = numberedPart.split(/(?:^|\n+)\s*\d+[\.\)\-]\s*/).map(p=>cleanText(p)).filter(Boolean);
  return parts.map(p => {
    const singleLine = p.split(/\n+/).map(l=>l.trim()).join(' ');
    return singleLine.replace(/^[\.\,\-\–\—\s]+/, '').replace(/[\.\s]+$/, '');
  }).filter(p => p.length > 5);
}

function extractTechSkills(title, desc, defaultSkillsStr){
  const text = (title + ' ' + (desc || '')).toLowerCase();
  const found = new Set();
  const skillKeywords = [
    { key: 'Explainable AI', test: /explainable|xai|saliency/i },
    { key: 'Deep Learning', test: /deep learning|neural|cnn|yolo/i },
    { key: 'Computer Vision', test: /retinal|yolo|opencv|cctv|image|vision/i },
    { key: 'NLP', test: /nlp|sentiment|reddit|youtube comments|language/i },
    { key: 'Large Language Models', test: /llm|rag|agent|genai|prompt/i },
    { key: 'Power BI', test: /power\s*bi|powerbi|dax/i },
    { key: 'FastAPI', test: /fastapi/i },
    { key: 'SQL / MySQL', test: /sql|mysql/i },
    { key: 'Streamlit', test: /streamlit|hugging\s*face/i },
    { key: 'Machine Learning', test: /machine learning|regression|predictive|k-means|clustering|apriori/i },
    { key: 'Time-Series & Forecasting', test: /forecast|stability|demand|weather/i },
    { key: 'Geospatial & GIS', test: /geospatial|gis|flood|landslide/i },
    { key: 'Data Engineering / ETL', test: /etl|pipeline|database loading/i },
    { key: 'ERP Systems', test: /erp|erpnext/i },
    { key: 'Clinical Research & GCP', test: /clinical trial|cimt|cohort|gcp|atherosclerosis|biomarker/i },
    { key: 'Pharmacovigilance', test: /post- marketing|surveillance|semaglutide|drug-drug|drug stability/i },
    { key: 'Healthcare Analytics', test: /healthcare|hospital|patient|dropout|injury/i },
    { key: 'Python', test: /python/i },
    { key: 'R', test: /\br\b/i }
  ];
  skillKeywords.forEach(sk => {
    if (sk.test.test(text)) found.add(sk.key);
  });
  if (found.size < 3 && defaultSkillsStr) {
    const list = defaultSkillsStr.split(',').map(s=>s.trim()).filter(Boolean);
    for (const s of list) {
      if (found.size >= 4) break;
      if (s.length > 1 && s.length < 25 && !s.includes('Ready To Learn')) found.add(s);
    }
  }
  return Array.from(found).slice(0, 4);
}

function parseEducationToTable(raw){
  if(!raw) return '';
  const lines = raw.split(/\n+/).map(l=>l.trim()).filter(Boolean);
  // heuristic: find degree headings and group subsequent lines as institution/details
  const degreeKeywords = [/M\.?Sc/i,/MSc/i,/B\.?Sc/i,/BSc/i,/Bachelor/i,/Master/i,/Ph\.?D/i,/Diploma/i,/PGD/i,/BA\b/i,/B\.A\b/i,/BS\b/i];
  const groups = [];
  let i = 0;
  while(i < lines.length){
    const line = lines[i];
    let isDegree = degreeKeywords.some(rx=>rx.test(line)) || /Health Data Science/i.test(line) || /Medical Imaging|Physician|Pharmacy|Prosthetics|Biotechnology/i.test(line);
    if(isDegree){
      let degree = line;
      i++;
      const details = [];
      while(i < lines.length && !degreeKeywords.some(rx=>rx.test(lines[i]))){
        // stop if next is clearly a new section header
        if(/AREA OF INTEREST|INDUSTRY IMMERSION|CERTIFICATIONS|LANGUAGE/i.test(lines[i])) break;
        details.push(lines[i]);
        i++;
      }
      groups.push({degree, details});
    } else {
      i++;
    }
  }
  // fallback: if no groups found, try splitting by obvious degree separators (M.Sc / B.Sc)
  if(groups.length === 0){
    // try to find lines that contain year and cgpa and chunk backwards
    const candidates = [];
    for(let j=0;j<lines.length;j++){
      if(/20\d{2}/.test(lines[j]) || /CGPA|Percentage|%|CGPA\b/i.test(lines[j])){
        candidates.push(lines[j]);
      }
    }
    if(candidates.length === 0) return '<pre class="education">'+raw.replace(/\n/g,'\n')+'</pre>';
    return '<pre class="education">'+raw.replace(/\n/g,'\n')+'</pre>';
  }
  // construct table
  let html = '<table class="education-table"><thead><tr><th>Degree / Program</th><th>Institution</th><th>Year</th><th>CGPA / %</th></tr></thead><tbody>';
  groups.forEach(g=>{
    const detailText = g.details.join(' | ');
    const yearMatch = detailText.match(/(20\d{2})/);
    // match CGPA or percentage values like 8, 8.29, 9.6 but avoid matching years like 2025
    const cgpaMatch = detailText.match(/\b(?:10(?:\.\d{1,2})?|[0-9](?:\.\d{1,2})?)\b/); // e.g., 7.68 or 8
    const percentMatch = detailText.match(/(\d{1,3}%)/);
    // determine institution by taking details up to year or cgpa
    let institution = g.details.length ? g.details[0] : '';
    if(yearMatch){
      const idx = detailText.indexOf(yearMatch[0]);
      const inst = detailText.substring(0, idx).replace(/\|\s*$/,'').trim();
      if(inst) institution = inst;
    }
    const year = yearMatch? yearMatch[0] : '';
    const cgpa = cgpaMatch? cgpaMatch[0] : (percentMatch? percentMatch[0] : '');
    html += `<tr><td>${g.degree}</td><td>${institution}</td><td>${year}</td><td>${cgpa}</td></tr>`;
  });
  html += '</tbody></table>';
  return html;
}

function createElem(html){
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstChild;
}

function getDominantColorFromImgSrc(src){
  return new Promise((res)=>{
    if(!src){ res('rgb(6, 182, 212)'); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = ()=>{
      try{
        const canvas = document.createElement('canvas');
        const w = Math.min(100, img.width);
        const h = Math.min(100, img.height);
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0,0,w,h).data;
        let r=0,g=0,b=0,count=0;
        for(let i=0;i<data.length;i+=4){
          const alpha = data[i+3];
          if(alpha<128) continue;
          r += data[i]; g += data[i+1]; b += data[i+2]; count++;
        }
        if(count===0) return res('rgb(6, 182, 212)');
        r = Math.round(r/count); g = Math.round(g/count); b = Math.round(b/count);
        res(`rgb(${r}, ${g}, ${b})`);
      }catch(e){
        res('rgb(6, 182, 212)');
      }
    };
    img.onerror = ()=> res('rgb(6, 182, 212)');
    img.src = src;
  });
}

function renderStudentCard(s){
  const img = s.image ? 'assets/brochure_extract/' + s.image : '';
  const focus = shortFocusFromArea(s.area_of_interest);
  const card = createElem(`<div class="card" data-name="${s.name}" role="button" tabindex="0" aria-label="View profile of ${s.name}">
    <img src="${img}" alt="${s.name}" />
    <div class="meta">
      <h3>${s.name}</h3>
      <p>${focus || 'M.Sc. Health Data Science'}</p>
      <div class="cta"><button class="btn-small" data-name="${s.name}">View Profile</button></div>
    </div>
  </div>`);
  // adapt card color based on dominant color of image
  if(img){
    getDominantColorFromImgSrc(img).then(col=>{
      card.style.border = `1px solid ${col}`;
      card.style.boxShadow = `0 8px 24px ${col}22`;
      const meta = card.querySelector('.meta');
      if(meta) meta.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))';
    });
  }
  card.querySelector('button').addEventListener('click', (e)=>{
    e.stopPropagation();
    openProfileModal(s);
  });
  card.addEventListener('click', ()=>openProfileModal(s));
  card.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      openProfileModal(s);
    }
  });
  return card;
}

function renderStudentsGrid(students, totalCohortCount){
  const grid = document.getElementById('student-grid');
  const countEl = document.getElementById('student-count');
  const total = totalCohortCount !== undefined ? totalCohortCount : (window._totalStudentsCount || 9);

  if(countEl){
    if(!students || students.length === 0){
      countEl.textContent = 'No candidates match your current filter';
    } else if(students.length === total){
      countEl.textContent = `Showing all ${total} candidates`;
    } else {
      countEl.textContent = `Showing ${students.length} of ${total} candidates`;
    }
  }

  if(!grid) return;
  grid.innerHTML = '';

  if(!students || students.length === 0){
    const empty = createElem(`<div class="card" style="grid-column:1/-1;padding:36px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;cursor:default">
      <div style="font-size:32px;opacity:0.6">🔍</div>
      <h3 style="font-size:17px;color:#fff;margin:0">No candidates match your criteria</h3>
      <p style="margin:0;color:var(--muted);font-size:13.5px;max-width:420px">Try a different search term (e.g. Python, SQL, ML, Orbiton, Prediscan) or reset the domain filter.</p>
      <button id="reset-student-filters-btn" class="btn-small" style="margin-top:6px;background:rgba(6,182,212,0.1);border-color:rgba(6,182,212,0.4);color:#38bdf8">Reset Filters</button>
    </div>`);
    grid.appendChild(empty);
    const rBtn = document.getElementById('reset-student-filters-btn');
    if(rBtn){
      rBtn.addEventListener('click', ()=>{
        const sInput = document.getElementById('search');
        const fSelect = document.getElementById('filter-select');
        if(sInput) sInput.value = '';
        if(fSelect) fSelect.value = 'all';
        const ev = new Event('input', { bubbles: true });
        if(sInput) sInput.dispatchEvent(ev);
      });
    }
    return;
  }

  students.forEach((s, idx) => {
    const card = renderStudentCard(s);
    card.style.animationDelay = `${idx * 0.03}s`;
    grid.appendChild(card);
  });
}

async function openProfileModal(s){
  const modal = document.getElementById('profile-modal');
  const body = document.getElementById('modal-body');
  const img = s.image ? 'assets/brochure_extract/' + s.image : '';
  const linkedin = ensureUrl(s.linkedin);
  const github = ensureUrl(s.github);
  const email = s.email ? 'mailto:' + s.email : null;

  const educationHtml = parseEducationToTable(s.education_raw);
  const industry = s.industry_immersion ? s.industry_immersion.replace(/\n/g,'<br/>') : '';
  let academicItems = splitNumberedItems(s.academic_projects || '');
  const industryItems = splitNumberedItems(s.industry_immersion || '');
  const skills = (s.technical_skills || '').split(',').map(x=>x.trim()).filter(Boolean);
  const certs = (s.certifications || '').split(/[\n,]+/).map(x=>x.trim()).filter(Boolean);
  let languagesArr = (s.languages || '').split(',').map(x=>x.trim()).filter(Boolean);
  // fallback: if academic projects or languages missing, try to extract from brochure_pages.json
  if((!academicItems || academicItems.length===0) || (!languagesArr || languagesArr.length===0)){
    try{
      const b = await findBrochureDataForName(s.name);
      if(b.projects && (!academicItems || academicItems.length===0)){
        academicItems = splitNumberedItems(b.projects);
      }
      if(b.languages && (!languagesArr || languagesArr.length===0)){
        languagesArr = b.languages.split(',').map(x=>x.trim()).filter(Boolean);
      }
    }catch(e){ /* ignore */ }
  }

  let html = `<div class="profile">
    <div class="profile-header">
      <img id="profile-photo" src="${img}" alt="${s.name}" />
      <div>
        <h2>${s.name}</h2>
        <div id="profile-area" class="pill">${s.area_of_interest || ''}</div>
        <p style="color:var(--muted);margin-top:6px">${s.mobile || ''} • <a href="mailto:${s.email || ''}">${s.email || ''}</a></p>
        <p style="margin-top:8px">`;
  if(linkedin) html += `<a class="pill" href="${linkedin}" target="_blank" rel="noopener">LinkedIn</a> `;
  if(github) html += `<a class="pill" href="${github}" target="_blank" rel="noopener">GitHub</a> `;
  html += `</p>
      </div>
    </div>

    <hr />
    <section>
      <h3>Education</h3>
      ${educationHtml}
    </section>

    <section>
      <h3>Industry Immersion / Internship</h3>
      <div class="project-card">${industry}</div>
      ${industryItems.length? '<p><strong>Internship projects:</strong></p>':''}
      <ul>${industryItems.map(i=>'<li>'+i+'</li>').join('')}</ul>
    </section>

    <section>
      <h3>Academic Projects</h3>
      <ul>${academicItems.map(i=>'<li>'+i+'</li>').join('')}</ul>
    </section>

    <section>
      <h3>Technical Skills</h3>
      <div>${skills.map(s=>'<span class="skill-tag">'+s+'</span>').join('')}</div>
    </section>

    <section>
      <h3>Languages</h3>
      <div>${languagesArr.join(', ')}</div>
    </section>

  </div>`;
  
  body.innerHTML = html;
  body.querySelectorAll('.skill-tag').forEach(tag => {
    tag.title = 'Click to view in Talent Map';
    tag.addEventListener('click', () => {
      const sName = tag.textContent.trim();
      const norm = normalizeSkill(sName);
      if(norm && _skillsData && _skillsData.map.has(norm)){
        closeModal();
        setTimeout(() => {
          openSkillPanel(norm);
          const sec = document.getElementById('skills');
          if(sec) sec.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    });
  });
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  // after modal is added, compute dominant color and adapt theme
  const photoEl = document.getElementById('profile-photo');
  getDominantColorFromImgSrc(photoEl.src).then(col=>{
    const modalContent = document.querySelector('.modal-content');
    modalContent.style.border = `2px solid ${col}`;
    modalContent.style.boxShadow = `0 20px 60px ${col}22`;
    // adjust header background gradient
    const header = document.querySelector('.profile-header');
    if(header) header.style.background = `linear-gradient(90deg, ${col}22, rgba(255,255,255,0.02))`;
    // update area pill
    const areaPill = document.getElementById('profile-area');
    if(areaPill) areaPill.style.background = `${col}11`;
  });

  body.innerHTML = html;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
}

function closeModal(){
  const modal = document.getElementById('profile-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
}

function openInternModal(intern, org){
  const modal = document.getElementById('intern-modal');
  const body = document.getElementById('intern-modal-body');
  const img = intern.image ? 'assets/brochure_extract/' + intern.image : '';
  const html = `<div class="profile">
    <div class="profile-header">
      <img src="${img}" alt="${intern.name}" />
      <div>
        <h2>${intern.name}</h2>
        <div class="pill">${intern.role || ''}</div>
        <p style="color:var(--muted);margin-top:6px">${org}</p>
      </div>
    </div>
    <hr />
    <section>
      <h3>Internship Details</h3>
      <div class="project-card">${(intern.raw||'').replace(/\n/g,'<br/>')}</div>
    </section>
    <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
      <button id="intern-view-profile" class="btn-small">View Profile</button>
      <button id="intern-close" class="btn-small">Close</button>
    </div>
  </div>`;
  body.innerHTML = html;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  document.getElementById('intern-view-profile').addEventListener('click', ()=>{ if(intern.studentRef) openProfileModal(intern.studentRef); });
  document.getElementById('intern-close').addEventListener('click', ()=>{ closeInternModal(); });
}

function closeInternModal(){
  const modal = document.getElementById('intern-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
}

const DOMAIN_FILTERS = [
  { id: 'all', label: 'All Domains' },
  { id: 'pharma', label: 'Pharma IT & Lifesciences', keywords: ['pharma', 'lifesciences', 'scientific informatics'] },
  { id: 'cro', label: 'CRO & Clinical Research', keywords: ['cro', 'clinical research', 'clinical trials'] },
  { id: 'medtech', label: 'MedTech & Devices', keywords: ['medtech', 'med tech', 'health-tech'] },
  { id: 'ai', label: 'Artificial Intelligence & GenAI', keywords: ['artificial intelligence', 'ai', 'genai', 'automation'] },
  { id: 'clinical_data', label: 'Clinical Data & SAS', keywords: ['clinical data', 'clinical sas', 'clinical'] },
  { id: 'imaging', label: 'Medical Imaging & Analytics', keywords: ['image analysis', 'medical imaging', 'medical image'] },
  { id: 'operations', label: 'Operations, Epic & RWE', keywords: ['operations', 'epic', 'real world evidence', 'insurance'] }
];

function buildFilters(students){
  const select = document.getElementById('filter-select');
  if(!select) return;
  select.innerHTML = '';

  DOMAIN_FILTERS.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    if(f.id === 'all'){
      opt.textContent = `All Domains (${students.length})`;
    } else {
      const matchCount = students.filter(s => {
        const domainHay = [s.area_of_interest, s.technical_skills, s.academic_projects, s.industry_immersion].filter(Boolean).join(' ').toLowerCase();
        return f.keywords.some(kw => domainHay.includes(kw));
      }).length;
      opt.textContent = `${f.label} (${matchCount})`;
    }
    select.appendChild(opt);
  });
}

function filterStudents(students, q, areaId){
  q = q ? q.toLowerCase().trim() : '';
  areaId = areaId ? areaId.toLowerCase() : 'all';

  return students.filter(s => {
    // 1. Domain category filter
    if(areaId !== 'all'){
      const filterObj = DOMAIN_FILTERS.find(f => f.id === areaId);
      if(filterObj && filterObj.keywords){
        const domainHay = [s.area_of_interest, s.technical_skills, s.academic_projects, s.industry_immersion].filter(Boolean).join(' ').toLowerCase();
        const matchesDomain = filterObj.keywords.some(kw => domainHay.includes(kw));
        if(!matchesDomain) return false;
      }
    }

    // 2. Query search
    if(!q) return true;
    const hay = [
      s.name,
      s.area_of_interest,
      s.technical_skills,
      s.industry_immersion,
      s.key_contributions,
      s.academic_projects,
      s.certifications,
      s.languages,
      s.education_raw
    ].filter(Boolean).join(' ').toLowerCase();

    // support space or '+' separated keywords (AND logic)
    const terms = q.includes('+')
      ? q.split('+').map(t => t.trim()).filter(Boolean)
      : q.split(/\s+/).map(t => t.trim()).filter(Boolean);

    return terms.every(t => hay.includes(t));
  });
}

function buildProjects(students){
  const projects = [];

  students.forEach(s => {
    // 1. Academic Projects
    if (s.academic_projects) {
      const parts = splitNumberedItems(s.academic_projects);
      parts.forEach(title => {
        if (title.length > 5) {
          const skills = extractTechSkills(title, '', s.technical_skills);
          projects.push({
            id: 'proj-' + (projects.length + 1),
            title: title,
            type: 'Academic',
            category: 'Academic Research',
            org: 'SRM Institute of Science and Technology',
            description: 'Academic research and predictive modeling project developed as part of the M.Sc. Health Data Science curriculum at School of Public Health, SRM IST.',
            skills: skills,
            student: s.name,
            studentImage: s.image,
            studentEmail: s.email,
            studentMobile: s.mobile,
            studentLinkedin: s.linkedin,
            studentGithub: s.github,
            studentRef: s
          });
        }
      });
    }

    // 2. Industry Immersion Projects
    if (s.industry_immersion) {
      const text = cleanText(s.industry_immersion);
      let org = 'Industry Partner';
      if (/orbiton/i.test(text)) org = 'Orbiton Life Sciences';
      else if (/prediscan/i.test(text)) org = 'Prediscan Medtech Pvt. Ltd';
      else if (/suvij/i.test(text)) org = 'Suvij IT Services Pvt. Ltd';
      else if (/madras diabetes/i.test(text) || /mdrf/i.test(text)) org = 'Madras Diabetes Research Foundation';
      else if (/msmf|mazumdhar/i.test(text)) org = 'Mazumdar Shaw Medical Foundation (MSMF)';
      else if (/niepmd|ottobock|endolite/i.test(text)) org = 'NIEPMD / Ottobock India / Endolite India';

      const contrib = s.key_contributions || '';
      const mainPart = text.split(/KEY CONTRIBUTION|Key Learning/i)[0];
      const numberedMatches = splitNumberedItems(mainPart);

      if (numberedMatches.length > 0) {
        for (const pText of numberedMatches) {
          if (pText.length > 5) {
            const skills = extractTechSkills(pText, contrib, s.technical_skills);
            projects.push({
              id: 'proj-' + (projects.length + 1),
              title: pText,
              type: 'Industry',
              category: 'Industry Immersion',
              org: org,
              description: contrib || ('Industry immersion project delivered at ' + org + '.'),
              skills: skills,
              student: s.name,
              studentImage: s.image,
              studentEmail: s.email,
              studentMobile: s.mobile,
              studentLinkedin: s.linkedin,
              studentGithub: s.github,
              studentRef: s
            });
          }
        }
      } else {
        if (/cctv|yolov8|fastapi/i.test(text)) {
          projects.push({
            id: 'proj-' + (projects.length + 1),
            title: 'Power BI & FastAPI Reporting Pipeline on MySQL CCTV Event Data',
            type: 'Industry',
            category: 'Industry Immersion',
            org: org,
            description: contrib || 'Built a Power BI and FastAPI reporting pipeline on MySQL CCTV event data to analyse false-alarm rates and device-offline trends across client sites.',
            skills: extractTechSkills('Power BI FastAPI MySQL CCTV', contrib, s.technical_skills),
            student: s.name,
            studentImage: s.image,
            studentEmail: s.email,
            studentMobile: s.mobile,
            studentLinkedin: s.linkedin,
            studentGithub: s.github,
            studentRef: s
          });
          projects.push({
            id: 'proj-' + (projects.length + 1),
            title: 'Real-Time YOLOv8 & OpenCV Detection Pipeline Logging to MySQL',
            type: 'Industry',
            category: 'Industry Immersion',
            org: org,
            description: contrib || 'Developed a real-time YOLOv8/OpenCV detection pipeline, logging detection events (type, confidence, timestamp) to MySQL.',
            skills: extractTechSkills('YOLOv8 OpenCV MySQL Computer Vision Detection', contrib, s.technical_skills),
            student: s.name,
            studentImage: s.image,
            studentEmail: s.email,
            studentMobile: s.mobile,
            studentLinkedin: s.linkedin,
            studentGithub: s.github,
            studentRef: s
          });
        } else if (/msmf|mazumdhar|cohort|risk stratification/i.test(text)) {
          projects.push({
            id: 'proj-' + (projects.length + 1),
            title: 'Primary Clinical Cohort Analytics & Cardiovascular Risk Stratification Framework',
            type: 'Industry',
            category: 'Industry Immersion',
            org: org,
            description: contrib || 'Collected primary real-world clinical data from a cohort of 174 healthy participants following GCP guidelines; performed data preprocessing, EDA, and statistical analysis using Python to support heart attack and stroke risk stratification.',
            skills: extractTechSkills('Clinical Cohort Risk Stratification GCP Python EDA', contrib, s.technical_skills),
            student: s.name,
            studentImage: s.image,
            studentEmail: s.email,
            studentMobile: s.mobile,
            studentLinkedin: s.linkedin,
            studentGithub: s.github,
            studentRef: s
          });
        } else if (/niepmd|ottobock|prosthetic/i.test(text)) {
          projects.push({
            id: 'proj-' + (projects.length + 1),
            title: 'Clinical Patient Assessments & Prosthetic-Orthotic Management System',
            type: 'Industry',
            category: 'Industry Immersion',
            org: org,
            description: contrib || 'Assisted with clinical patient evaluations, measurements and documentation for prosthetic and orthotic management protocols across NIEPMD, Ottobock India, and Endolite India.',
            skills: extractTechSkills('Clinical Documentation Healthcare Analytics Patient Assessment', contrib, s.technical_skills),
            student: s.name,
            studentImage: s.image,
            studentEmail: s.email,
            studentMobile: s.mobile,
            studentLinkedin: s.linkedin,
            studentGithub: s.github,
            studentRef: s
          });
        }
      }
    }
  });

  return projects;
}

let _projectsCache = [];
let _currentProjectPage = 0;
const PROJECTS_PER_PAGE = 6; // 3 rows x 2 columns - stable pagination

function renderProjectSlice(projects){
  const grid = document.getElementById('project-grid');
  if(!grid) return;
  grid.innerHTML = '';
  if(!Array.isArray(projects) || projects.length === 0){
    grid.innerHTML = '<div class="card" style="grid-column: 1 / -1; justify-content: center; padding: 36px; text-align: center; color: var(--muted);">No matching projects found. Try adjusting your search query or category filter.</div>';
    return;
  }
  for(const p of projects){
    try{
      const safeTitle = (p && p.title) ? String(p.title) : 'Untitled Project';
      const typeBadgeClass = (p.type || '').toLowerCase() === 'academic' ? 'academic' : 'industry';
      const typeBadgeLabel = (p.type || '').toLowerCase() === 'academic' ? 'Academic Research' : 'Industry Immersion';
      const orgBadge = p.org ? `<span class="project-org-badge" title="${p.org}">🏢 ${p.org}</span>` : '';
      const skillsList = Array.isArray(p.skills) ? p.skills : (p.skills ? String(p.skills).split(',').map(s=>s.trim()).filter(Boolean).slice(0,4) : []);
      const skillsHtml = skillsList.map(s=>`<span class="project-skill">${s}</span>`).join('');
      const studentName = p.student || (p.studentRef && p.studentRef.name) || 'M.Sc. Candidate';
      const studentImg = (p.studentImage || (p.studentRef && p.studentRef.image)) ? ('assets/brochure_extract/' + (p.studentImage || p.studentRef.image)) : '';
      const desc = p.description || 'Health Data Science project featuring real-world application, statistical modeling, and actionable healthcare insights.';

      const cardHtml = `<div class="project-card project-card-min" data-id="${p.id || ''}">
        <div>
          <div class="project-card-top">
            <div class="project-badges">
              <span class="project-type-badge ${typeBadgeClass}">${typeBadgeLabel}</span>
            </div>
            ${orgBadge}
          </div>
          <h3 class="project-title" title="${safeTitle}">${safeTitle}</h3>
          <p class="project-description" title="${desc}">${desc}</p>
          <div class="project-skills">${skillsHtml}</div>
        </div>
        <div class="project-card-footer">
          <div class="project-student-info" title="View profile for ${studentName}">
            ${studentImg ? `<img src="${studentImg}" alt="${studentName}" class="project-student-avatar" />` : ''}
            <div class="project-student-meta">
              <span class="project-student-name">${studentName}</span>
              <span class="project-student-dept">M.Sc. Health Data Science</span>
            </div>
          </div>
          <button class="project-view-btn" aria-label="View details of ${safeTitle}">View Details</button>
        </div>
      </div>`;

      const el = createElem(cardHtml);
      const viewBtn = el.querySelector('.project-view-btn');
      if(viewBtn) viewBtn.addEventListener('click', (e)=>{ e.stopPropagation(); openProjectModal(p); });
      const titleEl = el.querySelector('.project-title');
      if(titleEl) titleEl.addEventListener('click', (e)=>{ e.stopPropagation(); openProjectModal(p); });
      const studentInfo = el.querySelector('.project-student-info');
      if(studentInfo) studentInfo.addEventListener('click', (e)=>{
        e.stopPropagation();
        if(p && p.studentRef) openProfileModal(p.studentRef);
      });

      grid.appendChild(el);
    }catch(err){
      console.warn('project render error', err, p);
    }
  }
}

function openProjectModal(p){
  const modal = document.getElementById('project-modal');
  const body = document.getElementById('project-modal-body');
  if(!modal || !body || !p) return;

  const s = p.studentRef || {};
  const studentImg = (p.studentImage || s.image) ? ('assets/brochure_extract/' + (p.studentImage || s.image)) : '';
  const typeBadgeClass = (p.type || '').toLowerCase() === 'academic' ? 'academic' : 'industry';
  const typeBadgeLabel = (p.type || '').toLowerCase() === 'academic' ? 'Academic Research' : 'Industry Immersion';
  const linkedin = ensureUrl(p.studentLinkedin || s.linkedin);
  const github = ensureUrl(p.studentGithub || s.github);
  const mobile = p.studentMobile || s.mobile || '';
  const emailVal = p.studentEmail || s.email || '';
  const skillsList = Array.isArray(p.skills) ? p.skills : (p.skills ? String(p.skills).split(',').map(x=>x.trim()).filter(Boolean) : []);
  const allSkills = (s.technical_skills || '').split(',').map(x=>x.trim()).filter(Boolean);
  const combinedSkills = Array.from(new Set([...skillsList, ...allSkills])).slice(0, 8);

  const html = `<div class="project-modal-view">
    <div class="project-modal-header">
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
        <span class="project-type-badge ${typeBadgeClass}">${typeBadgeLabel}</span>
        <span class="project-org-badge" style="font-size:12px;padding:4px 10px;">🏢 ${p.org || 'SRM Institute of Science and Technology'}</span>
      </div>
      <h2>${p.title}</h2>
    </div>

    <div class="project-modal-student">
      ${studentImg ? `<img src="${studentImg}" alt="${p.student || s.name}" />` : ''}
      <div class="project-modal-student-info" style="flex:1">
        <h3>${p.student || s.name}</h3>
        <p>Candidate, M.Sc. Health Data Science • Batch 2025–2027</p>
        <p style="margin-top:6px;font-size:12.5px;color:var(--muted)">
          ${mobile ? `<span>📞 ${mobile}</span> &nbsp;•&nbsp; ` : ''}
          ${emailVal ? `<a href="mailto:${emailVal}" style="color:var(--accent)">✉️ ${emailVal}</a>` : ''}
        </p>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          ${linkedin ? `<a class="btn-small" href="${linkedin}" target="_blank" rel="noopener">LinkedIn Profile</a>` : ''}
          ${github ? `<a class="btn-small" href="${github}" target="_blank" rel="noopener">GitHub Profile</a>` : ''}
          <button id="project-view-student-profile" class="btn-small" style="background:rgba(6,182,212,0.12);border-color:rgba(6,182,212,0.3);color:var(--accent)">View Full Student Profile</button>
        </div>
      </div>
    </div>

    <div class="project-modal-section">
      <h4>Project Overview & Contributions</h4>
      <p style="white-space:pre-line;line-height:1.6">${p.description || 'Health data science implementation focusing on advanced analytics, rigorous statistical evaluation, and real-world clinical or industry application.'}</p>
    </div>

    <div class="project-modal-section">
      <h4>Relevant Technologies & Domain Skills</h4>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        ${combinedSkills.map(sk=>`<span class="skill-tag" style="margin:0">${sk}</span>`).join('')}
      </div>
    </div>

    <div style="margin-top:24px;display:flex;gap:10px;justify-content:flex-end">
      <button id="project-modal-close-btn" class="btn ghost">Close</button>
    </div>
  </div>`;

  body.innerHTML = html;
  body.querySelectorAll('.skill-tag').forEach(tag => {
    tag.title = 'Click to view in Talent Map';
    tag.addEventListener('click', () => {
      const sName = tag.textContent.trim();
      const norm = normalizeSkill(sName);
      if(norm && _skillsData && _skillsData.map.has(norm)){
        closeProjectModal();
        setTimeout(() => {
          openSkillPanel(norm);
          const sec = document.getElementById('skills');
          if(sec) sec.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    });
  });
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  const closeBtn = document.getElementById('project-modal-close-btn');
  if(closeBtn) closeBtn.addEventListener('click', closeProjectModal);

  const studentProfBtn = document.getElementById('project-view-student-profile');
  if(studentProfBtn && p.studentRef){
    studentProfBtn.addEventListener('click', ()=>{
      closeProjectModal();
      setTimeout(()=> openProfileModal(p.studentRef), 150);
    });
  }
}

function closeProjectModal(){
  const modal = document.getElementById('project-modal');
  if(modal){
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

function renderProjectPage(projects, pageIndex, shouldScroll = false){
  _projectsCache = Array.isArray(projects)? projects.slice() : [];
  const pageSize = PROJECTS_PER_PAGE;
  const totalCount = _projectsCache.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.max(0, Math.min(pageIndex, totalPages - 1));
  _currentProjectPage = page;
  const start = page * pageSize;
  const slice = _projectsCache.slice(start, start + pageSize);
  renderProjectSlice(slice);

  // update pagination UI (1-based display)
  const info = document.getElementById('proj-page-info');
  if(info) info.textContent = `Page ${page + 1} of ${totalPages}`;
  const prevBtn = document.getElementById('proj-prev');
  const nextBtn = document.getElementById('proj-next');
  if(prevBtn) prevBtn.disabled = page <= 0;
  if(nextBtn) nextBtn.disabled = page >= totalPages - 1;

  // update project stats counter
  const stats = document.getElementById('project-stats');
  if(stats){
    if(totalCount === 0){
      stats.textContent = 'Showing 0 projects';
    } else {
      const from = start + 1;
      const to = Math.min(start + pageSize, totalCount);
      stats.textContent = `Showing ${from}–${to} of ${totalCount} projects`;
    }
  }

  if(shouldScroll){
    const projSection = document.getElementById('projects');
    if(projSection){
      projSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

function projectPrev(){
  if(_currentProjectPage > 0) renderProjectPage(_projectsCache, _currentProjectPage - 1, true);
}
function projectNext(){
  const totalPages = Math.max(1, Math.ceil(_projectsCache.length / PROJECTS_PER_PAGE));
  if(_currentProjectPage < totalPages - 1) renderProjectPage(_projectsCache, _currentProjectPage + 1, true);
}

/* ─────────────────────────────────────────────
   SKILLS / TALENT MAP
───────────────────────────────────────────── */

// Canonical skill name normalization map
const SKILL_ALIASES = {
  'powerbi':              'Power BI',
  'power bi':             'Power BI',
  'power-bi':             'Power BI',
  'ml':                   'Machine Learning',
  'machine learning':     'Machine Learning',
  'machine learning and deep learning.': 'Machine Learning',
  'machine learning fundamentals (k-means': 'Machine Learning',
  'deep learning':        'Deep Learning',
  'deep learning.':       'Deep Learning',
  'dl':                   'Deep Learning',
  'deep learning (cnn, yolov8 etc.)': 'Deep Learning',
  'python':               'Python',
  'sql':                  'SQL',
  'r':                    'R',
  'excel':                'Excel',
  'tableau':              'Tableau',
  'spss':                 'SPSS',
  'eda':                  'EDA',
  'exploratory data analysis': 'EDA',
  'data analysis':        'Data Analysis',
  'data analytics':       'Data Analysis',
  'data analytics.':      'Data Analysis',
  'data cleaning':        'Data Preprocessing',
  'data preprocessing':   'Data Preprocessing',
  'data pre-processing':  'Data Preprocessing',
  'data preprocessing and feature engineering': 'Feature Engineering',
  'feature engineering':  'Feature Engineering',
  'statistical programming': 'Statistical Programming',
  'statistical programming.': 'Statistical Programming',
  'statistical analysis': 'Statistical Analysis',
  'biostatistics':        'Biostatistics',
  'clinical data management': 'Clinical Data Management',
  'clinical trial data management': 'Clinical Data Management',
  'healthcare analytics': 'Healthcare Analytics',
  'healthcare and clinical data analytics': 'Healthcare Analytics',
  'healthcare analytics.': 'Healthcare Analytics',
  'healthcare analytics. generative ai & automation: prompt engineering': 'LLM & Generative AI',
  'pharmacovigilance.':   'Pharmacovigilance',
  'pharmacovigilance':    'Pharmacovigilance',
  'pharmacovigilance & adr detection.': 'Pharmacovigilance',
  'pharmacovigilance & adr detection': 'Pharmacovigilance',
  'natural language processing': 'Natural Language Processing (NLP)',
  'nlp':                  'Natural Language Processing (NLP)',
  'llm':                  'LLM & Generative AI',
  'llm fine-tuning & slm building': 'LLM & Generative AI',
  'generative ai':        'LLM & Generative AI',
  'claude code.':         'LLM & Generative AI',
  'rag':                  'RAG (Retrieval-Augmented Generation)',
  'retrieval-augmented generation (rag)': 'RAG (Retrieval-Augmented Generation)',
  'langchain':            'LangChain',
  'prompt engineering':   'Prompt Engineering',
  'prompt engineering.':  'Prompt Engineering',
  'ai agents (crewai':    'AI Agents (CrewAI, AutoGen)',
  'autogen)':             'AI Agents (CrewAI, AutoGen)',
  'knowledge graphs':     'Knowledge Graphs',
  'workflow automation (n8n)': 'Workflow Automation (n8n)',
  'etl':                  'ETL & Pipelines',
  'data augmentation':    'Data Augmentation',
  'medical image analysis': 'Medical Image Analysis',
  'image analysis & segmentation': 'Medical Image Analysis',
  'clinical documentation': 'Clinical Documentation',
  'natural':              null,
  'apriori)':             null,
  'dbscan':               'Machine Learning',
  'hdbscan':              'Machine Learning',
  'looker studio':        'Looker Studio',
  'matplotlib':           'Matplotlib & Seaborn',
  'seaborn':              'Matplotlib & Seaborn',
  'pandas':               'Pandas & NumPy',
  'numpy':                'Pandas & NumPy',
  'documentation and report writing': 'Documentation & Reporting',
  'data visualization':   'Data Visualization',
  'predictive analysis':  'Predictive Analysis',
  'project management':   'Project Management',
  'sales & communication': 'Communication & Domain',
  'marketing':            'Communication & Domain',
  'sas':                  'SAS',
  'ai engineer':          'AI / ML Engineering',
  'ai  engineer':         'AI / ML Engineering',
  'ai/ml engineer':       'AI / ML Engineering',
  'cloud engineer':       'Cloud Engineering',
  'explainable ai.(ready to learn anything)': 'Explainable AI (XAI)',
  'explainable ai':       'Explainable AI (XAI)',
};

// Category taxonomy
const SKILL_CATEGORIES = {
  'core': {
    label: 'Core Data & Stats',
    color: '#06b6d4',
    skills: new Set(['Python','SQL','R','Excel','EDA','Data Analysis','Data Preprocessing',
      'Feature Engineering','Statistical Programming','Statistical Analysis','Biostatistics',
      'SPSS','Documentation & Reporting','Predictive Analysis','Data Visualization',
      'Pandas & NumPy','Matplotlib & Seaborn'])
  },
  'advanced': {
    label: 'AI, ML & GenAI',
    color: '#8b5cf6',
    skills: new Set(['Machine Learning','Deep Learning','Explainable AI (XAI)',
      'LLM & Generative AI','RAG (Retrieval-Augmented Generation)','LangChain',
      'Prompt Engineering','AI Agents (CrewAI, AutoGen)','Knowledge Graphs',
      'Workflow Automation (n8n)','ETL & Pipelines','Medical Image Analysis',
      'Data Augmentation','AI / ML Engineering','Cloud Engineering',
      'Natural Language Processing (NLP)'])
  },
  'clinical': {
    label: 'Clinical & Health',
    color: '#10b981',
    skills: new Set(['Clinical Data Management','Healthcare Analytics','Pharmacovigilance',
      'Clinical Documentation','SAS'])
  },
  'domain': {
    label: 'BI & Domain',
    color: '#f59e0b',
    skills: new Set(['Power BI','Tableau','Looker Studio','Project Management',
      'Communication & Domain'])
  }
};

function normalizeSkill(raw){
  const clean = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if(clean in SKILL_ALIASES) return SKILL_ALIASES[clean];
  for(const cat of Object.values(SKILL_CATEGORIES)){
    for(const s of cat.skills){
      if(s.toLowerCase() === clean) return s;
    }
  }
  if(clean.length < 3 || clean.length > 50) return null;
  return raw.trim();
}

function getSkillCategory(skillName){
  for(const [cat, info] of Object.entries(SKILL_CATEGORIES)){
    if(info.skills.has(skillName)) return cat;
  }
  return 'domain';
}

function buildSkillMap(students){
  const map = new Map();
  students.forEach(s => {
    if(!s.technical_skills) return;
    const raw = s.technical_skills.replace(/\n/g,' ');
    raw.split(',').forEach(tok => {
      const norm = normalizeSkill(tok.trim());
      if(!norm) return;
      if(!map.has(norm)){
        map.set(norm, { category: getSkillCategory(norm), students: [] });
      }
      const entry = map.get(norm);
      if(!entry.students.find(x => x.name === s.name)) entry.students.push(s);
    });
  });
  // Calculate unique student count
  map.forEach(v => { v.count = v.students.length; });
  return map;
}

let _skillsData = null;  // { map, maxCount, students }
let _activeSkillTab = 'all';
let _activeSkillSearch = '';
let _activeSkillSort = 'count'; // 'count' | 'name'
let _activeSkillName = null;

function renderSkillsMap(students){
  const map = buildSkillMap(students);
  const maxCount = students.length;
  _skillsData = { map, maxCount, students };

  // Render Category Tabs
  renderSkillTabs();

  // Bind Search & Sort toolbar controls
  bindSkillsToolbar();

  // Render Skill Cards Grid
  renderSkillGrid();

  // Render Summary Bar
  renderSkillsSummary(map, students.length);

  // Bind Slide-over detail panel
  bindSkillPanel(students);
}

function renderSkillTabs(){
  const tabsEl = document.getElementById('skills-category-tabs');
  if(!tabsEl || !_skillsData) return;
  const { map } = _skillsData;
  tabsEl.innerHTML = '';

  const allTab = createElem(`<button class="skill-tab ${_activeSkillTab === 'all' ? 'active' : ''}" data-cat="all">All Skills (${map.size})</button>`);
  allTab.addEventListener('click', () => setSkillTab('all'));
  tabsEl.appendChild(allTab);

  for(const [cat, info] of Object.entries(SKILL_CATEGORIES)){
    const count = Array.from(map.values()).filter(v => v.category === cat).length;
    if(count === 0) continue;
    const btn = createElem(`<button class="skill-tab ${_activeSkillTab === cat ? 'active' : ''}" data-cat="${cat}">${info.label} (${count})</button>`);
    btn.addEventListener('click', () => setSkillTab(cat));
    tabsEl.appendChild(btn);
  }
}

function setSkillTab(cat){
  _activeSkillTab = cat;
  const tabs = document.querySelectorAll('.skill-tab');
  tabs.forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
  renderSkillGrid();
}

function bindSkillsToolbar(){
  const searchInput = document.getElementById('skills-search');
  if(searchInput && !searchInput.dataset.bound){
    searchInput.dataset.bound = 'true';
    searchInput.addEventListener('input', (e) => {
      _activeSkillSearch = (e.target.value || '').trim().toLowerCase();
      renderSkillGrid();
    });
  }

  const sortCountBtn = document.getElementById('skills-sort-count');
  const sortNameBtn = document.getElementById('skills-sort-name');

  if(sortCountBtn && !sortCountBtn.dataset.bound){
    sortCountBtn.dataset.bound = 'true';
    sortCountBtn.addEventListener('click', () => {
      _activeSkillSort = 'count';
      sortCountBtn.classList.add('active');
      if(sortNameBtn) sortNameBtn.classList.remove('active');
      renderSkillGrid();
    });
  }

  if(sortNameBtn && !sortNameBtn.dataset.bound){
    sortNameBtn.dataset.bound = 'true';
    sortNameBtn.addEventListener('click', () => {
      _activeSkillSort = 'name';
      sortNameBtn.classList.add('active');
      if(sortCountBtn) sortCountBtn.classList.remove('active');
      renderSkillGrid();
    });
  }
}

function renderSkillGrid(){
  const container = document.getElementById('skills-map');
  if(!container || !_skillsData) return;
  container.innerHTML = '';

  const { map, maxCount } = _skillsData;

  // Filter entries
  let entries = Array.from(map.entries());
  if(_activeSkillTab !== 'all'){
    entries = entries.filter(([, v]) => v.category === _activeSkillTab);
  }
  if(_activeSkillSearch){
    entries = entries.filter(([name, v]) => {
      const matchName = name.toLowerCase().includes(_activeSkillSearch);
      const matchStudent = v.students.some(s => (s.name || '').toLowerCase().includes(_activeSkillSearch));
      const matchCat = (SKILL_CATEGORIES[v.category]?.label || '').toLowerCase().includes(_activeSkillSearch);
      return matchName || matchStudent || matchCat;
    });
  }

  // Sort entries
  if(_activeSkillSort === 'name'){
    entries.sort((a, b) => a[0].localeCompare(b[0]));
  } else {
    // default: proficiency desc, then name
    entries.sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));
  }

  if(entries.length === 0){
    container.innerHTML = `<div class="card" style="grid-column:1/-1;padding:32px;text-align:center;color:var(--muted)">
      No skills match "${_activeSkillSearch}". Try searching for Python, RAG, Clinical, or Power BI.
    </div>`;
    return;
  }

  entries.forEach(([skillName, data], idx) => {
    const cat = data.category;
    const pct = Math.round((data.count / maxCount) * 100);
    const catInfo = SKILL_CATEGORIES[cat];
    const catLabel = catInfo ? catInfo.label : 'Domain';

    // Avatar stack (up to 4 avatars)
    const shown = data.students.slice(0, 4);
    const extra = data.students.length - shown.length;
    const avatarsHtml = `<div class="skill-avatars">
      ${shown.map(s => s.image
        ? `<img class="skill-avatar" src="assets/brochure_extract/${s.image}" alt="${s.name}" title="${s.name}">`
        : `<div class="skill-avatar-more" title="${s.name}">${s.name.charAt(0)}</div>`
      ).join('')}
      ${extra > 0 ? `<div class="skill-avatar-more">+${extra}</div>` : ''}
    </div>`;

    const card = createElem(`<div class="skill-card" data-cat="${cat}" data-skill="${skillName}" role="button" tabindex="0" aria-label="View candidates with ${skillName} (${data.count} candidates)" style="animation-delay:${idx * 0.02}s">
      <div class="skill-card-top">
        <span class="skill-name">${skillName}</span>
        <span class="skill-count-badge cat-${cat}">${data.count} ${data.count === 1 ? 'candidate' : 'candidates'}</span>
      </div>
      <div class="skill-bar-track">
        <div class="skill-bar-fill cat-${cat}" style="width:${pct}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="skill-cat-label">${catLabel}</span>
        <span style="font-size:11px;color:var(--muted);font-weight:600">${pct}% cohort</span>
      </div>
      ${avatarsHtml}
    </div>`);

    card.addEventListener('click', () => openSkillPanel(skillName));
    card.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        openSkillPanel(skillName);
      }
    });
    container.appendChild(card);
  });
}

function renderSkillsSummary(map, totalStudents){
  const bar = document.getElementById('skills-summary-bar');
  if(!bar) return;
  const catCounts = { core: 0, advanced: 0, clinical: 0, domain: 0 };
  map.forEach(v => { if(catCounts[v.category] !== undefined) catCounts[v.category]++; });

  const parts = [
    { label: 'Total skills tracked', value: map.size, color: 'var(--accent)' },
    { label: 'Core Data & Stats', value: catCounts.core, color: '#06b6d4' },
    { label: 'AI, ML & GenAI', value: catCounts.advanced, color: '#8b5cf6' },
    { label: 'Clinical & Health', value: catCounts.clinical, color: '#10b981' },
    { label: 'BI & Domain', value: catCounts.domain, color: '#f59e0b' },
    { label: 'Active cohort size', value: totalStudents + ' candidates', color: 'rgba(255,255,255,0.4)' }
  ];

  bar.innerHTML = parts.map(p => `<div class="skills-summary-item">
    <div class="skills-summary-dot" style="background:${p.color}"></div>
    <span class="skills-summary-value">${p.value}</span>
    <span class="skills-summary-label">${p.label}</span>
  </div>`).join('');
}

function openSkillPanel(skillName){
  if(!_skillsData) return;
  const { map, maxCount, students } = _skillsData;
  const data = map.get(skillName);
  if(!data) return;
  _activeSkillName = skillName;

  const panel = document.getElementById('skill-detail-panel');
  const backdrop = document.getElementById('skill-detail-backdrop');
  const catInfo = SKILL_CATEGORIES[data.category];
  const pct = Math.round((data.count / maxCount) * 100);

  document.getElementById('skill-detail-category').textContent = catInfo ? catInfo.label : 'Skill';
  document.getElementById('skill-detail-name').textContent = skillName;
  document.getElementById('skill-detail-count').textContent =
    `${data.count} of ${students.length} candidates (${pct}%) possess this capability`;

  const progressEl = document.getElementById('skill-detail-bar');
  progressEl.innerHTML = `<div class="skill-detail-progress-fill" style="width:0%;transition:width .5s cubic-bezier(.16,1,.3,1)"></div>`;

  // Explore Projects Button
  const actionEl = document.getElementById('skill-detail-action');
  if(actionEl){
    actionEl.innerHTML = `<button class="skill-explore-btn" type="button">
      <span>Explore Projects with "${skillName}"</span>
      <span>&rarr;</span>
    </button>`;
    const btn = actionEl.querySelector('.skill-explore-btn');
    if(btn){
      btn.addEventListener('click', () => {
        closeSkillPanel();
        const projSearch = document.getElementById('project-search');
        if(projSearch){
          projSearch.value = skillName;
          projSearch.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const projSec = document.getElementById('projects');
        if(projSec) projSec.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }

  const studentsEl = document.getElementById('skill-detail-students');
  studentsEl.innerHTML = data.students.map(s => {
    const img = s.image ? `assets/brochure_extract/${s.image}` : '';
    const area = (s.area_of_interest || '').split(',').slice(0, 2).join(' • ');
    return `<div class="skill-student-row" data-name="${s.name}" role="button" tabindex="0" aria-label="View profile for ${s.name}">
      ${img ? `<img src="${img}" alt="${s.name}">` : `<div style="width:46px;height:46px;border-radius:8px;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:var(--accent)">${s.name.charAt(0)}</div>`}
      <div class="skill-student-row-info">
        <h4>${s.name}</h4>
        <p>${area || 'M.Sc. Health Data Science • Batch 2025–2027'}</p>
      </div>
      <div class="skill-student-row-arrow">&rsaquo;</div>
    </div>`;
  }).join('');

  // Bind student row clicks to open candidate profile modal
  studentsEl.querySelectorAll('.skill-student-row').forEach(row => {
    const s = data.students.find(x => x.name === row.dataset.name);
    if(s){
      row.addEventListener('click', () => {
        closeSkillPanel();
        openProfileModal(s);
      });
      row.addEventListener('keydown', e => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          closeSkillPanel();
          openProfileModal(s);
        }
      });
    }
  });

  if(panel){
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
  }
  if(backdrop){
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
  }

  // Animate progress bar fill
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const fill = progressEl.querySelector('.skill-detail-progress-fill');
      if(fill) fill.style.width = pct + '%';
    });
  });
}

function closeSkillPanel(){
  const panel = document.getElementById('skill-detail-panel');
  if(panel){
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }
  const backdrop = document.getElementById('skill-detail-backdrop');
  if(backdrop){
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
  }
  _activeSkillName = null;
}

function bindSkillPanel(students){
  const closeBtn = document.getElementById('skill-panel-close');
  if(closeBtn && !closeBtn.dataset.bound){
    closeBtn.dataset.bound = 'true';
    closeBtn.addEventListener('click', closeSkillPanel);
  }
  const backdrop = document.getElementById('skill-detail-backdrop');
  if(backdrop && !backdrop.dataset.bound){
    backdrop.dataset.bound = 'true';
    backdrop.addEventListener('click', closeSkillPanel);
  }
}

function renderIndustryList(students){
  // Improved grouping: normalize organization names and show a card per organization with intern avatars
  const groups = {};
  students.forEach(s=>{
    if(!s.industry_immersion) return;
    const raw = s.industry_immersion.trim();
    // extract first line that contains org and maybe role/duration
    const firstLine = raw.split('\n')[0] || raw;
    // try to parse organization name (before '(' or '-' or ' - ')
    let orgName = firstLine.split('(')[0].split('-')[0].split(',')[0].trim();
    if(!orgName) orgName = firstLine;
    // Special-case known organization mentions to avoid role-first lines (e.g., "Data Science Intern - Orbiton...")
    if(/orbiton/i.test(raw)) orgName = 'Orbiton Life Sciences';
    // normalize key
    const key = orgName.toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
    groups[key] = groups[key] || {org: orgName, interns: []};
    // find role (look for 'Intern' in the whole field)
    let roleMatch = raw.match(/([A-Za-z &]+Intern)/i);
    let role = roleMatch ? roleMatch[1].trim() : '';
    if(!role){
      // fallback: if line contains words like 'Data Science Intern' or 'Data Analyst Intern'
      const rm = raw.match(/(Data Science Intern|Data Analyst Intern|Data Science Intern\b|Intern)/i);
      role = rm ? rm[0] : '';
    }
    // find duration in parentheses or months
    let durationMatch = raw.match(/\(([^)]+)\)/);
    let duration = durationMatch ? durationMatch[1].trim() : '';
    // push intern
    groups[key].interns.push({name: s.name, image: s.image, role: role, duration: duration, raw: raw, studentRef: s});
  });

  const container = document.getElementById('industry-list');
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'industry-grid';
  Object.values(groups).forEach(g=>{
    const card = document.createElement('div');
    card.className = 'org-card';
    const headerHtml = `<div class="org-header"><div class="org-title">${g.org}</div>${g.interns.some(i=>i.duration)?('<div class="org-duration">'+(g.interns.map(i=>i.duration).filter(Boolean)[0]||'')+'</div>'):''}</div>`;
    const internsHtml = `<div class="interns">${g.interns.map(i=>{ const slug = i.name.replace(/\W+/g,'_'); return `<div class="intern-wrap"><button class="intern" data-name="${i.name}" data-id="${slug}"><img src="${i.image?('assets/brochure_extract/'+i.image):''}" alt="${i.name}"/><div class="meta"><div class="name">${i.name}</div><div class="role">${i.role}</div></div></button><button class="intern-toggle" data-id="${slug}">Details</button></div>` }).join('')}</div>`;
    card.innerHTML = headerHtml + internsHtml;
    // attach click handlers to intern buttons
    card.querySelectorAll('.intern').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const nm = btn.getAttribute('data-name');
        const intern = g.interns.find(x=>x.name===nm);
        if(intern && intern.studentRef) openProfileModal(intern.studentRef);
      });
    });
    // open intern details in a modal popup
    card.querySelectorAll('.intern-toggle').forEach(t=>{
      t.addEventListener('click', ()=>{
        const id = t.getAttribute('data-id');
        const intern = g.interns.find(x=> (x.name.replace(/\W+/g,'_')===id));
        if(intern) openInternModal(intern, g.org);
      });
    });
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

function bindUI(students, projects){
  const search = document.getElementById('search');
  const filter = document.getElementById('filter-select');
  const projectSearch = document.getElementById('project-search');
  const projectType = document.getElementById('project-type-filter');
  const recruitSearch = document.getElementById('recruit-search');
  const recruitBtn = document.getElementById('recruit-search-btn');

  function safe(fn){ try{ fn(); }catch(e){ console.warn('bindUI safe handler error', e); } }

  function refresh(){
    const area = filter ? filter.value : 'all';
    const q = search ? search.value : '';
    const filtered = filterStudents(students, q, area);
    renderStudentsGrid(filtered, students.length);
  }
  if(search) search.addEventListener('input', refresh);
  if(filter) filter.addEventListener('change', refresh);

  function refreshProjects(){
    let list = projects ? projects.slice() : [];
    const q = projectSearch && projectSearch.value ? projectSearch.value.trim().toLowerCase() : '';
    const t = projectType && projectType.value ? projectType.value : 'all';
    if(t !== 'all') {
      list = list.filter(p => (p.type || '').toLowerCase() === t.toLowerCase());
    }
    if(q) {
      list = list.filter(p => {
        const titleMatch = (p.title || '').toLowerCase().includes(q);
        const studentMatch = (p.student || '').toLowerCase().includes(q);
        const orgMatch = (p.org || '').toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);
        const skillsMatch = Array.isArray(p.skills)
          ? p.skills.some(s => s.toLowerCase().includes(q))
          : (p.skills || '').toLowerCase().includes(q);
        return titleMatch || studentMatch || orgMatch || descMatch || skillsMatch;
      });
    }
    renderProjectPage(list, 0, false);
  }
  if(projectSearch) projectSearch.addEventListener('input', refreshProjects);
  if(projectType) projectType.addEventListener('change', refreshProjects);

  // pagination buttons (guard existence)
  const prevBtn = document.getElementById('proj-prev');
  const nextBtn = document.getElementById('proj-next');
  if(prevBtn) prevBtn.addEventListener('click', projectPrev);
  if(nextBtn) nextBtn.addEventListener('click', projectNext);

  // handle window resize to recalc pages
  let resizeTimeout = null;
  window.addEventListener('resize', ()=>{
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(()=>{
      safe(()=> renderProjectPage(_projectsCache, _currentProjectPage, false));
    }, 200);
  });

  if(recruitBtn && recruitSearch){
    recruitBtn.addEventListener('click', ()=>{
      const q = recruitSearch.value.trim();
      const results = filterStudents(students, q, 'all');
      const container = document.getElementById('recruit-results');
      if(!container) return;
      container.innerHTML = '';
      if(results.length===0){
        container.innerHTML = '<div class="card">No matching students found.</div>';
      } else {
        results.forEach(s=> container.appendChild(renderStudentCard(s)));
      }
    });
  }

  // modal close handlers (guarded)
  const modalClose = document.getElementById('modal-close');
  if(modalClose) modalClose.addEventListener('click', closeModal);
  const profileModal = document.getElementById('profile-modal');
  if(profileModal) profileModal.addEventListener('click', (e)=>{ if(e.target.id==='profile-modal') closeModal(); });
  
  const internModalClose = document.getElementById('intern-modal-close');
  if(internModalClose) internModalClose.addEventListener('click', closeInternModal);
  const internModal = document.getElementById('intern-modal');
  if(internModal) internModal.addEventListener('click', (e)=>{ if(e.target.id==='intern-modal') closeInternModal(); });

  const projectModalClose = document.getElementById('project-modal-close');
  if(projectModalClose) projectModalClose.addEventListener('click', closeProjectModal);
  const projectModal = document.getElementById('project-modal');
  if(projectModal) projectModal.addEventListener('click', (e)=>{ if(e.target.id==='project-modal') closeProjectModal(); });

  window.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){
      closeModal();
      closeInternModal();
      closeProjectModal();
      closeSkillPanel();
    }
  });
}

function setupRevealAnimations(){
  // Respect reduced motion
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try{
    const sel = ['.org-card','.skill-card','.skill-pill','.intern','.section-header','.hero-text'];
    const elems = Array.from(document.querySelectorAll(sel.join(',')));
    if(elems.length===0) return;
    const io = new IntersectionObserver((entries, obs)=>{
      entries.forEach(en=>{
        if(en.isIntersecting){
          en.target.classList.add('in-view');
          obs.unobserve(en.target);
        }
      });
    }, {threshold:0.06});
    elems.forEach(e=> io.observe(e));
  }catch(e){ /* noop */ }
}

(async function init(){
  try{
    const students = await loadStudents();
    window._totalStudentsCount = students.length;
    buildFilters(students);
    renderStudentsGrid(students, students.length);
    const projects = buildProjects(students);
    // cache projects for pagination
    _projectsCache = projects.slice();
    renderProjectPage(projects, 0);
    renderSkillsMap(students);
    renderIndustryList(students);
    bindUI(students, projects);
    // trigger reveal animations after initial render
    setupRevealAnimations();
  }catch(err){
    console.error('Initialization error:', err);
    // show friendly message in project area so user sees something
    const grid = document.getElementById('project-grid');
    if(grid) grid.innerHTML = '<div class="card">Error loading data. Check console for details.</div>';
    const sgrid = document.getElementById('student-grid');
    if(sgrid) sgrid.innerHTML = '<div class="card">Error loading students. Check console for details.</div>';
  }
})();
