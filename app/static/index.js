// ===== Shortcuts & State =====
  let AUTH = { status: 'unknown' };
  const $ = (q)=>document.querySelector(q);
  const drop = $('#drop');
  const input = $('#file');
  const chip = $('#chip');
  const chipText = $('#chipText');
  const btnValidate = $('#btnValidate');
  const btnExecute = $('#btnExecute');
  const progress = $('#progress');
  const bar = $('#bar');
  const preview = $('#preview');
  const thead = $('#thead');
  const tbody = $('#tbody');
  const mapper = $('#mapper');
  const colsWrap = $('#cols');
  const validatePanel = $('#validatePanel');
  const kTotal = $('#kTotal');
  const kValid = $('#kValid');
  const kInvalid = $('#kInvalid');
  const srStatus = $('#srStatus');
  const stepsEl = $('#steps');
  const stepbar = $('#stepbar');
  const steps = ['upload','map','validate','run','done'];
  const authBadge = document.getElementById('authBadge');
  const btnLogin = document.getElementById('btnLogin');
  const loginModal = document.getElementById('loginModal');
  const doLogin = document.getElementById('doLogin');
  const inUser = document.getElementById('inUser');
  const inPass = document.getElementById('inPass');
  const inEnv  = document.getElementById('inEnv');
  const loginErr = document.getElementById('loginErr');
  let stepIndex = 0;
  let header = [];
  let mapping = {}; // {key -> header name}
  let LAST_JOB_ID = null;
  let DONE_TIMER = null;

  // cria porcentagem (se não existir)
  let pctLabel = document.getElementById('pctLabel');
  if(!pctLabel){
    pctLabel = document.createElement('span');
    pctLabel.id = 'pctLabel';
    pctLabel.className = 'map-note';
    pctLabel.style.marginLeft = '8px';
    progress?.parentNode?.insertBefore(pctLabel, progress.nextSibling);
  }

  const SCHEMA = [
    {key:'username', label:'Usuário', required:true, synonyms:['username','user','login','usuario','nome_de_usuario']},
    {key:'id', label:'ID', required:true, synonyms:['id','userid','user_id','id_usuario','codigo']},
    {key:'email', label:'E-mail', required:false, synonyms:['email','e-mail','mail','login_email']},
    {key:'origin', label:'Origem', required:false, synonyms:['origem','source','sistema','app','nota']}
  ];

  $('#year').textContent = new Date().getFullYear();

  // ===== Stepper =====
  function setStep(i){
    stepIndex = Math.max(0, Math.min(steps.length-1, i));
    const items = [...stepsEl.querySelectorAll('.step')];
    items.forEach((li,idx)=>{
      li.classList.toggle('current', idx===stepIndex);
      li.classList.toggle('done', idx<stepIndex);
    });
    stepbar.style.width = ((stepIndex)/(steps.length-1))*100 + '%';
  }
  setStep(0);

  // ===== Helpers =====
  function setChip(text, type){
    chip.classList.add('show');
    chip.classList.toggle('error', type === 'error');
    chipText.textContent = text;
  }
  function enable(el, ok){ el.disabled = !ok; }
  function speak(text){ srStatus.textContent = text; }

  // Detect delimiter
  function sniffDelimiter(sample){
    const candidates = [',',';','\t'];
    let best = ',', bestScore = -1;
    const rowsAll = sample.split(/\r?\n/).filter(Boolean);
    const rows = rowsAll.slice(0, 15);
    for(const d of candidates){
      const counts = rows.map(r => r.split(d).length);
      if(!counts.length) continue;
      const avg = counts.reduce((a,c)=>a+c,0)/counts.length;
      const variance = counts.reduce((a,c)=>a+Math.pow(c-avg,2),0)/counts.length;
      const score = avg - variance;
      if(score > bestScore){ bestScore = score; best = d; }
    }
    return best;
  }

  // CSV parse (basic quoted)
  function parseCSV(text, maxRows=200){
    const delim = sniffDelimiter(text);
    const rows = [];
    let i=0, cur='', inQ=false; const push=()=>{ (rows[rows.length-1]||rows.push([])) && rows[rows.length-1].push(cur); cur=''; };
    rows.push([]);
    while(i < text.length){
      const ch = text[i];
      if(ch === '"'){
        if(inQ && text[i+1] === '"'){ cur += '"'; i+=2; continue; }
        inQ = !inQ; i++; continue;
      }
      if(!inQ && (ch === '\n' || ch === '\r')){
        if(cur!=='' || (rows[rows.length-1] && rows[rows.length-1].length>0)) push();
        if(rows[rows.length-1] && rows[rows.length-1].length) rows.push([]);
        while(text[i+1]==='\r' || text[i+1]==='\n') i++;
        i++; if(rows.length-1>=maxRows) break; continue;
      }
      if(!inQ && ch === delim){ push(); i++; continue; }
      cur += ch; i++;
    }
    if(cur!=='' || (rows[rows.length-1] && rows[rows.length-1].length>0)) push();
    return {rows: rows.filter(r => r.some(c => String(c).trim()!=='')), delim};
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }
  function humanSize(bytes){ const u=['B','KB','MB','GB']; let i=0; while(bytes>=1024 && i<u.length-1){bytes/=1024;i++;} return `${bytes.toFixed(i?1:0)} ${u[i]}`; }

  // ===== Renderers =====
  function renderPreview(text){
    const {rows} = parseCSV(text, 120);
    if(!rows.length){ preview.style.display='none'; return; }
    header = rows[0].map(String);
    const body = rows.slice(1, Math.min(rows.length, 30));
    thead.innerHTML = '<tr>' + header.map(h=>`<th>${escapeHtml(h)}</th>`).join('') + '</tr>';
    tbody.innerHTML = body.map(r=>'<tr>'+ r.map(c=>`<td title="${escapeHtml(c)}">${escapeHtml(c)}</td>`).join('') + '</tr>').join('');
    preview.style.display = 'block';
    renderMapper();
    setStep(1);
  }

  function optionsForSelect(){
    const opts = ['<option value="">—</option>'];
    for(const h of header){ opts.push(`<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`); }
    return opts.join('');
  }

  function autoMap(){
    const norm = (s)=>s.toLowerCase().replace(/[^a-z0-9á-ú_]+/gi,'').replace(/ç/g,'c');
    const hNorm = header.map(h=>norm(h));
    for(const f of SCHEMA){
      let best = '';
      for(const syn of f.synonyms){
        const idx = hNorm.indexOf(norm(syn));
        if(idx!==-1){ best = header[idx]; break; }
      }
      mapping[f.key] = best;
    }
  }

  function renderMapper(){
    mapper.style.display = 'grid';
    colsWrap.innerHTML = header.map(h=>`<div class="col-chip" draggable="true" data-col="${escapeHtml(h)}">${escapeHtml(h)}</div>`).join('');
    for(const f of SCHEMA){
      const sel = document.getElementById('pick-'+f.key);
      sel.innerHTML = optionsForSelect();
      sel.addEventListener('change', ()=>{ mapping[f.key] = sel.value; updateTargets(); checkMapping(); });
    }
    autoMap();
    for(const f of SCHEMA){ const sel = document.getElementById('pick-'+f.key); sel.value = mapping[f.key]||''; }
    initDnD();
    updateTargets();
    checkMapping();
    enable(btnValidate, true);
  }

  function updateTargets(){
    document.querySelectorAll('.target').forEach(t=>{
      const key = t.getAttribute('data-key');
      t.classList.toggle('filled', !!(mapping[key]));
    });
    const used = new Set(Object.values(mapping).filter(Boolean));
    document.querySelectorAll('.col-chip').forEach(chip=>{
      chip.style.opacity = used.has(chip.dataset.col) ? .45 : 1;
    });
  }

  function mappingComplete(){ return SCHEMA.every(f => !f.required || (mapping[f.key] && header.includes(mapping[f.key]))); }
  function checkMapping(){ enable(btnValidate, mappingComplete()); }

  // ===== Drag & Drop for mapper =====
  function initDnD(){
    document.querySelectorAll('.col-chip').forEach(ch=>{
      ch.addEventListener('dragstart', e=>{ ch.setAttribute('aria-grabbed','true'); e.dataTransfer.setData('text/plain', ch.dataset.col); });
      ch.addEventListener('dragend', ()=> ch.removeAttribute('aria-grabbed'));
    });
    document.querySelectorAll('.target').forEach(t=>{
      t.addEventListener('dragover', e=>{ e.preventDefault(); t.classList.add('drag'); });
      t.addEventListener('dragleave', ()=> t.classList.remove('drag'));
      t.addEventListener('drop', e=>{
        e.preventDefault(); t.classList.remove('drag');
        const col = e.dataTransfer.getData('text/plain');
        const key = t.getAttribute('data-key');
        mapping[key] = col;
        const sel = document.getElementById('pick-'+key); if(sel){ sel.value = col; }
        updateTargets(); checkMapping();
      });
    });
  }

  // ===== File handling =====
  const MAX_BYTES = 5 * 1024 * 1024; // 5MB
  function handleFile(file){
    if(!file) return;
    if(!/\.csv$/i.test(file.name)){
      setChip('Use um arquivo .csv', 'error'); enable(btnValidate,false); mapper.style.display='none'; preview.style.display='none'; return;
    }
    if(file.size > MAX_BYTES){
      setChip(`${file.name} (${humanSize(file.size)})`, 'error');
      enable(btnValidate,false); mapper.style.display='none'; preview.style.display='none'; return;
    }
    const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
    setChip(`${file.name} • ${humanSize(file.size)}`);

    const reader = new FileReader();
    reader.onload = e => { renderPreview(e.target.result || ''); speak('Prévia pronta'); };
    reader.readAsText(file);
  }

  ['dragenter','dragover'].forEach(evt=>{ drop.addEventListener(evt, e=>{ e.preventDefault(); e.stopPropagation(); drop.classList.add('drag'); }); });
  ['dragleave','drop'].forEach(evt=>{ drop.addEventListener(evt, e=>{ e.preventDefault(); e.stopPropagation(); drop.classList.remove('drag'); }); });
  drop.addEventListener('drop', e=>{ const f = e.dataTransfer.files && e.dataTransfer.files[0]; handleFile(f); });
  drop.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); input.click(); }});
  input.addEventListener('change', e=> handleFile(e.target.files[0]));

  // ===== Auth =====
  function setAuth(status){
    AUTH.status = status;
    if(status==='ok'){ authBadge.textContent='Conectado'; authBadge.style.background='rgba(32,199,122,.12)'; authBadge.style.borderColor='rgba(32,199,122,.28)'; }
    if(status==='none' || status==='error'){ authBadge.textContent='Desconectado'; authBadge.removeAttribute('style'); }
  }
  async function checkAuth(){
    try{
      const r = await fetch('/auth/status');
      const j = await r.json();
      setAuth(j.status==='ok' ? 'ok' : 'none');
    }catch{ setAuth('none'); }
  }
  function openLogin(){ loginModal.classList.add('show'); loginModal.setAttribute('aria-hidden','false'); inUser.focus(); }
  function closeLogin(){ loginModal.classList.remove('show'); loginModal.setAttribute('aria-hidden','true'); loginErr.style.display='none'; }
  btnLogin.addEventListener('click', openLogin);
  loginModal.addEventListener('click', (e)=>{ if(e.target.dataset.close==='modal') closeLogin(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeLogin(); });
  doLogin.addEventListener('click', async ()=>{
    loginErr.style.display='none';
    const payload = { username: inUser.value.trim(), password: inPass.value, environment: inEnv.value.trim() };
    if(!payload.username || !payload.password || !payload.environment){ loginErr.textContent='Preencha todos os campos.'; loginErr.style.display='block'; return; }
    const r = await fetch('/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const j = await r.json().catch(()=>({}));
    if(r.ok && j.status==='ok'){ setAuth('ok'); closeLogin(); }
    else{ setAuth('error'); loginErr.textContent = j.error || 'Falha no login'; loginErr.style.display='block'; }
  });
  checkAuth();

  // ===== Validation =====
  btnValidate.addEventListener('click', async ()=>{
    if(AUTH.status!=='ok'){ openLogin(); return; }
    if(!mappingComplete()) return;
    setStep(2);
    validatePanel.style.display = 'flex';
    kTotal.textContent = '…'; kValid.textContent = '…'; kInvalid.textContent = '…';
    const fd = new FormData();
    const f = input.files[0];
    fd.append('file', f);
    fd.append('mapping', JSON.stringify(mapping));
    try{
      const res = await fetch('/validate', { method:'POST', body: fd });
      if(!res.ok) throw new Error('Falha na validação');
      const json = await res.json();
      kTotal.textContent = json.total ?? '—';
      kValid.textContent = json.validos ?? '—';
      kInvalid.textContent = json.invalidos ?? '—';
      const okToRun = (json.invalidos ?? 0) === 0 && (json.total ?? 0) > 0;
      enable(btnExecute, okToRun);
      speak('Validação concluída');
    }catch(err){
      kTotal.textContent = '—'; kValid.textContent = '—'; kInvalid.textContent = '—';
      enable(btnExecute, false);
      alert('Não foi possível validar agora. Tente novamente.');
    }
  });

  // ===== Execute (upload with progress) =====
  btnExecute.addEventListener('click', ()=>{
    if(AUTH.status!=='ok'){ openLogin(); return; }
    const f = input.files[0]; if(!f) return;
    setStep(3);
    progress.style.display='block'; bar.style.width='0%'; pctLabel.textContent = '0%';
    const fd = new FormData(); fd.append('file', f); fd.append('mapping', JSON.stringify(mapping));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/execute');
    xhr.upload.onprogress = (e)=>{ if(e.lengthComputable){
      const pct = (e.loaded/e.total*100);
      bar.style.width = pct.toFixed(1)+'%';
      pctLabel.textContent = pct.toFixed(1)+'%';
    }};
    xhr.onreadystatechange = ()=>{ if(xhr.readyState===4){
      try{
        const resp = JSON.parse(xhr.responseText||'{}');
        if(resp.jobId){
          LAST_JOB_ID = resp.jobId;
          showJobBanner(resp.jobId); // <- mostra ID do job e copiar
          listenJob(resp.jobId);
        } else {
          finish();
        }
      }catch{ finish(); }
    }};
    xhr.send(fd);
  });

  function copyText(t){
    try{ navigator.clipboard.writeText(t); }catch{
      const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
  }

  // Banner com ID do job + copiar + aviso
  function showJobBanner(jobId){
    // cria um aviso persistente ao lado das ações
    const wrap = document.querySelector('.actions');
    let note = document.getElementById('jobNote');
    if(!note){
      note = document.createElement('div');
      note.id = 'jobNote';
      note.className = 'chip show';
      note.style.marginTop = '8px';
      wrap.parentNode.insertBefore(note, wrap.nextSibling);
    }
    note.innerHTML = `
      <strong>Job ID:</strong>&nbsp;<code>${escapeHtml(jobId)}</code>
      &nbsp;<button type="button" class="btn secondary" style="padding:6px 10px;font-size:.85rem" id="btnCopyJob">Copiar</button>
      <span class="map-note" style="margin-left:8px">Guarde este ID para consultar e baixar o log no futuro.</span>
    `;
    document.getElementById('btnCopyJob')?.addEventListener('click', ()=> copyText(jobId));

    // adiciona (uma vez) campo para baixar log por ID a qualquer momento
    let searchWrap = document.getElementById('logSearch');
    if(!searchWrap){
      searchWrap = document.createElement('div');
      searchWrap.id = 'logSearch';
      searchWrap.className = 'map-note';
      searchWrap.style.marginTop = '8px';
      searchWrap.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <label for="logId">Baixar log por ID:</label>
          <input id="logId" class="input" placeholder="ex: ${escapeHtml(jobId)}" style="max-width:260px">
          <button class="btn secondary" type="button" id="btnFetchLog">Baixar .log</button>
        </div>
      `;
      wrap.parentNode.insertBefore(searchWrap, wrap.nextSibling);
      document.getElementById('btnFetchLog')?.addEventListener('click', ()=>{
        const id = (document.getElementById('logId').value || '').trim();
        if(!id) return;
        window.location.href = `/jobs/${encodeURIComponent(id)}/log`;
      });
    } else {
      const input = document.getElementById('logId');
      if(input && !input.value) input.placeholder = jobId;
    }
  }

  // ===== SSE listener + fallback =====
  function listenJob(jobId){
    try{
      const es = new EventSource(`/jobs/${encodeURIComponent(jobId)}/stream`);

      clearTimeout(DONE_TIMER);
      DONE_TIMER = setTimeout(async ()=>{
        try{
          const r = await fetch(`/jobs/${encodeURIComponent(jobId)}`);
          if(r.ok){
            const j = await r.json();
            if(j.status === 'done' || j.status === 'error'){
              bar.style.width = (j.progress ?? 100) + '%';
              pctLabel.textContent = ((j.progress ?? 100).toFixed ? (j.progress).toFixed(1) : j.progress) + '%';
              es.close();
              finish(j);
            }
          }
        }catch{}
      }, 20000);

      es.addEventListener('done', (e)=>{
        clearTimeout(DONE_TIMER);
        try{
          const data = JSON.parse(e.data||'{}');
          if(typeof data.progress === 'number'){
            bar.style.width = data.progress + '%';
            pctLabel.textContent = data.progress.toFixed(1) + '%';
          }
          es.close();
          finish(data);
        }catch{
          es.close();
          finish();
        }
      });

      es.onmessage = (e)=>{
        const data = JSON.parse(e.data||'{}');
        if(typeof data.progress === 'number'){
          const cur = parseFloat(bar.style.width)||0;
          const next = Math.max(cur, data.progress);
          bar.style.width = next + '%';
          pctLabel.textContent = next.toFixed(1) + '%'; // <-- porcentagem em tempo real
        }
      };

      es.onerror = ()=>{ /* heartbeat mantém conexão; se cair, fallback cuida */ };
    }catch{}
  }

  async function finish(snapshot){
    setStep(4);
    enable(btnExecute, false);
    enable(btnValidate, false);

    let snap = snapshot;
    if(!snap && LAST_JOB_ID){
      try{
        const r = await fetch(`/jobs/${encodeURIComponent(LAST_JOB_ID)}`);
        if(r.ok) snap = await r.json();
      }catch{}
    }

    if(snap){
      if(typeof snap.total === 'number') kTotal.textContent = snap.total;
      if(typeof snap.ok    === 'number') kValid.textContent = snap.ok;
      if(typeof snap.err   === 'number') kInvalid.textContent = snap.err;
    }

    progress.style.display = 'none';
    pctLabel.textContent = ''; // some com a % após concluir
    speak('Concluído');

    // botão "Baixar log" para o job atual
    if(LAST_JOB_ID){
      let logBtn = document.getElementById('btnLog');
      if(!logBtn){
        const wrap = document.querySelector('.actions');
        logBtn = document.createElement('a');
        logBtn.id = 'btnLog';
        logBtn.className = 'btn secondary';
        logBtn.textContent = 'Baixar log (.log)';
        logBtn.href = `/jobs/${encodeURIComponent(LAST_JOB_ID)}/log`;
        logBtn.setAttribute('download', `${LAST_JOB_ID}.log`);
        wrap.appendChild(logBtn);
      }else{
        logBtn.href = `/jobs/${encodeURIComponent(LAST_JOB_ID)}/log`;
        logBtn.setAttribute('download', `${LAST_JOB_ID}.log`);
      }
    }
  }

  // Init
  setChip('Aguardando arquivo');
