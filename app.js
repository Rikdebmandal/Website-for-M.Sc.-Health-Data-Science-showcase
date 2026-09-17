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

function splitNumberedItems(txt){
  if(!txt) return [];
  // split by lines that start with digits or bullets
  const lines = txt.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const items = [];
  for(const l of lines){
    const m = l.replace(/^\d+\.|^[\u2022\-\u2013\u2023]\s*/,'').trim();
    // skip header-like lines
    if(m.length > 6) items.push(m);
  }
  return items;
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
  const card = createElem(`<div class="card" data-name="${s.name}">
    <img src="${img}" alt="${s.name}" />
    <div class="meta">
      <h3>${s.name}</h3>
      <p>${shortFocusFromArea(s.area_of_interest)}</p>
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
  card.querySelector('button').addEventListener('click', ()=>openProfileModal(s));
  return card;
}

function renderStudentsGrid(students){
  const grid = document.getElementById('student-grid');
  grid.innerHTML = '';
  for(const s of students){
    grid.appendChild(renderStudentCard(s));
  }
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

function buildFilters(students){
  const set = new Set();
  students.forEach(s=>{
    if(!s.area_of_interest) return;
    s.area_of_interest.split(',').map(x=>x.trim()).filter(Boolean).forEach(t=>set.add(t));
  });
  const select = document.getElementById('filter-select');
  const arr = ['All',...Array.from(set).sort()];
  for(const a of arr){
    const opt = document.createElement('option');
    opt.value = a.toLowerCase();
    opt.textContent = a;
    select.appendChild(opt);
  }
}

function filterStudents(students, q, area){
  q = q? q.toLowerCase(): '';
  area = area? area.toLowerCase(): 'all';
  return students.filter(s=>{
    if(area !== 'all'){
      const areas = (s.area_of_interest||'').toLowerCase();
      if(!areas.includes(area)) return false;
    }
    if(!q) return true;
    const hay = [s.name, s.area_of_interest, s.technical_skills, s.industry_immersion, s.academic_projects].filter(Boolean).join(' ').toLowerCase();
    // terms separated by + should be AND
    const terms = q.split('+').map(t=>t.trim()).filter(Boolean);
    return terms.every(t => hay.includes(t));
  });
}

function buildProjects(students){
  const projects = [];
  for(const s of students){
    const ac = splitNumberedItems(s.academic_projects || '');
    ac.forEach(p=> projects.push({title: p, student: s.name, type: 'Academic', skills: s.technical_skills || '', studentRef: s}));
    const ind = splitNumberedItems(s.industry_immersion || '');
    ind.forEach(p=> projects.push({title: p, student: s.name, type: 'Industry', skills: s.technical_skills || '', studentRef: s}));
  }
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
    grid.innerHTML = '<div class="card">No projects found.</div>';
    return;
  }
  for(const p of projects){
    try{
      const safeTitle = (p && p.title) ? String(p.title) : 'Untitled Project';
      const skillsList = (p && p.skills) ? String(p.skills).split(',').map(s=>s.trim()).filter(Boolean).slice(0,4) : [];
      const skillsHtml = skillsList.map(s=>`<span class="project-skill">${s}</span>`).join('');
      const typeBadge = `<span class="project-type">${p && p.type}</span>`;
      const shortTitle = safeTitle.length>90 ? safeTitle.slice(0,90)+'…' : safeTitle;
      const studentName = (p && p.student) ? p.student : '';
      const cardHtml = `<div class="project-card project-card-min">
        <div class="project-row">
          <div class="project-title" title="${safeTitle}">${shortTitle}</div>
          <div class="project-meta">${typeBadge}</div>
        </div>
        <div class="project-sub">${studentName}</div>
        <div class="project-skills">${skillsHtml}</div>
        <div class="project-actions"><button class="btn-small">View</button></div>
      </div>`;
      const el = createElem(cardHtml);
      const btn = el.querySelector('button');
      if(btn) btn.addEventListener('click', ()=>{ try{ if(p && p.studentRef) openProfileModal(p.studentRef); }catch(e){console.warn('openProfileModal error', e);} });
      grid.appendChild(el);
    }catch(err){
      console.warn('project render error', err, p);
    }
  }
}

function renderProjectPage(projects, pageIndex){
  _projectsCache = Array.isArray(projects)? projects.slice() : [];
  const pageSize = PROJECTS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(_projectsCache.length / pageSize));
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
  if(slice.length === 0){
    const grid = document.getElementById('project-grid');
    if(grid) grid.innerHTML = '<div class="card">No projects available for this selection.</div>';
  }
}

function projectPrev(){
  if(_currentProjectPage > 0) renderProjectPage(_projectsCache, _currentProjectPage - 1);
}
function projectNext(){
  const totalPages = Math.max(1, Math.ceil(_projectsCache.length / PROJECTS_PER_PAGE));
  if(_currentProjectPage < totalPages - 1) renderProjectPage(_projectsCache, _currentProjectPage + 1);
}

function renderSkillsMap(students){
  const map = new Map();
  students.forEach(s=>{
    if(!s.technical_skills) return;
    s.technical_skills.split(',').map(x=>x.trim()).filter(Boolean).forEach(skill=>{
      map.set(skill, (map.get(skill)||0)+1);
    });
  });
  const container = document.getElementById('skills-map');
  container.innerHTML = '';
  Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).forEach(([skill,count])=>{
    const el = createElem(`<div class="skill-pill">${skill} <span style="opacity:0.7;font-size:12px;margin-left:8px">(${count})</span></div>`);
    container.appendChild(el);
  });
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
    renderStudentsGrid(filtered);
  }
  if(search) search.addEventListener('input', refresh);
  if(filter) filter.addEventListener('change', refresh);

  function refreshProjects(){
    let list = projects ? projects.slice() : [];
    const q = projectSearch && projectSearch.value ? projectSearch.value.trim().toLowerCase() : '';
    const t = projectType && projectType.value ? projectType.value : 'all';
    if(t!=='all') list = list.filter(p=> (p.type||'').toLowerCase()===t.toLowerCase());
    if(q) list = list.filter(p=> (p.title||'').toLowerCase().includes(q) || (p.skills||'').toLowerCase().includes(q));
    renderProjectPage(list, 0);
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
      // re-render current page with new columns
      safe(()=> renderProjectPage(_projectsCache, _currentProjectPage));
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

  // modal close (guarded)
  const modalClose = document.getElementById('modal-close');
  if(modalClose) modalClose.addEventListener('click', closeModal);
  const profileModal = document.getElementById('profile-modal');
  if(profileModal) profileModal.addEventListener('click', (e)=>{ if(e.target.id==='profile-modal') closeModal(); });
  const internModalClose = document.getElementById('intern-modal-close');
  if(internModalClose) internModalClose.addEventListener('click', closeInternModal);
  const internModal = document.getElementById('intern-modal');
  if(internModal) internModal.addEventListener('click', (e)=>{ if(e.target.id==='intern-modal') closeInternModal(); });
}

function setupRevealAnimations(){
  // Respect reduced motion
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try{
    const sel = ['.card','.project-card-min','.org-card','.skill-pill','.intern','.section-header','.hero-text'];
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
    buildFilters(students);
    renderStudentsGrid(students);
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
